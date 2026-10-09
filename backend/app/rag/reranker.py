"""Cross-encoder reranker wrapper for rescoring top retrieval candidates."""

import logging
from typing import List, Optional, Tuple
from app.config import settings
from app.rag.schemas import ScoredChunk

logger = logging.getLogger("ai_tutor.rag.reranker")

MAX_CHUNK_CHARS = 1500


class RerankerModel:
    """Lazy-loaded CrossEncoder reranking model."""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or getattr(
            settings, "RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
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
            logger.info(f"Loading cross-encoder reranker '{self.model_name}'...")
            from sentence_transformers import CrossEncoder

            device = self._get_device()
            self._model = CrossEncoder(self.model_name, device=device)
            logger.info(f"Cross-encoder '{self.model_name}' loaded on device: {device}")
        return self._model

    def is_loaded(self) -> bool:
        return self._model is not None

    def rerank(
        self,
        query: str,
        candidates: List[ScoredChunk],
        top_k: int = 5,
    ) -> List[ScoredChunk]:
        """Rescores candidates using the cross-encoder and returns top_k sorted descending.

        Truncates chunk text to MAX_CHUNK_CHARS for efficiency.
        """
        if not candidates:
            return []

        pairs: List[Tuple[str, str]] = []
        for item in candidates:
            text = item.chunk.text
            if item.chunk.context_header:
                text = f"{item.chunk.context_header}\n{text}"
            truncated_text = text[:MAX_CHUNK_CHARS]
            pairs.append((query, truncated_text))

        raw_scores = self.model.predict(pairs, show_progress_bar=False)
        scored_results: List[ScoredChunk] = []

        for item, score in zip(candidates, raw_scores):
            reranked_item = item.model_copy(deep=True)
            reranked_item.score = float(score)
            reranked_item.stage_scores["reranker"] = float(score)
            scored_results.append(reranked_item)

        # Sort descending by cross-encoder score
        scored_results.sort(key=lambda item: -item.score)

        final_top = scored_results[:top_k]
        for idx, item in enumerate(final_top, start=1):
            item.rank = idx
            item.stage_ranks["reranker"] = idx

        return final_top


_reranker_instance: Optional[RerankerModel] = None


def get_reranker_model() -> RerankerModel:
    global _reranker_instance
    if _reranker_instance is None:
        _reranker_instance = RerankerModel()
    return _reranker_instance


def set_reranker_model(model: RerankerModel) -> None:
    global _reranker_instance
    _reranker_instance = model
