"""Unit and integration tests for Phase 9: RAG hybrid retrieval, indexing, and reranking."""

import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple
import pytest
from fastapi.testclient import TestClient

# Ensure backend and ai_tutor are in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app
from app.config import settings
from app.rag.schemas import Chunk, RetrievalFilters, ScoredChunk
from app.rag.fusion import reciprocal_rank_fusion
from app.rag.block_policy import apply_block_policy
from app.rag.filters import build_chroma_filter, matches_filters_in_memory
from app.rag.retriever import (
    HybridRetriever,
    deduplicate_and_cap_diversity,
)
from app.rag.keyword_index import (
    BM25Partition,
    KeywordIndexManager,
    tokenize,
    stem_word,
)
from app.rag.vector_store import VectorStore
from app.rag.indexer import CorpusIndexer
from app.rag.embeddings import EmbeddingModel, set_embedding_model
from app.rag.reranker import RerankerModel, set_reranker_model


# Deterministic Fake Embedding Stub for Fast Unit Tests
class FakeEmbeddingModel:
    def __init__(self, dim: int = 8):
        self.model_name = "fake-embedding-stub"
        self.dim = dim

    def embed_query(self, query: str) -> List[float]:
        # Hash query words into fixed dim
        vec = [0.0] * self.dim
        for w in query.lower().split():
            vec[hash(w) % self.dim] += 1.0
        norm = sum(v * v for v in vec) ** 0.5 or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: List[str], batch_size: int = 64) -> List[List[float]]:
        return [self.embed_query(t) for t in texts]


# Deterministic Fake Cross-Encoder Reranker Stub for Fast Unit Tests
class FakeRerankerModel:
    def __init__(self):
        self.model_name = "fake-reranker-stub"

    def rerank(self, query: str, candidates: List[ScoredChunk], top_k: int = 5) -> List[ScoredChunk]:
        # Simple overlap-based fake scoring
        q_words = set(query.lower().split())
        scored = []
        for c in candidates:
            c_copy = c.model_copy(deep=True)
            doc_words = set(c.chunk.text.lower().split())
            overlap = len(q_words.intersection(doc_words))
            # Calculate mock score
            fake_score = c.score + (overlap * 0.5)
            c_copy.score = fake_score
            c_copy.stage_scores["reranker"] = fake_score
            scored.append(c_copy)
        scored.sort(key=lambda x: -x.score)
        for idx, item in enumerate(scored[:top_k], start=1):
            item.rank = idx
            item.stage_ranks["reranker"] = idx
        return scored[:top_k]


@pytest.fixture(autouse=True)
def inject_fake_models(monkeypatch):
    """Automatically injects fast stub models for all unit tests."""
    set_embedding_model(FakeEmbeddingModel())
    set_reranker_model(FakeRerankerModel())


def create_sample_chunk(
    cid: str,
    text: str,
    board: str = "cbse",
    class_level: int = 10,
    subject: str = "science",
    chapter_no: int = 1,
    chapter_title: str = "Chemical Reactions",
    section_title: str = "Types of Reactions",
    block_type: str = "content",
    page_start: int = 1,
    source_file: str = "chem_ch1.pdf",
) -> Chunk:
    return Chunk(
        chunk_id=cid,
        text=text,
        context_header=f"Board: {board} | Class: {class_level} | {chapter_title}",
        board=board,
        class_level=class_level,
        subject=subject,
        book_title=f"{subject.title()} Textbook",
        chapter_no=chapter_no,
        chapter_title=chapter_title,
        section_title=section_title,
        block_type=block_type,
        page_start=page_start,
        page_end=page_start,
        source_file=source_file,
    )


# 1. RRF Math and Tie Handling
def test_rrf_math_and_tie_handling():
    ranked_lists = {
        "vector": [("doc_a", 0.9), ("doc_b", 0.8), ("doc_c", 0.7)],
        "bm25": [("doc_b", 12.5), ("doc_a", 10.0), ("doc_d", 5.0)],
    }
    k = 60
    fused = reciprocal_rank_fusion(ranked_lists, k=k)

    # doc_a: 1/(60+1) + 1/(60+2) = 1/61 + 1/62 = 0.0163934 + 0.0161290 = 0.0325224
    # doc_b: 1/(60+2) + 1/(60+1) = 0.0325224 (tied score!)
    # On tie, sorted alphabetically by chunk_id -> doc_a before doc_b
    assert len(fused) == 4
    assert fused[0]["chunk_id"] == "doc_a"
    assert fused[1]["chunk_id"] == "doc_b"
    assert pytest.approx(fused[0]["fused_score"], rel=1e-4) == (1 / 61 + 1 / 62)
    assert fused[0]["stage_ranks"]["vector"] == 1
    assert fused[0]["stage_ranks"]["bm25"] == 2


