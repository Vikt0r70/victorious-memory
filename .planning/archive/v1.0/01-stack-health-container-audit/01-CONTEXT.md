# Phase 1: Stack Health & Container Audit - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

## Phase Boundary

Confirm the Docker Compose stack starts cleanly and all services are healthy. Identify and document the unknown "Brave MCnulty" container. Verify the API health endpoint responds correctly.

**Requirements covered:** SYS-01 (Docker Compose stack health), SYS-07 (Brave MCnulty identification)

**Success criteria from ROADMAP.md:**
1. `docker compose up -d` starts all containers without errors
2. All containers report healthy within 30 seconds
3. Brave MCnulty container identified and documented
4. `GET /health` returns 200 on the API

## Implementation Decisions

### Container Health Verification
- **D-01:** Add a Docker healthcheck to the `api` service in `docker-compose.yml` using `curl` or `wget` against `GET http://localhost:8080/health`. The `db` service already has a `pg_isready` healthcheck.
- **D-02:** Verify health via `docker compose ps` — both containers must show `healthy` status within 30 seconds of `docker compose up -d`.
- **D-03:** Do not add database connectivity check to the `/health` endpoint at this stage. The current static `{"status": "ok"}` response is sufficient. A deeper DB-ping health check is noted as a future improvement.

### Brave MCnulty Investigation
- **D-04:** Use quick scan approach: `docker ps` to list the container, `docker inspect` for image name, labels, environment variables, and exposed ports. Document purpose if identifiable.
- **D-05:** If unidentifiable via Docker metadata, check running processes inside the container (`docker exec ... ps aux` or `docker top`). Goal is documentation, not deep forensic analysis.
- **D-06:** Document findings in the CONTEXT.md or a verification document within the phase directory. No code changes expected.

### Startup Scope
- **D-07:** Verify only the Docker Compose services (`api` + `db`). The docker-compose.yml defines exactly these two services. The web dashboard, MCP server, and plugin are started separately and verified in later phases (Phase 11 for Plugin/MCP, Phase 8-9 for web UX).
- **D-08:** The `api` service depends on `db` with `condition: service_healthy` — this dependency order must be respected during startup verification.

### Verification Approach
- **D-09:** Verification is manual/observational — run `docker compose up -d`, observe output for errors, check `docker compose ps` for health status, curl `GET /health`, investigate Brave MCnulty.
- **D-10:** No automated test execution required for this phase. The existing `apps/api/tests/test_e2e_phase1.py` may be relevant for reference but is not required to pass.

### the agent's Discretion
- Exact command to add the healthcheck to the api service (curl vs wget, interval/timing values).
- Whether to add a `.healthcheck` script or inline the command.
- Investigation order for Brave MCnulty (docker inspect first vs docker ps first).
- Whether to create a separate verification document or inline findings in the plan.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/ROADMAP.md` — Phase 1 definition, success criteria, requirement traceability
- `.planning/REQUIREMENTS.md` — SYS-01 and SYS-07 detailed requirements
- `.planning/PROJECT.md` — Project context, constraints, known concerns

### Infrastructure
- `docker-compose.yml` — Service definitions (api + db), healthchecks, volumes, dependencies
- `apps/api/Dockerfile` — API container build definition
- `apps/api/app/main.py` § health endpoint — `GET /health` implementation (returns `{"status": "ok", "version": "0.1.0"}`)

### Codebase Maps
- `.planning/codebase/STACK.md` — Runtime, dependencies, configuration keys
- `.planning/codebase/ARCHITECTURE.md` — System overview, component responsibilities, data flow
- `.planning/codebase/INTEGRATIONS.md` — External services, health check patterns

## Existing Code Insights

### Reusable Assets
- `docker-compose.yml`: Already defines db healthcheck (`pg_isready` every 5s, 5 retries) — use as pattern for api healthcheck.
- `apps/api/app/main.py`: Health endpoint at line ~88, returns `{"status": "ok", "version": "0.1.0"}` — ready to be probed.

### Established Patterns
- Docker healthcheck pattern: `test: ["CMD-SHELL", "..."]`, `interval: 5s`, `timeout: 5s`, `retries: 5`.
- Service dependency pattern: `depends_on` with `condition: service_healthy`.
- Restart policy: `unless-stopped` on both services.

### Integration Points
- API listens on port 8080 (mapped `8080:8080`). Health check must use internal port.
- db listens on port 5432 (mapped `5432:5432`).
- HuggingFace model cache volume (`hf_cache`) mounted at `/root/.cache/huggingface`.
- DNS servers configured as `8.8.8.8` and `8.8.4.4` on the api service — necessary for model downloads from HuggingFace Hub.

## Specific Ideas

No specific requirements — open to standard Docker healthcheck approaches. The existing `db` healthcheck is the reference pattern.

## Deferred Ideas

- **Database connectivity in /health endpoint** — Adding a `SELECT 1` or `pg_isready` call to the `/health` response for deeper readiness probing. Deferred to Phase 2 (Provider Test Fix) or a later infrastructure hardening phase.
- **Web/MCP/Plugin startup verification** — These are started separately from Docker Compose and are verified in Phase 11. Not part of this phase's scope.
- **Automated healthcheck test suite** — Writing automated tests that verify container health via Docker SDK. Could be useful for CI but out of scope for this initial audit.

---

*Phase: 1-Stack Health & Container Audit*
*Context gathered: 2026-05-25*
