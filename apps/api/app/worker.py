"""Background extraction worker — polls job queue and processes exchanges."""

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
    """Load and process a single extraction job in its own session."""
    async with async_session() as db:
        try:
            # Load job
            job = await _load_job(db, job_id)
            if not job:
                logger.error("Job %s not found after claiming", job_id)
                return

            # Load exchange
            result = await db.execute(
                select(Exchange).where(Exchange.id == job.exchange_id)
            )
            exchange = result.scalar_one_or_none()
            if not exchange:
                raise ExtractionError(f"Exchange {job.exchange_id} not found")

            # Load context for the extraction prompt
            project = None
            if exchange.project_id:
                project = await get_project(db, exchange.project_id)

            existing = await get_recent_memories(db, project_id=exchange.project_id, limit=20)
            preferences = await get_memories_by_scope_type(db, "global", "preference", limit=10)

            # Extract via LLM
            candidates = await extract_memories(exchange, project, existing, preferences)

            # Validate
            validated = await validate_candidates(db, candidates, exchange)

            # Store memories
            created = []
            for candidate in validated:
                memory = await create_memory_from_candidate(db, candidate, exchange)
                created.append(memory)
                await log_activity(
                    db, "memory_created",
                    f"Extracted: {memory.content[:100]}",
                    memory_id=memory.id,
                    project_id=memory.project_id,
                )

            # Mark job done
            await db.execute(
                update(ExtractionJob)
                .where(ExtractionJob.id == job_id)
                .values(status="done", completed_at=datetime.now(timezone.utc))
            )
            await log_activity(
                db, "extraction_completed",
                f"Extracted {len(created)} memories from exchange {exchange.id}",
            )
            await db.commit()
            logger.info("Job %s done: %d memories extracted", job_id, len(created))

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
                        db2, "extraction_failed",
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

            logger.info("Processing job %s", job_id)
            await _process_job(job_id)

        except Exception as exc:
            logger.error("Worker loop error: %s", exc)
            await asyncio.sleep(settings.extraction_poll_interval)
