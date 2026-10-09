"""Hybrid retriever orchestrating vector search, BM25 keyword search, RRF, and cross-encoder reranking."""

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Set
from app.config import settings
from app.rag.schemas import (
    Chunk,
    RetrievalFilters,
    RetrievalResult,
    ScoredChunk,
)
from app.rag.embeddings import get_embedding_model
from app.rag.vector_store import get_vector_store
from app.rag.keyword_index import get_keyword_index
from app.rag.fusion import reciprocal_rank_fusion
from app.rag.block_policy import apply_block_policy
from app.rag.reranker import get_reranker_model
from app.rag.privacy import log_query

logger = logging.getLogger("ai_tutor.rag.retriever")


def deduplicate_and_cap_diversity(
    candidates: List[ScoredChunk],
    max_per_section: int = 2,
) -> List[ScoredChunk]:
    """Removes duplicate chunk texts and caps chunks at max_per_section per section for diversity."""
    seen_texts: Set[str] = set()
    section_counts: Dict[str, int] = {}
    diversified: List[ScoredChunk] = []

    for item in candidates:
        text_normalized = " ".join(item.chunk.text.split()).lower()
        if text_normalized in seen_texts:
            continue
        seen_texts.add(text_normalized)

        # Section diversity capping
        sec_key = (
            f"{item.chunk.chapter_no or 0}:{item.chunk.section_title or 'default'}"
            if item.chunk.section_title
            else None
        )
        if sec_key is not None:
            count = section_counts.get(sec_key, 0)
            if count >= max_per_section:
                continue
            section_counts[sec_key] = count + 1

        diversified.append(item)

    return diversified


