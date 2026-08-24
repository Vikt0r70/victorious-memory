"""Background extraction worker — polls job queue and processes conversation batches."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.domains.activity import log_activity
from app.domains.extraction.agent import ExtractionError, extract_memories
from app.domains.extraction.validator import validate_candidates
from app.domains.memories.service import (
    create_memory_from_candidate,
    get_memories_by_scope_type,
    get_recent_memories,
)
from app.domains.projects.service import get_project
from app.models import Exchange, ExtractionJob

logger = logging.getLogger(__name__)


def _estimate_exchange_tokens(exc: Exchange) -> int:
    """Rough token estimate (~4 chars/token) for an exchange's content."""
    chars = len(exc.user_content or "")
    for part in exc.agent_parts or []:
        chars += len(part.get("content", "") if isinstance(part, dict) else "")
    return chars // 4 + 32


def _chunk_exchanges(exchanges: list[Exchange], token_budget: int) -> list[list[Exchange]]:
    """Split a batch into chunks that each fit within the LLM prompt budget.

    Keeps providers with small TPM limits (e.g., Groq free tier at 8K) viable
    and avoids timeouts on oversized prompts.
    """
    chunks: list[list[Exchange]] = []
    current: list[Exchange] = []
    size = 0
    for exc in exchanges:
        est = _estimate_exchange_tokens(exc)
        # A single oversized exchange still gets its own chunk (never dropped)
        if current and size + est > token_budget:
            chunks.append(current)
            current, size = [], 0
        current.append(exc)
        size += est
    if current:
        chunks.append(current)
    return chunks


async def _claim_next_job() -> str | None:
    """Claim the next pending job. Returns the job ID or None."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                UPDATE extraction_jobs
                SET status = 'processing', started_at = NOW(), attempts = attempts + 1
                WHERE id = (
                    SELECT id FROM extraction_jobs
                    WHERE status = 'pending'
                    AND attempts < max_attempts
                    AND (retry_after IS NULL OR retry_after <= NOW())
                    ORDER BY created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, attempts, max_attempts
            """)
        )
        row = result.fetchone()
        await db.commit()
        return row[0] if row else None


async def _load_job(db: AsyncSession, job_id: str) -> ExtractionJob | None:
    result = await db.execute(select(ExtractionJob).where(ExtractionJob.id == job_id))
    return result.scalar_one_or_none()


