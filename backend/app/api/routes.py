"""API routes for AI Tutor backend."""

import asyncio
import json
import logging
import time
from typing import Dict, Tuple
from fastapi import APIRouter, HTTPException, Request, status
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.scope import get_scope_metadata
from app.schemas import (
    AskRequest,
    AnswerResult,
    HealthResponse,
    LLMStatusResponse,
    RetrieveRequest,
    RetrieveResponse,
    RetrieveResponseChunk,
    ScopeResponse,
)
from app.rag.schemas import CorpusSummary, RetrievalFilters
from app.rag.retriever import get_hybrid_retriever
from app.rag.indexer import get_corpus_indexer
from app.rag.vector_store import get_vector_store
from app.rag.keyword_index import get_keyword_index
from app.rag.embeddings import get_embedding_model
from app.rag.reranker import get_reranker_model
from app.llm.router import get_llm_router
from app.services.answer import answer_question, stream_answer_question

logger = logging.getLogger("ai_tutor.api")
router = APIRouter()


class TokenBucketRateLimiter:
    """In-memory rate limiter per client IP."""

    def __init__(self, requests_per_minute: int = 60):
        self.capacity = float(requests_per_minute)
        self.refill_rate = float(requests_per_minute) / 60.0
        self.buckets: Dict[str, Tuple[float, float]] = {}

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        tokens, last_refill = self.buckets.get(client_ip, (self.capacity, now))
        elapsed = now - last_refill
        tokens = min(self.capacity, tokens + (elapsed * self.refill_rate))
        if tokens >= 1.0:
            self.buckets[client_ip] = (tokens - 1.0, now)
            return True
        else:
            self.buckets[client_ip] = (tokens, now)
            return False


rate_limiter = TokenBucketRateLimiter(
    requests_per_minute=settings.RATE_LIMIT_REQUESTS_PER_MINUTE
)


@router.get("/health", response_model=HealthResponse, summary="Health Check")
async def health_check() -> HealthResponse:
    """Return health status of the AI Tutor backend."""
    return HealthResponse(status="ok")


@router.get("/scope", response_model=ScopeResponse, summary="Get Supported Scope")
async def get_scope() -> ScopeResponse:
    """Returns supported curriculum boards, classes, and subjects."""
    meta = get_scope_metadata()
    return ScopeResponse(
        supported_boards=meta["supported_boards"],
        supported_classes=meta["supported_classes"],
        supported_subjects=meta["supported_subjects"],
        medium=meta["medium"],
        description=meta["description"],
    )


@router.get("/corpus", response_model=CorpusSummary, summary="Get Corpus Summary")
async def get_corpus() -> CorpusSummary:
    """Returns available board/class/subject partitions within supported scope."""
    indexer = get_corpus_indexer()
    return indexer.get_corpus_summary()


@router.get("/llm/status", response_model=LLMStatusResponse, summary="Get LLM Status")
async def get_llm_status() -> LLMStatusResponse:
    """Returns enabled providers (by key presence only, never keys), chain, and circuit breaker status."""
    router_inst = get_llm_router()
    status_info = router_inst.get_status()
    return LLMStatusResponse(
        enabled_providers=status_info["enabled_providers"],
        provider_chain=status_info["provider_chain"],
        circuit_breakers=status_info["circuit_breakers"],
        models=status_info["models"],
    )


@router.post("/warmup", summary="Warm up RAG models")
async def warmup_models():
    """Pre-loads embedding and reranker models into memory for low-latency retrieval."""
    try:
        embed_model = get_embedding_model()
        _ = embed_model.model
        reranker_model = get_reranker_model()
        _ = reranker_model.model
        return {
            "status": "warmed",
            "embedding_model": embed_model.model_name,
            "reranker_model": reranker_model.model_name,
        }
    except Exception as e:
        logger.error(f"Warmup error: {e}")
        return {"status": "warning", "error": str(e)}


