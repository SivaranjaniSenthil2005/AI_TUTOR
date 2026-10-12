"""Adaptive routing and soft chapter filtering for AI Tutor.

Features:
- Dynamically resolves subject and chapter filters.
- Enforces SOFT chapter preferences: searches targeted chapter first; if relevance score
  is below SOFT_CHAPTER_THRESHOLD or empty, automatically widens search to the entire subject.
- Prevents students from getting hard-locked in the wrong chapter when asking cross-chapter questions.
"""

import logging
from typing import List, Optional, Tuple

from app.config import settings
from app.rag.schemas import RetrievalFilters, RetrievalResult
from app.rag.query.expand import retrieve_with_multiquery

logger = logging.getLogger("ai_tutor.rag.query.routing")


def resolve_filters(
    board: str,
    subject: str,
    request_chapter_no: Optional[int] = None,
    active_chapter_no: Optional[int] = None,
    subject_hint: Optional[str] = None,
) -> Tuple[RetrievalFilters, bool]:
    """Resolve initial retrieval filters and determine whether a soft chapter preference applies."""
    final_subject = subject
    if not final_subject and subject_hint:
        final_subject = subject_hint

    effective_chapter = request_chapter_no if request_chapter_no is not None else active_chapter_no
    has_chapter_preference = effective_chapter is not None

    filters = RetrievalFilters(
        board=board,
        class_level=10,
        subject=final_subject,
        chapter_no=effective_chapter,
        include_exercises=False,
    )
    return filters, has_chapter_preference


async def execute_routed_retrieval(
    standalone_query: str,
    filters: RetrievalFilters,
    variants: Optional[List[str]] = None,
    mode: str = "hybrid_rerank",
    top_k: int = 5,
    soft_threshold: Optional[float] = None,
) -> Tuple[RetrievalResult, bool]:
    """Execute retrieval with soft chapter widening if relevance falls below threshold.

    Returns:
        (RetrievalResult, widened_flag: bool)
    """
    threshold = soft_threshold if soft_threshold is not None else getattr(settings, "SOFT_CHAPTER_THRESHOLD", -4.0)

    # 1. Execute initial retrieval (may have chapter filter)
    result = await retrieve_with_multiquery(
        standalone_query=standalone_query,
        filters=filters,
        variants=variants,
        mode=mode,
        top_k=top_k,
    )

    # If no chapter filter was set, no widening needed
    if filters.chapter_no is None:
        return result, False

    # Check best reranker score
    best_score = result.chunks[0].score if result.chunks else float("-inf")

    # If relevance satisfies threshold, keep chapter-targeted results
    if result.chunks and best_score >= threshold:
        return result, False

    # Otherwise, chapter relevance is weak or empty: WIDEN to entire subject
    logger.info(
        f"Soft chapter filter widened: chapter {filters.chapter_no} best score was {best_score:.2f} "
        f"(below threshold {threshold}). Widening retrieval to full subject '{filters.subject}'."
    )
    widened_filters = filters.model_copy(update={"chapter_no": None})

    widened_result = await retrieve_with_multiquery(
        standalone_query=standalone_query,
        filters=widened_filters,
        variants=variants,
        mode=mode,
        top_k=top_k,
    )
    return widened_result, True
