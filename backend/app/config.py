"""
DebtMap Backend Configuration
Loads all settings from .env file via pydantic-settings
"""
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
    scan_temp_dir: str = "/tmp/debtmap_scans"
    max_repo_size_mb: int = 500

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.app_env == "production":
            if self.secret_key == "change-this-in-production":
                raise ValueError("secret_key must be changed in production mode!")
            if self.github_webhook_secret == "debtmap-webhook-secret":
                raise ValueError("github_webhook_secret must be changed in production mode!")
        return self


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — reads .env once at startup."""
    return Settings()
