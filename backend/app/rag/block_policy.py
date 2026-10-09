"""Block type policy for filtering and boosting chunks during retrieval."""

from typing import List
from app.config import settings
from app.rag.schemas import ScoredChunk


def apply_block_policy(
    candidates: List[ScoredChunk],
    include_exercises: bool = False,
    summary_boost: float = None,
    glossary_boost: float = None,
) -> List[ScoredChunk]:
    """Applies block type filtering (excluding exercises by default) and score boosts.

    - Excludes 'exercise' block types unless include_exercises is True.
    - Boosts 'summary' and 'glossary' block types by configurable multipliers (applied after fusion).
    - Keeps 'activity' and 'content' blocks intact.
    """
    if summary_boost is None:
        summary_boost = getattr(settings, "SUMMARY_BOOST_MULTIPLIER", 1.15)
    if glossary_boost is None:
        glossary_boost = getattr(settings, "GLOSSARY_BOOST_MULTIPLIER", 1.15)

    filtered: List[ScoredChunk] = []

    for item in candidates:
        block_type = (item.chunk.block_type or "content").lower().strip()

        # Exclude exercises if not explicitly requested
        if block_type == "exercise" and not include_exercises:
            continue

        score = item.score
        if block_type == "summary":
            score *= summary_boost
        elif block_type == "glossary":
            score *= glossary_boost

        updated_chunk = item.model_copy(deep=True)
        updated_chunk.score = score
        filtered.append(updated_chunk)

    # Re-sort candidates after applying boosts
    filtered.sort(key=lambda x: -x.score)
    for idx, item in enumerate(filtered, start=1):
        item.rank = idx

    return filtered
