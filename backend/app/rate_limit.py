"""
Shared rate limiter instance for slowapi.
Imported by main.py (to wire up middleware) and by routers (to decorate endpoints).
"""
from fastapi import Request
from slowapi import Limiter


def _get_client_ip(request: Request) -> str:
    """
    Extract real client IP from X-Forwarded-For (Render/Railway proxy)
    or fall back to direct connection IP.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_get_client_ip)
