"""
Risk Guard AI Backend Configuration
Loads all settings from .env file via pydantic-settings
"""
import logging
from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Server
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    allowed_origins: str = ""

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # GitHub OAuth
    github_client_id: str
    github_client_secret: str
    github_webhook_secret: str = "debtmap-webhook-secret"

    # Groq API Settings
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # App Security
    secret_key: str = "change-this-in-production"

    # Razorpay Settings
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Scan Settings
    scan_temp_dir: str = "/tmp/riskguard_scans"
    max_repo_size_mb: int = 500

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        """Validate sensitive defaults in any environment — not just production."""
        logger = logging.getLogger(__name__)

        if self.secret_key == "change-this-in-production":
            msg = "SECRET_KEY is still set to the default value — JWT tokens can be forged!"
            if self.is_production:
                raise ValueError(msg.replace(" — ", " — production: "))
            logger.critical("🔴 %s Set SECRET_KEY in .env to a random 64-char string.", msg)

        if self.github_webhook_secret == "debtmap-webhook-secret":
            msg = "GITHUB_WEBHOOK_SECRET is still set to the default value — webhooks can be spoofed!"
            if self.is_production:
                raise ValueError(msg.replace(" — ", " — production: "))
            logger.critical("🔴 %s Set GITHUB_WEBHOOK_SECRET in .env to a random value.", msg)

        return self


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — reads .env once at startup."""
    return Settings()
