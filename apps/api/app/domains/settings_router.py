"""App settings key-value store router."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AppSetting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingValueRequest(BaseModel):
    value: dict | list | str | int | float | bool


@router.get("")
async def list_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting).order_by(AppSetting.key))
    settings = result.scalars().all()
    return {
        "items": [
            {
                "key": s.key,
                "value": s.value,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in settings
        ]
    }


@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, f"Setting '{key}' not found")
    return {
        "key": s.key,
        "value": s.value,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.put("/{key}")
async def upsert_setting(key: str, req: SettingValueRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    s = result.scalar_one_or_none()

    # Wrap non-dict values in a dict for JSONB storage
    value = req.value if isinstance(req.value, dict) else {"value": req.value}

    if s is None:
        s = AppSetting(key=key, value=value)
        db.add(s)
    else:
        s.value = value
        s.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(s)
    return {
        "key": s.key,
        "value": s.value,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.delete("/{key}", status_code=204)
async def delete_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, f"Setting '{key}' not found")
    await db.delete(s)
    await db.flush()
