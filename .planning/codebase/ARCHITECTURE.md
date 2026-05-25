<!-- refreshed: 2026-05-25 -->
# Architecture

**Analysis Date:** 2026-05-25

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      Client Integration Layer                         │
├─────────────────────┬──────────────────────┬─────────────────────────┤
│  OpenCode Plugin     │   MCP Server          │   Web Dashboard        │
│  `apps/plugin/`      │   `apps/mcp/`         │   `apps/web/`          │
│  (JS, auto-capture)  │   (Python, 5 tools)   │   (Next.js 16, React)  │
└──────────┬───────────┴──────────┬───────────┴───────────┬─────────────┘
           │                      │                        │
           ▼                      ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API Layer (FastAPI)                               │
│                     `apps/api/app/main.py`                            │
│                                                                       │
│  Routers (11 total):                                                  │
│  /api/ingest  /api/memories  /api/context  /api/projects             │
│  /api/providers  /api/activity  /api/jobs  /api/exchanges           │
│  /api/graph  /api/settings  /api/system                              │
│                                                                       │
│  Background Worker: `apps/api/app/worker.py`                         │
│  (asyncio task — no Redis/Celery)                                    │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Domain Services & Agents                                             │
│  `apps/api/app/domains/`                                              │
│                                                                       │
│  extraction/agent.py  ── LLM prompt → MemoryCandidate[]               │
│  extraction/validator.py ── dedup, grounding, auto-approve            │
│  search/service.py    ── hybrid (semantic + BM25)                     │
│  context/service.py   ── builds system-prompt injection block         │
│  providers/gateway.py ── routes LLM calls (OpenAI/Anthropic)          │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Data Layer                                                           │
│                                                                       │
│  Database: `apps/api/app/database.py` → async SQLAlchemy              │
│  Models:   `apps/api/app/models.py` → 9 ORM tables                    │
│  Store:    PostgreSQL 16 + pgvector (`docker-compose.yml`)            │
│  Embedding: sentence-transformers in-process (BAAI/bge-small-en-v1.5) │
│  Config:   `apps/api/app/config.py` → Pydantic Settings from env      │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI App | Lifespan management, CORS, router mounting | `apps/api/app/main.py` |
| Config | Centralized env-var settings, module-level singleton | `apps/api/app/config.py` |
| Database | Async engine, session factory, init/teardown | `apps/api/app/database.py` |
| Models | 9 SQLAlchemy ORM tables with pgvector | `apps/api/app/models.py` |
| Worker | Background asyncio loop processing extraction jobs | `apps/api/app/worker.py` |
| Ingest Service | Stores raw exchanges, enqueues extraction jobs | `apps/api/app/domains/ingest/service.py` |
| Extraction Agent | LLM prompt builder, calls gateway, parses JSON response | `apps/api/app/domains/extraction/agent.py` |
| Validator | Deduplication, grounding check, confidence labeling, auto-approve | `apps/api/app/domains/extraction/validator.py` |
| Memory Service | CRUD, manual creation, approval/rejection, search | `apps/api/app/domains/memories/service.py` |
| Context Builder | Assembles 3-section system-prompt injection block | `apps/api/app/domains/context/service.py` |
| Search Service | Hybrid search: 0.7×semantic + 0.3×BM25 fusion | `apps/api/app/domains/search/service.py` |
| Embeddings Client | Lazy-loads sentence-transformers, in-process encode | `apps/api/app/domains/search/embeddings.py` |
| BM25 | Pure-Python BM25 with stopwords removal | `apps/api/app/domains/search/bm25.py` |
| Provider Gateway | Routes LLM calls (OpenAI-compatible / Anthropic) | `apps/api/app/domains/providers/gateway.py` |
| Project Service | Detect/create projects from workspace paths | `apps/api/app/domains/projects/service.py` |
| Activity Logger | Shared helper inserting activity log records | `apps/api/app/domains/activity.py` |
| Web Dashboard | 10-page Next.js app with dark mode | `apps/web/app/` |
| MCP Server | 5-tool MCP server (stdin/stdout JSON-RPC) | `apps/mcp/server.py` |
| OpenCode Plugin | 5 hooks: system.transform, chat.message, tool.execute.after, session.created, session.idle | `apps/plugin/victorious.js` |

## Pattern Overview

**Overall:** Domain-Driven Layered Architecture

