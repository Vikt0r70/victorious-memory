# Coding Conventions

**Analysis Date:** 2026-05-25

## Naming Patterns

**Python Files:**
- `snake_case` for all module files: `main.py`, `database.py`, `activity_router.py`
- Domain modules in `domains/{name}/` directories: `router.py`, `service.py`, `schemas.py`
- Test files: `test_e2e_phase1.py` (prefix `test_`)

**TypeScript/React Files:**
- `kebab-case` for route directories: `app/projects/[id]/`
- `PascalCase` for component files: `CreateMemoryModal.tsx`, `Sidebar.tsx`
- `camelCase` for utility files: `api.ts`
- Page files always named `page.tsx`, layouts always `layout.tsx`

**Python Functions:**
- `snake_case` exclusively: `create_memory_from_candidate()`, `get_recent_memories()`, `_generate_id()`
- Private helpers prefixed with underscore: `_slugify()`, `_normalize_path()`, `_confidence_label()`
- Async service functions use descriptive verb-noun names: `approve_memory()`, `ingest_exchange()`

**TypeScript Functions:**
- `camelCase` for all functions: `handleSubmit()`, `timeAgo()`, `toggleAll()`
- Client component export default as `function ComponentName()` or `export default function PageName()`
- API methods as object properties: `memoriesApi.list()`, `projectsApi.get()`

**Python Variables:**
- `snake_case`: `memory_id`, `project_id`, `confidence_score`
- Module-level singletons as lowercase: `gateway`, `settings`, `engine`
- Global module state prefixed with underscore: `_model`

**TypeScript Variables:**
- `camelCase`: `memoryId`, `projectId`, `searchQuery`
- Top-level constants use `UPPER_SNAKE_CASE`: `DONUT_COLORS`, `MEMORY_TYPES`, `EVENT_ICONS`
- Environment variables: `NEXT_PUBLIC_API_URL`, `VICTORIOUS_API_URL`

**Python Types/Classes:**
- `PascalCase` for classes: `Memory`, `ExtractionJob`, `ProviderGateway`
- Custom exceptions follow pattern: `ExtractionError`, `ProviderError`, `ProviderTimeoutError`
- Schema classes use descriptive `*Request`/`*Response` suffixes: `MemoryCreateRequest`, `MemoryListResponse`
- Model classes use singular nouns: `Project`, `Memory`, `Exchange`

**TypeScript Types/Interfaces:**
- Used sparingly — prefer inline type annotations
- Component props typed via destructed inline types: `{ title: string; value: string }`
- API responses typed as `any` in the current codebase

## Code Style

**Python Formatting:**
- No formatter explicitly configured (no Black, Ruff, or isort configs detected)
- Consistent use of single blank lines between methods, double blank lines between top-level definitions
- Section separator comments: `# ─── Section Name ───` with em-dash line
- Line length: observed up to ~120 chars, no strict limit enforced
- Docstrings use triple-double-quotes `"""..."""` on first line of every module

**TypeScript/React Formatting:**
- **ESLint config:** `apps/web/eslint.config.mjs` — `eslint-config-next` with `core-web-vitals` and `typescript` rules
- No Prettier config detected — formatting follows ESLint conventions
- Indentation: 2 spaces
- JSX: multi-line when props exceed ~2, props destructured inline
- Component files use `"use client"` directive at top of file when using hooks

**TypeScript Config:** `apps/web/tsconfig.json`
- `strict: true` — strict mode enabled
- `target: "ES2017"`
- Path alias: `@/*` maps to project root (`./*`)
- `jsx: "react-jsx"` — automatic JSX runtime
- `moduleResolution: "bundler"`

**Python Typing:**
- All files start with `from __future__ import annotations`
- Uses Python 3.12+ pipe syntax for unions: `str | None` (not `Optional[str]`)
- Uses built-in generics: `list[str]` (not `List[str]`)
- Return types always annotated on functions: `-> Memory | None`, `-> list[SearchResult]`
- `Mapped[]` type annotations for SQLAlchemy 2.0 ORM columns

