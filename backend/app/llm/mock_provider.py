"""Deterministic offline mock provider for AI Tutor.

Operates without API keys or network access, enabling offline testing,
automated CI/CD verification, and local demonstration.
"""

import asyncio
from typing import Any, AsyncGenerator, Dict, List, Optional


class MockProvider:
    """Deterministic Mock LLM provider that synthesizes grounded responses from context."""

    def __init__(self, model_name: str = "mock-tutor-v1"):
        self.provider_name = "mock"
        self.model_name = model_name

    def _build_mock_text(self, messages: List[Dict[str, str]], chunks: Optional[List[Any]] = None) -> str:
        """Construct deterministic grounded text from provided context."""
        # Find user message content
        user_msg = ""
        for m in messages:
            if m.get("role") == "user":
                user_msg = m.get("content", "")

        # If chunks provided or text contains context markers
        if chunks and len(chunks) > 0:
            top_chunk = chunks[0]
            raw_text = getattr(top_chunk, "text", "")
            # Pick first complete sentence or first 120 chars
            first_sentence = raw_text.split(".")[0].strip() if "." in raw_text else raw_text[:120].strip()
            chap_title = getattr(top_chunk, "chapter_title", "")
            chap_str = f" in {chap_title}" if chap_title else ""

            text = (
                f"Short Answer: Based on your Class 10 textbook{chap_str}, {first_sentence}. [1]\n\n"
                f"Brief Explanation: The textbook explains that {first_sentence.lower()} for Class 10 students. [1]\n\n"
                f"Sources: [1]"
            )
            if len(chunks) > 1:
                text = (
                    f"Short Answer: Based on your Class 10 textbook{chap_str}, {first_sentence}. [1]\n\n"
                    f"Brief Explanation: The curriculum details this concept clearly across the syllabus chapters. [1], [2]\n\n"
                    f"Sources: [1], [2]"
                )
            return text

        # Check if context was passed inside user_msg
        if "TEXTBOOK CONTEXT BLOCKS" in user_msg and "[1]" in user_msg:
            return (
                "Short Answer: Based on the textbook excerpt, the relevant concept is described clearly. [1]\n\n"
                "Brief Explanation: The provided context explains the scientific principles for Class 10 students. [1]\n\n"
                "Sources: [1]"
            )

        return (
            "Short Answer: I couldn't find this topic in your Class 10 textbook context.\n\n"
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
        # Simulate slight processing latency (5ms)
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
        # Yield words with space
        words = text.split(" ")
        for i, word in enumerate(words):
            delta = word if i == len(words) - 1 else word + " "
            await asyncio.sleep(0.002)
            yield delta
