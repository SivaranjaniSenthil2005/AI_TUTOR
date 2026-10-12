"""Central scope definitions and validators for AI Tutor.

AI Tutor currently supports:
- Boards: "tn" (Tamil Nadu State Board), "cbse" (CBSE / NCERT)
- Standard / Class: 10
- Subjects: "science" (Science), "social_science" (Social Science)
- Medium: English
"""

from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status

SUPPORTED_BOARDS: Dict[str, str] = {
    "tn": "Tamil Nadu State Board",
    "cbse": "CBSE (NCERT)",
}

SUPPORTED_CLASSES: Set[int] = {10}

SUPPORTED_SUBJECTS: Dict[str, str] = {
    "science": "Science",
    "social_science": "Social Science",
}

SCOPE_FRIENDLY_MESSAGE = (
    "AI Tutor currently supports Class 10 Science and Social Science for Tamil Nadu State Board (tn) and CBSE (cbse)."
)


def validate_board(board: str) -> str:
    """Validate and normalize educational board."""
    if not board:
        raise ValueError(f"Board is required. {SCOPE_FRIENDLY_MESSAGE}")
    b_clean = board.strip().lower()
    if b_clean not in SUPPORTED_BOARDS:
        valid_boards = ", ".join(SUPPORTED_BOARDS.keys())
        raise ValueError(
            f"Unsupported board '{board}'. Supported boards are: {valid_boards}. {SCOPE_FRIENDLY_MESSAGE}"
        )
    return b_clean


def validate_class(class_level: int) -> int:
    """Validate and enforce class standard."""
    if class_level not in SUPPORTED_CLASSES:
        raise ValueError(
            f"Unsupported class level {class_level}. {SCOPE_FRIENDLY_MESSAGE}"
        )
    return class_level


def validate_subject(subject: str) -> str:
    """Validate and normalize subject."""
    if not subject:
        raise ValueError(f"Subject is required. {SCOPE_FRIENDLY_MESSAGE}")
    s_clean = subject.strip().lower().replace("-", "_").replace(" ", "_")
    if s_clean not in SUPPORTED_SUBJECTS:
        valid_subjects = ", ".join(SUPPORTED_SUBJECTS.keys())
        raise ValueError(
            f"Unsupported subject '{subject}'. Supported subjects are: {valid_subjects}. {SCOPE_FRIENDLY_MESSAGE}"
        )
    return s_clean


def validate_scope(
    board: str, class_level: int, subject: str
) -> Tuple[str, int, str]:
    """Validate entire scope tuple, returning normalized values or raising HTTPException(422)."""
    errors: List[str] = []
    norm_board = board
    norm_class = class_level
    norm_subject = subject

    try:
        norm_board = validate_board(board)
    except ValueError as e:
        errors.append(str(e))

    try:
        norm_class = validate_class(class_level)
    except ValueError as e:
        errors.append(str(e))

    try:
        norm_subject = validate_subject(subject)
    except ValueError as e:
        errors.append(str(e))

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="; ".join(errors),
        )

    return norm_board, norm_class, norm_subject


def is_in_scope(
    board: Optional[str] = None,
    class_level: Optional[int] = None,
    subject: Optional[str] = None,
) -> bool:
    """Check if given parameters fall within supported scope."""
    if board is not None and board.strip().lower() not in SUPPORTED_BOARDS:
        return False
    if class_level is not None and class_level not in SUPPORTED_CLASSES:
        return False
    if subject is not None and subject.strip().lower().replace("-", "_").replace(" ", "_") not in SUPPORTED_SUBJECTS:
        return False
    return True


def get_scope_metadata() -> Dict[str, Any]:
    """Return dictionary of supported scope metadata."""
    return {
        "supported_boards": SUPPORTED_BOARDS,
        "supported_classes": sorted(list(SUPPORTED_CLASSES)),
        "supported_subjects": SUPPORTED_SUBJECTS,
        "medium": "English",
        "description": SCOPE_FRIENDLY_MESSAGE,
    }
