from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domains.activity import log_activity
from app.domains.ingest.schemas import IngestRequest, IngestResponse
from app.models import Exchange, ExtractionJob


def _normalize_paths(paths: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for p in paths:
        normed = p.replace("\\", "/")
        if normed not in seen:
            seen.add(normed)
            result.append(normed)
    return result


async def ingest_exchange(
    db: AsyncSession, request: IngestRequest
) -> IngestResponse:
    """Store a conversation exchange and create an extraction job."""
    file_paths = _normalize_paths(request.exchange.file_paths)

    # Store exchange
    exchange = Exchange(
        id=Exchange.new_id(),
        session_id=request.session_id,
        project_id=request.project_id,
        user_content=request.exchange.user,
        agent_parts=[p.model_dump() for p in request.exchange.agent_parts],
        file_paths=file_paths,
    )
    db.add(exchange)
    await db.flush()

    # Create extraction job
    job = ExtractionJob(
        id=ExtractionJob.new_id(),
        exchange_id=exchange.id,
        status="pending",
        max_attempts=settings.extraction_max_retries,
    )
    db.add(job)
    await db.flush()

    # Log activity
    await log_activity(
        db,
        event_type="extraction_started",
        description=f"Exchange received from session {request.session_id}",
        project_id=request.project_id,
    )

    return IngestResponse(
        exchange_id=exchange.id,
        job_id=job.id,
        status="queued",
    )
