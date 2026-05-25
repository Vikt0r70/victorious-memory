# Codebase Concerns

**Analysis Date:** 2026-05-25

## Security Considerations

### Hardcoded API Key in Test File

- Risk: A live API key is hardcoded in the e2e test file and committed to git history.
- Files: `apps/api/tests/test_e2e_phase1.py` (line 46)
- Current mitigation: None — the key is in plain text.
- Recommendations:
  1. Revoke the exposed key immediately.
  2. Replace with an environment variable reference (`os.environ["TEST_API_KEY"]`).
  3. Run `git filter-branch` or BFG Repo-Cleaner to remove from history if already pushed.

### Plain-Text API Keys in Database

- Risk: LLM provider API keys are stored as plain text in the `provider_configs` table.
- Files: `apps/api/app/models.py` (line 334: `api_key: Mapped[str] = mapped_column(Text, default="")`)
- Current mitigation: The `ProviderConfigResponse` schema (`apps/api/app/domains/providers/schemas.py`, line 22) excludes `api_key` from API responses. However, anyone with database access can read all keys.
- Recommendations: Use application-level encryption for the `api_key` column (e.g., Fernet symmetric encryption via `cryptography` library) or integrate with a secrets manager.

### No Authentication or Rate Limiting on API

- Risk: The API is completely open — no auth, no rate limiting, no request validation guards.
- Files: `apps/api/app/main.py` (lines 46-51 — CORS `allow_origins=["*"]`)
- Current mitigation: None.
- Recommendations: Add API key authentication middleware or at minimum a shared secret header. Add `slowapi` rate limiting. Restrict CORS origins in production.

### `.env` and `.env.local` Files Present

- Risk: `.env` at project root and `apps/web/.env.local` exist in the working directory (though `.env` is gitignored).
- Current mitigation: `.env` is in `.gitignore`. `.env.local` is not explicitly gitignored — verify it's not tracked.
- Recommendations: Add `*.env.local` to `.gitignore`. Rotate any keys in `.env.example` defaults that may have been duplicated into `.env`.

---

## Tech Debt

### No Database Migrations (Alembic Not Configured)

- Issue: Despite `alembic>=1.13.0` being a declared dependency in `pyproject.toml`, no `alembic/` directory, `alembic.ini`, or migration files exist anywhere in the repo.
- Files: `apps/api/pyproject.toml` (line 12), `apps/api/app/database.py` (line 29: `Base.metadata.create_all()`)
- Impact: Schema changes in production will fail. The system uses `create_all()` which only creates missing tables — it cannot handle column additions, renames, or indexes on an existing database. Any future schema change requires manual SQL.
- Fix approach: Initialize Alembic with `alembic init`, point it at the async engine, generate an initial migration capturing the current schema, and use `alembic upgrade head` in the startup sequence instead of `create_all()`.

### Missing IVFFLAT Index on Embedding Column

- Issue: The IMPLEMENTATION.md specifies an ivfflat index on `embedding` with `vector_cosine_ops`, but `models.py` does NOT create it. Only B-tree indexes on `project_id`, `scope`, `memory_type`, and `status` are defined.
- Files: `apps/api/app/models.py` (lines 158-163 — only non-vector indexes defined)
- Impact: Semantic similarity search performance degrades linearly with memory count. At 10K+ memories, searches become noticeably slow. PostgreSQL defaults to brute-force exact nearest neighbor without an index.
- Fix approach: Add to `Memory.__table_args__`: `Index("idx_memories_embedding", "embedding", postgresql_using="ivfflat", postgresql_ops={"embedding": "vector_cosine_ops"})`. Note: ivfflat requires at least ~1000 rows before it becomes effective; create only after initial data load via Alembic migration.

### Frontend Tech Stack Mismatch (Documentation vs Implementation)

- Issue: `IMPLEMENTATION.md` specifies "React 19 + TypeScript + Vite", but the actual frontend at `apps/web/` uses Next.js 16 (Turbopack), Tailwind CSS 4, and the Next.js App Router.
- Files: `IMPLEMENTATION.md` (line 16), `apps/web/package.json` (line 12: `"next": "16.2.6"`)
- Impact: New developers following the implementation doc will set up the wrong stack. The Vite-based `Dockerfile` described in IMPLEMENTATION.md (line 88-113) is incompatible with the Next.js build.
- Fix approach: Update `IMPLEMENTATION.md` to reflect Next.js 16. Add `apps/web/Dockerfile`. Remove or update references to Vite.

