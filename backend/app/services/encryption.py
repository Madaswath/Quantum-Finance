import os
import base64
from cryptography.fernet import Fernet

# A Fernet key must be a 32-byte string base64 encoded.
# In production, this must be injected via environment/secret manager.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Use a deterministic 32-byte default key for local/demo runs
    ENCRYPTION_KEY = base64.urlsafe_b64encode(b"quantum_wealth_encryption_key_20").decode()

_fernet = Fernet(ENCRYPTION_KEY)

def encrypt_data(data: str) -> str:
    """Encrypts a plaintext string into a ciphertext string."""
    if not data:
        return ""
    return _fernet.encrypt(data.encode()).decode()

def decrypt_data(token: str) -> str:
    """Decrypts a ciphertext string back to plaintext."""
    if not token:
        return ""
    try:
        return _fernet.decrypt(token.encode()).decode()
    except Exception:
        # If decryption fails (e.g. data is not encrypted), return original or marker
        return token
