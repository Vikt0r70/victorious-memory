"""Pydantic schemas for the providers domain."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProviderConfigCreate(BaseModel):
    """Payload for creating / updating a provider configuration."""

    role: str
    provider_type: str
    base_url: str
    model: str
    api_key: str = ""
    max_tokens: int = 2000


class ProviderConfigResponse(BaseModel):
    """Public representation of a provider config — **no api_key**."""

    id: str
    role: str
    provider_type: str
    base_url: str
    model: str
    max_tokens: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderTestResponse(BaseModel):
    """Result of a provider test call."""

    status: str
    response: str
