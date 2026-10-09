"""ChromaDB vector store with persistent storage, metadata filtering, and upsert/delete operations."""

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from app.config import settings
from app.rag.schemas import Chunk, RetrievalFilters
from app.rag.filters import build_chroma_filter

logger = logging.getLogger("ai_tutor.rag.vector_store")

COLLECTION_NAME = "ai_tutor_chunks"


class VectorStore:
    """Persistent ChromaDB vector store for AI Tutor chunks."""

    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or getattr(settings, "CHROMA_DIR", "data/index/chroma")
        Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self._client = chromadb.PersistentClient(
                path=str(self.persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False, is_persistent=True),
            )
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def count(self) -> int:
        """Returns the total number of items in the vector collection."""
        try:
            return self.collection.count()
        except Exception:
            return 0

    def upsert_chunks(
        self,
        chunks: List[Chunk],
        embeddings: List[List[float]],
    ) -> int:
        """Upserts chunks and their corresponding embeddings into the collection (idempotent)."""
        if not chunks:
            return 0

        ids = [c.chunk_id for c in chunks]
        documents = [c.text for c in chunks]
        metadatas = []

        for c in chunks:
            meta = {
                "chunk_id": str(c.chunk_id),
                "board": str(c.board).lower(),
                "class_level": int(c.class_level),
                "subject": str(c.subject).lower(),
                "book_title": str(c.book_title or ""),
                "chapter_title": str(c.chapter_title or ""),
                "section_title": str(c.section_title or ""),
                "block_type": str(c.block_type or "content").lower(),
                "page_start": int(c.page_start or 1),
                "page_end": int(c.page_end or 1),
                "source_file": str(c.source_file or ""),
                "context_header": str(c.context_header or ""),
            }
            if c.chapter_no is not None:
                meta["chapter_no"] = int(c.chapter_no)
            if c.term is not None:
                meta["term"] = int(c.term)
            metadatas.append(meta)

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        return len(chunks)

    def delete_by_source_file(self, source_file: str) -> int:
        """Deletes all chunks associated with a specific source file."""
        try:
            results = self.collection.get(
                where={"source_file": {"$eq": source_file}},
                include=["metadatas"],
            )
            ids = results.get("ids", [])
            if ids:
                self.collection.delete(ids=ids)
                logger.info(f"Deleted {len(ids)} stale chunks for source file '{source_file}'")
                return len(ids)
        except Exception as e:
            logger.warning(f"Failed to delete stale chunks for '{source_file}': {e}")
        return 0

    def delete_by_ids(self, chunk_ids: List[str]) -> int:
        """Deletes specific chunk IDs from the collection."""
        if not chunk_ids:
            return 0
        try:
            self.collection.delete(ids=chunk_ids)
            return len(chunk_ids)
        except Exception as e:
            logger.warning(f"Error deleting chunks: {e}")
            return 0

    def query_vector(
        self,
        query_embedding: List[float],
        filters: RetrievalFilters,
        top_k: int = 20,
    ) -> List[Tuple[Chunk, float, int]]:
        """Queries the vector index for closest cosine neighbors matching the metadata filter.

        Returns:
            List of (Chunk, similarity_score, rank_1_indexed)
        """
        if self.count() == 0:
            return []

        chroma_filter = build_chroma_filter(filters)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=chroma_filter,
            include=["metadatas", "documents", "distances"],
        )

        matched_chunks: List[Tuple[Chunk, float, int]] = []
        ids_list = results.get("ids", [[]])[0]
        docs_list = results.get("documents", [[]])[0]
        metas_list = results.get("metadatas", [[]])[0]
        dists_list = results.get("distances", [[]])[0]

        for rank, (chunk_id, doc, meta, dist) in enumerate(
            zip(ids_list, docs_list, metas_list, dists_list), start=1
        ):
            # Chroma returns cosine distance in [0, 2]; convert to similarity in [-1, 1] / [0, 1]
            similarity = 1.0 - float(dist)
            chunk = Chunk(
                chunk_id=str(meta.get("chunk_id", chunk_id)),
                board=str(meta.get("board", filters.board)),
                class_level=int(meta.get("class_level", filters.class_level)),
                subject=str(meta.get("subject", filters.subject)),
                book_title=str(meta.get("book_title", "")),
                term=int(meta["term"]) if "term" in meta and meta["term"] is not None else None,
                chapter_no=int(meta["chapter_no"]) if "chapter_no" in meta and meta["chapter_no"] is not None else None,
                chapter_title=str(meta.get("chapter_title", "")),
                section_title=str(meta.get("section_title", "")) if meta.get("section_title") else None,
                block_type=str(meta.get("block_type", "content")),
                page_start=int(meta.get("page_start", 1)),
                page_end=int(meta.get("page_end", 1)),
                source_file=str(meta.get("source_file", "")),
                text=str(doc),
                context_header=str(meta.get("context_header", "")),
            )
            matched_chunks.append((chunk, similarity, rank))

        return matched_chunks


_vector_store_instance: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _vector_store_instance
    if _vector_store_instance is None:
        _vector_store_instance = VectorStore()
    return _vector_store_instance


def set_vector_store(store: VectorStore) -> None:
    global _vector_store_instance
    _vector_store_instance = store
