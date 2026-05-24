# Victorious Memory v2 — Full Implementation Plan

> **Purpose**: This document is the single source of truth for building the entire system.
> Each task is specific enough that any developer or AI agent can execute it without ambiguity.

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | Victorious Memory |
| **Repo** | `D:\Victorious Memory 2V` |
| **License** | MIT |
| **Deploy target** | Docker Compose on VPS |
| **Backend** | Python 3.12 + FastAPI |
| **Frontend** | React 19 + TypeScript + Vite |
| **Database** | PostgreSQL 16 + pgvector |
| **Embeddings** | bge-small-en-v1.5 (384-dim) via HuggingFace TEI |
| **LLM** | Any OpenAI-compatible endpoint (configurable via UI) |
| **Plugin** | JavaScript, OpenCode plugin API |

---

## Directory Structure (Final)

```
D:\Victorious Memory 2V\
├── apps/
│   ├── api/                          # Backend (Python FastAPI)
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py               # FastAPI app, lifespan, CORS
│   │   │   ├── config.py             # Pydantic Settings from env
│   │   │   ├── database.py           # async SQLAlchemy + pgvector
│   │   │   ├── models.py             # SQLAlchemy ORM models (all tables)
│   │   │   ├── worker.py             # Background extraction worker
│   │   │   ├── domains/
│   │   │   │   ├── ingest/
│   │   │   │   │   ├── router.py     # POST /api/ingest
│   │   │   │   │   ├── service.py    # Store exchange, create job
│   │   │   │   │   └── schemas.py    # Pydantic request/response models
│   │   │   │   ├── context/
│   │   │   │   │   ├── router.py     # GET /api/context
│   │   │   │   │   ├── service.py    # Hybrid search + graph + build block
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── memories/
│   │   │   │   │   ├── router.py     # CRUD /api/memories
│   │   │   │   │   ├── service.py    # Create, update, approve, reject, delete
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── projects/
│   │   │   │   │   ├── router.py     # CRUD + POST /api/projects/detect
│   │   │   │   │   ├── service.py    # Detect from path, register, update
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── extraction/
│   │   │   │   │   ├── agent.py      # LLM extraction prompt + parsing
│   │   │   │   │   ├── validator.py  # Dedup, grounding, confidence scoring
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── graph/
│   │   │   │   │   ├── router.py     # GET /api/graph/:memory_id
│   │   │   │   │   ├── service.py    # Edge detection, traversal
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── timeline/
│   │   │   │   │   ├── router.py     # GET /api/projects/:id/timeline
│   │   │   │   │   ├── service.py    # Build timeline from memories
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── search/
│   │   │   │   │   ├── service.py    # Hybrid semantic + BM25
│   │   │   │   │   ├── embeddings.py # Embedding client (calls TEI)
│   │   │   │   │   └── bm25.py      # BM25 ranking
│   │   │   │   ├── lifecycle/
│   │   │   │   │   ├── service.py    # Decay, consolidation, conflicts
│   │   │   │   │   └── scheduler.py  # Periodic job scheduling
│   │   │   │   └── providers/
│   │   │   │       ├── gateway.py    # LLM provider gateway
│   │   │   │       ├── router.py     # CRUD /api/providers
│   │   │   │       └── schemas.py
│   │   │   └── mcp_server.py         # MCP tools for agent access
│   │   ├── alembic/                  # DB migrations
│   │   │   ├── alembic.ini
│   │   │   ├── env.py
│   │   │   └── versions/
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   └── web/                          # Frontend (React + Vite)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── api/
│       │   │   └── client.ts
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── ReviewQueue.tsx
│       │   │   ├── ProjectView.tsx
│       │   │   ├── GraphExplorer.tsx
│       │   │   ├── ActivityFeed.tsx
│       │   │   └── Settings.tsx
│       │   ├── components/
│       │   │   ├── MemoryCard.tsx
│       │   │   ├── MemoryTable.tsx
│       │   │   ├── TimelineView.tsx
│       │   │   ├── GraphView.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── Layout.tsx
│       │   └── styles/
│       │       └── index.css
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── Dockerfile
│
├── plugins/
│   └── opencode/
│       ├── victorious.js             # OpenCode plugin
│       └── README.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
└── docs/
    ├── ARCHITECTURE.md
    ├── SCHEMA.md
    └── API.md
```

---
---

# PHASE 1: Foundation — API + Database + Extraction

> **Goal**: A working API that receives conversations, extracts memories via LLM, stores them
> in PostgreSQL with vector embeddings, and returns relevant context via hybrid search.
>
> **End state**: `POST /api/ingest` a conversation → background worker extracts memories →
> `GET /api/context` returns relevant memories ranked by similarity.

---

## Task 1.1: Initialize Repository

**What**: Create the repo structure, git init, essential config files.

**Files to create**:

### `README.md`
Content: Project name, one-line description, `docker compose up -d` quick start, link to ARCHITECTURE.md.

### `.gitignore`
```
__pycache__/
*.pyc
.env
node_modules/
dist/
.venv/
*.egg-info/
pgdata/
```

### `LICENSE`
MIT license text with copyright holder "Victorious Memory Contributors".

### `.env.example`
```env
# Database
DATABASE_URL=postgresql+asyncpg://victorious:victorious@localhost:5432/victorious

# Embedding service
EMBEDDING_URL=http://localhost:8090

# LLM Provider (default — user configures more in UI)
LLM_BASE_URL=http://localhost:7777/v1
LLM_MODEL=gpt-5-mini
LLM_API_KEY=optional

# API
API_HOST=0.0.0.0
API_PORT=8080
DEBUG=false

# Extraction
EXTRACTION_TOKEN_THRESHOLD=500
EXTRACTION_MAX_RETRIES=3
```

**Commands to run**:
```bash
cd "D:\Victorious Memory 2V"
git init
```

**Verify**: Directory structure exists, git initialized.

---

## Task 1.2: Backend Project Setup

**What**: Create the Python project with all dependencies.

### `apps/api/pyproject.toml`

```toml
[project]
name = "victorious-memory-api"
version = "0.1.0"
description = "Victorious Memory — AI memory system backend"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.30",
    "asyncpg>=0.30.0",
    "pgvector>=0.3.0",
    "alembic>=1.13.0",
    "pydantic>=2.9.0",
    "pydantic-settings>=2.5.0",
    "httpx>=0.28.0",
    "numpy>=1.26.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Key dependency choices**:
- `asyncpg` — fastest async PostgreSQL driver for Python
- `sqlalchemy[asyncio]` — ORM with async support
- `pgvector` — SQLAlchemy integration for pgvector extension
- `httpx` — async HTTP client for calling LLM and embedding services
- No Redis. No Celery. Background worker is a simple asyncio task.

### `apps/api/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Commands**:
```bash
cd "D:\Victorious Memory 2V\apps\api"
pip install -e ".[dev]"
```

**Verify**: `python -c "import fastapi; import sqlalchemy; import pgvector"` succeeds.

---

## Task 1.3: Configuration Module

**What**: Centralized config from environment variables using Pydantic Settings.

### `apps/api/app/config.py`

Define a `Settings` class inheriting from `pydantic_settings.BaseSettings` with these fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `database_url` | str | `postgresql+asyncpg://victorious:victorious@localhost:5432/victorious` | Async PG connection string |
| `embedding_url` | str | `http://localhost:8090` | TEI embedding service URL |
| `embedding_dimensions` | int | 384 | bge-small output dimensions |
| `llm_base_url` | str | `http://localhost:7777/v1` | Default LLM endpoint |
| `llm_model` | str | `gpt-5-mini` | Default model name |
| `llm_api_key` | str | `""` | API key (optional for some providers) |
| `api_host` | str | `0.0.0.0` | Bind host |
| `api_port` | int | 8080 | Bind port |
| `debug` | bool | False | Debug mode |
| `extraction_token_threshold` | int | 500 | Trigger extraction after N tokens |
| `extraction_max_retries` | int | 3 | Max retry attempts for failed jobs |
| `extraction_poll_interval` | float | 2.0 | Seconds between job queue polls |
| `auto_approve_enabled` | bool | True | Auto-approve high confidence memories |
| `auto_approve_threshold` | float | 0.85 | Confidence threshold for auto-approve |

Config class reads from `.env` file. Export a module-level `settings = Settings()` singleton.

**Rules**:
- Every setting has a sensible default so the system works out of the box.
- All LLM/embedding URLs are configurable — nothing hardcoded.
- Import as `from app.config import settings` everywhere.

**Verify**: `from app.config import settings; print(settings.database_url)` prints the default.

---

## Task 1.4: Database Connection + Base

**What**: Set up async SQLAlchemy engine, session factory, and declarative base.

### `apps/api/app/database.py`

**Components**:
1. `engine` — `create_async_engine(settings.database_url, echo=settings.debug)`
2. `async_session` — `async_sessionmaker(engine, expire_on_commit=False)`
3. `Base` — `DeclarativeBase` subclass (all models inherit from this)
4. `get_db()` — async generator that yields `AsyncSession` (FastAPI dependency)
5. `init_db()` — creates pgvector extension and all tables:
   ```python
   async with engine.begin() as conn:
       await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
       await conn.run_sync(Base.metadata.create_all)
   ```

**Verify**: Call `init_db()` → connect to PostgreSQL → extension created, no errors.

---

## Task 1.5: Database Models (SQLAlchemy ORM)

**What**: Define ALL database tables as SQLAlchemy models in one file.

### `apps/api/app/models.py`

**ID generation rule**: All IDs are TEXT, format `{prefix}_{8_random_hex_chars}`.
Use `uuid.uuid4().hex[:8]` for the random part. Prefixes:
- `prj_` for projects
- `mem_` for memories
- `edg_` for edges
- `exc_` for exchanges
- `job_` for jobs
- `tl_` for timeline entries
- `prov_` for provider configs
- `act_` for activity log
- `stg_` for settings

