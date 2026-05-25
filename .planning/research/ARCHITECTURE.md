# Architecture Patterns: VM2 v1.1 Additions

**Domain:** AI memory system — graph viz, dynamic types, advanced RAG
**Researched:** 2026-05-25

## Recommended Architecture Additions

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| TEI Service | Embedding inference | FastAPI (HTTP), PostgreSQL (none — stateless) |
| LiteLLM Gateway | Provider-agnostic LLM calls | Extraction agent, provider test endpoint, MCP |
| force-graph | Frontend knowledge graph visualization | `/api/graph`, `/api/memories` |
| Memory Type Registry | Project-scoped type definitions | Extraction validator, memory CRUD |
| HNSW Search | Single-stage dense vector retrieval | Context builder, memory list API |

### Data Flow: Simple Context Retrieval

```
Conversation Query
    |
    v
[Embedding Client] --> TEI /embed --> Dense vector (1024-dim)
    |
    v
[pgvector HNSW] --> Top 20-50 candidates (cosine similarity)
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

### Pattern 2: Error-at-Failure Fallback
**What:** Handle provider errors at the point of failure, not via background health checks.
**When:** Async batch-driven system where real-time health monitoring is unnecessary.
**Example:**
```python
try:
    response = await litellm.acompletion(**primary_config)
except (ProviderError, TimeoutError):
    response = await litellm.acompletion(**fallback_config)
```

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

### Anti-Pattern 3: Multi-Stage RAG Pipeline
**What:** Dense + sparse + RRF + reranker for retrieval.
**Why bad:** Overkill for VM2's use case. The 5000-token context window provides rich context regardless of retrieval perfection. Adds unnecessary latency.
**Instead:** Single-stage pgvector HNSW with cosine similarity — simple and fast.

## Scalability Considerations

| Concern | At 1K memories | At 100K memories | At 1M memories |
|---------|--------------|------------------|----------------|
| Vector search | Exact search fine | HNSW index required | HNSW + `halfvec` or binary quantization |
| Graph viz | force-graph smooth | force-graph fine | Canvas renderer handles 10K+ nodes |
| Embedding storage | ~4MB (1024-dim float32) | ~400MB | ~4GB — use `halfvec` to halve |
| TEI throughput | CPU sufficient | GPU recommended | GPU + batching required |

## Sources

- pgvector v0.8.2 documentation — HNSW, IVFFlat, halfvec, sparsevec, iterative scans
- TEI documentation — architecture and deployment patterns
- Cytoscape.js documentation — performance and layout guidance
- `ARCHITECTURE.md` (codebase) — existing component boundaries
