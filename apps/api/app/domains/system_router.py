"""System admin router — info, re-embed, update check, purge, export."""

from __future__ import annotations

import asyncio
import logging
import sys
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    ActivityLog,
    Exchange,
    ExtractionJob,
    Memory,
    MemoryEdge,
    Project,
    TimelineEntry,
    UsageLog,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/system", tags=["system"])

_start_time = time.time()


@router.get("/info")
async def system_info(db: AsyncSession = Depends(get_db)):
    # Table counts
    tables = {
        "memories": Memory,
        "edges": MemoryEdge,
        "exchanges": Exchange,
        "jobs": ExtractionJob,
        "projects": Project,
        "timeline_entries": TimelineEntry,
        "usage_logs": UsageLog,
        "activity_log": ActivityLog,
    }
    sizes = {}
    for name, model in tables.items():
        count = (await db.execute(select(func.count(model.id if hasattr(model, 'id') else model.key)))).scalar() or 0
        sizes[name] = count

    return {
        "version": "0.1.0",
        "uptime_seconds": round(time.time() - _start_time),
        "python_version": sys.version.split()[0],
        "database": {
            "table_sizes": sizes,
        },
        "embedding_model": "BAAI/bge-small-en-v1.5",
        "worker_status": "running",
    }


@router.post("/re-embed")
async def re_embed_all(db: AsyncSession = Depends(get_db)):
    """Re-generate embeddings for all memories. Runs in background."""
    from app.domains.search.embeddings import embed_text

    count = (await db.execute(select(func.count(Memory.id)))).scalar() or 0

    async def _do_reembed():
        from app.database import async_session
        async with async_session() as session:
            result = await session.execute(select(Memory))
            memories = result.scalars().all()
            updated = 0
            for m in memories:
                try:
                    m.embedding = await embed_text(m.content)
                    updated += 1
                except Exception as e:
                    logger.warning("Re-embed failed for %s: %s", m.id, e)
            await session.commit()
            logger.info("Re-embedded %d/%d memories", updated, len(memories))

    asyncio.create_task(_do_reembed())
    return {"status": "started", "count": count}


@router.get("/update-check")
async def update_check():
    """Check for available updates (placeholder — connect to GitHub releases later)."""
    return {
        "current_version": "0.1.0",
        "latest_version": "0.1.0",
        "update_available": False,
        "message": "Update check not yet connected to GitHub releases API.",
    }


@router.delete("/purge")
async def purge_all(
    confirm: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Delete ALL data from the system. Requires ?confirm=true."""
    if not confirm:
        raise HTTPException(400, "Add ?confirm=true to confirm data purge")

    # Delete in dependency order
    await db.execute(delete(UsageLog))
    await db.execute(delete(ActivityLog))
    await db.execute(delete(MemoryEdge))
    await db.execute(delete(ExtractionJob))
    await db.execute(delete(TimelineEntry))
    # Memories reference exchanges, so clear the FK first
    await db.execute(text("UPDATE memories SET source_exchange_id = NULL"))
    await db.execute(delete(Memory))
    await db.execute(delete(Exchange))
    await db.execute(delete(Project))
    await db.flush()

    return {"purged": True, "message": "All data deleted"}


@router.get("/export")
async def export_all(db: AsyncSession = Depends(get_db)):
    """Export all memories and projects as JSON."""
    memories = (await db.execute(select(Memory))).scalars().all()
    projects = (await db.execute(select(Project))).scalars().all()
    edges = (await db.execute(select(MemoryEdge))).scalars().all()

    return {
        "version": "0.1.0",
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "memories": [
            {
                "id": m.id,
                "content": m.content,
                "memory_type": m.memory_type,
                "scope": m.scope,
                "project_id": m.project_id,
                "confidence_score": m.confidence_score,
                "confidence_label": m.confidence_label,
                "status": m.status,
                "source_type": m.source_type,
                "tags": m.tags,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in memories
        ],
        "projects": [
            {
                "id": p.id,
                "display_name": p.display_name,
                "workspace_path": p.workspace_path,
                "tech_stack": p.tech_stack,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ],
        "edges": [
            {
                "id": e.id,
                "source_id": e.source_id,
                "target_id": e.target_id,
                "relation_type": e.relation_type,
                "description": e.description,
                "confidence": e.confidence,
            }
            for e in edges
        ],
    }
