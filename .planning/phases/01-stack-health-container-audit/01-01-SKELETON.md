# Walking Skeleton — Victorious Memory V2

**Phase:** 1
**Generated:** 2026-05-25

## Capability Proven End-to-End

Docker Compose stack (api + db) starts cleanly with all containers reporting healthy, and the API health endpoint responds correctly — establishing the verified infrastructure baseline for all subsequent phases.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | FastAPI 0.115+ (Python 3.12) | Already established. Async support, Pydantic validation, lifespan management. Mounted at `apps/api/`. |
| Data layer | PostgreSQL 16 + pgvector (SQLAlchemy 2.0 + asyncpg) | Already established. Vector embeddings via pgvector extension. 9 ORM models in single `models.py`. |
| Auth | None — open API (localhost/network isolation) | Already established — PROJECT.md constraint. CORS allows all origins. Security through localhost boundary. |
| Deployment target | Docker Compose on local desktop | Already established. Two services: `api` (Python, port 8080) and `db` (pgvector/pgvector:pg16, port 5432). |
| Directory layout | Monorepo: `apps/api/`, `apps/web/`, `apps/mcp/`, `apps/plugin/` | Already established. API is the only Dockerized component. Web, MCP, and Plugin run separately. |
| Container health | Docker healthcheck with HTTP probe | Phase 1 decision (D-01). api: `curl -f http://localhost:8080/health`. db: `pg_isready -U victorious`. Pattern: interval 5-10s, timeout 5-10s, retries 5-10. |
| Embeddings | In-process sentence-transformers (BAAI/bge-small-en-v1.5) | Already established. Model cached in Docker volume `hf_cache`. No separate embedding service (despite `.env.example` referencing `EMBEDDING_URL`). |
| LLM provider | Pluggable — OpenAI-compatible + Anthropic gateways | Already established. Configured via `provider_configs` DB table + env fallback. Not exercised in Phase 1. |
| Plugin framework | @opencode-ai/plugin 1.15.10 | Already established. 5 lifecycle hooks. Started separately — not in Docker Compose. |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — ALREADY EXISTS, not created in this phase
- [x] Routing — GET /health at port 8080 verified working
- [x] Database — PostgreSQL starts, `pg_isready` healthcheck passes, DB init runs on startup
- [x] UI — Health endpoint returns JSON; no web UI interaction in this phase (web dashboard verified in Phase 8-9)
- [x] Deployment — `docker compose up -d` is the documented local full-stack run command

## Out of Scope (Deferred to Later Slices)

- Database connectivity check in /health endpoint — Phase 2 or later infrastructure hardening
- Web dashboard startup verification — Phase 8-9
- MCP server verification — Phase 11
- Plugin verification — Phase 2, Phase 11
- Provider/LLM connectivity testing — Phase 2
- Authentication/rate limiting — not planned for v1
- CI/CD pipeline — not planned for v1
- VPS deployment — deferred (local desktop first per PROJECT.md)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Provider test endpoint returns meaningful errors + plugin captures real exchanges → DB rows appear
- Phase 3: Extraction worker processes jobs end-to-end (LLM → memory candidates → store)
- Phase 4: Context retrieval returns formatted blocks for system prompt injection
- Phase 5: Unified provider registry replaces per-agent configs
- Phase 6: Dynamic model lists fetched from provider APIs
- Phase 7: Provider schema auto-detection for correct API payloads
- Phase 8: UX fixes — cursor indicators, button styling, clickable feedback
- Phase 9: UX fixes — table layout stability, auto-approve section behavior
- Phase 10: Memory lifecycle verification (decay, consolidation, conflicts)
- Phase 11: Plugin & MCP integration verification
- Phase 12: Cleanup & final end-to-end verification
