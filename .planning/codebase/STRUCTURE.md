# Codebase Structure

**Analysis Date:** 2026-05-25

## Directory Layout

```
[project-root]/                         # Victorious Memory 2V
├── apps/
│   ├── api/                            # Python FastAPI backend
│   │   ├── app/
│   │   │   ├── __init__.py             # Package marker
│   │   │   ├── main.py                 # FastAPI app entry point, lifespan, 11 routers
│   │   │   ├── config.py               # Pydantic Settings from env vars
│   │   │   ├── database.py             # Async SQLAlchemy engine, session, Base
│   │   │   ├── models.py               # 9 ORM tables (single file)
│   │   │   ├── worker.py               # Background extraction worker (asyncio)
│   │   │   └── domains/
│   │   │       ├── __init__.py
│   │   │       ├── activity.py         # Shared activity log insertion helper
│   │   │       ├── activity_router.py  # GET /api/activity
│   │   │       ├── exchanges_router.py # GET /api/exchanges (raw conversation viewer)
│   │   │       ├── graph_router.py     # /api/graph + /api/edges (knowledge graph)
│   │   │       ├── jobs_router.py      # /api/jobs (extraction job management)
│   │   │       ├── settings_router.py  # /api/settings (key-value store)
│   │   │       ├── system_router.py    # /api/system (info, re-embed, purge, export)
│   │   │       ├── context/            # Context builder for system prompt injection
│   │   │       │   ├── __init__.py
│   │   │       │   ├── router.py       # GET /api/context
│   │   │       │   ├── service.py      # Assembles 3-section injection block
│   │   │       │   └── schemas.py      # ContextResponse
│   │   │       ├── extraction/         # LLM extraction pipeline
│   │   │       │   ├── __init__.py
│   │   │       │   ├── agent.py        # LLM prompt, JSON response parsing
│   │   │       │   ├── validator.py    # Dedup, grounding, auto-approve
│   │   │       │   └── schemas.py      # MemoryCandidate, ValidatedCandidate
│   │   │       ├── ingest/             # Conversation ingestion
│   │   │       │   ├── __init__.py
│   │   │       │   ├── router.py       # POST /api/ingest
│   │   │       │   ├── service.py      # Store exchange + create extraction job
│   │   │       │   └── schemas.py      # IngestRequest, IngestResponse
│   │   │       ├── memories/           # Memory CRUD
│   │   │       │   ├── __init__.py
│   │   │       │   ├── router.py       # CRUD + search + stats + bulk
│   │   │       │   ├── service.py      # Create, update, approve, reject, list
│   │   │       │   └── schemas.py      # Request/response models
│   │   │       ├── projects/           # Project detection and management
│   │   │       │   ├── __init__.py
│   │   │       │   ├── router.py       # CRUD + detect + timeline
│   │   │       │   ├── service.py      # Path-based detection, slug generation
│   │   │       │   └── schemas.py      # ProjectDetectRequest, ProjectResponse
│   │   │       ├── providers/          # LLM provider configuration
│   │   │       │   ├── __init__.py
│   │   │       │   ├── router.py       # CRUD + test endpoint
│   │   │       │   ├── gateway.py      # ProviderGateway (OpenAI/Anthropic)
│   │   │       │   └── schemas.py      # ProviderConfig request/response
│   │   │       └── search/             # Hybrid search engine
│   │   │           ├── __init__.py
│   │   │           ├── service.py      # Hybrid search (semantic + BM25 fusion)
│   │   │           ├── embeddings.py   # In-process sentence-transformers client
│   │   │           └── bm25.py         # Pure-Python BM25 ranking
│   │   ├── tests/
│   │   │   └── test_e2e_phase1.py      # Phase 1 end-to-end tests
│   │   ├── pyproject.toml              # Python project config (hatchling build)
│   │   └── Dockerfile                  # Python 3.12-slim, uvicorn
│   │
│   ├── web/                            # Next.js 16 frontend
│   │   ├── app/                        # App Router pages
│   │   │   ├── layout.tsx              # Root layout (Sidebar + TopBar + dark mode)
│   │   │   ├── page.tsx                # Dashboard (stats cards, activity, donut chart)
│   │   │   ├── globals.css             # Global styles
│   │   │   ├── activity/page.tsx       # Full activity feed
│   │   │   ├── exchanges/page.tsx      # Raw exchanges viewer
│   │   │   ├── graph/page.tsx          # Graph explorer
│   │   │   ├── jobs/page.tsx           # Extraction jobs management
│   │   │   ├── memories/page.tsx       # Memory CRUD table
│   │   │   ├── projects/page.tsx       # Project list
│   │   │   ├── projects/[id]/page.tsx  # Project detail with timeline
│   │   │   ├── review/page.tsx         # Review queue (pending memories)
│   │   │   └── settings/page.tsx       # App settings + provider config
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx         # 260px fixed sidebar with nav + pending badge
│   │   │   │   └── TopBar.tsx          # Top navigation bar
│   │   │   └── modals/
│   │   │       ├── ConfirmPurgeModal.tsx
│   │   │       ├── CreateMemoryModal.tsx
│   │   │       ├── EdgeDetailModal.tsx
│   │   │       ├── EditMemoryModal.tsx
│   │   │       ├── MemoryDetailModal.tsx
│   │   │       ├── ProviderConfigModal.tsx
│   │   │       └── RejectReasonModal.tsx
│   │   ├── lib/
│   │   │   └── api.ts                  # Typed API client (memoriesApi, projectsApi, etc.)
│   │   ├── public/                     # Static assets (SVGs, favicon)
│   │   ├── package.json                # Next.js 16, React 19, Tailwind 4
│   │   ├── tsconfig.json               # TypeScript config with @/* alias
│   │   ├── tailwind.config.ts          # Tailwind config
│   │   ├── postcss.config.mjs          # PostCSS config
│   │   ├── eslint.config.mjs           # ESLint config
│   │   └── next.config.ts              # Next.js config (minimal)
│   │
│   ├── mcp/
│   │   └── server.py                   # MCP server (5 tools, stdin/stdout JSON-RPC)
│   │
│   └── plugin/
│       └── victorious.js               # OpenCode plugin (5 lifecycle hooks)
│
├── .opencode/                          # OpenCode GSD workflow config
│   ├── opencode.json                   # OpenCode workspace config
│   ├── settings.json                   # OpenCode agent settings
│   ├── agents/                         # 40+ GSD agent definitions (.md)
│   ├── command/                        # 60+ GSD slash commands (.md)
│   └── hooks/                          # GSD workflow guard hooks (.js/.sh)
│
├── docker-compose.yml                  # 2 services: api + db (pgvector/pg16)
├── .env.example                        # Template environment variables
├── .gitignore
├── .gitattributes
├── LICENSE                             # MIT
├── README.md
└── IMPLEMENTATION.md                   # Full system design document
```

