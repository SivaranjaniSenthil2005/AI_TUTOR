"""Learning modes and accessibility learner profile customization for AI Tutor.

Provides specialized educational styles tailored for neurodiverse Class 10 students:
- simple: Short sentences, plain words, inline definitions, max 5 sentences.
- step_by_step: Numbered sequential steps (1., 2., 3.), one concept per step.
- example: Core textbook definition followed by ONE relatable everyday Indian context example.
- exam: Board examination style: crisp definition followed by 3-5 high-yield textbook bullet points.

Grounding rules are inviolable: all modes must strictly adhere to provided textbook context.
"""

from typing import Optional
from app.schemas import LearnerProfile


STYLE_BLOCKS = {
    "simple": """LEARNING MODE: SIMPLE & DIRECT
- Use very short, simple sentences.
- Use plain everyday vocabulary.
- If you use a difficult or technical textbook term, define it immediately in brackets [like this].
- Express only ONE idea per sentence.
- Keep the entire answer under 5 sentences.""",

    "step_by_step": """LEARNING MODE: STEP-BY-STEP BREAKDOWN
- Structure the explanation as numbered steps: 1., 2., 3., etc.
- Each step must be exactly one short sentence.
- Focus on sequence: order of operations, chemical reactions, biological cycles, or historical events.
- Never put more than one action or idea in a single step.""",

    "example": """LEARNING MODE: REAL-WORLD EXAMPLE
- First give the textbook definition or main concept in 1-2 concise sentences.
- Then provide exactly ONE relatable everyday example that a 15-16 year old student in India would recognize (e.g. rusting of iron gates, curdling of milk, domestic electric meters, monsoon rains, local panchayats).
- Label this clearly as 'Example:'.
- The example must illustrate the concept without contradicting textbook context.
- All factual claims must strictly be derived from the provided context.""",

    "exam": """LEARNING MODE: BOARD EXAM READY
- Format for a Class 10 Board Exam (3-mark or 5-mark question format):
  1. A one-line direct definition or principle at the start.
  2. 3 to 5 clear bullet points highlighting key marks-scoring facts, conditions, and reasons.
- Use the textbook's exact scientific/historical terms, equations, formulas, dates, or constitutional articles.
- Include balanced chemical equations or physics formulas exactly as presented in context.""",
}


def build_style_instructions(
    mode: str = "simple",
    profile: Optional[LearnerProfile] = None,
) -> str:
    """Compose complete style instructions combining learning mode and learner profile."""
    mode_key = (mode or "simple").strip().lower()
    if mode_key not in STYLE_BLOCKS:
        mode_key = "simple"

    instructions = [STYLE_BLOCKS[mode_key]]

    if profile:
        profile_clauses = ["\nLEARNER PROFILE CONSTRAINTS:"]
        if profile.reading_level == "easy":
            profile_clauses.append("- Use easy, elementary reading level vocabulary with short words.")
        
        if profile.max_sentences:
            profile_clauses.append(f"- Strictly limit your entire explanation to at most {profile.max_sentences} sentences.")

        if profile.avoid_figurative_language:
            profile_clauses.append("- Use strictly literal language. Do NOT use metaphors, similes, idioms, or poetic expressions.")

        if profile.repeat_key_term:
            profile_clauses.append("- Explicitly repeat the core concept or subject noun rather than using pronouns like 'it', 'this', or 'they'.")

        instructions.append("\n".join(profile_clauses))

    instructions.append(
        "\nIMPORTANT: Your grounding rules ALWAYS override style. Answer ONLY from textbook context blocks and include citations [n]."
    )

    return "\n\n".join(instructions)
