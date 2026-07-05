"""
Symmetric encryption utility for sensitive database fields (like GitHub access tokens).
Uses cryptography.fernet.Fernet with key derived from app's SECRET_KEY.
"""
import base64
import hashlib
import logging
from cryptography.fernet import Fernet, InvalidToken
from app.config import get_settings

logger = logging.getLogger(__name__)

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

    Raises ValueError if decryption fails — this almost always means the
    SECRET_KEY was rotated after the token was stored.  The caller should
    surface this as a 400/401 and prompt the user to re-authenticate via
    GitHub OAuth so a freshly-encrypted token is stored.
    """
    if not encrypted_token:
        return ""

    settings = get_settings()

    # Fernet tokens always start with 'gAAAAA'
    if not encrypted_token.startswith("gAAAAA"):
        if settings.app_env == "production":
            raise ValueError(
                "Token is not Fernet-encoded. "
                "Please re-authenticate via GitHub OAuth to refresh your credentials."
            )
        # In development, allow raw tokens (e.g. mock_github_token)
        logger.debug("decrypt_token: received a non-Fernet token — using as-is (dev mode)")
        return encrypted_token

    try:
        f = _get_fernet()
        return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # InvalidToken is raised when the key doesn't match — classic key-rotation symptom.
        logger.error(
            "Fernet decryption failed — SECRET_KEY may have been rotated. "
            "User must re-authenticate to store a new token."
        )
        raise ValueError(
            "GitHub token could not be decrypted. "
            "This usually means the server's SECRET_KEY was changed. "
            "Please re-authenticate via GitHub OAuth."
        )
    except Exception as e:
        logger.error(f"Unexpected error decrypting token: {e}", exc_info=True)
        raise ValueError(f"Failed to decrypt secure token: {e}") from e
