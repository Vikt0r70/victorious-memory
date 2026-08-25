from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.domains.activity import log_activity
from app.domains.memories.schemas import (
    BulkActionRequest,
    MemoryCreateRequest,
    MemoryListResponse,
    MemoryResponse,
    MemoryUpdateRequest,
    SearchRequest,
)
from app.domains.memories.service import (
    approve_memory,
    create_memory_manual,
    delete_memory,
    get_memory,
    list_memories,
    reject_memory,
    update_memory,
)
from app.domains.search.service import hybrid_search

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=MemoryListResponse)
async def list_all(
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
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_memories(
        db,
        project_id=project_id,
        scope=scope,
        memory_type=memory_type,
        status=status,
        confidence_label=confidence_label,
        search=search,
        created_after=created_after,
        created_before=created_before,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return MemoryListResponse(
        items=[MemoryResponse.model_validate(m) for m in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=MemoryResponse, status_code=201)
async def create(req: MemoryCreateRequest, db: AsyncSession = Depends(get_db)):
    mem = await create_memory_manual(
        db, req.content, req.memory_type, req.scope,
        req.project_id, req.confidence_score, req.tags, req.source_type,
    )
    await log_activity(db, "memory_created", f"Manual: {mem.content[:100]}", memory_id=mem.id, project_id=mem.project_id)
    return mem


@router.get("/stats")
async def memory_stats(
    project_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Aggregate counts for dashboard charts."""
    from sqlalchemy import func, select as sel
    from app.models import Memory as M

    base = sel(M.id)
    if project_id:
        base = base.where(M.project_id == project_id)

    total = (await db.execute(sel(func.count()).select_from(base.subquery()))).scalar() or 0

    # By type
    type_q = sel(M.memory_type, func.count(M.id)).group_by(M.memory_type)
    if project_id:
        type_q = type_q.where(M.project_id == project_id)
    by_type = dict((await db.execute(type_q)).all())

    # By scope
    scope_q = sel(M.scope, func.count(M.id)).group_by(M.scope)
    if project_id:
        scope_q = scope_q.where(M.project_id == project_id)
    by_scope = dict((await db.execute(scope_q)).all())

    # By status
    status_q = sel(M.status, func.count(M.id)).group_by(M.status)
    if project_id:
        status_q = status_q.where(M.project_id == project_id)
    by_status = dict((await db.execute(status_q)).all())

    return {
        "total": total,
        "by_type": by_type,
        "by_scope": by_scope,
        "by_status": by_status,
    }


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_one(memory_id: str, db: AsyncSession = Depends(get_db)):
    mem = await get_memory(db, memory_id)
    if not mem:
        raise HTTPException(404, "Memory not found")
    return mem


@router.post("/audit-embeddings")
async def audit_embeddings(db: AsyncSession = Depends(get_db)):
    """Find and re-embed memories with null or all-zero embeddings."""
    from sqlalchemy import select, update
    from app.models import Memory
    from app.domains.search.embeddings import embed_text

    result = await db.execute(
        select(Memory.id, Memory.content, Memory.embedding).where(Memory.status != "rejected")
    )
    rows = result.all()

    zero_ids: list[tuple[str, str]] = []
    for row in rows:
        mid, content, embedding = row[0], row[1], row[2]
        if not embedding or all(v == 0.0 for v in embedding):
            zero_ids.append((mid, content))

    fixed = 0
    for mid, content in zero_ids:
        try:
            new_embedding = await embed_text(content)
            await db.execute(
                update(Memory).where(Memory.id == mid).values(embedding=new_embedding)
            )
            fixed += 1
        except Exception:
            pass

    await db.flush()
    return {"audited": len(rows), "zero_vectors_found": len(zero_ids), "re_embedded": fixed}
@router.post("/search")
async def search_memories(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    results = await hybrid_search(
        db, req.query, project_id=req.project_id, top_k=req.top_k,
    )
    return {
        "items": [
            {
                "memory": MemoryResponse.model_validate(r.memory),
                "score": r.combined_score,
                "rrf_score": r.rrf_score,
                "semantic_rank": r.semantic_rank,
                "bm25_rank": r.bm25_rank,
                "freshness": r.freshness,
            }
            for r in results
        ]
    }


@router.post("/bulk")
async def bulk_action(req: BulkActionRequest, db: AsyncSession = Depends(get_db)):
    count = 0
    for mid in req.ids:
        if req.action == "approve":
            if await approve_memory(db, mid):
                count += 1
        elif req.action == "reject":
            if await reject_memory(db, mid, req.reason):
                count += 1
        elif req.action == "delete":
            if await delete_memory(db, mid):
                count += 1
    return {"affected": count}


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update(
    memory_id: str, req: MemoryUpdateRequest, db: AsyncSession = Depends(get_db),
):
    updates = req.model_dump(exclude_none=True)
    mem = await update_memory(db, memory_id, **updates)
    if not mem:
        raise HTTPException(404, "Memory not found")
    return mem


@router.delete("/{memory_id}", status_code=204)
async def delete(memory_id: str, db: AsyncSession = Depends(get_db)):
    if not await delete_memory(db, memory_id):
        raise HTTPException(404, "Memory not found")


@router.post("/{memory_id}/approve", response_model=MemoryResponse)
async def approve(memory_id: str, db: AsyncSession = Depends(get_db)):
    mem = await approve_memory(db, memory_id)
    if not mem:
        raise HTTPException(404, "Memory not found")
    await log_activity(db, "memory_approved", f"Approved: {mem.content[:100]}", memory_id=mem.id)
    return mem


@router.post("/{memory_id}/reject", response_model=MemoryResponse)
async def reject(
    memory_id: str,
    body: dict | None = None,
    db: AsyncSession = Depends(get_db),
):
    reason = (body or {}).get("reason", "")
    mem = await reject_memory(db, memory_id, reason)
    if not mem:
        raise HTTPException(404, "Memory not found")
    await log_activity(
        db, "memory_rejected", f"Rejected: {mem.content[:100]}",
        memory_id=mem.id, metadata={"reason": reason},
    )
    return mem


