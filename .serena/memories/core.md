# Victorious Memory 2V — Core

Monorepo AI memory system that captures, structures, and retrieves knowledge from coding conversations.

## Architecture

```
Victorious Memory 2V/
├── apps/
│   ├── api/          # FastAPI backend (Python 3.12)
│   ├── web/          # Next.js 16 dashboard (TypeScript, Tailwind 4)
│   └── mcp/          # MCP server exposing 5 tools for manual memory interaction
├── docker-compose.yml  # API + pgvector/pg16 database
└── .env.example        # Template for required env vars
```

## Backend domain modules (`apps/api/app/domains/`)
- `ingest/` — exchange ingestion endpoints, service, schemas
- `extraction/` — LLM extraction agent + candidate validator
- `memories/` — memory CRUD, search (BM25 + embeddings via `search/`)
- `context/` — context block assembly for LLM injection
- `projects/` — project management
- `providers/` — LLM provider management, encryption, agent seeding
- `search/` — BM25 hybrid search + embeddings service
- Standalone routers: `activity_router`, `jobs_router`, `exchanges_router`, `graph_router`, `settings_router`, `system_router`

## Key backend files
- `app/main.py` — FastAPI entrypoint, lifespan, CORS, router mounting
- `app/models.py` — ~450-line SQLAlchemy ORM models (pgvector, UUID-prefixed IDs)
- `app/worker.py` — Background extraction worker (asyncio task, polls job queue, claims via `FOR UPDATE SKIP LOCKED`)
- `app/database.py` — Async engine, session factory, pgvector extension init, `get_db` dependency
- `app/config.py` — Pydantic Settings from `.env`

## Data flow
1. Exchanges ingested → extraction jobs queued
2. Worker polls job queue → LLM extracts candidate memories
3. Candidates validated (duplicate/conflict checks)
4. Valid memories stored with embeddings + BM25 index
5. Context service assembles context blocks for downstream LLM consumption

## Web dashboard
Next.js 16 app with routes at `/projects`, `/memories`, `/review`, `/activity`, `/settings`, `/system`, `/graph`, `/jobs`, `/exchanges`
