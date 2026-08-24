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
    job_id: str | None = None  # None when batch threshold not reached yet
    status: str  # "accumulating" or "queued"
    accumulated_tokens: int = 0
    threshold: int = 10000
    unextracted_count: int = 0


class BufferStatusResponse(BaseModel):
    project_id: str | None = None
    unextracted_exchanges_count: int = 0
    accumulated_tokens: int = 0
    threshold: int = 10000
    progress_pct: float = 0.0
    extraction_enabled: bool = True


class ExtractNowResponse(BaseModel):
    status: str  # "queued" or "empty"
    job_id: str | None = None
    exchanges_count: int = 0
    accumulated_tokens: int = 0
    message: str = ""
