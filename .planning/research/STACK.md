# Technology Stack Additions & Changes

**Project:** Victorious Memory V2
**Researched:** 2026-05-25
**Confidence:** HIGH for LiteLLM and graph viz; MEDIUM-HIGH for embeddings (rapidly evolving field)

## Executive Summary

VM2 needs four architectural upgrades: (1) **LiteLLM** replaces the custom provider gateway, (2) **Cytoscape.js** replaces the inadequate graph visualization, (3) **dynamic memory types** use PostgreSQL JSONB with a new `memory_types` table, and (4) **advanced RAG** upgrades pgvector, swaps the embedding model to a hybrid-capable model served via TEI, and adds a re-ranker stage. Most changes are additive — no existing stack components are removed.

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

---

## 2. Graph Visualization

### Recommendation: Cytoscape.js

**Decision:** Use **Cytoscape.js v3.33.x** with the `react-cytoscapejs` wrapper for the memory relationship graph. Cytoscape.js is the industry standard for knowledge graph visualization — used by GitHub, Amazon, Google, Elastic, and Obsidian. It is purpose-built for network analysis and exploration, not workflow editing.

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

### Why Cytoscape.js over React Flow

| Criterion | Cytoscape.js | React Flow |
|-----------|--------------|------------|
| Primary use case | Network analysis, knowledge graphs | Node-based UIs, workflow builders |
| Layout algorithms | 15+ built-in + extensions | Requires external libs (dagre, elk, d3-force) |
| Compound nodes | Native (groups/clusters) | Sub-flows (more complex) |
| Graph algorithms | BFS, DFS, PageRank, centrality, etc. | None |
| Performance at 500+ nodes | Smooth (Canvas renderer) | Slower (DOM-based) |
| React integration | Wrapper needed | Native |
| Custom node UI | Canvas styling (less rich) | Full React components (richer) |
| Bundle size | ~90KB minified + gizpped | ~180KB |

**VM2-specific rationale:**
- Memory relationships form a *network* to be *explored*, not a *workflow* to be *edited*.
- Compound nodes let us group memories by project or type visually.
- Graph algorithms (e.g., PageRank) can surface "important" memories.
- Force-directed layout (`fcose`) is the standard for knowledge graphs (Obsidian uses similar).
- The React wrapper is thin — we still control it via React state and refs.

### Alternative: React Flow

If future requirements shift toward *editing* the graph (dragging memories, manually creating edges, building workflows), **React Flow** (`@xyflow/react` v12.x) would be better. It is native React, supports rich custom nodes with Tailwind, and has built-in dark mode. For now, defer this unless UX-02 explicitly requires graph editing.

### Integration Points

1. **Data source**: `/api/graph` endpoint (existing) returns nodes (memories) and edges (relationships).
2. **React component**: Create `MemoryGraph.tsx` wrapping `<CytoscapeComponent>`.
3. **Styling**: Use Cytoscape stylesheet (JSON) to map memory types to colors, confidence to node size, project to compound parent.
4. **Dark mode**: Toggle `cy.style()` between light/dark palettes on theme change.
5. **Interactivity**: Click → navigate to memory detail; hover → tooltip with content preview; filter → hide/show by type or project.

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

## 4. Advanced Semantic Search & RAG Architecture

### 4.1 Embedding Model Upgrade

**Current:** `sentence-transformers` in-process with `BAAI/bge-small-en-v1.5` (384 dim). Blocks event loop.

**Recommendation:** Move to **HuggingFace Text Embeddings Inference (TEI)** as a separate Docker service, with a hybrid-capable embedding model.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TEI (GPU) | `ghcr.io/huggingface/text-embeddings-inference:1.7.2` | Embedding inference server | OpenAI-compatible HTTP API, batches requests, GPU accelerated |
| TEI (CPU) | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.7.2` | CPU fallback | Same API, no CUDA required |
| BGE-M3 | `BAAI/bge-m3` (568M params) | Hybrid embedding model | Dense + sparse + ColBERT in one model; replaces custom BM25 |
| Qwen3-Embedding-0.6B | `Qwen/Qwen3-Embedding-0.6B` (0.6B params) | Alternative high-quality model | #1 MTEB multilingual, 32K context, instruction-aware |
| BGE-Reranker-v2-M3 | `BAAI/bge-reranker-v2-m3` (8B params) | Cross-encoder reranker | Second-stage re-ranking for RAG |
| Qwen3-Reranker-0.6B | `Qwen/Qwen3-Reranker-0.6B` (0.6B params) | Alternative reranker | Smaller, faster, still high quality |

**Recommended combination for VM2:**
- **Embedding:** `BGE-M3` via TEI. Its hybrid retrieval (dense + sparse lexical) eliminates VM2's custom Python BM25 implementation entirely. 1024 dimensions, 8192 context, MIT license.
- **Reranker:** `Qwen3-Reranker-0.6B` via TEI (if TEI supports it) or `sentence-transformers` cross-encoder. Smaller and faster than BGE-Reranker-v2-M3 with excellent quality.

**Alternative (maximum quality):**
- **Embedding:** `Qwen3-Embedding-0.6B` via TEI. Best MTEB scores, 32K context, instruction-aware (boost RAG performance 1-5%).
- Tradeoff: No built-in sparse vectors — would keep a simplified BM25 or use PostgreSQL full-text search for keyword matching.

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
| `app/domains/search/bm25.py` | **Deprecate** if using BGE-M3 sparse vectors; otherwise keep for fallback |
| `app/domains/search/service.py` | Implement two-stage retrieval: (1) pgvector HNSW + sparse/RRF, (2) reranker API call |
| `app/config.py` | Add `EMBEDDING_URL`, `EMBEDDING_MODEL`, `RERANKER_URL`, `RERANKER_MODEL` settings |

### New Python Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rank-bm25` | ^0.2.2 | BM25 implementation (if keeping keyword search) | If NOT using BGE-M3 sparse vectors |

