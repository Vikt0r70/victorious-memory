# Technology Stack

**Analysis Date:** 2026-05-25

## Languages

**Primary:**
- Python 3.12+ - Backend API (`apps/api/`), MCP server (`apps/mcp/`)
- TypeScript 5+ - Frontend web dashboard (`apps/web/`)

**Secondary:**
- JavaScript (CommonJS) - OpenCode plugin (`apps/plugin/victorious.js`)
- SQL - Database queries, raw SQL for job claiming in worker

## Runtime

**Backend Environment:**
- Python 3.12-slim (Docker base image: `apps/api/Dockerfile`)
- Uvicorn 0.30.0+ (ASGI server) — `apps/api/pyproject.toml`

**Frontend Environment:**
- Node.js (no `.nvmrc` present — version not pinned)
- Next.js 16.2.6 with built-in dev server — `apps/web/package.json`

**Package Manager:**
- pip (Python) via Hatchling build system — `apps/api/pyproject.toml`
- npm (Node.js) — `apps/web/package.json`
- Lockfile: `apps/web/package-lock.json` (present)

## Frameworks

**Core:**
- FastAPI 0.115.0+ - REST API framework with async support — `apps/api/app/main.py`
- Next.js 16.2.6 - React full-stack framework (App Router) — `apps/web/next.config.ts`
- React 19.2.4 - UI component library — `apps/web/package.json`
- OpenCode Plugin API 1.15.10 - Agent plugin framework — `.opencode/package.json`

**Testing:**
- pytest 8.0.0+ - Python test runner — `apps/api/pyproject.toml` (dev dependency)
- pytest-asyncio 0.24.0+ - Async test support — `apps/api/pyproject.toml` (dev dependency)

**Build/Dev:**
- Hatchling - Python build backend — `apps/api/pyproject.toml`
- TypeScript 5+ - Static type checking — `apps/web/tsconfig.json`
- ESLint 9+ - JavaScript/TypeScript linting — `apps/web/package.json`
- Tailwind CSS 4+ - Utility-first CSS framework — `apps/web/tailwind.config.ts`

## Key Dependencies

**Critical:**
- SQLAlchemy 2.0.30+ (with asyncio) - ORM for PostgreSQL — `apps/api/pyproject.toml`
- asyncpg 0.30.0+ - High-performance async PostgreSQL driver — `apps/api/pyproject.toml`
- pgvector 0.3.0+ - pgvector extension integration for vector search — `apps/api/pyproject.toml`
- Pydantic 2.9.0+ - Request/response validation and serialization — `apps/api/pyproject.toml`
- pydantic-settings 2.5.0+ - Environment-based configuration — `apps/api/app/config.py`
- httpx 0.28.0+ - Async HTTP client for LLM provider calls — `apps/api/pyproject.toml`
- numpy 1.26.0+ - Numerical operations for embedding math — `apps/api/pyproject.toml`
- sentence-transformers 3.0.0+ - In-process embedding model (BAAI/bge-small-en-v1.5) — `apps/api/pyproject.toml`

**Infrastructure:**
- Alembic 1.13.0+ - Database migration tool — `apps/api/pyproject.toml`
- pgvector/pgvector:pg16 - Docker image for PostgreSQL 16 with pgvector extension — `docker-compose.yml`

## Configuration

**Environment:**
- `.env` file (gitignored) — loaded by Pydantic Settings — `apps/api/app/config.py`
- `.env.example` — template with all env vars documented — `.env.example`
- `apps/web/.env.local` — frontend env (contains `NEXT_PUBLIC_API_URL`)
- Config keys (all in `apps/api/app/config.py:Settings`):
  - `DATABASE_URL` — PostgreSQL connection string
  - `EMBEDDING_URL` — TEI embedding service (not actually used; embeddings run in-process)
  - `LLM_BASE_URL` — Default LLM provider endpoint
  - `LLM_MODEL` — Default model name
  - `LLM_API_KEY` — API key for LLM (optional)
  - `API_HOST` / `API_PORT` — Bind address
  - `DEBUG` — SQLAlchemy echo toggle
  - `EXTRACTION_TOKEN_THRESHOLD` — Token threshold before triggering extraction
  - `EXTRACTION_MAX_RETRIES` — Max retry attempts for failed jobs
  - `EXTRACTION_POLL_INTERVAL` — Worker poll interval in seconds
  - `AUTO_APPROVE_ENABLED` / `AUTO_APPROVE_THRESHOLD` — Auto-approve settings

**Build:**
- `apps/api/pyproject.toml` — Python project metadata and dependencies
- `apps/web/tsconfig.json` — TypeScript compiler config with `@/*` path alias
- `apps/web/next.config.ts` — Next.js configuration
- `apps/web/tailwind.config.ts` — Tailwind CSS theme (Material Design 3 dark palette, Inter + JetBrains Mono fonts)
- `apps/web/postcss.config.mjs` — PostCSS for Tailwind
- `apps/web/eslint.config.mjs` — ESLint with next config

## Platform Requirements

**Development:**
- Python 3.12+
- Node.js (recent LTS recommended)
- Docker + Docker Compose (for PostgreSQL with pgvector)
- Git

**Production:**
- Docker Compose — `docker-compose.yml` defines:
  - `api` service: Python 3.12, port 8080
  - `db` service: pgvector/pgvector:pg16, port 5432
  - HuggingFace cache volume (`hf_cache`) for embedding model persistence
  - Deployment target: VPS (per `IMPLEMENTATION.md`)

---

*Stack analysis: 2026-05-25*
