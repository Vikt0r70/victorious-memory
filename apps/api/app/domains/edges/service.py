"""Edge detection — classify relationships between memories using vector candidates + LLM."""

from __future__ import annotations

import json
import logging
import re

from sqlalchemy import select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Memory, MemoryEdge
from app.domains.providers.gateway import gateway
from app.domains.activity import log_activity

logger = logging.getLogger(__name__)

EDGE_TYPES = {
    "supersedes", "contradicts", "depends_on", "caused_by",
    "fixed_by", "enables", "related_to", "consolidates",
}
CANDIDATE_THRESHOLD = 0.60
NEIGHBOR_K = 8
PAIRS_PER_LLM_CALL = 10
MAX_PAIRS_DEFAULT = 200


def _parse_response(text: str) -> list[dict]:
    """Parse LLM JSON response, handling common formatting issues."""
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for val in data.values():
                if isinstance(val, list):
                    return val
        return []
    except json.JSONDecodeError:
        pass
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


async def detect_edges(
    db: AsyncSession,
    project_id: str | None = None,
    max_pairs: int = MAX_PAIRS_DEFAULT,
) -> dict:
    """Find and classify relationships between memories.

    1. Query active memories (optionally scoped by project).
    2. For each memory, find K nearest neighbors via pgvector (cosine >= 0.60).
    3. Deduplicate pairs (A->B == B->A).
    4. Batch pairs (~10 per LLM call) via edge_detection role.
    5. Insert into memory_edges with ON CONFLICT DO NOTHING.
    """
    mem_q = select(Memory.id, Memory.content, Memory.embedding).where(
        Memory.status == "active",
        Memory.embedding.isnot(None),
    )
    if project_id:
        mem_q = mem_q.where(Memory.project_id == project_id)

    result = await db.execute(mem_q)
    memories = result.all()

    if len(memories) < 2:
        logger.info("Edge detection: only %d memories, need >= 2", len(memories))
        return {"edges_created": 0, "candidates_scanned": 0, "memories": len(memories)}

    mem_contents = {r[0]: r[1] for r in memories}
    embeddings = {r[0]: r[2] for r in memories}

    # Build candidate pairs via pgvector nearest neighbors
    candidate_pairs: set[tuple[str, str]] = set()

    for mem_id, _content, emb in memories:
        if not emb or all(v == 0.0 for v in emb):
            continue

        neighbor_q = (
            select(
                Memory.id,
                Memory.embedding.cosine_distance(emb).label("distance"),
            )
            .where(
                Memory.id != mem_id,
                Memory.embedding.isnot(None),
                Memory.status == "active",
            )
            .order_by("distance")
            .limit(NEIGHBOR_K)
        )
        if project_id:
            neighbor_q = neighbor_q.where(Memory.project_id == project_id)

        neighbor_result = await db.execute(neighbor_q)
        for row in neighbor_result.all():
            neighbor_id = row[0]
            distance = float(row[1])
            similarity = max(0.0, 1.0 - distance)
            if similarity >= CANDIDATE_THRESHOLD:
                pair = tuple(sorted([mem_id, neighbor_id]))
                candidate_pairs.add(pair)

    pair_list = list(candidate_pairs)[:max_pairs]

    if not pair_list:
        logger.info("Edge detection: no candidate pairs above threshold %.2f", CANDIDATE_THRESHOLD)
        return {"edges_created": 0, "candidates_scanned": 0, "memories": len(memories)}

    logger.info("Edge detection: %d candidate pairs from %d memories", len(pair_list), len(memories))

    # Batch pairs for LLM classification
    edges_created = 0
    batches = [pair_list[i:i + PAIRS_PER_LLM_CALL] for i in range(0, len(pair_list), PAIRS_PER_LLM_CALL)]

    for batch_idx, batch in enumerate(batches):
        pair_texts = []
        for source_id, target_id in batch:
            src = mem_contents.get(source_id, "")[:200]
            tgt = mem_contents.get(target_id, "")[:200]
            pair_texts.append(f"Memory A ({source_id}): {src}\nMemory B ({target_id}): {tgt}")

        pairs_text = "\n---\n".join(pair_texts)

        system_prompt = f"""You are an edge detection agent. Analyze pairs of memories and classify their relationships.

For each pair, determine:
- source_id: The first memory ID (Memory A)
- target_id: The second memory ID (Memory B)
- relation_type: One of {sorted(EDGE_TYPES)}
- description: Brief explanation of the relationship
- confidence: 0.0-1.0 (how confident is this relationship)

Return a JSON array of objects. Only include pairs where a clear, meaningful relationship exists.
Skip pairs with no real connection. Do NOT invent IDs — use exactly the IDs provided.

Memory pairs:
{pairs_text}"""

        try:
            response = await gateway.complete(
                messages=[{"role": "system", "content": system_prompt}],
                model_role="edge_detection",
                response_format="json",
            )
            raw = _parse_response(response)
            logger.info("Edge detection batch %d/%d: %d raw items", batch_idx + 1, len(batches), len(raw))
        except Exception as exc:
            logger.error("Edge detection batch %d failed: %s", batch_idx, exc)
            continue

        for item in raw:
            if not isinstance(item, dict):
                continue
            source_id = item.get("source_id")
            target_id = item.get("target_id")
            relation_type = item.get("relation_type", "")
            description = item.get("description")
            confidence = float(item.get("confidence", 0.8))

            if not source_id or not target_id:
                continue
            if relation_type not in EDGE_TYPES:
                logger.warning("Edge detection: skipping invalid relation_type '%s'", relation_type)
                continue
            if source_id == target_id:
                continue

            try:
                await db.execute(
                    sa_text("""
                        INSERT INTO memory_edges (id, source_id, target_id, relation_type, description, confidence)
                        VALUES (:id, :source_id, :target_id, :relation_type, :description, :confidence)
                        ON CONFLICT DO NOTHING
                    """),
                    {
                        "id": MemoryEdge.new_id(),
                        "source_id": source_id,
                        "target_id": target_id,
                        "relation_type": relation_type,
                        "description": description,
                        "confidence": confidence,
                    },
                )
                edges_created += 1
            except Exception as exc:
                logger.warning("Edge detection: insert failed for %s->%s: %s", source_id, target_id, exc)

    await log_activity(
        db,
        "edge_detection_completed",
        f"Edge detection: {edges_created} edges created from {len(pair_list)} candidate pairs ({len(memories)} memories)",
        project_id=project_id,
    )
    await db.commit()

    logger.info("Edge detection complete: %d edges from %d pairs", edges_created, len(pair_list))
    return {
        "edges_created": edges_created,
        "candidates_scanned": len(pair_list),
        "memories": len(memories),
        "batches": len(batches),
    }
