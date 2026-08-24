"""Extraction jobs management router."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ExtractionJob

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
async def list_jobs(
    status: str | None = None,
    exchange_id: str | None = None,
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(ExtractionJob)
    if status:
        query = query.where(ExtractionJob.status == status)
    if exchange_id:
        query = query.where(ExtractionJob.exchange_id == exchange_id)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(ExtractionJob.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    jobs = result.scalars().all()

    return {
        "items": [
            {
                "id": j.id,
                "exchange_id": j.exchange_id,
                "status": j.status,
                "attempts": j.attempts,
                "max_attempts": j.max_attempts,
                "error": j.error,
                "retry_after": j.retry_after.isoformat() if j.retry_after else None,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/stats")
async def job_stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(ExtractionJob.id)))).scalar() or 0

    status_counts = {}
    for s in ("pending", "processing", "completed", "failed"):
        c = (
            await db.execute(
                select(func.count(ExtractionJob.id)).where(ExtractionJob.status == s)
            )
        ).scalar() or 0
        status_counts[s] = c

    # Average processing time for completed jobs
    avg_q = select(
        func.avg(
            func.extract("epoch", ExtractionJob.completed_at)
            - func.extract("epoch", ExtractionJob.started_at)
        )
    ).where(
        ExtractionJob.status == "completed",
        ExtractionJob.started_at.isnot(None),
        ExtractionJob.completed_at.isnot(None),
    )
    avg_seconds = (await db.execute(avg_q)).scalar()
    avg_ms = round(avg_seconds * 1000, 1) if avg_seconds else None

    last_q = (
        select(ExtractionJob.completed_at)
        .where(ExtractionJob.status == "completed")
        .order_by(ExtractionJob.completed_at.desc())
        .limit(1)
    )
    last_completed = (await db.execute(last_q)).scalar()

    return {
        "total": total,
        "by_status": status_counts,
        "avg_processing_time_ms": avg_ms,
        "last_completed_at": last_completed.isoformat() if last_completed else None,
    }


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExtractionJob).where(ExtractionJob.id == job_id))
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Job not found")
    return {
        "id": j.id,
        "exchange_id": j.exchange_id,
        "exchange_ids": j.exchange_ids,
        "status": j.status,
        "attempts": j.attempts,
        "max_attempts": j.max_attempts,
        "error": j.error,
        "retry_after": j.retry_after.isoformat() if j.retry_after else None,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
    }


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExtractionJob).where(ExtractionJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "failed":
        raise HTTPException(409, f"Can only retry failed jobs, current status: {job.status}")

    job.status = "pending"
    job.error = None
    job.retry_after = None
    job.started_at = None
    job.completed_at = None
    await db.flush()
    return {"id": job.id, "status": job.status}


@router.post("/retry-all-failed")
async def retry_all_failed(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        update(ExtractionJob)
        .where(ExtractionJob.status == "failed")
        .values(status="pending", error=None, retry_after=None, started_at=None, completed_at=None)
    )
    await db.flush()
    return {"affected": result.rowcount}


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExtractionJob).where(ExtractionJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "pending":
        raise HTTPException(409, f"Can only cancel pending jobs, current status: {job.status}")

    job.status = "cancelled"
    await db.flush()
    return {"id": job.id, "status": job.status}
