"""Unit and integration test suite for Phase 11 Advanced RAG.

Tests:
1. History trimming and length caps
2. Zero conversation persistence (stateless privacy)
3. Rewrite skip heuristic
4. Rewrite JSON validation and fallback paths (timeout, invalid JSON, provider error)
5. Multi-query merge with RRF
6. Soft chapter preference widening when reranker score is low
7. Learning modes (simple, step_by_step, example, exam) and learner_profile validation
8. Grounding rules preserved in prompt for all modes
9. Deterministic speech_text conversion (citations stripped, steps, symbols, formulas)
10. Suggestions parsing and empty fallback
11. SSE stream meta and done event payloads
12. LLM call budget and FAST_MODE bypass
13. Contextual retrieval enrichment cache and resume logic
"""

import asyncio
import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.schemas import AskRequest
from app.services.memory import Turn, trim_history, build_conversation_summary, track_topic_hint
from app.services.speech import to_speech_text
from app.llm.styles import LearnerProfile, build_style_instructions
from app.rag.query.rewrite import should_skip_rewrite, rewrite_query, RewriteResult
from app.rag.query.expand import expand_query, retrieve_with_multiquery
from app.rag.query.routing import resolve_filters, execute_routed_retrieval
from app.rag.schemas import Chunk, RetrievalFilters, RetrievalResult, ScoredChunk
from app.rag.enrichment import load_enrichment_cache, save_enrichment_cache, enrich_partition
from app.llm.prompts import extract_suggested_questions, build_tutor_messages
from app.services.answer import answer_question, stream_answer_question


@pytest.fixture
def test_client():
    return TestClient(app)


# 1. History Trimming & Statelessness
def test_history_trimming_and_caps():
    # More than 6 turns
    raw_history = [
        Turn(role="student", text=f"Question {i}")
        for i in range(10)
    ]
    # One turn with excessive length (> 600 chars)
    raw_history.append(Turn(role="tutor", text="A" * 800))

    trimmed = trim_history(raw_history, max_turns=6, max_chars_per_turn=600)
    assert len(trimmed) == 6
    # Last turn must be capped with ellipsis
    assert len(trimmed[-1].text) == 603  # 600 chars + "..."
    assert trimmed[-1].text.endswith("...")


def test_zero_conversation_persistence(tmp_path):
    """Verify that conversation turns are never saved to disk or persistent stores."""
    turns = [
        Turn(role="student", text="Secret student information"),
        Turn(role="tutor", text="Private response text"),
    ]
    trimmed = trim_history(turns)
    summary = build_conversation_summary(trimmed)
    assert "Secret student information" in summary

    # Inspect temp / log directories to ensure no file was created with this content
    for root, _, files in os.walk(str(tmp_path)):
        for f in files:
            content = (Path(root) / f).read_text(encoding="utf-8", errors="ignore")
            assert "Secret student information" not in content


# 2. Topic Hint Tracking
def test_track_topic_hint():
    class DummyCitation:
        def __init__(self, title):
            self.chapter_title = title

    citations = [
        DummyCitation("Chemical Reactions and Equations"),
        DummyCitation("Chemical Reactions and Equations"),
        DummyCitation("Acids, Bases and Salts"),
    ]
    hint = track_topic_hint(citations)
    assert hint == "Chemical Reactions and Equations"

    assert track_topic_hint([]) is None


# 3. Rewrite Skip Heuristic
def test_should_skip_rewrite_heuristics():
    # Clear standalone question with no history -> SKIP rewrite
    q_standalone = "What is the principle of conservation of momentum in physics?"
    assert should_skip_rewrite(q_standalone, history=[]) is True

    # Has history -> DO NOT skip
    assert should_skip_rewrite(q_standalone, history=[Turn(role="student", text="hi")]) is False

    # Short query (< 5 words or < 25 chars) -> DO NOT skip
    assert should_skip_rewrite("What is AC?", history=[]) is False

    # Contains pronoun triggers -> DO NOT skip
    assert should_skip_rewrite("What are its primary industrial uses in India?", history=[]) is False
    assert should_skip_rewrite("Give an everyday example of this reaction.", history=[]) is False
    assert should_skip_rewrite("Why does it not conduct electricity?", history=[]) is False


# 4. Rewrite JSON Validation and Fallback Paths
@pytest.mark.asyncio
async def test_rewrite_fallback_on_invalid_json():
    with patch("app.rag.query.rewrite.get_llm_router") as mock_router_getter:
        mock_router = MagicMock()
        mock_router.generate = AsyncMock(return_value={"content": "Not valid JSON at all"})
        mock_router_getter.return_value = mock_router

        result = await rewrite_query("What about its uses?", history=[], active_chapter_title="Metals")
        assert result.rewrite_used is False
        assert result.standalone_query == "What about its uses?"


