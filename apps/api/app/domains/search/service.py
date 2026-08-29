"""Hybrid search service — semantic + Postgres FTS dual-channel fusion."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Memory

from .embeddings import embed_text

logger = logging.getLogger(__name__)

# RRF constant — standard value that balances rank vs score influence
_RRF_K = 60

# Stable memory types — never decay with age
_STABLE_TYPES = {"decision", "preference", "constraint", "architecture", "reference"}


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


def _freshness(mem: Memory) -> float:
    """Return a [0.5, 1.0] freshness multiplier based on memory age."""
    if mem.memory_type in _STABLE_TYPES:
        return 1.0
    updated = getattr(mem, "updated_at", None)
    if not updated:
        return 0.7
    now = datetime.now(timezone.utc) if updated.tzinfo else datetime.utcnow()
    days_old = max(0, (now - updated).days)
    return max(0.5, 1.0 - (days_old / 730.0))


async def hybrid_search(
    db_or_query,
    query: str | None = None,
    *,
    project_id: str | None = None,
    scope_filter: str | None = None,
    top_k: int = 10,
    status_filter: list[str] | None = None,
) -> list[SearchResult]:
    """Run true dual-channel hybrid search over memories.

    Can be called as:
        hybrid_search(db, "query", project_id=...)  — uses existing session
        hybrid_search("query", project_id=...)       — creates own session

    Architecture:
        Channel A: pgvector HNSW cosine similarity  → top_k*3 candidates
        Channel B: Postgres FTS (tsvector GIN index) → top_k*3 candidates
        Union A∪B, compute RRF(A_rank, B_rank) × freshness, return top_k.

    Unlike the old design, Channel B is NOT gated by Channel A, so exact
    keyword matches (error codes, port numbers, variable names) are always
    considered even when they score low on the embedding channel.
    """
    from sqlalchemy.ext.asyncio import AsyncSession as _AsyncSession  # noqa: PLC0415

    # Handle flexible calling convention
    if isinstance(db_or_query, _AsyncSession):
        _db: AsyncSession | None = db_or_query
        _query = query or ""
        _owns_session = False
    else:
        _query = str(db_or_query)
        _db = None
        _owns_session = True

    if not _query.strip():
        return []

    if status_filter is None:
        status_filter = ["active"]

    candidate_limit = top_k * 3

    # ── Step 1: Embed query ──────────────────────────────────────────────────
    _t0 = time.perf_counter()
    query_vector = await embed_text(_query)
    _t1 = time.perf_counter()

    if _owns_session:
        _session_ctx = async_session()
        session: AsyncSession = await _session_ctx.__aenter__()
    else:
        session = _db  # type: ignore[assignment]
        _session_ctx = None

    try:
        # ── Channel A: semantic (pgvector HNSW) ─────────────────────────────
        stmt_a = (
            select(
                Memory,
                Memory.embedding.cosine_distance(query_vector).label("distance"),
            )
            .where(Memory.embedding.isnot(None))
            .where(Memory.status.in_(status_filter))
        )
        if project_id is not None:
            stmt_a = stmt_a.where(Memory.project_id == project_id)
        if scope_filter is not None:
            stmt_a = stmt_a.where(Memory.scope == scope_filter)
        stmt_a = stmt_a.order_by("distance").limit(candidate_limit)

        rows_a = (await session.execute(stmt_a)).all()
        _t2 = time.perf_counter()

        # ── Channel B: full-text search (Postgres FTS + GIN index) ──────────
        # Build the SQL filters to match Channel A's scope
        fts_filters = ["m.status = ANY(:status_filter)", "m.fts_vector IS NOT NULL"]
        fts_params: dict[str, object] = {
            "status_filter": status_filter,
            "query": _query,
            "lim": candidate_limit,
        }
        if project_id is not None:
            fts_filters.append("m.project_id = :project_id")
            fts_params["project_id"] = project_id
        if scope_filter is not None:
            fts_filters.append("m.scope = :scope_filter")
            fts_params["scope_filter"] = scope_filter

        where_clause = " AND ".join(fts_filters)
        fts_sql = sa_text(
            f"""
            SELECT m.id, ts_rank_cd(m.fts_vector, websearch_to_tsquery('english', :query)) AS rank
            FROM memories m
            WHERE {where_clause}
              AND m.fts_vector @@ websearch_to_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :lim
            """
        )
        try:
            fts_rows = (await session.execute(fts_sql, fts_params)).all()
        except Exception as exc:
            # FTS column might not exist on older DB (migration pending) — degrade gracefully
            logger.warning("FTS channel failed (fts_vector not yet available?): %s", exc)
            fts_rows = []
        _t3 = time.perf_counter()

    finally:
        if _session_ctx is not None:
            await _session_ctx.__aexit__(None, None, None)

    # ── Step 2: Build unified candidate map ─────────────────────────────────
    # semantic_candidates: memory_id → (Memory, semantic_score)
    semantic_candidates: dict[str, tuple[Memory, float]] = {}
    for memory, distance in rows_a:
        score = max(0.0, 1.0 - float(distance))
        semantic_candidates[memory.id] = (memory, score)

    # fts_candidates: memory_id → fts_rank
    fts_candidates: dict[str, float] = {row.id: float(row.rank) for row in fts_rows}

    # Union of both channels
    all_ids = set(semantic_candidates.keys()) | set(fts_candidates.keys())
    if not all_ids:
        return []

    # ── Step 3: Compute per-channel ranks ────────────────────────────────────
    # Semantic rank: lower distance = higher rank
    sem_id_order = sorted(
        semantic_candidates.keys(),
        key=lambda mid: semantic_candidates[mid][1],
        reverse=True,
    )
    sem_rank: dict[str, int] = {mid: i + 1 for i, mid in enumerate(sem_id_order)}

    # FTS rank: higher ts_rank_cd = higher rank
    fts_id_order = sorted(fts_candidates.keys(), key=lambda mid: fts_candidates[mid], reverse=True)
    fts_rank: dict[str, int] = {mid: i + 1 for i, mid in enumerate(fts_id_order)}

    # ── Step 4: RRF fusion + freshness ───────────────────────────────────────
    # For ids only in Channel B we need to load the Memory object
    missing_ids = all_ids - set(semantic_candidates.keys())

    if missing_ids and _owns_session:
        # We already closed the session — open a brief one to load missing rows
        async with async_session() as load_session:
            load_result = await load_session.execute(
                select(Memory).where(Memory.id.in_(list(missing_ids)))
            )
            for mem in load_result.scalars().all():
                semantic_candidates[mem.id] = (mem, 0.0)
    elif missing_ids:
        load_result = await session.execute(  # type: ignore[possibly-undefined]
            select(Memory).where(Memory.id.in_(list(missing_ids)))
        )
        for mem in load_result.scalars().all():
            semantic_candidates[mem.id] = (mem, 0.0)

    _t4 = time.perf_counter()

    fused: list[SearchResult] = []
    for mid in all_ids:
        if mid not in semantic_candidates:
            continue  # Memory object unavailable — skip
        memory, semantic_score = semantic_candidates[mid]
        fts_score = fts_candidates.get(mid, 0.0)
        s_rank = sem_rank.get(mid, len(sem_rank) + 1)
        b_rank = fts_rank.get(mid, len(fts_rank) + 1)
        rrf = (1.0 / (_RRF_K + s_rank)) + (1.0 / (_RRF_K + b_rank))
        fresh = _freshness(memory)
        combined = rrf * fresh
        fused.append(
            SearchResult(
                memory_id=mid,
                memory=memory,
                semantic_score=round(semantic_score, 4),
                bm25_score=round(fts_score, 6),
                combined_score=round(combined, 6),
                rrf_score=round(rrf, 6),
                semantic_rank=s_rank,
                bm25_rank=b_rank,
                freshness=round(fresh, 4),
            )
        )

    fused.sort(key=lambda r: r.combined_score, reverse=True)

    logger.info(
        "hybrid_search: embed=%.0fms sem=%.0fms fts=%.0fms total=%.0fms "
        "sem_cands=%d fts_cands=%d union=%d",
        (_t1 - _t0) * 1000,
        (_t2 - _t1) * 1000,
        (_t3 - _t2) * 1000,
        (_t4 - _t0) * 1000,
        len(rows_a),
        len(fts_rows),
        len(all_ids),
    )

    return fused[:top_k]
