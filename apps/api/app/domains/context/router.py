from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.domains.context.schemas import ContextResponse
from app.domains.context.service import build_context

router = APIRouter(prefix="/context", tags=["context"])


@router.get("", response_model=ContextResponse)
async def get_context(
    project_id: str | None = None,
    query: str | None = None,
    tokens: int = 1500,
    session_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await build_context(db, project_id, query, tokens)
