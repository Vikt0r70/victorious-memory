"""Hybrid search service — semantic + BM25 fusion."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, text as sa_text

from app.database import async_session
from app.models import Memory

from .bm25 import bm25_rank
from .embeddings import embed_text

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single search result with component scores, RRF fusion, and freshness."""

    memory_id: str
    memory: Memory
    semantic_score: float
    bm25_score: float
    combined_score: float
    rrf_score: float
    semantic_rank: int
    bm25_rank: int
    freshness: float


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
    4. Fuse via Reciprocal Rank Fusion (RRF, k=60) with freshness decay.
    5. Return the top *top_k* results sorted by combined RRF×freshness score.
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
    _t0 = time.perf_counter()
    query_vector = await embed_text(_query)
    _t1 = time.perf_counter()
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
        _t2 = time.perf_counter()
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
    _t3 = time.perf_counter()
    logger.info(
        "hybrid_search timings: embed=%.0fms db=%.0fms bm25=%.0fms total=%.0fms candidates=%d",
        (_t1 - _t0) * 1000,
        (_t2 - _t1) * 1000,
        (_t3 - _t2) * 1000,
        (_t3 - _t0) * 1000,
        len(candidates),
    )

    # Step 4 — RRF (Reciprocal Rank Fusion) + freshness decay
    RRF_K = 60  # standard constant — balances rank vs score influence

    # Compute ranks for each retrieval method
    semantic_order = sorted(range(len(candidates)), key=lambda i: candidates[i][1], reverse=True)
    semantic_ranks = {idx: rank + 1 for rank, idx in enumerate(semantic_order)}

    bm25_order = sorted(bm25_scores.keys(), key=lambda mid: bm25_scores[mid], reverse=True)
    bm25_ranks = {mid: rank + 1 for rank, mid in enumerate(bm25_order)}

    # Types that represent stable knowledge — never decay with age
    STABLE_TYPES = {"decision", "preference", "constraint", "architecture", "reference"}

    def _freshness(mem: Memory) -> float:
        if mem.memory_type in STABLE_TYPES:
            return 1.0
        updated = getattr(mem, "updated_at", None)
        if not updated:
            return 0.7
        now = datetime.now(timezone.utc) if updated.tzinfo else datetime.utcnow()
        days_old = max(0, (now - updated).days)
        return max(0.5, 1.0 - (days_old / 730.0))

    fused: list[SearchResult] = []
    for i, (memory, semantic_score) in enumerate(candidates):
        bm25_score = bm25_scores.get(memory.id, 0.0)
        s_rank = semantic_ranks.get(i, len(candidates))
        b_rank = bm25_ranks.get(memory.id, len(bm25_ranks) + 1)
        rrf = (1.0 / (RRF_K + s_rank)) + (1.0 / (RRF_K + b_rank))
        fresh = _freshness(memory)
        combined = rrf * fresh
        fused.append(
            SearchResult(
                memory_id=memory.id,
                memory=memory,
                semantic_score=round(semantic_score, 4),
                bm25_score=round(bm25_score, 4),
                combined_score=round(combined, 6),
                rrf_score=round(rrf, 6),
                semantic_rank=s_rank,
                bm25_rank=b_rank,
                freshness=round(fresh, 4),
            )
        )

    fused.sort(key=lambda r: r.combined_score, reverse=True)
    return fused[:top_k]

