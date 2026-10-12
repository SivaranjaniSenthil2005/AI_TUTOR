"""Query rewriting and follow-up resolution for AI Tutor.

Transforms contextual follow-up questions and voice transcriptions into
clean, standalone textbook search queries grounded in Class 10 curriculum.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.config import settings
from app.llm.router import get_llm_router
from app.services.memory import Turn, build_conversation_summary

logger = logging.getLogger("ai_tutor.rag.query.rewrite")

# Class 10 abbreviations with safe contextual expansion
CLASS_10_ABBREVIATIONS = {
    r"\bac\b": "alternating current",
    r"\bdc\b": "direct current",
    r"\bgdp\b": "gross domestic product",
    r"\bniti\b": "NITI Aayog",
    r"\brbi\b": "Reserve Bank of India",
    r"\bwho\b": "World Health Organization",
}

# Pronouns and elliptical triggers indicating a follow-up
ELLIPTICAL_PATTERNS = [
    r"\b(it|its|this|that|these|those|they|them|their|the same|itself)\b",
    r"^(what about|how about|and what|and how|and the|give an example|why so|why does it|how does it)",
    r"^(and the second|and the third|another one|what else|where does it|when did it)",
    r"^(why|how|where|when|what)\?*$",
]


class RewriteResult(BaseModel):
    """Result of query rewrite stage."""

    standalone_query: str
    subject_hint: Optional[str] = None
    chapter_hint: Optional[str] = None
    needs_rewrite: bool = False
    rewrite_used: bool = False


def should_skip_rewrite(question: str, history: List[Turn]) -> bool:
    """Heuristic check: returns True if query is already a clear standalone question.

    Saves latency and free-tier API quota by bypassing LLM rewrite when:
    1. History is empty AND
    2. Question is sufficiently descriptive (>= 5 words, >= 25 chars) AND
    3. Question does NOT contain pronoun-only or elliptical references.
    """
    if history:
        # History is present - follow-up resolution is likely needed
        return False

    q_clean = question.strip().lower()
    words = q_clean.split()
    if len(words) < 5 or len(q_clean) < 25:
        # Very short query, might need expansion or spell fix
        return False

    # Check for pronoun or elliptical references
    for pat in ELLIPTICAL_PATTERNS:
        if re.search(pat, q_clean):
            return False

    return True


REWRITE_SYSTEM_PROMPT = """You are a curriculum query assistant for Class 10 Tamil Nadu State Board and CBSE textbooks (Science and Social Science).
Your task is to convert the student's question (+ optional conversation history) into a single, clear, STANDALONE textbook search query.

RULES:
1. Resolve all pronouns (it, its, this, that, they, them) and elliptical follow-ups ("what about its uses?", "give an example") using the conversation history.
2. Fix obvious speech-to-text / voice transcription mishearings and typos.
3. Expand common Class 10 abbreviations only when unambiguous (e.g., AC -> alternating current, DC -> direct current, GDP -> gross domestic product).
4. Preserve exact technical terms, chemical formulas (e.g., H2SO4, NaCl), units, laws, and dates.
5. Determine subject_hint ("science", "social_science", or null) and chapter_hint (chapter title or null).
6. Set "needs_rewrite" to true if the query was modified or resolved, false if already standalone.
7. Output STRICT JSON only. Format:
{
  "standalone_query": "string",
  "subject_hint": "science" | "social_science" | null,
  "chapter_hint": "string" | null,
  "needs_rewrite": true | false
}"""


def _clean_text_fallback(text: str) -> str:
    """Simple offline cleanup of raw query if LLM is unavailable."""
    cleaned = text.strip()
    # Expand simple Class 10 abbreviations safely
    for pattern, expanded in CLASS_10_ABBREVIATIONS.items():
        cleaned = re.sub(pattern, expanded, cleaned, flags=re.IGNORECASE)
    return cleaned


async def rewrite_query(
    question: str,
    history: Optional[List[Turn]] = None,
    active_chapter_title: Optional[str] = None,
    provider_override: Optional[str] = None,
    force_mock: bool = False,
) -> RewriteResult:
    """Rewrite student question into a standalone curriculum search query.

    Features:
    - Skip heuristic to save latency and quota.
    - Low temperature, tight timeout (5s), and small token limit.
    - Robust fallback: returns sanitized original question if rewrite fails or times out.
    """
    clean_original = question.strip()
    history_turns = history or []

    # Check configuration mode
    mode = getattr(settings, "REWRITE_MODE", "auto").lower()
    fast_mode = getattr(settings, "FAST_MODE", False)

    if mode == "off" or fast_mode:
        return RewriteResult(
            standalone_query=_clean_text_fallback(clean_original),
            subject_hint=None,
            chapter_hint=active_chapter_title,
            needs_rewrite=False,
            rewrite_used=False,
        )

    if mode == "auto" and should_skip_rewrite(clean_original, history_turns):
        return RewriteResult(
            standalone_query=_clean_text_fallback(clean_original),
            subject_hint=None,
            chapter_hint=active_chapter_title,
            needs_rewrite=False,
            rewrite_used=False,
        )

    # Prepare prompt for LLM
    summary = build_conversation_summary(history_turns)
    user_prompt_parts = []
    if summary:
        user_prompt_parts.append(f"CONVERSATION HISTORY:\n{summary}")
    if active_chapter_title:
        user_prompt_parts.append(f"CURRENT CHAPTER TOPIC: {active_chapter_title}")
    user_prompt_parts.append(f"STUDENT QUESTION: {clean_original}")
    user_prompt = "\n\n".join(user_prompt_parts)

    messages = [
        {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    try:
        router = get_llm_router()
        timeout = getattr(settings, "REWRITE_TIMEOUT_SECONDS", 5.0)

        res = await router.generate(
            messages=messages,
            chunks=None,
            provider_override=provider_override,
            force_mock=force_mock,
            timeout_seconds=timeout,
            temperature=0.0,
            max_tokens=150,
        )

        content = res.get("content", "").strip()
        # Strip markdown json codeblock if present
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        data = json.loads(content)
        standalone = str(data.get("standalone_query", "")).strip()
        if not standalone:
            standalone = _clean_text_fallback(clean_original)

        sub_hint = data.get("subject_hint")
        if sub_hint and sub_hint.lower() in {"science", "social_science"}:
            sub_hint = sub_hint.lower()
        else:
            sub_hint = None

        chap_hint = data.get("chapter_hint") or active_chapter_title

        return RewriteResult(
            standalone_query=standalone,
            subject_hint=sub_hint,
            chapter_hint=chap_hint,
            needs_rewrite=bool(data.get("needs_rewrite", True)),
            rewrite_used=True,
        )

    except Exception as exc:
        logger.warning(f"Query rewrite failed or timed out: {exc}. Falling back to original query.")
        return RewriteResult(
            standalone_query=_clean_text_fallback(clean_original),
            subject_hint=None,
            chapter_hint=active_chapter_title,
            needs_rewrite=False,
            rewrite_used=False,
        )