**Timestamp rule**: All `created_at` use `server_default=func.now()`. All timestamps are `TIMESTAMPTZ`.

---

### Table: `projects`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `prj_` prefixed slug |
| `display_name` | `String` | NOT NULL | Human-readable name |
| `workspace_path` | `String` | nullable | Most recent directory path |
| `tech_stack` | `ARRAY(String)` | default `[]` | Auto-detected technologies |
| `last_active` | `DateTime(timezone=True)` | server_default NOW | |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |
| `metadata_` | `JSONB` | default `{}` | column name `metadata` in DB |

---

### Table: `memories`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `mem_` prefixed |
| `content` | `Text` | NOT NULL | The memory text |
| `memory_type` | `String` | NOT NULL | One of: `decision`, `preference`, `constraint`, `bugfix`, `lesson`, `pattern`, `research`, `reference`, `architecture`, `context` |
| `scope` | `String` | NOT NULL, default `'global'` | Project ID, `"global"`, or `"cross-project"` |
| `project_id` | `String` | FK→projects.id, nullable | NULL for global scope |
| `confidence_score` | `Float` | NOT NULL, default 0.8 | 0.0 to 1.0 |
| `confidence_label` | `String` | NOT NULL, default `'medium'` | `high` (≥0.85), `medium` (≥0.6), `low` (<0.6) |
| `confidence_reasoning` | `Text` | nullable | LLM's explanation |
| `status` | `String` | NOT NULL, default `'active'` | `active`, `pending_review`, `deprecated`, `superseded`, `rejected` |
| `auto_approved` | `Boolean` | default False | |
| `source_type` | `String` | nullable | `user_statement`, `assistant_inference`, `tool_output` |
| `source_session` | `String` | nullable | OpenCode session ID |
| `source_exchange_id` | `String` | FK→exchanges.id, nullable | |
| `dynamic_tag` | `String` | nullable | `[EXTRACTED]`, `[INFERRED]`, `[PATTERN]` |
| `tags` | `ARRAY(String)` | default `[]` | |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |
| `updated_at` | `DateTime(timezone=True)` | server_default NOW, onupdate NOW | |
| `last_accessed` | `DateTime(timezone=True)` | nullable | |
| `access_count` | `Integer` | default 0 | |
| `superseded_by` | `String` | FK→memories.id, nullable | |
| `embedding` | `Vector(384)` | nullable | pgvector column |

**Indexes**: `project_id`, `scope`, `memory_type`, `status`, ivfflat on `embedding` with `vector_cosine_ops`.

---

### Table: `memory_edges`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `edg_` prefixed |
| `source_id` | `String` | FK→memories.id ON DELETE CASCADE | |
| `target_id` | `String` | FK→memories.id ON DELETE CASCADE | |
| `relation_type` | `String` | NOT NULL | `supersedes`, `contradicts`, `depends_on`, `caused_by`, `fixed_by`, `enables`, `related_to` |
| `description` | `Text` | nullable | Why this relationship exists |
| `confidence` | `Float` | default 0.8 | |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |

**Constraint**: `UniqueConstraint(source_id, target_id, relation_type)`

---

### Table: `exchanges`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `exc_` prefixed |
| `session_id` | `String` | NOT NULL | OpenCode session ID |
| `project_id` | `String` | FK→projects.id, nullable | |
| `user_content` | `Text` | nullable | User's message |
| `agent_parts` | `JSONB` | default `[]` | `[{type, content, tool, args, timestamp}]` |
| `file_paths` | `ARRAY(String)` | default `[]` | File paths from tool calls |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |

---

### Table: `extraction_jobs`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `job_` prefixed |
| `exchange_id` | `String` | FK→exchanges.id | |
| `status` | `String` | NOT NULL, default `'pending'` | `pending`, `processing`, `done`, `failed` |
| `attempts` | `Integer` | default 0 | |
| `max_attempts` | `Integer` | default 3 | |
| `error` | `Text` | nullable | Error message on failure |
| `retry_after` | `DateTime(timezone=True)` | nullable | |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |
| `started_at` | `DateTime(timezone=True)` | nullable | |
| `completed_at` | `DateTime(timezone=True)` | nullable | |

**Index**: `status` (for fast job claiming).

---

### Table: `timeline_entries`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `tl_` prefixed |
| `project_id` | `String` | FK→projects.id, NOT NULL | |
| `entry_type` | `String` | NOT NULL | `decision`, `bug`, `feature`, `milestone`, `refactor` |
| `title` | `String` | NOT NULL | Short title |
| `description` | `Text` | nullable | |
| `memory_ids` | `ARRAY(String)` | default `[]` | |
| `status` | `String` | default `'open'` | `open`, `resolved`, `in_progress` |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |
| `resolved_at` | `DateTime(timezone=True)` | nullable | |

---

### Table: `provider_configs`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `prov_` prefixed |
| `role` | `String` | NOT NULL, UNIQUE | `extraction`, `edge_detection`, `consolidation` |
| `provider_type` | `String` | NOT NULL | `openai_compatible`, `anthropic` |
| `base_url` | `String` | NOT NULL | |
| `model` | `String` | NOT NULL | |
| `api_key` | `String` | default `""` | |
| `max_tokens` | `Integer` | default 2000 | |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |
| `updated_at` | `DateTime(timezone=True)` | server_default NOW | |

---

### Table: `activity_log`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `String`, PK | | `act_` prefixed |
| `event_type` | `String` | NOT NULL | `memory_created`, `memory_approved`, `memory_rejected`, `extraction_started`, `extraction_completed`, `extraction_failed`, `conflict_detected`, `edge_created` |
| `description` | `Text` | NOT NULL | Human-readable |
| `memory_id` | `String` | FK→memories.id, nullable | |
| `project_id` | `String` | FK→projects.id, nullable | |
| `metadata_` | `JSONB` | default `{}` | |
| `created_at` | `DateTime(timezone=True)` | server_default NOW | |

---

### Table: `app_settings`

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `key` | `String`, PK | | Setting key (e.g., `extraction_token_threshold`) |
| `value` | `JSONB` | NOT NULL | Setting value |
| `updated_at` | `DateTime(timezone=True)` | server_default NOW | |

---

**Verify**: All models import without error. `Base.metadata.create_all` creates all tables. Inspect DB with `\dt` → 9 tables exist.

---

## Task 1.6: Alembic Migration Setup

**What**: Set up Alembic for database migrations.

### Steps:
1. `cd apps/api && alembic init alembic`
2. Edit `alembic.ini`: set `sqlalchemy.url` to read from `DATABASE_URL` env var
3. Edit `alembic/env.py`:
   - Import `Base` from `app.database`
   - Import ALL models from `app.models` (so autogenerate sees them)
   - Set `target_metadata = Base.metadata`
   - Configure for async engine using `run_async_migrations()`
4. Generate initial migration: `alembic revision --autogenerate -m "initial_schema"`
5. Apply: `alembic upgrade head`

**Verify**: `alembic current` shows the head revision. All tables exist in PostgreSQL.

---

## Task 1.7: Embedding Client

**What**: Client that calls HuggingFace Text Embeddings Inference (TEI) to generate 384-dim vectors.

### `apps/api/app/domains/search/embeddings.py`

**Public function**:
```python
async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts. Returns list of 384-dim vectors."""

async def embed_text(text: str) -> list[float]:
    """Embed a single text. Returns 384-dim vector."""
```

**Implementation rules**:
1. POST to `{settings.embedding_url}/embed` with body `{"inputs": texts}`
2. TEI returns a JSON array of arrays: `[[0.01, -0.02, ...], ...]`
3. Normalize each vector to unit length (L2 norm = 1) so dot product = cosine similarity
4. Batch limit: max 32 texts per request. If more, split into batches.
5. Use a module-level `httpx.AsyncClient` singleton (created on first use, reused)
6. Timeout: 30 seconds per request
7. On failure, raise `EmbeddingError(message)` — let caller decide retry logic

**Verify**: `await embed_text("Hello world")` → returns list of 384 floats, all between -1 and 1.

---

## Task 1.8: BM25 Search

**What**: BM25 keyword matching implementation for the hybrid search system.

### `apps/api/app/domains/search/bm25.py`

**Public function**:
```python
def bm25_rank(query: str, documents: list[tuple[str, str]]) -> list[tuple[str, float]]:
    """
    Rank documents by BM25 relevance to query.
    
    Args:
        query: search query string
        documents: list of (doc_id, doc_text) tuples
    
    Returns:
        list of (doc_id, score) tuples, sorted descending by score.
        Scores normalized to 0.0-1.0 range.
    """
```

**Implementation rules**:
1. Tokenize by splitting on whitespace + punctuation, lowercase, strip
2. Remove stopwords (English, hardcoded set of ~150 common words)
3. BM25 parameters: `k1 = 1.5`, `b = 0.75`
4. IDF formula: `log((N - df + 0.5) / (df + 0.5) + 1)` where N = total docs, df = docs containing term
5. Score formula: `sum(IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl)))` for each query term
6. Normalize scores: divide all by the max score (so top result = 1.0)
7. Pure Python, no external dependencies beyond stdlib

**Verify**: Query "PostgreSQL database" against 5 documents → document containing "PostgreSQL" ranks first.

---

## Task 1.9: Hybrid Search Service

**What**: Combines semantic search (pgvector) + BM25 keyword search.

### `apps/api/app/domains/search/service.py`

**Public function**:
```python
async def hybrid_search(
    query: str,
    project_id: str | None = None,
    scope_filter: list[str] | None = None,  # e.g., ["global", "project-id"]
    top_k: int = 10,
    status_filter: list[str] = ["active"],
) -> list[SearchResult]:
    """
    Returns:
        list of SearchResult(memory_id, memory, semantic_score, bm25_score, combined_score)
        sorted by combined_score descending.
    """
```

**Implementation rules**:

1. **Embed the query**: `query_vec = await embed_text(query)`

