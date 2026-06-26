"""
Authentication and JWT service.
Handles JWT token generation, verification, and FastAPI dependencies.
"""
from datetime import datetime, timedelta, timezone
import logging
import uuid
import jwt
from fastapi import HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# FastAPI security scheme to extract Bearer token from Authorization header
security = HTTPBearer(auto_error=False)

def create_session_token(user_id: str) -> str:
    """Generates a signed JWT session token for a given user_id."""
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),  # Session token valid for 30 days
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def create_oauth_state(user_id: str | None = None) -> str:
    """Create a short-lived signed state token for GitHub OAuth redirects."""
    payload = {
        "purpose": "github_oauth_state",
        "sub": user_id or "none",
        "nonce": uuid.uuid4().hex,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def verify_oauth_state(state: str) -> str | None:
    """Verify GitHub OAuth state and return the optional linked user_id."""
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "github_oauth_state":
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        user_id = payload.get("sub")
        return None if not user_id or user_id == "none" else user_id
    except jwt.PyJWTError as e:
        logger.warning(f"OAuth state verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

def verify_session_token(token: str) -> str:
    """
    Verifies a JWT session token and returns the user_id (sub).
    In non-production environments, allows the mock-session-token to map to the default mock user.
    """
    if token == "mock-session-token" and settings.app_env != "production":
        return "00000000-0000-0000-0000-000000000000"
        
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid session token payload")
        return user_id
    except jwt.PyJWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid session token")

def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    """
    FastAPI dependency to secure endpoints.
    Extracts the Bearer token from the request and resolves it to a user_id.
    """
    token = credentials.credentials if credentials else request.cookies.get("riskguard_session")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated: Bearer token missing")
        
    return verify_session_token(token)
