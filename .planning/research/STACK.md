# Technology Stack Additions & Changes

**Project:** Victorious Memory V2
**Researched:** 2026-05-25
**Confidence:** HIGH for LiteLLM and graph viz; MEDIUM-HIGH for embeddings (rapidly evolving field)

## Executive Summary

VM2 needs four architectural upgrades: (1) **LiteLLM** replaces the custom provider gateway, (2) **force-graph** replaces the inadequate graph visualization, (3) **dynamic memory types** use PostgreSQL JSONB with a new `memory_types` table, and (4) **simple RAG** uses pgvector HNSW for single-stage dense vector search. Most changes are additive — no existing stack components are removed.

**Corrections from user review:**
- RAG: Single-stage dense vector search (not multi-stage pipeline)
- Graph: force-graph (not Cytoscape.js)
- Health checks: Error-at-failure (not background pinging)
- LiteLLM: Direct `litellm.acompletion()` (not custom adapters)

---

## 1. LiteLLM Integration (Decided)

**Status:** Already researched and approved. See `litellm-integration-RESEARCH.md` for deep-dive.

### New Dependencies

| Library | Version | Purpose | Integration Point |
|---------|---------|---------|-------------------|
| `litellm` | >=1.86.0 | Unified LLM completion interface | `apps/api/app/domains/providers/gateway.py` rewrite |
| `openai` | >=2.20.0,<3.0.0 | LiteLLM dependency for OpenAI path | `apps/api/pyproject.toml` |

**Installation:**
```bash
pip install litellm==1.86.0
```

### Key Integration Points

1. **Gateway rewrite**: `ProviderGateway.complete()` calls `litellm.acompletion()` with per-request provider configs resolved from PostgreSQL.
2. **Exception mapping**: Wrap `litellm.APITimeoutError`, `RateLimitError`, `AuthenticationError`, `BadRequestError` into VM2's existing `ProviderError` hierarchy.
3. **Model name format**: Always prefix with provider: `openai/gpt-4o`, `anthropic/claude-3-sonnet`.
4. **Timeout**: Pass `timeout=30.0` per-request (LiteLLM default is 600s).
5. **Drop params**: Set `litellm.drop_params = True` to avoid errors with custom endpoints.

### Transitive Dependencies (Auto-installed)

| Library | Purpose |
|---------|---------|
| `tiktoken>=0.8.0` | Token counting |
| `tokenizers>=0.21.0` | HF tokenizer support |
| `aiohttp>=3.10,<4.0` | Async HTTP path |
| `jinja2>=3.1.6` | Prompt templating |
| `jsonschema>=4.0.0` | JSON mode validation |

**Docker impact:** ~50-100MB image size increase due to compiled Rust extensions in `tiktoken`/`tokenizers`. Use multi-stage builds to mitigate.

**No custom adapters:** Use `litellm.acompletion()` directly. Pass provider config from DB straight into the function. Do NOT build wrapper classes around LiteLLM.

---

## 2. Graph Visualization

### Recommendation: force-graph

**Decision:** Use **force-graph** (v1.x) with Canvas/WebGL renderer and d3-force physics engine for the memory relationship graph. This produces the organic, bouncy, "Obsidian-like" graph experience the user wants. force-graph uses HTML5 Canvas (not DOM/SVG) and can handle thousands of nodes smoothly.

