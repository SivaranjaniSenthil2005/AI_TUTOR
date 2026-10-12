"""Stateless conversation memory helpers for AI Tutor.

Privacy-First Design:
- Zero persistent storage of conversation or student question text.
- No database, no files, no content logs.
- Memory is strictly stateless: passed per request in memory and discarded immediately.
- Enforces strict limits: max 6 turns, max 600 characters per turn.
"""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class Turn(BaseModel):
    """A single turn in conversational history."""

    role: str = Field(..., description="'student' or 'tutor'")
    text: str = Field(..., max_length=1000, description="Turn content")


def trim_history(
    history: Optional[List[Turn]],
    max_turns: int = 6,
    max_chars_per_turn: int = 600,
) -> List[Turn]:
    """Trim conversational history to prevent context overflow and enforce privacy limits.

    1. Keeps at most the latest `max_turns` turns.
    2. Truncates any turn text exceeding `max_chars_per_turn`.
    3. Normalizes role names.
    """
    if not history:
        return []

    # Take at most the latest max_turns
    recent_turns = history[-max_turns:]
    trimmed: List[Turn] = []

    for turn in recent_turns:
        role = turn.role.strip().lower()
        if role not in {"student", "tutor", "user", "assistant"}:
            role = "student"
        elif role == "user":
            role = "student"
        elif role == "assistant":
            role = "tutor"

        text = turn.text.strip()
        if len(text) > max_chars_per_turn:
            text = text[:max_chars_per_turn] + "..."

        trimmed.append(Turn(role=role, text=text))

    return trimmed


def build_conversation_summary(history: List[Turn]) -> str:
    """Build a compact, rule-based conversation summary from recent turns.

    Extracts a concise context trace to situate follow-up queries without extra LLM overhead.
    """
    if not history:
        return ""

    lines = []
    for turn in history:
        label = "Student" if turn.role == "student" else "Tutor"
        # For tutor answers, extract first sentence or up to 120 chars
        if turn.role == "tutor":
            summary_snippet = turn.text.split(".")[0].strip() if "." in turn.text else turn.text[:120].strip()
            lines.append(f"{label}: {summary_snippet}")
        else:
            lines.append(f"{label}: {turn.text}")

    return "\n".join(lines)


def track_topic_hint(sources: List[Any]) -> Optional[str]:
    """Identify the primary chapter or topic from retrieved/grounded sources.

    Returns the most frequent chapter title or first non-empty chapter title to keep follow-ups
    in the same chapter context.
    """
    if not sources:
        return None

    chapter_titles: List[str] = []
    for s in sources:
        title = getattr(s, "chapter_title", "")
        if title and title.strip():
            chapter_titles.append(title.strip())

    if not chapter_titles:
        return None

    # Return most frequent chapter title
    return max(set(chapter_titles), key=chapter_titles.count)
