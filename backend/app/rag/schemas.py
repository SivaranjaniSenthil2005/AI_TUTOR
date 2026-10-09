"""Data models and schemas for RAG retrieval, chunk metadata, and evaluation."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChunkMetadata(BaseModel):
    """Metadata attributes associated with a curriculum chunk."""

    chunk_id: str
    board: str
    class_level: int
    subject: str
    book_title: str = ""
    term: Optional[int] = None
    chapter_no: Optional[int] = None
    chapter_title: str = ""
    section_title: Optional[str] = None
    block_type: str = "content"  # "content", "summary", "glossary", "exercise", "activity"
    page_start: int = 1
    page_end: int = 1
    source_file: str = ""


class Chunk(ChunkMetadata):
    """A full text chunk with context header and content."""

    text: str
    context_header: str = ""

    def get_embed_text(self) -> str:
        """Returns context-prepended text for dense vector representation."""
        if self.context_header and self.context_header.strip():
            return f"{self.context_header.strip()}\n{self.text.strip()}"
        return self.text.strip()


class RetrievalFilters(BaseModel):
    """Target filters applied during search."""

    board: str
    class_level: int
    subject: str
    chapter_no: Optional[int] = None
    include_exercises: bool = False


class ScoredChunk(BaseModel):
    """A chunk scored and ranked by one or more retrieval/reranking stages."""

    chunk: Chunk
    score: float
    rank: int
    stage_scores: Dict[str, float] = Field(default_factory=dict)
    stage_ranks: Dict[str, int] = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    """Overall result of a hybrid retrieval query."""

    query: str
    mode: str
    filters: RetrievalFilters
    chunks: List[ScoredChunk]
    total_candidates: int
    timings_ms: Dict[str, float] = Field(default_factory=dict)
    debug_trace: Optional[Dict[str, Any]] = None


class CorpusPartitionInfo(BaseModel):
    """Information regarding a board-class-subject corpus partition."""

    board: str
    class_level: int
    subject: str
    chunk_count: int
    chapter_count: int
    chapters: List[Dict[str, Any]] = Field(default_factory=list)


class CorpusSummary(BaseModel):
    """Overall corpus summary with indexed counts."""

    total_chunks: int
    total_partitions: int
    partitions: List[CorpusPartitionInfo]
