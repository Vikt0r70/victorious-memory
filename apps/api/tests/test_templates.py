"""Tests for provider template definitions (PROV-08)."""

from __future__ import annotations

from app.domains.providers.templates import PROVIDER_TEMPLATES, PROVIDER_TYPES, get_template


class TestProviderTemplates:
    """Tests for the PROVIDER_TEMPLATES dictionary."""

    def test_has_exactly_seven_templates(self):
        """PROVIDER_TEMPLATES must contain exactly 7 provider definitions."""
        assert len(PROVIDER_TEMPLATES) == 7

    def test_contains_expected_provider_types(self):
        """All expected provider types must be present."""
        expected = {"openai", "anthropic", "opencode", "openrouter", "groq", "ollama", "custom"}
        assert set(PROVIDER_TEMPLATES.keys()) == expected

    def test_provider_types_matches_keys(self):
        """PROVIDER_TYPES list must match template keys."""
        assert set(PROVIDER_TYPES) == set(PROVIDER_TEMPLATES.keys())

    def test_each_template_has_required_fields(self):
        """Every template must contain name, provider_type, base_url, default_model, description."""
        required_fields = {"name", "provider_type", "base_url", "default_model", "description"}
        for key, template in PROVIDER_TEMPLATES.items():
            missing = required_fields - set(template.keys())
            assert not missing, f"Template '{key}' missing fields: {missing}"

    def test_openai_template_values(self):
        """OpenAI template must have correct values."""
        t = get_template("openai")
        assert t is not None
        assert t["name"] == "OpenAI"
        assert t["provider_type"] == "openai"
        assert t["base_url"] == "https://api.openai.com/v1"
        assert t["default_model"] == "gpt-4o"

    def test_ollama_localhost_base_url(self):
        """Ollama template must point to localhost."""
        t = get_template("ollama")
        assert t is not None
        assert "localhost" in t["base_url"]

    def test_custom_template_empty_defaults(self):
        """Custom template must have empty base_url and default_model."""
        t = get_template("custom")
        assert t is not None
        assert t["base_url"] == ""
        assert t["default_model"] == ""

    def test_opencode_uses_openai_type(self):
        """OpenCode template must use 'openai' provider_type for LiteLLM compatibility."""
        t = get_template("opencode")
        assert t is not None
        assert t["provider_type"] == "openai"
