"""
Authentication and JWT service.
Handles JWT token generation, verification, and FastAPI dependencies.
"""
from datetime import datetime, timedelta, timezone
import logging
import jwt
from fastapi import Depends, HTTPException, Security
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

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    FastAPI dependency to secure endpoints.
    Extracts the Bearer token from the request and resolves it to a user_id.
    """
    if not credentials:
        # Fallback to query param in development for tests, or raise 401
        # Let's strictly require header credentials to enforce security.
        raise HTTPException(status_code=401, detail="Not authenticated: Bearer token missing")
        
    return verify_session_token(credentials.credentials)
