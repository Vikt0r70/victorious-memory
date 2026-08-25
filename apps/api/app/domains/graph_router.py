"""Knowledge graph edges and visualization router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Memory, MemoryEdge
from app.domains.edges.service import detect_edges

router = APIRouter(tags=["graph"])


# ── Schemas ────────────────────────────────────────────────────────────────

class EdgeCreateRequest(BaseModel):
    source_id: str
    target_id: str
    relation_type: str
    description: str | None = None
    confidence: float = 0.8


# ── Helpers ────────────────────────────────────────────────────────────────

def _memory_summary(m: Memory) -> dict:
    return {
        "id": m.id,
        "content": m.content,
        "memory_type": m.memory_type,
        "scope": m.scope,
        "status": m.status,
        "confidence_label": m.confidence_label,
    }


def _edge_dict(e: MemoryEdge, source: Memory | None = None, target: Memory | None = None) -> dict:
    d = {
        "id": e.id,
        "source_id": e.source_id,
        "target_id": e.target_id,
        "relation_type": e.relation_type,
        "description": e.description,
        "confidence": e.confidence,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }
    if source:
        d["source"] = _memory_summary(source)
    if target:
        d["target"] = _memory_summary(target)
    return d


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/edges")
async def list_edges(
    memory_id: str | None = None,
    relation_type: str | None = None,
    project_id: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(MemoryEdge)
        .options(selectinload(MemoryEdge.source), selectinload(MemoryEdge.target))
    )

    if memory_id:
        query = query.where(
            or_(MemoryEdge.source_id == memory_id, MemoryEdge.target_id == memory_id)
        )
    if relation_type:
        query = query.where(MemoryEdge.relation_type == relation_type)

    query = query.order_by(MemoryEdge.created_at.desc()).limit(limit)
    result = await db.execute(query)
    edges = result.scalars().all()

    # If project_id filter, post-filter by source/target project
    if project_id:
        edges = [
            e for e in edges
            if (e.source and e.source.project_id == project_id)
            or (e.target and e.target.project_id == project_id)
        ]

    return {
        "items": [_edge_dict(e, e.source, e.target) for e in edges]
    }


@router.get("/graph")
async def get_graph(
    project_id: str | None = None,
    scope: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    # Get memories matching filters
    mem_q = select(Memory).where(Memory.status.in_(["active", "pending_review"]))
    if project_id:
        mem_q = mem_q.where(Memory.project_id == project_id)
    if scope:
        mem_q = mem_q.where(Memory.scope == scope)
    mem_q = mem_q.order_by(Memory.access_count.desc()).limit(limit)

    result = await db.execute(mem_q)
    memories = result.scalars().all()
    mem_ids = {m.id for m in memories}

    if not mem_ids:
        return {"nodes": [], "edges": []}

    # Get all edges between these memories
    edge_q = (
        select(MemoryEdge)
        .where(
            MemoryEdge.source_id.in_(mem_ids),
            MemoryEdge.target_id.in_(mem_ids),
        )
    )
    result = await db.execute(edge_q)
    edges = result.scalars().all()

    return {
        "nodes": [_memory_summary(m) for m in memories],
        "edges": [
            {
                "id": e.id,
                "source": e.source_id,
                "target": e.target_id,
                "relation_type": e.relation_type,
                "description": e.description,
                "confidence": e.confidence,
            }
            for e in edges
        ],
    }


@router.post("/edges", status_code=201)
async def create_edge(req: EdgeCreateRequest, db: AsyncSession = Depends(get_db)):
    # Validate source exists
    src = (await db.execute(select(Memory).where(Memory.id == req.source_id))).scalar_one_or_none()
    if not src:
        raise HTTPException(404, f"Source memory {req.source_id} not found")

    tgt = (await db.execute(select(Memory).where(Memory.id == req.target_id))).scalar_one_or_none()
    if not tgt:
        raise HTTPException(404, f"Target memory {req.target_id} not found")

    # Check for duplicate
    existing = (
        await db.execute(
            select(MemoryEdge).where(
                MemoryEdge.source_id == req.source_id,
                MemoryEdge.target_id == req.target_id,
                MemoryEdge.relation_type == req.relation_type,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Edge already exists between these memories with this relation type")

    edge = MemoryEdge(
        id=MemoryEdge.new_id(),
        source_id=req.source_id,
        target_id=req.target_id,
        relation_type=req.relation_type,
        description=req.description,
        confidence=req.confidence,
    )
    db.add(edge)
    await db.flush()

    return _edge_dict(edge, src, tgt)


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(edge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MemoryEdge).where(MemoryEdge.id == edge_id))
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(404, "Edge not found")
    await db.delete(edge)
    await db.flush()


@router.post("/edges/detect")
async def run_edge_detection(
    project_id: str | None = None,
    max_pairs: int = 200,
    db: AsyncSession = Depends(get_db),
):
    """Run edge detection: find relationships between memories via vector candidates + LLM."""
    result = await detect_edges(db, project_id=project_id, max_pairs=max_pairs)
    return result
