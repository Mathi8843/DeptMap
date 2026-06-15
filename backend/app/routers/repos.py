"""
Repos router.
Handles connecting repositories and listing them.
"""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import get_db
from app.services import github as github_service
from app.services import decrypt_token, get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/repos", tags=["repos"])


@router.get("")
async def list_repos(current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """List all connected repositories for a user."""
    result = db.table("repos").select("*").eq("user_id", current_user_id).order("created_at", desc=True).execute()
    return result.data or []


@router.post("")
async def connect_repo(
    github_repo_full_name: str = Query(...),
    generator: str = Query("Unknown"),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Connect a GitHub repository to DebtMap.
    Fetches repo metadata from GitHub API and stores in our DB.
    """
    # Fetch user's GitHub token
    user_res = db.table("users").select("github_access_token").eq("id", current_user_id).execute()
    if not user_res.data or not user_res.data[0].get("github_access_token"):
        raise HTTPException(status_code=400, detail="GitHub token missing — re-authenticate")

    encrypted_token = user_res.data[0]["github_access_token"]
    access_token = decrypt_token(encrypted_token)

    # Check if already connected
    existing = db.table("repos").select("id").eq("user_id", current_user_id).eq("full_name", github_repo_full_name).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Repository already connected")

    # Fetch metadata from GitHub
    try:
        meta = github_service.get_repo_metadata(access_token, github_repo_full_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot access repository: {str(e)}")

    repo_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    result = db.table("repos").insert({
        "id": repo_id,
        "user_id": current_user_id,
        "github_repo_id": meta["github_repo_id"],
        "full_name": meta["full_name"],
        "language": meta["language"],
        "default_branch": meta["default_branch"],
        "is_private": meta["is_private"],
        "health_score": 100,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "generator": generator,
        "created_at": now,
    }).execute()

    return result.data[0]


@router.get("/github-list")
async def list_github_repos(current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """List user's GitHub repos for the repo selection step in onboarding."""
    user_res = db.table("users").select("github_access_token").eq("id", current_user_id).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    encrypted_token = user_res.data[0].get("github_access_token")
    if not encrypted_token:
        raise HTTPException(status_code=400, detail="GitHub token missing")

    access_token = decrypt_token(encrypted_token)

    try:
        repos = github_service.list_user_repos(access_token)
        return repos
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list repos: {str(e)}")


@router.delete("/{repo_id}")
async def disconnect_repo(repo_id: str, current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """Remove a repository and all its associated data."""
    result = db.table("repos").select("id").eq("id", repo_id).eq("user_id", current_user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Cascade delete (issues, packages, history) — handled by DB foreign keys
    db.table("repos").delete().eq("id", repo_id).execute()
    return {"success": True}
