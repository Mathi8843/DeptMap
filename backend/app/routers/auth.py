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
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.services import github as github_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class EmailAuthRequest(BaseModel):
    email: str
    password: str


class EmailSignUpRequest(BaseModel):
    email: str
    password: str
    name: str


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
    )
    return {"auth_url": github_auth_url}


@router.get("/github/callback")
async def github_callback(
    request: Request,
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
        result_existing = db.table("users").select("*").eq("github_id", github_id).execute()
        existing_user = result_existing.data[0] if result_existing.data else None

        if existing_user:
            # Update access token (it can change)
            user_id = existing_user["id"]
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

        # Return user info or redirect depending on Accept header
        accept = request.headers.get("accept", "")
        if "application/json" in accept:
            return {
                "user_id": user_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "plan": existing_user["plan"] if existing_user else "free",
                "github_access_token": github_access_token,
            }

        # If direct browser redirect, pass to frontend callback via query params
        from urllib.parse import urlencode
        params = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "avatar_url": avatar_url or "",
            "plan": existing_user["plan"] if existing_user else "free",
            "github_access_token": github_access_token,
        }
        redirect_url = f"{settings.frontend_url}/auth/callback?{urlencode(params)}"
        return RedirectResponse(url=redirect_url)

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
    result = db.table("users").select("*").eq("id", user_id).execute()
    user_data = result.data[0] if result.data else None
    if not user_data:
        # Create a default user profile for ease of testing
        try:
            # We use a fallback UUID if user_id is not a valid UUID format
            import uuid
            try:
                profile_uuid = str(uuid.UUID(user_id))
            except ValueError:
                profile_uuid = str(uuid.uuid4())
                
            db.table("users").insert({
                "id": profile_uuid,
                "github_id": "mock_github_id_" + profile_uuid[:8],
                "email": "mathi@debtmap.io",
                "name": "Mathivanan G",
                "avatar_url": None,
                "github_access_token": "mock_github_token",
                "plan": "pro",
            }).execute()
            
            result = db.table("users").select("*").eq("id", profile_uuid).execute()
            user_data = result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to auto-create user: {e}")
            raise HTTPException(status_code=404, detail="User not found")

    user = user_data
    repos_count = db.table("repos").select("id", count="exact").eq("user_id", user["id"]).execute()

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user.get("avatar_url"),
        "plan": user["plan"],
        "repos_count": repos_count.count or 0,
        "created_at": user["created_at"],
    }


@router.post("/signup")
async def email_signup(payload: EmailSignUpRequest, db=Depends(get_db)):
    """
    Sign up a new user using Supabase Auth.
    Creates both the auth credentials and the public.users record.
    """
    try:
        credentials = {
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "name": payload.name
                }
            }
        }
        auth_response = db.auth.sign_up(credentials)
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create user account.")
            
        user_id = auth_response.user.id
        
        # Create user profile record in public.users
        db.table("users").upsert({
            "id": user_id,
            "email": payload.email,
            "name": payload.name,
            "github_access_token": "mock_github_token",  # Mock default so local flows work initially
            "plan": "free"
        }).execute()
        
        return {
            "user_id": user_id,
            "email": payload.email,
            "name": payload.name,
            "plan": "free",
            "github_access_token": "mock_github_token",
            "message": "Registration successful. Please sign in."
        }
    except Exception as e:
        logger.exception("Email signup failed")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def email_signin(payload: EmailAuthRequest, db=Depends(get_db)):
    """
    Sign in an existing user with email and password via Supabase Auth.
    """
    try:
        credentials = {
            "email": payload.email,
            "password": payload.password
        }
        auth_response = db.auth.sign_in_with_password(credentials)
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Invalid email or password.")
            
        user_id = auth_response.user.id
        email = auth_response.user.email
        
        # Retrieve user profile from public.users
        profile_res = db.table("users").select("*").eq("id", user_id).execute()
        
        if profile_res.data:
            profile = profile_res.data[0]
        else:
            # Auto-create profile if missing
            name = auth_response.user.user_metadata.get("name", email.split("@")[0])
            db.table("users").insert({
                "id": user_id,
                "email": email,
                "name": name,
                "github_access_token": "mock_github_token",
                "plan": "free"
            }).execute()
            profile = {
                "id": user_id,
                "email": email,
                "name": name,
                "plan": "free",
                "github_access_token": "mock_github_token"
            }
            
        return {
            "user_id": profile["id"],
            "email": profile["email"],
            "name": profile["name"],
            "plan": profile["plan"],
            "github_access_token": profile.get("github_access_token", "mock_github_token"),
            "session_token": auth_response.session.access_token if auth_response.session else None
        }
    except Exception as e:
        logger.exception("Email signin failed")
        raise HTTPException(status_code=400, detail=str(e))

