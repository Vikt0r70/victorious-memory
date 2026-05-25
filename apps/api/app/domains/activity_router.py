from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ActivityLog

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("")
async def list_activity(
    limit: int = 50,
    event_type: str | None = None,
    project_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 200)
    query = select(ActivityLog)

    if event_type:
        query = query.where(ActivityLog.event_type == event_type)
    if project_id:
        query = query.where(ActivityLog.project_id == project_id)

    query = query.order_by(ActivityLog.created_at.desc()).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()

    return {
        "items": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "description": e.description,
                "memory_id": e.memory_id,
                "project_id": e.project_id,
                "metadata": e.metadata_,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]
    }