**Key packages:**
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-force-graph-2d` | ^1.25.0 | React wrapper for 2D force graph | Canvas-based, handles thousands of nodes, physics-based |
| `d3-force` | ^3.0.0 | Physics simulation | Charges, links, collision, centering forces |

**Installation (frontend):**
```bash
cd apps/web
npm install react-force-graph-2d d3-force
npm install -D @types/d3-force
```

**Why force-graph over Cytoscape.js:**

| Criterion | force-graph | Cytoscape.js |
|-----------|-------------|--------------|
| Renderer | Canvas/WebGL (fast) | Canvas (heavier) |
| Physics | d3-force (bouncy, organic) | Layout algorithms (rigid) |
| Node count | 10K+ smooth | Struggles at 5K+ |
| Visual style | Free-floating, bouncy | Rigid, enterprise flowcharts |
| React integration | Native component | Wrapper needed |
| Bundle size | ~150KB | ~90KB + extensions |

**VM2-specific rationale:**
- Memory relationships should feel *organic* and *explorable*, not like a rigid org chart.
- The user explicitly wants "bouncy, Obsidian-like" — force-graph delivers this out of the box.
- Canvas renderer handles the "tens of thousands" scale target without browser freeze.
- Click → open detail panel (no graph editing needed).

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `cytoscape` | ^3.33.0 | Core graph theory library | Mature, 15+ layout algorithms, graph analysis APIs, compound nodes |
| `react-cytoscapejs` | ^2.0.0 | React wrapper | Thin wrapper for React integration |
| `cytoscape-fcose` | ^2.2.0 | Force-directed layout | Fast compound spring embedder — best for memory clusters |
| `cytoscape-cose-bilkent` | ^4.1.0 | Compound layout | Group memories by project/type |
| `cytoscape-popper` | ^2.0.0 | Tooltips/labels | Position popups over nodes (uses Tippy.js) |
| `cytoscape-dagre` | ^2.5.0 | Hierarchical layout | Alternative layout for timeline views |

**Installation (frontend):**
```bash
cd apps/web
npm install cytoscape react-cytoscapejs
npm install cytoscape-fcose cytoscape-cose-bilkent cytoscape-popper cytoscape-dagre
npm install -D @types/cytoscape
```

### Integration Points

1. **Data source**: `/api/graph` endpoint (existing) returns nodes (memories) and edges (relationships).
2. **React component**: Create `MemoryGraph.tsx` using `<ForceGraph2D>`.
3. **Styling**: Map memory types to colors, confidence to node size via canvas draw callbacks.
4. **Dark mode**: Toggle canvas background and node colors on theme change.
5. **Interactivity**: Click → open detail panel; hover → tooltip with content preview; filter → hide/show by type or project.
6. **No manual edges**: Users cannot create/edit edges — graph is read-only exploration.

---

## 3. Dynamic Memory Type Taxonomy

### Approach: PostgreSQL JSONB + Per-Project Type Registry

No new major dependencies required. Uses existing PostgreSQL 16 + SQLAlchemy 2.0 + Pydantic v2.

### New Database Schema

```sql
-- Project-defined memory types
CREATE TABLE memory_types (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT,
    schema JSONB DEFAULT '{}',  -- JSON Schema for validation
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add metadata JSONB to memories for dynamic fields
ALTER TABLE memories ADD COLUMN metadata JSONB DEFAULT '{}';
```

### Backend Changes

| File | Change |
|------|--------|
| `app/models.py` | Add `MemoryType` model; add `metadata: Mapped[dict]` to `Memory`; make `memory_type` a foreign key or free text with validation |
| `app/domains/memory_types/` | New domain: `router.py`, `service.py`, `schemas.py` for CRUD |
| `app/domains/extraction/agent.py` | Update prompt to use project-specific type list instead of hardcoded `MEMORY_TYPES` |
| `app/domains/extraction/validator.py` | Validate extracted types against `memory_types.schema` using `jsonschema` |

### Validation Library

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `jsonschema` | >=4.0.0 | Validate dynamic memory metadata | Already pulled in by `litellm`; add explicitly if LiteLLM is deferred |

**Pydantic v2 alternative:** Can use Pydantic's `create_model()` for runtime schema validation instead of `jsonschema`. Since Pydantic is already installed, this avoids a new dependency. However, `jsonschema` is more flexible for user-defined schemas stored as JSON.

### Migration Strategy

1. Create `memory_types` table via Alembic migration.
2. Seed default types (decision, preference, constraint, bugfix, lesson, pattern, research, reference, architecture, context) as global types (`project_id = NULL`).
3. Update extraction prompt to fetch types dynamically per project.
4. Existing `memory_type` text column remains for backward compatibility; new code uses the registry.

---

## 4. Simple Semantic Search & RAG Architecture

### 4.1 Embedding Model Upgrade

**Current:** `sentence-transformers` in-process with `BAAI/bge-small-en-v1.5` (384 dim). Blocks event loop.

**Recommendation:** Move to **HuggingFace Text Embeddings Inference (TEI)** as a separate Docker service, with a high-quality dense embedding model.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TEI (GPU) | `ghcr.io/huggingface/text-embeddings-inference:1.7.2` | Embedding inference server | OpenAI-compatible HTTP API, batches requests, GPU accelerated |
| TEI (CPU) | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.7.2` | CPU fallback | Same API, no CUDA required |
| BGE-M3 | `BAAI/bge-m3` (568M params) | Dense embedding model | 1024 dimensions, 8192 context, MIT license |
| Qwen3-Embedding-0.6B | `Qwen/Qwen3-Embedding-0.6B` (0.6B params) | Alternative high-quality model | #1 MTEB multilingual, 32K context, instruction-aware |

**Recommended for VM2:**
- **Embedding:** `BGE-M3` via TEI. 1024 dimensions, dense vectors only. Simple and effective.
- **CPU fallback:** For desktop without GPU, `BAAI/bge-base-en-v1.5` (110M params, 768-dim) is lighter and faster. Use BGE-M3 only for GPU setups.
- **No reranker:** Single-stage retrieval is sufficient. The 5000-token context window provides rich context regardless.
- **No sparse vectors:** Dense HNSW search is enough. BM25 can be removed.

### Docker Compose Addition

```yaml
services:
  embeddings:
    image: ghcr.io/huggingface/text-embeddings-inference:1.7.2
    command: --model-id BAAI/bge-m3 --dtype float16
    volumes:
      - hf_cache:/data
    ports:
      - "8080:80"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

For CPU-only deployments (local desktop first):
```yaml
    image: ghcr.io/huggingface/text-embeddings-inference:cpu-1.7.2
```

### Backend Integration

| File | Change |
|------|--------|
| `app/domains/search/embeddings.py` | Replace in-process `sentence-transformers` with async HTTP client calling TEI at `EMBEDDING_URL` |
| `app/domains/search/bm25.py` | **Remove** — no longer needed with single-stage dense search |
| `app/domains/search/service.py` | Single-stage retrieval: pgvector HNSW with cosine similarity |
| `app/config.py` | Add `EMBEDDING_URL`, `EMBEDDING_MODEL` settings |

### 4.2 pgvector Optimization

**Upgrade required:**

| Component | Current | Target | Why |
|-----------|---------|--------|-----|
| `pgvector` Python package | >=0.3.0 | >=0.8.2 | Iterative index scans, halfvec improvements |
| PostgreSQL extension | pgvector v0.3+ | v0.8.2 | Same reasons |
| PostgreSQL image | `pgvector/pgvector:pg16` | latest `pg16` tag | Ensure v0.8.2 is included |

**Index strategy:**

```sql
-- HNSW index for dense vectors (cosine similarity)
CREATE INDEX idx_memories_embedding_hnsw ON memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);
```

**Query-time settings:**
```sql
SET hnsw.ef_search = 100;  -- Better recall (default 40)
```

### 4.3 Single-Stage Retrieval Pipeline

```
User Query
    |
    v