# 2. BM25 Tokenization and Partitioning
def test_bm25_tokenization_and_partitioning():
    tokens = tokenize("Newton's second law of motion describes acceleration!")
    assert "newton" in tokens
    assert "second" in tokens
    assert "law" in tokens
    assert "motion" in tokens
    assert "of" not in tokens  # Stopword removed

    c1 = create_sample_chunk("c1", "Light bends when traveling from air into water due to refraction.")
    c2 = create_sample_chunk("c2", "Electric current is the rate of flow of electric charges in a circuit.")
    c3 = create_sample_chunk("c3", "Photosynthesis is the process by which green plants make food.", chapter_no=2)

    partition = BM25Partition("cbse", 10, "science", [c1, c2, c3])
    results = partition.search("light water refraction")
    assert len(results) >= 1
    assert results[0][0].chunk_id == "c1"

    # Chapter filter
    results_chap2 = partition.search("plants food photosynthesis", chapter_no=2)
    assert len(results_chap2) == 1
    assert results_chap2[0][0].chunk_id == "c3"

    results_chap1_mismatch = partition.search("photosynthesis", chapter_no=1)
    assert len(results_chap1_mismatch) == 0


# 3. Metadata Filters & Translation
def test_metadata_filters():
    filters = RetrievalFilters(board="tn", class_level=10, subject="science", chapter_no=3)
    chroma_f = build_chroma_filter(filters)
    assert "$and" in chroma_f
    assert {"board": {"$eq": "tn"}} in chroma_f["$and"]
    assert {"class_level": {"$eq": 10}} in chroma_f["$and"]
    assert {"chapter_no": {"$eq": 3}} in chroma_f["$and"]

    meta_match = {"board": "tn", "class_level": 10, "subject": "science", "chapter_no": 3}
    assert matches_filters_in_memory(meta_match, filters) is True

    meta_mismatch = {"board": "cbse", "class_level": 10, "subject": "science", "chapter_no": 3}
    assert matches_filters_in_memory(meta_mismatch, filters) is False


# 4. Block Policy (Exercise Exclusion & Summary Boosting)
def test_block_policy():
    c_content = create_sample_chunk("c1", "Normal content text", block_type="content")
    c_exercise = create_sample_chunk("c2", "Question 1: Fill in blanks", block_type="exercise")
    c_summary = create_sample_chunk("c3", "Summary of key takeaways", block_type="summary")
    c_glossary = create_sample_chunk("c4", "Glossary definitions", block_type="glossary")

    candidates = [
        ScoredChunk(chunk=c_content, score=1.0, rank=1),
        ScoredChunk(chunk=c_exercise, score=1.2, rank=2),
        ScoredChunk(chunk=c_summary, score=1.0, rank=3),
        ScoredChunk(chunk=c_glossary, score=1.0, rank=4),
    ]

    # Default: exercises excluded, summaries and glossaries boosted (1.0 * 1.15 = 1.15)
    filtered = apply_block_policy(candidates, include_exercises=False, summary_boost=1.2, glossary_boost=1.2)
    ids = [item.chunk.chunk_id for item in filtered]
    assert "c2" not in ids
    assert "c3" in ids
    assert "c4" in ids
    assert filtered[0].chunk.chunk_id in ("c3", "c4")
    assert filtered[0].score == 1.2

    # Include exercises flag
    with_exercises = apply_block_policy(candidates, include_exercises=True)
    assert any(it.chunk.chunk_id == "c2" for it in with_exercises)


# 5. Deduplication and Diversity Cap (Max 2 per section)
def test_deduplication_and_diversity_cap():
    c1 = create_sample_chunk("c1", "Identical duplicate text", section_title="Sec A")
    c2 = create_sample_chunk("c2", "Identical duplicate text", section_title="Sec A")
    c3 = create_sample_chunk("c3", "Different text 1 in Sec A", section_title="Sec A")
    c4 = create_sample_chunk("c4", "Different text 2 in Sec A", section_title="Sec A")
    c5 = create_sample_chunk("c5", "Different text 3 in Sec A", section_title="Sec A")
    c6 = create_sample_chunk("c6", "Text in Sec B", section_title="Sec B")

    candidates = [
        ScoredChunk(chunk=c1, score=1.0, rank=1),
        ScoredChunk(chunk=c2, score=0.9, rank=2),
        ScoredChunk(chunk=c3, score=0.8, rank=3),
        ScoredChunk(chunk=c4, score=0.7, rank=4),
        ScoredChunk(chunk=c5, score=0.6, rank=5),
        ScoredChunk(chunk=c6, score=0.5, rank=6),
    ]

    diversified = deduplicate_and_cap_diversity(candidates, max_per_section=2)
    # c2 removed (duplicate of c1)
    # Sec A has c1 and c3 -> c4 and c5 capped out
    # c6 included from Sec B
    result_ids = [item.chunk.chunk_id for item in diversified]
    assert result_ids == ["c1", "c3", "c6"]


