"""
Issues router.
CRUD for security issues — list, get, dismiss, and trigger fix (PR creation).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import get_db
from app.services import github as github_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/issues", tags=["issues"])


@router.get("")
async def list_issues(
    user_id: str = Query(...),
    repo_id: str | None = Query(None),
    severity: str | None = Query(None, description="Comma-separated: critical,high,medium,low"),
    status: str = Query("open"),
    db=Depends(get_db),
):
    """
    List issues for a user's repos.
    Optional filters: repo_id, severity, status.
    """
    query = (
        db.table("issues")
        .select("*, repos!inner(user_id, full_name)")
        .eq("repos.user_id", user_id)
        .eq("status", status)
    )

    if repo_id:
        query = query.eq("repo_id", repo_id)

    result = query.order("created_at", desc=True).execute()
    issues = result.data or []

    if severity:
        allowed = {s.strip() for s in severity.split(",")}
        issues = [i for i in issues if i.get("severity") in allowed]

    return issues


@router.get("/{issue_id}")
async def get_issue(issue_id: str, user_id: str = Query(...), db=Depends(get_db)):
    """Get a single issue by ID."""
    result = (
        db.table("issues")
        .select("*, repos!inner(user_id, full_name, default_branch)")
        .eq("id", issue_id)
        .eq("repos.user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    return result.data


@router.post("/{issue_id}/dismiss")
async def dismiss_issue(issue_id: str, user_id: str = Query(...), db=Depends(get_db)):
    """Mark an issue as dismissed (won't affect score)."""
    issue = db.table("issues").select("id, repo_id, repos!inner(user_id)").eq("id", issue_id).maybe_single().execute()
    if not issue.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    db.table("issues").update({"status": "dismissed"}).eq("id", issue_id).execute()
    return {"success": True, "status": "dismissed"}


@router.post("/{issue_id}/fix")
async def create_fix_pr(issue_id: str, user_id: str = Query(...), db=Depends(get_db)):
    """
    Create a GitHub Pull Request with the AI-generated fix applied.
    This is the "one-click fix" feature.
    """
    # Fetch issue + repo data
    issue_result = (
        db.table("issues")
        .select("*, repos!inner(user_id, full_name, default_branch, github_access_token_override)")
        .eq("id", issue_id)
        .maybe_single()
        .execute()
    )

    if not issue_result.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue = issue_result.data
    repo = issue.get("repos", {})

    if repo.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if issue["status"] == "fixed":
        raise HTTPException(status_code=400, detail="Issue already fixed")

    if not issue.get("ai_fix_code"):
        raise HTTPException(status_code=400, detail="No AI fix available for this issue")

    # Get GitHub access token
    user = db.table("users").select("github_access_token").eq("id", user_id).maybe_single().execute()
    if not user.data or not user.data.get("github_access_token"):
        raise HTTPException(status_code=400, detail="GitHub token missing")

    access_token = user.data["github_access_token"]

    try:
        # Get original file content to do a proper replacement
        original_content = github_service.get_file_content(
            access_token=access_token,
            full_name=repo["full_name"],
            file_path=issue["file_path"],
            ref=repo.get("default_branch", "main"),
        )

        # Apply the fix: replace the vulnerable snippet with the AI fix
        fixed_content = original_content.replace(
            issue["code_snippet"].strip(),
            issue["ai_fix_code"].strip(),
        )

        # Create the PR
        pr_result = github_service.create_fix_pull_request(
            access_token=access_token,
            full_name=repo["full_name"],
            file_path=issue["file_path"],
            original_content=original_content,
            fixed_content=fixed_content,
            issue_title=issue["plain_english_title"],
            issue_id=issue_id,
            base_branch=repo.get("default_branch", "main"),
        )

        # Update issue status
        db.table("issues").update({
            "status": "fixed",
            "fix_pr_url": pr_result["pr_url"],
        }).eq("id", issue_id).execute()

        return {
            "success": True,
            "pr_url": pr_result["pr_url"],
            "pr_number": pr_result["pr_number"],
            "message": f"Pull request #{pr_result['pr_number']} created successfully",
        }

    except Exception as e:
        logger.exception(f"Failed to create fix PR for issue {issue_id}")
        raise HTTPException(status_code=500, detail=f"PR creation failed: {str(e)}")