async def _process_job(job_id: str) -> None:
    """Load and process an extraction job (single or multi-turn batch) in its own session."""
    async with async_session() as db:
        try:
            # Load job
            job = await _load_job(db, job_id)
            if not job:
                logger.error("Job %s not found after claiming", job_id)
                return

            # Determine exchange IDs to process
            exchange_ids = job.exchange_ids if (job.exchange_ids and len(job.exchange_ids) > 0) else [job.exchange_id]

            # Load exchanges in chronological order
            result = await db.execute(
                select(Exchange)
                .where(Exchange.id.in_(exchange_ids))
                .order_by(Exchange.created_at.asc())
            )
            exchanges = list(result.scalars().all())
            if not exchanges:
                raise ExtractionError(f"No exchanges found for job {job_id} (IDs: {exchange_ids})")

            primary_exchange = exchanges[-1]
            project_id = primary_exchange.project_id

            # Load context for the extraction prompt
            project = None
            if project_id:
                project = await get_project(db, project_id)

            existing = await get_recent_memories(db, project_id=project_id, limit=20)
            preferences = await get_memories_by_scope_type(db, "global", "preference", limit=10)

            # Extract via LLM in token-budgeted chunks (large batches exceed
            # provider TPM limits and cause timeouts when sent as one prompt)
            chunks = _chunk_exchanges(exchanges, settings.extraction_chunk_tokens)
            logger.info(
                "Job %s: %d exchanges -> %d chunk(s) (budget %d tokens)",
                job_id, len(exchanges), len(chunks), settings.extraction_chunk_tokens,
            )
            candidates = []
            failed_chunks = 0
            for idx, chunk in enumerate(chunks, 1):
                try:
                    chunk_candidates = await extract_memories(chunk, project, existing, preferences)
                    candidates.extend(chunk_candidates)
                    logger.info("Job %s: chunk %d/%d -> %d candidates", job_id, idx, len(chunks), len(chunk_candidates))
                except ExtractionError as exc:
                    failed_chunks += 1
                    logger.error("Job %s: chunk %d/%d extraction failed: %s", job_id, idx, len(chunks), exc)

            # Every chunk failing means the extraction genuinely broke — retry the job
            if chunks and failed_chunks == len(chunks):
                raise ExtractionError(f"All {len(chunks)} chunk(s) failed extraction")

            # Validate
            validated = await validate_candidates(db, candidates, exchanges)

            # Store memories
            created = []
            for candidate in validated:
                memory = await create_memory_from_candidate(db, candidate, primary_exchange)
                created.append(memory)
                await log_activity(
                    db,
                    "memory_created",
                    f"Extracted: {memory.content[:100]}",
                    memory_id=memory.id,
                    project_id=memory.project_id,
                )

            now_utc = datetime.now(timezone.utc)

            # Mark all exchanges in the batch as extracted
            all_ids = [e.id for e in exchanges]
            await db.execute(
                update(Exchange)
                .where(Exchange.id.in_(all_ids))
                .values(extracted_at=now_utc)
            )

            # Mark job completed
            await db.execute(
                update(ExtractionJob)
                .where(ExtractionJob.id == job_id)
                .values(status="completed", completed_at=now_utc)
            )
            await log_activity(
                db,
                "extraction_completed",
                f"Batch extraction completed: Extracted {len(created)} memories from {len(exchanges)} exchanges"
                + (f" ({len(chunks)} chunks, {failed_chunks} failed)" if len(chunks) > 1 or failed_chunks else ""),
                project_id=project_id,
            )
            await db.commit()
            logger.info("Job %s completed: %d memories extracted from %d exchanges", job_id, len(created), len(exchanges))

        except Exception as exc:
            await db.rollback()
            logger.error("Job %s failed: %s", job_id, exc)

            # Re-open session to update job status
            async with async_session() as db2:
                job = await _load_job(db2, job_id)
                if not job:
                    return
                if job.attempts >= job.max_attempts:
                    await db2.execute(
                        update(ExtractionJob)
                        .where(ExtractionJob.id == job_id)
                        .values(status="failed", error=str(exc)[:500])
                    )
                    await log_activity(
                        db2,
                        "extraction_failed",
                        f"Failed after {job.attempts} attempts: {str(exc)[:200]}",
                    )
                else:
                    delay = 2 ** job.attempts
                    retry_after = datetime.now(timezone.utc) + timedelta(seconds=delay)
                    await db2.execute(
                        update(ExtractionJob)
                        .where(ExtractionJob.id == job_id)
                        .values(status="pending", error=str(exc)[:500], retry_after=retry_after)
                    )
                    logger.info("Job %s re-queued (retry in %ds)", job_id, delay)
                await db2.commit()


async def extraction_worker() -> None:
    """Main worker loop — runs as asyncio task in FastAPI lifespan."""
    logger.info("Extraction worker started (poll_interval=%.1fs)", settings.extraction_poll_interval)

    while True:
        try:
            job_id = await _claim_next_job()
            if not job_id:
                await asyncio.sleep(settings.extraction_poll_interval)
                continue

            while job_id:
                logger.info("Processing job %s", job_id)
                await _process_job(job_id)
                # Immediately claim next job — no sleep if queue has work
                job_id = await _claim_next_job()

        except Exception as exc:
            logger.error("Worker loop error: %s", exc)
            await asyncio.sleep(settings.extraction_poll_interval)