## Directory Purposes

**`apps/api/app/` — Python FastAPI backend:**
- Purpose: Main application code for the Victorious Memory API
- Contains: Entry point (`main.py`), config, database setup, ORM models, background worker, all domain logic
- Key files: `main.py` (app definition + router mounting), `models.py` (all 9 tables), `worker.py` (extraction loop)

**`apps/api/app/domains/` — Domain modules:**
- Purpose: Business logic organized by domain concept, each with router/service/schema triad
- Contains: 7 domain directories (`context`, `extraction`, `ingest`, `memories`, `projects`, `providers`, `search`) + 6 top-level routers
- Key files: `extraction/agent.py` (LLM prompt), `extraction/validator.py` (pipeline), `context/service.py` (injection block builder)

**`apps/api/tests/` — Test suite:**
- Purpose: End-to-end and integration tests
- Contains: `test_e2e_phase1.py`
- Key files: `test_e2e_phase1.py`

**`apps/web/app/` — Next.js 16 App Router pages:**
- Purpose: Frontend UI pages using App Router file-based routing
- Contains: 10 page routes (`/`, `/memories`, `/review`, `/projects`, `/projects/[id]`, `/graph`, `/activity`, `/exchanges`, `/jobs`, `/settings`)
- Key files: `layout.tsx` (root layout with Sidebar + TopBar), `page.tsx` (dashboard)

**`apps/web/components/` — React components:**
- Purpose: Reusable UI components organized by type
- Contains: `layout/` (Sidebar, TopBar), `modals/` (7 modal dialogs)
- Key files: `layout/Sidebar.tsx` (navigation + pending count badge)

**`apps/web/lib/` — Shared utilities:**
- Purpose: API client and shared TypeScript modules
- Contains: `api.ts` (typed fetch wrappers for all API endpoints)
- Key files: `api.ts` (exports `memoriesApi`, `projectsApi`, `jobsApi`, `exchangesApi`, `graphApi`, `activityApi`, `settingsApi`, `providersApi`, `systemApi`, `contextApi`)

