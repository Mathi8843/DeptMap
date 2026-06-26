"""
Risk Guard AI Background Scanning Worker
Runs as a standalone daemon process polling Supabase for queued scans.

Persistence on restart:
  - Scans are stored in DB with status. Worker picks up "queued" scans.
  - Running scans emit a heartbeat (heartbeat_at). On restart, scans with
    stale heartbeats are recovered and re-queued.
  - Graceful shutdown re-queues in-flight scans so they aren't lost.
"""
import asyncio
import logging
import os
import signal
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
HEARTBEAT_INTERVAL_SECONDS = 5
HEARTBEAT_STALE_SECONDS = 30
MAX_RETRIES = 2

# Global shutdown flag — set by signal handler
_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    sig_name = signal.Signals(signum).name
    logger.warning(f"Received {sig_name} — initiating graceful shutdown...")
    _shutdown = True


async def recover_stale_scans(db) -> None:
    """
    On startup, find scans that were left in 'running' state by a crashed
    worker and re-queue them so they get picked up again.
    """
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=HEARTBEAT_STALE_SECONDS)).isoformat()
    res = db.table("scans").select("*").eq("status", "running").lt("heartbeat_at", stale_cutoff).execute()
    stale = res.data or []

    # Also catch scans that have no heartbeat_at at all (upgraded workers)
    null_res = db.table("scans").select("*").eq("status", "running").is_("heartbeat_at", "null").execute()
    stale.extend(null_res.data or [])

    for scan in stale:
        sid = scan["id"]
        retries = scan.get("retry_count", 0)
        logger.warning(f"Recovering stale scan {sid} from previous worker crash (retry_count={retries})")
        db.table("scans").update({
            "status": "queued",
            "retry_count": retries + 1,
            "log_messages": (scan.get("log_messages") or []) + [
                "[SYSTEM] Scan recovered after worker restart."
            ],
        }).eq("id", sid).execute()

    if stale:
        logger.info(f"Recovered {len(stale)} stale scan(s) from previous worker crash")


async def poll_and_run_scans() -> None:
    """
    Main worker loop: poll DB for queued scans, dispatch them to a thread pool.
    Only MAX_CONCURRENT_SCANS run simultaneously.
    """
    db = get_supabase()

    # ── Startup recovery ────────────────────────────────────────────────────
    await recover_stale_scans(db)

    logger.info(
        f"Background scanning worker started. "
        f"Polling every {POLL_INTERVAL_SECONDS}s, "
        f"concurrency={MAX_CONCURRENT_SCANS}, "
        f"stale timeout={STALE_TIMEOUT_MINUTES}min, "
        f"heartbeat interval={HEARTBEAT_INTERVAL_SECONDS}s."
    )

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_SCANS)

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_SCANS + 1) as executor:
        while not _shutdown:
            try:
                await _mark_stale_scans(db)

                res = db.table("scans").select("*").eq("status", "queued").execute()
                queued_scans = res.data or []

                for scan in queued_scans:
                    if _shutdown:
                        break
                    await semaphore.acquire()
                    asyncio.create_task(
                        _dispatch_scan(scan, db, executor, semaphore)
                    )

            except Exception as e:
                logger.exception("Error in worker polling loop")

            # Shorter sleep so we exit promptly when _shutdown is set
            for _ in range(POLL_INTERVAL_SECONDS):
                if _shutdown:
                    break
                await asyncio.sleep(1)

    # ── Graceful shutdown ──────────────────────────────────────────────────
    logger.info("Shutdown signal received. Waiting for in-flight scans to finish...")
    # Wait for all dispatched tasks to complete (up to 60 seconds)
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    if tasks:
        done, pending = await asyncio.wait(tasks, timeout=60)
        if pending:
            logger.warning(f"{len(pending)} scan(s) did not finish in time — re-queuing...")
            for task in pending:
                task.cancel()
            # Re-queue any scans still in "running" state
            await _recover_running_scans(db)
    logger.info("Worker shutdown complete.")


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


async def _recover_running_scans(db) -> None:
    """Re-queue any scans currently in 'running' state (used during shutdown)."""
    res = db.table("scans").select("*").eq("status", "running").execute()
    for scan in (res.data or []):
        sid = scan["id"]
        logger.warning(f"Re-queuing in-flight scan {sid} after shutdown")
        db.table("scans").update({
            "status": "queued",
            "log_messages": (scan.get("log_messages") or []) + [
                "[SYSTEM] Scan re-queued during worker shutdown."
            ],
        }).eq("id", sid).execute()


async def _heartbeat_task(scan_id: str, db, stop_event: asyncio.Event) -> None:
    """
    Background task: update heartbeat_at every HEARTBEAT_INTERVAL_SECONDS
    while the scan is running. Stops when the scan finishes.
    """
    while not stop_event.is_set():
        db.table("scans").update({
            "heartbeat_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", scan_id).execute()
        try:
            await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, stop_event.wait),
                timeout=HEARTBEAT_INTERVAL_SECONDS,
            )
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass  # Timeout means we just loop and heartbeat again


async def _dispatch_scan(
    scan: dict,
    db,
    executor: ThreadPoolExecutor,
    semaphore: asyncio.Semaphore,
) -> None:
    """
    Fetch repo + token for a queued scan and dispatch it to the thread pool.
    Launches a heartbeat task that runs alongside the scan.
    Releases the semaphore when done.
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
                "error_message": "Repository not found in database",
            }).eq("id", scan_id).execute()
            return

        repo = repo_res.data[0]

        # Fetch GitHub access token
        user_res = db.table("users").select("github_access_token").eq("id", repo["user_id"]).execute()
        if not user_res.data or not user_res.data[0].get("github_access_token"):
            logger.error(f"GitHub access token missing for user {repo['user_id']} — failing scan {scan_id}")
            db.table("scans").update({
                "status": "failed",
                "error_message": "GitHub access token missing",
            }).eq("id", scan_id).execute()
            return

        encrypted_token = user_res.data[0]["github_access_token"]
        access_token = decrypt_token(encrypted_token)

        # Mark as running and start heartbeat
        now_iso = datetime.now(timezone.utc).isoformat()
        db.table("scans").update({
            "status": "running",
            "heartbeat_at": now_iso,
        }).eq("id", scan_id).execute()

        stop_heartbeat = asyncio.Event()
        hb_task = asyncio.create_task(_heartbeat_task(scan_id, db, stop_heartbeat))

        try:
            # Dispatch the scan to the thread pool
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(executor, run_scan_sync, scan_id, repo, access_token)
        finally:
            stop_heartbeat.set()
            hb_task.cancel()
            try:
                await hb_task
            except asyncio.CancelledError:
                pass

    except Exception as e:
        logger.exception(f"Exception raised during scan {scan_id}")
        if attempt < MAX_RETRIES:
            logger.info(f"Retrying scan {scan_id} (attempt {attempt + 1}/{MAX_RETRIES})")
            db.table("scans").update({
                "status": "queued",
                "retry_count": attempt + 1,
                "error_message": f"Attempt {attempt + 1} failed: {str(e)}",
            }).eq("id", scan_id).execute()
        else:
            db.table("scans").update({
                "status": "failed",
                "error_message": f"Failed after {MAX_RETRIES + 1} attempts: {str(e)}",
                "log_messages": [f"[SYSTEM ERROR] Scan failed after {MAX_RETRIES + 1} attempts: {str(e)}"],
            }).eq("id", scan_id).execute()
    finally:
        semaphore.release()


if __name__ == "__main__":
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    try:
        asyncio.run(poll_and_run_scans())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user request.")
