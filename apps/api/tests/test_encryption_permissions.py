"""Tests for encryption key file permissions (security hardening from Plan 02)."""

from __future__ import annotations

import os
import stat
from pathlib import Path
from unittest.mock import patch

import pytest

from app.domains.providers.encryption import KeyEncryption


class TestEncryptionKeyPermissions:
    """Tests that .encryption_key file has restrictive permissions."""

    @pytest.mark.skipif(os.name == "nt", reason="os.chmod is a no-op on Windows")
    def test_encryption_key_file_has_600_permissions(self, tmp_path):
        """When auto-generating a key file, it must have 0o600 permissions."""
        original_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            with patch("app.domains.providers.encryption.settings") as mock_settings:
                mock_settings.provider_key_encryption_key = ""
                ke = KeyEncryption()
                key_path = Path(".encryption_key")
                assert key_path.exists()
                mode = key_path.stat().st_mode
                # Check owner read/write only (0o600)
                assert stat.S_IMODE(mode) == 0o600
        finally:
            os.chdir(original_cwd)

    def test_encryption_key_file_exists_after_generation(self, tmp_path):
        """Key file must exist after auto-generation."""
        original_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            with patch("app.domains.providers.encryption.settings") as mock_settings:
                mock_settings.provider_key_encryption_key = ""
                assert not Path(".encryption_key").exists()
                ke = KeyEncryption()
                assert Path(".encryption_key").exists()
                # Verify it's a valid Fernet key (44 bytes base64)
                raw = Path(".encryption_key").read_bytes()
                assert len(raw) == 44
        finally:
            os.chdir(original_cwd)