**`apps/mcp/` — MCP server:**
- Purpose: Standalone MCP (Model Context Protocol) server for agent tool access
- Contains: `server.py` (300-line stdin/stdout JSON-RPC server with 5 tools)
- Key files: `server.py`

**`apps/plugin/` — OpenCode plugin:**
- Purpose: Auto-capture plugin for the OpenCode agent framework
- Contains: `victorious.js` (250-line JavaScript plugin with 5 lifecycle hooks)
- Key files: `victorious.js`

**`.opencode/` — OpenCode GSD configuration:**
- Purpose: Workflow definitions, agent definitions, hooks for the GSD (Get Shit Done) system
- Contains: `agents/` (40+ agent markdown definitions), `command/` (60+ slash commands), `hooks/` (workflow guard scripts)
- Generated: No
- Committed: Yes

## Key File Locations

**Entry Points:**
- `apps/api/app/main.py`: FastAPI application entry (ASGI app, lifespan, CORS, router mounting)
- `apps/web/app/layout.tsx`: Next.js root layout (HTML shell, dark mode, Sidebar + TopBar)
- `apps/web/app/page.tsx`: Dashboard page (stats cards, activity feed, donut chart)
- `apps/mcp/server.py`: MCP server entry (stdin/stdout JSON-RPC loop)
- `apps/plugin/victorious.js`: OpenCode plugin entry (exports `VictoriousMemoryPlugin`)

**Configuration:**
- `apps/api/app/config.py`: Pydantic Settings with 14 env-var settings
- `apps/api/pyproject.toml`: Python dependencies (FastAPI, SQLAlchemy, httpx, sentence-transformers, etc.)
- `apps/web/package.json`: Node dependencies (Next.js 16, React 19, Tailwind 4)
- `apps/web/tsconfig.json`: TypeScript config with `@/*` path alias → `./*`
- `apps/web/next.config.ts`: Next.js config (minimal, default settings)
- `apps/web/tailwind.config.ts`: Tailwind CSS v4 configuration
- `docker-compose.yml`: 2 services (api + db), pgvector/pg16 image
- `.env.example`: Template for required environment variables

**Core Logic:**
- `apps/api/app/models.py`: All 9 SQLAlchemy ORM tables (389 lines)
- `apps/api/app/database.py`: Async engine, session factory, init (30 lines)
- `apps/api/app/worker.py`: Background extraction worker with retry (161 lines)
- `apps/api/app/domains/extraction/agent.py`: LLM extraction prompt + parsing (204 lines)
- `apps/api/app/domains/extraction/validator.py`: 6-step validation pipeline (216 lines)
- `apps/api/app/domains/context/service.py`: 3-section context block builder (131 lines)
- `apps/api/app/domains/search/service.py`: Hybrid search fusion (133 lines)
- `apps/api/app/domains/providers/gateway.py`: LLM provider routing (223 lines)

**API Routing:**
- `apps/api/app/main.py`: Mounts 11 routers at `/api` prefix (lines 55-77)
- `apps/api/app/domains/memories/router.py`: 10 endpoints (CRUD + stats + search + bulk + approve/reject)
- `apps/api/app/domains/providers/router.py`: 4 endpoints (list + upsert + delete + test)

**Testing:**
- `apps/api/tests/test_e2e_phase1.py`: End-to-end tests for Phase 1 features

**Frontend Pages:**
- `apps/web/app/page.tsx`: Dashboard with 6 stat cards, activity feed, donut chart
- `apps/web/app/memories/page.tsx`: Full memory CRUD table with filtering
- `apps/web/app/review/page.tsx`: Pending review queue with approve/reject
- `apps/web/app/projects/page.tsx`: Project listing
- `apps/web/app/projects/[id]/page.tsx`: Project detail + timeline
- `apps/web/app/graph/page.tsx`: Knowledge graph visualization
- `apps/web/app/activity/page.tsx`: Activity log viewer
- `apps/web/app/exchanges/page.tsx`: Raw conversation exchanges viewer
- `apps/web/app/jobs/page.tsx`: Extraction job management
- `apps/web/app/settings/page.tsx`: App settings + provider configuration

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `activity_router.py`, `system_router.py`)
- TypeScript/React: `PascalCase.tsx` for components (e.g., `Sidebar.tsx`, `TopBar.tsx`), `camelCase.ts` for utilities (e.g., `api.ts`)
- Domain modules: lowercase directory names (`memories/`, `projects/`, `ingest/`)
- Standard triad: `router.py`, `service.py`, `schemas.py` in each domain

