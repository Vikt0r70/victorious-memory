# Tech Stack

## Backend (`apps/api/`)
- **Language**: Python 3.12+
- **Framework**: FastAPI 0.115+ (async, lifespan-based startup)
- **ORM**: SQLAlchemy 2.0+ (async, DeclarativeBase)
- **DB**: PostgreSQL 16 + pgvector extension (`pgvector/pgvector:pg16`)
- **Driver**: asyncpg 0.30+
- **Migrations**: Alembic 1.13+
- **Config**: pydantic-settings 2.5+ (reads `.env`)
- **Embeddings**: sentence-transformers 3.0+
- **LLM**: litellm 1.86+ (provider-agnostic)
- **Encryption**: cryptography 48+ (Fernet for provider API keys)
- **HTTP client**: httpx 0.28+
- **Build**: hatchling

## Frontend (`apps/web/`)
- **Framework**: Next.js 16.2
- **React**: 19.2
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript 5
- **Lint**: ESLint 9 + eslint-config-next (core-web-vitals + typescript)

## MCP Server (`apps/mcp/`)
- **Language**: Python 3.12 (stdlib only — no dependencies beyond `urllib.request`, `json`, `sys`, `os`)
- **Protocol**: JSON-RPC over stdio

## Infrastructure
- **Container**: Docker Compose (API + DB)
- **API**: port 8080
- **DB**: port 5432
- **Volumes**: pgdata (Postgres), hf_cache (HuggingFace models)
- **DNS**: 8.8.8.8, 8.8.4.4 (explicitly set on API container)
