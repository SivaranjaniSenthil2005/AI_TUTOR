"""LLM layer package for AI Tutor with multi-provider fallback and citations."""

from app.llm.router import LLMRouter, get_llm_router, set_llm_router
from app.llm.mock_provider import MockProvider
from app.llm.prompts import (
    TUTOR_SYSTEM_PROMPT,
    RESPONSE_FORMAT_INSTRUCTION,
    build_tutor_messages,
    format_context_block,
)
from app.llm.citations import extract_citations, parse_citation_indices
from app.llm.guardrails import (
    sanitize_question,
    check_educational_safety,
    evaluate_context_relevance,
)

__all__ = [
    "LLMRouter",
    "get_llm_router",
    "set_llm_router",
    "MockProvider",
    "TUTOR_SYSTEM_PROMPT",
    "RESPONSE_FORMAT_INSTRUCTION",
    "build_tutor_messages",
    "format_context_block",
    "extract_citations",
    "parse_citation_indices",
    "sanitize_question",
    "check_educational_safety",
    "evaluate_context_relevance",
]
