"""
Authentication router.
Handles GitHub OAuth login flow and user session creation via Supabase.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from supabase import create_client, Client
from app.config import get_settings
from app.database import get_db
from app.rate_limit import limiter
from app.services import github as github_service
from app.services import (
    encrypt_token,
    create_session_token,
    create_oauth_state,
    verify_oauth_state,
    get_current_user_id,
)

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


class UpgradePlanRequest(BaseModel):
    plan: str


class CouponRequest(BaseModel):
    code: str


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.get("/github")
@limiter.limit("20/minute")
async def github_login(
    request: Request,
    current_user_id: str = Query(None, description="Optional user ID to link to"),
):
    """Redirect user to GitHub OAuth authorization page."""
    # Clean up empty or Javascript/undefined string values
    if not current_user_id or current_user_id.strip() in ("", "undefined", "null"):
        current_user_id = None
        
    state_param = create_oauth_state(current_user_id)
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&scope=repo,user:email"
        f"&state={state_param}"
    )
    return {"auth_url": github_auth_url}


@router.get("/github/callback")
@limiter.limit("20/minute")
async def github_callback(
    request: Request,
    code: str = Query(..., description="OAuth code from GitHub"),
    state: str = Query(..., description="Signed OAuth state parameter"),
    db=Depends(get_db),
):
    """
    GitHub OAuth callback endpoint.
    Called after user authorizes on GitHub.
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

        linked_user_id = verify_oauth_state(state)
        if linked_user_id == "00000000-0000-0000-0000-000000000000":
            linked_user_id = None

        # Step 3: Encrypt the token and upsert user in Supabase
        encrypted_token = encrypt_token(github_access_token)
        existing_user = None

        # Check if this github_id is already registered to a user
        result_existing = db.table("users").select("*").eq("github_id", github_id).execute()
        existing_github_user = result_existing.data[0] if result_existing.data else None

        # Link directly if state contains a valid signed user_id
        if linked_user_id:
            if existing_github_user and existing_github_user["id"] != linked_user_id:
                raise ValueError("This GitHub account is already linked to another user profile.")
            result_state = db.table("users").select("*").eq("id", linked_user_id).execute()
            existing_user = result_state.data[0] if result_state.data else None
        else:
            if existing_github_user:
                existing_user = existing_github_user

        if not existing_user and email:
            # Link account if same email exists
            result_email = db.table("users").select("*").eq("email", email).execute()
            existing_user = result_email.data[0] if result_email.data else None

        if existing_user:
            user_id = existing_user["id"]
            db.table("users").update({
                "github_id": github_id,
                "github_access_token": encrypted_token,
                "name": name or existing_user.get("name"),
                "avatar_url": avatar_url or existing_user.get("avatar_url"),
            }).eq("id", user_id).execute()
        else:
            result = db.table("users").insert({
                "github_id": github_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "github_access_token": encrypted_token,
                "plan": "free",
            }).execute()
            user_id = result.data[0]["id"]

        # Step 4: Create signed JWT session token (kept server-side only)
        session_token = create_session_token(user_id)

        # Return user info or redirect depending on Accept header
        accept = request.headers.get("accept", "")
        if "application/json" in accept:
            return {
                "user_id": user_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "plan": existing_user["plan"] if existing_user else "free",
                "session_token": session_token,
                "is_admin": existing_user.get("is_admin", False) if existing_user else False,
            }

        # If direct browser redirect, keep the session out of the URL in production.
        # Note: raw github_access_token is NEVER passed back to the client.
        if settings.is_production:
            response = RedirectResponse(url=f"{settings.frontend_url}/auth/callback?auth=success")
            response.set_cookie(
                key="debtmap_session",
                value=session_token,
                httponly=True,
                secure=True,
                samesite="none",
                max_age=60 * 60 * 24 * 30,
            )
            return response
        else:
            # In development, fall back to URL query parameters because browsers block cross-port cookies on http://localhost
            import urllib.parse
            query_params = urllib.parse.urlencode({
                "user_id": user_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url or "",
                "plan": existing_user["plan"] if existing_user else "free",
                "session_token": session_token,
                "has_github_token": "true",
                "is_admin": "true" if (existing_user and existing_user.get("is_admin")) else "false",
            })
            return RedirectResponse(url=f"{settings.frontend_url}/auth/callback?{query_params}")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("GitHub OAuth callback failed")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.get("/me")
