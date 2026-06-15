"""
Symmetric encryption utility for sensitive database fields (like GitHub access tokens).
Uses cryptography.fernet.Fernet with key derived from app's SECRET_KEY.
"""
import base64
import hashlib
from cryptography.fernet import Fernet
from app.config import get_settings

def _get_fernet() -> Fernet:
    """Derives a Fernet key from the configured app SECRET_KEY using SHA256."""
    settings = get_settings()
    key = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def encrypt_token(token: str) -> str:
    """Encrypts a string token using Fernet symmetric encryption."""
    if not token:
        return ""
    f = _get_fernet()
    return f.encrypt(token.encode("utf-8")).decode("utf-8")

def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypts a Fernet encrypted token.
    Gracefully falls back to the original string if decryption fails or format is invalid.
    """
    if not encrypted_token:
        return ""
    # Fernet tokens always start with 'gAAAAA'
    if not encrypted_token.startswith("gAAAAA"):
        return encrypted_token
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except Exception:
        # If decryption fails (e.g. key changed or token was unencrypted), return as is
        return encrypted_token
