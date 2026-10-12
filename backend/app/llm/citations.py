"""Citation extraction and grounding verification for AI Tutor.

Parses [n] markers from generated LLM text, maps to retrieved textbook chunks,
drops invalid/out-of-bound references, and flags grounding status.
"""

import re
from typing import Any, List, Set, Tuple
from app.schemas import SourceCitation

# Regex to find citation markers like [1], [2], [10]
CITATION_REGEX = re.compile(r"\[(\d+)\]")


def parse_citation_indices(text: str) -> List[int]:
    """Extract unique citation numbers in order of appearance."""
    indices: List[int] = []
    seen: Set[int] = set()
    for match in CITATION_REGEX.finditer(text):
        idx = int(match.group(1))
        if idx not in seen:
            seen.add(idx)
            indices.append(idx)
    return indices


def extract_citations(
    answer: str,
    chunks: List[Any],
) -> Tuple[List[SourceCitation], bool]:
    """Parse citation markers from answer text and map to retrieved chunks.

    Returns:
        (sources, grounded):
            - sources: list of validated SourceCitation objects in order
            - grounded: True if citations were found or no context was available,
                        False if context was provided but no valid citation was made.
    """
    if not chunks:
        # No context was provided
        return [], True

    raw_indices = parse_citation_indices(answer)
    valid_citations: List[SourceCitation] = []
    seen_chunk_ids: Set[str] = set()

    for idx in raw_indices:
        # Check 1-based bounds
        if 1 <= idx <= len(chunks):
            chunk = chunks[idx - 1]
            chunk_id = getattr(chunk, "chunk_id", f"c_{idx}")
            if chunk_id in seen_chunk_ids:
                continue
            seen_chunk_ids.add(chunk_id)

            text_full = getattr(chunk, "text", "")
            snippet = text_full[:200] + "..." if len(text_full) > 200 else text_full

            valid_citations.append(
                SourceCitation(
                    citation_index=idx,
                    chunk_id=chunk_id,
                    book_title=getattr(chunk, "book_title", ""),
                    chapter_no=getattr(chunk, "chapter_no", None),
                    chapter_title=getattr(chunk, "chapter_title", ""),
                    section_title=getattr(chunk, "section_title", None),
                    page_start=getattr(chunk, "page_start", 1),
                    page_end=getattr(chunk, "page_end", 1),
                    source_file=getattr(chunk, "source_file", ""),
                    text_snippet=snippet,
                )
            )

    # Grounded rule: if context was provided, answer MUST contain at least one valid citation
    grounded = len(valid_citations) > 0

    return valid_citations, grounded
