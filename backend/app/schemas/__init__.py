"""Schemas package for AI Tutor API."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str


class RetrieveRequest(BaseModel):
    """Request payload for RAG hybrid retrieval."""

    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    board: str = Field(..., description="Educational board ('tn' or 'cbse')")
    class_level: int = Field(..., ge=6, le=12, description="Class standard (6-12)")
    subject: str = Field(..., min_length=1, description="Subject name (e.g. science, social_science)")
    chapter_no: Optional[int] = Field(None, ge=1, le=100, description="Optional chapter number filter")
    mode: Optional[str] = Field("hybrid_rerank", description="vector_only, bm25_only, hybrid, hybrid_rerank")
    top_k: Optional[int] = Field(5, ge=1, le=50, description="Number of results to retrieve")
    include_exercises: Optional[bool] = Field(False, description="Include exercise block types")

    @field_validator("board")
    @classmethod
    def validate_board(cls, v: str) -> str:
        board_clean = v.strip().lower()
        if board_clean not in ("tn", "cbse"):
            raise ValueError("board must be either 'tn' or 'cbse'")
        return board_clean

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: Optional[str]) -> str:
        if not v:
            return "hybrid_rerank"
        mode_clean = v.strip().lower()
        valid_modes = {"vector_only", "bm25_only", "hybrid", "hybrid_rerank"}
        if mode_clean not in valid_modes:
            raise ValueError(f"mode must be one of {valid_modes}")
        return mode_clean


class RetrieveResponseChunk(BaseModel):
    """Retrieved chunk with citations and relevance scoring."""

    chunk_id: str
    text: str
    score: float
    rank: int
    book_title: str = ""
    term: Optional[int] = None
    chapter_no: Optional[int] = None
    chapter_title: str = ""
    section_title: Optional[str] = None
    block_type: str = "content"
    page_start: int = 1
    page_end: int = 1
    source_file: str = ""
    context_header: str = ""


class RetrieveResponse(BaseModel):
    """Response payload containing retrieved chunks and stage timings."""

    query: str
    mode: str
    board: str
    class_level: int
    subject: str
    chunks: List[RetrieveResponseChunk]
    total_candidates: int
    timings_ms: Dict[str, float]
