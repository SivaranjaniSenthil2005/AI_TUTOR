"""BM25 keyword index partitioned by (board, class_level, subject) with custom tokenization."""

import logging
import math
import os
import pickle
import re
import string
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from rank_bm25 import BM25Okapi
from app.config import settings
from app.rag.schemas import Chunk, RetrievalFilters

logger = logging.getLogger("ai_tutor.rag.keyword_index")

# Basic English stopwords list
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves",
}

# Try initializing NLTK stemmer or fallback regex stemmer
_stemmer = None
try:
    from nltk.stem.snowball import SnowballStemmer

    _stemmer = SnowballStemmer("english")
except Exception:
    _stemmer = None


def stem_word(word: str) -> str:
    """Stems a word using SnowballStemmer if available, or regex suffix stripper fallback."""
    if _stemmer is not None:
        try:
            return _stemmer.stem(word)
        except Exception:
            pass
    # Regex fallback suffix stripper
    w = word.lower()
    for suffix in ("ing", "ed", "es", "s", "ly", "tion", "ment", "ness", "able", "ible"):
        if len(w) > len(suffix) + 3 and w.endswith(suffix):
            return w[: -len(suffix)]
    return w


def tokenize(text: str) -> List[str]:
    """Tokenizes text: lowercases, removes punctuation, filters stopwords, and stems."""
    if not text:
        return []
    # Replace punctuation with whitespace
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = cleaned.split()
    results = []
    for t in tokens:
        if t and t not in STOPWORDS and len(t) > 1:
            results.append(stem_word(t))
    return results


def get_partition_key(board: str, class_level: int, subject: str) -> str:
    """Generates standardized key for partition file naming."""
    return f"{board.lower()}_class_{int(class_level)}_{subject.lower()}"


class BM25Partition:
    """BM25 index for a single (board, class_level, subject) partition."""

    def __init__(self, board: str, class_level: int, subject: str, chunks: List[Chunk]):
        self.board = board.lower()
        self.class_level = int(class_level)
        self.subject = subject.lower()
        self.chunks: List[Chunk] = chunks
        self.corpus_tokens: List[List[str]] = [
            tokenize(f"{c.context_header} {c.text}") for c in chunks
        ]
        if self.corpus_tokens:
            self.bm25 = BM25Okapi(self.corpus_tokens)
            # Apply Lucene positive IDF smoothing: ln(1 + (N - n + 0.5)/(n + 0.5))
            N = len(self.corpus_tokens)
            for word in list(self.bm25.idf.keys()):
                freq = sum(1 for d in self.bm25.doc_freqs if word in d)
                self.bm25.idf[word] = math.log(1.0 + (N - freq + 0.5) / (freq + 0.5))
        else:
            self.bm25 = None

    def search(
        self,
        query: str,
        chapter_no: Optional[int] = None,
        top_k: int = 20,
    ) -> List[Tuple[Chunk, float, int]]:
        """Searches partition with BM25 scoring and optional chapter filtering."""
        if not self.bm25 or not self.chunks:
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        doc_scores = self.bm25.get_scores(query_tokens)

        # Pair scores with chunks and apply optional chapter filter
        scored_candidates: List[Tuple[Chunk, float]] = []
        for idx, score in enumerate(doc_scores):
            if score <= 0.0:
                continue
            chunk = self.chunks[idx]
            if chapter_no is not None:
                if chunk.chapter_no is None or int(chunk.chapter_no) != int(chapter_no):
                    continue
            scored_candidates.append((chunk, float(score)))

        # Sort descending by BM25 score
        scored_candidates.sort(key=lambda item: (-item[1], item[0].chunk_id))
        top_candidates = scored_candidates[:top_k]

        return [(chunk, score, rank) for rank, (chunk, score) in enumerate(top_candidates, start=1)]


class KeywordIndexManager:
    """Manages partition-level BM25 indexes with disk persistence and lazy loading."""

    def __init__(self, index_dir: Optional[str] = None):
        self.index_dir = Path(index_dir or getattr(settings, "BM25_DIR", "data/index/bm25"))
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._partitions: Dict[str, BM25Partition] = {}

    def _get_partition_path(self, partition_key: str) -> Path:
        return self.index_dir / f"{partition_key}.pkl"

    def build_and_save_partition(
        self,
        board: str,
        class_level: int,
        subject: str,
        chunks: List[Chunk],
    ) -> BM25Partition:
        """Builds a BM25 partition and persists it to disk."""
        partition = BM25Partition(board, class_level, subject, chunks)
        key = get_partition_key(board, class_level, subject)
        self._partitions[key] = partition

        path = self._get_partition_path(key)
        with open(path, "wb") as f:
            pickle.dump(
                {
                    "board": partition.board,
                    "class_level": partition.class_level,
                    "subject": partition.subject,
                    "chunks": [c.model_dump() for c in partition.chunks],
                },
                f,
                protocol=pickle.HIGHEST_PROTOCOL,
            )
        logger.info(f"Saved BM25 partition '{key}' ({len(chunks)} chunks) to {path}")
        return partition

    def load_partition(self, board: str, class_level: int, subject: str) -> Optional[BM25Partition]:
        """Loads a BM25 partition from cache or disk."""
        key = get_partition_key(board, class_level, subject)
        if key in self._partitions:
            return self._partitions[key]

        path = self._get_partition_path(key)
        if not path.exists():
            return None

        try:
            with open(path, "rb") as f:
                data = pickle.load(f)
                chunks = [Chunk(**cd) for cd in data.get("chunks", [])]
                partition = BM25Partition(
                    board=data["board"],
                    class_level=data["class_level"],
                    subject=data["subject"],
                    chunks=chunks,
                )
                self._partitions[key] = partition
                return partition
        except Exception as e:
            logger.error(f"Error loading BM25 partition from {path}: {e}")
            return None

    def search(
        self,
        query: str,
        filters: RetrievalFilters,
        top_k: int = 20,
    ) -> List[Tuple[Chunk, float, int]]:
        """Queries the appropriate BM25 partition."""
        partition = self.load_partition(filters.board, filters.class_level, filters.subject)
        if not partition:
            return []
        return partition.search(query=query, chapter_no=filters.chapter_no, top_k=top_k)

    def list_available_partitions(self) -> List[str]:
        """Lists all existing partition keys on disk."""
        return [p.stem for p in self.index_dir.glob("*.pkl")]


_keyword_index_instance: Optional[KeywordIndexManager] = None


def get_keyword_index() -> KeywordIndexManager:
    global _keyword_index_instance
    if _keyword_index_instance is None:
        _keyword_index_instance = KeywordIndexManager()
    return _keyword_index_instance


def set_keyword_index(manager: KeywordIndexManager) -> None:
    global _keyword_index_instance
    _keyword_index_instance = manager
