from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.domains.ingest.schemas import (
    BufferStatusResponse,
    ExtractNowResponse,
    IngestRequest,
    IngestResponse,
)
from app.domains.ingest.service import (
    get_buffer_status,
    ingest_exchange,
    trigger_batch_extraction,
)

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
async def ingest(req: IngestRequest, db: AsyncSession = Depends(get_db)):
    return await ingest_exchange(db, req)


@router.get("/buffer-status", response_model=BufferStatusResponse)
async def buffer_status(
    project_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await get_buffer_status(db, project_id)


@router.post("/extract-now", response_model=ExtractNowResponse)
async def extract_now(
    project_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await trigger_batch_extraction(db, project_id)
