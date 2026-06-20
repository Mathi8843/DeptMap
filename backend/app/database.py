"""
Supabase client singleton with TTL-based refresh.
Uses service role key for backend operations (bypasses RLS).
Frontend uses anon key with user JWT tokens.

The client is recreated every CLIENT_TTL_SECONDS to pick up key rotations
and recover from transient Supabase outages. No lru_cache — we use a module-level
variable with age-based invalidation.
"""
import logging
import time
from supabase import create_client, Client
from app.config import get_settings

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None
_last_created: float = 0
_CLIENT_TTL_SECONDS: int = 300  # Recreate every 5 minutes


def get_supabase() -> Client:
    """
    Returns a Supabase client using the SERVICE ROLE key.
    Recreates the client if older than CLIENT_TTL_SECONDS.
    """
    global _supabase_client, _last_created

    settings = get_settings()

    if _supabase_client is None or time.time() - _last_created > _CLIENT_TTL_SECONDS:
        logger.info("Creating new Supabase client (TTL-based refresh)")
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        _last_created = time.time()

    return _supabase_client


def get_db() -> Client:
    """FastAPI dependency injection helper."""
    return get_supabase()
