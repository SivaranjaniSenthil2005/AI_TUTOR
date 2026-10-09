"""Embedding generation with SentenceTransformer, normalized vectors, and query prefixing."""

import logging
from typing import List, Optional
import numpy as np
from app.config import settings

logger = logging.getLogger("ai_tutor.rag.embeddings")

# Prefix recommended for BGE models on queries
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


class EmbeddingModel:
    """Lazy-loaded SentenceTransformer embedding wrapper."""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or getattr(
            settings, "EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"
        )
        self._model = None

    def _get_device(self) -> str:
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            return "cpu"

    @property
    def model(self):
        if self._model is None:
            logger.info(f"Loading embedding model '{self.model_name}'...")
            from sentence_transformers import SentenceTransformer

            device = self._get_device()
            self._model = SentenceTransformer(self.model_name, device=device)
            logger.info(f"Embedding model '{self.model_name}' loaded on device: {device}")
        return self._model

    def is_loaded(self) -> bool:
        return self._model is not None

    def embed_query(self, query: str) -> List[float]:
        """Encodes a single query into a normalized vector.

        Applies BGE query instruction prefix if the model is a BGE model.
        """
        text = query.strip()
        if "bge" in self.model_name.lower() and not text.startswith(BGE_QUERY_PREFIX):
            text = f"{BGE_QUERY_PREFIX}{text}"

        embeddings = self.model.encode(
            [text],
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return embeddings[0].tolist()

    def embed_documents(self, texts: List[str], batch_size: int = 64) -> List[List[float]]:
        """Encodes a batch of document texts into normalized vectors without query prefixes."""
        if not texts:
            return []

        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return embeddings.tolist()


# Global singleton instance for lazy loading
_embedding_instance: Optional[EmbeddingModel] = None


def get_embedding_model() -> EmbeddingModel:
    global _embedding_instance
    if _embedding_instance is None:
        _embedding_instance = EmbeddingModel()
    return _embedding_instance


def set_embedding_model(model: EmbeddingModel) -> None:
    """Allows test fixtures to inject stubs/fakes."""
    global _embedding_instance
    _embedding_instance = model
