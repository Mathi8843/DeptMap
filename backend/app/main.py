"""
Risk Guard AI FastAPI Application
Main entry point — registers all routers, configures CORS, rate limiting, and sets up middleware.
"""
import logging
import time
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import get_db
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.rate_limit import limiter
from app.routers import auth, repos, scans, issues, packages, trend, soc2, webhooks, admin, analyze

# ─── Logging Setup ────────────────────────────────────────────────────────────

class ContextFilter(logging.Filter):
    """Injects request_id from context var into every log record."""
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Adds a short request ID to every request for log correlation."""
    async def dispatch(self, request: Request, call_next):
        rid = uuid.uuid4().hex[:8]
        request_id_var.set(rid)
        request.scope["request_id"] = rid

        logger.info("→ %s %s", request.method, request.url.path)
        start = time.time()
        response = await call_next(request)
        duration_ms = int((time.time() - start) * 1000)
        logger.info("← %s %s — %d (%dms)", request.method, request.url.path, response.status_code, duration_ms)

        response.headers["X-Request-ID"] = rid
        return response


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(request_id)-8s | %(name)s | %(message)s",
)
logging.getLogger().addFilter(ContextFilter())
logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Startup / Shutdown ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    import os
    logger.info(f"🚀 Risk Guard AI API starting (env={settings.app_env})")

    # Create scan temp directory if it doesn't exist
    os.makedirs(settings.scan_temp_dir, exist_ok=True)
    logger.info(f"📁 Scan temp dir: {settings.scan_temp_dir}")

    yield  # App runs here

    logger.info("🛑 Risk Guard AI API shutting down")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Risk Guard AI API",
    description="AI-powered code security scanner for non-technical founders",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
# Build the list of allowed origins from hard-coded values + env config.
# Add ALLOWED_ORIGINS=https://a.com,https://b.com to backend .env to extend
# without a code change.
_extra_origins: list[str] = [
    o.strip().rstrip("/")
    for o in (settings.allowed_origins or "").split(",")
    if o.strip()
]

_allowed_origins: list[str] = list({
    settings.frontend_url.rstrip("/"),          # FRONTEND_URL env var on Render
    "http://localhost:3000",
    "http://localhost:3001",
    "https://riskguardai.vercel.app",  # production Vercel deployment
    "https://riskguardai.com",
    "https://www.riskguardai.com",
    "https://app.riskguardai.com",
    *_extra_origins,
})

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Rate Limiting ──────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(429, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(repos.router)
app.include_router(scans.router)
app.include_router(issues.router)
app.include_router(packages.router)
app.include_router(trend.router)
app.include_router(soc2.router)
app.include_router(webhooks.router)
app.include_router(admin.router)
app.include_router(analyze.router)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "app": "Risk Guard AI API",
        "version": "1.0.0",
        "status": "online",
        "docs": None if settings.is_production else "/docs",
    }


@app.get("/health")
async def health_check(db=Depends(get_db)):
    """Used by Railway/Render for deployment health checks. Verifies Supabase connectivity."""
    try:
        db.table("users").select("id").limit(1).execute()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error("Health check failed — database unreachable", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Database unreachable: {str(e)}")


# ─── Dev Server ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "development",
        log_level="info",
    )
