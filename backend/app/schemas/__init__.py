"""Schemas package for AI Tutor API."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str


from app.scope import (
    validate_board as scope_validate_board,
    validate_class as scope_validate_class,
    validate_subject as scope_validate_subject,
)


class RetrieveRequest(BaseModel):
    """Request payload for RAG hybrid retrieval."""

    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    board: str = Field(..., description="Educational board ('tn' or 'cbse')")
    class_level: int = Field(10, description="Class standard (Class 10 only)")
    subject: str = Field(..., min_length=1, description="Subject name ('science' or 'social_science')")
    chapter_no: Optional[int] = Field(None, ge=1, le=100, description="Optional chapter number filter")
    mode: Optional[str] = Field("hybrid_rerank", description="vector_only, bm25_only, hybrid, hybrid_rerank")
    top_k: Optional[int] = Field(5, ge=1, le=50, description="Number of results to retrieve")
    include_exercises: Optional[bool] = Field(False, description="Include exercise block types")

    @field_validator("board")
    @classmethod
    def validate_board_field(cls, v: str) -> str:
        return scope_validate_board(v)

    @field_validator("class_level")
    @classmethod
    def validate_class_field(cls, v: int) -> int:
        return scope_validate_class(v)

    @field_validator("subject")
    @classmethod
    def validate_subject_field(cls, v: str) -> str:
        return scope_validate_subject(v)

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


class Turn(BaseModel):
    """A single turn in conversational history."""

    role: str = Field(..., description="'student' or 'tutor'")
    text: str = Field(..., max_length=1000, description="Turn content")


class LearnerProfile(BaseModel):
    """Personalized accessibility settings for neurodiverse learners."""

    reading_level: str = Field("standard", description="'easy' or 'standard'")
    max_sentences: int = Field(5, ge=2, le=10, description="Target maximum sentence count (2-10)")
    avoid_figurative_language: bool = Field(
        False,
        description="Enforces purely literal language; forbids idioms, metaphors, or figures of speech",
    )
    repeat_key_term: bool = Field(
        False,
        description="Explicitly restates key scientific/historical terms instead of vague pronouns",
    )

    @field_validator("reading_level")
    @classmethod
    def validate_reading_level(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if clean not in {"easy", "standard"}:
            raise ValueError("reading_level must be either 'easy' or 'standard'")
        return clean

    @field_validator("max_sentences")
    @classmethod
    def validate_max_sentences(cls, v: int) -> int:
        if v < 2 or v > 10:
            raise ValueError("max_sentences must be an integer between 2 and 10")
        return v


class AskRequest(BaseModel):
    """Request payload for answering student question grounded in curriculum."""

    question: str = Field(..., min_length=1, max_length=500, description="Student question")
    board: str = Field(..., description="Educational board ('tn' or 'cbse')")
    subject: str = Field(..., description="Subject ('science' or 'social_science')")
    chapter_no: Optional[int] = Field(None, ge=1, le=100, description="Optional chapter number filter")
    active_chapter_no: Optional[int] = Field(None, ge=1, le=100, description="Active chapter context from student session")
    class_level: Optional[int] = Field(10, description="Class standard (Class 10 only)")
    mode: Optional[str] = Field("simple", description="Learning mode ('simple', 'step_by_step', 'example', 'exam') or retrieval mode")
    learning_mode: Optional[str] = Field(None, description="Explicit learning mode ('simple', 'step_by_step', 'example', 'exam')")
    retrieval_mode: Optional[str] = Field("hybrid_rerank", description="Retrieval mode")
    learner_profile: Optional[LearnerProfile] = None
    history: Optional[List[Turn]] = Field(default_factory=list, description="Recent conversation turns (stateless, max 6 turns)")

    @field_validator("board")
    @classmethod
    def validate_board_field(cls, v: str) -> str:
        return scope_validate_board(v)

    @field_validator("class_level")
    @classmethod
    def validate_class_field(cls, v: Optional[int]) -> int:
        return scope_validate_class(v or 10)

    @field_validator("subject")
    @classmethod
    def validate_subject_field(cls, v: str) -> str:
        return scope_validate_subject(v)


class SourceCitation(BaseModel):
    """Extracted textbook source citation with page references."""

    citation_index: int = Field(..., description="Numbered marker [n] from the answer text")
    chunk_id: str
    book_title: str = ""
    chapter_no: Optional[int] = None
    chapter_title: str = ""
    section_title: Optional[str] = None
    page_start: int = 1
    page_end: int = 1
    source_file: str = ""
    text_snippet: str = ""


class AnswerLatency(BaseModel):
    """Per-stage latency measurements in milliseconds."""

    rewriting: float = 0.0
    expansion: float = 0.0
    retrieval: float = 0.0
    generation: float = 0.0
    total: float = 0.0


class AnswerResult(BaseModel):
    """Final grounded answer result payload with citations and audit metadata."""

    answer: str
    sources: List[SourceCitation] = Field(default_factory=list)
    grounded: bool = True
    provider: str
    model: str
    latency_ms: AnswerLatency
    usage: Dict[str, Any] = Field(default_factory=dict)
    mock: bool = False
    rewritten_query: Optional[str] = None
    rewrite_used: bool = False
    mode: str = "simple"
    learning_mode: str = "simple"
    topic_hint: Optional[str] = None
    speech_text: str = ""
    suggested_questions: List[str] = Field(default_factory=list)
    retrieval_debug: Optional[Dict[str, Any]] = None


class LLMStatusResponse(BaseModel):
    """Health and status of LLM providers and circuit breakers."""

    enabled_providers: List[str]
    provider_chain: List[str]
    circuit_breakers: Dict[str, Dict[str, Any]]
    models: Dict[str, str]


class ScopeResponse(BaseModel):
    """Supported curriculum scope metadata."""

    supported_boards: Dict[str, str]
    supported_classes: List[int]
    supported_subjects: Dict[str, str]
    medium: str = "English"
    description: str