@router.post("/retrieve", response_model=RetrieveResponse, summary="Retrieve Curriculum Chunks")
async def retrieve_chunks(req: RetrieveRequest) -> RetrieveResponse:
    """Retrieves relevant textbook chunks using hybrid vector + BM25 search with RRF and reranking."""
    vector_store = get_vector_store()
    keyword_index = get_keyword_index()

    # Check if index exists
    total_docs = vector_store.count()
    partition = keyword_index.load_partition(req.board, req.class_level, req.subject)

    if total_docs == 0 and partition is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Corpus index is not built yet for {req.board.upper()} Class {req.class_level} {req.subject}. "
                "Please run 'python -m app.rag.cli index --all' to build the index."
            ),
        )

    filters = RetrievalFilters(
        board=req.board,
        class_level=req.class_level,
        subject=req.subject,
        chapter_no=req.chapter_no,
        include_exercises=req.include_exercises or False,
    )

    retriever = get_hybrid_retriever()
    result = retriever.retrieve(
        query=req.query,
        filters=filters,
        mode=req.mode or "hybrid_rerank",
        top_k=req.top_k or 5,
    )

    response_chunks = [
        RetrieveResponseChunk(
            chunk_id=item.chunk.chunk_id,
            text=item.chunk.text,
            score=item.score,
            rank=item.rank,
            book_title=item.chunk.book_title,
            term=item.chunk.term,
            chapter_no=item.chunk.chapter_no,
            chapter_title=item.chunk.chapter_title,
            section_title=item.chunk.section_title,
            block_type=item.chunk.block_type,
            page_start=item.chunk.page_start,
            page_end=item.chunk.page_end,
            source_file=item.chunk.source_file,
            context_header=item.chunk.context_header,
        )
        for item in result.chunks
    ]

    return RetrieveResponse(
        query=req.query,
        mode=result.mode,
        board=req.board,
        class_level=req.class_level,
        subject=req.subject,
        chunks=response_chunks,
        total_candidates=result.total_candidates,
        timings_ms=result.timings_ms,
    )


@router.post("/ask", response_model=AnswerResult, summary="Ask Tutor Question")
async def ask_question_endpoint(req: AskRequest, request: Request) -> AnswerResult:
    """Answers a student question grounded in Class 10 curriculum textbooks."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending another question.",
        )

    try:
        result = await answer_question(
            question=req.question,
            board=req.board,
            subject=req.subject,
            chapter_no=req.chapter_no,
            active_chapter_no=req.active_chapter_no,
            mode=req.mode or "simple",
            learning_mode=req.learning_mode,
            retrieval_mode=req.retrieval_mode or "hybrid_rerank",
            learner_profile=req.learner_profile,
            history=req.history,
        )
        return result
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as exc:
        logger.error(f"Error answering question: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while answering your question. Please try again.",
        )


@router.post("/ask/stream", summary="Stream Tutor Answer via SSE")
async def ask_question_stream(req: AskRequest, request: Request):
    """Streams student answer via Server-Sent Events (SSE).

    Event types:
    - 'meta': Query rewriting and topic hint metadata (sent first)
    - 'sources': Candidate retrieved citations
    - 'token': Incremental text delta
    - 'done': Final completion payload with metadata, speech_text, & suggested_questions
    - 'error': Friendly error event
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending another question.",
        )

    async def event_generator():
        try:
            async for item in stream_answer_question(
                question=req.question,
                board=req.board,
                subject=req.subject,
                chapter_no=req.chapter_no,
                active_chapter_no=req.active_chapter_no,
                mode=req.mode or "simple",
                learning_mode=req.learning_mode,
                retrieval_mode=req.retrieval_mode or "hybrid_rerank",
                learner_profile=req.learner_profile,
                history=req.history,
            ):
                if await request.is_disconnected():
                    logger.info("Client disconnected from SSE stream.")
                    break
                yield {
                    "event": item.get("event", "message"),
                    "data": json.dumps(item.get("data", {})),
                }
        except asyncio.CancelledError:
            logger.info("SSE client cancelled request.")
            return
        except Exception as exc:
            logger.error(f"Error during SSE stream: {exc}", exc_info=True)
            yield {
                "event": "error",
                "data": json.dumps({"message": "Stream error occurred. Please try again."}),
            }

    return EventSourceResponse(event_generator())
