"""Tutor answering orchestration service for AI Tutor.

Coordinates:
1. Class 10 scope enforcement
2. Input sanitization & safety guardrails
3. Phase 9 Hybrid Retrieval (ChromaDB + BM25 + RRF + Cross-Encoder)
4. No-context shortcut (prevents hallucination & saves cost)
5. Prompt construction with injection defense
6. Multi-provider LLM Router with automatic failover
7. Citation parsing & grounding verification
"""

import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
from app.config import settings
from app.scope import validate_scope
from app.schemas import (
    AnswerLatency,
    AnswerResult,
    SourceCitation,
)
from app.rag.schemas import RetrievalFilters
from app.rag.retriever import get_hybrid_retriever
from app.llm.guardrails import (
    sanitize_question,
    check_educational_safety,
    evaluate_context_relevance,
)
from app.llm.prompts import build_tutor_messages
from app.llm.citations import extract_citations
from app.llm.router import get_llm_router

logger = logging.getLogger("ai_tutor.services.answer")


def _format_candidate_sources(chunks: List[Any]) -> List[SourceCitation]:
    """Build candidate SourceCitation list from retrieved chunks."""
    candidates = []
    for idx, c in enumerate(chunks, start=1):
        text_full = getattr(c, "text", "")
        snippet = text_full[:200] + "..." if len(text_full) > 200 else text_full
        candidates.append(
            SourceCitation(
                citation_index=idx,
                chunk_id=getattr(c, "chunk_id", f"c_{idx}"),
                book_title=getattr(c, "book_title", ""),
                chapter_no=getattr(c, "chapter_no", None),
                chapter_title=getattr(c, "chapter_title", ""),
                section_title=getattr(c, "section_title", None),
                page_start=getattr(c, "page_start", 1),
                page_end=getattr(c, "page_end", 1),
                source_file=getattr(c, "source_file", ""),
                text_snippet=snippet,
            )
        )
    return candidates


async def answer_question(
    question: str,
    board: str,
    subject: str,
    chapter_no: Optional[int] = None,
    mode: Optional[str] = "hybrid_rerank",
    top_k: Optional[int] = None,
    provider_override: Optional[str] = None,
    force_mock: bool = False,
    style_instructions: Optional[str] = None,
) -> AnswerResult:
    """End-to-end question answering pipeline for Class 10 school students."""
    t_start = time.perf_counter()

    # 1. Enforce Class 10 scope (class is strictly fixed to 10)
    norm_board, norm_class, norm_subject = validate_scope(board=board, class_level=10, subject=subject)

    # 2. Sanitize student question
    clean_question = sanitize_question(question)

    # 3. Check safety guardrails
    safety_decline = check_educational_safety(clean_question)
    if safety_decline:
        duration_ms = (time.perf_counter() - t_start) * 1000
        return AnswerResult(
            answer=safety_decline,
            sources=[],
            grounded=True,
            provider="guardrail",
            model="safety-filter",
            latency_ms=AnswerLatency(retrieval=0.0, generation=0.0, total=round(duration_ms, 2)),
            usage={},
            mock=False,
        )

    # 4. Phase 9 Hybrid Retrieval
    t_ret_start = time.perf_counter()
    retriever = get_hybrid_retriever()
    filters = RetrievalFilters(
        board=norm_board,
        class_level=10,
        subject=norm_subject,
        chapter_no=chapter_no,
        include_exercises=False,
    )
    retrieval_k = top_k or settings.TOP_K_FINAL
    retrieval_res = retriever.retrieve(
        query=clean_question,
        filters=filters,
        mode=mode or "hybrid_rerank",
        top_k=retrieval_k,
    )
    retrieval_ms = (time.perf_counter() - t_ret_start) * 1000

    chunks = [item.chunk for item in retrieval_res.chunks]

    # 5. Guardrail: No-context shortcut (saves cost, avoids hallucination)
    no_context_msg = evaluate_context_relevance(
        chunks=retrieval_res.chunks,
        board=norm_board,
        subject=norm_subject,
    )
    if no_context_msg:
        duration_ms = (time.perf_counter() - t_start) * 1000
        return AnswerResult(
            answer=no_context_msg,
            sources=[],
            grounded=True,
            provider="guardrail",
            model="no-context-filter",
            latency_ms=AnswerLatency(
                retrieval=round(retrieval_ms, 2),
                generation=0.0,
                total=round(duration_ms, 2),
            ),
            usage={},
            mock=False,
            retrieval_debug={"total_candidates": retrieval_res.total_candidates} if settings.DEBUG_RETRIEVAL else None,
        )

    # 6. Build prompt with prompt-injection defense
    messages = build_tutor_messages(
        board=norm_board,
        subject=norm_subject,
        question=clean_question,
        chunks=chunks,
        style_instructions=style_instructions,
    )

    # 7. LLM Router with fallback & circuit breaking
    t_gen_start = time.perf_counter()
    router = get_llm_router()
    llm_res = await router.generate(
        messages=messages,
        chunks=chunks,
        provider_override=provider_override,
        force_mock=force_mock,
    )
    generation_ms = (time.perf_counter() - t_gen_start) * 1000

    raw_answer = llm_res.get("content", "")

    # 8. Extract citations and check grounding
    valid_sources, is_grounded = extract_citations(answer=raw_answer, chunks=chunks)

    total_ms = (time.perf_counter() - t_start) * 1000

    debug_info = None
    if settings.DEBUG_RETRIEVAL:
        debug_info = {
            "retrieval_timings": retrieval_res.timings_ms,
            "total_candidates": retrieval_res.total_candidates,
            "candidate_chunk_ids": [c.chunk_id for c in chunks],
        }

    return AnswerResult(
        answer=raw_answer,
        sources=valid_sources,
        grounded=is_grounded,
        provider=llm_res.get("provider", "unknown"),
        model=llm_res.get("model", "unknown"),
        latency_ms=AnswerLatency(
            retrieval=round(retrieval_ms, 2),
            generation=round(generation_ms, 2),
            total=round(total_ms, 2),
        ),
        usage=llm_res.get("usage", {}),
        mock=llm_res.get("mock", False),
        retrieval_debug=debug_info,
    )


