"""
DebtMap Background Scanning Worker
Runs as a standalone daemon process polling Supabase for queued scans.
"""
import asyncio
import logging
import os
import sys

# Ensure current directory is in PYTHONPATH so app imports resolve
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_supabase
from app.routers.scans import run_scan_pipeline
from app.services import decrypt_token

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("worker")

async def poll_and_run_scans():
    db = get_supabase()
    logger.info("🚀 Standalone background scanning worker started. Polling for queued scans...")
    
    while True:
        try:
            res = db.table("scans").select("*").eq("status", "queued").execute()
            queued_scans = res.data or []
            
            for scan in queued_scans:
                scan_id = scan["id"]
                repo_id = scan["repo_id"]
                logger.info(f"Picked up queued scan {scan_id} for repository {repo_id}")
                
                # Fetch repo details
                repo_res = db.table("repos").select("*").eq("id", repo_id).execute()
                if not repo_res.data:
                    logger.error(f"Repository {repo_id} not found in DB")
                    db.table("scans").update({
                        "status": "failed",
                        "log_messages": ["[SYSTEM ERROR] Repository not found in database"]
                    }).eq("id", scan_id).execute()
                    continue
                    
                repo = repo_res.data[0]
                
                # Fetch GitHub access token
                user_res = db.table("users").select("github_access_token").eq("id", repo["user_id"]).execute()
                if not user_res.data or not user_res.data[0].get("github_access_token"):
                    logger.error(f"GitHub access token missing for user {repo['user_id']}")
                    db.table("scans").update({
                        "status": "failed",
                        "log_messages": ["[SYSTEM ERROR] GitHub access token missing"]
                    }).eq("id", scan_id).execute()
                    continue
                    
                encrypted_token = user_res.data[0]["github_access_token"]
                access_token = decrypt_token(encrypted_token)
                
                try:
                    await run_scan_pipeline(
                        scan_id=scan_id,
                        repo=repo,
                        access_token=access_token,
                        db=db
                    )
                except Exception as e:
                    logger.exception(f"Exception raised during run_scan_pipeline for {scan_id}")
                    db.table("scans").update({
                        "status": "failed",
                        "log_messages": [f"[SYSTEM ERROR] Scan run execution failed: {str(e)}"]
                    }).eq("id", scan_id).execute()
                    
        except Exception as e:
            logger.exception("Error in worker polling loop")
            
        await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(poll_and_run_scans())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user request.")
