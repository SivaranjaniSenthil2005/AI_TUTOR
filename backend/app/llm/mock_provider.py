"""Deterministic offline mock provider for AI Tutor.

Operates without API keys or network access, enabling offline testing,
automated CI/CD verification, and local demonstration.
Supports grounded tutor answers, learning modes, query rewrite JSON, and multi-query expansion.
"""

import asyncio
import json
import re
from typing import Any, AsyncGenerator, Dict, List, Optional


class MockProvider:
    """Deterministic Mock LLM provider synthesizing curriculum-grounded responses."""

    def __init__(self, model_name: str = "mock-tutor-v1"):
        self.provider_name = "mock"
        self.model_name = model_name

    def _build_mock_text(self, messages: List[Dict[str, str]], chunks: Optional[List[Any]] = None) -> str:
        """Construct deterministic grounded text from provided context or prompt."""
        user_msg = ""
        sys_msg = ""
        for m in messages:
            if m.get("role") == "user":
                user_msg = m.get("content", "")
            elif m.get("role") == "system":
                sys_msg = m.get("content", "")

        # 1. Query Rewrite request
        if "STANDALONE" in sys_msg or "standalone_query" in sys_msg:
            q_match = re.search(r"STUDENT QUESTION:\s*(.*)", user_msg)
            raw_q = q_match.group(1).strip() if q_match else "science concept"
            
            # Check history to resolve follow-ups
            resolved = raw_q
            needs_rewrite = False
            hist_match = re.search(r"CONVERSATION HISTORY:\s*([\s\S]*?)(?:CURRENT CHAPTER|STUDENT QUESTION)", user_msg)
            if hist_match and any(w in raw_q.lower() for w in ["it", "its", "this", "example", "second", "why", "how"]):
                needs_rewrite = True
                hist_text = hist_match.group(1).lower()
                if "covalent" in hist_text:
                    if "example" in raw_q.lower():
                        resolved = "covalent bond examples"
                    elif "conduct" in raw_q.lower() or "electricity" in raw_q.lower():
                        resolved = "why covalent compounds do not conduct electricity"
                    else:
                        resolved = "covalent bond properties"
                elif "photosynthesis" in hist_text:
                    if "where" in raw_q.lower():
                        resolved = "where photosynthesis occurs site in plant cell"
                    else:
                        resolved = "photosynthesis process and equation"
                else:
                    resolved = f"{raw_q} textbook explanation"
            elif re.search(r"\b(ac|dc|gdp)\b", raw_q, re.IGNORECASE):
                needs_rewrite = True
                resolved = re.sub(r"\bac\b", "alternating current", raw_q, flags=re.IGNORECASE)
                resolved = re.sub(r"\bdc\b", "direct current", resolved, flags=re.IGNORECASE)
                resolved = re.sub(r"\bgdp\b", "gross domestic product", resolved, flags=re.IGNORECASE)

            sub_hint = "science" if any(w in resolved.lower() for w in ["bond", "reaction", "photo", "acid", "cell", "current", "force"]) else "social_science"
            return json.dumps({
                "standalone_query": resolved,
                "subject_hint": sub_hint,
                "chapter_hint": None,
                "needs_rewrite": needs_rewrite,
            })

        # 2. Multi-query expansion request
        if "variants" in sys_msg or "alternative search phrasings" in sys_msg:
            return json.dumps({
                "variants": [
                    "Class 10 syllabus concepts and textbook definitions",
                    "scientific mechanisms and key textbook terminology",
                ]
            })

        # 3. Context-situating enrichment request (offline cli)
        if "situating note" in sys_msg or "ENRICHMENT NOTE" in sys_msg:
            return "This section from Class 10 curriculum covers core definitions, scientific principles, and related textbook exercises."

        # 4. Standard Tutor Answer with Learning Modes
        if chunks and len(chunks) > 0:
            top_chunk = chunks[0]
            raw_text = getattr(top_chunk, "text", "")
            first_sentence = raw_text.split(".")[0].strip() if "." in raw_text else raw_text[:120].strip()
            chap_title = getattr(top_chunk, "chapter_title", "")
            chap_str = f" in {chap_title}" if chap_title else ""

            # Check learning modes
            if "STEP-BY-STEP" in sys_msg:
                body = (
                    f"1. First, {first_sentence.lower()}. [1]\n"
                    f"2. Second, this reaction or mechanism proceeds under specific conditions. [1]\n"
                    f"3. Third, the resulting textbook principles are verified. [1]"
                )
            elif "REAL-WORLD EXAMPLE" in sys_msg:
                body = (
                    f"Short Answer: Based on your Class 10 textbook{chap_str}, {first_sentence}. [1]\n\n"
                    f"Example: In daily life, the rusting of iron gates or souring of milk illustrates this chemical change in an Indian household.\n\n"
                    f"Brief Explanation: The textbook explains this concept clearly for Class 10 students. [1]"
                )
            elif "BOARD EXAM READY" in sys_msg:
                body = (
                    f"Definition: {first_sentence}. [1]\n\n"
                    f"Key Points:\n"
                    f"- Principal Mechanism: Described in detail in the syllabus. [1]\n"
                    f"- Governing Condition: Reaction parameters and exact chemical symbols apply. [1]\n"
                    f"- Examination Note: Key 3-mark or 5-mark answer point as per textbook guidelines. [1]"
                )
            else:
                # Simple mode
                body = (
                    f"Short Answer: Based on your Class 10 textbook{chap_str}, {first_sentence}. [1]\n\n"
                    f"Brief Explanation: The textbook explains this scientific concept clearly using simple terms. [1]"
                )

            sources = "Sources: [1]" if len(chunks) == 1 else "Sources: [1], [2]"
            suggestions = (
                "\n\nNext Questions:\n"
                "- What are the main properties of this topic?\n"
                "- Can you explain a real-world example?"
            )
            return f"{body}\n\n{sources}{suggestions}"

        # Context passed inside user_msg
        if "TEXTBOOK CONTEXT BLOCKS" in user_msg and "[1]" in user_msg:
            return (
                "Short Answer: Based on the textbook excerpt, the relevant concept is described clearly. [1]\n\n"
                "Brief Explanation: The provided context explains the scientific principles for Class 10 students. [1]\n\n"
                "Sources: [1]\n\n"
                "Next Questions:\n"
                "- What are the main characteristics?\n"
                "- How does this occur in practice?"
            )

        return (
            "Short Answer: I couldn't find this in your Class 10 textbook context.\n\n"
            "Brief Explanation: Please check your syllabus topic and verify that the chapter is indexed.\n\n"
            "Sources: none"
        )

    async def generate(
        self,
        messages: List[Dict[str, str]],
        chunks: Optional[List[Any]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate complete mock response asynchronously."""
        await asyncio.sleep(0.005)
        text = self._build_mock_text(messages, chunks)
        prompt_tokens = sum(len(m.get("content", "").split()) for m in messages)
        comp_tokens = len(text.split())

        return {
            "content": text,
            "provider": self.provider_name,
            "model": self.model_name,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": comp_tokens,
                "total_tokens": prompt_tokens + comp_tokens,
            },
            "mock": True,
        }

    async def stream(
        self,
        messages: List[Dict[str, str]],
        chunks: Optional[List[Any]] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Stream simulated word tokens asynchronously."""
        text = self._build_mock_text(messages, chunks)
        words = text.split(" ")
        for i, word in enumerate(words):
            delta = word if i == len(words) - 1 else word + " "
            await asyncio.sleep(0.002)
            yield delta