**Key Characteristics:**
- Each domain (`memories/`, `projects/`, `ingest/`, `context/`, `extraction/`, `providers/`, `search/`) follows a consistent `router.py` + `service.py` + `schemas.py` triad pattern
- Router layer handles HTTP concerns (FastAPI decorators, dependency injection, status codes)
- Service layer contains pure business logic, accepting `AsyncSession` as parameter
- Models live in a single `models.py` file (9 ORM tables), not split per domain
- Background worker is a single asyncio task — no task queue framework
- Embedding model runs in-process via `sentence-transformers`, lazy-loaded on first use
- Provider Gateway is a module-level singleton routing to DB-configured or env-fallback LLM endpoints

## Layers

**Router Layer:**
- Purpose: HTTP endpoint definitions, request validation, response serialization
- Location: `apps/api/app/domains/{domain}/router.py` (plus top-level routers: `activity_router.py`, `exchanges_router.py`, `graph_router.py`, `jobs_router.py`, `settings_router.py`, `system_router.py`)
- Contains: FastAPI `APIRouter` instances, `@router.get/post/put/delete` decorators, `Depends(get_db)` for DB sessions
- Depends on: Corresponding service layer (sibling `service.py`)
- Used by: Client integrations (plugin, MCP, web dashboard)

**Service Layer:**
- Purpose: Business logic, DB operations, validation orchestrator
- Location: `apps/api/app/domains/{domain}/service.py`
- Contains: Async functions accepting `AsyncSession`, returning domain objects or Pydantic models
- Depends on: `app.models` (ORM), `app.database`, other service modules
- Used by: Router layer directly, Worker (`extraction_worker` in `worker.py`)

**Domain Services (Shared/Cross-cutting):**
- `extraction/agent.py` — LLM prompt engineering, response parsing (used by worker)
- `extraction/validator.py` — Deduplication, grounding, auto-approve pipeline (used by worker)
- `search/service.py` — Hybrid search fusion (used by context builder + memory router)
- `search/embeddings.py` — In-process vector embedding (used by validator + memory service)
- `search/bm25.py` — Keyword ranking (used by search service)
- `providers/gateway.py` — LLM call routing (used by extraction agent + provider test endpoint)
- `activity.py` — Shared activity log insertion helper (used by multiple services)

**Worker Layer:**
- Purpose: Background job processing with retry logic
- Location: `apps/api/app/worker.py`
- Contains: `claim_next_job()` (SQL with `FOR UPDATE SKIP LOCKED`), `_process_job()`, `extraction_worker()` loop
- Depends on: `extraction/agent.py`, `extraction/validator.py`, `memories/service.py`, `activity.py`
- Used by: FastAPI lifespan (asyncio task)

**Data Layer:**
- Purpose: Database connection, ORM, configuration
- Location: `apps/api/app/database.py`, `apps/api/app/models.py`, `apps/api/app/config.py`
- Contains: SQLAlchemy `AsyncEngine`, `AsyncSession`, `DeclarativeBase`, 9 ORM models, Pydantic `Settings`
- Depends on: PostgreSQL 16 + pgvector, `.env` file
- Used by: All service-layer modules

## Data Flow

### Primary Request Path: Conversation Ingestion → Memory Extraction

1. **Plugin captures exchange** (`apps/plugin/victorious.js:100-130`) — hooks `chat.message` and `tool.execute.after` accumulate user + agent content; token threshold triggers flush
2. **POST /api/ingest** (`apps/api/app/domains/ingest/router.py:13`) — accepts `IngestRequest` with session_id, exchange data
3. **ingest_exchange()** (`apps/api/app/domains/ingest/service.py:22`) — stores `Exchange` row, creates `ExtractionJob` (status: "pending"), logs activity
4. **extraction_worker()** (`apps/api/app/worker.py:145`) — polls job queue every 2s, claims with `FOR UPDATE SKIP LOCKED`
5. **_process_job()** (`apps/api/app/worker.py:57`) — loads exchange, loads existing memories/preferences as context
6. **extract_memories()** (`apps/api/app/domains/extraction/agent.py:150`) — builds prompt, calls LLM via `gateway.complete()`, parses JSON response into `MemoryCandidate[]`
7. **validate_candidates()** (`apps/api/app/domains/extraction/validator.py:140`) — sanitizes types, checks duplicates via vector similarity (>0.90 skip, >0.80 merge), grounding check, auto-approve decision
8. **create_memory_from_candidate()** (`apps/api/app/domains/memories/service.py:26`) — embeds content, creates `Memory` row with tags, provenance
9. **Job completion** — updates job to "done" or retries with exponential backoff (2s, 4s, 8s)

### Context Retrieval Flow

