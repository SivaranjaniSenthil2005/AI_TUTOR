"""Query expansion (multi-query retrieval) and RRF fusion for AI Tutor.

Produces alternative curriculum phrasings (textbook syllabus style & keyword style),
retrieves candidates across variants concurrently, fuses them with RRF, and performs
a single final cross-encoder reranking against the original standalone query.
"""

import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

from app.config import settings
from app.llm.router import get_llm_router
from app.rag.schemas import Chunk, RetrievalFilters, RetrievalResult, ScoredChunk
from app.rag.retriever import get_hybrid_retriever, deduplicate_and_cap_diversity
from app.rag.fusion import reciprocal_rank_fusion
from app.rag.block_policy import apply_block_policy
from app.rag.reranker import get_reranker_model

logger = logging.getLogger("ai_tutor.rag.query.expand")

EXPAND_SYSTEM_PROMPT = """You are a Class 10 curriculum retrieval assistant.
Given a student query, generate up to 2 alternative search phrasings to maximize textbook retrieval coverage:
1. A formal textbook syllabus phrasing using curriculum terminology.
2. A dense keyword / scientific terms phrasing.

Output strictly JSON in this format:
{
  "variants": ["phrasing 1", "phrasing 2"]
}"""


async def expand_query(
    standalone_query: str,
    subject: str,
    max_variants: int = 2,
    provider_override: Optional[str] = None,
    force_mock: bool = False,
) -> List[str]:
    """Generate up to max_variants alternative search queries using LLM.

    Returns an empty list if expansion is disabled, times out, or fails.
    """
    mode = getattr(settings, "REWRITE_MODE", "auto").lower()
    fast_mode = getattr(settings, "FAST_MODE", False)

    if mode == "off" or fast_mode or max_variants <= 0:
        return []

    messages = [
        {"role": "system", "content": EXPAND_SYSTEM_PROMPT},
        {"role": "user", "content": f"Subject: {subject}\nQuery: {standalone_query}"},
    ]

    try:
        router = get_llm_router()
        timeout = getattr(settings, "EXPAND_TIMEOUT_SECONDS", 5.0)

        res = await router.generate(
            messages=messages,
            chunks=None,
            provider_override=provider_override,
            force_mock=force_mock,
            timeout_seconds=timeout,
            temperature=0.2,
            max_tokens=100,
        )

        content = res.get("content", "").strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        data = json.loads(content)
        variants = data.get("variants", [])
        if isinstance(variants, list):
            cleaned_variants = [
                v.strip() for v in variants if isinstance(v, str) and v.strip() and v.strip().lower() != standalone_query.lower()
            ]
            return cleaned_variants[:max_variants]

    except Exception as exc:
        logger.debug(f"Query expansion skipped or failed: {exc}")

    return []


async def retrieve_with_multiquery(
    standalone_query: str,
    filters: RetrievalFilters,
    variants: Optional[List[str]] = None,
    mode: str = "hybrid_rerank",
    top_k: int = 5,
) -> RetrievalResult:
    """Execute concurrent multi-query retrieval, fuse results with RRF, and rerank against standalone query."""
    retriever = get_hybrid_retriever()
    queries = [standalone_query] + (variants or [])

    # If only 1 query (no variants), delegate to standard hybrid retrieval
    if len(queries) == 1:
        return await asyncio.to_thread(
            retriever.retrieve,
            query=standalone_query,
            filters=filters,
            mode=mode,
            top_k=top_k,
        )

    t_start = time.perf_counter()

    # Retrieve concurrently for each query variant
    # We retrieve in 'hybrid' mode (fused candidates before reranking) for each query
    tasks = [
        asyncio.to_thread(
            retriever.retrieve,
            query=q,
            filters=filters,
            mode="hybrid",
            top_k=settings.TOP_K_FUSED,
        )
        for q in queries
    ]
    results: List[RetrievalResult] = await asyncio.gather(*tasks)

    # Build ranked lists for Multi-Query Reciprocal Rank Fusion
    ranked_lists: Dict[str, List[Any]] = {}
    chunk_map: Dict[str, Chunk] = {}

    for idx, res in enumerate(results):
        q_label = f"variant_{idx}"
        ranked_lists[q_label] = []
        for scored in res.chunks:
            cid = scored.chunk.chunk_id
            chunk_map[cid] = scored.chunk
            ranked_lists[q_label].append((cid, scored.score))

    # Perform multi-query RRF
    fused_items = reciprocal_rank_fusion(ranked_lists, k=settings.RRF_K)

    scored_candidates: List[ScoredChunk] = []
    for idx, item in enumerate(fused_items, start=1):
        cid = item["chunk_id"]
        if cid in chunk_map:
            scored_candidates.append(
                ScoredChunk(
                    chunk=chunk_map[cid],
                    score=item["fused_score"],
                    rank=idx,
                    stage_scores=item["stage_scores"],
                    stage_ranks=item["stage_ranks"],
                )
            )

    # Apply block type policy and diversity capping
    scored_candidates = apply_block_policy(
        scored_candidates, include_exercises=filters.include_exercises
    )
    scored_candidates = deduplicate_and_cap_diversity(scored_candidates)

    # Final single cross-encoder rerank against the ORIGINAL standalone query
    rerank_candidates = scored_candidates[: settings.TOP_K_FUSED]
    reranker = get_reranker_model()
    final_chunks = reranker.rerank(
        query=standalone_query,
        candidates=rerank_candidates,
        top_k=top_k,
    )

    for idx, item in enumerate(final_chunks, start=1):
        item.rank = idx

    total_ms = (time.perf_counter() - t_start) * 1000.0

    return RetrievalResult(
        query=standalone_query,
        mode="multi_query_rerank",
        filters=filters,
        chunks=final_chunks,
        total_candidates=len(chunk_map),
        timings_ms={"multi_query_total_ms": round(total_ms, 2)},
    )
