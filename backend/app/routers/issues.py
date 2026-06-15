"""
Issues router.
CRUD for security issues — list, get, dismiss, and trigger fix (PR creation).
"""
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import get_db
from app.services import github as github_service
from app.services.scorer import calculate_scores_by_severity
from app.services import decrypt_token, get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/issues", tags=["issues"])


def update_repo_health_score(db, repo_id: str, is_fix: bool = False):
    """
    Recalculate the health score for a repo and insert a health history record.
    """
    try:
        # Fetch all issues for the repo
        all_issues = db.table("issues").select("severity,status").eq("repo_id", repo_id).execute()
        scores = calculate_scores_by_severity(all_issues.data or [])

        # Update repos table
        db.table("repos").update({
            "health_score": scores["health_score"],
            "critical_count": scores["critical_count"],
            "high_count": scores["high_count"],
            "medium_count": scores["medium_count"],
            "low_count": scores["low_count"],
        }).eq("id", repo_id).execute()

        # Record health history
        now = datetime.now(timezone.utc).isoformat()
        db.table("health_history").insert({
            "id": str(uuid.uuid4()),
            "repo_id": repo_id,
            "score": scores["health_score"],
            "introduced_count": 0,
            "fixed_count": 1 if is_fix else 0,
            "recorded_at": now,
        }).execute()
        
    except Exception as e:
        logger.error(f"Failed to update repo health score for repo {repo_id}: {e}")


def apply_patch(
    original_content: str,
    code_snippet: str,
    ai_fix_code: str,
    line_start: int,
    line_end: int,
) -> str:
    """
    Robustly apply the AI fix code to the original file content.
    Uses a hybrid approach of substring matching and line-number targeting with indentation recovery.
    """
    import textwrap

    # Normalize inputs
    code_snippet_strip = code_snippet.strip()
    ai_fix_code_strip = ai_fix_code.strip()

    # Standardize newlines
    newline = "\r\n" if "\r\n" in original_content else "\n"

    # Option 1: Unique Substring Match
    count = original_content.count(code_snippet_strip)
    if count == 1:
        start_idx = original_content.find(code_snippet_strip)
        line_start_idx = original_content.rfind("\n", 0, start_idx) + 1
        line_prefix = original_content[line_start_idx:start_idx]
        
        # Check if the prefix is entirely whitespace
        if not line_prefix or line_prefix.isspace():
            end_idx = start_idx + len(code_snippet_strip)
            line_end_idx = original_content.find("\n", end_idx)
            if line_end_idx == -1:
                line_end_idx = len(original_content)
                
            indentation = line_prefix
            
            # Format the fix code with this indentation
            dedented_fix = textwrap.dedent(ai_fix_code_strip)
            indented_lines = []
            for line in dedented_fix.splitlines():
                if line.strip() == "":
                    indented_lines.append("")
                else:
                    indented_lines.append(indentation + line)
            formatted_fix = newline.join(indented_lines)
            
            return original_content[:line_start_idx] + formatted_fix + original_content[line_end_idx:]
        else:
            # Inline replacement: do not add indentation
            return original_content.replace(code_snippet_strip, ai_fix_code_strip, 1)

    # Option 2: Line-Number Target with Indentation Recovery
    original_lines = original_content.splitlines(keepends=True)

    if 1 <= line_start <= len(original_lines):
        actual_line_end = min(line_end, len(original_lines))

        first_target_line = original_lines[line_start - 1]
        indentation = ""
        for char in first_target_line:
            if char.isspace() and char not in ("\r", "\n"):
                indentation += char
            else:
                break

        dedented_fix = textwrap.dedent(ai_fix_code_strip)
        indented_lines = []
        for line in dedented_fix.splitlines():
            if line.strip() == "":
                indented_lines.append(newline)
            else:
                indented_lines.append(indentation + line + newline)

        patched_lines = (
            original_lines[: line_start - 1]
            + indented_lines
            + original_lines[actual_line_end:]
        )
        return "".join(patched_lines)

    return original_content.replace(code_snippet_strip, ai_fix_code_strip)


@router.get("")
async def list_issues(
    current_user_id: str = Depends(get_current_user_id),
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
        .eq("repos.user_id", current_user_id)
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
async def get_issue(issue_id: str, current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """Get a single issue by ID."""
    result = (
        db.table("issues")
        .select("*, repos!inner(user_id, full_name, default_branch)")
        .eq("id", issue_id)
        .eq("repos.user_id", current_user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    return result.data[0]


@router.post("/{issue_id}/dismiss")
async def dismiss_issue(issue_id: str, current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """Mark an issue as dismissed (won't affect score)."""
    # Verify ownership
    issue = db.table("issues").select("id, repo_id, repos!inner(user_id)").eq("id", issue_id).execute()
    if not issue.data or issue.data[0]["repos"]["user_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    repo_id = issue.data[0]["repo_id"]

    db.table("issues").update({"status": "dismissed"}).eq("id", issue_id).execute()
    
    # Update repository health metrics
    update_repo_health_score(db, repo_id, is_fix=True)
    
    return {"success": True, "status": "dismissed"}


@router.post("/{issue_id}/fix")
async def create_fix_pr(issue_id: str, current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """
    Create a GitHub Pull Request with the AI-generated fix applied.
    This is the "one-click fix" feature.
    """
    # Fetch issue + repo data
    issue_result = (
        db.table("issues")
        .select("*, repos!inner(user_id, full_name, default_branch)")
        .eq("id", issue_id)
        .execute()
    )

    if not issue_result.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue = issue_result.data[0]
    repo = issue.get("repos", {})

    if repo.get("user_id") != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if issue["status"] == "fixed":
        raise HTTPException(status_code=400, detail="Issue already fixed")

    if not issue.get("ai_fix_code"):
        raise HTTPException(status_code=400, detail="No AI fix available for this issue")

    # Get GitHub access token
    user_res = db.table("users").select("github_access_token").eq("id", current_user_id).execute()
    if not user_res.data or not user_res.data[0].get("github_access_token"):
        raise HTTPException(status_code=400, detail="GitHub token missing")

    encrypted_token = user_res.data[0]["github_access_token"]
    access_token = decrypt_token(encrypted_token)

    try:
        # Get original file content to do a proper replacement
        original_content = github_service.get_file_content(
            access_token=access_token,
            full_name=repo["full_name"],
            file_path=issue["file_path"],
            ref=repo.get("default_branch", "main"),
        )

        # Apply the fix robustly using line targeting & indentation recovery
        fixed_content = apply_patch(
            original_content=original_content,
            code_snippet=issue.get("code_snippet", ""),
            ai_fix_code=issue.get("ai_fix_code", ""),
            line_start=issue.get("line_start", 0),
            line_end=issue.get("line_end", 0),
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

        # Update repository health metrics and record history
        update_repo_health_score(db, issue.get("repo_id"), is_fix=True)

        return {
            "success": True,
            "pr_url": pr_result["pr_url"],
            "pr_number": pr_result["pr_number"],
            "message": f"Pull request #{pr_result['pr_number']} created successfully",
        }

    except Exception as e:
        logger.exception(f"Failed to create fix PR for issue {issue_id}")
        raise HTTPException(status_code=500, detail=f"PR creation failed: {str(e)}")
