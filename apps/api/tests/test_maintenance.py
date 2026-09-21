from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app import worker
from app.domains.edges import service as edge_service
from app.domains.ingest.service import _normalize_paths, _sanitize_text
from app.domains.extraction.agent import _format_conversation
from app.models import Exchange


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _AllResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


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
    assert job.max_attempts == worker.settings.maintenance_max_attempts
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_detect_edges_raises_when_all_llm_batches_fail():
    """A provider outage must fail the job, not report success with zero edges."""
    memories = [
        ("mem_a", "first memory", [0.1, 0.2, 0.3]),
        ("mem_b", "second memory", [0.1, 0.2, 0.4]),
    ]
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            _AllResult(memories),
            _AllResult([("mem_b", 0.1)]),
            _AllResult([("mem_a", 0.1)]),
        ]
    )
    db.commit = AsyncMock()

    outage = AsyncMock(side_effect=RuntimeError("Error 1033: Cloudflare Tunnel error"))

    with patch.object(edge_service.gateway, "complete", outage):
        with pytest.raises(RuntimeError, match="edge detection LLM batch"):
            await edge_service.detect_edges(db)

    db.commit.assert_not_awaited()


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
