from __future__ import annotations

from pydantic import BaseModel


class ContextResponse(BaseModel):
    block: str
    memories_used: int
    project_id: str | None
    project_name: str | None
