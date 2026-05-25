from __future__ import annotations

from pydantic import BaseModel


class AgentPart(BaseModel):
    type: str  # "text", "thinking", "tool_call"
    content: str = ""
    tool: str = ""
    timestamp: str = ""


class ExchangeData(BaseModel):
    user: str
    agent_parts: list[AgentPart]
    file_paths: list[str] = []
    timestamp: str


class IngestRequest(BaseModel):
    project_id: str | None = None
    session_id: str
    exchange: ExchangeData


class IngestResponse(BaseModel):
    exchange_id: str
    job_id: str
    status: str  # always "queued"