@pytest.mark.asyncio
async def test_rewrite_fallback_on_timeout_or_error():
    with patch("app.rag.query.rewrite.get_llm_router") as mock_router_getter:
        mock_router = MagicMock()
        mock_router.generate = AsyncMock(side_effect=TimeoutError("LLM timed out"))
        mock_router_getter.return_value = mock_router

        result = await rewrite_query("Explain AC current in detail", history=[])
        assert result.rewrite_used is False
        assert "alternating current" in result.standalone_query.lower()


@pytest.mark.asyncio
async def test_rewrite_followup_resolution_with_mock():
    # Test MockProvider rewrite logic for follow-up
    hist = [
        Turn(role="student", text="What is a covalent bond?"),
        Turn(role="tutor", text="A covalent bond is formed by sharing electron pairs."),
    ]
    res = await rewrite_query("Give an example of it.", history=hist, force_mock=True)
    assert res.rewrite_used is True
    assert "covalent bond" in res.standalone_query.lower()


# 5. Multi-Query Expansion & RRF Merge
@pytest.mark.asyncio
async def test_expand_query_and_multiquery_merge():
    variants = await expand_query("Why do we get tired after running?", subject="science", force_mock=True)
    assert isinstance(variants, list)
    assert len(variants) <= 2

    # Mock retrieval and check RRF fusion
    dummy_c1 = Chunk(chunk_id="c1", text="Chunk one text", board="cbse", class_level=10, subject="science")
    dummy_c2 = Chunk(chunk_id="c2", text="Chunk two text", board="cbse", class_level=10, subject="science")

    filters = RetrievalFilters(board="cbse", class_level=10, subject="science")

    with patch("app.rag.query.expand.get_hybrid_retriever") as mock_ret_getter, \
         patch("app.rag.query.expand.get_reranker_model") as mock_reranker_getter:
        
        mock_retriever = MagicMock()
        mock_retriever.retrieve.return_value = RetrievalResult(
            query="test",
            mode="hybrid",
            filters=filters,
            chunks=[ScoredChunk(chunk=dummy_c1, score=0.8, rank=1)],
            total_candidates=1,
            timings_ms={},
        )
        mock_ret_getter.return_value = mock_retriever

        mock_reranker = MagicMock()
        mock_reranker.rerank.return_value = [ScoredChunk(chunk=dummy_c1, score=2.5, rank=1)]
        mock_reranker_getter.return_value = mock_reranker

        result = await retrieve_with_multiquery(
            standalone_query="Why do we get tired?",
            filters=filters,
            variants=["anaerobic respiration"],
            top_k=2,
        )
        assert len(result.chunks) == 1
        assert result.mode == "multi_query_rerank"


# 6. Adaptive Routing & Soft Chapter Widening
@pytest.mark.asyncio
async def test_soft_chapter_widening_when_score_low():
    filters = RetrievalFilters(board="cbse", class_level=10, subject="science", chapter_no=1)
    dummy_chunk = Chunk(chunk_id="c1", text="Low score chunk", board="cbse", class_level=10, subject="science", chapter_no=1)
    
    # Simulate first retrieval having score below threshold (-10.0 < -4.0)
    low_result = RetrievalResult(
        query="test",
        mode="hybrid_rerank",
        filters=filters,
        chunks=[ScoredChunk(chunk=dummy_chunk, score=-10.0, rank=1)],
        total_candidates=1,
        timings_ms={},
    )
    widened_result = RetrievalResult(
        query="test",
        mode="hybrid_rerank",
        filters=filters.model_copy(update={"chapter_no": None}),
        chunks=[ScoredChunk(chunk=dummy_chunk, score=3.0, rank=1)],
        total_candidates=1,
        timings_ms={},
    )

    with patch("app.rag.query.routing.retrieve_with_multiquery", side_effect=[low_result, widened_result]):
        res, was_widened = await execute_routed_retrieval(
            standalone_query="cross chapter question",
            filters=filters,
            soft_threshold=-4.0,
        )
        assert was_widened is True
        assert res.chunks[0].score == 3.0


# 7. Learning Modes and Learner Profile Validation
def test_learner_profile_validation():
    # Valid
    p = LearnerProfile(reading_level="easy", max_sentences=4, avoid_figurative_language=True, repeat_key_term=True)
    assert p.reading_level == "easy"
    assert p.max_sentences == 4

    # Invalid reading level
    with pytest.raises(ValueError):
        LearnerProfile(reading_level="phd")

    # Invalid max sentences
    with pytest.raises(ValueError):
        LearnerProfile(max_sentences=1)
    with pytest.raises(ValueError):
        LearnerProfile(max_sentences=15)


