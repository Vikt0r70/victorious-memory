from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app import worker
from app.domains.ingest.service import _normalize_paths, _sanitize_text
from app.domains.extraction.agent import _format_conversation
from app.models import Exchange


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


@pytest.mark.parametrize(
    ("value", "expected"),
    [("clean text", "clean text"), ("before\x00after", "beforeafter")],
)
def test_sanitize_text_removes_postgres_nul_bytes(value, expected):
    assert _sanitize_text(value) == expected


def test_normalize_paths_removes_nul_bytes_and_normalizes_separators():
    assert _normalize_paths(["C:\\work\x00\\app", "C:/work/app"]) == [
        "C:/work/app",
    ]


def test_oversized_exchange_is_bounded_for_llm_prompt():
    exchange = Exchange(
        id="exchange_1",
        session_id="session_1",
        user_content="x" * 100_000,
        agent_parts=[],
    )

    prompt = _format_conversation([exchange])

    assert len(prompt) < 13_000
    assert "conversation content truncated for prompt size" in prompt


def test_oversized_exchange_estimate_is_bounded_for_chunking():
    exchange = Exchange(
        id="exchange_1",
        session_id="session_1",
        user_content="x" * 100_000,
        agent_parts=[],
    )

    assert worker._estimate_exchange_tokens(exchange) < 4_000


@pytest.mark.asyncio
async def test_enqueue_maintenance_job_creates_job_when_due():
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            _ScalarResult(None),
            _ScalarResult(None),
            _ScalarResult(None),
            _ScalarResult("exchange_1"),
        ]
    )
    db.commit = AsyncMock()
    session_context = MagicMock()
    session_context.__aenter__ = AsyncMock(return_value=db)
    session_context.__aexit__ = AsyncMock(return_value=None)

    with patch.object(worker, "async_session", return_value=session_context):
        queued = await worker._enqueue_maintenance_job("consolidation", 3600)

    assert queued is True
    job = db.add.call_args.args[0]
    assert job.kind == "consolidation"
    assert job.exchange_id == "exchange_1"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_enqueue_maintenance_job_skips_active_job():
    db = MagicMock()
    db.execute = AsyncMock(side_effect=[_ScalarResult("job_1")])
    db.commit = AsyncMock()
    session_context = MagicMock()
    session_context.__aenter__ = AsyncMock(return_value=db)
    session_context.__aexit__ = AsyncMock(return_value=None)

    with patch.object(worker, "async_session", return_value=session_context):
        queued = await worker._enqueue_maintenance_job("edge_detection", 3600)

    assert queued is False
    db.add.assert_not_called()
    db.commit.assert_not_awaited()
