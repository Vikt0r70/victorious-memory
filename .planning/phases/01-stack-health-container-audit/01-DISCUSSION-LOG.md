# Phase 1: Stack Health & Container Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 1-stack-health-container-audit
**Areas discussed:** Health Check Mechanism, Brave MCnulty Investigation, Startup Scope, Health Endpoint Depth
**Mode:** --auto (autonomous, all areas auto-selected, recommended options chosen)

---

## Health Check Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Docker healthcheck for db (exists) + add HTTP healthcheck for api | Add `healthcheck` block to api service using curl against /health. db already has pg_isready. | ✓ |
| Docker healthcheck only | Verify existing db healthcheck, add similar for api but no HTTP verification | |
| Manual inspection only | Run `docker compose up -d` and visually check for errors | |

**Agent's choice:** Docker healthcheck for db (exists) + add HTTP healthcheck for api — recommended default.
**Notes:** The `db` service healthcheck pattern (interval: 5s, timeout: 5s, retries: 5) should be reused for the api service. `curl` is available in the python:3.12-slim image (or can be installed). The api depends_on db with `condition: service_healthy` — this order must hold.

---

## Brave MCnulty Investigation

| Option | Description | Selected |
|--------|-------------|----------|
| Quick scan (docker ps, image, labels, ports) | Identify the container via Docker metadata. Document purpose if identifiable. | ✓ |
| Full forensic (inspect labels, env, network, volumes, processes) | Deep investigation including running processes and volume contents | |
| Skip for now | Note the unknown container and revisit later | |

**Agent's choice:** Quick scan — recommended default.
**Notes:** Brave MCnulty is NOT defined in this project's docker-compose.yml. It's a mystery container on the host system. The goal is documentation (SYS-07), not deep analysis. If the quick scan is inconclusive, escalate to a more thorough check.

---

## Startup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| docker-compose services only (api + db) | Verify only the 2 services defined in docker-compose.yml | ✓ |
| All services including web, mcp, plugin | Verify the full stack including separately-started services | |
| Docker + health endpoint only | Verify compose starts, curl /health, skip plugin/mcp entirely | |

**Agent's choice:** docker-compose services only — recommended default.
**Notes:** Web dashboard, MCP server, and plugin are started separately (not via Docker Compose) and verified in later phases (Phase 11 for Plugin/MCP, Phase 8-9 for web UX). The ROADMAP says "Docker Compose stack starts cleanly" — the compose file defines api + db only.

---

## Health Endpoint Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Verify existing /health returns 200 | Current behavior: static `{"status": "ok"}` response | ✓ |
| Add db connectivity check | Modify /health to ping database (SELECT 1) | |
| Full readiness probe | Check db, embedding model, LLM provider connectivity | |

**Agent's choice:** Verify existing /health returns 200 — recommended default.
**Notes:** The current `/health` endpoint returns a static 200. A database connectivity check would be a useful improvement but is not required for Phase 1. This is noted as a deferred idea for Phase 2 or a later infrastructure phase.

---

## the agent's Discretion

- Exact healthcheck command for api service (curl vs wget, interval/timing)
- Whether to add `.healthcheck` script or inline the command
- Investigation order for Brave MCnulty (docker inspect first vs docker ps first)
- Whether to create a separate verification document

## Deferred Ideas

- **Database connectivity in /health endpoint** — Future improvement for Phase 2 or later
- **Web/MCP/Plugin startup verification** — Phase 11 scope, not this phase
- **Automated healthcheck test suite** — CI-friendly approach, out of scope for initial audit
