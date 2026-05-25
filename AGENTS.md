<!-- GSD:project-start source:PROJECT.md -->
## Project

**Victorious Memory V2**

Victorious Memory V2 is an AI memory system that automatically captures, structures, and retrieves knowledge from coding conversations. It integrates with OpenCode as a plugin — conversations are ingested, memories extracted via LLM, stored in PostgreSQL with vector embeddings, and injected back as context into future sessions. Currently has a working FastAPI backend, Next.js web dashboard, MCP server, and OpenCode plugin — but needs UX polish, provider architecture improvements, and end-to-end verification to be production-ready.

**Core Value:** Automatically extract and surface relevant knowledge from developer conversations without manual effort.

### Constraints

- **Tech stack**: Python 3.12 + FastAPI (backend), Next.js 16 + React (frontend), PostgreSQL 16 + pgvector, Docker Compose
- **Deployment**: Local desktop first, VPS later
- **No auth**: API is open — security through localhost/network isolation
- **LLM providers**: Must support OpenAI-compatible and Anthropic APIs, plus custom endpoints
- **Embeddings**: Currently in-process sentence-transformers; plan was HuggingFace TEI as separate service
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.12+ - Backend API (`apps/api/`), MCP server (`apps/mcp/`)
- TypeScript 5+ - Frontend web dashboard (`apps/web/`)
- JavaScript (CommonJS) - OpenCode plugin (`apps/plugin/victorious.js`)
- SQL - Database queries, raw SQL for job claiming in worker
## Runtime
- Python 3.12-slim (Docker base image: `apps/api/Dockerfile`)
- Uvicorn 0.30.0+ (ASGI server) — `apps/api/pyproject.toml`
- Node.js (no `.nvmrc` present — version not pinned)
- Next.js 16.2.6 with built-in dev server — `apps/web/package.json`
- pip (Python) via Hatchling build system — `apps/api/pyproject.toml`
- npm (Node.js) — `apps/web/package.json`
- Lockfile: `apps/web/package-lock.json` (present)
## Frameworks
- FastAPI 0.115.0+ - REST API framework with async support — `apps/api/app/main.py`
- Next.js 16.2.6 - React full-stack framework (App Router) — `apps/web/next.config.ts`
- React 19.2.4 - UI component library — `apps/web/package.json`
- OpenCode Plugin API 1.15.10 - Agent plugin framework — `.opencode/package.json`
- pytest 8.0.0+ - Python test runner — `apps/api/pyproject.toml` (dev dependency)
- pytest-asyncio 0.24.0+ - Async test support — `apps/api/pyproject.toml` (dev dependency)
- Hatchling - Python build backend — `apps/api/pyproject.toml`
- TypeScript 5+ - Static type checking — `apps/web/tsconfig.json`
- ESLint 9+ - JavaScript/TypeScript linting — `apps/web/package.json`
- Tailwind CSS 4+ - Utility-first CSS framework — `apps/web/tailwind.config.ts`
## Key Dependencies
- SQLAlchemy 2.0.30+ (with asyncio) - ORM for PostgreSQL — `apps/api/pyproject.toml`
- asyncpg 0.30.0+ - High-performance async PostgreSQL driver — `apps/api/pyproject.toml`
- pgvector 0.3.0+ - pgvector extension integration for vector search — `apps/api/pyproject.toml`
- Pydantic 2.9.0+ - Request/response validation and serialization — `apps/api/pyproject.toml`
- pydantic-settings 2.5.0+ - Environment-based configuration — `apps/api/app/config.py`
- httpx 0.28.0+ - Async HTTP client for LLM provider calls — `apps/api/pyproject.toml`
- numpy 1.26.0+ - Numerical operations for embedding math — `apps/api/pyproject.toml`
- sentence-transformers 3.0.0+ - In-process embedding model (BAAI/bge-small-en-v1.5) — `apps/api/pyproject.toml`
- Alembic 1.13.0+ - Database migration tool — `apps/api/pyproject.toml`
- pgvector/pgvector:pg16 - Docker image for PostgreSQL 16 with pgvector extension — `docker-compose.yml`
## Configuration
- `.env` file (gitignored) — loaded by Pydantic Settings — `apps/api/app/config.py`
- `.env.example` — template with all env vars documented — `.env.example`
- `apps/web/.env.local` — frontend env (contains `NEXT_PUBLIC_API_URL`)
- Config keys (all in `apps/api/app/config.py:Settings`):
- `apps/api/pyproject.toml` — Python project metadata and dependencies
- `apps/web/tsconfig.json` — TypeScript compiler config with `@/*` path alias
- `apps/web/next.config.ts` — Next.js configuration
- `apps/web/tailwind.config.ts` — Tailwind CSS theme (Material Design 3 dark palette, Inter + JetBrains Mono fonts)
- `apps/web/postcss.config.mjs` — PostCSS for Tailwind
- `apps/web/eslint.config.mjs` — ESLint with next config
## Platform Requirements
- Python 3.12+
- Node.js (recent LTS recommended)
- Docker + Docker Compose (for PostgreSQL with pgvector)
- Git
- Docker Compose — `docker-compose.yml` defines:
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- `snake_case` for all module files: `main.py`, `database.py`, `activity_router.py`
- Domain modules in `domains/{name}/` directories: `router.py`, `service.py`, `schemas.py`
- Test files: `test_e2e_phase1.py` (prefix `test_`)
- `kebab-case` for route directories: `app/projects/[id]/`
- `PascalCase` for component files: `CreateMemoryModal.tsx`, `Sidebar.tsx`
- `camelCase` for utility files: `api.ts`
- Page files always named `page.tsx`, layouts always `layout.tsx`
- `snake_case` exclusively: `create_memory_from_candidate()`, `get_recent_memories()`, `_generate_id()`
- Private helpers prefixed with underscore: `_slugify()`, `_normalize_path()`, `_confidence_label()`
- Async service functions use descriptive verb-noun names: `approve_memory()`, `ingest_exchange()`
- `camelCase` for all functions: `handleSubmit()`, `timeAgo()`, `toggleAll()`
- Client component export default as `function ComponentName()` or `export default function PageName()`
- API methods as object properties: `memoriesApi.list()`, `projectsApi.get()`
- `snake_case`: `memory_id`, `project_id`, `confidence_score`
- Module-level singletons as lowercase: `gateway`, `settings`, `engine`
- Global module state prefixed with underscore: `_model`
- `camelCase`: `memoryId`, `projectId`, `searchQuery`
- Top-level constants use `UPPER_SNAKE_CASE`: `DONUT_COLORS`, `MEMORY_TYPES`, `EVENT_ICONS`
- Environment variables: `NEXT_PUBLIC_API_URL`, `VICTORIOUS_API_URL`
- `PascalCase` for classes: `Memory`, `ExtractionJob`, `ProviderGateway`
- Custom exceptions follow pattern: `ExtractionError`, `ProviderError`, `ProviderTimeoutError`
- Schema classes use descriptive `*Request`/`*Response` suffixes: `MemoryCreateRequest`, `MemoryListResponse`
- Model classes use singular nouns: `Project`, `Memory`, `Exchange`
- Used sparingly — prefer inline type annotations
- Component props typed via destructed inline types: `{ title: string; value: string }`
- API responses typed as `any` in the current codebase
## Code Style
- No formatter explicitly configured (no Black, Ruff, or isort configs detected)
- Consistent use of single blank lines between methods, double blank lines between top-level definitions
- Section separator comments: `# ─── Section Name ───` with em-dash line
- Line length: observed up to ~120 chars, no strict limit enforced
- Docstrings use triple-double-quotes `"""..."""` on first line of every module
- **ESLint config:** `apps/web/eslint.config.mjs` — `eslint-config-next` with `core-web-vitals` and `typescript` rules
- No Prettier config detected — formatting follows ESLint conventions
- Indentation: 2 spaces
- JSX: multi-line when props exceed ~2, props destructured inline
- Component files use `"use client"` directive at top of file when using hooks
- `strict: true` — strict mode enabled
- `target: "ES2017"`
- Path alias: `@/*` maps to project root (`./*`)
- `jsx: "react-jsx"` — automatic JSX runtime
- `moduleResolution: "bundler"`
- All files start with `from __future__ import annotations`
- Uses Python 3.12+ pipe syntax for unions: `str | None` (not `Optional[str]`)
- Uses built-in generics: `list[str]` (not `List[str]`)
- Return types always annotated on functions: `-> Memory | None`, `-> list[SearchResult]`
- `Mapped[]` type annotations for SQLAlchemy 2.0 ORM columns
- Tailwind CSS v4 with `@import "tailwindcss"` directive
- Material Design 3 dark palette via extended color tokens in `tailwind.config.ts`
- Custom animations via `@keyframes` and Tailwind `animation` config
- CSS utility classes for staggered animations: `.fade-in-up`, `.delay-100` through `.delay-800`
- `@media (prefers-reduced-motion: no-preference)` wrapping all animations — accessibility-conscious
## Import Organization
- Routers import services from same domain: `from app.domains.memories.service import list_memories`
- Circular imports avoided via late imports inside functions: `from app.domains.projects.service import get_project`
- Some routers use inline imports within endpoint functions for cross-domain access (e.g., `from sqlalchemy import func, select as sel` inside `memory_stats()`)
- No explicit ordering between groups — 3rd-party and local imports interleaved
- Direct component imports (no barrel files)
- `@/*` → project root (configured in `tsconfig.json`)
- Used for all internal imports across `app/`, `components/`, and `lib/` directories
## Error Handling
- Service returns `None` or `False` for not-found → router raises `HTTPException(status_code, detail)`
- Pattern:
- Delete endpoints return `status_code=204` with no body
- Return `None` for not-found lookups (let router decide HTTP status)
- Return `False` for failed deletions
- Exceptions caught at router boundary: `ProviderTimeoutError` → 504, `ProviderError` → 502
- Worker catches all exceptions in `_process_job()` and handles retry/backoff logic internally
- Embedding failures silently return zero vectors rather than raising
- `ProviderError` — base provider exception
- `ProviderTimeoutError(ProviderError)` — timeout-specific
- `ProviderNotConfiguredError(ProviderError)` — missing configuration
- `ExtractionError` — extraction pipeline failure (`apps/api/app/domains/extraction/agent.py`)
- API errors thrown as `new Error(...)` with HTTP status in message: `throw new Error(\`API ${res.status}: ${body}\`)`
- Component-level try/catch wrapping async operations:
- Form submissions set error state: `setError(e.message)` → rendered as red alert box
- Guard clauses for empty/null: `if (!content.trim()) return`
- Network errors from fetch silently set empty arrays in catch
- All tool handler calls wrapped in try/except → returns `isError: true` in JSON-RPC response
- API helper returns `{"error": ...}` dict on failure, never throws
## Logging
- Structured logging: `logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")`
- Module-level logger: `logger = logging.getLogger(__name__)` in every file
- Used in services, worker, routers — pattern:
- `console.error()` for caught errors
- No dedicated logging framework
- Custom `log` object with `info()`, `warn()`, `error()` methods
- Conditional output based on `VICTORIOUS_DEBUG` env var
- Optional file logging via `VICTORIOUS_LOG_FILE`
## Comments
- Every module starts with a docstring: `"""Victorious Memory — FastAPI application entry point."""`
- Section dividers: `# ─── Section Name ───` (em-dash separators, reused consistently across files)
- Inline comments explaining non-obvious logic: `# sentence-transformers is sync; run directly (worker is async but this is fast)`
- Function docstrings on key functions, especially public API methods
- Type aliases documented inline: `_TYPE_ALIASES` with comments about what LLM might produce
- Section headers with `// ─── Name ───` pattern matching Python style
- Minimal inline comments — code is self-documenting
- No JSDoc/TSDoc on components or functions
## Function Design
- Service functions: typically 10-40 lines
- Router endpoint handlers: 5-15 lines (thin — delegate to services)
- Helper/utility functions: 5-15 lines
- Longest functions in codebase are in `validator.py` (validation pipeline ~70 lines) and `agent.py` (prompt builder ~60 lines)
- Async functions always accept `db: AsyncSession` as first or last parameter
- Pagination defaults: `page: int = 1, per_page: int = 50`
- Filter parameters default to `None`: `project_id: str | None = None`
- Return type annotations on all functions
- Single entity lookups: `Model | None` or `-> Model`
- Paginated lists: `-> tuple[list[Memory], int]` (items, total count)
- Boolean for success/failure operations: `-> bool`
- Router endpoints return Pydantic response models or dicts
- React components: prefer `function ComponentName()` over arrow functions for top-level exports
- Event handlers: `handleSubmit`, `handleClick` naming convention
- Components up to ~350 lines (e.g., `page.tsx` for dashboard) — no hard split yet
- Callbacks use `useCallback()` when dependencies warrant it
## Module Design
- `config.py`: `settings = Settings()` — configuration singleton
- `database.py`: `engine`, `async_session` — database singletons
- `gateway.py`: `gateway = ProviderGateway()` — HTTP client singleton
- `embeddings.py`: `_model = None` — lazy-loaded model, modified via global
- Components use `export default function`
- API client uses named exports: `export const memoriesApi`, `export const projectsApi`
- No barrel/index files — imports reference files directly
- Color maps and constants defined at module level and used locally
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Each domain (`memories/`, `projects/`, `ingest/`, `context/`, `extraction/`, `providers/`, `search/`) follows a consistent `router.py` + `service.py` + `schemas.py` triad pattern
- Router layer handles HTTP concerns (FastAPI decorators, dependency injection, status codes)
- Service layer contains pure business logic, accepting `AsyncSession` as parameter
- Models live in a single `models.py` file (9 ORM tables), not split per domain
- Background worker is a single asyncio task — no task queue framework
- Embedding model runs in-process via `sentence-transformers`, lazy-loaded on first use
- Provider Gateway is a module-level singleton routing to DB-configured or env-fallback LLM endpoints
## Layers
- Purpose: HTTP endpoint definitions, request validation, response serialization
- Location: `apps/api/app/domains/{domain}/router.py` (plus top-level routers: `activity_router.py`, `exchanges_router.py`, `graph_router.py`, `jobs_router.py`, `settings_router.py`, `system_router.py`)
- Contains: FastAPI `APIRouter` instances, `@router.get/post/put/delete` decorators, `Depends(get_db)` for DB sessions
- Depends on: Corresponding service layer (sibling `service.py`)
- Used by: Client integrations (plugin, MCP, web dashboard)
- Purpose: Business logic, DB operations, validation orchestrator
- Location: `apps/api/app/domains/{domain}/service.py`
- Contains: Async functions accepting `AsyncSession`, returning domain objects or Pydantic models
- Depends on: `app.models` (ORM), `app.database`, other service modules
- Used by: Router layer directly, Worker (`extraction_worker` in `worker.py`)
- `extraction/agent.py` — LLM prompt engineering, response parsing (used by worker)
- `extraction/validator.py` — Deduplication, grounding, auto-approve pipeline (used by worker)
- `search/service.py` — Hybrid search fusion (used by context builder + memory router)
- `search/embeddings.py` — In-process vector embedding (used by validator + memory service)
- `search/bm25.py` — Keyword ranking (used by search service)
- `providers/gateway.py` — LLM call routing (used by extraction agent + provider test endpoint)
- `activity.py` — Shared activity log insertion helper (used by multiple services)
- Purpose: Background job processing with retry logic
- Location: `apps/api/app/worker.py`
- Contains: `claim_next_job()` (SQL with `FOR UPDATE SKIP LOCKED`), `_process_job()`, `extraction_worker()` loop
- Depends on: `extraction/agent.py`, `extraction/validator.py`, `memories/service.py`, `activity.py`
- Used by: FastAPI lifespan (asyncio task)
- Purpose: Database connection, ORM, configuration
- Location: `apps/api/app/database.py`, `apps/api/app/models.py`, `apps/api/app/config.py`
- Contains: SQLAlchemy `AsyncEngine`, `AsyncSession`, `DeclarativeBase`, 9 ORM models, Pydantic `Settings`
- Depends on: PostgreSQL 16 + pgvector, `.env` file
- Used by: All service-layer modules
## Data Flow
### Primary Request Path: Conversation Ingestion → Memory Extraction
### Context Retrieval Flow
### Hybrid Search Flow
### Web Dashboard Data Flow
- Client-side React state (`useState`/`useEffect` per page) — no global state management library
- Sidebar pending count fetched via direct `fetch()` call on mount
## Key Abstractions
- Purpose: Routes LLM completion requests to configured providers, abstracts OpenAI vs Anthropic API differences
- Examples: `apps/api/app/domains/providers/gateway.py`
- Pattern: Module-level singleton (`gateway = ProviderGateway()`), role-based config resolution from DB with env-fallback
- Purpose: Transforms raw conversation → validated memory candidates → stored memories
- Examples: `extraction/agent.py` → `extraction/validator.py` → `memories/service.py`
- Pattern: Chain of responsibility: extract → validate → store
- Purpose: Combines semantic similarity with keyword relevance for robust retrieval
- Examples: `search/service.py` (+ `search/bm25.py` + `search/embeddings.py`)
- Pattern: Two-phase retrieval: broad pgvector scan → BM25 re-rank → fusion
- Purpose: Assembles structured memory block for LLM system prompt injection
- Examples: `context/service.py`
- Pattern: Section-based assembly with priority-ordered token budgeting
- Purpose: Immutable audit trail of all system events (creation, approval, rejection, extraction)
- Examples: `activity.py`, `activity_router.py`
- Pattern: Shared `log_activity()` helper called from services, read-only API endpoint
## Entry Points
- Location: `apps/api/app/main.py`
- Triggers: `uvicorn app.main:app` (via Docker CMD or direct)
- Responsibilities: Lifespan (init DB + start worker), mount 11 routers, CORS middleware, health endpoint
- Location: `apps/api/app/worker.py:145` (`extraction_worker()`)
- Triggers: FastAPI lifespan startup (asyncio task)
- Responsibilities: Poll extraction_jobs, process exchanges via LLM, retry with backoff
- Location: `apps/web/app/layout.tsx` (root layout), `apps/web/app/page.tsx` (dashboard)
- Triggers: `npm run dev` (Next.js dev server), `npm run build && npm start` (production)
- Responsibilities: 10-page SPA for memory management, review queue, graph exploration, system admin
- Location: `apps/mcp/server.py`
- Triggers: Spawned as subprocess by OpenCode/Claude Code, communicates via stdin/stdout JSON-RPC
- Responsibilities: 5 tools: `search_memories`, `get_context`, `save_memory`, `list_memories`, `get_activity`
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
### Mixed Router / Service Patterns
### Direct JSON Serialization in Routers
### In-Process Embedding Model
### Verbose Agent Parts Storage
## Error Handling
- Router layer: `HTTPException(404, "...")`, `HTTPException(409, "...")` for expected failures
- Provider Gateway: Custom `ProviderError`, `ProviderTimeoutError`, `ProviderNotConfiguredError` → caught by caller
- Worker: Generic `except Exception` with retry logic (exponential backoff 2^n seconds), max 3 attempts, marks `failed` after exhaustion
- Embedding: Returns zero vectors on failure (`[0.0] * 384`) rather than raising — silent degradation
- Context builder: Wraps search in try/except, returns empty sections on failure
- LLM extraction: `ExtractionError` raised on gateway failure, caught by worker
- Database: `get_db()` dependency auto-commits on success, rolls back on exception
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
