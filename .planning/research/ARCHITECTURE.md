# Architecture Patterns: VM2 v1.1 Additions

**Domain:** AI memory system — graph viz, dynamic types, advanced RAG
**Researched:** 2026-05-25

## Recommended Architecture Additions

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| TEI Service | Embedding + reranking inference | FastAPI (HTTP), PostgreSQL (none — stateless) |
| LiteLLM Gateway | Provider-agnostic LLM calls | Extraction agent, provider test endpoint, MCP |
| Cytoscape Graph | Frontend knowledge graph visualization | `/api/graph`, `/api/memories` |
| Memory Type Registry | Project-scoped type definitions | Extraction validator, memory CRUD |
| RRF Search Service | Hybrid dense/sparse retrieval | Context builder, memory list API |
| Reranker Client | Second-stage result ranking | RRF Search Service |

### Data Flow: Advanced Context Retrieval

```
Conversation Query
    |
    v
[Query Expansion] (optional LLM call)
    |
    v
[Embedding Client] --> TEI /embed --> Dense vector
    |                              --> Sparse vector (if BGE-M3)
    v
[pgvector HNSW] --> Top 100 candidates (semantic)
[pgvector sparsevec OR tsvector] --> Top 100 candidates (lexical)
    |
    v
[RRF Fusion] (SQL-level) --> Combined top 50
    |
    v
[Reranker Client] --> TEI /rerank --> Scored top 20
    |
    v
[Context Builder] --> Formatted memory block --> LLM system prompt
```

## Patterns to Follow

### Pattern 1: Separate Inference Service
**What:** Run embedding/reranking models in a dedicated container (TEI), not in the FastAPI process.
**When:** Any model inference that blocks the Python GIL or asyncio event loop.
**Example:**
```yaml
# docker-compose.yml
services:
  api:
    depends_on: [db, embeddings]
  embeddings:
    image: ghcr.io/huggingface/text-embeddings-inference:1.7.2
```

### Pattern 2: Database-Level Fusion
**What:** Perform RRF or score combination in SQL rather than Python.
**When:** Combining ranked lists from multiple retrieval methods.
**Example:** See `STACK.md` section 4.3 for the RRF SQL function and hybrid query.

### Pattern 3: JSONB Registry with JSON Schema Validation
**What:** Store per-project type schemas as JSONB, validate memory metadata at extraction time.
**When:** User-defined schemas that evolve without migrations.
**Example:**
```python
# Validate memory metadata against project type schema
from jsonschema import validate
validate(instance=memory_metadata, schema=memory_type.schema)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: In-Process Model Loading
**What:** Loading `sentence-transformers` into the FastAPI worker process.
**Why bad:** Blocks the asyncio event loop; cannot handle concurrent requests; model loaded per worker.
**Instead:** Use TEI or another dedicated inference service with HTTP API.

### Anti-Pattern 2: EAV for Dynamic Fields
**What:** Using Entity-Attribute-Value tables for user-defined memory fields.
**Why bad:** Complex queries, poor performance, no type safety, hard to index.
**Instead:** PostgreSQL JSONB column with GIN indexes on known keys.

### Anti-Pattern 3: Weighted-Sum Score Fusion
**What:** `score = 0.7 * semantic + 0.3 * bm25` in Python.
**Why bad:** Requires per-dataset tuning; scores are incomparable across methods.
**Instead:** Reciprocal Rank Fusion (RRF) in SQL — robust and parameter-light.

## Scalability Considerations

| Concern | At 1K memories | At 100K memories | At 1M memories |
|---------|--------------|------------------|----------------|
| Vector search | Exact search fine | HNSW index required | HNSW + `halfvec` or binary quantization |
| Graph viz | Cytoscape.js smooth | Cytoscape.js fine | May need level-of-detail (LOD) or clustering |
| Embedding storage | ~4MB (1024-dim float32) | ~400MB | ~4GB — use `halfvec` to halve |
| TEI throughput | CPU sufficient | GPU recommended | GPU + batching required |

## Sources

- pgvector v0.8.2 documentation — HNSW, IVFFlat, halfvec, sparsevec, iterative scans
- TEI documentation — architecture and deployment patterns
- Cytoscape.js documentation — performance and layout guidance
- `ARCHITECTURE.md` (codebase) — existing component boundaries
