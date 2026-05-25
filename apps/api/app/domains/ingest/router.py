from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.domains.ingest.schemas import IngestRequest, IngestResponse
from app.domains.ingest.service import ingest_exchange

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
async def ingest(req: IngestRequest, db: AsyncSession = Depends(get_db)):
    return await ingest_exchange(db, req)
