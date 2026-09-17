from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project


def _slugify(text: str, max_len: int = 50) -> str:
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    slug = slug.strip("-")
    return slug[:max_len]


def _normalize_path(path: str) -> str:
    value = path.strip().replace("\\", "/")
    if not value:
        return value

    unc = value.startswith("//")
    absolute = value.startswith("/") and not unc
    drive_match = re.match(r"^[A-Za-z]:", value)
    drive = drive_match.group(0) if drive_match else ""
    rest = value[len(drive):]
    if rest.startswith("/"):
        absolute = True
    parts: list[str] = []
    for part in rest.split("/"):
        if not part or part == ".":
            continue
        if part == ".." and parts and parts[-1] != "..":
            parts.pop()
            continue
        if part != ".." or not (absolute or drive or unc):
            parts.append(part)

    suffix = "/".join(parts)
    if drive:
        return f"{drive}/{suffix}" if suffix else f"{drive}/"
    if unc:
        return f"//{suffix}" if suffix else "//"
    if absolute:
        return f"/{suffix}" if suffix else "/"
    return suffix


async def detect_project(
    db: AsyncSession,
    path: str,
    worktree: str | None = None,
    name: str | None = None,
) -> Project:
    """Detect or create a project from a workspace path."""
    normalized = _normalize_path(worktree or path)
    if not normalized:
        raise ValueError("Project path cannot be empty")

    result = await db.execute(
        select(Project).where(func.lower(Project.workspace_path) == normalized.lower())
    )
    project = result.scalar_one_or_none()

    if project:
        project.last_active = datetime.now(timezone.utc)
        await db.flush()
        return project

    # Extract directory name for display and slug
    dir_name = normalized.rstrip("/").rsplit("/", 1)[-1] if "/" in normalized else normalized
    display = name or dir_name
    slug = _slugify(display)

    # Ensure unique ID
    existing = await db.execute(select(Project).where(Project.id == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{Project.new_id(slug)[-4:]}"

    project = Project(
        id=slug,
        display_name=display,
        workspace_path=normalized,
        tech_stack=[],
    )
    db.add(project)
    await db.flush()
    return project


async def list_projects(
    db: AsyncSession,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Project], int]:
    query = select(Project)
    if search:
        query = query.where(Project.display_name.ilike(f"%{search}%"))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Project.last_active.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_project(db: AsyncSession, project_id: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def update_project(
    db: AsyncSession,
    project_id: str,
    display_name: str | None = None,
    workspace_path: str | None = None,
    tech_stack: list[str] | None = None,
) -> Project | None:
    project = await get_project(db, project_id)
    if not project:
        return None
    if display_name is not None:
        project.display_name = display_name
    if workspace_path is not None:
        normalized = _normalize_path(workspace_path)
        if not normalized:
            raise ValueError("Project path cannot be empty")
        conflict = await db.execute(
            select(Project.id).where(
                func.lower(Project.workspace_path) == normalized.lower(),
                Project.id != project_id,
            )
        )
        if conflict.scalar_one_or_none():
            raise ValueError("Another project already uses this workspace path")
        project.workspace_path = normalized
    if tech_stack is not None:
        project.tech_stack = tech_stack
    project.last_active = datetime.now(timezone.utc)
    await db.flush()
    return project
