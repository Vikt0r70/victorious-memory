"""Validation pipeline for LLM-extracted memory candidates."""

from __future__ import annotations

import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domains.extraction.schemas import MemoryCandidate, ValidatedCandidate
from app.domains.search.embeddings import embed_text
from app.models import MEMORY_TYPES, Exchange, Memory

logger = logging.getLogger(__name__)

# Type aliases the LLM might produce
_TYPE_ALIASES = {
    "bug": "bugfix",
    "fix": "bugfix",
    "pref": "preference",
    "arch": "architecture",
    "ref": "reference",
    "learn": "lesson",
    "insight": "lesson",
    "discovery": "research",
    "finding": "research",
}

_VALID_SCOPES = {"project", "global", "cross-project"}

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "because", "but", "and",
    "or", "if", "while", "about", "up", "it", "its", "i", "me", "my",
    "we", "our", "you", "your", "he", "him", "his", "she", "her", "they",
    "them", "their", "this", "that", "these", "those", "what", "which",
}


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 2}


def _sanitize_type(raw_type: str) -> str:
    t = raw_type.lower().strip()
    if t in MEMORY_TYPES:
        return t
    if t in _TYPE_ALIASES:
        return _TYPE_ALIASES[t]
    return "reference"


def _sanitize_scope(raw_scope: str) -> str:
    s = raw_scope.lower().strip()
    return s if s in _VALID_SCOPES else "global"


def _confidence_label(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"


def _is_grounded(candidate_content: str, exchanges: list[Exchange] | Exchange) -> bool:
    """Check that at least 3 non-stopword tokens overlap with the exchange(s)."""
    candidate_tokens = _tokenize(candidate_content)
    exchange_list = [exchanges] if isinstance(exchanges, Exchange) else exchanges
    exchange_text = ""
    for exc in exchange_list:
        exchange_text += " " + (exc.user_content or "")
        for part in exc.agent_parts or []:
            exchange_text += " " + (part.get("content", "") if isinstance(part, dict) else "")
    exchange_tokens = _tokenize(exchange_text)
    overlap = candidate_tokens & exchange_tokens
    return len(overlap) >= 3


def _infer_source_type(exchanges: list[Exchange] | Exchange) -> str:
    exchange_list = [exchanges] if isinstance(exchanges, Exchange) else exchanges
    user_combined = " ".join((exc.user_content or "").lower() for exc in exchange_list)
    explicit_phrases = [
        "i want", "i prefer", "i decided", "we should", "let's use",
        "i like", "i need", "i chose", "we need", "don't use",
        "make sure", "always", "never",
    ]
    for phrase in explicit_phrases:
        if phrase in user_combined:
            return "user_statement"
    return "assistant_inference"


async def _check_duplicate(
    db: AsyncSession, content: str, embedding: list[float],
) -> str:
    """
    Check for duplicates. Returns:
    - "skip" if near-exact duplicate (>0.90)
    - "merge:mem_id" if close duplicate (0.80-0.90)
    - "new" if sufficiently different
    """
    from pgvector.sqlalchemy import Vector

    result = await db.execute(
        select(
            Memory.id,
            Memory.content,
            Memory.confidence_score,
            (1 - Memory.embedding.cosine_distance(embedding)).label("similarity"),
        )
        .where(Memory.status.in_(["active", "pending_review"]))
        .where(Memory.embedding.isnot(None))
        .order_by(Memory.embedding.cosine_distance(embedding))
        .limit(3)
    )
    rows = result.all()

    if not rows:
        return "new"

    top = rows[0]
    sim = float(top.similarity)

    if sim > 0.90:
        logger.info("Duplicate detected (sim=%.3f): %s", sim, content[:80])
        return "skip"
    if sim > 0.80:
        return f"merge:{top.id}"

    return "new"


async def validate_candidates(
    db: AsyncSession,
    candidates: list[MemoryCandidate],
    exchange: list[Exchange] | Exchange,
) -> list[ValidatedCandidate]:
    """Run the full validation pipeline on extracted candidates."""
    validated = []
    source_type = _infer_source_type(exchange)

    for candidate in candidates:
        # Step 1: Sanitize type and scope
        mem_type = _sanitize_type(candidate.memory_type)
        scope = _sanitize_scope(candidate.scope)
        score = max(0.0, min(1.0, candidate.confidence_score))

        # Skip empty / too short / single-keyword junk (e.g. "edge-detection")
        content = candidate.content.strip()
        word_count = len(content.split())
        if not content or len(content) < 10 or word_count < 3:
            logger.info("Skipping trivial candidate (%d words): %s", word_count, content[:60])
            continue

        # Step 2: Confidence label
        label = _confidence_label(score)

        # Step 3: Duplicate detection
        try:
            embedding = await embed_text(content)
            dup_status = await _check_duplicate(db, content, embedding)
        except Exception as exc:
            logger.warning("Embedding/duplicate check failed: %s", exc)
            embedding = None
            dup_status = "new"

        if dup_status == "skip":
            continue
        if dup_status.startswith("merge:"):
            # Boost existing memory confidence slightly
            merge_id = dup_status.split(":", 1)[1]
            try:
                result = await db.execute(select(Memory).where(Memory.id == merge_id))
                existing = result.scalar_one_or_none()
                if existing:
                    existing.confidence_score = min(1.0, existing.confidence_score + 0.05)
                    await db.flush()
            except Exception:
                pass
            continue

        # Step 4: Grounding check
        if not _is_grounded(content, exchange):
            score *= 0.5
            label = _confidence_label(score)

        # Step 5: Auto-approve decision
        if settings.auto_approve_enabled and score >= settings.auto_approve_threshold:
            status = "active"
            auto_approved = True
        else:
            status = "pending_review"
            auto_approved = False

        validated.append(
            ValidatedCandidate(
                content=content,
                memory_type=mem_type,
                scope=scope,
                confidence_score=score,
                confidence_label=label,
                confidence_reasoning=candidate.confidence_reasoning,
                tags=candidate.tags,
                supersedes_content=candidate.supersedes_content,
                status=status,
                auto_approved=auto_approved,
                source_type=source_type,
            )
        )

    return validated