**CSS (Tailwind):** `apps/web/app/globals.css`
- Tailwind CSS v4 with `@import "tailwindcss"` directive
- Material Design 3 dark palette via extended color tokens in `tailwind.config.ts`
- Custom animations via `@keyframes` and Tailwind `animation` config
- CSS utility classes for staggered animations: `.fade-in-up`, `.delay-100` through `.delay-800`
- `@media (prefers-reduced-motion: no-preference)` wrapping all animations — accessibility-conscious

## Import Organization

**Python Import Order:**
1. Standard library: `import logging`, `from datetime import datetime`
2. Third-party: `from fastapi import APIRouter`, `from sqlalchemy import select`
3. Local application: `from app.database import get_db`, `from app.models import Memory`
- Routers import services from same domain: `from app.domains.memories.service import list_memories`
- Circular imports avoided via late imports inside functions: `from app.domains.projects.service import get_project`
- Some routers use inline imports within endpoint functions for cross-domain access (e.g., `from sqlalchemy import func, select as sel` inside `memory_stats()`)

**TypeScript Import Order:**
1. React/Next.js: `import { useState } from "react"`, `import Link from "next/link"`
2. Local modules via `@/` alias: `import { memoriesApi } from "@/lib/api"`
3. Components: `import Sidebar from "@/components/layout/Sidebar"`
- No explicit ordering between groups — 3rd-party and local imports interleaved
- Direct component imports (no barrel files)

**Path Aliases (TypeScript):**
- `@/*` → project root (configured in `tsconfig.json`)
- Used for all internal imports across `app/`, `components/`, and `lib/` directories

## Error Handling

**Python Routers (`router.py` files):**
- Service returns `None` or `False` for not-found → router raises `HTTPException(status_code, detail)`
- Pattern:
```python
mem = await get_memory(db, memory_id)
if not mem:
    raise HTTPException(404, "Memory not found")
return mem
```
- Delete endpoints return `status_code=204` with no body

**Python Services:**
- Return `None` for not-found lookups (let router decide HTTP status)
- Return `False` for failed deletions
- Exceptions caught at router boundary: `ProviderTimeoutError` → 504, `ProviderError` → 502
- Worker catches all exceptions in `_process_job()` and handles retry/backoff logic internally
- Embedding failures silently return zero vectors rather than raising

**Python Custom Exceptions:** `apps/api/app/domains/providers/gateway.py`
- `ProviderError` — base provider exception
- `ProviderTimeoutError(ProviderError)` — timeout-specific
- `ProviderNotConfiguredError(ProviderError)` — missing configuration
- `ExtractionError` — extraction pipeline failure (`apps/api/app/domains/extraction/agent.py`)

**TypeScript Error Handling:**
- API errors thrown as `new Error(...)` with HTTP status in message: `throw new Error(\`API ${res.status}: ${body}\`)`
- Component-level try/catch wrapping async operations:
```typescript
try {
  const data = await memoriesApi.list(params);
  setMemories(data.items || []);
} catch (e) {
  console.error(e);
}
```
- Form submissions set error state: `setError(e.message)` → rendered as red alert box
- Guard clauses for empty/null: `if (!content.trim()) return`
- Network errors from fetch silently set empty arrays in catch

**MCP Server Error Handling:** `apps/mcp/server.py`
- All tool handler calls wrapped in try/except → returns `isError: true` in JSON-RPC response
- API helper returns `{"error": ...}` dict on failure, never throws

## Logging

**Python Logging:** `apps/api/app/main.py` lines 17-21
- Structured logging: `logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")`
- Module-level logger: `logger = logging.getLogger(__name__)` in every file
- Used in services, worker, routers — pattern:
```python
logger.info("Job %s done: %d memories extracted", job_id, len(created))
logger.error("Job %s failed: %s", job_id, exc)
logger.warning("Skipping malformed candidate: %s", exc)
```

**TypeScript Logging:**
- `console.error()` for caught errors
- No dedicated logging framework

**Plugin Logging:** `apps/plugin/victorious.js`
- Custom `log` object with `info()`, `warn()`, `error()` methods
- Conditional output based on `VICTORIOUS_DEBUG` env var
- Optional file logging via `VICTORIOUS_LOG_FILE`

