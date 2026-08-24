"""
Embedding client — uses sentence-transformers in-process.
Falls back gracefully to zero vectors if the model isn't available.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from functools import lru_cache

import numpy as np

# Cap native thread pools BEFORE torch imports — oversubscription inside the
# Docker Desktop VM makes every encode ~10x slower than necessary.
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

logger = logging.getLogger(__name__)

EMBED_DIM = 384
_model = None


def _load_model():
    """Lazy-load the embedding model (downloaded once, cached in Docker layer)."""
    global _model
    if _model is not None:
        return _model
    t0 = time.perf_counter()
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model BAAI/bge-small-en-v1.5 ...")
        _model = SentenceTransformer("BAAI/bge-small-en-v1.5")
        # Env-var caps alone can be too late if torch was imported earlier;
        # enforce at runtime and log the effective value.
        try:
            import torch
            torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "2")))
            logger.info("torch threads = %d", torch.get_num_threads())
        except Exception:
            pass
        logger.info("Embedding model loaded in %.1fs", time.perf_counter() - t0)
    except Exception as e:
        logger.error("Failed to load embedding model: %s — using zero vectors", e)
        _model = None
    return _model


async def embed_text(text: str) -> list[float]:
    """Embed a single text string. Returns a 384-dim vector."""
    model = _load_model()
    if model is None:
        logger.warning("Embedding model unavailable — returning zero vector")
        return [0.0] * EMBED_DIM
    try:
        # sentence-transformers is sync; offload to threadpool to avoid blocking event loop
        vec = await asyncio.to_thread(model.encode, text, normalize_embeddings=True)
        return vec.tolist()
    except Exception as e:
        logger.error("Embedding failed (returning zero vector): %s", e)
        return [0.0] * EMBED_DIM


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one batch."""
    model = _load_model()
    if model is None:
        logger.warning("Embedding model unavailable — returning zero vectors for batch of %d", len(texts))
        return [[0.0] * EMBED_DIM for _ in texts]
    try:
        vecs = await asyncio.to_thread(model.encode, texts, normalize_embeddings=True, batch_size=32)
        return [v.tolist() for v in vecs]
    except Exception as e:
        logger.error("Batch embedding failed (returning zero vectors): %s", e)
        return [[0.0] * EMBED_DIM for _ in texts]
