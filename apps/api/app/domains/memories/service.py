"""Memory CRUD service."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.extraction.schemas import ValidatedCandidate
from app.domains.search.embeddings import embed_text
from app.models import Exchange, Memory, Project

logger = logging.getLogger(__name__)


def _confidence_label(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"


async def create_memory_from_candidate(
    db: AsyncSession,
    candidate: ValidatedCandidate,
    exchange: Exchange,
) -> Memory:
    """Create a memory from a validated extraction candidate."""
    try:
        embedding = await embed_text(candidate.content)
    except Exception:
        embedding = None

    memory = Memory(
        id=Memory.new_id(),
        content=candidate.content,
        memory_type=candidate.memory_type,
        scope=candidate.scope,
        project_id=exchange.project_id if candidate.scope == "project" else None,
        confidence_score=candidate.confidence_score,
        confidence_label=candidate.confidence_label,
        confidence_reasoning=candidate.confidence_reasoning,
        status=candidate.status,
        auto_approved=candidate.auto_approved,
        source_type=candidate.source_type,
        source_session=exchange.session_id,
        source_exchange_id=exchange.id,
        dynamic_tag="[EXTRACTED]",
        tags=candidate.tags,
        embedding=embedding,
    )
    db.add(memory)
    await db.flush()
    return memory


async def create_memory_manual(
    db: AsyncSession,
    content: str,
    memory_type: str = "reference",
    scope: str = "global",
    project_id: str | None = None,
    confidence_score: float = 0.8,
    tags: list[str] | None = None,
    source_type: str | None = None,
) -> Memory:
    """Manually create a memory via API."""
    try:
        embedding = await embed_text(content)
    except Exception:
        embedding = None

    # Verify project exists if provided; auto-detect / auto-create or fall back gracefully
    resolved_project_id = None
    if project_id:
        proj_slug = project_id.strip()
        # Direct lookup (case-sensitive and lowercase)
        proj_res = await db.execute(
            select(Project.id).where(
                (Project.id == proj_slug) | (Project.id == proj_slug.lower()) | (func.lower(Project.display_name) == proj_slug.lower())
            )
        )
        found = proj_res.scalar_one_or_none()
        if found:
            resolved_project_id = found
        else:
            # Auto-create the project so foreign key constraint never fails
            new_proj = Project(
                id=proj_slug.lower(),
                display_name=proj_slug,
                workspace_path=f"manual/{proj_slug.lower()}",
                tech_stack=[],
            )
            db.add(new_proj)
            await db.flush()
            resolved_project_id = new_proj.id

    memory = Memory(
        id=Memory.new_id(),
        content=content,
        memory_type=memory_type,
        scope=scope,
        project_id=resolved_project_id,
        confidence_score=confidence_score,
        confidence_label=_confidence_label(confidence_score),
        status="active",
        auto_approved=False,
        source_type=source_type,
        dynamic_tag="[MANUAL]",
        tags=tags or [],
        embedding=embedding,
    )
    db.add(memory)
    await db.flush()
    return memory


async def get_memory(db: AsyncSession, memory_id: str) -> Memory | None:
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    return result.scalar_one_or_none()


async def update_memory(
    db: AsyncSession, memory_id: str, **kwargs
) -> Memory | None:
    memory = await get_memory(db, memory_id)
    if not memory:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(memory, key):
            setattr(memory, key, value)

    # Re-embed if content changed
    if "content" in kwargs and kwargs["content"]:
        try:
            memory.embedding = await embed_text(memory.content)
        except Exception:
            pass

    # Update confidence label if score changed
    if "confidence_score" in kwargs:
        memory.confidence_label = _confidence_label(memory.confidence_score)

    memory.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return memory


async def approve_memory(db: AsyncSession, memory_id: str) -> Memory | None:
    memory = await get_memory(db, memory_id)
    if not memory:
        return None
    memory.status = "active"
    memory.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return memory


async def reject_memory(
    db: AsyncSession, memory_id: str, reason: str = ""
) -> Memory | None:
    memory = await get_memory(db, memory_id)
    if not memory:
        return None
    memory.status = "rejected"
    memory.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return memory


async def delete_memory(db: AsyncSession, memory_id: str) -> bool:
    memory = await get_memory(db, memory_id)
    if not memory:
        return False
    await db.delete(memory)
    await db.flush()
    return True


async def list_memories(
    db: AsyncSession,
    project_id: str | None = None,
    scope: str | None = None,
    memory_type: str | None = None,
    status: str | None = None,
    confidence_label: str | None = None,
    search: str | None = None,
    created_after: str | None = None,
    created_before: str | None = None,
    page: int = 1,
    per_page: int = 50,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[list[Memory], int]:
    query = select(Memory)

    if project_id:
        query = query.where(Memory.project_id == project_id)
    if scope:
        query = query.where(Memory.scope == scope)
    if memory_type:
        query = query.where(Memory.memory_type == memory_type)
    if status:
        query = query.where(Memory.status == status)
    if confidence_label:
        query = query.where(Memory.confidence_label == confidence_label)
    if search:
        query = query.where(Memory.content.ilike(f"%{search}%"))
    if created_after:
        query = query.where(Memory.created_at >= created_after)
    if created_before:
        query = query.where(Memory.created_at <= created_before)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    sort_col = getattr(Memory, sort_by, Memory.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_recent_memories(
    db: AsyncSession,
    project_id: str | None = None,
    limit: int = 20,
) -> list[Memory]:
    query = select(Memory).where(Memory.status.in_(["active", "pending_review"]))
    if project_id:
        query = query.where(Memory.project_id == project_id)
    query = query.order_by(Memory.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_memories_by_scope_type(
    db: AsyncSession,
    scope: str,
    memory_type: str,
    limit: int = 10,
) -> list[Memory]:
    query = (
        select(Memory)
        .where(Memory.scope == scope, Memory.memory_type == memory_type, Memory.status == "active")
        .order_by(Memory.access_count.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return list(result.scalars().all())