[Embedding Client] --> TEI /embed --> Dense vector (1024-dim)
    |
    v
[pgvector HNSW] --> Top 20-50 candidates (cosine similarity)
    |
    v
Context Builder --> Formatted memory block --> LLM system prompt
```

**Latency budget (local desktop):**
- Embedding (TEI): ~50-100ms (CPU) or ~10-20ms (GPU)
- pgvector HNSW: ~15-30ms
- Total: <200ms for context retrieval — well within the <1s budget

---

## 5. Complete Dependency Delta

### Python Backend (`apps/api/pyproject.toml`)

**Add:**
```toml
dependencies = [
    # ... existing deps ...
    "litellm>=1.86.0",
    "openai>=2.20.0,<3.0.0",
    "pgvector>=0.8.2",  # upgraded from >=0.3.0
]
```

**Remove (optional, if embedding moves to TEI):**
- `sentence-transformers>=3.0.0` (from backend; keep if fallback needed)

**Note:** `jsonschema` is pulled in by `litellm`. If LiteLLM is deferred, add it explicitly for memory type validation.

### Node.js Frontend (`apps/web/package.json`)

**Add:**
```json
{
  "dependencies": {
    "react-force-graph-2d": "^1.25.0",
    "d3-force": "^3.0.0"
  },
  "devDependencies": {
    "@types/d3-force": "^3.0.0"
  }
}
```

### Docker Compose

**Add `embeddings` service** (see section 4.1).

**Update `db` image** to ensure pgvector v0.8.2:
```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    # Ensure this tag includes pgvector 0.8.2+
```

---

## 6. Alternatives Considered

| Area | Recommended | Alternative | Why Not |
|------|-------------|-------------|---------|
| Graph viz | force-graph | Cytoscape.js | Cytoscape is rigid/enterprise; force-graph is bouncy/organic like Obsidian |
| Graph viz | force-graph | React Flow | React Flow is for workflow editors, not knowledge graph exploration |
| Graph viz | force-graph | D3.js from scratch | Too low-level; force-graph wraps d3-force with Canvas renderer |
| Embedding | BGE-M3 (TEI) | Qwen3-Embedding-0.6B | Qwen3 has higher MTEB but 32K context is overkill; BGE-M3 is simpler |
| Embedding | BGE-M3 (TEI) | In-process sentence-transformers | Blocks event loop, cannot serve multiple requests, model is outdated |
| Search | Single-stage HNSW | RRF + reranker pipeline | Overkill for VM2; 5000-token context window provides rich context regardless |
| Vector type | `vector` (full precision) | `halfvec` | `halfvec` is recommended for production; 50% memory reduction, minimal recall loss |

---

## 7. Installation Summary

```bash
# Backend
pip install litellm==1.86.0 openai==2.30.0 pgvector==0.8.2

