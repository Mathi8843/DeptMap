"""
Authentication router.
Handles GitHub OAuth login flow and user session creation via Supabase.

Flow:
1. Frontend redirects user to GitHub OAuth URL (handled client-side)
2. GitHub redirects back to our callback URL with ?code=xxx
3. We exchange code → GitHub access token
4. We fetch GitHub user info
5. We create/update user in Supabase
6. We return our own session token (Supabase JWT)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.database import get_db
from app.services import github as github_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.get("/github")
async def github_login():
    """
    Redirect user to GitHub OAuth authorization page.
    Frontend can use this URL directly or build the URL itself.
    """
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&scope=repo,user:email"
        f"&redirect_uri={settings.frontend_url}/auth/callback"
    )
    return {"auth_url": github_auth_url}


@router.get("/github/callback")
async def github_callback(
    code: str = Query(..., description="OAuth code from GitHub"),
    db=Depends(get_db),
):
    """
    GitHub OAuth callback endpoint.
    Called after user authorizes on GitHub.
    
    1. Exchange code → GitHub access_token
    2. Get GitHub user profile
    3. Create or update user in Supabase via signInWithIdToken
    4. Store GitHub access_token in user metadata
    5. Return Supabase session
    """
    try:
        # Step 1: Exchange code for GitHub access token
        token_data = await github_service.exchange_code_for_token(code)
        github_access_token = token_data.get("access_token")
        if not github_access_token:
            raise HTTPException(status_code=400, detail="GitHub did not return an access token")

        # Step 2: Get GitHub user info
        gh_user = await github_service.get_github_user(github_access_token)
        github_id = str(gh_user.get("id"))
        email = gh_user.get("email") or f"{gh_user.get('login')}@github.noemail"
        name = gh_user.get("name") or gh_user.get("login")
        avatar_url = gh_user.get("avatar_url")

        # Step 3: Upsert user in Supabase
        # Check if user already exists
        existing = db.table("users").select("*").eq("github_id", github_id).maybe_single().execute()

        if existing.data:
            # Update access token (it can change)
            user_id = existing.data["id"]
            db.table("users").update({
                "github_access_token": github_access_token,
                "name": name,
                "avatar_url": avatar_url,
            }).eq("id", user_id).execute()
        else:
            # Create new user
            result = db.table("users").insert({
                "github_id": github_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "github_access_token": github_access_token,
                "plan": "free",
            }).execute()
            user_id = result.data[0]["id"]

        # Return user info (in production: return a signed JWT)
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "avatar_url": avatar_url,
            "plan": existing.data["plan"] if existing.data else "free",
            "github_access_token": github_access_token,  # Frontend stores in httpOnly cookie
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("GitHub OAuth callback failed")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.get("/me")
async def get_current_user(
    user_id: str = Query(...),  # In production: extract from JWT token
    db=Depends(get_db),
):
    """Get current user profile including plan and connected repos count."""
    result = db.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = result.data
    repos_count = db.table("repos").select("id", count="exact").eq("user_id", user_id).execute()

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user.get("avatar_url"),
        "plan": user["plan"],
        "repos_count": repos_count.count or 0,
        "created_at": user["created_at"],
    }
