"""
Scans router.
Handles triggering and monitoring security scans.

The scan pipeline runs as a background task to avoid HTTP timeout:
1. Receive scan request → create scan record (status: queued)
2. Return scan_id immediately
3. Background task: clone → semgrep → claude → registry → save results
4. Frontend polls GET /api/scans/{scan_id}/status for progress
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.database import get_db
from app.services import semgrep as semgrep_service
from app.services import claude as claude_service
from app.services import registry as registry_service
from app.services.scorer import calculate_scores_by_severity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scans", tags=["scans"])

# In-memory scan progress store (in production: use Redis or Supabase Realtime)
_scan_progress: dict[str, dict] = {}


@router.post("")
async def trigger_scan(
    repo_id: str = Query(...),
    user_id: str = Query(...),
    background_tasks: BackgroundTasks = None,
    db=Depends(get_db),
):
    """
    Trigger a security scan for a repository.
    Returns immediately with a scan_id — use status endpoint to poll progress.
    """
    # Fetch repo from DB
    repo_result = db.table("repos").select("*").eq("id", repo_id).eq("user_id", user_id).maybe_single().execute()
    if not repo_result.data:
        raise HTTPException(status_code=404, detail="Repository not found")

    repo = repo_result.data

    # Fetch user's GitHub access token
    user_result = db.table("users").select("github_access_token").eq("id", user_id).maybe_single().execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user_result.data.get("github_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub access token missing — re-authenticate")

    # Create scan record
    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    db.table("scans").insert({
        "id": scan_id,
        "repo_id": repo_id,
        "status": "queued",
        "triggered_at": now,
        "findings_count": 0,
    }).execute()

    # Track in-memory progress
    _scan_progress[scan_id] = {
        "status": "queued",
        "progress": 0,
        "logs": ["[SYSTEM] Scan queued. Starting engine..."],
    }

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
async def get_scan_status(scan_id: str, db=Depends(get_db)):
    """
    Poll scan progress. Frontend calls this every 2 seconds.
    Returns: { status, progress (0-100), log_messages, findings_count }
    """
    # Check in-memory first (real-time progress)
    if scan_id in _scan_progress:
        progress = _scan_progress[scan_id]

        # Also get findings count from DB if completed
        findings_count = 0
        if progress.get("status") == "completed":
            result = db.table("issues").select("id", count="exact").eq("scan_id", scan_id).execute()
            findings_count = result.count or 0

        return {
            "scan_id": scan_id,
            "status": progress["status"],
            "progress": progress["progress"],
            "log_messages": progress["logs"],
            "findings_count": findings_count,
        }

    # Fall back to DB
    result = db.table("scans").select("*").eq("id", scan_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan = result.data
    return {
        "scan_id": scan_id,
        "status": scan["status"],
        "progress": 100 if scan["status"] == "completed" else 0,
        "log_messages": [],
        "findings_count": scan.get("findings_count", 0),
    }


async def run_scan_pipeline(scan_id: str, repo: dict, access_token: str, db):
    """
    The actual scan pipeline — runs in background.
    Updates _scan_progress throughout for frontend polling.
    """

    def log(msg: str, progress: int | None = None):
        _scan_progress[scan_id]["logs"].append(msg)
        if progress is not None:
            _scan_progress[scan_id]["progress"] = progress
        logger.info(f"[Scan {scan_id[:8]}] {msg}")

    try:
        _scan_progress[scan_id]["status"] = "running"
        db.table("scans").update({"status": "running"}).eq("id", scan_id).execute()

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

        # ── Step 2: Claude enrichment ───────────────────────────────────────
        if findings:
            log(f"[CLAUDE] Sending {len(findings)} findings to Claude for plain English explanation...", 45)
            enriched_findings = await claude_service.explain_findings_batch(findings)
            log("[CLAUDE] AI explanations complete.", 70)
        else:
            enriched_findings = []
            log("[CLAUDE] No findings to explain.", 70)

        # ── Step 3: Save issues to DB ───────────────────────────────────────
        log("[DB] Saving issues to database...", 75)
        now = datetime.now(timezone.utc).isoformat()

        if enriched_findings:
            issue_rows = [
                {
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
                for f in enriched_findings
            ]
            db.table("issues").insert(issue_rows).execute()

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
        _scan_progress[scan_id]["status"] = "completed"
        _scan_progress[scan_id]["progress"] = 100

    except Exception as e:
        logger.exception(f"Scan pipeline failed for scan_id={scan_id}")
        error_msg = f"[ERROR] Scan failed: {str(e)}"
        _scan_progress[scan_id]["status"] = "failed"
        _scan_progress[scan_id]["logs"].append(error_msg)
        db.table("scans").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", scan_id).execute()