async def get_current_user(
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get current user profile including plan and connected repos count."""
    result = db.table("users").select("*").eq("id", current_user_id).execute()
    user = result.data[0] if result.data else None
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # Check if temporary plan has expired
    plan_expires_at = user.get("plan_expires_at")
    if plan_expires_at:
        from datetime import datetime, timezone
        try:
            expires_at = datetime.fromisoformat(plan_expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_at and user["plan"] != "free":
                # Automatically demote to free
                db.table("users").update({"plan": "free", "plan_expires_at": None}).eq("id", user["id"]).execute()
                user["plan"] = "free"
        except Exception as e:
            logger.error(f"Error checking plan expiration: {e}")

    repos_count = db.table("repos").select("id", count="exact").eq("user_id", user["id"]).execute()

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user.get("avatar_url"),
        "plan": user["plan"],
        "repos_count": repos_count.count or 0,
        "created_at": user["created_at"],
        "has_github_token": bool(user.get("github_access_token")),
        "is_admin": user.get("is_admin", False),
    }


@router.post("/signup")
@limiter.limit("5/minute")
async def email_signup(request: Request, payload: EmailSignUpRequest, response: Response, db=Depends(get_db)):
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
        # Use an isolated client for auth so we don't mutate the shared db client
        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        # Use admin API to create user and auto-confirm email, avoiding confirmation email blockers
        auth_response = auth_client.auth.admin.create_user({
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {
                "name": payload.name
            }
        })
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create user account.")
            
        user_id = auth_response.user.id
        
        # Create user profile record in public.users
        db.table("users").upsert({
            "id": user_id,
            "email": payload.email,
            "name": payload.name,
            "github_access_token": None,
            "plan": "free"
        }).execute()
        
        session_token = create_session_token(user_id)
        response.set_cookie(
            key="debtmap_session",
            value=session_token,
            httponly=True,
            secure=settings.is_production,
            samesite="none" if settings.is_production else "lax",
            max_age=60 * 60 * 24 * 30,
        )
        return {
            "user_id": user_id,
            "email": payload.email,
            "name": payload.name,
            "plan": "free",
            "session_token": session_token,
            "is_admin": False,
            "message": "Registration successful. Please sign in."
        }
    except Exception as e:
        logger.exception("Email signup failed")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
@limiter.limit("10/minute")
async def email_signin(request: Request, payload: EmailAuthRequest, response: Response, db=Depends(get_db)):
    """Sign in an existing user with email and password via Supabase Auth."""
    try:
        credentials = {
            "email": payload.email,
            "password": payload.password
        }
        # Use an isolated client for auth so we don't mutate the shared db client
        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        auth_response = auth_client.auth.sign_in_with_password(credentials)
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
                "github_access_token": None,
                "plan": "free"
            }).execute()
            profile = {
                "id": user_id,
                "email": email,
                "name": name,
                "plan": "free"
            }
            
        session_token = create_session_token(profile["id"])
        response.set_cookie(
            key="debtmap_session",
            value=session_token,
            httponly=True,
            secure=settings.is_production,
            samesite="none" if settings.is_production else "lax",
            max_age=60 * 60 * 24 * 30,
        )
        return {
            "user_id": profile["id"],
            "email": profile["email"],
            "name": profile["name"],
            "plan": profile["plan"],
            "session_token": session_token,
            "is_admin": profile.get("is_admin", False),
        }
    except Exception as e:
        logger.exception("Email signin failed")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upgrade")
async def upgrade_plan(
    payload: UpgradePlanRequest,
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db)
):
    """Downgrade the current user's plan. Paid upgrades must go through billing verification."""
    if payload.plan not in ["free", "pro", "team", "enterprise"]:
        raise HTTPException(status_code=400, detail="Invalid plan name")

    if payload.plan != "free":
        raise HTTPException(status_code=403, detail="Paid upgrades must be completed through checkout")
    
    result = db.table("users").update({"plan": "free", "plan_expires_at": None}).eq("id", current_user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"success": True, "plan": "free"}


@router.post("/coupon")
@limiter.limit("10/minute")
async def apply_coupon(
    request: Request,
    payload: CouponRequest,
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db)
):
    """Apply a subscription coupon code. 'ONE_WEEK' rewards 1 week of Pro."""
    from datetime import datetime, timedelta, timezone
    code = payload.code.strip()
    if code != "ONE_WEEK":
        raise HTTPException(status_code=400, detail="Invalid coupon code")
        
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    
    result = db.table("users").update({
        "plan": "pro",
        "plan_expires_at": expires_at
    }).eq("id", current_user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "success": True,
        "plan": "pro",
        "plan_expires_at": expires_at,
        "message": "Coupon applied! You have 1 week of Pro subscription."
    }


@router.post("/razorpay/order")
async def create_razorpay_order(
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db)
):
    """Create a Razorpay order for Pro subscription (₹4,000)."""
    import uuid
    import httpx
    amount_paise = 400000
    
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        if settings.app_env != "production":
            return {
                "order_id": "order_mock_" + uuid.uuid4().hex[:12],
                "amount": amount_paise,
                "currency": "INR",
                "key": "mock_razorpay_key"
            }
        raise HTTPException(status_code=500, detail="Razorpay configuration missing on server")
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.razorpay.com/v1/orders",
                auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
                json={
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": f"receipt_{current_user_id[:8]}",
                    "payment_capture": 1
                }
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Razorpay order failed: {response.text}")
            order_data = response.json()
            return {
                "order_id": order_data["id"],
                "amount": order_data["amount"],
                "currency": order_data["currency"],
                "key": settings.razorpay_key_id
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Razorpay: {str(e)}")


@router.post("/razorpay/verify")
async def verify_razorpay_payment(
    payload: RazorpayVerifyRequest,
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db)
):
    """Verify Razorpay payment signature and upgrade to Pro."""
    import hmac
    import hashlib

    if payload.razorpay_order_id.startswith("order_mock_"):
        if settings.is_production:
            raise HTTPException(status_code=400, detail="Mock payments are not accepted in production")
        db.table("users").update({"plan": "pro", "plan_expires_at": None}).eq("id", current_user_id).execute()
        return {"success": True, "plan": "pro"}
        
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=500, detail="Razorpay keys missing on server")
        
    msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    generated_signature = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(generated_signature, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Signature verification failed")
        
    result = db.table("users").update({
        "plan": "pro",
        "plan_expires_at": None
    }).eq("id", current_user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"success": True, "plan": "pro"}


@router.post("/logout")
async def logout(response: Response):
    """Log out current user by deleting the session cookie."""
    response.delete_cookie(
        key="debtmap_session",
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
    )
    return {"success": True}
