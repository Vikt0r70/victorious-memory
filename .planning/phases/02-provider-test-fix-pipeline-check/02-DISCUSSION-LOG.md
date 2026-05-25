# Phase 2: Provider Test Fix & Pipeline Check - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 2-Provider Test Fix & Pipeline Check
**Areas discussed:** Provider Test Validation Strategy, Pipeline Verification Method

---

## Provider Test Validation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-validate config locally | Check empty API key locally → return 400 immediately. Faster feedback. | ✓ (as part of "Both") |
| Always make HTTP call | Let provider reject naturally. More realistic but wastes a round-trip. | |
| Both | Pre-check locally first, then make HTTP call if config looks valid. | ✓ |

**User's choice:** Both (pre-validate locally, then make real HTTP call)
**Notes:** User wants fast feedback for obvious config errors AND real connectivity validation.

| Option | Description | Selected |
|--------|-------------|----------|
| Distinguish both cases | 503 for no config, 400 for empty key. More precise. | |
| Treat both the same | 400 for all config errors. Simpler code. | ✓ |

**User's choice:** Treat both the same (single unified error)
**Notes:** Preferred simplicity over granularity for error responses.

| Option | Description | Selected |
|--------|-------------|----------|
| In the gateway | Reusable validation method in ProviderGateway. | ✓ |
| In test router only | Test-specific validation in endpoint handler. | |

**User's choice:** In the gateway (reusable across test endpoint and extraction worker)
**Notes:** User explicitly wanted reusability over simplicity.

| Option | Description | Selected |
|--------|-------------|----------|
| 400 Bad Request | Most intuitive for missing/empty API key. | ✓ |
| 503 Service Unavailable | Accurate but less intuitive. | |
| 422 Unprocessable Entity | Technically precise but uncommon. | |

**User's choice:** 400 Bad Request
**Notes:** Standard HTTP semantics for client-side configuration errors.

---

## Pipeline Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic script only | Fast, repeatable, no OpenCode dependency. | |
| Real plugin test | Validates real integration but slower. | |
| Both | Synthetic for development, real plugin for integration confidence. | ✓ |

**User's choice:** Both
**Notes:** Wants both automated verification and real-world validation.

| Option | Description | Selected |
|--------|-------------|----------|
| API response only | Confirm POST returns 200. Too limited for SYS-02. | |
| API + DB state | Verify exchange, pending job, activity log in DB. | |
| Full pipeline | Also verify worker picks up job. (Phase 3 scope.) | ✓ |

**User's choice:** Full pipeline
**Notes:** User explicitly overrode scope boundary — worker job pickup included in Phase 2.

| Option | Description | Selected |
|--------|-------------|----------|
| pytest test | Integrates with existing test infrastructure. | ✓ |
| Standalone script | Simple manual verification. | ✓ |
| Both | pytest for CI, standalone for quick checks. | ✓ |

**User's choice:** Both
**Notes:** Wants both automated (pytest) and manual (standalone) verification paths.

---

## the agent's Discretion

- Exact error message wording for configuration errors
- Implementation details of validation method in ProviderGateway
- Database connection method for standalone verification script
- Specific conversation content for real plugin test

## Deferred Ideas

- Database connectivity in /health endpoint — deferred from Phase 1, still out of scope
- Web/MCP startup verification — belongs to Phase 11
- Full extraction and memory creation verification — belongs to Phase 3 (worker job pickup is included here per explicit user override, but LLM extraction → memory storage remains Phase 3)
