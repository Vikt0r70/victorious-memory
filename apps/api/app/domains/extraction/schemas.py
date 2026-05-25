from __future__ import annotations

from pydantic import BaseModel


class MemoryCandidate(BaseModel):
    content: str
    memory_type: str
    scope: str  # "project", "global", "cross-project"
    confidence_score: float
    confidence_reasoning: str = ""
    tags: list[str] = []
    supersedes_content: str | None = None


class ValidatedCandidate(MemoryCandidate):
    confidence_label: str = "medium"  # high, medium, low
    status: str = "active"  # active or pending_review
    auto_approved: bool = False
    source_type: str = "assistant_inference"  # user_statement, assistant_inference, tool_output