### Sentence-Transformer Blocks Async Event Loop

- Issue: `embed_text()` in `embeddings.py` calls `model.encode()` synchronously inside an async function. Since sentence-transformers uses CPU-bound operations, this blocks the asyncio event loop for the duration of encoding.
- Files: `apps/api/app/domains/search/embeddings.py` (lines 35-46, 49-59)
- Impact: During embedding, the API server cannot process any other requests. Multiple concurrent embedding requests serialize instead of being offloaded to threads.
- Fix approach: Wrap `model.encode()` calls in `await asyncio.to_thread()` or `loop.run_in_executor()`.

### Global `settings` Singleton Prevents Test Isolation

- Issue: `app.config.settings` is a module-level singleton that reads from `.env` on import. Tests cannot easily override configuration values.
- Files: `apps/api/app/config.py` (line 36: `settings = Settings()`)
- Impact: Makes it difficult to write tests with different configurations (e.g., pointing to a test database).
- Fix approach: Use FastAPI's dependency injection pattern — create a `get_settings()` dependency or pass settings explicitly. Consider `pytest` fixtures with environment variable overrides.

---

## Known Bugs

### Embedding Model Silent Failure Returns Zero Vectors

- Symptoms: If `sentence-transformers` fails to load (model download failure, network issue, OOM), all embeddings silently become zero vectors `[0.0] * 384`. Semantic search degrades to random ordering with no error surfaced to the user.
- Files: `apps/api/app/domains/search/embeddings.py` (lines 37-39, 45-46)
- Trigger: Missing model files at startup, network failure during first model download, disk space exhaustion.
- Workaround: Manually check logs for "Failed to load embedding model" message. Pre-download the model during Docker build by adding `RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"` to the Dockerfile.

### `update_memory` Allows Setting Arbitrary Attributes

- Symptoms: The `update_memory` function iterates `kwargs.items()` and calls `setattr(memory, key, value)` without whitelisting settable fields. An attacker (or buggy caller) could overwrite relational attributes, primary keys, or internal SQLAlchemy state.
- Files: `apps/api/app/domains/memories/service.py` (lines 101-125, especially line 109-110)
- Trigger: Calling `PUT /api/memories/{id}` with unexpected keys in the request body, or any internal code passing unexpected kwargs.
- Workaround: None — this is a design flaw. Fix approach: Define a `ALLOWED_UPDATE_FIELDS` set and only apply keys present in that set.

### Graph Router Does In-Memory Post-Filtering by Project ID

- Symptoms: `GET /graph?project_id=X` loads ALL memories matching the status/scope filters, then filters in Python by `project_id`. With many projects and memories, this loads excessive data before filtering.
- Files: `apps/api/app/domains/graph_router.py` (lines 84-91)
- Trigger: Calling the graph endpoint with a `project_id` parameter when there are many non-matching memories.
- Workaround: Use a JOIN or subquery in SQL instead: `Memory.project_id == project_id`.

---

## Performance Bottlenecks

### BM25 Recomputes on Every Hybrid Search

- Problem: BM25 ranking recalculates IDF and term frequencies from scratch for each query. No pre-built inverted index or caching.
- Files: `apps/api/app/domains/search/bm25.py` (entire file, especially lines 74-82)
- Cause: BM25 is implemented as a pure function with no persistent index. All candidate documents are tokenized on every call.
- Improvement path: Build a lightweight inverted index (term → `{doc_id: term_count}`) at memory load time or maintain one that updates incrementally. Cache IDF values. Alternatively, delegate keyword search to PostgreSQL's built-in full-text search (`tsvector` / `tsquery`) which has indexing support.

### Export Endpoint Loads Entire Dataset into Memory