2. **Semantic search** via SQL:
   ```sql
   SELECT *, 1 - (embedding <=> :query_vec) AS similarity
   FROM memories
   WHERE status = ANY(:statuses)
   AND (
       project_id = :project_id
       OR scope = 'global'
       OR scope = 'cross-project'
   )
   ORDER BY embedding <=> :query_vec
   LIMIT :top_k * 3
   ```
   This returns up to `top_k * 3` candidates with their cosine similarity scores.

3. **BM25 search**: Take all candidates from step 2, run `bm25_rank(query, candidates)`.

4. **Fuse scores**: For each candidate present in either result set:
   ```python
   combined = 0.7 * semantic_score + 0.3 * bm25_score
   ```
   If a candidate only appears in one set, the missing score is 0.0.

5. **Sort by combined score descending**, return top_k.

6. **If no query** (empty string or None): Skip search, return recent memories:
   ```sql
   SELECT * FROM memories WHERE ... ORDER BY created_at DESC LIMIT :top_k
   ```

**Verify**: Insert 20 test memories → `hybrid_search("PostgreSQL")` → returns PostgreSQL-related memories ranked first.

---

## Task 1.10: Provider Gateway

**What**: Routes LLM calls to the user's configured provider. Supports any OpenAI-compatible endpoint.

### `apps/api/app/domains/providers/gateway.py`

**Class: `ProviderGateway`**

```python
class ProviderGateway:
    async def complete(
        self,
        messages: list[dict],           # [{"role": "system", "content": "..."}]
        model_role: str = "extraction", # which configured model to use
        response_format: str | None = "json",  # "json" or None for text
        max_tokens: int | None = None,  # override provider default
    ) -> str:
        """Send a completion request. Returns the response text."""
```

**Implementation rules**:

1. **Provider resolution order**:
   a. Check `provider_configs` table for a row with `role = model_role`
   b. If not found, fall back to env vars: `settings.llm_base_url`, `settings.llm_model`, `settings.llm_api_key`
   c. If neither configured, raise `ProviderNotConfiguredError`

2. **HTTP request** (OpenAI-compatible format):
   ```
   POST {base_url}/chat/completions
   Headers: Authorization: Bearer {api_key}  (only if api_key is non-empty)
   Body:
   {
     "model": "{model}",
     "messages": [...],
     "max_tokens": {max_tokens},
     "response_format": {"type": "json_object"}  // only if response_format == "json"
   }
   ```

3. **Response parsing**: Extract `response["choices"][0]["message"]["content"]`

4. **Error handling**:
   - HTTP 4xx/5xx → raise `ProviderError(status_code, response_text)`
   - Timeout (30 seconds) → raise `ProviderTimeoutError`
   - Connection error → raise `ProviderConnectionError`

5. **Singleton**: Instantiate once at module level. Use a shared `httpx.AsyncClient`.

6. **Anthropic support**: If `provider_type == "anthropic"`, use the Anthropic API format:
   ```
   POST {base_url}/v1/messages
   Headers: x-api-key: {api_key}, anthropic-version: 2023-06-01
   Body: {"model": "...", "max_tokens": ..., "messages": [...]}
   ```
   Response: `response["content"][0]["text"]`

### `apps/api/app/domains/providers/schemas.py`

```python
class ProviderConfigCreate(BaseModel):
    role: str              # extraction, edge_detection, consolidation
    provider_type: str     # openai_compatible, anthropic
    base_url: str
    model: str
    api_key: str = ""
    max_tokens: int = 2000

class ProviderConfigResponse(BaseModel):
    id: str
    role: str
    provider_type: str
    base_url: str
    model: str
    max_tokens: int
    created_at: datetime
    # NOTE: api_key is NOT returned in responses (security)
```

### `apps/api/app/domains/providers/router.py`

| Endpoint | Method | Input | Output | Description |
|----------|--------|-------|--------|-------------|
| `/api/providers` | GET | — | `list[ProviderConfigResponse]` | List all |
| `/api/providers/{role}` | PUT | `ProviderConfigCreate` | `ProviderConfigResponse` | Upsert by role |
| `/api/providers/{role}` | DELETE | — | `204` | Delete |
| `/api/providers/{role}/test` | POST | — | `{"status": "ok", "response": "..."}` | Test by sending "Say hello in one word" |

**Verify**: `PUT /api/providers/extraction` → `POST /api/providers/extraction/test` → returns "Hello" or similar.

---

## Task 1.11: Project Detection Service

**What**: Detect or create projects from workspace paths.

### `apps/api/app/domains/projects/schemas.py`

```python
class ProjectDetectRequest(BaseModel):
    path: str                    # workspace directory path
    worktree: str | None = None  # git worktree path
    name: str | None = None      # optional project name hint

class ProjectResponse(BaseModel):
    id: str
    display_name: str
    workspace_path: str | None
    tech_stack: list[str]
    last_active: datetime
    created_at: datetime
```

### `apps/api/app/domains/projects/service.py`

**Function: `detect_project(path, worktree, name) -> Project`**

**Logic**:
1. Normalize the path: replace backslashes with forward slashes, strip trailing slashes
2. Search DB: `SELECT * FROM projects WHERE workspace_path = :normalized_path`
3. If found → update `last_active = NOW()` → return
4. If not found → create:
   - Extract last directory component from path (e.g., `/home/user/my-app` → `my-app`)
   - `id` = slugify: lowercase, replace `[^a-z0-9]` with `-`, collapse `--` to `-`, strip leading/trailing `-`, max 50 chars
   - `display_name` = directory name with original casing and spaces
   - If `name` hint provided, use that instead of directory name
   - `workspace_path` = normalized path
   - `tech_stack` = empty (populated over time by extraction agent)
5. Return the project

### `apps/api/app/domains/projects/router.py`

| Endpoint | Method | Input | Output | Description |
|----------|--------|-------|--------|-------------|
| `/api/projects/detect` | POST | `ProjectDetectRequest` | `ProjectResponse` | Detect or create |
| `/api/projects` | GET | query: `search`, `page`, `per_page` | `list[ProjectResponse]` | List all |
| `/api/projects/{id}` | GET | — | `ProjectResponse` | Get one |
| `/api/projects/{id}` | PUT | `ProjectUpdateRequest` | `ProjectResponse` | Update name, tech_stack |
| `/api/projects/{id}` | DELETE | — | `204` | Soft delete |

**Verify**: `POST /api/projects/detect {"path": "D:\\Projects\\test"}` → creates project `id="test"`.

---

## Task 1.12: Ingest Endpoint

**What**: Receive conversation exchanges from the plugin, store them, create extraction jobs.

### `apps/api/app/domains/ingest/schemas.py`

```python
class AgentPart(BaseModel):
    type: str            # "text", "thinking", "tool_call"
    content: str = ""    # the content
    tool: str = ""       # tool name (only for tool_call type)
    timestamp: str = ""  # ISO timestamp

class ExchangeData(BaseModel):
    user: str                       # user message text
    agent_parts: list[AgentPart]    # all agent output parts
    file_paths: list[str] = []      # file paths from tool calls
    timestamp: str                  # ISO timestamp of the exchange

class IngestRequest(BaseModel):
    project_id: str | None = None   # detected project ID
    session_id: str                 # OpenCode session ID
    exchange: ExchangeData

class IngestResponse(BaseModel):
    exchange_id: str
    job_id: str
    status: str   # always "queued"
```

### `apps/api/app/domains/ingest/service.py`

**Function: `ingest_exchange(request: IngestRequest) -> IngestResponse`**

**Steps**:
1. If `project_id` is provided, verify it exists in `projects` table. If not found, create it using `detect_project` with path from file_paths.
2. Deduplicate and normalize `file_paths` (forward slashes, unique)
3. Create `Exchange` row in DB:
   ```python
   exchange = Exchange(
       id=generate_id("exc"),
       session_id=request.session_id,
       project_id=request.project_id,
       user_content=request.exchange.user,
       agent_parts=[p.model_dump() for p in request.exchange.agent_parts],
       file_paths=request.exchange.file_paths,
   )
   ```
4. Create `ExtractionJob` row:
   ```python
   job = ExtractionJob(
       id=generate_id("job"),
       exchange_id=exchange.id,
       status="pending",
       max_attempts=settings.extraction_max_retries,
   )
   ```
5. Log to `activity_log`: event_type="extraction_started"
6. Return `IngestResponse(exchange_id=exchange.id, job_id=job.id, status="queued")`

### `apps/api/app/domains/ingest/router.py`

| Endpoint | Method | Input | Output | Description |
|----------|--------|-------|--------|-------------|
| `/api/ingest` | POST | `IngestRequest` | `IngestResponse` | Ingest a conversation exchange |

**Performance rule**: This endpoint must be fast (< 100ms). It only stores data and creates a job. No LLM calls, no embedding, no search.

**Verify**: `POST /api/ingest` with test data → exchange row and job row appear in DB with status "pending".

---

## Task 1.13: LLM Extraction Agent

**What**: Reads a conversation exchange and extracts structured memory candidates via LLM.

### `apps/api/app/domains/extraction/schemas.py`

```python
class MemoryCandidate(BaseModel):
    content: str
    memory_type: str
    scope: str                              # "project", "global", "cross-project"
    confidence_score: float
    confidence_reasoning: str = ""
    tags: list[str] = []
    supersedes_content: str | None = None   # content of memory this replaces
```

### `apps/api/app/domains/extraction/agent.py`

**Function: `extract_memories(exchange, project, existing_memories, existing_preferences) -> list[MemoryCandidate]`**

**Steps**:

1. **Format existing memories** for the prompt:
   ```python
   def format_existing(memories):
       lines = []
       for m in memories:
           lines.append(f"- [{m.memory_type}] {m.content[:150]}")
       return "\n".join(lines) or "None yet."
   ```

