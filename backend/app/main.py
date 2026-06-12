"""
DebtMap FastAPI Application
Main entry point — registers all routers, configures CORS, and sets up middleware.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, repos, scans, issues, packages, trend, soc2, webhooks

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Startup / Shutdown ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    import os
    logger.info(f"🚀 DebtMap API starting (env={settings.app_env})")

    # Create scan temp directory if it doesn't exist
    os.makedirs(settings.scan_temp_dir, exist_ok=True)
    logger.info(f"📁 Scan temp dir: {settings.scan_temp_dir}")

    yield  # App runs here

    logger.info("🛑 DebtMap API shutting down")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DebtMap API",
    description="AI-powered code security scanner for non-technical founders",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
# Allow the Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
        "https://debtmap.io",
        "https://www.debtmap.io",
        "https://app.debtmap.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(repos.router)
app.include_router(scans.router)
app.include_router(issues.router)
app.include_router(packages.router)
app.include_router(trend.router)
app.include_router(soc2.router)
app.include_router(webhooks.router)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "app": "DebtMap API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Used by Railway/Render for deployment health checks."""
    return {"status": "healthy"}


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