No new dependencies needed for TEI integration — use existing `httpx` client.

### 4.2 pgvector Optimization

**Upgrade required:**

| Component | Current | Target | Why |
|-----------|---------|--------|-----|
| `pgvector` Python package | >=0.3.0 | >=0.8.2 | Iterative index scans, sparse vectors, halfvec improvements |
| PostgreSQL extension | pgvector v0.3+ | v0.8.2 | Same reasons |
| PostgreSQL image | `pgvector/pgvector:pg16` | latest `pg16` tag | Ensure v0.8.2 is included |

**Index strategy:**

```sql
-- HNSW index for dense vectors (cosine similarity)
CREATE INDEX idx_memories_embedding_hnsw ON memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- Optional: halfvec index for 50% memory reduction
CREATE INDEX idx_memories_embedding_halfvec ON memories
USING hnsw ((embedding::halfvec(1024)) halfvec_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- Full-text search for keyword fallback (if not using sparse vectors)
CREATE INDEX idx_memories_fts ON memories
USING gin(to_tsvector('english', content));
```

**Query-time settings:**
```sql
SET hnsw.ef_search = 100;        -- Better recall (default 40)
SET hnsw.iterative_scan = strict_order;  -- pgvector 0.8.0+: auto-scan more for filtered queries
```

### 4.3 Hybrid Search Architecture

**Current:** Python-level fusion: `0.7 * semantic_score + 0.3 * bm25_score`

**Recommended:** Database-level Reciprocal Rank Fusion (RRF) for better accuracy and performance.

```sql
-- RRF score function
CREATE OR REPLACE FUNCTION rrf_score(rank int, k int DEFAULT 60)
RETURNS numeric AS $$
    SELECT COALESCE(1.0 / ($1 + $2), 0.0);
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- Hybrid query
WITH semantic AS (
    SELECT id, embedding <=> query_vec AS dist,
           row_number() OVER (ORDER BY embedding <=> query_vec) AS rank
    FROM memories
    ORDER BY embedding <=> query_vec
    LIMIT 100
),
keyword AS (
    SELECT id, ts_rank_cd(to_tsvector('english', content), query) AS rank_score,
           row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', content), query) DESC) AS rank
    FROM memories, plainto_tsquery('english', 'search terms') query
    WHERE to_tsvector('english', content) @@ query
    ORDER BY rank_score DESC
    LIMIT 100
)
SELECT m.*,
       COALESCE(rrf(s.rank), 0) + COALESCE(rrf(k.rank), 0) AS rrf_score
FROM memories m
LEFT JOIN semantic s ON m.id = s.id
LEFT JOIN keyword k ON m.id = k.id
WHERE s.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY rrf_score DESC
LIMIT 20;
```

**If using BGE-M3 sparse vectors:** Store sparse vector in a `sparsevec` column and use pgvector's sparse vector distance operators (`<=>`, `<#>`) for lexical search, eliminating the need for `tsvector`/`plainto_tsquery`.

### 4.4 Two-Stage Retrieval Pipeline

```
User Query
    |
    v
[Stage 1: Retrieval] --- Dense (pgvector HNSW) ---> Candidate Pool (top 100)
                   |-- Sparse (pgvector sparsevec OR BM25) --->
                   |-- RRF Fusion in SQL --->
    v
[Stage 2: Re-ranking] --- Cross-encoder (Qwen3-Reranker-0.6B via TEI) --->
    v
Final Results (top 10-20)
    |
    v
Context Builder -> LLM Prompt
```

