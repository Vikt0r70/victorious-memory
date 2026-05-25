# Testing Patterns

**Analysis Date:** 2026-05-25

## Test Framework

**Python Runner:**
- Framework: `pytest` >= 8.0.0 (declared in `apps/api/pyproject.toml` dev dependencies)
- Async support: `pytest-asyncio` >= 0.24.0 (declared in dev dependencies)
- Config: No `pytest.ini`, `setup.cfg`, or `pyproject.toml [tool.pytest]` section detected — uses pytest defaults
- HTTP client in tests: `httpx` >= 0.28.0 (in dev dependencies, though not used in the single existing test)

**TypeScript Runner:**
- No test framework configured — no `jest`, `vitest`, or equivalent in `apps/web/package.json`
- No test scripts defined beyond `lint`

**Run Commands (Python):**
```bash
# Run all tests (theoretical — no configured test discovery)
pytest apps/api/tests/

# Run the single E2E test
pytest apps/api/tests/test_e2e_phase1.py -v
```

## Test File Organization

**Location:**
- Python: `apps/api/tests/` — separate directory from source code
- TypeScript: No test files exist

**Naming:**
- Test files: `test_*.py` prefix pattern
- Test functions: no standard pattern established (the single test file uses procedural flow, not individual test functions)

**Current Structure:**
```
apps/api/
├── tests/
│   └── test_e2e_phase1.py    # Single E2E test (141 lines)
├── app/
│   ├── main.py
│   ├── models.py
│   └── domains/...
└── pyproject.toml
```

**TypeScript (none):**
- No `*.test.ts`, `*.spec.ts`, `__tests__/` directories found anywhere

## Test Structure

**E2E Test Pattern:** `apps/api/tests/test_e2e_phase1.py`

The single test is procedural and sequential — not using pytest fixtures or test functions:

```python
"""
Phase 1 End-to-End Test
Runs against the local Docker stack at http://localhost:8080
"""

import json, time, sys, urllib.request, urllib.error

BASE = "http://localhost:8080/api"

def req(method, path, body=None):
    """HTTP helper — sends JSON requests, returns (status, parsed_response)."""
    ...

def check(label, condition, detail=""):
    """Assertion helper — prints ✅/❌ and exits on failure."""
    if condition:
        print(f"  ✅ {label}")
    else:
        print(f"  ❌ {label} {detail}")
        sys.exit(1)

# Procedural steps:
# 1. Configure LLM provider (PUT /providers/extraction)
# 2. Detect project (POST /projects/detect)
# 3. Ingest exchange (POST /ingest)
# 4. Wait for extraction worker (poll GET /memories)
# 5. Test context endpoint (GET /context)
# 6. Check activity log (GET /activity)
```

**Key characteristics of existing test style:**
- Runs against a **live Docker deployment** at `localhost:8080` — requires full stack to be running
- Uses `urllib.request` from stdlib (no `requests` or `httpx` library)
- Custom `check()` function instead of `assert` statements — prints descriptive labels
- Hardcoded test data inline (API key, project path, exchange content)
- Polling loop with `time.sleep()` for async background worker completion
- Sequential step numbering (`Step 1... Step 6`) with section headers
- Exit code 1 on any assertion failure (not test runner aggregating failures)

## Mocking

**Current state:** No mocking framework or patterns established.

- No `unittest.mock` usage detected
- No monkeypatching, no dependency injection for test doubles
- The sole E2E test tests real infrastructure end-to-end — no mocking
- `pytest-mock` not in dev dependencies

## Fixtures and Factories

**Current state:** No test fixtures, factories, or test data helpers.

- No `conftest.py` file anywhere in the project
- No test data files (JSON fixtures, YAML, etc.)
- All test data is embedded inline in the single E2E test
- ID generation in models uses `_generate_id("prefix")` — could be seeded for deterministic testing but currently isn't

**Test data embedded inline:** `apps/api/tests/test_e2e_phase1.py`
```python
req("POST", "/ingest", {
    "project_id": project_id,
    "session_id": "test-session-e2e-001",
    "exchange": {
        "user": "I've decided we should use PostgreSQL instead of SQLite...",
        "agent_parts": [
            {"type": "text", "content": "Excellent choice...", "timestamp": "2026-05-24T12:00:00Z"},
            {"type": "tool_call", "tool": "write_to_file", "content": "[write_to_file completed...]", "timestamp": "2026-05-24T12:00:05Z"}
        ],
        "file_paths": ["/workspace/my-test-project/src/database.py"],
        "timestamp": "2026-05-24T12:00:00Z"
    }
})
```

## Coverage

**Current state:** No coverage tooling configured.

- No coverage threshold enforced
- No `coverage.py`, `pytest-cov`, or equivalent in dev dependencies
- No coverage reporting commands defined

## Test Types

**Unit Tests:**
- **None** — no unit tests for Python services, domain logic, or models
- Services like `apps/api/app/domains/memories/service.py` (236 lines of CRUD logic) are completely untested in isolation
- Search, BM25 ranking, embedding, validation — all untested at unit level

**Integration Tests:**
- **None** — no database integration tests (no test database, no SQLAlchemy test fixtures)
- No API-level integration tests using FastAPI `TestClient`

**E2E Tests:**
- **1 test file:** `apps/api/tests/test_e2e_phase1.py` (141 lines)
- Tests the full stack: provider config → ingestion → extraction worker → memory retrieval → context building → activity logging
- Requires Docker stack running (`docker-compose.yml`)
- Covers the "happy path" for one specific scenario
- Not runnable in CI without a full Docker deployment

**Frontend Tests:**
- **None** — zero tests for React components, pages, or API client
- No Playwright, Cypress, or React Testing Library dependencies

## Common Patterns

**Async Testing (not yet established):**
Since `pytest-asyncio` is declared but unused, the expected pattern would be:
```python
@pytest.mark.asyncio
async def test_create_memory():
    # async test logic
    ...
```

**Error Testing (not yet established):**
No patterns for testing error paths exist. Based on service patterns, expected approach:
```python
# Service returns None on not-found
result = await get_memory(db, "nonexistent")
assert result is None

# Router raises HTTPException
with pytest.raises(HTTPException) as exc:
    await get_one("nonexistent", db)
assert exc.value.status_code == 404
```

**Database Testing (not yet established):**
The database layer (`apps/api/app/database.py`) provides `get_db()` as a FastAPI dependency using `async_sessionmaker`. A test fixture pattern could be:
```python
@pytest.fixture
async def db():
    from app.database import async_session
    async with async_session() as session:
        yield session
        await session.rollback()
```

## Gaps Summary

| Area | Status | Priority |
|------|--------|----------|
| Unit tests — Python services | Missing entirely | High |
| Unit tests — Python models | Missing entirely | Medium |
| Unit tests — BM25 ranking | Missing entirely | Medium |
| Unit tests — validation pipeline | Missing entirely | High |
| Integration tests — API endpoints | Missing entirely | High |
| Frontend tests — React components | Missing entirely | Medium |
| Frontend tests — API client | Missing entirely | Low |
| E2E tests — additional scenarios | Only 1 file | Medium |
| Test fixtures/factories | None | High |
| Coverage reporting | None | Low |
| CI test automation | None | Low |

---

*Testing analysis: 2026-05-25*
