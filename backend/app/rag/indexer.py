"""Corpus indexer: processes JSONL chunks from data/processed into ChromaDB and BM25 partitions."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from app.config import settings
from app.rag.schemas import Chunk, CorpusPartitionInfo, CorpusSummary
from app.rag.embeddings import get_embedding_model
from app.rag.vector_store import get_vector_store
from app.rag.keyword_index import get_keyword_index, get_partition_key

logger = logging.getLogger("ai_tutor.rag.indexer")


def load_chunks_from_jsonl(file_path: Path) -> List[Chunk]:
    """Parses a single JSONL file into a list of Chunk objects."""
    chunks = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_idx, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                data = json.loads(line_str)
                chunk = Chunk(
                    chunk_id=str(data["chunk_id"]),
                    text=str(data["text"]),
                    context_header=str(data.get("context_header", "")),
                    board=str(data["board"]).lower(),
                    class_level=int(data["class_level"]),
                    subject=str(data["subject"]).lower(),
                    book_title=str(data.get("book_title", "")),
                    term=int(data["term"]) if data.get("term") is not None else None,
                    chapter_no=int(data["chapter_no"]) if data.get("chapter_no") is not None else None,
                    chapter_title=str(data.get("chapter_title", "")),
                    section_title=str(data["section_title"]) if data.get("section_title") else None,
                    block_type=str(data.get("block_type", "content")),
                    page_start=int(data.get("page_start", 1)),
                    page_end=int(data.get("page_end", 1)),
                    source_file=str(data.get("source_file", file_path.name)),
                )
                chunks.append(chunk)
            except Exception as err:
                logger.warning(f"Malformed JSONL line {line_idx} in {file_path}: {err}")
    return chunks


def scan_processed_chunks(
    processed_dir: Optional[Path] = None,
    board_filter: Optional[str] = None,
    class_filter: Optional[int] = None,
    subject_filter: Optional[str] = None,
) -> Dict[Tuple[str, int, str], List[Chunk]]:
    """Scans data/processed/{board}/class_{N}/{subject}/*.jsonl files and groups chunks by partition."""
    p_dir = Path(processed_dir or getattr(settings, "PROCESSED_DATA_DIR", "data/processed"))
    partitions: Dict[Tuple[str, int, str], List[Chunk]] = {}

    if not p_dir.exists():
        logger.warning(f"Processed directory does not exist: {p_dir}")
        return partitions

    for jsonl_file in p_dir.rglob("*.jsonl"):
        chunks = load_chunks_from_jsonl(jsonl_file)
        for chunk in chunks:
            if board_filter and chunk.board.lower() != board_filter.lower():
                continue
            if class_filter and chunk.class_level != int(class_filter):
                continue
            if subject_filter and chunk.subject.lower() != subject_filter.lower():
                continue

            part_key = (chunk.board.lower(), int(chunk.class_level), chunk.subject.lower())
            if part_key not in partitions:
                partitions[part_key] = []
            partitions[part_key].append(chunk)

    return partitions


class CorpusIndexer:
    """Builds and updates vector store and keyword BM25 indexes."""

    def __init__(self, processed_dir: Optional[str] = None):
        self.processed_dir = Path(
            processed_dir or getattr(settings, "PROCESSED_DATA_DIR", "data/processed")
        )
        self.vector_store = get_vector_store()
        self.keyword_index = get_keyword_index()
        self.embedding_model = get_embedding_model()

    def index_corpus(
        self,
        board: Optional[str] = None,
        class_level: Optional[int] = None,
        subject: Optional[str] = None,
        rebuild: bool = False,
    ) -> Dict[str, Any]:
        """Indexes all or filtered partitions into ChromaDB and BM25."""
        partitions = scan_processed_chunks(
            processed_dir=self.processed_dir,
            board_filter=board,
            class_filter=class_level,
            subject_filter=subject,
        )

        total_chunks_indexed = 0
        partition_summaries = []

        for (b, c, s), chunks in partitions.items():
            if not chunks:
                continue

            logger.info(
                f"Indexing partition: Board={b.upper()}, Class={c}, Subject={s} ({len(chunks)} chunks)..."
            )

            # 1. Build and save BM25 Partition
            self.keyword_index.build_and_save_partition(
                board=b,
                class_level=c,
                subject=s,
                chunks=chunks,
            )

            # 2. Vector Store Ingestion
            # Generate embeddings for context_header + "\n" + text
            embed_texts = [c.get_embed_text() for c in chunks]
            embeddings = self.embedding_model.embed_documents(embed_texts)

            # Upsert into Chroma (idempotent by chunk_id)
            upserted = self.vector_store.upsert_chunks(chunks, embeddings)
            total_chunks_indexed += upserted

            # Compute chapter stats
            chapters_map: Dict[int, str] = {}
            for chunk in chunks:
                if chunk.chapter_no is not None:
                    chapters_map[chunk.chapter_no] = chunk.chapter_title or f"Chapter {chunk.chapter_no}"

            partition_summaries.append(
                {
                    "board": b,
                    "class_level": c,
                    "subject": s,
                    "chunk_count": len(chunks),
                    "chapter_count": len(chapters_map),
                    "chapters": [
                        {"chapter_no": c_num, "chapter_title": c_title}
                        for c_num, c_title in sorted(chapters_map.items())
                    ],
                }
            )

        return {
            "total_chunks_indexed": total_chunks_indexed,
            "total_partitions": len(partition_summaries),
            "partitions": partition_summaries,
        }

    def get_corpus_summary(self) -> CorpusSummary:
        """Inspects indexed partitions and returns a complete corpus summary."""
        partitions = scan_processed_chunks(processed_dir=self.processed_dir)
        info_list: List[CorpusPartitionInfo] = []
        total_chunks = 0

        for (b, c, s), chunks in partitions.items():
            total_chunks += len(chunks)
            chapters_map: Dict[int, str] = {}
            for chunk in chunks:
                if chunk.chapter_no is not None:
                    chapters_map[chunk.chapter_no] = chunk.chapter_title or f"Chapter {chunk.chapter_no}"

            info_list.append(
                CorpusPartitionInfo(
                    board=b,
                    class_level=c,
                    subject=s,
                    chunk_count=len(chunks),
                    chapter_count=len(chapters_map),
                    chapters=[
                        {"chapter_no": c_num, "chapter_title": c_title}
                        for c_num, c_title in sorted(chapters_map.items())
                    ],
                )
            )

        return CorpusSummary(
            total_chunks=total_chunks,
            total_partitions=len(info_list),
            partitions=info_list,
        )


_indexer_instance: Optional[CorpusIndexer] = None


def get_corpus_indexer() -> CorpusIndexer:
    global _indexer_instance
    if _indexer_instance is None:
        _indexer_instance = CorpusIndexer()
    return _indexer_instance