2. **Format agent parts** for the prompt:
   ```python
   def format_agent_parts(parts):
       lines = []
       for p in parts:
           if p["type"] == "text":
               lines.append(f"[Agent text] {p['content'][:3000]}")
           elif p["type"] == "thinking":
               lines.append(f"[Agent thinking] {p['content'][:1500]}")
           elif p["type"] == "tool_call":
               lines.append(f"[Tool: {p.get('tool', '?')}] {p['content'][:500]}")
       return "\n\n".join(lines)
   ```

3. **Build the system prompt** — this is the EXACT prompt to send:

```
You are a memory extraction agent for "Victorious Memory". Read the conversation 
and extract DURABLE knowledge worth remembering for future conversations.

## What to Extract
- Decisions: explicit choices ("we will use PostgreSQL", "switching to TypeScript")
- Preferences: personal or team preferences ("I prefer dark mode", "short functions")
- Constraints: hard rules ("never commit API keys", "must support 1000 users")
- Bugfixes: bugs found and how they were fixed
- Lessons: insights and realizations ("caching reduces latency by 40%")
- Patterns: recurring practices ("always test before deploy")
- Architecture: system design ("three-layer API/service/data")
- Context: ongoing project state ("migrating to OAuth2")
- Research: investigation findings
- References: useful links, tools, resources

## What NOT to Extract
- Ephemeral tasks: "create a file", "run this command", "read that file"
- Actual code content: don't memorize code, only decisions ABOUT code
- Greetings, meta-conversation: "hello", "thanks", "let me think"
- Things already known (see below)

## Scope Rules
- "project": References project files, architecture, project-specific decisions
- "global": Personal preferences, general knowledge, cross-cutting concerns
- "cross-project": Patterns that apply to multiple projects

## Confidence Rules
- 0.9+: User explicitly stated it or confirmed by tool output
- 0.7-0.9: Strongly implied, clear intent
- 0.5-0.7: Inferred, may need verification
- Below 0.5: Too vague — do NOT extract

## Current Project
Name: {project_name or "unknown"}
Path: {project_path or "unknown"}

## Already Known (do NOT duplicate)
{formatted_existing_memories}

## User Preferences (already captured)
{formatted_existing_preferences}

## Conversation
Session: {session_id}
Time: {timestamp}

User: {user_content}

Agent:
{formatted_agent_parts}

## Output
Return a JSON array. Empty array [] if nothing worth remembering.
Each item:
{{
  "content": "Clear, concise, standalone memory text",
  "type": "decision|preference|constraint|bugfix|lesson|pattern|research|reference|architecture|context",
  "scope": "project|global|cross-project",
  "confidence_score": 0.5-1.0,
  "confidence_reasoning": "Why this confidence level",
  "tags": ["relevant", "tags"],
  "supersedes_content": "Exact text of existing memory this replaces, or null"
}}
```

4. **Call the provider gateway**:
   ```python
   response = await gateway.complete(
       messages=[{"role": "system", "content": prompt}],
       model_role="extraction",
       response_format="json",
   )
   ```

5. **Parse the response**:
   - Try `json.loads(response)`. If it returns a dict with a key like `"memories"`, extract the array.
   - If it returns a list directly, use that.
   - Validate each item against `MemoryCandidate` schema. Skip malformed items.
   - If JSON parsing fails entirely, retry once with an appended message: `"Return ONLY a JSON array, nothing else."`
   - If still fails, raise `ExtractionError("Failed to parse LLM response")`

**Verify**: Call with exchange "I decided to use PostgreSQL" → returns `[{content: "Decided to use PostgreSQL...", type: "decision", scope: "project", confidence_score: 0.9}]`.

---

## Task 1.14: Extraction Validator

**What**: Validates LLM output, deduplicates, checks grounding, assigns confidence labels, decides auto-approve.

### `apps/api/app/domains/extraction/validator.py`

**Function: `validate_candidates(candidates, exchange) -> list[ValidatedCandidate]`**

Each `ValidatedCandidate` is a `MemoryCandidate` plus:
- `confidence_label: str` — "high", "medium", "low"
- `status: str` — "active" (auto-approved) or "pending_review"
- `auto_approved: bool`
- `source_type: str` — inferred from which part of the exchange it came from

**Validation steps (in order)**:

### Step 1: Schema sanitization
- `memory_type` must be one of the 10 allowed types. Map common alternatives:
  - `"bug"` → `"bugfix"`, `"pref"` → `"preference"`, `"arch"` → `"architecture"`
  - Unknown types → default to `"reference"`
- `scope`: must be `"project"`, `"global"`, or `"cross-project"`. Invalid → `"global"`.
- `confidence_score`: clamp to [0.0, 1.0]
- `content`: strip whitespace, skip if empty or < 10 chars

### Step 2: Confidence label assignment
```python
if score >= 0.85: label = "high"
elif score >= 0.6: label = "medium"
else: label = "low"
```

### Step 3: Duplicate detection
1. Embed the candidate content: `vec = await embed_text(candidate.content)`
2. Search existing memories:
   ```sql
   SELECT *, 1 - (embedding <=> :vec) AS similarity
   FROM memories WHERE status IN ('active', 'pending_review')
   ORDER BY embedding <=> :vec LIMIT 5
   ```
3. If top result similarity > 0.90 → **SKIP** (exact duplicate). Log: "Duplicate detected, skipping."
4. If top result similarity 0.80-0.90 → **MERGE**: increase existing memory's `confidence_score` by 0.05 (cap at 1.0), add any new tags. Skip creating new memory.
5. If similarity < 0.80 → **PROCEED** (new memory)

### Step 4: Grounding check
Verify the candidate relates to the actual exchange:
```python
def is_grounded(candidate_content: str, exchange) -> bool:
    # Tokenize candidate and exchange
    candidate_tokens = set(tokenize(candidate_content))
    exchange_text = exchange.user_content + " ".join(p["content"] for p in exchange.agent_parts)
    exchange_tokens = set(tokenize(exchange_text))
    # At least 3 non-stopword tokens must overlap
    overlap = candidate_tokens - STOPWORDS & exchange_tokens - STOPWORDS
    return len(overlap) >= 3
```
If NOT grounded → reduce `confidence_score` by 50% (penalty for possible hallucination).

### Step 5: Source type inference
```python
if any(token in user_content.lower() for token in ["i want", "i prefer", "i decided", "we should", "let's use"]):
    source_type = "user_statement"
elif found_in_tool_output:
    source_type = "tool_output"
else:
    source_type = "assistant_inference"
```

### Step 6: Supersession handling
If `supersedes_content` is set:
1. Embed the superseded content
2. Find the best matching existing memory (similarity > 0.80)
3. If found: mark it for `status = "superseded"`, `superseded_by = new_id` (applied after storage)

### Step 7: Auto-approve decision
```python
if settings.auto_approve_enabled and score >= settings.auto_approve_threshold:
    status = "active"
    auto_approved = True
else:
    status = "pending_review"
    auto_approved = False
```
**Exception**: If a conflict/contradiction is detected (supersedes an existing active memory), NEVER auto-approve regardless of threshold. Always queue for review.

**Verify**: Pass a duplicate memory → returns empty list. Pass a valid new memory → returns with correct label and status.

---

## Task 1.15: Memory Storage Service

**What**: Creates memory records in the database with embeddings.

### `apps/api/app/domains/memories/service.py`

**Function: `create_memory(candidate: ValidatedCandidate, exchange: Exchange) -> Memory`**

**Steps**:
1. Generate ID: `mem_{uuid4().hex[:8]}`
2. Embed the content: `embedding = await embed_text(candidate.content)`
3. Create the ORM object with all fields from the candidate
4. Set `source_session = exchange.session_id`
5. Set `source_exchange_id = exchange.id`
6. Set `dynamic_tag = "[EXTRACTED]"` (from LLM extraction)
7. Insert into DB
8. If `superseded_by` info exists from validator, update the old memory
9. Return the created memory

**Function: `update_memory(memory_id, updates) -> Memory`**
- Accepts partial updates (any subset of fields)
- If `content` changes, re-embed
- Set `updated_at = NOW()`
- Return updated memory

**Function: `approve_memory(memory_id) -> Memory`**
- Set `status = "active"`, `reviewed_by = "human"`, `reviewed_at = NOW()`
- Log to activity: "memory_approved"

**Function: `reject_memory(memory_id, reason: str = "") -> Memory`**
- Set `status = "rejected"`, `reviewed_by = "human"`, `reviewed_at = NOW()`
- Log to activity: "memory_rejected" with reason in metadata

**Function: `list_memories(filters) -> tuple[list[Memory], int]`**
- Accept all filter params: project_id, scope, memory_type, status, confidence_label, tags, search, created_after, created_before, page, per_page, sort_by, sort_order
- Build dynamic SQL query based on provided filters
- Return (results, total_count) for pagination

### `apps/api/app/domains/memories/router.py`

| Endpoint | Method | Input | Output | Description |
|----------|--------|-------|--------|-------------|
| `/api/memories` | GET | query params (all filters) | `{items: [...], total: N, page: N}` | List with pagination |
| `/api/memories/{id}` | GET | — | `MemoryResponse` | Get one |
| `/api/memories` | POST | `MemoryCreateRequest` | `MemoryResponse` | Manually create |
| `/api/memories/{id}` | PUT | `MemoryUpdateRequest` | `MemoryResponse` | Update fields |
| `/api/memories/{id}` | DELETE | — | `204` | Delete |
| `/api/memories/{id}/approve` | POST | — | `MemoryResponse` | Approve pending |
| `/api/memories/{id}/reject` | POST | `{reason: "..."}` | `MemoryResponse` | Reject pending |
| `/api/memories/bulk` | POST | `{action, ids, ...}` | `{affected: N}` | Bulk approve/reject/delete |
| `/api/memories/search` | POST | `{query, filters}` | `{items: [...]}` | Hybrid search |

**Verify**: Create, read, update, approve, reject, delete all work. List with filters returns correct results.

---

## Task 1.16: Context Endpoint

