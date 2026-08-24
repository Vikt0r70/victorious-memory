"""Victorious Memory — ingest service with 10k token batch accumulator."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domains.activity import log_activity
from app.domains.ingest.schemas import (
    BufferStatusResponse,
    ExtractNowResponse,
    IngestRequest,
    IngestResponse,
)
from app.models import AppSetting, Exchange, ExtractionJob, Project

logger = logging.getLogger(__name__)


def _normalize_paths(paths: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for p in paths:
        normed = p.replace("\\", "/")
        if normed not in seen:
            seen.add(normed)
            result.append(normed)
    return result


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 token ≈ 4 characters."""
    return len(text or "") // 4


def _estimate_exchange_tokens(exchange: Exchange | IngestRequest) -> int:
    """Estimate total tokens in an exchange (user + agent parts)."""
    if isinstance(exchange, Exchange):
        total = _estimate_tokens(exchange.user_content or "")
        for part in exchange.agent_parts or []:
            if isinstance(part, dict):
                total += _estimate_tokens(part.get("content", ""))
        return total
    else:
        total = _estimate_tokens(exchange.exchange.user or "")
        for part in exchange.exchange.agent_parts:
            total += _estimate_tokens(part.content or "")
        return total


async def get_extraction_token_threshold(db: AsyncSession) -> int:
    """Fetch user-configured token threshold from app_settings, falling back to 10,000."""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "extraction.token_threshold")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, dict) and "value" in val:
            try:
                return int(val["value"])
            except (ValueError, TypeError):
                pass
        if isinstance(val, (int, float, str)):
            try:
                return int(val)
            except (ValueError, TypeError):
                pass
    return getattr(settings, "extraction_token_threshold", 10000) or 10000


async def get_extraction_enabled(db: AsyncSession) -> bool:
    """Check if extraction is enabled in app_settings."""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "extraction.enabled")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, dict) and "value" in val:
            return bool(val["value"])
        if isinstance(val, bool):
            return val
    return True


