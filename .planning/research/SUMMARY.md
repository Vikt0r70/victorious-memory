# Research Summary: Victorious Memory V2 Stack Additions

**Domain:** AI Memory System (FastAPI + Next.js + PostgreSQL)
**Researched:** 2026-05-25
**Overall confidence:** HIGH

## Executive Summary

Victorious Memory V2 requires four major stack upgrades to reach its v1.1 milestone: (1) **LiteLLM** for provider abstraction, (2) **Cytoscape.js** for knowledge graph visualization, (3) **dynamic memory types** via PostgreSQL JSONB, and (4) **advanced RAG** with TEI-served embeddings and pgvector HNSW optimization. These changes are largely additive — no existing components need removal. The most impactful change is moving from in-process `sentence-transformers` to a dedicated **TEI embedding service** with a hybrid model (BGE-M3), which simultaneously improves retrieval quality and eliminates the asyncio event-loop blocking issue.

## Key Findings

**Stack:** LiteLLM + Cytoscape.js + TEI (BGE-M3) + pgvector 0.8.2 + JSONB dynamic schema
**Architecture:** Two-stage retrieval (HNSW + RRF → reranker) with separate TEI inference container
**Critical pitfall:** In-process embedding models block the event loop; moving to TEI is not optional for production readiness

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Provider Architecture (Phase 2)** — LiteLLM integration, unified registry
   - Addresses: PROV-01 through PROV-08
   - Avoids: Hand-rolling provider adapters for each new endpoint

2. **Search & Embedding Infrastructure (Phase 3)** — TEI service, pgvector HNSW, BGE-M3
   - Addresses: ARCH-01, ARCH-03, SYS-01 (Docker deployment)
   - Avoids: Event-loop blocking, outdated embedding quality

3. **Dashboard & Graph Redesign (Phase 3/4)** — Cytoscape.js graph, full UI overhaul
   - Addresses: UX-01, UX-02, UX-03, UX-04
   - Avoids: Building custom canvas renderer or using workflow editors for network viz

4. **Memory Lifecycle & Types (Phase 4)** — Dynamic types, decay, consolidation, conflict detection
   - Addresses: ML-01, ML-02, ML-03, ARCH-04
   - Avoids: EAV anti-pattern by using JSONB + registry table

5. **Advanced RAG & Reranking (Phase 5)** — Cross-encoder reranker, query expansion
   - Addresses: ARCH-01, ARCH-03
   - Avoids: Naive weighted-sum fusion in favor of RRF

**Phase ordering rationale:**
- Provider architecture must come first because extraction, search, and graph all depend on LLM calls.
- Embedding infrastructure is next because it unblocks search improvements and is a deployment prerequisite.
- Dashboard redesign can parallelize with backend work but needs graph data endpoints.
- Memory lifecycle features require the dashboard to be functional for user interaction.
- Advanced RAG (reranking) is last because it requires evaluation infrastructure to measure improvement.

**Research flags for phases:**
- Phase 3 (TEI): Needs GPU/CPU testing on target hardware; BGE-M3 requires ~2GB VRAM or ~4GB RAM
- Phase 4 (Dynamic types): Needs user research on what custom fields users actually want
- Phase 5 (Reranking): Needs retrieval evaluation dataset to validate improvement over baseline

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against official docs, PyPI, npm, Docker Hub |
| Features | HIGH | Derived directly from PROJECT.md requirements |
| Architecture | HIGH | Patterns documented in official pgvector, TEI, Cytoscape docs |
| Pitfalls | HIGH | Based on documented anti-patterns and VM2's known issues |

## Gaps to Address

- **Hardware requirements for TEI:** Exact CPU inference latency for BGE-M3 on a typical developer laptop needs benchmarking.
- **Cytoscape.js React SSR:** Next.js 16 App Router may need `'use client'` or dynamic imports for Cytoscape to avoid SSR issues.
- **Reranker integration:** TEI's support for reranker models (not just embeddings) needs verification — may require a separate reranker service or in-process cross-encoder.
- **Embedding migration:** Plan for re-embedding all existing memories when switching from 384-dim bge-small to 1024-dim BGE-M3.
