"""
Scans router.
Handles triggering and monitoring security scans.

Data flow:
1. Receive scan request → create scan record in DB (status: queued)
2. Return scan_id immediately
3. Background worker (worker.py) polls DB, picks up the scan
4. Worker executes pipeline in a thread: clone → semgrep → groq → registry → save results
5. Frontend polls GET /api/scans/{scan_id}/status for progress
"""
import asyncio
import logging
import uuid
import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.database import get_db
from app.rate_limit import limiter
from app.services import semgrep as semgrep_service
from app.services import gitleaks as gitleaks_service
from app.services import groq as groq_service
from app.services import registry as registry_service
from app.services import github as github_service
from app.services.scorer import calculate_scores_by_severity
from app.services import decrypt_token, get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("")
@limiter.limit("10/minute")
async def trigger_scan(
    request: Request,
    repo_id: str = Query(...),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Trigger a security scan for a repository.
    Returns immediately with a scan_id — use status endpoint to poll progress.
    The actual scan execution is handled asynchronously by the background worker (worker.py).
    """
    # Fetch repo from DB
    repo_result = db.table("repos").select("*").eq("id", repo_id).eq("user_id", current_user_id).execute()
    if not repo_result.data:
        raise HTTPException(status_code=404, detail="Repository not found")

    repo = repo_result.data[0]

    # Fetch user details
    user_result = db.table("users").select("github_access_token, plan").eq("id", current_user_id).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_result.data[0]
    plan = user_data.get("plan", "free")

    if plan == "free":
        # Count completed scans on this specific repo (not total repos owned).
        # Free plan is limited to 1 completed scan per repository.
        completed_scans_res = (
            db.table("scans")
            .select("id", count="exact")
            .eq("repo_id", repo_id)
            .eq("status", "completed")
            .execute()
        )
        completed_scans = completed_scans_res.count or 0
        if completed_scans >= 1:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Free plan allows 1 scan per repository. "
                    "Please upgrade to Pro for unlimited re-scans."
                ),
            )

    encrypted_token = user_data.get("github_access_token")
    if not encrypted_token:
        raise HTTPException(status_code=400, detail="GitHub access token missing — re-authenticate")

    try:
        access_token = decrypt_token(encrypted_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail=f"GitHub authentication error: {exc}",
        )

    # Fetch latest repo size from GitHub to prevent OOM on large repositories
    size_kb = 0
    try:
        meta = await github_service.get_repo_metadata_async(access_token, repo["full_name"])
        size_kb = meta.get("size_kb", 0)
    except Exception as e:
        logger.warning(f"Could not fetch repo size from GitHub: {e}")

    if size_kb > 500_000:  # 500MB uncompressed
        raise HTTPException(status_code=400, detail=(
            f"Repo is {size_kb//1024}MB — too large for free plan. "
            "Upgrade to Pro for large repo support."
        ))
    elif size_kb > 100_000:
        logger.warning(f"Large repo ({size_kb//1024}MB): {repo['full_name']}")

    # Create scan record — the background worker picks this up from the DB
    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    db.table("scans").insert({
        "id": scan_id,
        "repo_id": repo_id,
        "status": "queued",
        "triggered_at": now,
        "findings_count": 0,
        "progress": 0,
        "log_messages": ["[SYSTEM] Scan queued. Starting engine..."],
    }).execute()

    return {"scan_id": scan_id, "status": "queued"}


@router.get("/{scan_id}/status")
async def get_scan_status(
    scan_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Poll scan progress. Frontend calls this every 2 seconds.
    Returns: { status, progress (0-100), log_messages, findings_count }
    """
    # Get scan from DB and join repos to verify ownership
    result = db.table("scans").select("*, repos!inner(user_id)").eq("id", scan_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan = result.data[0]
    
    # Verify ownership
    if scan["repos"]["user_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this scan")

    findings_count = 0
    if scan["status"] == "completed":
        findings_count = scan.get("findings_count", 0)
        if not findings_count:
            res_count = db.table("issues").select("id", count="exact").eq("scan_id", scan_id).execute()
            findings_count = res_count.count or 0

    return {
        "scan_id": scan_id,
        "status": scan["status"],
        "progress": scan.get("progress", 0),
        "log_messages": scan.get("log_messages") or [],
        "findings_count": findings_count,
    }


async def run_scan_pipeline(scan_id: str, repo: dict, access_token: str, db):
    """
    The actual scan pipeline — runs in background.
    Updates progress and log_messages in DB throughout.
    Wraps the entire pipeline in a 10-minute timeout.
    """
    logs_list = []
    # Initialize logs list from DB
    scan_res = db.table("scans").select("log_messages").eq("id", scan_id).execute()
    if scan_res.data and scan_res.data[0].get("log_messages"):
        logs_list = list(scan_res.data[0]["log_messages"])
    else:
        logs_list = ["[SYSTEM] Scan queued. Starting engine..."]

    def log(msg: str, progress: int | None = None):
        logs_list.append(msg)
        update_data = {"log_messages": logs_list}
        if progress is not None:
            update_data["progress"] = progress
        db.table("scans").update(update_data).eq("id", scan_id).execute()
        logger.info(f"[Scan {scan_id[:8]}] {msg}")

    async def _run_pipeline():
        """Inner pipeline body — wrapped with asyncio.wait_for for overall timeout."""
        db.table("scans").update({"status": "running", "progress": 5}).eq("id", scan_id).execute()

        # Fetch user plan early — needed for feature gating throughout the pipeline
        plan = "free"
        try:
            user_res = db.table("users").select("plan").eq("id", repo["user_id"]).execute()
            if user_res.data:
                plan = user_res.data[0].get("plan", "free")
        except Exception as e:
            logger.warning(f"Failed to fetch user plan in background pipeline: {e}")

        # ── Step 1: Clone + Semgrep ─────────────────────────────────────────
        log(f"[SYSTEM] Cloning repository: {repo['full_name']}...", 5)
        clone_url = f"https://github.com/{repo['full_name']}.git"

        log("[SEMGREP] Running static analysis with --config=auto rules...", 15)
        findings, repo_dir = await semgrep_service.scan_repository(
            full_name=repo["full_name"],
            clone_url=clone_url,
            access_token=access_token,
        )
        log(f"[SEMGREP] Scan complete. Found {len(findings)} potential issues.", 40)

        # We wrap the remaining directory-dependent operations in a try-finally
        # to ensure the directory is cleaned up under any circumstances.
        package_results = []
        package_issues: list[dict] = []  # Initialised here so scope is guaranteed outside inner try
        try:
            # ── Step 1.5: Secret Detection (Gitleaks) ───────────────────────────
            log("[GITLEAKS] Running secret detection...", 40)
            try:
                secret_findings = gitleaks_service.scan_dir(
                    repo_dir=repo_dir,
                    full_name=repo["full_name"],
                    access_token=access_token,
                )
                findings.extend(secret_findings)
                log(f"[GITLEAKS] Secret scan complete. Found {len(secret_findings)} secret(s).", 44)
            except Exception as e:
                logger.warning("Gitleaks scan failed", exc_info=True)
                log(f"[GITLEAKS] Secret scan failed (non-fatal): {e}", 44)

            # ── Step 1.8: Dependency Audit (npm audit + pip-audit + Registry) ───
            log("[REGISTRY] Auditing packages for vulnerabilities and registry check...", 44)
            try:
                package_files = semgrep_service.read_package_files(
                    repo_dir=repo_dir,
                    access_token=access_token,
                )
                audit_res = await registry_service.audit_packages(
                    package_files=package_files,
                    clone_url=clone_url,
                    access_token=access_token,
                )
                package_results = audit_res.get("packages", [])
                package_issues = audit_res.get("issues", [])
                
                # Add package issues to the findings list so they can be explained by Groq and saved in the issues table!
                findings.extend(package_issues)
                
                dangerous_count = sum(1 for p in package_results if p["status"] == "dangerous")
                log(f"[REGISTRY] Dependency audit complete. Found {len(package_issues)} package issues. {dangerous_count} dangerous package(s).", 48)
            except Exception as e:
                logger.warning("Dependency audit failed", exc_info=True)
                log(f"[REGISTRY] Dependency audit failed (non-fatal): {e}", 48)

            # ── Step 1.9: Independent AI Review (Groq Logic Flaws) ─────────────
            # AI Review is a Pro/Team feature — it calls Groq on up to 20 files
            # and is rate-limited to paid plans to control API costs.
            if plan in ("pro", "team"):
                log("[AI REVIEW] Running independent AI vulnerability review on important files...", 48)
                try:
                    from app.services.ai_review import run_ai_review
                    ai_findings = await run_ai_review(repo_dir=repo_dir, limit=20)
                    findings.extend(ai_findings)
                    log(f"[AI REVIEW] AI review complete. Found {len(ai_findings)} logic flaws/vulnerabilities.", 52)
                except Exception as e:
                    logger.warning("AI review failed", exc_info=True)
                    log(f"[AI REVIEW] AI review failed (non-fatal): {e}", 52)
            else:
                log("[AI REVIEW] Skipped — upgrade to Pro to enable AI-powered logic flaw detection.", 52)


        finally:
            if repo_dir:
                temp_dir_to_clean = os.path.dirname(repo_dir)
                shutil.rmtree(temp_dir_to_clean, ignore_errors=True)

        # ── Step 2: Groq enrichment ─────────────────────────────────────────
        if findings:
            log(f"[GROQ] Sending {len(findings)} findings to Groq for plain English explanation...", 45)
            enriched_findings = await groq_service.explain_findings_batch(findings, plan=plan)
            log("[GROQ] AI explanations complete.", 70)
        else:
            enriched_findings = []
            log("[GROQ] No findings to explain.", 70)

        # ── Step 3: Save issues to DB ───────────────────────────────────────
        log("[DB] Saving issues to database...", 75)
        now = datetime.now(timezone.utc).isoformat()

        # Fetch existing unresolved/dismissed issues for this repo to synchronize
        existing_result = db.table("issues").select("*").eq("repo_id", repo["id"]).in_("status", ["open", "dismissed"]).execute()
        existing_issues = existing_result.data or []

        existing_by_key = {}
        for issue in existing_issues:
            key = (issue["file_path"], issue["semgrep_rule_id"])
            existing_by_key.setdefault(key, []).append(issue)

        # Check if database schema includes confidence and what_changed columns
        has_confidence_col = False
        try:
            db.table("issues").select("id, confidence").limit(1).execute()
            has_confidence_col = True
        except Exception:
            logger.info("Database 'issues' table does not have 'confidence' column. Skipping confidence saving.")

        # Check if database schema includes source column
        has_source_col = False
        try:
            db.table("issues").select("id, source").limit(1).execute()
            has_source_col = True
        except Exception:
            logger.info("Database 'issues' table does not have 'source' column. Skipping source saving.")

        new_issue_rows = []

        # Compare and synchronize
        for f in enriched_findings:
            key = (f["file_path"], f["semgrep_rule_id"])
            if key in existing_by_key and existing_by_key[key]:
                # Retain existing active issue, update its details
                matched_issue = existing_by_key[key].pop(0)
                f["id"] = matched_issue["id"] # Save ID in finding dict
                update_payload = {
                    "scan_id": scan_id,
                    "line_start": f["line_start"],
                    "line_end": f["line_end"],
                    "code_snippet": f["code_snippet"],
                    "plain_english_title": f["plain_english_title"],
                    "plain_english_body": f["plain_english_body"],
                    "impact_bullets": f["impact_bullets"],
                    "ai_fix_code": f["ai_fix_code"],
                }
                if has_confidence_col:
                    update_payload["confidence"] = f.get("confidence")
                    update_payload["what_changed"] = f.get("what_changed")
                if has_source_col:
                    update_payload["source"] = f.get("source", "semgrep")
                db.table("issues").update(update_payload).eq("id", matched_issue["id"]).execute()
            else:
                # Insert as a new issue
                insert_row = {
                    "id": str(uuid.uuid4()),
                    "repo_id": repo["id"],
                    "scan_id": scan_id,
                    "semgrep_rule_id": f["semgrep_rule_id"],
                    "severity": f["severity"],
                    "file_path": f["file_path"],
                    "line_start": f["line_start"],
                    "line_end": f["line_end"],
                    "code_snippet": f["code_snippet"],
                    "plain_english_title": f["plain_english_title"],
                    "plain_english_body": f["plain_english_body"],
                    "impact_bullets": f["impact_bullets"],
                    "ai_fix_code": f["ai_fix_code"],
                    "status": "open",
                    "created_at": now,
                }
                f["id"] = insert_row["id"] # Save ID in finding dict
                if has_confidence_col:
                    insert_row["confidence"] = f.get("confidence")
                    insert_row["what_changed"] = f.get("what_changed")
                if has_source_col:
                    insert_row["source"] = f.get("source", "semgrep")
                new_issue_rows.append(insert_row)

        # Save new issues in bulk
        if new_issue_rows:
            db.table("issues").insert(new_issue_rows).execute()

        # Any remaining issues in existing_by_key list were not found in the new scan (they are resolved/fixed)
        resolved_ids = []
        for key, issues_list in existing_by_key.items():
            for issue in issues_list:
                resolved_ids.append(issue["id"])

        if resolved_ids:
            db.table("issues").update({"status": "fixed"}).in_("id", resolved_ids).execute()

        # ── Step 3.5: Run Cross-Finding Correlation (Attack Surfaces) ───
        log("[CORRELATION] Running correlation pass to group findings into Attack Surfaces...", 78)
        try:
            # Delete old attack surfaces first
            db.table("attack_surfaces").delete().eq("repo_id", repo["id"]).execute()
            
            # Fetch active open issues directly from database
            open_issues_res = db.table("issues").select("*").eq("repo_id", repo["id"]).eq("status", "open").execute()
            open_issues = open_issues_res.data or []
            
            if len(open_issues) >= 2:
                from app.services.correlation import correlate_scan_findings
                await correlate_scan_findings(
                    repo_id=repo["id"],
                    scan_id=scan_id,
                    findings=open_issues,
                    db_client=db,
                )
                log(f"[CORRELATION] Correlation pass complete. Attack surfaces saved.", 79)
            else:
                log("[CORRELATION] Not enough open issues to run correlation pass (< 2).", 79)
        except Exception as e:
            logger.warning(f"Correlation pass failed: {e}", exc_info=True)
            log(f"[CORRELATION] Correlation pass failed (non-fatal): {e}", 79)

        # ── Step 4: Package registry save ───────────────────────────────────
        log("[DB] Saving package audit results to database...", 80)
        try:
            if package_results:
                pkg_rows = [
                    {
                        "id": str(uuid.uuid4()),
                        "repo_id": repo["id"],
                        "scan_id": scan_id,
                        "package_name": p["package_name"],
                        "package_manager": p["package_manager"],
                        "status": p["status"],
                        "exists_in_registry": p["exists_in_registry"],
                        "weekly_downloads": p["weekly_downloads"],
                        "reason": p["reason"],
                        "alternative_name": p.get("alternative_name"),
                        "checked_at": now,
                    }
                    for p in package_results
                ]
                db.table("packages").insert(pkg_rows).execute()
            
            dangerous_count = sum(1 for p in package_results if p["status"] == "dangerous") if package_results else 0
            log(f"[DB] Package results saved. {dangerous_count} dangerous package(s) found.", 88)
        except Exception as e:
            log(f"[DB] Package results save failed (non-fatal): {e}", 88)

        # ── Step 5: Calculate health score ──────────────────────────────────
        log("[SCORER] Calculating code health score...", 92)
        all_issues = db.table("issues").select("severity,status").eq("repo_id", repo["id"]).execute()
        scores = calculate_scores_by_severity(all_issues.data or [])

        db.table("repos").update({
            "health_score": scores["health_score"],
            "critical_count": scores["critical_count"],
            "high_count": scores["high_count"],
            "medium_count": scores["medium_count"],
            "low_count": scores["low_count"],
            "last_scanned_at": now,
        }).eq("id", repo["id"]).execute()

        # Record health history — real data only, no synthetic seed points.

        db.table("health_history").insert({
            "id": str(uuid.uuid4()),
            "repo_id": repo["id"],
            "score": scores["health_score"],
            "introduced_count": len(enriched_findings),
            "fixed_count": 0,
            "recorded_at": now,
        }).execute()

        # ── Step 6: Complete ─────────────────────────────────────────────────
        db.table("scans").update({
            "status": "completed",
            "completed_at": now,
            "findings_count": len(enriched_findings),
        }).eq("id", scan_id).execute()

        log(f"[SUCCESS] Scan complete. Health score: {scores['health_score']}/100. Issues: {len(enriched_findings)} found.", 100)

    try:
        await asyncio.wait_for(_run_pipeline(), timeout=600)
    except asyncio.TimeoutError:
        logger.error(f"Scan {scan_id[:8]} timed out after 10 minutes")
        db.table("scans").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": "Scan timed out after 10 minutes",
        }).eq("id", scan_id).execute()
        log("[TIMEOUT] Scan exceeded 10-minute limit and was terminated.", 100)
    except Exception as e:
        logger.exception(f"Scan pipeline failed for scan_id={scan_id}")
        error_msg = f"[ERROR] Scan failed: {str(e)}"
        db.table("scans").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", scan_id).execute()
        log(error_msg, 100)


def run_scan_sync(scan_id: str, repo: dict, access_token: str) -> None:
    """
    Synchronous wrapper around the async scan pipeline.
    Called by the background worker from a thread pool.
    Creates a fresh event loop for this thread.
    """
    from app.database import get_supabase
    db = get_supabase()
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            run_scan_pipeline(scan_id=scan_id, repo=repo, access_token=access_token, db=db)
        )
    finally:
        loop.close()