**What**: Returns a structured context block for injection into the agent's system prompt.

### `apps/api/app/domains/context/schemas.py`

```python
class ContextResponse(BaseModel):
    block: str                  # formatted text to inject
    memories_used: int          # count of memories in block
    project_id: str | None      # which project was used
    project_name: str | None    # display name
```

### `apps/api/app/domains/context/service.py`

**Function: `build_context(project_id, query, max_tokens) -> ContextResponse`**

**Steps**:

1. **Load project info** (if project_id):
   ```python
   project = await db.get_project(project_id)
   ```

2. **Get project decisions** (if project):
   ```sql
   SELECT * FROM memories
   WHERE project_id = :project_id
   AND memory_type IN ('decision', 'architecture', 'constraint')
   AND status = 'active'
   ORDER BY created_at DESC LIMIT 8
   ```

3. **Get user preferences** (always):
   ```sql
   SELECT * FROM memories
   WHERE scope = 'global' AND memory_type = 'preference' AND status = 'active'
   ORDER BY access_count DESC LIMIT 5
   ```

4. **Get query-relevant memories** (if query not empty):
   ```python
   relevant = await hybrid_search(query, project_id, top_k=5)
   # Exclude memories already included in decisions/preferences
   ```

5. **Build the text block** section by section:

   ```
   [VICTORIOUS MEMORY — project context and user knowledge]

   [PROJECT: {display_name}]
   Decisions:
     • {content} ({confidence_label}, {date})
     ...

   [YOUR PREFERENCES]
     • {content}
     ...

   [RELEVANT TO THIS CONVERSATION]
     • ({type}) {content}
     ...

   [This context is auto-injected by Victorious Memory.]
   ```

6. **Token budget**: Estimate tokens as `len(text) / 4`. Build sections in priority order:
   - Project decisions: up to 400 tokens (highest priority)
   - User preferences: up to 200 tokens
   - Relevant memories: up to remaining budget
   - If over budget, trim the lowest-priority section first

7. **Update access stats**: For every memory included in the block:
   ```sql
   UPDATE memories SET last_accessed = NOW(), access_count = access_count + 1
   WHERE id = ANY(:ids)
   ```

### `apps/api/app/domains/context/router.py`

| Endpoint | Method | Params | Output | Description |
|----------|--------|--------|--------|-------------|
| `/api/context` | GET | `project_id`, `query`, `tokens` (default 1500), `session_id` | `ContextResponse` | Get injection block |

**Verify**: Insert 10 memories (mix of decisions and preferences) → `GET /api/context?project_id=test&query=database` → returns formatted block with decisions section and relevant section.

---

## Task 1.17: Background Worker

**What**: Async background task that processes extraction jobs.

### `apps/api/app/worker.py`

**Function: `extraction_worker()`** — runs as `asyncio.create_task()` in FastAPI lifespan.

**Implementation**:

```python
async def extraction_worker():
    """Polls extraction_jobs table and processes pending jobs."""
    gateway = ProviderGateway()  # or import singleton

    while True:
        try:
            job = await claim_next_job()
        except Exception:
            await asyncio.sleep(settings.extraction_poll_interval)
            continue

        if not job:
            await asyncio.sleep(settings.extraction_poll_interval)
            continue

        try:
            # 1. Load exchange
            exchange = await get_exchange(job.exchange_id)

            # 2. Load context for prompt
            project = await get_project(exchange.project_id) if exchange.project_id else None
            existing = await get_recent_memories(project_id=exchange.project_id, limit=20)
            preferences = await get_memories(scope="global", memory_type="preference", limit=10)

            # 3. Extract via LLM
            candidates = await extract_memories(exchange, project, existing, preferences)

            # 4. Validate
            validated = await validate_candidates(candidates, exchange)

            # 5. Store
            created_memories = []
            for candidate in validated:
                memory = await create_memory(candidate, exchange)
                created_memories.append(memory)
                await log_activity("memory_created", memory_id=memory.id, project_id=memory.project_id,
                                   description=f"Extracted: {memory.content[:100]}")

            # 6. Mark done
            await update_job(job.id, status="done", completed_at=utcnow())
            await log_activity("extraction_completed",
                               description=f"Extracted {len(created_memories)} memories from exchange {exchange.id}")

        except Exception as e:
            job_attempts = job.attempts  # already incremented by claim
            if job_attempts >= job.max_attempts:
                await update_job(job.id, status="failed", error=str(e)[:500])
                await log_activity("extraction_failed", description=f"Failed after {job_attempts} attempts: {str(e)[:200]}")
            else:
                delay = 2 ** job_attempts  # 2s, 4s, 8s
                retry_after = utcnow() + timedelta(seconds=delay)
                await update_job(job.id, status="pending", error=str(e)[:500], retry_after=retry_after)
```

**`claim_next_job()` SQL**:
```sql
UPDATE extraction_jobs
SET status = 'processing', started_at = NOW(), attempts = attempts + 1
WHERE id = (
    SELECT id FROM extraction_jobs
    WHERE status = 'pending'
    AND attempts < max_attempts
    AND (retry_after IS NULL OR retry_after <= NOW())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING *
```
The `FOR UPDATE SKIP LOCKED` prevents two workers from claiming the same job.

**Verify**: Insert exchange + job → worker processes within 2-3 seconds → memories appear → job status = "done".

---

## Task 1.18: Activity Log Endpoint

**What**: API to read the activity log (used by the UI activity feed and debugging).

### Router: `GET /api/activity`

