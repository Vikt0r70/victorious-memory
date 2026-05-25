"""
Embedding client — uses sentence-transformers in-process.
Falls back gracefully to zero vectors if the model isn't available.
"""

from __future__ import annotations

import logging
from functools import lru_cache

import numpy as np

logger = logging.getLogger(__name__)

EMBED_DIM = 384
_model = None


def _load_model():
    """Lazy-load the embedding model (downloaded once, cached in Docker layer)."""
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model BAAI/bge-small-en-v1.5 ...")
        _model = SentenceTransformer("BAAI/bge-small-en-v1.5")
        logger.info("Embedding model loaded.")
    except Exception as e:
        logger.error("Failed to load embedding model: %s — using zero vectors", e)
        _model = None
    return _model


async def embed_text(text: str) -> list[float]:
    """Embed a single text string. Returns a 384-dim vector."""
    model = _load_model()
    if model is None:
        return [0.0] * EMBED_DIM
    try:
        # sentence-transformers is sync; run directly (worker is async but this is fast)
        vec = model.encode(text, normalize_embeddings=True)
        return vec.tolist()
    except Exception as e:
        logger.error("Embedding failed: %s", e)
        return [0.0] * EMBED_DIM


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one batch."""
    model = _load_model()
    if model is None:
        return [[0.0] * EMBED_DIM for _ in texts]
    try:
        vecs = model.encode(texts, normalize_embeddings=True, batch_size=32)
        return [v.tolist() for v in vecs]
    except Exception as e:
        logger.error("Batch embedding failed: %s", e)
        return [[0.0] * EMBED_DIM for _ in texts]
