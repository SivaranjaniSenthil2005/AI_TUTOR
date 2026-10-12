"""Deterministic text-to-speech converter for AI Tutor.

Prepares tutor answers for voice synthesis:
- Strips citation bracket markers like [1], [2]
- Strips markdown formatting (bold, italic, code blocks, headers, bullet points)
- Converts numbered step markers to voice-friendly phrases ("Step one.", "Step two.")
- Replaces scientific symbols, units, and mathematical operators with spoken words
- Replaces common Class 10 chemical formulas with natural spoken equivalents
- Normalizes punctuation and spacing for smooth speech engine pacing
"""

import re
from typing import Dict

# Pronunciation mapping for common Class 10 chemical formulas
CHEMICAL_PRONUNCIATION_MAP: Dict[str, str] = {
    "H2O": "H 2 O",
    "CO2": "C O 2",
    "NaCl": "sodium chloride",
    "HCl": "hydrochloric acid",
    "H2SO4": "sulfuric acid",
    "HNO3": "nitric acid",
    "NaOH": "sodium hydroxide",
    "KOH": "potassium hydroxide",
    "Ca(OH)2": "calcium hydroxide",
    "CaCO3": "calcium carbonate",
    "CaO": "calcium oxide",
    "CuSO4": "copper sulfate",
    "FeSO4": "ferrous sulfate",
    "CH4": "methane",
    "C6H12O6": "glucose",
    "O2": "oxygen gas",
    "H2": "hydrogen gas",
    "N2": "nitrogen gas",
    "CO": "carbon monoxide",
}

NUMBER_WORDS = {
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
}


def to_speech_text(text: str) -> str:
    """Convert tutor markdown answer text into clean, natural spoken audio text."""
    if not text:
        return ""

    speech = text

    # 1. Remove Sources section (line or trailing block)
    speech = re.sub(r"(?i)(?:^|\n)\s*sources\s*:[^\n]*", "", speech)
    # Remove trailing Suggested / Follow-up Questions section
    speech = re.sub(r"(?i)(?:^|\n)\s*(?:next questions|suggested questions|follow-up questions)\s*:[\s\S]*$", "", speech)

    # 2. Remove bracket citation markers: [1], [2], [1, 2], [1-3], etc.
    speech = re.sub(r"\[\s*\d+(?:\s*[,-]\s*\d+)*\s*\]", "", speech)

    # 3. Replace chemical formulas using boundary-aware regex
    for formula, spoken in CHEMICAL_PRONUNCIATION_MAP.items():
        pattern = r"\b" + re.escape(formula) + r"\b"
        speech = re.sub(pattern, spoken, speech)

    # 4. Units and scientific symbols
    speech = re.sub(r"\bm/s\^2\b|\bm/s²\b", " meters per second squared", speech)
    speech = re.sub(r"\bm/s\b", " meters per second", speech)
    speech = re.sub(r"\bkm/h\b", " kilometers per hour", speech)
    speech = re.sub(r"\bcm\b", " centimeters", speech)
    speech = re.sub(r"\bmm\b", " millimeters", speech)
    speech = re.sub(r"\bkg\b", " kilograms", speech)

    # Temperature & Percent
    speech = re.sub(r"°C|℃", " degrees Celsius", speech)
    speech = re.sub(r"°F|℉", " degrees Fahrenheit", speech)
    speech = re.sub(r"%", " percent", speech)

    # Arrows & Math symbols
    speech = re.sub(r"\s*(?:→|->|-->)\s*", " gives ", speech)
    speech = re.sub(r"\s*(?:⇌|<=>)\s*", " is reversible to ", speech)
    speech = re.sub(r"\s*≈\s*", " approximately equals ", speech)
    speech = re.sub(r"\s*=\s*", " equals ", speech)

    # 5. Convert numbered steps: "1. ", "2. ", "1) " -> "Step one. ", "Step two. "
    def _replace_step(match: re.Match) -> str:
        num = int(match.group(1))
        num_word = NUMBER_WORDS.get(num, str(num))
        return f"Step {num_word}. "

    speech = re.sub(r"(?:^|\n)\s*(\d{1,2})[\.\)]\s+", _replace_step, speech)

    # 6. Remove markdown elements
    # Remove code blocks
    speech = re.sub(r"```[a-zA-Z]*\n?[\s\S]*?```", "", speech)
    speech = re.sub(r"`([^`]+)`", r"\1", speech)
    # Headers
    speech = re.sub(r"(?:^|\n)#{1,6}\s*", " ", speech)
    # Bold / Italic
    speech = re.sub(r"\*\*([^*]+)\*\*", r"\1", speech)
    speech = re.sub(r"\*([^*]+)\*", r"\1", speech)
    speech = re.sub(r"__([^_]+)__", r"\1", speech)
    speech = re.sub(r"_([^_]+)_", r"\1", speech)
    # Blockquotes
    speech = re.sub(r"(?:^|\n)>\s*", " ", speech)
    # Bullet points (- or * or •)
    speech = re.sub(r"(?:^|\n)\s*[-*•]\s+", ". ", speech)

    # 7. Convert '+' between words/formulas (e.g., A + B -> A plus B)
    speech = re.sub(r"(\w)\s*\+\s*(\w)", r"\1 plus \2", speech)

    # 8. Clean up extra punctuation, spaces, and line breaks
    speech = re.sub(r"\s*\.\s*\.", ".", speech)
    speech = re.sub(r"[ \t]+", " ", speech)
    speech = re.sub(r"\n+", " ", speech)
    speech = speech.strip()

    return speech
