"""Privacy utilities for safe query logging."""

import hashlib
import logging
from app.config import settings

logger = logging.getLogger("ai_tutor.rag")


def get_query_safe_identifier(query: str) -> str:
    """Returns a privacy-preserving hash prefix and character length for a query."""
    cleaned = query.strip()
    h = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()[:10]
    return f"len={len(cleaned)}#sha256:{h}"


def log_query(query: str, filters_summary: str = "", mode: str = "") -> None:
    """Logs query execution safely in compliance with student privacy guidelines."""
    if getattr(settings, "DEBUG_RETRIEVAL", False):
        logger.info(f"Query [{mode}] '{query}' (filters: {filters_summary})")
    else:
        logger.info(
            f"Query [{mode}] {get_query_safe_identifier(query)} (filters: {filters_summary})"
        )
