# Domain Pitfalls: VM2 v1.1 Stack Additions

**Domain:** AI memory system — graph viz, dynamic types, advanced RAG, LiteLLM
**Researched:** 2026-05-25

## Critical Pitfalls

### Pitfall 1: Embedding Model Blocks Event Loop
**What goes wrong:** FastAPI becomes unresponsive during embedding generation; worker jobs pile up.
**Why it happens:** `sentence-transformers` runs synchronously in the asyncio thread.
**Consequences:** API timeouts, failed extractions, poor user experience.
**Prevention:** Move to TEI or any out-of-process inference before v1.1 ships.
**Detection:** High response times on `/api/search` or `/api/ingest`; CPU pinned on single core.

### Pitfall 2: HNSW Index with Default `ef_search=40`
**What goes wrong:** Filtered queries (e.g., `WHERE project_id = 'x'`) return fewer results than expected.
**Why it happens:** HNSW scans `ef_search` candidates then applies filter; if filter is selective, few survive.
**Consequences:** Missing relevant memories in search results.
**Prevention:** Set `hnsw.ef_search = 100`+ for production; enable `hnsw.iterative_scan = strict_order` (pgvector 0.8.0+).
**Detection:** Search result counts drop after adding HNSW index.

### Pitfall 3: LiteLLM Model Name Format
**What goes wrong:** `litellm.acompletion(model="gpt-4o", ...)` fails with "model not found".
**Why it happens:** LiteLLM requires `provider/model` format.
**Consequences:** All provider calls fail until fixed.
**Prevention:** Always prefix: `openai/gpt-4o`, `anthropic/claude-3-sonnet`.
**Detection:** `NotFoundError` or 404 from provider.

## Moderate Pitfalls

### Pitfall 4: Cytoscape.js SSR Crash in Next.js
**What goes wrong:** `window is not defined` during server-side rendering.
**Why it happens:** Cytoscape.js accesses browser APIs on import.
**Prevention:** Use dynamic import with `ssr: false`:
```typescript
const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });
```

### Pitfall 5: JSONB Query Performance Without Indexes
**What goes wrong:** Filtering memories by dynamic metadata fields is slow.
**Why it happens:** PostgreSQL cannot index inside JSONB without expression indexes.
**Prevention:** Create GIN indexes on `metadata` and partial indexes on frequently queried keys:
```sql
CREATE INDEX idx_memories_metadata ON memories USING gin(metadata);
```

### Pitfall 6: TEI GPU Image on CPU-Only Machine
**What goes wrong:** Docker container fails to start with CUDA errors.
**Why it happens:** `text-embeddings-inference:1.7.2` requires NVIDIA runtime.
**Prevention:** Use `:cpu-1.7.2` tag for local/desktop deployments without GPU.

## Minor Pitfalls

### Pitfall 7: RRF Constant Tuning Obsession
**What goes wrong:** Spending days tuning `k=60` for RRF.
**Why it happens:** Believing RRF needs dataset-specific optimization.
**Prevention:** Use `k=60` as a robust default; only tune if you have an evaluation dataset.

### Pitfall 8: Forgetting Embedding Dimension Migration
**What goes wrong:** Existing memories have 384-dim vectors; new model outputs 1024-dim.
**Why it happens:** pgvector columns are fixed-dimension.
**Prevention:** Plan a background re-embedding job when switching models.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| LiteLLM integration | Global `litellm.api_key` leak between requests | Pass per-request `api_key` |
| TEI deployment | Model download timeout on first start | Pre-download model in Dockerfile or volume mount |
| Cytoscape.js graph | Layout algorithm freezes with 500+ nodes | Use `fcose` (WebWorker-friendly) and debounce layout calls |
| Dynamic types | Users creating types with conflicting schemas | Validate schema at creation time, enforce required fields |
| HNSW indexing | Index build locks table | Use `CREATE INDEX CONCURRENTLY` |

## Sources

- pgvector v0.8.2 README — troubleshooting section (HIGH confidence)
- LiteLLM docs — exception mapping and model name format (HIGH confidence)
- Cytoscape.js GitHub issues — SSR and React integration patterns (MEDIUM confidence)
- TEI GitHub issues — CPU/GPU image confusion (MEDIUM confidence)
- `litellm-integration-RESEARCH.md` — pitfalls section (HIGH confidence)
