"""Reciprocal Rank Fusion (RRF) for combining multiple ranked retrieval result sets."""

from typing import Any, Dict, List, Tuple


def reciprocal_rank_fusion(
    ranked_lists: Dict[str, List[Tuple[str, float]]],
    k: int = 60,
) -> List[Dict[str, Any]]:
    """Calculates fused rankings across multiple result sets using Reciprocal Rank Fusion.

    Formula:
        RRF_Score(item) = sum_{source}( 1.0 / (k + rank_source(item)) )

    where rank is 1-indexed (top item has rank 1).

    Args:
        ranked_lists: Dictionary mapping source_name (e.g. 'vector', 'bm25') to a list of
                      (chunk_id, original_score) tuples ordered by rank.
        k: Smoothing constant (default: 60).

    Returns:
        List of dictionaries sorted descending by fused_score:
        [
            {
                "chunk_id": str,
                "fused_score": float,
                "stage_ranks": {"vector": int, "bm25": int},
                "stage_scores": {"vector": float, "bm25": float},
            },
            ...
        ]
    """
    scores: Dict[str, float] = {}
    stage_ranks: Dict[str, Dict[str, int]] = {}
    stage_scores: Dict[str, Dict[str, float]] = {}

    for source_name, items in ranked_lists.items():
        for rank_idx, (chunk_id, orig_score) in enumerate(items, start=1):
            if chunk_id not in scores:
                scores[chunk_id] = 0.0
                stage_ranks[chunk_id] = {}
                stage_scores[chunk_id] = {}

            # Add RRF reciprocal rank score
            scores[chunk_id] += 1.0 / (k + rank_idx)
            stage_ranks[chunk_id][source_name] = rank_idx
            stage_scores[chunk_id][source_name] = float(orig_score)

    # Sort descending by fused score; on tie, preserve stable order by chunk_id
    sorted_items = sorted(
        scores.items(),
        key=lambda item: (-item[1], item[0]),
    )

    results = []
    for chunk_id, fused_score in sorted_items:
        results.append(
            {
                "chunk_id": chunk_id,
                "fused_score": fused_score,
                "stage_ranks": stage_ranks[chunk_id],
                "stage_scores": stage_scores[chunk_id],
            }
        )

    return results
