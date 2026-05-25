"""Unit tests for the Fernet-based provider API key encryption module."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet, InvalidToken

from app.domains.providers.encryption import KeyEncryption, decrypt_api_key, encrypt_api_key


class TestKeyEncryption:
    """Tests for the KeyEncryption class."""

    def test_encrypt_decrypt_roundtrip(self):
        """Encrypting and decrypting a plaintext should yield the original."""
        key = Fernet.generate_key().decode()
        ke = KeyEncryption(key=key)
        plaintext = "sk-test-api-key-12345"

        ciphertext = ke.encrypt(plaintext)
        assert ciphertext != plaintext
        assert ke.decrypt(ciphertext) == plaintext

    def test_decrypt_with_wrong_key_raises_invalid_token(self):
        """Decrypting with a different key must raise InvalidToken."""
        key1 = Fernet.generate_key().decode()
        key2 = Fernet.generate_key().decode()
        ke1 = KeyEncryption(key=key1)
        ke2 = KeyEncryption(key=key2)
        plaintext = "super-secret-key"

        ciphertext = ke1.encrypt(plaintext)
        with pytest.raises(InvalidToken):
            ke2.decrypt(ciphertext)

    def test_auto_generates_encryption_key_file(self, tmp_path):
        """When no key is provided and settings has none, a .encryption_key file is created."""
        # Change to a temporary directory so the file is created there
        original_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            with patch("app.domains.providers.encryption.settings") as mock_settings:
                mock_settings.provider_key_encryption_key = ""
                assert not Path(".encryption_key").exists()
                ke = KeyEncryption()
                assert Path(".encryption_key").exists()
                # Verify the file contains a valid Fernet key
                file_key = Path(".encryption_key").read_bytes()
                assert len(file_key) > 0
                # Re-loading should read the same key
                ke2 = KeyEncryption()
                plaintext = "test-key"
                ct = ke2.encrypt(plaintext)
                assert ke2.decrypt(ct) == plaintext
        finally:
            os.chdir(original_cwd)

    def test_module_level_singleton(self):
        """The module-level encrypt/decrypt helpers should work consistently."""
        # Reset singleton with explicit key to avoid side effects
        key = Fernet.generate_key().decode()
        with patch("app.domains.providers.encryption.key_encryption", KeyEncryption(key=key)):
            plain = "module-level-test"
            ct = encrypt_api_key(plain)
            assert decrypt_api_key(ct) == plain
