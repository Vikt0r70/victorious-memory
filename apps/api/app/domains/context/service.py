"""Context builder — assembles a memory block for system prompt injection."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.context.schemas import ContextResponse
from app.domains.projects.service import get_project
from app.domains.search.service import hybrid_search
from app.models import Memory, MemoryEdge

# Content is truncated to this many chars to avoid bloating the context block
_CONTENT_MAX_CHARS = 200

# Minimum semantic score for Section 3 relevance results; below = noise
_RELEVANCE_SCORE_FLOOR = 0.40

# Causal edge types — shown as nested context in Section 3
_CAUSAL_EDGE_TYPES = {"depends_on", "caused_by", "fixed_by", "supersedes"}


def _fmt(content: str) -> str:
    """Return content truncated and single-lined for injection."""
    single = " ".join(content.split())
    if len(single) <= _CONTENT_MAX_CHARS:
        return single
    return single[:_CONTENT_MAX_CHARS] + "..."


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

    # Each section is a (text, ids, priority) tuple.
    # Priority: 4=core, 3=relevant, 2=project, 1=preferences
    # Lower-priority sections are trimmed first when over budget.
    sections: list[tuple[str, list[str], int]] = []
    used_ids: set[str] = set()

    # ─── Section 0: Pinned core (always-injected high-confidence global rules) ───
    # Priority 1: explicitly pinned memories (user-controlled dashboard toggle)
    # Priority 2: fallback to top high-confidence global rules (original behavior)
    result = await db.execute(
        select(Memory)
        .where(
            Memory.scope == "global",
            Memory.memory_type.in_(["decision", "preference", "constraint"]),
            Memory.status == "active",
            Memory.confidence_label == "high",
        )
        .order_by(
            Memory.pinned.desc(),  # pinned memories first
            Memory.confidence_score.desc(),
            Memory.created_at.asc(),
        )
        .limit(5)
    )
    core = list(result.scalars().all())
    if core:
        lines = ["[CORE RULES — always apply]"]
        ids_in_section: list[str] = []
        for m in core:
            lines.append(f"  • ({m.memory_type}) {_fmt(m.content)}")
            ids_in_section.append(m.id)
            used_ids.add(m.id)  # A1: track Section 0 so Section 2 won't duplicate
        sections.append(("\n".join(lines), ids_in_section, 4))

    # ─── Section 1: Project decisions ───
    if project_id:
        result = await db.execute(
            select(Memory)
            .where(
                Memory.project_id == project_id,
                Memory.memory_type.in_(["decision", "architecture", "constraint"]),
                Memory.status == "active",
            )
            .order_by(Memory.confidence_score.desc(), Memory.created_at.asc())
            .limit(8)
        )
        decisions = list(result.scalars().all())
        if decisions:
            lines = [f"[PROJECT: {project_name or project_id}]", "Decisions:"]
            ids_in_section = []
            for m in decisions:
                date_str = m.created_at.strftime("%Y-%m-%d") if m.created_at else "?"
                if m.id not in used_ids:
                    lines.append(f"  • {_fmt(m.content)} ({m.confidence_label}, {date_str})")
                    ids_in_section.append(m.id)
                    used_ids.add(m.id)
            if ids_in_section:
                sections.append(("\n".join(lines), ids_in_section, 2))

    # ─── Section 2: User preferences (A1: exclude already-injected ids) ───
    result = await db.execute(
        select(Memory)
        .where(
            Memory.scope == "global",
            Memory.memory_type == "preference",
            Memory.status == "active",
            Memory.id.notin_(used_ids),  # A1: skip anything already in Section 0
        )
        .order_by(Memory.confidence_score.desc(), Memory.created_at.asc())
        .limit(5)
    )
    preferences = list(result.scalars().all())
    if preferences:
        lines = ["[YOUR PREFERENCES]"]
        ids_in_section = []
        for m in preferences:
            lines.append(f"  • {_fmt(m.content)}")
            ids_in_section.append(m.id)
            used_ids.add(m.id)
        sections.append(("\n".join(lines), ids_in_section, 1))

    # ─── Section 3: Query-relevant memories (A2: score floor, D: graph expansion) ───
    if query and query.strip():
        try:
            results = await hybrid_search(
                db, query, project_id=project_id, top_k=5,
            )
            # A2: only include results above the relevance floor
            relevant = [
                r for r in results
                if r.memory.id not in used_ids and r.semantic_score >= _RELEVANCE_SCORE_FLOOR
            ]
            if relevant:
                lines = ["[RELEVANT TO THIS CONVERSATION]"]
                ids_in_section = []
                for r in relevant[:5]:
                    lines.append(f"  • ({r.memory.memory_type}) {_fmt(r.memory.content)}")
                    ids_in_section.append(r.memory.id)
                    used_ids.add(r.memory.id)

                    # D1: 1-hop causal graph expansion — show up to 2 neighbors
                    try:
                        edge_result = await db.execute(
                            select(MemoryEdge, Memory)
                            .join(Memory, MemoryEdge.target_id == Memory.id)
                            .where(
                                MemoryEdge.source_id == r.memory.id,
                                MemoryEdge.relation_type.in_(_CAUSAL_EDGE_TYPES),
                                MemoryEdge.confidence >= 0.80,
                                Memory.status == "active",
                                Memory.id.notin_(used_ids),
                            )
                            .order_by(MemoryEdge.confidence.desc())
                            .limit(2)
                        )
                        for edge, neighbor in edge_result.all():
                            lines.append(
                                f"    ↳ [{edge.relation_type}] {_fmt(neighbor.content)}"
                            )
                            ids_in_section.append(neighbor.id)
                            used_ids.add(neighbor.id)
                    except Exception:
                        pass  # Graph expansion is best-effort

                sections.append(("\n".join(lines), ids_in_section, 3))
        except Exception:
            pass  # Don't fail context if search fails

    # ─── Assemble block ───
    if not sections:
        return ContextResponse(
            block="",
            memories_used=0,
            project_id=project_id,
            project_name=project_name,
            memory_ids=[],
        )

    def _build_block(secs: list[tuple[str, list[str], int]]) -> str:
        texts = [s[0] for s in secs]
        return (
            "[VICTORIOUS MEMORY — project context and user knowledge]\n\n"
            + "\n\n".join(texts)
            + "\n\n[This context is auto-injected by Victorious Memory.]"
        )

    block = _build_block(sections)

    # C1: Priority-weighted granular trimming
    # Evict individual memories from lowest-priority sections first.
    # Never evict the entire Section 0 (priority 4) or Section 3 (priority 3).
    estimated_tokens = len(block) / 4
    if estimated_tokens > max_tokens:
        # Sort by priority ascending so we trim lowest-priority first
        sections_by_priority = sorted(enumerate(sections), key=lambda x: x[1][2])
        for orig_idx, (text, ids, priority) in sections_by_priority:
            if estimated_tokens <= max_tokens:
                break
            # Never trim core (4) or relevant (3) sections entirely
            if priority >= 3:
                continue
            # Remove the section entirely
            sections[orig_idx] = ("", [], priority)
            block = _build_block([s for s in sections if s[1]])
            estimated_tokens = len(block) / 4

        # If still over budget, start removing individual entries from Section 3
        # (relevant section) from the bottom up
        if estimated_tokens > max_tokens:
            for orig_idx, (text, ids, priority) in enumerate(sections):
                if priority == 3 and ids:
                    # Remove last entry from relevant section
                    lines = text.split("\n")
                    if len(lines) > 2:
                        lines = lines[:-1]
                        sections[orig_idx] = ("\n".join(lines), ids[:-1], priority)
                        block = _build_block([s for s in sections if s[1]])
                        estimated_tokens = len(block) / 4
                    if estimated_tokens <= max_tokens:
                        break

    # Filter out emptied sections
    sections = [s for s in sections if s[1]]
    block = _build_block(sections) if sections else ""

    # Rebuild memory_ids from remaining sections
    memory_ids = [mid for _, ids, _ in sections for mid in ids]

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
        memory_ids=memory_ids,
    )
