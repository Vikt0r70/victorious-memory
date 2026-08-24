"""SQLAlchemy ORM models for all Victorious Memory tables."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    workspace_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    tech_stack: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default="{}", default=list
    )
    last_active: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default="{}", default=dict
    )

    # Relationships
    memories: Mapped[list[Memory]] = relationship(back_populates="project")
    exchanges: Mapped[list[Exchange]] = relationship(back_populates="project")
    timeline_entries: Mapped[list[TimelineEntry]] = relationship(
        back_populates="project"
    )

    @staticmethod
    def new_id(slug: str) -> str:
        return slug  # projects use the slug directly


# ---------------------------------------------------------------------------
# Memories
# ---------------------------------------------------------------------------

MEMORY_TYPES = [
    "decision",
    "preference",
    "constraint",
    "bugfix",
    "lesson",
    "pattern",
    "research",
    "reference",
    "architecture",
    "context",
]

MEMORY_STATUSES = ["active", "pending_review", "deprecated", "superseded", "rejected"]


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    memory_type: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False, default="global")
    project_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("projects.id"), nullable=True
    )

    # Confidence
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    confidence_label: Mapped[str] = mapped_column(
        Text, nullable=False, default="medium"
    )
    confidence_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status & lifecycle
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    auto_approved: Mapped[bool] = mapped_column(Boolean, default=False)

    # Source provenance
    source_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_session: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_exchange_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("exchanges.id"), nullable=True
    )
    dynamic_tag: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tags
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default="{}", default=list
    )

    # Temporal
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_accessed: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    access_count: Mapped[int] = mapped_column(Integer, default=0)
    superseded_by: Mapped[str | None] = mapped_column(
        Text, ForeignKey("memories.id"), nullable=True
    )

    # Vector embedding
    embedding = mapped_column(Vector(384), nullable=True)

    # Relationships
    project: Mapped[Project | None] = relationship(back_populates="memories")
    source_exchange: Mapped[Exchange | None] = relationship(
        back_populates="produced_memories"
    )

    # Edges where this memory is the source
    outgoing_edges: Mapped[list[MemoryEdge]] = relationship(
        foreign_keys="MemoryEdge.source_id", back_populates="source", cascade="all, delete"
    )
    # Edges where this memory is the target
    incoming_edges: Mapped[list[MemoryEdge]] = relationship(
        foreign_keys="MemoryEdge.target_id", back_populates="target", cascade="all, delete"
    )

    @staticmethod
    def new_id() -> str:
        return _generate_id("mem")

    __table_args__ = (
        Index("idx_memories_project", "project_id"),
        Index("idx_memories_scope", "scope"),
        Index("idx_memories_type", "memory_type"),
        Index("idx_memories_status", "status"),
    )


# ---------------------------------------------------------------------------
# Memory Edges (Knowledge Graph)
# ---------------------------------------------------------------------------

EDGE_TYPES = [
    "supersedes",
    "contradicts",
    "depends_on",
    "caused_by",
    "fixed_by",
    "enables",
    "related_to",
    "consolidates",
]


class MemoryEdge(Base):
    __tablename__ = "memory_edges"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    source_id: Mapped[str] = mapped_column(
        Text, ForeignKey("memories.id", ondelete="CASCADE"), nullable=False
    )
    target_id: Mapped[str] = mapped_column(
        Text, ForeignKey("memories.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    source: Mapped[Memory] = relationship(foreign_keys=[source_id], back_populates="outgoing_edges")
    target: Mapped[Memory] = relationship(foreign_keys=[target_id], back_populates="incoming_edges")

    @staticmethod
    def new_id() -> str:
        return _generate_id("edg")

    __table_args__ = (
        UniqueConstraint("source_id", "target_id", "relation_type"),
        Index("idx_edges_source", "source_id"),
        Index("idx_edges_target", "target_id"),
    )


# ---------------------------------------------------------------------------
# Exchanges (raw conversation data)
# ---------------------------------------------------------------------------


class Exchange(Base):
    __tablename__ = "exchanges"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    session_id: Mapped[str] = mapped_column(Text, nullable=False)
    project_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("projects.id"), nullable=True
    )
    user_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_parts: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    file_paths: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default="{}", default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    extracted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project: Mapped[Project | None] = relationship(back_populates="exchanges")
    produced_memories: Mapped[list[Memory]] = relationship(
        back_populates="source_exchange"
    )
    jobs: Mapped[list[ExtractionJob]] = relationship(back_populates="exchange")

    @staticmethod
    def new_id() -> str:
        return _generate_id("exc")


# ---------------------------------------------------------------------------
# Extraction Jobs (background processing queue)
# ---------------------------------------------------------------------------


class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    exchange_id: Mapped[str] = mapped_column(
        Text, ForeignKey("exchanges.id"), nullable=False
    )
    exchange_ids: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default="{}", default=list
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_after: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    exchange: Mapped[Exchange] = relationship(back_populates="jobs")

    @staticmethod
    def new_id() -> str:
        return _generate_id("job")

    __table_args__ = (Index("idx_jobs_status", "status"),)


# ---------------------------------------------------------------------------
# Timeline Entries
# ---------------------------------------------------------------------------


class TimelineEntry(Base):
    __tablename__ = "timeline_entries"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    project_id: Mapped[str] = mapped_column(
        Text, ForeignKey("projects.id"), nullable=False
    )
    entry_type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    memory_ids: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default="{}", default=list
    )
    status: Mapped[str] = mapped_column(Text, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project: Mapped[Project] = relationship(back_populates="timeline_entries")

    @staticmethod
    def new_id() -> str:
        return _generate_id("tl")


# ---------------------------------------------------------------------------
# Providers (LLM providers)
# ---------------------------------------------------------------------------


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    provider_type: Mapped[str] = mapped_column(Text, nullable=False)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(Text, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2000)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @staticmethod
    def new_id() -> str:
        return _generate_id("prov")

    __table_args__ = (Index("idx_providers_type", "provider_type"),)


# ---------------------------------------------------------------------------
# Agents ( LLM agent roles )
# ---------------------------------------------------------------------------


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    role: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    primary_provider_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("providers.id"), nullable=True
    )
    fallback_provider_ids: Mapped[list[str]] = mapped_column(
        JSONB, server_default="[]", default=list
    )
    settings_override: Mapped[dict] = mapped_column(
        JSONB, server_default="{}", default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @staticmethod
    def new_id() -> str:
        return _generate_id("agent")


# ---------------------------------------------------------------------------
# Usage Logs ( LLM usage tracking )
# ---------------------------------------------------------------------------


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(
        Text, ForeignKey("providers.id"), nullable=False
    )
    agent_role: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    fallback_position: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ---------------------------------------------------------------------------
# Activity Log
# ---------------------------------------------------------------------------


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    memory_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("memories.id", ondelete="SET NULL"), nullable=True
    )
    project_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default="{}", default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @staticmethod
    def new_id() -> str:
        return _generate_id("act")


# ---------------------------------------------------------------------------
# App Settings (key-value store)
# ---------------------------------------------------------------------------


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
