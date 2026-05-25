"""BM25 ranking for keyword-based search."""

from __future__ import annotations

import math
import re

# ---------------------------------------------------------------------------
# Stopwords (~100 common English words)
# ---------------------------------------------------------------------------

STOPWORDS: set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an",
    "and", "any", "are", "aren't", "as", "at", "be", "because", "been",
    "before", "being", "below", "between", "both", "but", "by", "can",
    "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "get", "got", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't",
    "it", "it's", "its", "itself", "just", "let's", "me", "might", "more",
    "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
    "out", "over", "own", "same", "shan't", "she", "should", "shouldn't",
    "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
    "themselves", "then", "there", "these", "they", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
    "we", "were", "weren't", "what", "when", "where", "which", "while",
    "who", "whom", "why", "will", "with", "won't", "would", "wouldn't",
    "you", "your", "yours", "yourself", "yourselves",
}

_SPLIT_RE = re.compile(r"[^a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric chars, remove stopwords."""
    return [
        tok
        for tok in _SPLIT_RE.split(text.lower())
        if tok and tok not in STOPWORDS
    ]


def bm25_rank(
    query: str,
    documents: list[tuple[str, str]],
    *,
    k1: float = 1.5,
    b: float = 0.75,
) -> list[tuple[str, float]]:
    """Rank documents against *query* using BM25.

    Parameters
    ----------
    query:
        The search query string.
    documents:
        List of ``(doc_id, doc_text)`` tuples.

    Returns
    -------
    List of ``(doc_id, score)`` tuples sorted by score descending.
    Scores are normalised to the range ``[0, 1]``.
    """
    if not documents:
        return []

    query_tokens = _tokenize(query)
    if not query_tokens:
        return [(doc_id, 0.0) for doc_id, _ in documents]

    # Tokenise all documents
    doc_tokens: list[list[str]] = [_tokenize(text) for _, text in documents]
    doc_lengths = [len(dt) for dt in doc_tokens]
    n = len(documents)
    avgdl = sum(doc_lengths) / n if n else 1.0

    # Document frequency for each query term
    df: dict[str, int] = {}
    for qt in query_tokens:
        count = sum(1 for dt in doc_tokens if qt in dt)
        df[qt] = count

    # Score each document
    raw_scores: list[float] = []
    for idx, dt in enumerate(doc_tokens):
        score = 0.0
        dl = doc_lengths[idx]

        # Build term frequency map for this document
        tf_map: dict[str, int] = {}
        for t in dt:
            tf_map[t] = tf_map.get(t, 0) + 1

        for qt in query_tokens:
            tf = tf_map.get(qt, 0)
            if tf == 0:
                continue
            d = df[qt]
            idf = math.log((n - d + 0.5) / (d + 0.5) + 1.0)
            numerator = tf * (k1 + 1.0)
            denominator = tf + k1 * (1.0 - b + b * dl / avgdl)
            score += idf * numerator / denominator

        raw_scores.append(score)

    # Normalise to [0, 1]
    max_score = max(raw_scores) if raw_scores else 1.0
    if max_score > 0:
        normed = [s / max_score for s in raw_scores]
    else:
        normed = [0.0] * len(raw_scores)

    results = [
        (documents[i][0], normed[i])
        for i in range(n)
    ]
    results.sort(key=lambda r: r[1], reverse=True)
    return results
