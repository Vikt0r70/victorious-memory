from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class KeyEncryption:
    """Fernet-based encryption for at-rest API key storage."""

    def __init__(self, key: str | None = None):
        if key is not None:
            self._key = key.encode() if isinstance(key, str) else key
        elif settings.provider_key_encryption_key:
            self._key = settings.provider_key_encryption_key.encode()
        else:
            key_path = Path(".encryption_key")
            if key_path.exists():
                self._key = key_path.read_bytes()
            else:
                self._key = Fernet.generate_key()
                key_path.write_bytes(self._key)
        self._fernet = Fernet(self._key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext and return base64-encoded ciphertext."""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext and return plaintext.

        Raises:
            InvalidToken: If the ciphertext is invalid or the key is wrong.
        """
        return self._fernet.decrypt(ciphertext.encode()).decode()


# Module-level singleton
key_encryption = KeyEncryption()


def encrypt_api_key(plain: str) -> str:
    """Encrypt an API key string."""
    return key_encryption.encrypt(plain)


def decrypt_api_key(ciphertext: str) -> str:
    """Decrypt an API key string."""
    return key_encryption.decrypt(ciphertext)