1. **Plugin injects context** (`apps/plugin/victorious.js:151-174`) — hooks `experimental.chat.system.transform`, calls `GET /api/context`
2. **build_context()** (`apps/api/app/domains/context/service.py:16`) — assembles three sections in priority order:
   - Section 1: Project decisions (type ∈ `{decision, architecture, constraint}`, limit 8)
   - Section 2: User preferences (global scope, type=preference, limit 5)
   - Section 3: Query-relevant memories via `hybrid_search()` (limit 5, excludes already-used IDs)
3. **Token budget trimming** (`context/service.py:106-113`) — estimates tokens as `len/4`, removes lowest-priority sections if exceeding `max_tokens`
4. **Access stats update** (`context/service.py:115-124`) — increments `access_count`, sets `last_accessed` for each used memory
5. **Block returned** — formatted markdown-like text block injected into system prompt

### Hybrid Search Flow

1. **hybrid_search()** (`apps/api/app/domains/search/service.py:27`) — combines semantic + BM25
2. **Embed query** — `embed_text()` using in-process sentence-transformers model
3. **Semantic retrieval** — pgvector cosine distance query, candidate_limit = `top_k * 3`
4. **BM25 re-rank** — `bm25_rank()` on semantic candidates
5. **Fusion** — `combined = 0.7 * semantic_score + 0.3 * bm25_score`, sort descending, return top_k

### Web Dashboard Data Flow

1. **Next.js pages** (`apps/web/app/{page}/page.tsx`) — use `"use client"` components with `useEffect` for data fetching
2. **API client** (`apps/web/lib/api.ts`) — typed `request<T>()` wrapper around `fetch()`, organized by resource (memoriesApi, projectsApi, jobsApi, etc.)
3. **Direct fetch to FastAPI** — calls `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/api`)
4. **Server component via next.config.ts proxy** — Next.js can proxy `/api/*` requests to the FastAPI backend

**State Management:**
- Client-side React state (`useState`/`useEffect` per page) — no global state management library
- Sidebar pending count fetched via direct `fetch()` call on mount

## Key Abstractions

**Provider Gateway:**
- Purpose: Routes LLM completion requests to configured providers, abstracts OpenAI vs Anthropic API differences
- Examples: `apps/api/app/domains/providers/gateway.py`
- Pattern: Module-level singleton (`gateway = ProviderGateway()`), role-based config resolution from DB with env-fallback

**Extraction Pipeline:**
- Purpose: Transforms raw conversation → validated memory candidates → stored memories
- Examples: `extraction/agent.py` → `extraction/validator.py` → `memories/service.py`
- Pattern: Chain of responsibility: extract → validate → store

**Hybrid Search:**
- Purpose: Combines semantic similarity with keyword relevance for robust retrieval
- Examples: `search/service.py` (+ `search/bm25.py` + `search/embeddings.py`)
- Pattern: Two-phase retrieval: broad pgvector scan → BM25 re-rank → fusion

**Context Builder:**
- Purpose: Assembles structured memory block for LLM system prompt injection
- Examples: `context/service.py`
- Pattern: Section-based assembly with priority-ordered token budgeting

**Activity Log:**
- Purpose: Immutable audit trail of all system events (creation, approval, rejection, extraction)
- Examples: `activity.py`, `activity_router.py`
- Pattern: Shared `log_activity()` helper called from services, read-only API endpoint

## Entry Points

**FastAPI Application:**
- Location: `apps/api/app/main.py`
- Triggers: `uvicorn app.main:app` (via Docker CMD or direct)
- Responsibilities: Lifespan (init DB + start worker), mount 11 routers, CORS middleware, health endpoint

**Background Worker:**
- Location: `apps/api/app/worker.py:145` (`extraction_worker()`)
- Triggers: FastAPI lifespan startup (asyncio task)
- Responsibilities: Poll extraction_jobs, process exchanges via LLM, retry with backoff

**Web Dashboard:**
- Location: `apps/web/app/layout.tsx` (root layout), `apps/web/app/page.tsx` (dashboard)
- Triggers: `npm run dev` (Next.js dev server), `npm run build && npm start` (production)
- Responsibilities: 10-page SPA for memory management, review queue, graph exploration, system admin

**MCP Server:**
- Location: `apps/mcp/server.py`
- Triggers: Spawned as subprocess by OpenCode/Claude Code, communicates via stdin/stdout JSON-RPC
- Responsibilities: 5 tools: `search_memories`, `get_context`, `save_memory`, `list_memories`, `get_activity`

**OpenCode Plugin:**
- Location: `apps/plugin/victorious.js`
- Triggers: OpenCode plugin system (5 lifecycle hooks)
- Responsibilities: Auto-capture conversations, flush exchanges on token threshold, inject memory context into system prompt

