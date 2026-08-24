"""Pre-configured provider templates for Victorious Memory V2."""
from typing import Any

PROVIDER_TEMPLATES: dict[str, dict[str, Any]] = {
    "openai": {
        "name": "OpenAI",
        "provider_type": "openai",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "description": "Official OpenAI API (GPT-4o, GPT-4o-mini, etc.)",
    },
    "anthropic": {
        "name": "Anthropic",
        "provider_type": "anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-3-5-sonnet-20241022",
        "description": "Anthropic Claude API (Sonnet 3.5, Haiku 3.5, etc.)",
    },
    "openrouter": {
        "name": "OpenRouter",
        "provider_type": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "anthropic/claude-3.5-sonnet",
        "description": "Unified multi-model API access with routing and fallbacks",
    },
    "groq": {
        "name": "Groq",
        "provider_type": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "description": "Ultra-fast inference for Llama 3.3, Mixtral, etc.",
    },
    "ollama": {
        "name": "Ollama (Local)",
        "provider_type": "ollama",
        "base_url": "http://localhost:11434/v1",
        "default_model": "llama3.2",
        "description": "Local LLM inference (Use http://host.docker.internal:11434/v1 in Docker)",
    },
    "opencode": {
        "name": "OpenCode / Local Proxy",
        "provider_type": "opencode",
        "base_url": "http://localhost:7777/v1",
        "default_model": "deepseek-chat",
        "description": "OpenCode proxy or custom local endpoint",
    },
    "custom": {
        "name": "Custom OpenAI-Compatible",
        "provider_type": "custom",
        "base_url": "",
        "default_model": "",
        "description": "Any OpenAI-compatible API endpoint (LiteLLM, vLLM, DeepSeek, etc.)",
    },
}

PROVIDER_TYPES = list(PROVIDER_TEMPLATES.keys())


def get_template(provider_type: str) -> dict[str, Any] | None:
    """Retrieve a provider template by type."""
    return PROVIDER_TEMPLATES.get(provider_type)


def list_templates() -> list[dict[str, Any]]:
    """Return all provider templates as a list with keys included."""
    return [{"key": k, **v} for k, v in PROVIDER_TEMPLATES.items()]