**Latency budget (local desktop):**
- Stage 1 (pgvector HNSW + RRF): ~15-30ms
- Stage 2 (reranker, 100 docs): ~200-500ms (CPU) or ~50-100ms (GPU)
- Total: <1s acceptable for context injection

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
    "cytoscape": "^3.33.0",
    "react-cytoscapejs": "^2.0.0",
    "cytoscape-fcose": "^2.2.0",
    "cytoscape-cose-bilkent": "^4.1.0",
    "cytoscape-popper": "^2.0.0",
    "cytoscape-dagre": "^2.5.0"
  },
  "devDependencies": {
    "@types/cytoscape": "^3.21.0"
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
| Graph viz | Cytoscape.js | React Flow | React Flow is for workflow editors, not knowledge graph exploration |
| Graph viz | Cytoscape.js | D3.js | D3 has steep learning curve, no built-in graph layouts, manual React integration |
| Graph viz | Cytoscape.js | Sigma.js + Graphology | Better for 10K+ nodes; overkill for VM2's scale |
| Embedding | BGE-M3 (TEI) | Qwen3-Embedding-0.6B | Qwen3 has higher MTEB but no built-in sparse vectors; requires keeping BM25 |
| Embedding | BGE-M3 (TEI) | In-process sentence-transformers | Blocks event loop, cannot serve multiple requests, model is outdated |
| Reranker | Qwen3-Reranker-0.6B | BGE-Reranker-v2-M3 | BGE-Reranker is 8B params vs Qwen3's 0.6B; slower with marginal quality gain for VM2 |
| Hybrid search | RRF in SQL | Weighted sum in Python | RRF is more robust, works at DB level, 15-30% better retrieval accuracy |
| Vector type | `vector` (full precision) | `halfvec` | `halfvec` is recommended for production; 50% memory reduction, minimal recall loss |

---

## 7. Installation Summary

```bash
# Backend
pip install litellm==1.86.0 openai==2.30.0 pgvector==0.8.2

# Frontend
cd apps/web
npm install cytoscape react-cytoscapejs cytoscape-fcose cytoscape-cose-bilkent cytoscape-popper cytoscape-dagre
npm install -D @types/cytoscape

# TEI (run as Docker service, not pip)
docker run --gpus all -p 8080:80 -v hf_cache:/data \
  ghcr.io/huggingface/text-embeddings-inference:1.7.2 \
  --model-id BAAI/bge-m3 --dtype float16
```

---

## 8. Integration Order

1. **LiteLLM** (Phase 2, in progress) — Zero risk, replaces gateway internal implementation only.
2. **pgvector upgrade + HNSW indexes** (Phase 2/3) — Low risk, additive index creation.
3. **TEI embedding service** (Phase 3) — Medium risk; requires Docker Compose change, model download, async HTTP client rewrite.
4. **Cytoscape.js graph** (Phase 3, UX-02) — Medium risk; new frontend component, but isolated from backend.
5. **Dynamic memory types** (Phase 4, ARCH-04) — Medium risk; requires DB migration, prompt engineering changes, UI updates.
6. **Reranker + advanced RAG** (Phase 4/5, ARCH-01/03) — Higher risk; adds latency, requires evaluation to measure improvement.

---

## Sources

- [LiteLLM Docs](https://docs.litellm.ai/docs/) — Official documentation (HIGH confidence)
- [Cytoscape.js Official](https://js.cytoscape.org/) — v3.33.x API, extensions list (HIGH confidence)
- [React Flow Official](https://reactflow.dev/) — v12.x docs, comparison context (HIGH confidence)
- [pgvector GitHub](https://github.com/pgvector/pgvector) — v0.8.2 README, HNSW/IVFFlat docs (HIGH confidence)
- [Qwen3-Embedding-8B HuggingFace](https://huggingface.co/Qwen/Qwen3-Embedding-8B) — Model card, benchmarks, TEI usage (HIGH confidence)
- [BGE-M3 HuggingFace](https://huggingface.co/BAAI/bge-m3) — Model card, hybrid retrieval docs (HIGH confidence)
- [TEI Documentation](https://huggingface.co/docs/text-embeddings-inference/index) — Deployment guides (MEDIUM confidence)
- [Enterprise RAG Architecture — Applied AI](https://www.applied-ai.com/briefings/enterprise-rag-architecture) — RRF, reranking patterns (MEDIUM confidence)
- [pgvector Hybrid Search — Jonathan Katz](https://jkatz.github.io/post/postgres/hybrid-search-postgres-pgvector) — SQL-level RRF implementation (HIGH confidence)
- [Memgraph Graph Viz Comparison](https://memgraph.com/blog/you-want-a-fast-easy-to-use-and-popular-graph-visualization-tool) — Library comparison matrix (MEDIUM confidence)
