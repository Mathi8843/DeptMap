"""
DebtMap Background Scanning Worker
Runs as a standalone daemon process polling Supabase for queued scans.
Executes each scan in a thread pool so the worker stays responsive
and can process multiple scans concurrently.
"""
import asyncio
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

# Ensure current directory is in PYTHONPATH so app imports resolve
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_supabase
from app.routers.scans import run_scan_sync
from app.services import decrypt_token

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("worker")

# ── Config ──────────────────────────────────────────────────────────────────
POLL_INTERVAL_SECONDS = 3
MAX_CONCURRENT_SCANS = 3
STALE_TIMEOUT_MINUTES = 10
MAX_RETRIES = 2


async def poll_and_run_scans() -> None:
    """
    Main worker loop: poll DB for queued scans, dispatch them to a thread pool.
    Only MAX_CONCURRENT_SCANS run simultaneously; others wait in the DB queue.
    """
    db = get_supabase()
    logger.info(
        f"Standalone background scanning worker started. "
        f"Polling every {POLL_INTERVAL_SECONDS}s, "
        f"concurrency={MAX_CONCURRENT_SCANS}, "
        f"stale timeout={STALE_TIMEOUT_MINUTES}min."
    )

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_SCANS)

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_SCANS + 1) as executor:
        while True:
            try:
                await _mark_stale_scans(db)

                res = db.table("scans").select("*").eq("status", "queued").execute()
                queued_scans = res.data or []

                for scan in queued_scans:
                    # Acquire semaphore — blocks if we're already at capacity
                    await semaphore.acquire()
                    asyncio.create_task(
                        _dispatch_scan(scan, db, executor, semaphore)
                    )

            except Exception as e:
                logger.exception("Error in worker polling loop")

            await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def _mark_stale_scans(db) -> None:
    """Mark scans stuck in 'running' for >10 minutes as failed."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=STALE_TIMEOUT_MINUTES)).isoformat()
    stale_res = db.table("scans").select("*").eq("status", "running").lt("triggered_at", cutoff).execute()
    for scan in (stale_res.data or []):
        sid = scan["id"]
        logger.warning(f"Stale scan {sid} running for over {STALE_TIMEOUT_MINUTES} minutes — marking as failed")
        db.table("scans").update({
            "status": "failed",
            "log_messages": (scan.get("log_messages") or []) + [
                f"[SYSTEM TIMEOUT] Scan exceeded {STALE_TIMEOUT_MINUTES}-minute limit and was terminated."
            ],
        }).eq("id", sid).execute()


async def _dispatch_scan(
    scan: dict,
    db,
    executor: ThreadPoolExecutor,
    semaphore: asyncio.Semaphore,
) -> None:
    """
    Fetch repo + token for a queued scan and dispatch it to the thread pool.
    Releases the semaphore when done (success or failure).
    """
    scan_id = scan["id"]
    repo_id = scan["repo_id"]
    attempt = scan.get("retry_count", 0)

    try:
        # Fetch repo details
        repo_res = db.table("repos").select("*").eq("id", repo_id).execute()
        if not repo_res.data:
            logger.error(f"Repository {repo_id} not found in DB — failing scan {scan_id}")
            db.table("scans").update({
                "status": "failed",
                "log_messages": ["[SYSTEM ERROR] Repository not found in database"],
            }).eq("id", scan_id).execute()
            return

        repo = repo_res.data[0]

        # Fetch GitHub access token
        user_res = db.table("users").select("github_access_token").eq("id", repo["user_id"]).execute()
        if not user_res.data or not user_res.data[0].get("github_access_token"):
            logger.error(f"GitHub access token missing for user {repo['user_id']} — failing scan {scan_id}")
            db.table("scans").update({
                "status": "failed",
                "log_messages": ["[SYSTEM ERROR] GitHub access token missing"],
            }).eq("id", scan_id).execute()
            return

        encrypted_token = user_res.data[0]["github_access_token"]
        access_token = decrypt_token(encrypted_token)

        # Mark as running before dispatching
        db.table("scans").update({"status": "running"}).eq("id", scan_id).execute()

        # Dispatch the scan to the thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(executor, run_scan_sync, scan_id, repo, access_token)

    except Exception as e:
        logger.exception(f"Exception raised during scan {scan_id}")
        if attempt < MAX_RETRIES:
            logger.info(f"Retrying scan {scan_id} (attempt {attempt + 1}/{MAX_RETRIES})")
            db.table("scans").update({
                "retry_count": attempt + 1,
            }).eq("id", scan_id).execute()
            # Re-queue by leaving status as "queued" — next poll cycle will pick it up
            # Unless it's already been set to "running" — in that case, the stale guard handles it
        else:
            db.table("scans").update({
                "status": "failed",
                "log_messages": [f"[SYSTEM ERROR] Scan run execution failed after {MAX_RETRIES + 1} attempts: {str(e)}"],
            }).eq("id", scan_id).execute()
    finally:
        semaphore.release()


if __name__ == "__main__":
    try:
        asyncio.run(poll_and_run_scans())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user request.")
