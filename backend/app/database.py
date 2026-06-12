"""
Supabase client singleton.
Uses service role key for backend operations (bypasses RLS).
Frontend uses anon key with user JWT tokens.
"""
from functools import lru_cache
from supabase import create_client, Client
from app.config import get_settings


@lru_cache()
def get_supabase() -> Client:
    """
    Returns a Supabase client using the SERVICE ROLE key.
    This key bypasses Row Level Security — use only server-side.
    Never expose this key to the frontend.
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


def get_db() -> Client:
    """FastAPI dependency injection helper."""
    return get_supabase()
