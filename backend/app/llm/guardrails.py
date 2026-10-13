"""Input sanitization, educational safety checks, and no-context shortcuts.

Ensures student safety, defends against abusive/off-topic prompts,
and avoids expensive/hallucinatory LLM calls when textbook context is absent.
"""

import re
from typing import Any, List, Optional
from app.config import settings

# Characters to remove: ASCII control characters except \t, \n, \r
CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")

# Lightweight safety filters for unsafe, harmful, or non-educational content
UNSAFE_PATTERNS = [
    re.compile(r"\b(how to make|build|manufacture|synthesise|synthesize|assemble|create)\b.*?\b(bomb|explosive|weapon|gun|poison|toxin)\b", re.I),
    re.compile(r"\b(kill myself|suicide|self[- ]harm|commit suicide)\b", re.I),
    re.compile(r"\b(hack into|steal passwords|ddos attack|credit card hack|ransomware|malware)\b", re.I),
    re.compile(r"\b(cryptocurrency|bitcoin|crypto\s+profit|stock\s+forecast)\b", re.I),
    re.compile(r"\b(political\s+election|who\s+is\s+going\s+to\s+win\s+the\s+next\s+election)\b", re.I),
]

SAFETY_DECLINE_MESSAGE = (
    "I am AI Tutor, your study assistant for Class 10 Science and Social Science. "
    "I cannot help with that request, but I am happy to help you with any topic from your textbook syllabus!"
)

NO_CONTEXT_MESSAGE_TEMPLATE = (
    "I couldn't find relevant information for that topic in your Class 10 {board_str} {subject_str} textbook. "
    "Please check if the topic is in your syllabus or try rephrasing your question using terms from your chapter."
)


def sanitize_question(
    question: str,
    max_length: Optional[int] = None,
) -> str:
    """Sanitize student question string.

    - Strips leading/trailing whitespace
    - Removes non-printable control characters
    - Enforces maximum character length
    """
    if not question:
        raise ValueError("Question cannot be empty.")

    # Strip control chars
    clean = CONTROL_CHAR_REGEX.sub("", question).strip()
    if not clean:
        raise ValueError("Question contains only invalid control characters.")

    limit = max_length or settings.GUARDRAIL_MAX_QUESTION_LENGTH
    if len(clean) > limit:
        raise ValueError(
            f"Question is too long ({len(clean)} characters). Please keep questions under {limit} characters."
        )

    return clean


def check_educational_safety(question: str) -> Optional[str]:
    """Check if question violates safety guardrails.

    Returns:
        Decline message string if unsafe, or None if safe.
    """
    for pattern in UNSAFE_PATTERNS:
        if pattern.search(question):
            return SAFETY_DECLINE_MESSAGE
    return None


def evaluate_context_relevance(
    chunks: List[Any],
    board: str,
    subject: str,
    min_score: Optional[float] = None,
) -> Optional[str]:
    """Check if retrieval returned viable chunks, or if LLM should be skipped.

    Returns:
        A friendly decline/guidance string if context is empty or irrelevantly scored,
        or None if retrieval passed relevance checks.
    """
    board_str = "Tamil Nadu State Board" if board.lower() == "tn" else "CBSE"
    subject_str = "Science" if "science" in subject.lower() and "social" not in subject.lower() else "Social Science"

    if not chunks:
        return NO_CONTEXT_MESSAGE_TEMPLATE.format(board_str=board_str, subject_str=subject_str)

    threshold = min_score if min_score is not None else settings.GUARDRAIL_MIN_RERANK_SCORE
    # If reranker score is present, check top chunk score
    top_chunk = chunks[0]
    top_score = getattr(top_chunk, "score", None)
    if top_score is not None and top_score < threshold:
        return NO_CONTEXT_MESSAGE_TEMPLATE.format(board_str=board_str, subject_str=subject_str)

    return None
