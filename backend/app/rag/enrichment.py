"""Offline contextual retrieval enrichment for AI Tutor.

Generates 1-2 sentence situating notes per chunk using the LLM router:
- Identifies the curriculum chapter, section, and main concepts.
- Caches generated notes on disk keyed by chunk_id under data/processed/enrichment/
  so runs resume seamlessly after network interruptions or quota limits.
- Supports rate-limiting awareness and polite backoff.
- Completely optional and OFF by default.
"""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings
from app.llm.router import get_llm_router
from app.rag.indexer import scan_processed_chunks
from app.rag.schemas import Chunk

logger = logging.getLogger("ai_tutor.rag.enrichment")


def get_enrichment_file(board: str, subject: str) -> Path:
    """Return the cache file path for the given board and subject."""
    enrich_dir = Path(getattr(settings, "ENRICHMENT_DIR", "data/processed/enrichment"))
    enrich_dir.mkdir(parents=True, exist_ok=True)
    return enrich_dir / f"{board.lower()}_{subject.lower()}_enrichment.json"


def load_enrichment_cache(board: str, subject: str) -> Dict[str, str]:
    """Load existing cached chunk notes from disk."""
    cache_file = get_enrichment_file(board, subject)
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read enrichment cache {cache_file}: {e}")
    return {}


def save_enrichment_cache(board: str, subject: str, cache: Dict[str, str]) -> None:
    """Persist updated enrichment cache to disk atomically."""
    cache_file = get_enrichment_file(board, subject)
    tmp_file = cache_file.with_suffix(".tmp")
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)
    tmp_file.replace(cache_file)


ENRICHMENT_SYSTEM_PROMPT = """You are a curriculum assistant for Class 10 State Board and CBSE textbooks.
Write a concise 1-2 sentence situating note for the following textbook passage.
Mention the chapter/topic it belongs to and state what core concept or fact it discusses.
Output ONLY the 1-2 sentence note. Do not include any greeting or conversational filler."""


async def enrich_partition(
    board: str,
    subject: str,
    limit: Optional[int] = None,
    force_mock: bool = False,
    delay_seconds: float = 0.5,
) -> Dict[str, Any]:
    """Generate and cache situating enrichment notes for processed chunks in a partition."""
    partitions = scan_processed_chunks(
        board_filter=board,
        class_filter=10,
        subject_filter=subject,
    )
    part_key = (board.lower(), 10, subject.lower())
    chunks: List[Chunk] = partitions.get(part_key, [])

    if not chunks:
        return {"total_chunks": 0, "already_cached": 0, "newly_enriched": 0}

    cache = load_enrichment_cache(board, subject)
    already_cached = sum(1 for c in chunks if c.chunk_id in cache)

    to_process = [c for c in chunks if c.chunk_id not in cache]
    if limit is not None and limit > 0:
        to_process = to_process[:limit]

    router = get_llm_router()
    newly_enriched = 0

    for idx, c in enumerate(to_process, start=1):
        user_prompt = (
            f"Header: {c.context_header}\n"
            f"Passage:\n{c.text[:600]}\n"
        )
        messages = [
            {"role": "system", "content": ENRICHMENT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        try:
            res = await router.generate(
                messages=messages,
                chunks=None,
                force_mock=force_mock,
                timeout_seconds=10.0,
                temperature=0.1,
                max_tokens=100,
            )
            note = res.get("content", "").strip()
            if note:
                cache[c.chunk_id] = note
                newly_enriched += 1
                # Save progress incrementally to survive interruptions
                save_enrichment_cache(board, subject, cache)

            # Rate limit politeness
            if delay_seconds > 0:
                await asyncio.sleep(delay_seconds)

        except Exception as exc:
            logger.warning(f"Error enriching chunk {c.chunk_id}: {exc}")
            # Save whatever has been done and pause briefly
            save_enrichment_cache(board, subject, cache)
            await asyncio.sleep(2.0)

    return {
        "total_chunks": len(chunks),
        "already_cached": already_cached,
        "newly_enriched": newly_enriched,
        "total_cached": len(cache),
    }
