# Victorious Memory — Agent Guide

AI memory system for OpenCode: captures conversations via a plugin, extracts memories through LLM pipelines, stores them in PostgreSQL+pgvector, and injects relevant context back into future sessions.

- **Live instance:** https://memory.damra.co (VPS; local stack is a stopped fallback)
- **Repo:** https://github.com/Vikt0r70/victorious-memory

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| API      | Python 3.12, FastAPI, SQLAlchemy async, litellm gateway (`apps/api/`) |
| Web      | Next.js 16, React 19, Tailwind v4 (`apps/web/`)                       |
| DB       | PostgreSQL 16 + pgvector (`docker-compose.yml`)                       |
| MCP      | stdlib JSON-RPC over stdio, 11 tools (`apps/mcp/server.py`)           |
| Plugin   | OpenCode plugin JS (`apps/plugin/victorious.js`)                      |

## Commands

```bash
docker compose up -d              # full stack (api :8080, web :3002, db :5432)
cd apps/web && npx next start -p 3002   # dashboard (prod build) — plain cd, not cd /d
pytest apps/api/tests             # backend tests
npx tsc --noEmit                  # web typecheck (run in apps/web)
./deploy.sh                       # push-to-deploy: ssh → git pull → rebuild → health check
```

Deploy workflow: edit locally → commit → `git push` → `./deploy.sh`. The VPS bind-mounts the API code, so `compose restart api` picks up backend changes without a rebuild.

## Architecture in 60 seconds

```
OpenCode ──plugin──▶ /api/ingest ──▶ extraction_jobs ──▶ worker ──▶ LLM extract ──▶ validator ──▶ memories
                                                                                        │
             injection ◀── /api/context ◀── hybrid search (pgvector HNSW + BM25, RRF k=60) │
                │                                                                          ▼
             plugin mutates system prompt                          edges + consolidation pipelines
```

- **Domain pattern:** every domain lives in `apps/api/app/domains/<name>/{router,service,schemas}.py`
- **Worker** (`apps/api/app/worker.py`): single asyncio loop, dispatches jobs by `kind` column — `extraction` (chunked at 6K tokens/call), `edge_detection`, `consolidation`
- **Schema changes** go in `database.py init_db()` as idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) on top of `create_all` — alembic dirs exist but are NOT used
- **Auth**: open when `MEMORY_API_KEY`/`MEMORY_TRUSTED_IPS` are unset (local dev); enforced on VPS. Never commit keys.

## Memory System — how to use it

### MCP tools (victorious-memory, 11 tools)

| Tool                 | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `search_memories`    | Hybrid semantic search — use before assuming something is new |
| `get_context`        | The exact block that gets injected into prompts                |
| `save_memory`        | Persist a decision/preference/lesson — scope it properly       |
| `list_memories`      | Browse/filter by project, type, status                         |
| `get_activity`       | What extraction/approval/rejection happened recently           |
| `approve_memory` / `reject_memory` | Review-queue management                          |
| `get_stats`          | Counts by status/type                                          |
| `trigger_extraction` | Force extraction of pending exchanges                          |
| `run_edge_detection` | Build/refresh the relationship graph                           |
| `run_consolidation`  | Near-dup merge + staleness sweep                               |

**When to save a memory:** decisions (with rationale), user preferences stated explicitly, constraints, non-obvious bugfixes/lessons. Content must be a complete standalone statement (~10+ words) — never bare tags or file names (validator rejects substanceless candidates).

**Scoping:** `scope=global` for cross-project truths; `project_id=<slug>` for project-specific facts. When unsure, prefer global with the project named in the content.

### Plugin behavior (what happens automatically)

- Captures exchanges (user message + assistant/tool parts), flushes on boundaries or at 3000-token cap
- Injects a `[VICTORIOUS MEMORY]` context block into every system prompt (pinned high-confidence tier + query-relevant matches)
- Resilient by contract: hard timeouts on every call, circuit breaker, offline queue (`~/.victorious/queue.jsonl`) with auto-replay, kill switch `VICTORIOUS_DISABLED=1`
- Config: `~/.victorious/config.json` `{api_url, api_key}` overrides env vars, hot-reloaded — endpoint changes don't need a restart
- Logs: `~/.victorious/plugin.log` (JSONL), console debug via `VICTORIOUS_DEBUG=1`
- DCP/compression artifacts (`[Compressed conversation section]` etc.) are filtered from capture

## Conventions (short version)

- Python: `snake_case`, `from __future__ import annotations`, pipe unions (`str | None`), module docstrings, `# ─── Section ───` dividers, services take `AsyncSession` first param and return `None`/`False` for not-found (routers raise `HTTPException`)
- Web: TypeScript strict, `"use client"` when hooks used, components ≤ ~350 lines, API calls only through `apps/web/lib/api.ts` (has timeout + friendly errors)
- No comments unless explaining "why"; match surrounding style
- Pre-existing LSP noise exists (dict generics, ModelResponse union) — don't chase it