- Problem: `GET /api/system/export` loads ALL memories, projects, and edges into a single API response without pagination.
- Files: `apps/api/app/domains/system_router.py` (lines 121-168)
- Cause: No `LIMIT` or pagination on the export queries.
- Improvement path: Add pagination with `page`/`per_page` parameters. For full exports, consider streaming the response or writing to a file for download.

### Embedding Model ~500MB Memory Footprint Per Process

- Problem: The `bge-small-en-v1.5` model is loaded into each API process's memory (~500MB). In a multi-worker setup (e.g., `uvicorn --workers 4`), this multiplies memory usage.
- Files: `apps/api/app/domains/search/embeddings.py` (lines 19-32)
- Current capacity: Single worker deployment.
- Limit: Adding multiple uvicorn workers multiplies memory by worker count.
- Scaling path: Use HuggingFace TEI (Text Embeddings Inference) as a separate service (already described in IMPLEMENTATION.md but not implemented — the actual code loads sentence-transformers in-process). The `EMBEDDING_URL` env var exists in `config.py` but is unused in `embeddings.py`.

---

## Fragile Areas

### Worker Error Handling Silently Swallows Failures

- Files: `apps/api/app/worker.py` (lines 114-143, lines 159-161)
- Why fragile: `_process_job()` at line 114 catches `Exception` and logs, then opens a new DB session to update the job status. If the second session also fails, the error is silently lost. The outer loop at line 159 also catches `Exception` with no backoff or alerting. A persistent bug (e.g., corrupt exchange data) causes infinite retry loops with no visibility.
- Safe modification: Add exponential backoff for the outer loop after repeated failures. Add a dead-letter queue mechanism for jobs that fail after max retries. Consider a dedicated monitoring endpoint or health check that reports consecutive failures.
- Test coverage: None — zero unit tests for the worker.

### `get_db` Generator Pattern Is Fragile

- Files: `apps/api/app/database.py` (lines 15-23)
- Why fragile: The `get_db()` async generator commits on success and rolls back on exception, but the `except Exception: rollback(); raise` pattern has edge cases. If `session.commit()` itself fails inside the generator after `yield`, the exception occurs after the caller has already consumed the resource.
- Safe modification: Replace with a context-manager-based approach using `async with async_session() as session:` directly in routers, rather than relying on FastAPI's generator-based `Depends`. Or restructure to use a simpler `yield session` without auto-commit/rollback.
- Test coverage: None.

### `_claim_next_job` Uses Raw SQL With Race Condition Surface

- Files: `apps/api/app/worker.py` (lines 28-49)
- Why fragile: The `FOR UPDATE SKIP LOCKED` pattern is correct for PostgreSQL, but the raw SQL bypasses SQLAlchemy's ORM session tracking. If multiple workers are ever deployed (e.g., via multiple uvicorn workers), the job claiming could conflict. Currently safe with a single worker, but fragile to architectural changes.
- Safe modification: Document the single-worker assumption explicitly. Add a distributed lock (e.g., PostgreSQL advisory lock) if multiple workers become a requirement.

---

## Scaling Limits

### Single-Worker Extraction Queue

- Current capacity: One async extraction worker processes jobs sequentially.
- Files: `apps/api/app/worker.py` (lines 145-161 — single `extraction_worker()` task)
- Limit: Conversation ingest rate is bounded by LLM extraction latency (~1-5 seconds per job). At high throughput (many sessions ingesting simultaneously), a backlog of pending jobs builds up. No parallelism.
- Scaling path: Spawn N concurrent worker tasks (configurable via env var), each claiming independent jobs. Add job priority levels so context requests can skip ahead of archival processing.

### No Database Connection Pool Tuning

- Current capacity: Default SQLAlchemy pool size (5 connections) and overflow (10 connections).
- Files: `apps/api/app/database.py` (line 7 — `create_async_engine` with no pool arguments)
- Limit: Under concurrent load, connection pool exhaustion causes request failures.
- Scaling path: Add `pool_size`, `max_overflow`, and `pool_recycle` to `create_async_engine()` based on expected concurrency. Use PgBouncer for connection pooling in production.

---

## Dependencies at Risk

### Next.js 16 Edge Version