async def get_unextracted_exchanges(
    db: AsyncSession, project_id: str | None = None
) -> list[Exchange]:
    """Retrieve all conversation exchanges that have not yet been processed by extraction."""
    query = select(Exchange).where(Exchange.extracted_at.is_(None))
    if project_id:
        query = query.where(Exchange.project_id == project_id)
    query = query.order_by(Exchange.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def ingest_exchange(
    db: AsyncSession, request: IngestRequest
) -> IngestResponse:
    """Store conversation exchange and trigger batch extraction if token threshold is met."""
    file_paths = _normalize_paths(request.exchange.file_paths)

    # Ensure project exists if project_id is supplied
    valid_project_id = None
    if request.project_id:
        res = await db.execute(select(Project).where(Project.id == request.project_id))
        proj = res.scalar_one_or_none()
        if proj:
            valid_project_id = proj.id
        else:
            # Auto-create project record to satisfy FK constraint
            new_proj = Project(
                id=request.project_id,
                display_name=request.project_id.replace("-", " ").title(),
                workspace_path=request.project_id,
                tech_stack=[],
            )
            db.add(new_proj)
            await db.flush()
            valid_project_id = new_proj.id

    # Store exchange in PostgreSQL (with extracted_at=None)
    exchange = Exchange(
        id=Exchange.new_id(),
        session_id=request.session_id,
        project_id=valid_project_id,
        user_content=request.exchange.user,
        agent_parts=[p.model_dump() for p in request.exchange.agent_parts],
        file_paths=file_paths,
        extracted_at=None,
    )
    db.add(exchange)
    await db.flush()

    # Calculate accumulated unextracted tokens
    unextracted = await get_unextracted_exchanges(db, valid_project_id)
    accumulated_tokens = sum(_estimate_exchange_tokens(e) for e in unextracted)
    threshold = await get_extraction_token_threshold(db)
    enabled = await get_extraction_enabled(db)

    # Check if threshold reached
    if enabled and accumulated_tokens >= threshold:
        # Check if there is already a pending/processing job for this project
        active_job_res = await db.execute(
            select(ExtractionJob)
            .join(Exchange, ExtractionJob.exchange_id == Exchange.id)
            .where(
                ExtractionJob.status.in_(["pending", "processing"]),
                Exchange.project_id == valid_project_id,
            )
            .limit(1)
        )
        existing_active_job = active_job_res.scalar_one_or_none()

        if not existing_active_job:
            # Create batch extraction job with all accumulated exchange IDs
            job = ExtractionJob(
                id=ExtractionJob.new_id(),
                exchange_id=exchange.id,
                exchange_ids=[e.id for e in unextracted],
                status="pending",
                max_attempts=settings.extraction_max_retries,
            )
            db.add(job)
            await db.flush()

            logger.info(
                "Batch extraction triggered for %s: %d exchanges (~%d / %d tokens)",
                valid_project_id or "global", len(unextracted), accumulated_tokens, threshold,
            )
            await log_activity(
                db,
                event_type="extraction_started",
                description=(
                    f"Batch extraction queued: {len(unextracted)} exchanges reached "
                    f"threshold (~{accumulated_tokens}/{threshold} tokens)"
                ),
                project_id=valid_project_id,
            )

            return IngestResponse(
                exchange_id=exchange.id,
                job_id=job.id,
                status="queued",
                accumulated_tokens=accumulated_tokens,
                threshold=threshold,
                unextracted_count=len(unextracted),
            )

    # Below threshold or active job already in progress — continue accumulating
    logger.info(
        "Exchange %s buffered for %s (%d / %d tokens, %d exchanges)",
        exchange.id, valid_project_id or "global", accumulated_tokens, threshold, len(unextracted),
    )

    return IngestResponse(
        exchange_id=exchange.id,
        job_id=None,
        status="accumulating",
        accumulated_tokens=accumulated_tokens,
        threshold=threshold,
        unextracted_count=len(unextracted),
    )


async def get_buffer_status(
    db: AsyncSession, project_id: str | None = None
) -> BufferStatusResponse:
    """Get current unextracted token count, threshold, and buffer progress."""
    unextracted = await get_unextracted_exchanges(db, project_id)
    accumulated_tokens = sum(_estimate_exchange_tokens(e) for e in unextracted)
    threshold = await get_extraction_token_threshold(db)
    enabled = await get_extraction_enabled(db)

    progress_pct = 0.0
    if threshold > 0:
        progress_pct = round(min(100.0, (accumulated_tokens / threshold) * 100.0), 1)

    return BufferStatusResponse(
        project_id=project_id,
        unextracted_exchanges_count=len(unextracted),
        accumulated_tokens=accumulated_tokens,
        threshold=threshold,
        progress_pct=progress_pct,
        extraction_enabled=enabled,
    )


async def trigger_batch_extraction(
    db: AsyncSession, project_id: str | None = None
) -> ExtractNowResponse:
    """Manually trigger batch extraction on all currently buffered unextracted exchanges."""
    unextracted = await get_unextracted_exchanges(db, project_id)
    if not unextracted:
        return ExtractNowResponse(
            status="empty",
            job_id=None,
            exchanges_count=0,
            accumulated_tokens=0,
            message="No unextracted exchanges in buffer.",
        )

    accumulated_tokens = sum(_estimate_exchange_tokens(e) for e in unextracted)
    latest_exchange = unextracted[-1]

    job = ExtractionJob(
        id=ExtractionJob.new_id(),
        exchange_id=latest_exchange.id,
        exchange_ids=[e.id for e in unextracted],
        status="pending",
        max_attempts=settings.extraction_max_retries,
    )
    db.add(job)
    await db.flush()

    await log_activity(
        db,
        event_type="extraction_started",
        description=(
            f"Manual batch extraction triggered: {len(unextracted)} exchanges "
            f"(~{accumulated_tokens} tokens)"
        ),
        project_id=project_id,
    )

    logger.info(
        "Manual batch extraction created job %s for %d exchanges (~%d tokens)",
        job.id, len(unextracted), accumulated_tokens,
    )

    return ExtractNowResponse(
        status="queued",
        job_id=job.id,
        exchanges_count=len(unextracted),
        accumulated_tokens=accumulated_tokens,
        message=f"Queued extraction job for {len(unextracted)} buffered exchanges (~{accumulated_tokens} tokens).",
    )
