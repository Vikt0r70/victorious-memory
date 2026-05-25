"""Raw exchanges viewer router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Exchange, ExtractionJob, Memory

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


@router.get("")
async def list_exchanges(
    project_id: str | None = None,
    session_id: str | None = None,
    page: int = 1,
    per_page: int = 50,
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_db),
):
    query = select(Exchange)
    if project_id:
        query = query.where(Exchange.project_id == project_id)
    if session_id:
        query = query.where(Exchange.session_id == session_id)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    if sort_order == "asc":
        query = query.order_by(Exchange.created_at.asc())
    else:
        query = query.order_by(Exchange.created_at.desc())

    query = query.offset((page - 1) * per_page).limit(per_page)
    query = query.options(selectinload(Exchange.produced_memories))
    result = await db.execute(query)
    exchanges = result.scalars().all()

    return {
        "items": [
            {
                "id": e.id,
                "session_id": e.session_id,
                "project_id": e.project_id,
                "user_content": e.user_content,
                "agent_parts": e.agent_parts,
                "file_paths": e.file_paths,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "produced_memory_count": len(e.produced_memories) if e.produced_memories else 0,
            }
            for e in exchanges
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{exchange_id}")
async def get_exchange(exchange_id: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(Exchange)
        .where(Exchange.id == exchange_id)
        .options(
            selectinload(Exchange.produced_memories),
            selectinload(Exchange.jobs),
        )
    )
    result = await db.execute(query)
    exc = result.scalar_one_or_none()
    if not exc:
        raise HTTPException(404, "Exchange not found")

    return {
        "id": exc.id,
        "session_id": exc.session_id,
        "project_id": exc.project_id,
        "user_content": exc.user_content,
        "agent_parts": exc.agent_parts,
        "file_paths": exc.file_paths,
        "created_at": exc.created_at.isoformat() if exc.created_at else None,
        "produced_memories": [
            {
                "id": m.id,
                "content": m.content,
                "memory_type": m.memory_type,
                "scope": m.scope,
                "confidence_label": m.confidence_label,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in (exc.produced_memories or [])
        ],
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "attempts": j.attempts,
                "error": j.error,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            }
            for j in (exc.jobs or [])
        ],
    }
