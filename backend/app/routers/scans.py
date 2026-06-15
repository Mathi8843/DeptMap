"""
Scans router.
Handles triggering and monitoring security scans.

The scan pipeline runs as a background task to avoid HTTP timeout:
1. Receive scan request → create scan record (status: queued)
2. Return scan_id immediately
3. Background task: clone → semgrep → groq → registry → save results
4. Frontend polls GET /api/scans/{scan_id}/status for progress
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.database import get_db
from app.services import semgrep as semgrep_service
from app.services import groq as groq_service
from app.services import registry as registry_service
from app.services.scorer import calculate_scores_by_severity
from app.services import decrypt_token, get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("")
async def trigger_scan(
    repo_id: str = Query(...),
    current_user_id: str = Depends(get_current_user_id),
    background_tasks: BackgroundTasks = None,
    db=Depends(get_db),
):
    """
    Trigger a security scan for a repository.
    Returns immediately with a scan_id — use status endpoint to poll progress.
    """
    # Fetch repo from DB
    repo_result = db.table("repos").select("*").eq("id", repo_id).eq("user_id", current_user_id).execute()
    if not repo_result.data:
        raise HTTPException(status_code=404, detail="Repository not found")

    repo = repo_result.data[0]

    # Fetch user's GitHub access token
    user_result = db.table("users").select("github_access_token").eq("id", current_user_id).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    encrypted_token = user_result.data[0].get("github_access_token")
    if not encrypted_token:
        raise HTTPException(status_code=400, detail="GitHub access token missing — re-authenticate")

    access_token = decrypt_token(encrypted_token)

    # Create scan record
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

    # Launch background scan
    if background_tasks:
        background_tasks.add_task(
            run_scan_pipeline,
            scan_id=scan_id,
            repo=repo,
            access_token=access_token,
            db=db,
        )

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

    try:
        db.table("scans").update({"status": "running", "progress": 5}).eq("id", scan_id).execute()

        # ── Step 1: Clone + Semgrep ─────────────────────────────────────────
        log(f"[SYSTEM] Cloning repository: {repo['full_name']}...", 5)
        clone_url = f"https://github.com/{repo['full_name']}.git"

        log("[SEMGREP] Running static analysis with --config=auto rules...", 15)
        findings, _ = await semgrep_service.scan_repository(
            full_name=repo["full_name"],
            clone_url=clone_url,
            access_token=access_token,
        )
        log(f"[SEMGREP] Scan complete. Found {len(findings)} potential issues.", 40)

        # ── Step 2: Groq enrichment ─────────────────────────────────────────
        if findings:
            log(f"[GROQ] Sending {len(findings)} findings to Groq for plain English explanation...", 45)
            enriched_findings = await groq_service.explain_findings_batch(findings)
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

        new_issue_rows = []

        # Compare and synchronize
        for f in enriched_findings:
            key = (f["file_path"], f["semgrep_rule_id"])
            if key in existing_by_key and existing_by_key[key]:
                # Retain existing active issue, update its details
                matched_issue = existing_by_key[key].pop(0)
                db.table("issues").update({
                    "scan_id": scan_id,
                    "line_start": f["line_start"],
                    "line_end": f["line_end"],
                    "code_snippet": f["code_snippet"],
                    "plain_english_title": f["plain_english_title"],
                    "plain_english_body": f["plain_english_body"],
                    "impact_bullets": f["impact_bullets"],
                    "ai_fix_code": f["ai_fix_code"],
                }).eq("id", matched_issue["id"]).execute()
            else:
                # Insert as a new issue
                new_issue_rows.append({
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
                })

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

        # ── Step 4: Package registry audit ──────────────────────────────────
        log("[REGISTRY] Checking npm/PyPI package registries for hallucinated packages...", 80)
        try:
            package_files = semgrep_service.get_package_files(
                clone_url=clone_url,
                access_token=access_token,
            )
            package_results = await registry_service.audit_packages(package_files)

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

            dangerous_count = sum(1 for p in package_results if p["status"] == "dangerous")
            log(f"[REGISTRY] Package audit complete. {dangerous_count} dangerous package(s) found.", 88)
        except Exception as e:
            log(f"[REGISTRY] Package audit failed (non-fatal): {e}", 88)

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

        # Record health history
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

    except Exception as e:
        logger.exception(f"Scan pipeline failed for scan_id={scan_id}")
        error_msg = f"[ERROR] Scan failed: {str(e)}"
        db.table("scans").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", scan_id).execute()
        log(error_msg, 100)