class HybridRetriever:
    """Orchestrates hybrid vector + BM25 retrieval with RRF and cross-encoder reranking."""

    def __init__(
        self,
        vector_k: Optional[int] = None,
        bm25_k: Optional[int] = None,
        fused_k: Optional[int] = None,
        final_k: Optional[int] = None,
        rrf_k: Optional[int] = None,
    ):
        self.vector_k = vector_k or getattr(settings, "TOP_K_VECTOR", 20)
        self.bm25_k = bm25_k or getattr(settings, "TOP_K_BM25", 20)
        self.fused_k = fused_k or getattr(settings, "TOP_K_FUSED", 20)
        self.final_k = final_k or getattr(settings, "TOP_K_FINAL", 5)
        self.rrf_k = rrf_k or getattr(settings, "RRF_K", 60)

    def retrieve(
        self,
        query: str,
        filters: RetrievalFilters,
        mode: str = "hybrid_rerank",
        top_k: Optional[int] = None,
        include_debug_trace: bool = False,
    ) -> RetrievalResult:
        """Executes retrieval according to the specified mode.

        Supported modes:
            - 'vector_only'
            - 'bm25_only'
            - 'hybrid'
            - 'hybrid_rerank' (default)
        """
        start_time = time.perf_counter()
        target_k = top_k or self.final_k
        timings: Dict[str, float] = {}
        debug_trace: Dict[str, Any] = {
            "mode": mode,
            "vector_candidates": [],
            "bm25_candidates": [],
            "fused_candidates": [],
            "reranked_candidates": [],
        }

        filters_summary = f"{filters.board}/c{filters.class_level}/{filters.subject}"
        log_query(query, filters_summary=filters_summary, mode=mode)

        vector_results: List[Tuple[Chunk, float, int]] = []
        bm25_results: List[Tuple[Chunk, float, int]] = []

        # Step 1: Execute search stages (in parallel when both needed)
        def run_vector_search():
            t0 = time.perf_counter()
            embed_model = get_embedding_model()
            q_emb = embed_model.embed_query(query)
            vstore = get_vector_store()
            res = vstore.query_vector(q_emb, filters, top_k=self.vector_k)
            t_vec = (time.perf_counter() - t0) * 1000.0
            return res, t_vec

        def run_bm25_search():
            t0 = time.perf_counter()
            k_index = get_keyword_index()
            res = k_index.search(query, filters, top_k=self.bm25_k)
            t_b25 = (time.perf_counter() - t0) * 1000.0
            return res, t_b25

        if mode in ("vector_only",):
            vector_results, timings["vector_ms"] = run_vector_search()
        elif mode in ("bm25_only",):
            bm25_results, timings["bm25_ms"] = run_bm25_search()
        else:
            # Parallel execution for hybrid search
            with ThreadPoolExecutor(max_workers=2) as executor:
                future_vec = executor.submit(run_vector_search)
                future_bm25 = executor.submit(run_bm25_search)
                vector_results, timings["vector_ms"] = future_vec.result()
                bm25_results, timings["bm25_ms"] = future_bm25.result()

        # Debug trace for vector stage
        chunk_map: Dict[str, Chunk] = {}
        for c, score, rank in vector_results:
            chunk_map[c.chunk_id] = c
            debug_trace["vector_candidates"].append(
                {"chunk_id": c.chunk_id, "score": score, "rank": rank}
            )

        # Debug trace for BM25 stage
        for c, score, rank in bm25_results:
            chunk_map[c.chunk_id] = c
            debug_trace["bm25_candidates"].append(
                {"chunk_id": c.chunk_id, "score": score, "rank": rank}
            )

        # Step 2: Combine candidates based on mode
        scored_candidates: List[ScoredChunk] = []

        if mode == "vector_only":
            for c, score, rank in vector_results:
                scored_candidates.append(
                    ScoredChunk(
                        chunk=c,
                        score=score,
                        rank=rank,
                        stage_scores={"vector": score},
                        stage_ranks={"vector": rank},
                    )
                )
            scored_candidates = apply_block_policy(
                scored_candidates, include_exercises=filters.include_exercises
            )
            scored_candidates = deduplicate_and_cap_diversity(scored_candidates)
            final_chunks = scored_candidates[:target_k]

        elif mode == "bm25_only":
            for c, score, rank in bm25_results:
                scored_candidates.append(
                    ScoredChunk(
                        chunk=c,
                        score=score,
                        rank=rank,
                        stage_scores={"bm25": score},
                        stage_ranks={"bm25": rank},
                    )
                )
            scored_candidates = apply_block_policy(
                scored_candidates, include_exercises=filters.include_exercises
            )
            scored_candidates = deduplicate_and_cap_diversity(scored_candidates)
            final_chunks = scored_candidates[:target_k]

        else:
            # Hybrid / Hybrid Rerank mode: Apply RRF
            t_fusion_start = time.perf_counter()
            ranked_lists = {
                "vector": [(c.chunk_id, score) for c, score, _ in vector_results],
                "bm25": [(c.chunk_id, score) for c, score, _ in bm25_results],
            }
            fused = reciprocal_rank_fusion(ranked_lists, k=self.rrf_k)
            timings["fusion_ms"] = (time.perf_counter() - t_fusion_start) * 1000.0

            for idx, item in enumerate(fused, start=1):
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
                    debug_trace["fused_candidates"].append(
                        {
                            "chunk_id": cid,
                            "fused_score": item["fused_score"],
                            "stage_ranks": item["stage_ranks"],
                            "rank": idx,
                        }
                    )

            # Apply block policy (exercise exclusion, summary/glossary boost)
            scored_candidates = apply_block_policy(
                scored_candidates, include_exercises=filters.include_exercises
            )
            # Deduplicate & cap diversity
            scored_candidates = deduplicate_and_cap_diversity(scored_candidates)

            if mode == "hybrid":
                final_chunks = scored_candidates[:target_k]
            else:
                # hybrid_rerank (default)
                t_rerank_start = time.perf_counter()
                rerank_candidates = scored_candidates[: self.fused_k]
                reranker = get_reranker_model()
                final_chunks = reranker.rerank(
                    query=query,
                    candidates=rerank_candidates,
                    top_k=target_k,
                )
                timings["rerank_ms"] = (time.perf_counter() - t_rerank_start) * 1000.0

                for item in final_chunks:
                    debug_trace["reranked_candidates"].append(
                        {
                            "chunk_id": item.chunk.chunk_id,
                            "score": item.score,
                            "rank": item.rank,
                        }
                    )

        # Update ranks 1..N on final return
        for idx, item in enumerate(final_chunks, start=1):
            item.rank = idx

        timings["total_ms"] = (time.perf_counter() - start_time) * 1000.0
        debug_trace["timings_ms"] = timings

        return RetrievalResult(
            query=query,
            mode=mode,
            filters=filters,
            chunks=final_chunks,
            total_candidates=len(chunk_map),
            timings_ms=timings,
            debug_trace=debug_trace if include_debug_trace else None,
        )


_retriever_instance: Optional[HybridRetriever] = None


def get_hybrid_retriever() -> HybridRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = HybridRetriever()
    return _retriever_instance