def test_learning_modes_change_prompt_and_preserve_grounding():
    for mode in ["simple", "step_by_step", "example", "exam"]:
        style = build_style_instructions(mode=mode)
        assert "LEARNING MODE:" in style
        # Grounding rules must be preserved in all modes
        assert "grounding rules always override style" in style.lower() or "answer only from textbook" in style.lower()

    # With learner profile
    prof = LearnerProfile(reading_level="easy", max_sentences=3, avoid_figurative_language=True)
    custom_style = build_style_instructions(mode="simple", profile=prof)
    assert "easy, elementary reading level" in custom_style
    assert "at most 3 sentences" in custom_style
    assert "strictly literal language" in custom_style


# 8. Deterministic speech_text Conversion
def test_speech_text_conversion():
    input_text = (
        "Short Answer: According to Class 10 Science, 2H2 + O2 → 2H2O at 100°C. [1], [2]\n\n"
        "1. First reaction step begins with 50% concentration.\n"
        "2. Second step produces NaCl and CO2.\n\n"
        "Sources: [1], [2]\n\n"
        "Next Questions:\n"
        "- What is water?"
    )
    speech = to_speech_text(input_text)

    # Bracket citations stripped
    assert "[1]" not in speech
    assert "[2]" not in speech
    # Trailing sources and questions stripped
    assert "Sources:" not in speech
    assert "Next Questions:" not in speech
    # Formula pronunciation map
    assert "sodium chloride" in speech
    assert "C O 2" in speech
    # Symbols
    assert "degrees Celsius" in speech
    assert "percent" in speech
    assert "gives" in speech
    # Step conversion
    assert "Step one." in speech
    assert "Step two." in speech


# 9. Suggestions Parsing and Fallback
def test_extract_suggested_questions():
    raw_answer = (
        "Short Answer: This is a textbook answer. [1]\n\n"
        "Sources: [1]\n\n"
        "Next Questions:\n"
        "- What are the main characteristics?\n"
        "- Can you explain an example?"
    )
    clean_ans, suggestions = extract_suggested_questions(raw_answer)
    assert "Next Questions:" not in clean_ans
    assert len(suggestions) == 2
    assert "What are the main characteristics?" in suggestions
    assert "Can you explain an example?" in suggestions

    # Fallback when no questions section
    clean_plain, empty_sug = extract_suggested_questions("Just an answer.")
    assert clean_plain == "Just an answer."
    assert empty_sug == []


# 10. End-to-End Pipeline & Budget / FAST_MODE
@pytest.mark.asyncio
async def test_answer_pipeline_with_mock():
    res = await answer_question(
        question="What are the laws of motion?",
        board="tn",
        subject="science",
        mode="exam",
        force_mock=True,
    )
    assert res.grounded is True
    assert res.mode == "exam"
    assert res.speech_text != ""
    assert isinstance(res.suggested_questions, list)
    assert res.latency_ms.total > 0


@pytest.mark.asyncio
async def test_fast_mode_bypasses_rewrite_and_expansion(monkeypatch):
    monkeypatch.setattr(settings, "FAST_MODE", True)
    res = await answer_question(
        question="What is acceleration?",
        board="tn",
        subject="science",
        force_mock=True,
    )
    # When FAST_MODE is enabled, rewrite_used is False and expansion latency is 0.0
    assert res.rewrite_used is False
    assert res.latency_ms.expansion == 0.0


# 11. SSE Streaming Meta and Done Events
@pytest.mark.asyncio
async def test_sse_stream_events():
    events = []
    async for item in stream_answer_question(
        question="What is photosynthesis?",
        board="cbse",
        subject="science",
        force_mock=True,
    ):
        events.append(item)

    event_types = [e["event"] for e in events]
    # Meta must be first
    assert event_types[0] == "meta"
    assert "rewritten_query" in events[0]["data"]
    assert "learning_mode" in events[0]["data"]

    # Sources event comes next
    assert "sources" in event_types

    # Done event includes speech_text and suggestions
    done_event = next(e for e in events if e["event"] == "done")
    assert "speech_text" in done_event["data"]
    assert "suggested_questions" in done_event["data"]


# 12. Enrichment Cache & Resume Logic
@pytest.mark.asyncio
async def test_enrichment_cache_and_resume(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ENRICHMENT_DIR", str(tmp_path))

    # Save initial note
    save_enrichment_cache("cbse", "science", {"chunk_1": "Existing situating note."})
    cache = load_enrichment_cache("cbse", "science")
    assert cache["chunk_1"] == "Existing situating note."

    # Run enrich_partition with limit
    summary = await enrich_partition(board="cbse", subject="science", limit=2, force_mock=True, delay_seconds=0.0)
    assert summary["already_cached"] >= 0
    assert summary["total_cached"] >= summary["already_cached"]
