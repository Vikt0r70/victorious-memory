# Feature Landscape: VM2 v1.1 Stack Additions

**Domain:** AI memory system with graph visualization, dynamic taxonomy, and advanced RAG
**Researched:** 2026-05-25

## Table Stakes

Features users expect from a production memory system.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple LLM provider support | Users have different API keys (OpenAI, Anthropic, local) | Low | Solved by LiteLLM |
| Interactive graph exploration | Memory relationships are the core value proposition | Medium | Cytoscape.js provides this out-of-the-box |
| Fast semantic search | Retrieval must feel instant (<200ms) | Medium | HNSW index + TEI achieves this |
| Dark mode UI | Desktop developer tool standard | Low | Cytoscape.js supports theme-driven stylesheets |
| Docker deployment | Must run locally without cloud dependencies | Low | TEI adds one container |

## Differentiators

Features that set VM2 apart from simple note-taking or vector search tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Project-specific memory types | Different projects need different memory schemas (e.g., "API decision" vs "CSS pattern") | Medium | JSONB + per-project registry enables this without code changes |
| Hybrid dense + sparse retrieval | Catches both semantic similarity and exact keyword matches | Medium | BGE-M3 does this in a single model |
| Two-stage retrieval with reranking | Significantly improves context relevance vs naive vector search | Medium | Qwen3-Reranker-0.6B is fast enough for local use |
| Compound graph layouts | Group memories by project or type visually | Low | Cytoscape.js native feature (fcose/cose-bilkent) |
| Graph analysis (centrality, paths) | Surface "important" memories algorithmically | Low | Cytoscape.js includes PageRank, betweenness centrality |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom provider HTTP clients | LiteLLM handles 100+ providers battle-tested | Use `litellm.acompletion()` |
| In-process embedding models | Blocks asyncio event loop, poor concurrency | Use TEI as separate service |
| EAV schema for dynamic types | Complex, slow, hard to query | Use PostgreSQL JSONB + partial indexes |
| React Flow for graph exploration | Wrong abstraction — built for workflow editors, not networks | Use Cytoscape.js |
| D3.js from scratch | Too low-level, reinvents what Cytoscape provides | Use Cytoscape.js or React Flow (if editing) |
| DOM/SVG-based graph rendering | Cannot handle scale — SVG chokes at 500+ nodes, DOM overhead is high | Use Canvas-based renderer (Cytoscape.js uses Canvas) or WebGL (Sigma.js) |
| Weighted-sum hybrid fusion | Fragile, requires tuning per dataset | Use Reciprocal Rank Fusion (RRF) |
| Dedicated vector database (Pinecone, Weaviate) | Adds operational complexity; pgvector is sufficient at VM2's scale | Optimize pgvector HNSW |

## Feature Dependencies

```
LiteLLM integration --> Provider registry UI (dynamic model lists)
TEI embedding service --> Advanced semantic search --> Reranker stage
TEI embedding service --> pgvector HNSW index --> Hybrid search (RRF)
Dynamic memory types --> Project-scoped type registry --> Extraction prompt updates
Cytoscape.js graph --> /api/graph endpoint (existing) --> Memory detail page
```

## MVP Recommendation

Prioritize:
1. **LiteLLM provider gateway** — Unblocks all LLM-dependent features
2. **Cytoscape.js graph view** — Highest user-visible impact for UX-02
3. **TEI embedding service with BGE-M3** — Fixes event-loop blocking + improves search quality
4. **HNSW index on pgvector** — Low-effort, high-performance gain

Defer:
- **Reranker stage**: Add only if baseline HNSW+RRF retrieval is insufficient
- **Dynamic memory types**: Requires UX design for type editor; can ship with hardcoded types + metadata JSONB first
- **Halfvec / binary quantization**: Only needed if scaling beyond ~100K memories

## Sources

- `PROJECT.md` requirements (PROV-*, UX-*, ML-*, ARCH-*, SYS-*)
- `litellm-integration-RESEARCH.md` provider analysis
- pgvector v0.8.2 documentation on HNSW and hybrid search
- Cytoscape.js extension ecosystem documentation