**Directories:**
- `apps/` — each sub-application is a top-level directory
- `domains/` — domain modules follow the pattern `{plural_noun}/`
- Frontend: App Router convention — route folders in `app/`, components in `components/{type}/`

**Variables/Functions (Python):**
- Functions: `snake_case()` (e.g., `extract_memories()`, `build_context()`, `hybrid_search()`)
- Classes: `PascalCase` (e.g., `ProviderGateway`, `ExtractionError`, `MemoryCandidate`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MEMORY_TYPES`, `STOPWORDS`, `EDGE_TYPES`)
- Module-level singletons: lowercase (e.g., `settings`, `gateway`)
- Private functions: `_leading_underscore` (e.g., `_claim_next_job()`, `_format_existing()`)

**Variables/Components (TypeScript):**
- React components: `PascalCase` (e.g., `StatCard`, `DonutChart`, `Sidebar`)
- API objects: `camelCaseApi` (e.g., `memoriesApi`, `projectsApi`, `jobsApi`)
- Hooks/state: `camelCase` (e.g., `pendingCount`, `jobStats`, `isActive`)
- Event handlers: inline arrow functions or named `handle{Event}`

**Database:**
- Tables: `snake_case` (e.g., `memories`, `memory_edges`, `extraction_jobs`, `provider_configs`, `activity_log`, `app_settings`, `timeline_entries`)
- Columns: `snake_case` (e.g., `project_id`, `confidence_score`, `memory_type`, `created_at`)
- Indexes: `idx_{table}_{column}` (e.g., `idx_memories_project`, `idx_edges_source`)
- ID prefixes: `mem_`, `prj_`, `edg_`, `exc_`, `job_`, `tl_`, `prov_`, `act_`, `stg_`

## Where to Add New Code

**New Domain Feature (e.g., "notifications"):**
- Primary code: `apps/api/app/domains/notifications/`
  - `__init__.py` — package marker
  - `router.py` — FastAPI route definitions
  - `service.py` — business logic
  - `schemas.py` — Pydantic request/response models
- Register router: Add import + `app.include_router()` in `apps/api/app/main.py`
- Frontend page: `apps/web/app/notifications/page.tsx`
- Frontend API: Add `notificationsApi` object to `apps/web/lib/api.ts`
- Sidebar nav: Add entry to `navItems` in `apps/web/components/layout/Sidebar.tsx`

**New ORM Table:**
- Add model class to `apps/api/app/models.py`
- Follow existing pattern: ID generation with `_generate_id(prefix)`, `new_id()` static method
- Run Alembic migration: `alembic revision --autogenerate -m "add_{table}"`

**New Background Worker:**
- Create `apps/api/app/workers/{name}_worker.py`
- Start as asyncio task in `main.py` lifespan
- Follow pattern from `worker.py`: poll loop, claim processing, retry with backoff

**New MCP Tool:**
- Add tool definition to `TOOLS` list in `apps/mcp/server.py`
- Add handler function in `HANDLERS` dict
- Call existing API endpoint or add new endpoint on the FastAPI side

**New Plugin Hook:**
- Add hook function to the returned object in `apps/plugin/victorious.js`
- Hook names follow OpenCode convention (e.g., `"event.sub_event"`)

**New React Component:**
- Reusable UI: `apps/web/components/{category}/{ComponentName}.tsx`
- Page-level: `apps/web/app/{route}/page.tsx`
- Modal: `apps/web/components/modals/{ModalName}.tsx`

**New Utility/Helper:**
- API client: Add to `apps/web/lib/api.ts` as new exported object
- Python shared: Add to `apps/api/app/domains/` as new module or to existing service

## Special Directories

**`__pycache__/`:**
- Purpose: Python bytecode cache
- Generated: Yes (by Python interpreter)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: Installed npm packages
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`.next/`:**
- Purpose: Next.js build output and cached compilation
- Generated: Yes (by `next build` / `next dev`)
- Committed: No

**`.opencode/`:**
- Purpose: OpenCode workspace configuration, GSD agent definitions, workflow hooks
- Generated: Partially (installation state files like `gsd-install-state.json`)
- Committed: Yes (core config and agent definitions are committed)

**`.planning/`:**
- Purpose: GSD planning artifacts (codebase maps, phase plans, retrospectives)
- Generated: By GSD workflow commands
- Committed: Yes

---

*Structure analysis: 2026-05-25*
