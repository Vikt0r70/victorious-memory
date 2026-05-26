# Conventions

## Python (`apps/api/`)
- `from __future__ import annotations` in every module for PEP 604 union syntax
- Domain modules follow `app/domains/<name>/` with `__init__.py`, `router.py`, `service.py`, `schemas.py`
- IDs use prefixed format: `f"{prefix}_{uuid.uuid4().hex[:8]}"` (e.g. `mem_abc12345`)
- SQLAlchemy models defined with `Mapped[]` + `mapped_column()` (declarative)
- DB sessions: FastAPI dependency `get_db` yields AsyncSession with commit/rollback logic
- Config: singleton `Settings` from `pydantic_settings.BaseSettings`, imported as `from app.config import settings`
- Worker: asyncio task within FastAPI lifespan, polls with `FOR UPDATE SKIP LOCKED`
- Activity logging: `log_activity()` writes to `activities` table for audit trail
- No type checker config (mypy, pyright, ruff) currently configured
- Tests use `unittest.mock` (MagicMock, AsyncMock) + FastAPI `TestClient` with dependency overrides

## TypeScript (`apps/web/`)
- Next.js 16 app router pattern
- ESLint config uses flat config (`eslint.config.mjs`), eslint-config-next
- Tailwind 4 with PostCSS
- Routes organized by feature: `app/<feature>/page.tsx`

## General
- Environment variables: `.env` file, template at `.env.example`
- Git: `main` branch, `.gitignore` covers Python, Node, and secrets
- Line endings: CRLF default (Windows project)
