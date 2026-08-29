from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class MemoryCreateRequest(BaseModel):
    content: str
    memory_type: str = "reference"
    scope: str = "global"
    project_id: str | None = None
    confidence_score: float = 0.8
    tags: list[str] = []
    source_type: str | None = None


class MemoryUpdateRequest(BaseModel):
    content: str | None = None
    memory_type: str | None = None
    scope: str | None = None
    confidence_score: float | None = None
    tags: list[str] | None = None
    status: str | None = None
    pinned: bool | None = None


class MemoryResponse(BaseModel):
    id: str
    content: str
    memory_type: str
    scope: str
    project_id: str | None
    confidence_score: float
    confidence_label: str
    confidence_reasoning: str | None
    status: str
    auto_approved: bool
    source_type: str | None
    source_session: str | None
    dynamic_tag: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    last_accessed: datetime | None
    access_count: int
    pinned: bool = False

    model_config = {"from_attributes": True}


class MemoryListResponse(BaseModel):
    items: list[MemoryResponse]
    total: int
    page: int
    per_page: int


class BulkActionRequest(BaseModel):
    action: str  # "approve", "reject", "delete"
    ids: list[str]
    reason: str = ""


class SearchRequest(BaseModel):
    query: str
    project_id: str | None = None
    top_k: int = 10
