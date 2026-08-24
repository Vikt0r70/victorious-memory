"""Context builder — assembles a memory block for system prompt injection."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.context.schemas import ContextResponse
from app.domains.projects.service import get_project
from app.domains.search.service import hybrid_search
from app.models import Memory


async def build_context(
    db: AsyncSession,
    project_id: str | None = None,
    query: str | None = None,
    max_tokens: int = 1500,
) -> ContextResponse:
    """Build a context block for injection into the agent system prompt."""
    project = None
    project_name = None
    if project_id:
        project = await get_project(db, project_id)
        project_name = project.display_name if project else None

    sections: list[str] = []
    section_ids: list[list[str]] = []  # parallel list: memory IDs per section
    used_ids: set[str] = set()

    # --- Section 1: Project decisions ---
    if project_id:
        result = await db.execute(
            select(Memory)
            .where(
                Memory.project_id == project_id,
                Memory.memory_type.in_(["decision", "architecture", "constraint"]),
                Memory.status == "active",
            )
            .order_by(Memory.created_at.desc())
            .limit(8)
        )
        decisions = list(result.scalars().all())
        if decisions:
            lines = [f"[PROJECT: {project_name or project_id}]", "Decisions:"]
            ids_in_section = []
            for m in decisions:
                date_str = m.created_at.strftime("%Y-%m-%d") if m.created_at else "?"
                lines.append(f"  • {m.content} ({m.confidence_label}, {date_str})")
                ids_in_section.append(m.id)
                used_ids.add(m.id)
            sections.append("\n".join(lines))
            section_ids.append(ids_in_section)

    # --- Section 2: User preferences ---
    result = await db.execute(
        select(Memory)
        .where(
            Memory.scope == "global",
            Memory.memory_type == "preference",
            Memory.status == "active",
        )
        .order_by(Memory.access_count.desc())
        .limit(5)
    )
    preferences = list(result.scalars().all())
    if preferences:
        lines = ["[YOUR PREFERENCES]"]
        ids_in_section = []
        for m in preferences:
            lines.append(f"  • {m.content}")
            ids_in_section.append(m.id)
            used_ids.add(m.id)
        sections.append("\n".join(lines))
        section_ids.append(ids_in_section)

    # --- Section 3: Query-relevant memories ---
    if query and query.strip():
        try:
            results = await hybrid_search(
                db, query, project_id=project_id, top_k=5,
            )
            relevant = [r for r in results if r.memory.id not in used_ids]
            if relevant:
                lines = ["[RELEVANT TO THIS CONVERSATION]"]
                ids_in_section = []
                for r in relevant[:5]:
                    lines.append(f"  • ({r.memory.memory_type}) {r.memory.content}")
                    ids_in_section.append(r.memory.id)
                    used_ids.add(r.memory.id)
                sections.append("\n".join(lines))
                section_ids.append(ids_in_section)
        except Exception:
            pass  # Don't fail context if search fails

    # --- Assemble block ---
    if not sections:
        return ContextResponse(
            block="",
            memories_used=0,
            project_id=project_id,
            project_name=project_name,
        )

    block = "[VICTORIOUS MEMORY — project context and user knowledge]\n\n"
    block += "\n\n".join(sections)
    block += "\n\n[This context is auto-injected by Victorious Memory.]"

    # Token budget trimming
    estimated_tokens = len(block) / 4
    while estimated_tokens > max_tokens and sections:
        sections.pop()
        section_ids.pop()
        block = "[VICTORIOUS MEMORY — project context and user knowledge]\n\n"
        block += "\n\n".join(sections)
        block += "\n\n[This context is auto-injected by Victorious Memory.]"
        estimated_tokens = len(block) / 4

    # Rebuild memory_ids from remaining sections only
    memory_ids = [mid for ids in section_ids for mid in ids]

    # Update access stats
    if memory_ids:
        await db.execute(
            update(Memory)
            .where(Memory.id.in_(memory_ids))
            .values(
                last_accessed=datetime.now(timezone.utc),
                access_count=Memory.access_count + 1,
            )
        )
        await db.flush()

    return ContextResponse(
        block=block,
        memories_used=len(memory_ids),
        project_id=project_id,
        project_name=project_name,
    )
