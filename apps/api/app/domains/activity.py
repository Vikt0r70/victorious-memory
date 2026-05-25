"""Shared helper for creating activity-log entries."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog


async def log_activity(
    db: AsyncSession,
    event_type: str,
    description: str,
    memory_id: str | None = None,
    project_id: str | None = None,
    metadata: dict | None = None,
) -> ActivityLog:
    """Insert a new activity-log record and return it."""
    entry = ActivityLog(
        id=ActivityLog.new_id(),
        event_type=event_type,
        description=description,
        memory_id=memory_id,
        project_id=project_id,
        metadata_=metadata or {},
    )
    db.add(entry)
    await db.flush()
    return entry
