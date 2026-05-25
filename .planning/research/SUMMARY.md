# Research Summary: Victorious Memory V2 Stack Additions

**Domain:** AI Memory System (FastAPI + Next.js + PostgreSQL)
**Researched:** 2026-05-25
**Overall confidence:** HIGH

## Executive Summary

Victorious Memory V2 requires four major stack upgrades to reach its v1.1 milestone: (1) **LiteLLM** for provider abstraction, (2) **force-graph** for organic knowledge graph visualization, (3) **dynamic memory types** via PostgreSQL JSONB, and (4) **simple RAG** with TEI-served embeddings and pgvector HNSW. These changes are largely additive — no existing components need removal. The most impactful change is moving from in-process `sentence-transformers` to a dedicated **TEI embedding service**, which eliminates the asyncio event-loop blocking issue.

**Key corrections from user review:**
- RAG: Single-stage dense vector search (not multi-stage pipeline)
- Graph: force-graph with Canvas renderer (not Cytoscape.js)
- Health checks: Error-at-failure (not background pinging)
- LiteLLM: Direct `litellm.acompletion()` (not custom adapters)

## Key Findings

**Stack:** LiteLLM + force-graph + TEI (BGE-M3) + pgvector 0.8.2 + JSONB dynamic schema
**Architecture:** Single-stage retrieval (pgvector HNSW cosine similarity) with separate TEI inference container
**Critical pitfall:** In-process embedding models block the event loop; moving to TEI is not optional for production readiness

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Provider Architecture (Phase 1)** — LiteLLM integration, unified registry
   - Addresses: PROV-01 through PROV-08
   - Avoids: Hand-rolling provider adapters; use `litellm.acompletion()` directly

2. **Search & Embedding Infrastructure (Phase 1)** — TEI service, pgvector HNSW
   - Addresses: ARCH-01, ARCH-03, SYS-01 (Docker deployment)
   - Avoids: Event-loop blocking, multi-stage RAG complexity

3. **Dashboard & Graph Redesign (Phase 2)** — force-graph, full UI overhaul
   - Addresses: UX-01, UX-02, UX-03, UX-04
   - Avoids: Rigid enterprise graph visualization; delivers organic Obsidian-like experience

4. **Memory Lifecycle & Types (Phase 3)** — Dynamic types, decay, consolidation, conflict detection
   - Addresses: ML-01, ML-02, ML-03, ARCH-04
   - Avoids: EAV anti-pattern by using JSONB + registry table

5. **Deployment & Documentation (Phase 4)** — Docker, npm, MCP, CI/CD, docs
   - Addresses: SYS-02, SYS-03, SYS-04, SYS-05, SYS-06, SYS-07
   - Avoids: Background health checks; use error-at-failure fallback

6. **Architecture Excellence (Phase 5)** — RAG optimization, graph tuning, dynamic types
   - Addresses: ARCH-01, ARCH-02, ARCH-03, ARCH-04
   - Avoids: Over-engineering; single-stage search is sufficient

**Phase ordering rationale:**
- Provider architecture must come first because extraction, search, and graph all depend on LLM calls.
- Embedding infrastructure is next because it unblocks search improvements and is a deployment prerequisite.
- Dashboard redesign can parallelize with backend work but needs graph data endpoints.
- Memory lifecycle features require the dashboard to be functional for user interaction.
- Deployment and documentation are best done after core features are stable.
- Architecture excellence is last because it builds on working foundations.

**Research flags for phases:**
- Phase 1 (TEI): Needs GPU/CPU testing on target hardware; BGE-M3 requires ~2GB VRAM or ~4GB RAM
- Phase 3 (Dynamic types): Needs user research on what custom fields users actually want
- Phase 5 (Architecture): Simple HNSW baseline must be proven before any advanced optimization

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against official docs, PyPI, npm, Docker Hub |
| Features | HIGH | Derived directly from PROJECT.md requirements |
| Architecture | HIGH | Patterns documented in official pgvector, TEI, force-graph docs |
| Pitfalls | HIGH | Based on documented anti-patterns and VM2's known issues |

## Gaps to Address

- **Hardware requirements for TEI:** Exact CPU inference latency for BGE-M3 on a typical developer laptop needs benchmarking.
- **force-graph React SSR:** Next.js 16 App Router needs dynamic imports for Canvas-based libraries to avoid SSR issues.
- **Embedding migration:** Plan for re-embedding all existing memories when switching from 384-dim bge-small to 1024-dim BGE-M3 (user confirmed: start fresh, all data is test data).
