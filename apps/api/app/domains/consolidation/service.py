"""Consolidation service — keeps memory healthy over time.

Three sweeps:
1. Near-dup merge: pgvector cosine > 0.92 → LLM decides merge vs keep_both
2. Staleness: decayable types untouched > 90 days → needs_review
3. Usage demotion: never-injected memories > 30 days old → needs_review

Conservative: nothing is hard-deleted. Superseded memories keep status='superseded'
and remain in the review queue. Everything is reversible.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text as sa_text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Memory
from app.domains.providers.gateway import gateway
from app.domains.activity import log_activity

logger = logging.getLogger(__name__)

DUP_THRESHOLD = 0.92
STALENESS_DAYS = 90
USAGE_DEMOTE_DAYS = 30
PAIRS_PER_LLM_CALL = 10
DECAYABLE_TYPES = {"daily", "research", "context", "reference"}
STABLE_TYPES = {"decision", "preference", "constraint", "architecture"}


def _parse_response(text_response: str) -> list[dict]:
    """Parse LLM JSON response."""
    text_response = text_response.strip()
    try:
        data = json.loads(text_response)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for val in data.values():
                if isinstance(val, list):
                    return val
        return []
    except json.JSONDecodeError:
        pass
    match = re.search(r"\[.*\]", text_response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


async def run_consolidation(
    db: AsyncSession,
    project_id: str | None = None,
) -> dict:
    """Run the full consolidation pipeline.

    Returns stats dict with counts per sweep.
    """
    stats = {
        "near_dup_pairs": 0,
        "merged": 0,
        "superseded": 0,
        "kept_both": 0,
        "stale_demoted": 0,
        "unused_demoted": 0,
    }

    # ── Sweep 1: Near-dup merge ──────────────────────────────────────────
    dup_sql = """
        SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS similarity
        FROM memories a, memories b
        WHERE a.id < b.id
          AND a.status = 'active' AND b.status = 'active'
          AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
          AND 1 - (a.embedding <=> b.embedding) > :threshold
    """
    dup_params: dict = {"threshold": DUP_THRESHOLD}
    if project_id:
        dup_sql += " AND a.project_id = :project_id AND b.project_id = :project_id"
        dup_params["project_id"] = project_id

    result = await db.execute(sa_text(dup_sql), dup_params)
    dup_pairs = result.fetchall()

    stats["near_dup_pairs"] = len(dup_pairs)
    logger.info("Consolidation: %d near-dup pairs (cosine > %.2f)", len(dup_pairs), DUP_THRESHOLD)

    if dup_pairs:
        # Load content for each pair
        all_ids = set()
        for row in dup_pairs:
            all_ids.add(row[0])
            all_ids.add(row[1])

        mem_result = await db.execute(
            select(Memory.id, Memory.content, Memory.created_at).where(Memory.id.in_(all_ids))
        )
        mem_map = {r[0]: {"content": r[1], "created_at": r[2]} for r in mem_result.all()}

        # Batch pairs for LLM
        batches = [dup_pairs[i:i + PAIRS_PER_LLM_CALL] for i in range(0, len(dup_pairs), PAIRS_PER_LLM_CALL)]

        for batch_idx, batch in enumerate(batches):
            pair_texts = []
            for row in batch:
                aid, bid, sim = row[0], row[1], float(row[2])
                a_content = (mem_map.get(aid, {}).get("content") or "")[:200]
                b_content = (mem_map.get(bid, {}).get("content") or "")[:200]
                pair_texts.append(
                    f"Pair (similarity={sim:.3f}):\n"
                    f"  A ({aid}): {a_content}\n"
                    f"  B ({bid}): {b_content}"
                )

            system_prompt = f"""You are a memory consolidation agent. For each pair of highly similar memories, decide:

- action: "merge" (they're near-duplicates — combine into one) or "keep_both" (distinct enough)
- canonical_id: the ID to keep as the primary (for merge: usually the newer/cleaner one)
- superseded_id: the ID to mark as superseded (for merge: the older/redundant one)

Return a JSON array of objects: [{{"action": "merge", "canonical_id": "...", "superseded_id": "..."}}, ...]

Only suggest "merge" for true duplicates with substantially overlapping content.
When in doubt, use "keep_both" — we never want to lose distinct information.

Memory pairs:
{chr(10).join(pair_texts)}"""

            try:
                response = await gateway.complete(
                    messages=[{"role": "system", "content": system_prompt}],
                    model_role="consolidation",
                    response_format="json",
                )
                decisions = _parse_response(response)
                logger.info("Consolidation batch %d/%d: %d decisions", batch_idx + 1, len(batches), len(decisions))
            except Exception as exc:
                logger.error("Consolidation batch %d failed: %s", batch_idx, exc)
                continue

            for item in decisions:
                if not isinstance(item, dict):
                    continue
                action = item.get("action", "keep_both")
                canonical_id = item.get("canonical_id")
                superseded_id = item.get("superseded_id")

                if action == "merge" and canonical_id and superseded_id:
                    # Mark the superseded one — never delete
                    await db.execute(
                        update(Memory)
                        .where(Memory.id == superseded_id)
                        .values(status="superseded")
                    )
                    stats["merged"] += 1
                    logger.info("Consolidation: merged %s -> canonical %s (superseded %s)",
                                superseded_id, canonical_id, superseded_id)
                else:
                    stats["kept_both"] += 1

    # ── Sweep 2: Staleness — decayable types untouched > 90 days ─────────
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=STALENESS_DAYS)
    stale_result = await db.execute(
        update(Memory)
        .where(
            Memory.status == "active",
            Memory.memory_type.in_(DECAYABLE_TYPES),
            Memory.updated_at < stale_cutoff,
        )
        .values(status="needs_review")
        .returning(Memory.id)
    )
    stale_ids = [r[0] for r in stale_result.fetchall()]
    stats["stale_demoted"] = len(stale_ids)
    if stale_ids:
        logger.info("Consolidation: %d stale memories demoted to needs_review", len(stale_ids))

    # ── Sweep 3: Usage demotion — never-injected > 30 days ──────────────
    usage_cutoff = datetime.now(timezone.utc) - timedelta(days=USAGE_DEMOTE_DAYS)
    unused_result = await db.execute(
        update(Memory)
        .where(
            Memory.status == "active",
            Memory.access_count == 0,
            Memory.created_at < usage_cutoff,
            ~Memory.memory_type.in_(STABLE_TYPES),
        )
        .values(status="needs_review")
        .returning(Memory.id)
    )
    unused_ids = [r[0] for r in unused_result.fetchall()]
    stats["unused_demoted"] = len(unused_ids)
    if unused_ids:
        logger.info("Consolidation: %d unused memories demoted to needs_review", len(unused_ids))

    await log_activity(
        db,
        "consolidation_completed",
        f"Consolidation: {stats['merged']} merged, {stats['stale_demoted']} stale, {stats['unused_demoted']} unused → needs_review",
        project_id=project_id,
    )
    await db.commit()

    logger.info("Consolidation complete: %s", stats)
    return stats
