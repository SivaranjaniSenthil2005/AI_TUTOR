"""Helpers to convert RetrievalFilters into vector store and keyword index filters."""

from typing import Any, Dict, Optional
from app.rag.schemas import RetrievalFilters


def build_chroma_filter(filters: RetrievalFilters) -> Dict[str, Any]:
    """Translates RetrievalFilters into ChromaDB metadata filter dictionary using $and clauses."""
    clauses = [
        {"board": {"$eq": filters.board.lower()}},
        {"class_level": {"$eq": int(filters.class_level)}},
        {"subject": {"$eq": filters.subject.lower()}},
    ]
    if filters.chapter_no is not None:
        clauses.append({"chapter_no": {"$eq": int(filters.chapter_no)}})

    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def matches_filters_in_memory(
    metadata: Dict[str, Any], filters: RetrievalFilters
) -> bool:
    """Evaluates whether a chunk dictionary/metadata satisfies the given filters."""
    if metadata.get("board", "").lower() != filters.board.lower():
        return False
    if int(metadata.get("class_level", 0)) != int(filters.class_level):
        return False
    if metadata.get("subject", "").lower() != filters.subject.lower():
        return False
    if filters.chapter_no is not None:
        chunk_chap = metadata.get("chapter_no")
        if chunk_chap is None or int(chunk_chap) != int(filters.chapter_no):
            return False
    return True