Query params:
- `limit` (default 50, max 200)
- `event_type` (filter)
- `project_id` (filter)
- `after_id` (cursor for pagination — return events created after this ID's timestamp)

Returns: `list[ActivityLogResponse]` sorted by `created_at DESC`.

**Verify**: Trigger an extraction → `GET /api/activity` → shows extraction events.

---

## Task 1.19: FastAPI App + Lifespan

**What**: Wire everything together.

### `apps/api/app/main.py`

```python
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.worker import extraction_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    worker = asyncio.create_task(extraction_worker())
    yield
    # Shutdown
    worker.cancel()

app = FastAPI(
    title="Victorious Memory",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and mount all routers
from app.domains.ingest.router import router as ingest_router
from app.domains.context.router import router as context_router
from app.domains.memories.router import router as memories_router
from app.domains.projects.router import router as projects_router
from app.domains.providers.router import router as providers_router

app.include_router(ingest_router, prefix="/api", tags=["ingest"])
app.include_router(context_router, prefix="/api", tags=["context"])
app.include_router(memories_router, prefix="/api", tags=["memories"])
app.include_router(projects_router, prefix="/api", tags=["projects"])
app.include_router(providers_router, prefix="/api", tags=["providers"])

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
```

**Verify**: `uvicorn app.main:app --reload` → starts without errors → `GET /health` returns 200.

---

## Task 1.20: Docker Compose (Phase 1)

### `docker-compose.yml`

```yaml
services:
  api:
    build: ./apps/api
    ports:
      - "8080:8080"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      embed:
        condition: service_started
    restart: unless-stopped

  db:
    image: pgvector/pgvector:pg16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: victorious
      POSTGRES_USER: victorious
      POSTGRES_PASSWORD: ${DB_PASSWORD:-victorious}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U victorious"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  embed:
    image: ghcr.io/huggingface/text-embeddings-inference:cpu-1.5
    command: ["--model-id", "BAAI/bge-small-en-v1.5", "--port", "8090"]
    ports:
      - "8090:8090"
    restart: unless-stopped

volumes:
  pgdata:
```

**Note**: Web UI service added in Phase 3. LLM is external (not part of compose).

**Verify**: `docker compose up -d` → 3 containers healthy → `curl http://localhost:8080/health` returns OK.

---

## Task 1.21: Phase 1 End-to-End Test

**What**: Script that tests the complete Phase 1 pipeline.

### `apps/api/tests/test_e2e_phase1.py`

**Test sequence**:

1. `POST /api/providers/extraction` — configure LLM provider (copilot2api or whatever is available)
2. `POST /api/projects/detect` — `{"path": "/test/my-project"}`
   - Assert: project created with id `"my-project"`
3. `POST /api/ingest` — full test exchange:
   ```json
   {
     "project_id": "my-project",
     "session_id": "test-session-001",
     "exchange": {
       "user": "I've decided we should use PostgreSQL instead of SQLite for the database because we need vector search support.",
       "agent_parts": [
         {"type": "text", "content": "Good choice. PostgreSQL with pgvector gives us native vector search. I'll update the database configuration."},
         {"type": "tool_call", "tool": "write_to_file", "content": "[write completed]"}
       ],
       "file_paths": ["/test/my-project/src/database.py"],
       "timestamp": "2026-05-24T12:00:00Z"
     }
   }
   ```
   - Assert: returns `exchange_id` and `job_id`
4. Wait 10 seconds (for worker to process)
5. `GET /api/memories?project_id=my-project`
   - Assert: at least 1 memory exists
   - Assert: memory type is "decision"
   - Assert: memory scope is "project" or project_id is "my-project"
   - Assert: confidence ≥ 0.7
6. `GET /api/context?project_id=my-project&query=database`
   - Assert: response contains a `block` field
   - Assert: block contains "PostgreSQL" somewhere
7. `GET /api/activity`
   - Assert: contains "memory_created" and "extraction_completed" events

**Pass criteria**: All 7 assertions pass.

---
---

# PHASE 2: OpenCode Plugin + Context Injection

> **Goal**: A working OpenCode plugin that automatically captures conversations and injects memory context.
>
> **End state**: Install plugin → chat in OpenCode → memories extracted in background →
> next message gets relevant context auto-injected into system prompt.

---

## Task 2.1: Plugin Implementation

### `plugins/opencode/victorious.js`

**Full plugin implementation using confirmed OpenCode hooks.**

**Plugin context** (received at initialization):
- `directory` — current working directory (THIS is the project path)
- `worktree` — git worktree path
- `project` — project metadata
- `client` — OpenCode SDK client

**Configuration** (from environment variables):
```
VICTORIOUS_API_URL    — default: http://localhost:8080
VICTORIOUS_TOKEN_THRESHOLD — default: 500
VICTORIOUS_INJECT_TOKENS   — default: 1500
VICTORIOUS_DEBUG           — default: false
```

**State variables**:
```javascript
let currentProject = null
let sessionId = null
let exchangeBuffer = {
    user: "",
    agent_parts: [],
    file_paths: [],
    token_estimate: 0,
}
```

**Hooks to implement**:

### Hook: `event`
Listens for `session.created` and `session.idle`.

On `session.created`:
1. Call `POST /api/projects/detect` with `{ path: directory, worktree, name: project?.name }`
2. Store returned project in `currentProject`
3. Set `sessionId` from event properties or generate `session-{Date.now()}`
4. Log: `[Victorious] Project: {id}, Session: {sessionId}`

On `session.idle`:
1. Flush the exchange buffer (call `flushExchange()`)

### Hook: `experimental.chat.system.transform`
Fires before every LLM call. This is where we inject context.

1. If `output?.system` is not available, return (can't inject)
2. Call `GET /api/context?project_id={currentProject?.id}&tokens={INJECT_TOKENS}&session_id={sessionId}`
3. If response has a `block`, call `output.system.unshift(block)` to prepend to system prompt
4. On error: silently skip (never block the agent)

### Hook: `chat.message`
Fires when user sends a message.

1. If buffer has a previous exchange with both user and agent_parts → flush it
2. Set `exchangeBuffer.user = message content`
3. Add token estimate: `exchangeBuffer.token_estimate += content.length / 4`

### Hook: `tool.execute.before`
Fires before a tool runs.

1. Extract file paths from tool arguments:
   - Check all arg values for strings containing `/` or `\`
   - Add to `exchangeBuffer.file_paths`

### Hook: `tool.execute.after`
Fires after a tool completes.

1. Push to `exchangeBuffer.agent_parts`:
   ```javascript
   {
       type: "tool_call",
       tool: input?.tool || "unknown",
       content: (typeof output?.output === "string" && output.output.length < 3000)
           ? output.output.slice(0, 2000)
           : `[${toolName} completed]`,
       timestamp: new Date().toISOString(),
   }
   ```
2. Update token estimate
3. **Capture agent text**: If the tool output contains agent text (explanations), capture it as a separate `text` type part

### Helper: `flushExchange()`
1. If buffer has no user content or no agent_parts → return (nothing to flush)
2. Call `POST /api/ingest`:
   ```json
   {
     "project_id": currentProject?.id,
     "session_id": sessionId,
     "exchange": {
       "user": exchangeBuffer.user,
       "agent_parts": exchangeBuffer.agent_parts,
       "file_paths": [...new Set(exchangeBuffer.file_paths)],
       "timestamp": new Date().toISOString()
     }
   }
   ```
3. Reset buffer: `{ user: "", agent_parts: [], file_paths: [], token_estimate: 0 }`
4. On error: log warning, don't crash

### Helper: `api(path, method, body)`
HTTP helper that calls the Victorious API:
- Construct full URL: `${API_URL}${path}`
- Set `Content-Type: application/json`
- On error: return null (never throw from plugin)

**Rules**:
- Plugin MUST never crash or throw. All errors caught and logged.
- Plugin MUST never block the agent. All API calls are fire-and-forget or fast.
- Use native `fetch` (available in Bun/Node 18+).

---

## Task 2.2: Plugin Installation

**What**: Configure OpenCode to load the plugin.

**Option A** (plugin directory — auto-discovery):
Copy `plugins/opencode/victorious.js` to `~/.config/opencode/plugins/victorious.js`

**Option B** (explicit in config):
Add to `opencode.json`:
```json
{
  "plugin": ["~/.config/opencode/plugins/victorious.js"]
}
```

Set environment variables in OpenCode's environment:
```
VICTORIOUS_API_URL=http://152.53.184.198:8080
VICTORIOUS_DEBUG=true
```

**Verify**: Restart OpenCode → console shows `[Victorious] Project: {name}` → no errors.

---

## Task 2.3: MCP Server

**What**: MCP tools for when the agent explicitly needs to query or save memories.

### `apps/api/app/mcp_server.py`

Use `fastmcp` or similar MCP library. Define these tools:

| Tool Name | Input | Output | Description |
|-----------|-------|--------|-------------|
| `victorious_search` | `query: str, project_id: str?, top_k: int?` | List of matching memories with scores | Search memories |
| `victorious_ask` | `question: str, project_id: str?` | Answer with evidence citations | Q&A backed by memory evidence |
| `victorious_propose` | `content: str, type: str, scope: str` | Created memory | Manually save a memory |
| `victorious_project_context` | `project_id: str` | Full project context | All decisions, constraints, architecture |
| `victorious_project_timeline` | `project_id: str` | Chronological events | Timeline of project events |

**Each tool calls the API endpoints internally** (same process, direct function calls — not HTTP).

**MCP server runs as**: Either a separate process (`python -m app.mcp_server`) or integrated into the FastAPI app on a different port.

**Verify**: Start MCP server → call `victorious_search("PostgreSQL")` → returns matching memories.

---

## Task 2.4: Phase 2 Integration Test

**Steps**:
1. API running on VPS, plugin installed in OpenCode
2. Open a project directory in OpenCode
3. Verify: console shows `[Victorious] Project: {name}`
4. Send message: "I want to use Redis for caching in this project"
5. Agent responds normally
6. Wait 15 seconds
7. Check: `GET /api/memories?project_id={id}` → memory about Redis caching exists
8. Send message: "What caching solution are we using?"
9. Verify: agent's response references Redis (injected context informed it)
10. Check: `GET /api/activity` → shows extraction events

**Pass criteria**: Memories auto-created, context auto-injected, agent has memory.

---
---

# PHASE 3: Graph + Timeline + Web UI

> **Goal**: Knowledge graph connecting memories, auto-generated project timelines,
> and a web UI for human supervision.
>
> **End state**: Conflicting decisions auto-detected → graph edges created → visible in web UI →
> timeline shows project history → human can approve/reject/edit everything.

---

## Task 3.1: Graph Edge Detection

### `apps/api/app/domains/graph/service.py`

**Function: `detect_edges(new_memory: Memory) -> list[Edge]`**

Called by the extraction worker AFTER storing a new memory.

**Steps**:

1. **Find similar memories**:
   ```python
   similar = await hybrid_search(
       query=new_memory.content,
       project_id=new_memory.project_id,
       scope_filter=[new_memory.project_id, "global"] if new_memory.project_id else ["global"],
       top_k=10,
       status_filter=["active", "pending_review"],
   )
   # Filter: similarity > 0.65 AND not the same memory
   similar = [s for s in similar if s.memory_id != new_memory.id and s.combined_score > 0.65]
   ```

2. **If no similar memories** → return empty list (no edges)

3. **If similar memories exist** → ONE LLM call to detect relationships:

   **Prompt**:
   ```
   Given a new memory and existing similar memories, identify relationships between them.

   New memory: "{content}" (type: {type}, project: {project_id or "global"})

   Existing memories:
   1. [ID: {id}] "{content}" (type: {type}, project: {project_id})
   2. [ID: {id}] "{content}" (type: {type}, project: {project_id})
   ...

   Possible relationship types:
   - supersedes: new replaces old (same topic, updated decision)
   - contradicts: they conflict with each other
   - depends_on: new relies on existing being true
   - caused_by: existing is the reason for the new one
   - enables: new makes existing possible (or vice versa)
   - related_to: general topical relation

   Return JSON array (empty if no relationships):
   [{"target_id": "mem_xxx", "type": "supersedes|contradicts|depends_on|caused_by|enables|related_to", "reason": "one sentence why"}]

   Only output clearly existing relationships. When in doubt, use "related_to" or skip entirely.
   ```

4. **Parse response**, create edge records
5. **Handle supersession**: If type is `supersedes`, update old memory: `status = "superseded"`, `superseded_by = new_memory.id`
6. **Handle contradiction**: If type is `contradicts`, log to activity: "conflict_detected"
7. **Log all edges** to activity: "edge_created"

**Verify**: Create "Using SQLite" → create "Switched to PostgreSQL" → edge `supersedes` auto-created → old memory status is `superseded`.

---

## Task 3.2: Graph Traversal in Context Retrieval

### Update `apps/api/app/domains/context/service.py`

After hybrid search returns direct matches, **add graph expansion**:

1. For top 5 direct matches, get edges:
   ```sql
   SELECT * FROM memory_edges
   WHERE source_id = :id OR target_id = :id
   ```

2. Load neighbor memories (1 hop). Assign weight 0.7.

3. For `caused_by` and `depends_on` edges, follow one more hop (2 total). Weight 0.5.

4. Merge with direct matches, deduplicate, re-rank.

5. In the context block, show causal relationships:
   ```
   [RELEVANT TO THIS CONVERSATION]
     • (decision) Switched to PostgreSQL (caused by: SQLite can't handle vectors)
   ```

**Verify**: Query "database" → returns PostgreSQL decision AND the SQLite limitation (linked by `caused_by` edge).

---

## Task 3.3: Graph API Endpoints

### `apps/api/app/domains/graph/router.py`

| Endpoint | Method | Input | Output | Description |
|----------|--------|-------|--------|-------------|
| `/api/graph/{memory_id}` | GET | — | List of edges | All edges for a memory |
| `/api/graph/{memory_id}/neighborhood` | GET | `depth` (1 or 2) | Memory + connected memories | Subgraph around a memory |
| `/api/graph/edges` | POST | `{source_id, target_id, relation_type, description}` | Edge | Create edge manually |
| `/api/graph/edges/{id}` | DELETE | — | 204 | Delete edge |

**Verify**: Get edges → returns relationships. Create manual edge → appears in graph.

---

## Task 3.4: Timeline Service

### `apps/api/app/domains/timeline/service.py`

**Function: `get_timeline(project_id) -> list[TimelineEntry]`**

1. Query memories for this project, ordered chronologically:
   ```sql
   SELECT * FROM memories
   WHERE project_id = :project_id
   AND memory_type IN ('decision', 'bugfix', 'architecture', 'context', 'lesson')
   AND status IN ('active', 'superseded')
   ORDER BY created_at ASC
   ```
2. Group by date (YYYY-MM-DD)
3. For each memory, create a timeline entry with:
   - Icon: decision→✅, bugfix→🐛, architecture→🏗, context→📌, lesson→💡
   - Title extracted from first ~80 chars of content
   - Full content
   - Memory ID for linking
   - Session ID for traceability

**Also**: Auto-create `timeline_entries` when project-scoped memories are created.
Add to extraction worker after `create_memory`:
```python
if memory.project_id and memory.memory_type in ("decision", "bugfix", "architecture", "lesson"):
    await create_timeline_entry(
        project_id=memory.project_id,
        entry_type=memory.memory_type,
        title=memory.content[:80],
        memory_ids=[memory.id],
    )
```

### `apps/api/app/domains/timeline/router.py`

| Endpoint | Method | Input | Output | Description |
|----------|--------|-------|--------|-------------|
| `/api/projects/{id}/timeline` | GET | — | List of timeline entries | Chronological project events |

**Verify**: Create 5 memories for project "test" across different dates → timeline returns them in order with icons.

---

## Task 3.5: Settings API

### New endpoints for managing app settings:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings` | GET | Get all settings |
| `/api/settings` | PUT | Update settings (partial) |

Settings are stored in `app_settings` table (key-value).

**Managed settings**:
- `extraction_token_threshold` (int, default 500)
- `extraction_max_retries` (int, default 3)
- `auto_approve_enabled` (bool, default true)
- `auto_approve_threshold` (float, default 0.85)
- `auto_approve_types` (list[str], default all 10 types)
- `auto_approve_scopes` (list[str], default all scopes)
- `auto_approve_never_conflicts` (bool, default true)
- `lifecycle_decay_enabled` (bool, default true)
- `lifecycle_decay_days` (int, default 60)

When settings change in DB, they override the env-var defaults at runtime.

**Verify**: `PUT /api/settings {"auto_approve_threshold": 0.9}` → subsequent extractions use 0.9 threshold.

---

## Task 3.6: Web UI — Initialize Vite + React

**Commands**:
```bash
cd "D:\Victorious Memory 2V\apps\web"
npx -y create-vite@latest ./ --template react-ts
npm install
npm install react-router-dom @tanstack/react-query axios lucide-react
```

**Dependencies**:
- `react-router-dom` — routing
- `@tanstack/react-query` — data fetching, caching, auto-refetch
- `axios` — HTTP client
- `lucide-react` — icon library

---

## Task 3.7: Web UI — Design System

### `apps/web/src/styles/index.css`

**Design requirements**:
- Dark theme primary (rich dark backgrounds: `#0a0a0f`, `#12121a`)
- Accent gradient: vibrant purple-to-blue (`#7c3aed` → `#3b82f6`)
- Font: Inter from Google Fonts
- Glassmorphism: cards with `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(12px)`, subtle borders `rgba(255,255,255,0.06)`
- Micro-animations: hover lifts, smooth transitions (200ms ease)
- Status colors: active=green, pending=amber, rejected=red, superseded=gray
- Memory type colors: decision=blue, preference=purple, constraint=red, bugfix=orange, lesson=emerald, pattern=cyan, architecture=indigo, context=slate, research=yellow, reference=gray
- Responsive: sidebar collapses on mobile

---

## Task 3.8: Web UI — Layout + Sidebar + Routing

### `apps/web/src/App.tsx`
React Router setup with all routes:
- `/` → Dashboard
- `/review` → ReviewQueue
- `/projects/:id` → ProjectView
- `/graph` → GraphExplorer
- `/activity` → ActivityFeed
- `/settings` → Settings

### `apps/web/src/components/Layout.tsx`
Fixed sidebar (240px) + main content area. Sidebar has:
- Logo/title
- Nav links with icons and active state highlighting
- Projects section (expandable, auto-loaded from API)
- Pending review badge count

### `apps/web/src/api/client.ts`
Axios instance configured with `baseURL` from env (`VITE_API_URL` or default `/api`).
Query client from `@tanstack/react-query`.

---

## Task 3.9: Web UI — Dashboard Page

### `apps/web/src/pages/Dashboard.tsx`

**Layout**:
1. **Stats row** (4 cards): Total memories, Pending review, Projects, Created today
2. **Filter bar**: Type dropdown, Project dropdown, Scope dropdown, Status dropdown, Confidence slider, Search input
3. **Memory table**: Sortable columns (Content preview, Type badge, Scope, Project, Confidence bar, Status badge, Created date, Access count)
4. **Row click** → opens detail panel on the right (or modal) with:
   - Full content (editable textarea)
   - Type selector, Scope selector, Confidence slider
   - Tags (editable, chip input)
   - Source: session ID, exchange link
   - Graph edges (list of connected memories)
   - Action buttons: Save, Approve, Reject, Delete
5. **Bulk select** → toolbar appears with: Approve all, Reject all, Delete, Change type

**Data fetching**: `useQuery` from `@tanstack/react-query`, refetches on filter change.

---

## Task 3.10: Web UI — Review Queue Page

### `apps/web/src/pages/ReviewQueue.tsx`

**Layout**: Card-based, each card showing one pending memory:

1. **Memory content** (highlighted text)
2. **Classification**: Type badge, Scope badge, Confidence score + bar + reasoning text
3. **Source**: Link to the exchange that produced it (shows user message + agent response)
4. **Tags**
5. **Action buttons**: ✅ Approve, ❌ Reject (opens reason input), ✏️ Edit & Approve, ⏭ Skip
6. **Counter** at top: "X memories pending review"

**Data**: `GET /api/memories?status=pending_review&sort_by=created_at&sort_order=desc`

---

## Task 3.11: Web UI — Project View Page

### `apps/web/src/pages/ProjectView.tsx`

**Layout**:
1. **Header**: Project name, path, tech stack badges, last active timestamp, Edit button
2. **Timeline** (main content): Vertical timeline with:
   - Date markers
   - Type icons (✅🐛🏗📌💡)
   - Memory content (clickable → expands to show full detail)
   - Superseded items shown with strikethrough
3. **Side panels**:
   - Key Decisions (latest 10, type=decision)
   - Active Issues (type=bugfix, status not resolved)
   - Constraints (type=constraint)
   - Quick stats (total memories, decisions, bugs, lessons)

**Data**: `GET /api/projects/{id}`, `GET /api/projects/{id}/timeline`, `GET /api/memories?project_id={id}`

---

## Task 3.12: Web UI — Activity Feed Page

### `apps/web/src/pages/ActivityFeed.tsx`

**Layout**: Reverse-chronological event list, auto-refreshing every 5 seconds.

Each event shows:
- Icon (by event type)
- Timestamp (relative: "2 minutes ago")
- Description text
- Link to related memory or project (if applicable)

**Event type icons**:
- memory_created → ➕ green
- memory_approved → ✅ blue
- memory_rejected → ❌ red
- extraction_started → ⚙️ gray
- extraction_completed → ✨ purple
- extraction_failed → ⚠️ amber
- conflict_detected → 🔴 red
- edge_created → 🔗 cyan

**Data**: `GET /api/activity?limit=100`, poll every 5s with `refetchInterval: 5000`.

---

## Task 3.13: Web UI — Settings Page

### `apps/web/src/pages/Settings.tsx`

**Sections**:

1. **LLM Providers**
   - Table: Role, Provider type, Model, Base URL, Status (connected/disconnected)
   - Add/Edit modal with form fields
   - Test Connection button per provider
   - Data: `GET /api/providers`, `PUT /api/providers/{role}`, `POST /api/providers/{role}/test`

2. **Extraction**
   - Token threshold: number input with slider (200-2000)
   - Max retries: number input (1-10)
   - Data: `GET /api/settings`, `PUT /api/settings`

3. **Auto-Approve**
   - Enabled toggle
   - Confidence threshold: slider (0.5-1.0) with current value display
   - Allowed types: checkbox grid (all 10 types)
   - Allowed scopes: checkbox grid (project, global, cross-project)
   - Never auto-approve conflicts: toggle
   - Data: `GET /api/settings`, `PUT /api/settings`

4. **Export**
   - Export all memories as JSON: button → downloads file
   - Export as Markdown (Obsidian format): button → downloads zip
   - Data: `GET /api/export/json`, `GET /api/export/markdown`

---

## Task 3.14: Web UI — Docker + Nginx

### `apps/web/Dockerfile`
Multi-stage build: Node build stage → Nginx serve stage.

### `apps/web/nginx.conf`
- Route `/api/*` → proxy to `http://api:8080`
- Everything else → serve SPA (`/index.html`)
- Listen on port 3000

### Update `docker-compose.yml`
Add `web` service:
```yaml
  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped
```

**Verify**: `docker compose up -d` → open `http://localhost:3000` → see dashboard.

---

## Task 3.15: Phase 3 Integration Test

1. Start full stack (api + db + embed + web)
2. Have memories from Phase 1/2 testing
3. Open Dashboard → all memories visible with correct stats
4. Use filters → results update correctly
5. Go to Review Queue → approve one memory → it disappears from queue, appears as active
6. Reject another → it gets rejected status
7. Go to Project View → timeline shows chronological events
8. Create two contradicting memories → check Activity Feed → "conflict_detected" event appears
9. Check graph: `GET /api/graph/{id}` → `contradicts` edge exists
10. Settings → change auto-approve threshold → new extraction uses new threshold

---
---

# PHASE 4: Lifecycle + Polish

> **Goal**: Memory decay, consolidation, cross-project patterns, graph explorer UI, markdown export, monitoring.
>
> **End state**: System maintains itself — old memories decay, similar ones consolidate,
> cross-project patterns emerge, graph is explorable, everything exportable.

---

## Task 4.1: Decay Service

### `apps/api/app/domains/lifecycle/service.py`

**Function: `run_decay() -> dict`**

```python
async def run_decay() -> dict:
    """Reduce confidence of memories not accessed in decay_days."""
    decay_days = await get_setting("lifecycle_decay_days", default=60)
    
    result = await db.execute("""
        UPDATE memories
        SET confidence_score = GREATEST(confidence_score * 0.95, 0.3),
            confidence_label = CASE
                WHEN confidence_score * 0.95 >= 0.85 THEN 'high'
                WHEN confidence_score * 0.95 >= 0.6 THEN 'medium'
                ELSE 'low' END,
            updated_at = NOW()
        WHERE last_accessed < NOW() - make_interval(days => :decay_days)
        AND status = 'active'
        AND confidence_score > 0.3
    """, {"decay_days": decay_days})
    
    count = result.rowcount
    if count > 0:
        await log_activity("decay_completed", description=f"Decayed {count} inactive memories")
    return {"decayed": count}
```

**Rules**:
- Floor at 0.3 — never fully erase by decay
- Only active memories (not pending, rejected, superseded)
- 5% reduction per run
- Configurable decay period via settings

**Verify**: Insert memory with `last_accessed` 90 days ago → run decay → confidence decreased by 5%.

---

## Task 4.2: Consolidation Service

**Function: `run_consolidation() -> dict`**

**Steps**:
1. Get all active memories, embed them
2. Find clusters of 3+ memories with pairwise cosine similarity > 0.85:
   ```python
   # Simple clustering: for each memory, find similar ones, group connected components
   clusters = []
   visited = set()
   for mem in all_memories:
       if mem.id in visited:
           continue
       similar = await search(mem.content, threshold=0.85)
       cluster = [s for s in similar if s.id not in visited]
       if len(cluster) >= 3:
           clusters.append(cluster)
           visited.update(c.id for c in cluster)
   ```
3. For each cluster, LLM synthesize:
   ```
   Prompt: "These {N} memories are about the same topic. Combine them into ONE 
   clear, comprehensive memory that preserves all important details.
   
   Memories:
   1. {content}
   2. {content}
   ...
   
   Return ONE synthesized memory text."
   ```
4. Create consolidated memory: `type="pattern"`, `confidence_score=0.9`, `dynamic_tag="[PATTERN]"`
5. Create `consolidates` edges from new → each original
6. Mark originals as `status="deprecated"`
7. Log activity

**Verify**: Create 4 memories about "always run tests" → consolidation → one pattern memory, 4 deprecated.

---

## Task 4.3: Cross-Project Pattern Detection

**Function: `detect_cross_project_patterns() -> dict`**

**Steps**:
1. Get all active project-scoped memories
2. Group by content similarity across DIFFERENT projects (similarity > 0.80)
3. If same pattern appears in 2+ projects:
   ```python
   pattern = f"Cross-project pattern: {synthesized_description} (seen in: {project_names})"
   ```
4. Create memory: `scope="cross-project"`, `tags=[project_ids]`
5. Create `related_to` edges to original memories

**Verify**: "Using PostgreSQL" in project A and project B → pattern "Prefers PostgreSQL for databases" created with scope cross-project.

---

## Task 4.4: Lifecycle Scheduler

### `apps/api/app/domains/lifecycle/scheduler.py`

**Function: `lifecycle_scheduler()`** — asyncio background task.

```python
async def lifecycle_scheduler():
    """Runs periodic lifecycle jobs. Launched in FastAPI lifespan."""
    while True:
        now = datetime.now(timezone.utc)
        
        if await should_run("decay", now):
            try:
                result = await run_decay()
                await mark_ran("decay", now)
            except Exception as e:
                await log_activity("lifecycle_error", description=f"Decay failed: {e}")
        
        if await should_run("consolidation", now):
            try:
                result = await run_consolidation()
                await detect_cross_project_patterns()
                await mark_ran("consolidation", now)
            except Exception as e:
                await log_activity("lifecycle_error", description=f"Consolidation failed: {e}")
        
        await asyncio.sleep(60)  # check every minute
```

**Schedule tracking**: Use `app_settings` table with keys like `lifecycle_last_decay`, `lifecycle_last_consolidation` storing ISO timestamps. `should_run` checks if enough time has passed.

**Default schedules**: Decay = daily. Consolidation = weekly.

**Add to FastAPI lifespan** alongside extraction worker:
```python
lifecycle = asyncio.create_task(lifecycle_scheduler())
```

---

## Task 4.5: Graph Explorer UI

### `apps/web/src/pages/GraphExplorer.tsx`

**Dependencies**: Install `react-force-graph-2d` (lightweight force-directed graph lib).

**Features**:
- Force-directed graph visualization
- Nodes = memories, colored by type, sized by confidence
- Edges = relationships, colored by relation_type, labeled
- Click node → sidebar shows memory details
- Hover → highlight connected edges
- Filters: project dropdown, type dropdown, date range
- Controls: zoom, pan, reset, center on node

**Data**: `GET /api/graph/full?project_id=...` — returns all memories + edges for visualization.

**New API endpoint**: `GET /api/graph/full`
- Returns `{nodes: [{id, content, type, confidence, project_id}], edges: [{source, target, type}]}`
- Optional filter by project_id
- Limit to 200 nodes (most recent or highest access_count)

---

## Task 4.6: Export Endpoints

### `GET /api/export/json`
Returns all active memories as a JSON file download.

### `GET /api/export/markdown`
Returns a zip file containing markdown files organized by project:
```
memories/
├── project-name/
│   ├── decision-001.md
│   └── bugfix-001.md
├── global/
│   ├── preference-001.md
│   └── pattern-001.md
└── cross-project/
    └── pattern-001.md
```

Each file has YAML frontmatter:
```markdown
---
id: mem_a1b2c3d4
type: decision
scope: project
project: victorious-memory
confidence: 0.92
tags: [database, postgresql]
created: 2026-05-24T12:00:00Z
---

Switched from SQLite to PostgreSQL for vector search support.
```

---

## Task 4.7: Enhanced Health Endpoint

### Update `GET /health`

```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "connected",
  "embedding_service": "connected",
  "llm_provider": "configured",
  "stats": {
    "memories_total": 142,
    "memories_active": 120,
    "memories_pending": 8,
    "memories_rejected": 14,
    "projects": 5,
    "edges": 67,
    "extraction_queue": 2,
    "extraction_failed": 1
  }
}
```

Check DB, embedding, and provider connectivity. Return appropriate status on failure.

---

## Task 4.8: Structured Logging

### Update all modules to use structured JSON logging:

```python
import logging, json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        data = {
            "ts": self.formatTime(record),
            "level": record.levelname,
            "msg": record.getMessage(),
            "module": record.module,
        }
        if hasattr(record, "extra"):
            data.update(record.extra)
        return json.dumps(data)

# Configure at app startup
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.root.addHandler(handler)
logging.root.setLevel(logging.INFO)
```

All modules use `logger.info("message", extra={...})` for structured context.

---

## Task 4.9: Phase 4 Integration Test

1. Have 50+ memories across 3 projects
2. Set some memories' `last_accessed` to 90 days ago
3. Trigger decay → verify those memories' confidence decreased
4. Create 4 similar memories → trigger consolidation → pattern created, originals deprecated
5. Create "Using PostgreSQL" in 3 different projects → trigger cross-project detection → pattern exists
6. Open Graph Explorer → graph renders with nodes and edges
7. Export JSON → valid JSON with all memories
8. Export Markdown → valid zip with correct folder structure
9. Health endpoint → all stats accurate
10. Logs → structured JSON format

---
---

# Full Verification Checklist

## Phase 1 ✓
- [ ] Docker Compose starts all 3 services (api, db, embed)
- [ ] `POST /api/ingest` stores exchange and creates job
- [ ] Background worker extracts memories via LLM within 5 seconds
- [ ] Memories have correct type, scope, confidence, status
- [ ] `GET /api/context` returns formatted injection block
- [ ] Hybrid search (semantic + BM25) returns relevant results
- [ ] Provider gateway works with configured LLM endpoint
- [ ] Activity log records all events
- [ ] CRUD endpoints work for memories and projects

## Phase 2 ✓
- [ ] OpenCode plugin loads without errors
- [ ] Plugin detects project from `directory` context
- [ ] Plugin captures user messages and agent output parts
- [ ] Plugin injects context before every LLM call
- [ ] Token threshold buffering works (doesn't send every message)
- [ ] MCP server provides search, ask, propose tools
- [ ] Memories accumulate correctly across multiple conversations

## Phase 3 ✓
- [ ] Graph edges auto-detected (supersedes, contradicts, related_to)
- [ ] Graph traversal improves context retrieval (adds causal context)
- [ ] Web UI serves on port 3000
- [ ] Dashboard shows all memories with working filters and search
- [ ] Review Queue allows approve/reject/edit with confidence reasoning
- [ ] Project View shows chronological timeline with type icons
- [ ] Activity Feed auto-refreshes and shows all events
- [ ] Settings page configures providers, thresholds, auto-approve rules
- [ ] Graph and Timeline API endpoints return correct data

## Phase 4 ✓
- [ ] Decay reduces unused memories' confidence (5% per run, floor 0.3)
- [ ] Consolidation merges 3+ similar memories into patterns
- [ ] Cross-project patterns detected across 2+ projects
- [ ] Graph Explorer renders force-directed graph visualization
- [ ] JSON export downloads valid file with all memories
- [ ] Markdown export creates correct Obsidian-compatible structure
- [ ] Health endpoint reports accurate system stats
- [ ] Structured JSON logging operational
- [ ] Lifecycle scheduler runs decay daily, consolidation weekly
