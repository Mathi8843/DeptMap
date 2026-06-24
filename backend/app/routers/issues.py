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


def verify_patch_content(
    file_path: str,
    content: str,
    rule_id: str,
    original_snippet: str,
    line_start: int = 0,
    line_end: int = 0,
    ai_fix_code: str = ""
) -> tuple[bool, str]:
    """
    Validates that the proposed patch actually resolves the vulnerability.
    Supports Gitleaks, Package Audits, and Semgrep static analysis rules.
    """
    import re
    rule_lower = rule_id.lower()
    
    # 1. Gitleaks / Secret findings
    if "gitleaks" in rule_lower or "api-key" in rule_lower or "hardcoded-secret" in rule_lower:
        from app.services.gitleaks import RULES
        # Compile Gitleaks regexes and verify no secrets are left in the patched lines
        for rule_name, pattern in RULES.items():
            if rule_name in rule_lower:
                regex = re.compile(pattern)
                if regex.search(content):
                    return False, f"Verification failed: Hardcoded secret ({rule_name}) is still present in the patched code."
        return True, ""
        
    # 2. Dependency Vulnerabilities
    if "vulnerable-dependency" in rule_lower:
        # Check that the original vulnerable version snippet is no longer present in the manifest file
        if original_snippet and original_snippet.strip() in content:
            return False, "Verification failed: The vulnerable package declaration is still present in the manifest file."
        return True, ""
        
    # 3. Semgrep static analysis rules
    from app.services.semgrep import verify_semgrep_patch
    return verify_semgrep_patch(
        file_path=file_path,
        content=content,
        rule_id=rule_id,
        line_start=line_start,
        line_end=line_end,
        ai_fix_code=ai_fix_code
    )


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


@router.get("/attack-surfaces")
async def list_attack_surfaces(
    current_user_id: str = Depends(get_current_user_id),
    repo_id: str | None = Query(None),
    db=Depends(get_db),
):
    """List attack surfaces (correlated vulnerability groups) for the user's repos."""
    query = (
        db.table("attack_surfaces")
        .select("*, repos!inner(user_id)")
        .eq("repos.user_id", current_user_id)
    )
    if repo_id:
        query = query.eq("repo_id", repo_id)
        
    result = query.order("created_at", desc=True).execute()
    return result.data or []


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
async def create_fix_pr(
    issue_id: str,
    bypass: bool = Query(False),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db)
):
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
        original_content = await github_service.get_file_content_async(
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

        if not bypass:
            # Post-fix Verification Pipeline
            verification_ok, error_details = verify_patch_content(
                file_path=issue["file_path"],
                content=fixed_content,
                rule_id=issue["semgrep_rule_id"],
                original_snippet=issue.get("code_snippet", ""),
                line_start=issue.get("line_start", 0),
                line_end=issue.get("line_end", 0),
                ai_fix_code=issue.get("ai_fix_code", "")
            )
            
            if not verification_ok:
                # Try to regenerate the fix using Groq on-demand
                from app.services.groq import explain_finding, get_client
                regenerated = False
                if get_client():
                    logger.info(f"Fix failed validation. Attempting to regenerate fix using Groq for issue {issue_id}...")
                    finding = {
                        "semgrep_rule_id": issue["semgrep_rule_id"],
                        "severity": issue["severity"],
                        "file_path": issue["file_path"],
                        "line_start": issue["line_start"],
                        "line_end": issue["line_end"],
                        "code_snippet": issue.get("code_snippet", ""),
                        "_raw_message": issue.get("plain_english_body", ""),
                        "_full_file_content": original_content,
                    }
                    try:
                        # Clear title to bypass cache and force Groq call
                        finding_for_groq = finding.copy()
                        finding_for_groq["plain_english_title"] = ""
                        
                        groq_explanation = await explain_finding(finding_for_groq)
                        new_ai_fix_code = groq_explanation.get("ai_fix_code")
                        
                        if new_ai_fix_code and new_ai_fix_code != issue.get("ai_fix_code"):
                            logger.info(f"Regenerated new fix code from Groq: {new_ai_fix_code}")
                            new_fixed_content = apply_patch(
                                original_content=original_content,
                                code_snippet=issue.get("code_snippet", ""),
                                ai_fix_code=new_ai_fix_code,
                                line_start=issue.get("line_start", 0),
                                line_end=issue.get("line_end", 0),
                            )
                            new_ok, new_err = verify_patch_content(
                                file_path=issue["file_path"],
                                content=new_fixed_content,
                                rule_id=issue["semgrep_rule_id"],
                                original_snippet=issue.get("code_snippet", ""),
                                line_start=issue.get("line_start", 0),
                                line_end=issue.get("line_end", 0),
                                ai_fix_code=new_ai_fix_code
                            )
                            if new_ok:
                                logger.info(f"Regenerated fix passed verification!")
                                fixed_content = new_fixed_content
                                verification_ok = True
                                regenerated = True
                                # Update database issue with the working fix
                                db.table("issues").update({
                                    "ai_fix_code": new_ai_fix_code,
                                    "plain_english_title": groq_explanation.get("plain_english_title", issue["plain_english_title"]),
                                    "plain_english_body": groq_explanation.get("plain_english_body", issue["plain_english_body"]),
                                    "impact_bullets": groq_explanation.get("impact_bullets", issue["impact_bullets"]),
                                }).eq("id", issue_id).execute()
                                issue["plain_english_title"] = groq_explanation.get("plain_english_title", issue["plain_english_title"])
                                issue["plain_english_body"] = groq_explanation.get("plain_english_body", issue["plain_english_body"])
                                issue["impact_bullets"] = groq_explanation.get("impact_bullets", issue["impact_bullets"])
                    except Exception as ex:
                        logger.warning(f"Failed to regenerate fix using Groq: {ex}")
                
                if not verification_ok:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Fix verification failed: {error_details}"
                    )

        # Create the PR
        pr_result = await github_service.create_fix_pull_request_async(
            access_token=access_token,
            full_name=repo["full_name"],
            file_path=issue["file_path"],
            original_content=original_content,
            fixed_content=fixed_content,
            issue_title=issue["plain_english_title"],
            issue_id=issue_id,
            base_branch=repo.get("default_branch", "main"),
            plain_english_body=issue.get("plain_english_body", ""),
            impact_bullets=issue.get("impact_bullets", []),
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
