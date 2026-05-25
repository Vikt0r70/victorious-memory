# Feature Landscape: VM2 v1.1 Stack Additions

**Domain:** AI memory system with graph visualization, dynamic taxonomy, and simple RAG
**Researched:** 2026-05-25
**Updated:** 2026-05-25 (corrected per user review)

## Table Stakes

Features users expect from a production memory system.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple LLM provider support | Users have different API keys (OpenAI, Anthropic, local) | Low | Solved by LiteLLM |
| Interactive graph exploration | Memory relationships are the core value proposition | Medium | force-graph provides organic, bouncy visualization |
| Fast semantic search | Retrieval must feel instant (<200ms) | Medium | HNSW index + TEI achieves this |
| Dark mode UI | Desktop developer tool standard | Low | force-graph supports theme-driven colors |
| Docker deployment | Must run locally without cloud dependencies | Low | TEI adds one container |

## Differentiators

Features that set VM2 apart from simple note-taking or vector search tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Project-specific memory types | Different projects need different memory schemas (e.g., "API decision" vs "CSS pattern") | Medium | JSONB + per-project registry enables this without code changes |
| Single-stage dense retrieval | Fast, simple, effective — no tuning needed | Low | pgvector HNSW with cosine similarity |
| Organic graph physics | Bouncy, free-floating memory nodes like Obsidian | Low | force-graph with d3-force |
| Error-at-failure fallback | If primary provider fails, immediately try fallback — no background pinging | Low | Handle errors at call site |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom provider HTTP clients | LiteLLM handles 100+ providers battle-tested | Use `litellm.acompletion()` directly |
| In-process embedding models | Blocks asyncio event loop, poor concurrency | Use TEI as separate service |
| EAV schema for dynamic types | Complex, slow, hard to query | Use PostgreSQL JSONB + partial indexes |
| React Flow for graph exploration | Wrong abstraction — built for workflow editors, not networks | Use force-graph |
| Cytoscape.js for graph | Rigid, enterprise-style; not organic/bouncy | Use force-graph |
| D3.js from scratch | Too low-level; force-graph already wraps d3-force with Canvas | Use force-graph |
| DOM/SVG-based graph rendering | Cannot handle scale — SVG chokes at 500+ nodes, DOM overhead is high | Use Canvas-based renderer (force-graph uses Canvas) or WebGL |
| Multi-stage RAG pipeline | Overkill for VM2; 5000-token context provides rich context regardless | Single-stage pgvector HNSW |
| Reciprocal Rank Fusion (RRF) | Unnecessary complexity for single-stage retrieval | Direct cosine similarity |
| Background health checks | Wasted resources for async batch-driven system | Error-at-failure fallback |
| Dedicated vector database (Pinecone, Weaviate) | Adds operational complexity; pgvector is sufficient at VM2's scale | Optimize pgvector HNSW |

## Feature Dependencies

```
LiteLLM integration --> Provider registry UI (dynamic model lists)
TEI embedding service --> pgvector HNSW index --> Simple dense search
Dynamic memory types --> Project-scoped type registry --> Extraction prompt updates
force-graph --> /api/graph endpoint (existing) --> Memory detail panel
```

## MVP Recommendation

Prioritize:
1. **LiteLLM provider gateway** — Unblocks all LLM-dependent features
2. **force-graph** — Highest user-visible impact for UX-02
3. **TEI embedding service with BGE-M3** — Fixes event-loop blocking + improves search quality
4. **HNSW index on pgvector** — Low-effort, high-performance gain

Defer:
- **Reranker / RRF**: Not needed — single-stage HNSW is sufficient
- **Dynamic memory types**: Requires UX design for type editor; can ship with hardcoded types + metadata JSONB first
- **Halfvec / binary quantization**: Only needed if scaling beyond ~100K memories

## Sources

- `PROJECT.md` requirements (PROV-*, UX-*, ML-*, ARCH-*, SYS-*)
- `litellm-integration-RESEARCH.md` provider analysis
- pgvector v0.8.2 documentation on HNSW and hybrid search
- force-graph documentation
