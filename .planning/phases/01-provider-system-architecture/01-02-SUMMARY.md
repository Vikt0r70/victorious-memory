---
phase: 01-provider-system-architecture
plan: 02
type: gap_closure
subsystem: providers
tags: [gap-closure, backend, security, testing, primary_provider_id, seed-roles]
dependencies:
  requires: [PROV-05, PROV-07]
  provides: [primary_provider_id persistence, correct seed roles, security hardening]
  affects: [gateway, service, models, encryption, tests]
tech-stack:
  added: []
  patterns: [SQLAlchemy FK, Alembic, Fernet, LiteLLM, pytest]
key-files:
  created:
    - apps/api/alembic/versions/f124433a6086_add_agent_primary_provider_id.py
  modified:
    - apps/api/app/models.py
    - apps/api/app/domains/providers/service.py
    - apps/api/app/domains/providers/encryption.py
    - apps/api/app/domains/providers/gateway.py
    - apps/api/tests/test_e2e_phase1.py
    - apps/api/tests/test_provider_service.py
    - apps/api/tests/test_fallback.py
decisions: []
metrics:
  duration: "7 minutes"
  completed_date: "2026-05-26"
  tasks_completed: 8
  files_modified: 7
  lines_changed: "+400/-130"
  tests_added: 8
---

# Phase 01 Plan 02: Gap Closure — Summary

**One-liner:** Fixed 2 PROV gaps and 5 review findings: added `primary_provider_id` FK with persistence and chain ordering, corrected seed-agent roles, scrubbed a hardcoded API key, hardened encryption-key permissions, and moved LiteLLM retry config to module level — 38 tests passing.

## Results

### Gaps Closed

| Gap | Issue | Fix | Status |
|-----|-------|-----|--------|
| PROV-05 | `seed_default_agents()` seeded wrong roles (`planner`, `researcher`, `executor`) | Changed to `extraction`, `edge_detection`, `consolidation` | Fixed |
| PROV-07 (backend) | `primary_provider_id` not persisted; not used at runtime | Added DB column + FK, persisted in `update_agent_settings()`, prepended in `resolve_provider_chain()` | Fixed |

### Review Findings Addressed

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 3 | Hardcoded API key in `test_e2e_phase1.py` | Security | Replaced with `os.environ.get("E2E_API_KEY")`, wrapped in test function with `@pytest.mark.skipif` |
| 4 | `resolve_provider_chain()` ignored `primary_provider_id` | Logic | Rewrote to prepend primary, deduplicate, preserve order |
| 5 | `.encryption_key` world-readable | Security | Added `os.chmod(key_path, 0o600)` after file creation |
| 6 | `litellm.num_retries` mutated per instantiation | Bug | Moved to module level — set once at import time |

## Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `grep -c "primary_provider_id" apps/api/app/models.py` >= 1 | Passed (3 lines added) |
| 2 | `grep "default_roles = "` shows correct roles | Passed |
| 3 | No hardcoded API key in `test_e2e_phase1.py` | Passed (0 matches) |
| 4 | `os.chmod` with `0o600` in `encryption.py` | Passed |
| 5 | `litellm.num_retries` at module level only | Passed (1 occurrence) |
| 6 | All 38 tests pass: `pytest apps/api/tests/ -x -q --ignore=test_e2e_phase1.py` | Passed |
| 7 | Backend starts: `from app.main import app; print('OK')` | Passed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seed test mock used wrong MagicMock chain**
- **Found during:** Task 8
- **Issue:** `seed_default_agents()` uses `result.scalars().first()` but mock helper returned `scalar_one_or_none` pattern. MagicMock `.first()` returned truthy default, causing seed to skip.
- **Fix:** Created a proper mock chain with `scalars().first()` returning `None`.
- **Files modified:** `tests/test_provider_service.py`
- **Commit:** `ffc5a0c`

**2. [Rule 1 - Bug] Context7 fallback not available; used existing code patterns**
- **Found during:** All tasks
- **Issue:** The Context7 MCP tools are unavailable in this environment, but all libraries used (SQLAlchemy, Alembic, litellm, cryptography) are already known/integrated.
- **Fix:** Relied on existing codebase patterns, documentation, and verified code to make correct edits.

## Known Stubs

No new stubs introduced. All changes are functional — no placeholder values, empty arrays, or unwired data paths.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| None | — | All changes are internal fixes, hardening, or test improvements — no new attack surface introduced. |

## Self-Check: PASSED

- [x] `apps/api/app/models.py` — `primary_provider_id` column exists
- [x] `apps/api/alembic/versions/f124433a6086_add_agent_primary_provider_id.py` — migration created and applied
- [x] `apps/api/app/domains/providers/service.py` — `update_agent_settings` persists `primary_provider_id`; `resolve_provider_chain` prepends primary
- [x] `apps/api/app/domains/providers/service.py` — `seed_default_agents` uses correct roles
- [x] `apps/api/tests/test_e2e_phase1.py` — no hardcoded key, wrapped in test function
- [x] `apps/api/app/domains/providers/encryption.py` — `os.chmod(key_path, 0o600)` added
- [x] `apps/api/app/domains/providers/gateway.py` — `litellm.num_retries = 0` at module level
- [x] `apps/api/tests/test_provider_service.py` — 17 tests pass (4 new)
- [x] `apps/api/tests/test_fallback.py` — 5 tests pass (1 new)
- [x] Full suite: 38 passed, 0 failed

## Commits

| Hash | Message |
|------|---------|
| `35613c0` | `feat(phase-01-02): add primary_provider_id to Agent model` |
| `503aff4` | `feat(phase-01-02): add alembic migration for primary_provider_id` |
| `3748517` | `feat(phase-01-02): persist primary_provider_id and update chain resolution` |
| `b9c06ce` | `fix(phase-01-02): seed correct agent roles (extraction, edge_detection, consolidation)` |
| `c299891` | `fix(phase-01-02): scrub hardcoded API key from E2E test` |
| `b02201c` | `fix(phase-01-02): set restrictive 0o600 permissions on .encryption_key` |
| `6392b76` | `fix(phase-01-02): move litellm.num_retries to module level` |
| `ffc5a0c` | `test(phase-01-02): add tests for primary_provider_id and seed roles` |
