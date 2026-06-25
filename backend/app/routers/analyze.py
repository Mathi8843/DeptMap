"""
Analyze router.
Exposes endpoint to trigger independent AI vulnerability reviews on repos.
"""
import os
import shutil
import tempfile
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request

from app.database import get_db, get_supabase
from app.rate_limit import limiter
from app.config import get_settings
from app.services import get_current_user_id, decrypt_token
from app.services.ai_review import run_ai_review

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/analyze", tags=["analyze"])

async def run_standalone_ai_review(repo_id: str, access_token: str, db):
    # Fetch repo
    repo_res = db.table("repos").select("*").eq("id", repo_id).execute()
    if not repo_res.data:
        logger.error(f"Standalone AI review: Repo {repo_id} not found")
        return
    repo = repo_res.data[0]
    
    # Create temp directory
    temp_parent = settings.scan_temp_dir or "/tmp/debtmap_scans"
    os.makedirs(temp_parent, exist_ok=True)
    repo_dir = tempfile.mkdtemp(dir=temp_parent, prefix="ai_review_")
    
    clone_url = f"https://github.com/{repo['full_name']}.git"
    
    try:
        # Clone repo
        from app.services.semgrep import clone_repo
        logger.info(f"Cloning {clone_url} to {repo_dir} for standalone AI review")
        clone_repo(clone_url, access_token, repo_dir)
        
        # Run AI review
        findings = await run_ai_review(repo_dir=repo_dir, limit=20)
        
        # Save results to DB
        now = datetime.now(timezone.utc).isoformat()
        
        # Fetch existing open AI review issues
        existing_result = (
            db.table("issues")
            .select("*")
            .eq("repo_id", repo_id)
            .eq("source", "ai_review")
            .in_("status", ["open", "dismissed"])
            .execute()
        )
        existing_issues = existing_result.data or []
        
        existing_by_key = {}
        for issue in existing_issues:
            key = (issue["file_path"], issue["line_start"])
            existing_by_key.setdefault(key, []).append(issue)
            
        new_issue_rows = []
        has_confidence_col = False
        try:
            db.table("issues").select("id, confidence").limit(1).execute()
            has_confidence_col = True
        except Exception:
            pass
            
        # Get latest scan or create placeholder scan record
        scan_id = None
        latest_scan_res = db.table("scans").select("id").eq("repo_id", repo_id).order("triggered_at", desc=True).limit(1).execute()
        if latest_scan_res.data:
            scan_id = latest_scan_res.data[0]["id"]
        else:
            scan_id = str(uuid.uuid4())
            db.table("scans").insert({
                "id": scan_id,
                "repo_id": repo_id,
                "status": "completed",
                "triggered_at": now,
                "completed_at": now,
                "findings_count": len(findings),
                "progress": 100,
                "log_messages": ["[AI REVIEW] Standalone AI review completed."],
            }).execute()

        for f in findings:
            key = (f["file_path"], f["line_start"])
            if key in existing_by_key and existing_by_key[key]:
                matched_issue = existing_by_key[key].pop(0)
                update_payload = {
                    "scan_id": scan_id,
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
                db.table("issues").update(update_payload).eq("id", matched_issue["id"]).execute()
            else:
                insert_row = {
                    "id": str(uuid.uuid4()),
                    "repo_id": repo_id,
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
                    "source": "ai_review"
                }
                if has_confidence_col:
                    insert_row["confidence"] = f.get("confidence")
                    insert_row["what_changed"] = f.get("what_changed")
                new_issue_rows.append(insert_row)
                
        if new_issue_rows:
            db.table("issues").insert(new_issue_rows).execute()
            
        # Any remaining issues in existing_by_key were not found again -> mark as fixed
        resolved_ids = []
        for key, issues_list in existing_by_key.items():
            for issue in issues_list:
                resolved_ids.append(issue["id"])
                
        if resolved_ids:
            db.table("issues").update({"status": "fixed"}).in_("id", resolved_ids).execute()
            
        # Recalculate health score
        from app.routers.issues import update_repo_health_score
        update_repo_health_score(db, repo_id)
        logger.info(f"Standalone AI review complete for repo {repo_id}. Found {len(findings)} issues.")
        
    except Exception as e:
        logger.error(f"Standalone AI review background task failed: {e}", exc_info=True)
    finally:
        shutil.rmtree(repo_dir, ignore_errors=True)

@router.post("/ai-review")
@limiter.limit("5/minute")
async def trigger_ai_review(
    request: Request,
    background_tasks: BackgroundTasks,
    repo_id: str = Query(...),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Trigger an independent AI vulnerability review scan for a repository.
    Runs asynchronously and returns immediately.
    """
    # Fetch repo from DB
    repo_result = db.table("repos").select("*").eq("id", repo_id).eq("user_id", current_user_id).execute()
    if not repo_result.data:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Fetch user details
    user_result = db.table("users").select("github_access_token, plan").eq("id", current_user_id).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_result.data[0]
    plan = user_data.get("plan", "free")

    if plan == "free":
        repos_count_res = db.table("repos").select("id", count="exact").eq("user_id", current_user_id).execute()
        repos_count = repos_count_res.count or 0
        if repos_count > 1:
            raise HTTPException(
                status_code=403,
                detail="Free plan is limited to 1 repository scan. Please upgrade your plan."
            )

    encrypted_token = user_data.get("github_access_token")
    if not encrypted_token:
        raise HTTPException(status_code=400, detail="GitHub access token missing — re-authenticate")

    access_token = decrypt_token(encrypted_token)

    # Queue standalone AI Review task
    background_tasks.add_task(run_standalone_ai_review, repo_id, access_token, db)

    return {"status": "running", "message": "Independent AI review started in the background."}
