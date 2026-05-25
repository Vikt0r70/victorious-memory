from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.domains.projects.schemas import (
    ProjectDetectRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.domains.projects.service import (
    detect_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/detect", response_model=ProjectResponse)
async def detect(req: ProjectDetectRequest, db: AsyncSession = Depends(get_db)):
    project = await detect_project(db, req.path, req.worktree, req.name)
    return project


@router.get("", response_model=dict)
async def list_all(
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_projects(db, search, page, per_page)
    return {
        "items": [ProjectResponse.model_validate(p) for p in items],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_one(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update(
    project_id: str,
    req: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await update_project(db, project_id, req.display_name, req.tech_stack)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/{project_id}/timeline")
async def get_timeline(
    project_id: str,
    limit: int = 50,
    entry_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get project timeline entries."""
    from sqlalchemy import select
    from app.models import TimelineEntry

    query = select(TimelineEntry).where(TimelineEntry.project_id == project_id)
    if entry_type:
        query = query.where(TimelineEntry.entry_type == entry_type)
    query = query.order_by(TimelineEntry.created_at.desc()).limit(limit)

    result = await db.execute(query)
    entries = result.scalars().all()
    return {
        "items": [
            {
                "id": e.id,
                "project_id": e.project_id,
                "entry_type": e.entry_type,
                "title": e.title,
                "description": e.description,
                "memory_ids": e.memory_ids,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
            }
            for e in entries
        ]
    }


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    cascade: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Delete a project. If cascade=true, also delete its memories."""
    from sqlalchemy import delete, select, update as sql_update
    from app.models import Memory, Exchange, TimelineEntry

    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    if cascade:
        # Delete project's memories (edges cascade automatically)
        await db.execute(delete(Memory).where(Memory.project_id == project_id))
    else:
        # Unlink memories from project
        await db.execute(
            sql_update(Memory).where(Memory.project_id == project_id).values(project_id=None)
        )

    # Clean up related records
    await db.execute(delete(TimelineEntry).where(TimelineEntry.project_id == project_id))
    await db.execute(
        sql_update(Exchange).where(Exchange.project_id == project_id).values(project_id=None)
    )

    await db.delete(project)
    await db.flush()
