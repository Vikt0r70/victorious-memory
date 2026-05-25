"""Shared pytest fixtures for the API test suite."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


@pytest.fixture
def mock_db():
    """Return a mock AsyncSession with common helpers pre-wired."""
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.delete = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def client(mock_db):
    """FastAPI TestClient with DB dependency overridden."""
    from app.database import get_db

    async def _override_get_db() -> AsyncIterator[MagicMock]:
        yield mock_db

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
