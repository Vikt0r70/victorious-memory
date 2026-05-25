"""Hybrid search service — semantic + BM25 fusion."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select, text as sa_text

from app.database import async_session
from app.models import Memory

from .bm25 import bm25_rank
from .embeddings import embed_text


@dataclass
class SearchResult:
    """A single search result with component and combined scores."""

    memory_id: str
    memory: Memory
    semantic_score: float
    bm25_score: float
    combined_score: float


async def hybrid_search(
    db_or_query,
    query: str | None = None,
    *,
    project_id: str | None = None,
    scope_filter: str | None = None,
    top_k: int = 10,
    status_filter: list[str] | None = None,
) -> list[SearchResult]:
    """Run hybrid (semantic + BM25) search over memories.

    Can be called as:
        hybrid_search(db, "query", project_id=...)  — uses existing session
        hybrid_search("query", project_id=...)       — creates own session

    1. Embed the query text.
    2. pgvector cosine-distance retrieval with filters (top_k * 3 candidates).
    3. BM25 re-rank the candidates.
    4. Fuse scores: ``combined = 0.7 * semantic + 0.3 * bm25``.
    5. Return the top *top_k* results sorted by combined score.
    """
    from sqlalchemy.ext.asyncio import AsyncSession as _AsyncSession

    # Handle flexible calling convention
    if isinstance(db_or_query, _AsyncSession):
        _db = db_or_query
        _query = query or ""
        _owns_session = False
    else:
        _query = str(db_or_query)
        _db = None
        _owns_session = True

    if status_filter is None:
        status_filter = ["active"]

    # Step 1 — embed query
    query_vector = await embed_text(_query)
    candidate_limit = top_k * 3

    # Step 2 — semantic retrieval via pgvector
    if _owns_session:
        _session_ctx = async_session()
        session = await _session_ctx.__aenter__()
    else:
        session = _db
        _session_ctx = None

    try:
        # Build base query using pgvector <=> (cosine distance)
        stmt = (
            select(
                Memory,
                Memory.embedding.cosine_distance(query_vector).label("distance"),
            )
            .where(Memory.embedding.isnot(None))
            .where(Memory.status.in_(status_filter))
        )

        if project_id is not None:
            stmt = stmt.where(Memory.project_id == project_id)

        if scope_filter is not None:
            stmt = stmt.where(Memory.scope == scope_filter)

        stmt = stmt.order_by("distance").limit(candidate_limit)

        result = await session.execute(stmt)
        rows = result.all()
    finally:
        if _session_ctx is not None:
            await _session_ctx.__aexit__(None, None, None)

    if not rows:
        return []

    # Convert cosine distance to similarity score (distance is 1 - cosine_sim)
    candidates: list[tuple[Memory, float]] = []
    for memory, distance in rows:
        semantic_score = max(0.0, 1.0 - float(distance))
        candidates.append((memory, semantic_score))

    # Step 3 — BM25 re-rank
    doc_list: list[tuple[str, str]] = [
        (mem.id, mem.content) for mem, _ in candidates
    ]
    bm25_scores = dict(bm25_rank(_query, doc_list))

    # Step 4 — fuse scores
    fused: list[SearchResult] = []
    for memory, semantic_score in candidates:
        bm25_score = bm25_scores.get(memory.id, 0.0)
        combined = 0.7 * semantic_score + 0.3 * bm25_score
        fused.append(
            SearchResult(
                memory_id=memory.id,
                memory=memory,
                semantic_score=round(semantic_score, 4),
                bm25_score=round(bm25_score, 4),
                combined_score=round(combined, 4),
            )
        )

    # Step 5 — sort and truncate
    fused.sort(key=lambda r: r.combined_score, reverse=True)
    return fused[:top_k]

