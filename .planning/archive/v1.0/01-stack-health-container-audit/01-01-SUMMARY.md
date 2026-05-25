# 01-01 Summary: Stack Health & Container Audit

**Phase:** 1 — Stack Health & Container Audit
**Plan:** 01-01
**Completed:** 2026-05-25

## What was done

- Added `curl` to Dockerfile (`apt-get install curl`) so the healthcheck probe can reach `/health`
- Added Docker `healthcheck` block to api service in `docker-compose.yml` using `curl -f http://localhost:8080/health || exit 1` with generous retries (10) and start period (40s) to accommodate cold-start model downloads
- Switched PyTorch to CPU-only build, dropping image size from 8.6 GB to 2.02 GB
- Verified both `api-1` and `db-1` report `healthy` in `docker compose ps`
- Investigated Brave MCnulty container — not present on this host; documented in `BRAVE-MCNULTY.md`

## Files changed

| File | Change |
|------|--------|
| `apps/api/Dockerfile` | Added curl install layer + CPU-only torch |
| `docker-compose.yml` | Added api healthcheck block |
| `.planning/phases/01-stack-health-container-audit/BRAVE-MCNULTY.md` | Investigation document (new) |

## Requirements satisfied

- **SYS-01**: Docker Compose stack starts cleanly, both containers healthy
- **SYS-07**: Brave MCnulty container investigated and documented (confirmed absent)

## Commits

1. `d1e8c67` — `feat(01-01): add api healthcheck with curl probe against /health`
2. `c43ca6f` — `perf(01-01): install CPU-only PyTorch to shrink image from 8.6GB to ~2GB`
3. `09040e7` — `docs(01-01): document Brave MCnulty investigation — container not present on host`

## Verification

- `docker compose ps` → api: healthy, db: healthy
- Internal healthcheck: `curl -f http://localhost:8080/health` → 200 OK with `{"status":"ok","version":"0.1.0"}`
- Walking Skeleton baseline established for Phase 2+