# 6. Idempotent Indexing and Stale Chunk Removal
def test_idempotent_indexing_and_stale_removal(tmp_path):
    chroma_dir = tmp_path / "chroma"
    bm25_dir = tmp_path / "bm25"
    vstore = VectorStore(persist_dir=str(chroma_dir))
    fake_embed = FakeEmbeddingModel()

    chunks_v1 = [
        create_sample_chunk("c1", "Original version of passage one", source_file="doc1.pdf"),
        create_sample_chunk("c2", "Original version of passage two", source_file="doc1.pdf"),
    ]
    embs_v1 = fake_embed.embed_documents([c.get_embed_text() for c in chunks_v1])
    vstore.upsert_chunks(chunks_v1, embs_v1)
    assert vstore.count() == 2

    # Idempotent re-upsert does not duplicate
    vstore.upsert_chunks(chunks_v1, embs_v1)
    assert vstore.count() == 2

    # Stale chunk removal when doc is re-ingested
    vstore.delete_by_source_file("doc1.pdf")
    assert vstore.count() == 0


# 7. Retriever Mode Switching
def test_retriever_mode_switching(tmp_path):
    chroma_dir = tmp_path / "chroma"
    bm25_dir = tmp_path / "bm25"
    vstore = VectorStore(persist_dir=str(chroma_dir))
    kindex = KeywordIndexManager(index_dir=str(bm25_dir))

    c1 = create_sample_chunk("c1", "Speed of sound is slower than speed of light.", board="cbse", class_level=10, subject="science")
    c2 = create_sample_chunk("c2", "Reflection of sound waves results in an echo.", board="cbse", class_level=10, subject="science")

    fake_embed = FakeEmbeddingModel()
    vstore.upsert_chunks([c1, c2], fake_embed.embed_documents([c1.get_embed_text(), c2.get_embed_text()]))
    kindex.build_and_save_partition("cbse", 10, "science", [c1, c2])

    from app.rag.vector_store import set_vector_store
    from app.rag.keyword_index import set_keyword_index
    set_vector_store(vstore)
    set_keyword_index(kindex)

    retriever = HybridRetriever()
    filters = RetrievalFilters(board="cbse", class_level=10, subject="science")

    # Test modes
    for mode in ["vector_only", "bm25_only", "hybrid", "hybrid_rerank"]:
        res = retriever.retrieve("echo reflection sound", filters=filters, mode=mode, top_k=2, include_debug_trace=True)
        assert res.mode == mode
        assert len(res.chunks) > 0
        assert "total_ms" in res.timings_ms
        assert res.debug_trace is not None


# 8. API Validation and 503 on unindexed corpus
def test_api_validation_and_503(tmp_path):
    client = TestClient(app)

    # Validation: bad board
    res_bad_board = client.post(
        "/api/retrieve",
        json={"query": "test query", "board": "invalid_board", "class_level": 10, "subject": "science"},
    )
    assert res_bad_board.status_code == 422

    # Validation: bad class level (< 6 or > 12)
    res_bad_class = client.post(
        "/api/retrieve",
        json={"query": "test query", "board": "cbse", "class_level": 4, "subject": "science"},
    )
    assert res_bad_class.status_code == 422

    # 503 on unindexed partition
    from app.rag.vector_store import set_vector_store
    from app.rag.keyword_index import set_keyword_index
    empty_vstore = VectorStore(persist_dir=str(tmp_path / "empty_chroma"))
    empty_kindex = KeywordIndexManager(index_dir=str(tmp_path / "empty_bm25"))
    set_vector_store(empty_vstore)
    set_keyword_index(empty_kindex)

    res_503 = client.post(
        "/api/retrieve",
        json={"query": "test query", "board": "cbse", "class_level": 10, "subject": "nonexistent"},
    )
    assert res_503.status_code == 503
    assert "Corpus index is not built yet" in res_503.json()["detail"]


# 9. Optional Real Model Integration Test (Skipped by default)
@pytest.mark.skipif(
    os.getenv("RUN_REAL_MODEL_TESTS", "0") != "1",
    reason="Real model tests require downloading ~400MB HuggingFace weights (enable with RUN_REAL_MODEL_TESTS=1)",
)
def test_real_embedding_and_reranker_integration():
    real_embed = EmbeddingModel()
    vec = real_embed.embed_query("Why is the sky blue?")
    assert len(vec) == 384  # BGE small embedding dimension

    real_reranker = RerankerModel()
    dummy_candidate = ScoredChunk(
        chunk=create_sample_chunk("c1", "Atmospheric scattering of sunlight by fine air molecules makes the sky appear blue."),
        score=0.5,
        rank=1,
    )
    reranked = real_reranker.rerank("sky blue scattering", [dummy_candidate], top_k=1)
    assert len(reranked) == 1
    assert reranked[0].score is not None