## Architectural Constraints

- **Threading:** Single-threaded asyncio event loop. Background worker runs as cooperative asyncio task. Embedding model (`sentence-transformers`) runs synchronously in the event loop (assumed fast enough for single texts).
- **Global state:** `settings` singleton (`app/config.py:36`), `gateway` singleton (`app/domains/providers/gateway.py:223`), `_model` module-level variable (`app/domains/search/embeddings.py:16`).
- **Circular imports:** Router imports in `main.py` use deferred imports inside the function body after app creation. Domain services import models from `app.models`.
- **ID scheme:** All primary keys are TEXT with prefixes (`mem_`, `prj_`, `edg_`, `exc_`, `job_`, `tl_`, `prov_`, `act_`, `stg_`). Project IDs use slugified names directly (no prefix).
- **No authentication:** API is fully open. CORS allows all origins. No auth middleware. Users configure LLM API keys via provider configs stored in DB.

## Anti-Patterns

### Monolithic models.py

**What happens:** All 9 ORM tables are defined in a single 389-line `app/models.py` file instead of split per domain.
**Why it's wrong:** Makes it harder to find model definitions, increases merge conflicts, violates single responsibility principle when the system grows.
**Do this instead:** Split models into `app/domains/{domain}/models.py`, import and register them all in a central `app/models/__init__.py`.

### Mixed Router / Service Patterns

**What happens:** Some routers (e.g., `memories/router.py:79-117` for `/stats`, `projects/router.py:64-97` for `/timeline`) contain inline SQLAlchemy queries instead of delegating to a service layer.
**Why it's wrong:** Breaks the consistent router→service separation, making testing harder and business logic scattered.
**Do this instead:** Move all query logic into `service.py` files, keep routers as thin HTTP adapters.

### Direct JSON Serialization in Routers

**What happens:** Routers manually construct dicts for responses (e.g., `exchanges_router.py:44-61`, `graph_router.py:29-35`, `activity_router.py:32-44`) rather than using Pydantic response models consistently.
**Why it's wrong:** Loses type safety, validation, and auto-generated OpenAPI docs. Inconsistent — some routers use `response_model`, others don't.
**Do this instead:** Define Pydantic response schemas for all endpoints and use `response_model=` parameter.

### In-Process Embedding Model

**What happens:** The embedding model (`BAAI/bge-small-en-v1.5`) loads in-process via `sentence-transformers` (`embeddings.py:25-31`) rather than calling a dedicated service.
**Why it's wrong:** Blocks the asyncio event loop (synchronous encode), cannot scale independently, loads model into API process memory (~130MB).
**Do this instead:** Deploy HuggingFace TEI as separate service (as originally planned), use HTTP client.

### Verbose Agent Parts Storage

**What happens:** All agent response parts (text, thinking, tool_call content) are stored in full as JSONB in `exchanges.agent_parts` — including thinking blocks up to 1500 chars and tool results up to 4000 chars.
**Why it's wrong:** Creates large DB rows, sends large payloads to LLM extraction (increases token costs), stores potentially sensitive content.
**Do this instead:** Truncate stored content more aggressively, or store references to logs instead of full content.

## Error Handling

**Strategy:** Exception-based with domain-specific error types.

**Patterns:**
- Router layer: `HTTPException(404, "...")`, `HTTPException(409, "...")` for expected failures
- Provider Gateway: Custom `ProviderError`, `ProviderTimeoutError`, `ProviderNotConfiguredError` → caught by caller
- Worker: Generic `except Exception` with retry logic (exponential backoff 2^n seconds), max 3 attempts, marks `failed` after exhaustion
- Embedding: Returns zero vectors on failure (`[0.0] * 384`) rather than raising — silent degradation
- Context builder: Wraps search in try/except, returns empty sections on failure
- LLM extraction: `ExtractionError` raised on gateway failure, caught by worker
- Database: `get_db()` dependency auto-commits on success, rolls back on exception

## Cross-Cutting Concerns

**Logging:** Standard Python `logging` with structured format: `"%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"`. Configured at `main.py:18-21`.

**Validation:** Pydantic v2 models for all request/response schemas. Extraction validator runs multi-step pipeline: type sanitization, duplicate detection, grounding check, auto-approve decision.

**Authentication:** None. API is fully open with CORS `allow_origins=["*"]`. API keys for LLM providers are stored in the `provider_configs` DB table, never returned in API responses.

---

*Architecture analysis: 2026-05-25*
