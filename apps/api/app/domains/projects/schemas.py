from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ProjectDetectRequest(BaseModel):
    path: str
    worktree: str | None = None
    name: str | None = None


class ProjectUpdateRequest(BaseModel):
    display_name: str | None = None
    tech_stack: list[str] | None = None


class ProjectResponse(BaseModel):
    id: str
    display_name: str
    workspace_path: str | None
    tech_stack: list[str]
    last_active: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
