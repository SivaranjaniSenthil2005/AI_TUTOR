"""Tutor answering orchestration service for AI Tutor (Phase 11 Advanced RAG).

Coordinates:
1. Class 10 scope enforcement
2. Input sanitization & safety guardrails
3. Stateless conversation memory trimming
4. Standalone query rewriting & follow-up resolution (auto/always/off, budget-aware)
5. Adaptive routing with soft chapter widening
6. Concurrent multi-query expansion & RRF fusion
7. Guardrail: No-context shortcut (prevents hallucination & saves cost)
8. Learning modes & learner profile prompt composition
9. Prompt construction with prompt-injection defense
10. Multi-provider LLM Router with failover & circuit breaking
11. Citation parsing & grounding verification
12. Follow-up suggestions parsing
13. Deterministic voice-friendly speech_text synthesis
14. Stage timings & retrieval debug inspection
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
from app.services.memory import Turn, trim_history, build_conversation_summary, track_topic_hint
from app.services.speech import to_speech_text
from app.llm.styles import LearnerProfile, build_style_instructions
from app.rag.query.rewrite import rewrite_query
from app.rag.query.expand import expand_query
from app.rag.query.routing import resolve_filters, execute_routed_retrieval
from app.llm.guardrails import (
    sanitize_question,
    check_educational_safety,
    evaluate_context_relevance,
)
from app.llm.prompts import build_tutor_messages, extract_suggested_questions
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


def _resolve_modes(
    mode: Optional[str],
    learning_mode: Optional[str],
    retrieval_mode: Optional[str],
) -> tuple[str, str]:
    """Disambiguate learning mode vs retrieval mode from user request."""
    valid_learning_modes = {"simple", "step_by_step", "example", "exam"}
    valid_retrieval_modes = {"vector_only", "bm25_only", "hybrid", "hybrid_rerank"}

    # Determine learning mode
    eff_learning = "simple"
    if learning_mode and learning_mode.lower() in valid_learning_modes:
        eff_learning = learning_mode.lower()
    elif mode and mode.lower() in valid_learning_modes:
        eff_learning = mode.lower()

    # Determine retrieval mode
    eff_retrieval = "hybrid_rerank"
    if retrieval_mode and retrieval_mode.lower() in valid_retrieval_modes:
        eff_retrieval = retrieval_mode.lower()
    elif mode and mode.lower() in valid_retrieval_modes:
        eff_retrieval = mode.lower()

    return eff_learning, eff_retrieval


async def answer_question(
    question: str,
    board: str,
    subject: str,
    chapter_no: Optional[int] = None,
    active_chapter_no: Optional[int] = None,
    mode: Optional[str] = "simple",
    learning_mode: Optional[str] = None,
    retrieval_mode: Optional[str] = "hybrid_rerank",
    learner_profile: Optional[LearnerProfile] = None,
    history: Optional[List[Turn]] = None,
    top_k: Optional[int] = None,
    provider_override: Optional[str] = None,
    force_mock: bool = False,
    style_instructions: Optional[str] = None,
) -> AnswerResult:
    """End-to-end question answering pipeline for Class 10 school students."""
    t_start = time.perf_counter()
    llm_calls_made = 0
    llm_budget = getattr(settings, "MAX_LLM_CALLS_PER_REQUEST", 3)

    eff_learning_mode, eff_retrieval_mode = _resolve_modes(mode, learning_mode, retrieval_mode)

    # 1. Enforce Class 10 scope
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
            latency_ms=AnswerLatency(total=round(duration_ms, 2)),
            usage={},
            mock=False,
            mode=eff_learning_mode,
            learning_mode=eff_learning_mode,
            speech_text=to_speech_text(safety_decline),
            suggested_questions=[],
        )

    # 4. Stateless memory trimming (enforce privacy and token bounds)
    trimmed_history = trim_history(history, max_turns=6, max_chars_per_turn=600)

    # 5. Standalone query rewriting & follow-up resolution
    t_rew_start = time.perf_counter()
    rew_res = await rewrite_query(
        question=clean_question,
        history=trimmed_history,
        provider_override=provider_override,
        force_mock=force_mock,
    )
    rewriting_ms = (time.perf_counter() - t_rew_start) * 1000
    if rew_res.rewrite_used:
        llm_calls_made += 1

    standalone_query = rew_res.standalone_query

    # 6. Adaptive routing & Multi-query expansion
    filters, has_chap_pref = resolve_filters(
        board=norm_board,
        subject=norm_subject,
        request_chapter_no=chapter_no,
        active_chapter_no=active_chapter_no,
        subject_hint=rew_res.subject_hint,
    )

    t_exp_start = time.perf_counter()
    variants: List[str] = []
    # Expansion permitted if not in FAST_MODE, rewrite mode is not off, and quota budget has room
    if (
        not settings.FAST_MODE
        and settings.REWRITE_MODE != "off"
        and (llm_calls_made + 1 < llm_budget)
    ):
        variants = await expand_query(
            standalone_query=standalone_query,
            subject=norm_subject,
            max_variants=settings.MULTI_QUERY_VARIANTS,
            provider_override=provider_override,
            force_mock=force_mock,
        )
        if variants:
            llm_calls_made += 1
    expansion_ms = (time.perf_counter() - t_exp_start) * 1000

    # 7. Execute routed retrieval (with soft chapter preference widening)
    t_ret_start = time.perf_counter()
    retrieval_k = top_k or settings.TOP_K_FINAL
    retrieval_res, was_widened = await execute_routed_retrieval(
        standalone_query=standalone_query,
        filters=filters,
        variants=variants,
        mode=eff_retrieval_mode,
        top_k=retrieval_k,
        soft_threshold=settings.SOFT_CHAPTER_THRESHOLD,
    )
    retrieval_ms = (time.perf_counter() - t_ret_start) * 1000
    chunks = [item.chunk for item in retrieval_res.chunks]

    # 8. Guardrail: No-context shortcut (prevents hallucination)
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
                rewriting=round(rewriting_ms, 2),
                expansion=round(expansion_ms, 2),
                retrieval=round(retrieval_ms, 2),
                generation=0.0,
                total=round(duration_ms, 2),
            ),
            usage={},
            mock=False,
            rewritten_query=standalone_query if rew_res.rewrite_used else None,
            rewrite_used=rew_res.rewrite_used,
            mode=eff_learning_mode,
            learning_mode=eff_learning_mode,
            speech_text=to_speech_text(no_context_msg),
            suggested_questions=[],
            retrieval_debug={"total_candidates": retrieval_res.total_candidates, "widened": was_widened} if settings.DEBUG_RETRIEVAL else None,
        )

    # 9. Build style instructions and prompt
    if not style_instructions:
        style_instructions = build_style_instructions(mode=eff_learning_mode, profile=learner_profile)

    history_summary = build_conversation_summary(trimmed_history)
    messages = build_tutor_messages(
        board=norm_board,
        subject=norm_subject,
        question=standalone_query,
        chunks=chunks,
        style_instructions=style_instructions,
        history_summary=history_summary,
    )

    # 10. Generate answer via LLM Router
    t_gen_start = time.perf_counter()
    router = get_llm_router()
    llm_res = await router.generate(
        messages=messages,
        chunks=chunks,
        provider_override=provider_override,
        force_mock=force_mock,
    )
    generation_ms = (time.perf_counter() - t_gen_start) * 1000
    llm_calls_made += 1

    raw_answer = llm_res.get("content", "")

    # 11. Parse follow-up suggestions, extract citations, and generate speech text
    clean_answer, suggested_questions = extract_suggested_questions(raw_answer)
    valid_sources, is_grounded = extract_citations(answer=clean_answer, chunks=chunks)
    speech = to_speech_text(clean_answer)
    topic_hint = track_topic_hint(valid_sources) or rew_res.chapter_hint

    total_ms = (time.perf_counter() - t_start) * 1000

    debug_info = None
    if settings.DEBUG_RETRIEVAL:
        debug_info = {
            "standalone_query": standalone_query,
            "variants": variants,
            "was_widened": was_widened,
            "retrieval_timings": retrieval_res.timings_ms,
            "total_candidates": retrieval_res.total_candidates,
            "candidate_chunk_ids": [c.chunk_id for c in chunks],
            "llm_calls_made": llm_calls_made,
        }

    return AnswerResult(
        answer=clean_answer,
        sources=valid_sources,
        grounded=is_grounded,
        provider=llm_res.get("provider", "unknown"),
        model=llm_res.get("model", "unknown"),
        latency_ms=AnswerLatency(
            rewriting=round(rewriting_ms, 2),
            expansion=round(expansion_ms, 2),
            retrieval=round(retrieval_ms, 2),
            generation=round(generation_ms, 2),
            total=round(total_ms, 2),
        ),
        usage=llm_res.get("usage", {}),
        mock=llm_res.get("mock", False),
        rewritten_query=standalone_query if rew_res.rewrite_used else None,
        rewrite_used=rew_res.rewrite_used,
        mode=eff_learning_mode,
        learning_mode=eff_learning_mode,
        topic_hint=topic_hint,
        speech_text=speech,
        suggested_questions=suggested_questions,
        retrieval_debug=debug_info,
    )


async def stream_answer_question(
    question: str,
    board: str,
    subject: str,
    chapter_no: Optional[int] = None,
    active_chapter_no: Optional[int] = None,
    mode: Optional[str] = "simple",
    learning_mode: Optional[str] = None,
    retrieval_mode: Optional[str] = "hybrid_rerank",
    learner_profile: Optional[LearnerProfile] = None,
    history: Optional[List[Turn]] = None,
    top_k: Optional[int] = None,
    provider_override: Optional[str] = None,
    force_mock: bool = False,
    style_instructions: Optional[str] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """Streaming answer pipeline generating SSE events with Phase 11 meta, tokens, speech, and suggestions."""
    t_start = time.perf_counter()
    eff_learning_mode, eff_retrieval_mode = _resolve_modes(mode, learning_mode, retrieval_mode)

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

    # Safety check
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
                "speech_text": to_speech_text(safety_decline),
                "suggested_questions": [],
                "latency_ms": {"total": round(duration_ms, 2)},
            },
        }
        return

    # Memory trimming
    trimmed_history = trim_history(history, max_turns=6, max_chars_per_turn=600)

    # Standalone query rewriting
    t_rew_start = time.perf_counter()
    rew_res = await rewrite_query(
        question=clean_question,
        history=trimmed_history,
        provider_override=provider_override,
        force_mock=force_mock,
    )
    rewriting_ms = (time.perf_counter() - t_rew_start) * 1000
    standalone_query = rew_res.standalone_query

    # Yield Phase 11 meta event at the start (before sources)
    yield {
        "event": "meta",
        "data": {
            "rewritten_query": standalone_query if rew_res.rewrite_used else None,
            "rewrite_used": rew_res.rewrite_used,
            "learning_mode": eff_learning_mode,
            "mode": eff_learning_mode,
            "topic_hint": rew_res.chapter_hint,
        },
    }

    # Routing and expansion
    filters, _ = resolve_filters(
        board=norm_board,
        subject=norm_subject,
        request_chapter_no=chapter_no,
        active_chapter_no=active_chapter_no,
        subject_hint=rew_res.subject_hint,
    )

    t_exp_start = time.perf_counter()
    variants: List[str] = []
    if not settings.FAST_MODE and settings.REWRITE_MODE != "off":
        variants = await expand_query(
            standalone_query=standalone_query,
            subject=norm_subject,
            max_variants=settings.MULTI_QUERY_VARIANTS,
            provider_override=provider_override,
            force_mock=force_mock,
        )
    expansion_ms = (time.perf_counter() - t_exp_start) * 1000

    # Retrieval
    t_ret_start = time.perf_counter()
    retrieval_k = top_k or settings.TOP_K_FINAL
    retrieval_res, was_widened = await execute_routed_retrieval(
        standalone_query=standalone_query,
        filters=filters,
        variants=variants,
        mode=eff_retrieval_mode,
        top_k=retrieval_k,
        soft_threshold=settings.SOFT_CHAPTER_THRESHOLD,
    )
    retrieval_ms = (time.perf_counter() - t_ret_start) * 1000
    chunks = [item.chunk for item in retrieval_res.chunks]

    # Candidate sources event (always sent after meta)
    candidate_sources = _format_candidate_sources(chunks)
    yield {
        "event": "sources",
        "data": {
            "sources": [s.model_dump() for s in candidate_sources],
            "total_retrieved": len(candidate_sources),
        },
    }

    # No-context shortcut
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
                "speech_text": to_speech_text(no_context_msg),
                "suggested_questions": [],
                "latency_ms": {
                    "rewriting": round(rewriting_ms, 2),
                    "expansion": round(expansion_ms, 2),
                    "retrieval": round(retrieval_ms, 2),
                    "total": round(duration_ms, 2),
                },
            },
        }
        return

    # Build prompt
    if not style_instructions:
        style_instructions = build_style_instructions(mode=eff_learning_mode, profile=learner_profile)

    history_summary = build_conversation_summary(trimmed_history)
    messages = build_tutor_messages(
        board=norm_board,
        subject=norm_subject,
        question=standalone_query,
        chunks=chunks,
        style_instructions=style_instructions,
        history_summary=history_summary,
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

    # Finalize citations, speech_text, and follow-up suggestions from accumulated response
    full_text = "".join(accumulated_text)
    clean_answer, suggested_questions = extract_suggested_questions(full_text)
    valid_sources, is_grounded = extract_citations(answer=clean_answer, chunks=chunks)
    speech = to_speech_text(clean_answer)
    topic_hint = track_topic_hint(valid_sources) or rew_res.chapter_hint
    total_ms = (time.perf_counter() - t_start) * 1000

    yield {
        "event": "done",
        "data": {
            "sources": [s.model_dump() for s in valid_sources],
            "grounded": is_grounded,
            "provider": final_metadata.get("provider", "unknown"),
            "model": final_metadata.get("model", "unknown"),
            "mock": final_metadata.get("mock", False),
            "speech_text": speech,
            "suggested_questions": suggested_questions,
            "topic_hint": topic_hint,
            "latency_ms": {
                "rewriting": round(rewriting_ms, 2),
                "expansion": round(expansion_ms, 2),
                "retrieval": round(retrieval_ms, 2),
                "generation": final_metadata.get("latency_ms", 0.0),
                "total": round(total_ms, 2),
            },
        },
    }