- Risk: `apps/web/package.json` uses Next.js 16.x which is likely a canary/bleeding-edge release. APIs may change, documentation may be sparse, and community support may be limited.
- Files: `apps/web/package.json` (line 12: `"next": "16.2.6"`)
- Impact: Breaking changes between minor versions, difficulty finding help, potential deployment issues.
- Migration plan: Pin to the latest stable Next.js release (15.x) or add `next@latest` with a version lock. Document the exact Next.js version requirements in `IMPLEMENTATION.md`.

### sentence-transformers In-Process Loading

- Risk: `sentence-transformers>=3.0.0` is loaded in-process and requires PyTorch, which has frequent breaking changes and is heavy (~2GB for the base package).
- Files: `apps/api/pyproject.toml` (line 17), `apps/api/app/domains/search/embeddings.py`
- Impact: Container image bloat, slow cold starts, model version drift between deployments.
- Migration plan: Migrate to HuggingFace TEI as a separate Docker service (already in `config.py` as `EMBEDDING_URL` but not wired up in `embeddings.py`). This isolates the heavy dependency, enables model version pinning, and allows horizontal scaling of embeddings.

---

## Missing Critical Features

### No Observability (Metrics, Tracing, Health Dashboard)

- Problem: The system has no metrics export, no tracing, and no structured monitoring beyond console logging.
- Blocks: Production deployment — operators have no visibility into extraction throughput, search latency, error rates, or memory usage.
- Files: `apps/api/app/main.py` (only a `/health` endpoint returning `{"status": "ok"}`)

### No Automated Backups

- Problem: No backup mechanism for the PostgreSQL database. The only data export is `GET /api/system/export` which requires manual invocation.
- Blocks: Data loss recovery. The pgdata Docker volume (`docker-compose.yml` line 38) is the sole persistence mechanism.
- Recommendation: Add a `pg_dump` cron job in a sidecar container or document a backup script.

### No Webhook/Event Stream for Real-Time Updates

- Problem: The frontend must poll endpoints to see new memories. There's no WebSocket or SSE stream for real-time updates.
- Blocks: Low-latency UI updates. Users must manually refresh or wait for polling intervals.
- Recommendation: Add a WebSocket endpoint on the API that pushes `activity_log` events as they occur. The Next.js frontend can use Server-Sent Events or a WebSocket client.

---

## Test Coverage Gaps

### Zero Unit Tests

- What's not tested: All domain logic — extraction agent, validator, memory CRUD, context builder, hybrid search, BM25 ranking, project detection, provider gateway, worker job lifecycle.
- Files: Every file under `apps/api/app/` has no corresponding unit test. Only one integration test exists: `apps/api/tests/test_e2e_phase1.py`.
- Risk: Any refactoring or dependency upgrade can silently break core functionality. The extraction pipeline (LLM call → parse → validate → store) has no automated safety net.
- Priority: High.

### No Worker Tests

- What's not tested: Job claiming (`_claim_next_job`), job processing (`_process_job`), retry logic with exponential backoff, failed job handling, error logging.
- Files: `apps/api/app/worker.py`
- Risk: The worker is the most critical component for data ingestion. Bugs here silently lose conversation data. Database contention bugs in job claiming or retry logic go undetected.
- Priority: High.

### No Frontend Tests

- What's not tested: All React components, API client functions, and page rendering logic in `apps/web/`.
- Files: `apps/web/app/`, `apps/web/components/`, `apps/web/lib/api.ts`
- Risk: UI regressions, broken API calls after backend changes, layout issues in Next.js 16.
- Priority: Medium (frontend is secondary to backend correctness).

### No Plugin Tests

- What's not tested: The OpenCode plugin's hook lifecycle (`victorious.js`), token accumulation logic, project detection, exchange flushing, and error handling.
- Files: `apps/plugin/victorious.js`
- Risk: Plugin failures are invisible to the user (no UI feedback) and silently lose conversation data.
- Priority: Medium.

### No MCP Server Tests

- What's not tested: JSON-RPC message handling, tool dispatch, API error propagation, stdin/stdout protocol conformance.
- Files: `apps/mcp/server.py`
- Risk: MCP protocol violations cause OpenCode to fail connecting to the memory server.
- Priority: Low (MCP server is a thin wrapper over API calls).

---

*Concerns audit: 2026-05-25*
