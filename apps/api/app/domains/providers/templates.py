"""Pre-configured provider templates for Victorious Memory V2."""
from typing import Any

PROVIDER_TEMPLATES: dict[str, dict[str, Any]] = {
    "openai": {
        "name": "OpenAI",
        "provider_type": "openai",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "description": "Official OpenAI API",
    },
    "anthropic": {
        "name": "Anthropic",
        "provider_type": "anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-sonnet-4-6",
        "description": "Anthropic Claude API",
    },
    "opencode": {
        "name": "OpenCode",
        "provider_type": "openai",
        "base_url": "http://localhost:7777/v1",
        "default_model": "gpt-5-mini",
        "description": "OpenCode built-in provider",
    },
    "openrouter": {
        "name": "OpenRouter",
        "provider_type": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "openrouter/auto",
        "description": "OpenRouter unified API",
    },
    "groq": {
        "name": "Groq",
        "provider_type": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama3-8b-8192",
        "description": "Groq fast inference",
    },
    "ollama": {
        "name": "Ollama",
        "provider_type": "ollama",
        "base_url": "http://localhost:11434/v1",
        "default_model": "llama3",
        "description": "Local Ollama server",
    },
    "custom": {
        "name": "Custom",
        "provider_type": "custom",
        "base_url": "",
        "default_model": "",
        "description": "Custom OpenAI-compatible endpoint",
    },
}

PROVIDER_TYPES = list(PROVIDER_TEMPLATES.keys())


def get_template(provider_type: str) -> dict[str, Any] | None:
    """Retrieve a provider template by type.

    Args:
        provider_type: The provider type key (e.g., 'openai', 'anthropic')

    Returns:
        The provider template dict, or None if not found
    """
    return PROVIDER_TEMPLATES.get(provider_type)
