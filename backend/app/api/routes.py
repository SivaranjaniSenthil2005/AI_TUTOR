"""API routes for AI Tutor backend."""

import logging
from fastapi import APIRouter, HTTPException, status
from app.schemas import (
    HealthResponse,
    RetrieveRequest,
    RetrieveResponse,
    RetrieveResponseChunk,
)
from app.rag.schemas import CorpusSummary, RetrievalFilters
from app.rag.retriever import get_hybrid_retriever
from app.rag.indexer import get_corpus_indexer
from app.rag.vector_store import get_vector_store
from app.rag.keyword_index import get_keyword_index
from app.rag.embeddings import get_embedding_model
from app.rag.reranker import get_reranker_model

logger = logging.getLogger("ai_tutor.api")
router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Health Check")
async def health_check() -> HealthResponse:
    """Return health status of the AI Tutor backend."""
    return HealthResponse(status="ok")


@router.get("/corpus", response_model=CorpusSummary, summary="Get Corpus Summary")
async def get_corpus() -> CorpusSummary:
    """Returns available board/class/subject partitions and indexed chunk counts."""
    indexer = get_corpus_indexer()
    return indexer.get_corpus_summary()


@router.post("/warmup", summary="Warm up RAG models")
async def warmup_models():
    """Pre-loads embedding and reranker models into memory for low-latency retrieval."""
    try:
        embed_model = get_embedding_model()
        _ = embed_model.model
        reranker_model = get_reranker_model()
        _ = reranker_model.model
        return {"status": "warmed", "embedding_model": embed_model.model_name, "reranker_model": reranker_model.model_name}
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
