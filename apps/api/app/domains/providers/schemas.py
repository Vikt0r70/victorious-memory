"""Pydantic schemas for the providers domain."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ProviderType = Literal[
    "openai",
    "anthropic",
    "opencode",
    "openrouter",
    "groq",
    "ollama",
    "custom",
]


class ProviderCreate(BaseModel):
    """Payload for creating or updating a provider configuration."""

    name: str
    provider_type: ProviderType
    base_url: str
    api_key: str = ""
    model: str
    max_tokens: int = 2000
    is_enabled: bool = True


class ProviderResponse(BaseModel):
    """Public representation of a provider config — **no api_key**."""

    id: str
    name: str
    provider_type: str
    base_url: str
    model: str
    max_tokens: int
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransientTestRequest(BaseModel):
    """Payload for testing provider connection before saving."""

    name: str = "Test Connection"
    provider_type: ProviderType
    base_url: str
    api_key: str = ""
    model: str
    max_tokens: int = 2000


class AgentSettings(BaseModel):
    """Agent settings schema."""

    role: str
    primary_provider_id: str | None = None
    fallback_provider_ids: list[str] = []
    settings_override: dict[str, Any] = {}


class AgentSettingsResponse(BaseModel):
    """Agent settings response schema."""

    role: str
    primary_provider_id: str | None = None
    fallback_provider_ids: list[str] = []
    settings_override: dict[str, Any] = {}

    model_config = {"from_attributes": True}


class ProviderTestResponse(BaseModel):
    """Result of a provider test call."""

    status: str
    response: str = ""
    error: str | None = None
    latency_ms: int | None = None


class UsageLogResponse(BaseModel):
    """Usage log response schema."""

    id: int
    provider_id: str
    provider_name: str | None = None
    agent_role: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    status: str
    fallback_position: int
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModelDiscoveryResponse(BaseModel):
    """Model discovery response schema."""

    models: list[dict[str, str]]


class TemplateItemResponse(BaseModel):
    """Provider template response schema."""

    key: str
    name: str
    provider_type: str
    base_url: str
    default_model: str
    description: str