## Comments

**Python Comment Patterns:**
- Every module starts with a docstring: `"""Victorious Memory — FastAPI application entry point."""`
- Section dividers: `# ─── Section Name ───` (em-dash separators, reused consistently across files)
- Inline comments explaining non-obvious logic: `# sentence-transformers is sync; run directly (worker is async but this is fast)`
- Function docstrings on key functions, especially public API methods
- Type aliases documented inline: `_TYPE_ALIASES` with comments about what LLM might produce

**TypeScript Comment Patterns:**
- Section headers with `// ─── Name ───` pattern matching Python style
- Minimal inline comments — code is self-documenting
- No JSDoc/TSDoc on components or functions

## Function Design

**Python Function Size:**
- Service functions: typically 10-40 lines
- Router endpoint handlers: 5-15 lines (thin — delegate to services)
- Helper/utility functions: 5-15 lines
- Longest functions in codebase are in `validator.py` (validation pipeline ~70 lines) and `agent.py` (prompt builder ~60 lines)

**Python Parameters:**
- Async functions always accept `db: AsyncSession` as first or last parameter
- Pagination defaults: `page: int = 1, per_page: int = 50`
- Filter parameters default to `None`: `project_id: str | None = None`
- Return type annotations on all functions

**Python Return Values:**
- Single entity lookups: `Model | None` or `-> Model`
- Paginated lists: `-> tuple[list[Memory], int]` (items, total count)
- Boolean for success/failure operations: `-> bool`
- Router endpoints return Pydantic response models or dicts

**TypeScript Function Design:**
- React components: prefer `function ComponentName()` over arrow functions for top-level exports
- Event handlers: `handleSubmit`, `handleClick` naming convention
- Components up to ~350 lines (e.g., `page.tsx` for dashboard) — no hard split yet
- Callbacks use `useCallback()` when dependencies warrant it

## Module Design

**Python Domain Structure:** `apps/api/app/domains/{name}/`
```
domains/
├── memories/
│   ├── __init__.py       # empty
│   ├── router.py         # FastAPI router with endpoints
│   ├── service.py        # business logic, CRUD operations
│   └── schemas.py        # Pydantic request/response models
├── context/
│   ├── __init__.py
│   ├── router.py
│   ├── service.py
│   └── schemas.py
├── extraction/
│   ├── __init__.py
│   ├── agent.py          # LLM prompt building + parsing
│   ├── schemas.py
│   └── validator.py      # validation pipeline
├── search/
│   ├── __init__.py
│   ├── service.py        # hybrid search
│   ├── embeddings.py     # sentence-transformers client
│   └── bm25.py           # BM25 ranking
└── providers/
    ├── __init__.py
    ├── router.py
    ├── schemas.py
    └── gateway.py        # LLM provider gateway singleton
```

**Non-domain routers** (`activity_router.py`, `jobs_router.py`, etc.) live directly in `domains/` without subdirectories — simpler endpoints with no dedicated service layer.

**Module-level state (Python):**
- `config.py`: `settings = Settings()` — configuration singleton
- `database.py`: `engine`, `async_session` — database singletons
- `gateway.py`: `gateway = ProviderGateway()` — HTTP client singleton
- `embeddings.py`: `_model = None` — lazy-loaded model, modified via global

**TypeScript Module Structure:** `apps/web/`
```
app/
├── layout.tsx            # Root layout
├── page.tsx              # Dashboard
├── globals.css           # Global styles
├── memories/page.tsx     # /memories route
├── projects/
│   ├── page.tsx          # /projects route
│   └── [id]/page.tsx     # /projects/:id route
└── ...
components/
├── layout/
│   ├── Sidebar.tsx
│   └── TopBar.tsx
└── modals/
    ├── CreateMemoryModal.tsx
    ├── EditMemoryModal.tsx
    └── ...
lib/
└── api.ts                # API client with named exports
```

**TypeScript Exports:**
- Components use `export default function`
- API client uses named exports: `export const memoriesApi`, `export const projectsApi`
- No barrel/index files — imports reference files directly
- Color maps and constants defined at module level and used locally

---

*Convention analysis: 2026-05-25*