# Frontend
cd apps/web
npm install react-force-graph-2d d3-force
npm install -D @types/d3-force

# TEI (run as Docker service, not pip)
docker run --gpus all -p 8080:80 -v hf_cache:/data \
  ghcr.io/huggingface/text-embeddings-inference:1.7.2 \
  --model-id BAAI/bge-m3 --dtype float16
```

---

## 8. Integration Order

1. **LiteLLM** (Phase 1) — Zero risk, replaces gateway internal implementation only.
2. **pgvector upgrade + HNSW indexes** (Phase 1) — Low risk, additive index creation.
3. **TEI embedding service** (Phase 1) — Medium risk; requires Docker Compose change, model download, async HTTP client rewrite.
4. **force-graph** (Phase 2, UX-02) — Medium risk; new frontend component, but isolated from backend.
5. **Dynamic memory types** (Phase 6, ARCH-04) — Medium risk; requires DB migration, prompt engineering changes, UI updates.
6. **No reranker or RRF** — Single-stage dense search is sufficient for VM2's use case.

---

## Sources

- [LiteLLM Docs](https://docs.litellm.ai/docs/) — Official documentation (HIGH confidence)
- [force-graph GitHub](https://github.com/vasturiano/react-force-graph) — React wrapper for force-directed graphs (HIGH confidence)
- [React Flow Official](https://reactflow.dev/) — v12.x docs, comparison context (HIGH confidence)
- [pgvector GitHub](https://github.com/pgvector/pgvector) — v0.8.2 README, HNSW/IVFFlat docs (HIGH confidence)
- [Qwen3-Embedding-8B HuggingFace](https://huggingface.co/Qwen/Qwen3-Embedding-8B) — Model card, benchmarks, TEI usage (HIGH confidence)
- [BGE-M3 HuggingFace](https://huggingface.co/BAAI/bge-m3) — Model card, hybrid retrieval docs (HIGH confidence)
- [TEI Documentation](https://huggingface.co/docs/text-embeddings-inference/index) — Deployment guides (MEDIUM confidence)
- [Enterprise RAG Architecture — Applied AI](https://www.applied-ai.com/briefings/enterprise-rag-architecture) — RRF, reranking patterns (MEDIUM confidence)
- [pgvector Hybrid Search — Jonathan Katz](https://jkatz.github.io/post/postgres/hybrid-search-postgres-pgvector) — SQL-level RRF implementation (HIGH confidence)
- [Memgraph Graph Viz Comparison](https://memgraph.com/blog/you-want-a-fast-easy-to-use-and-popular-graph-visualization-tool) — Library comparison matrix (MEDIUM confidence)