async def stream_answer_question(
    question: str,
    board: str,
    subject: str,
    chapter_no: Optional[int] = None,
    mode: Optional[str] = "hybrid_rerank",
    top_k: Optional[int] = None,
    provider_override: Optional[str] = None,
    force_mock: bool = False,
    style_instructions: Optional[str] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """Streaming answer pipeline generating SSE events."""
    t_start = time.perf_counter()

    try:
        norm_board, norm_class, norm_subject = validate_scope(board=board, class_level=10, subject=subject)
    except Exception as e:
        yield {"event": "error", "data": {"message": str(e)}}
        return

    try:
        clean_question = sanitize_question(question)
    except ValueError as ve:
        yield {"event": "error", "data": {"message": str(ve)}}
        return

    safety_decline = check_educational_safety(clean_question)
    if safety_decline:
        yield {"event": "token", "data": {"delta": safety_decline}}
        duration_ms = (time.perf_counter() - t_start) * 1000
        yield {
            "event": "done",
            "data": {
                "sources": [],
                "grounded": True,
                "provider": "guardrail",
                "model": "safety-filter",
                "mock": False,
                "latency_ms": {"total": round(duration_ms, 2)},
            },
        }
        return

    # Retrieval stage
    t_ret_start = time.perf_counter()
    retriever = get_hybrid_retriever()
    filters = RetrievalFilters(
        board=norm_board,
        class_level=10,
        subject=norm_subject,
        chapter_no=chapter_no,
        include_exercises=False,
    )
    retrieval_k = top_k or settings.TOP_K_FINAL
    retrieval_res = retriever.retrieve(
        query=clean_question,
        filters=filters,
        mode=mode or "hybrid_rerank",
        top_k=retrieval_k,
    )
    retrieval_ms = (time.perf_counter() - t_ret_start) * 1000
    chunks = [item.chunk for item in retrieval_res.chunks]

    # No-context check
    no_context_msg = evaluate_context_relevance(
        chunks=retrieval_res.chunks,
        board=norm_board,
        subject=norm_subject,
    )
    if no_context_msg:
        yield {"event": "token", "data": {"delta": no_context_msg}}
        duration_ms = (time.perf_counter() - t_start) * 1000
        yield {
            "event": "done",
            "data": {
                "sources": [],
                "grounded": True,
                "provider": "guardrail",
                "model": "no-context-filter",
                "mock": False,
                "latency_ms": {"retrieval": round(retrieval_ms, 2), "total": round(duration_ms, 2)},
            },
        }
        return

    # Yield candidate sources event first
    candidate_sources = _format_candidate_sources(chunks)
    yield {
        "event": "sources",
        "data": {
            "sources": [s.model_dump() for s in candidate_sources],
            "total_retrieved": len(candidate_sources),
        },
    }

    # Build prompt
    messages = build_tutor_messages(
        board=norm_board,
        subject=norm_subject,
        question=clean_question,
        chunks=chunks,
        style_instructions=style_instructions,
    )

    router = get_llm_router()
    accumulated_text = []
    final_metadata = {}

    async for item in router.stream(
        messages=messages,
        chunks=chunks,
        provider_override=provider_override,
        force_mock=force_mock,
    ):
        event_type = item.get("event")
        event_data = item.get("data", {})

        if event_type == "token":
            delta = event_data.get("delta", "")
            accumulated_text.append(delta)
            yield item
        elif event_type == "done":
            final_metadata = event_data
        elif event_type == "error":
            yield item
            return

    # Finalize answer citations from complete accumulated text
    full_text = "".join(accumulated_text)
    valid_sources, is_grounded = extract_citations(answer=full_text, chunks=chunks)
    total_ms = (time.perf_counter() - t_start) * 1000

    yield {
        "event": "done",
        "data": {
            "sources": [s.model_dump() for s in valid_sources],
            "grounded": is_grounded,
            "provider": final_metadata.get("provider", "unknown"),
            "model": final_metadata.get("model", "unknown"),
            "mock": final_metadata.get("mock", False),
            "latency_ms": {
                "retrieval": round(retrieval_ms, 2),
                "generation": final_metadata.get("latency_ms", 0.0),
                "total": round(total_ms, 2),
            },
        },
    }
