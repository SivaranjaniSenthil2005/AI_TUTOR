"""PDF text extraction and chunking pipeline: generates structured JSONL chunks from data/raw."""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import pymupdf

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings


def classify_block_type(text: str, section_title: str = "") -> str:
    """Classifies chunk block type based on keywords and headings."""
    combined = f"{section_title} {text[:200]}".lower()
    if any(k in combined for k in ["summary", "points to ponder", "what you have learnt", "key takeaways", "in a nutshell"]):
        return "summary"
    if any(k in combined for k in ["glossary", "keywords", "definition", "terminologies"]):
        return "glossary"
    if any(k in combined for k in ["exercise", "evaluation", "questions", "choose the correct answer", "fill in the blanks", "match the following"]):
        return "exercise"
    if any(k in combined for k in ["activity", "project", "let us do", "hands-on", "experiment"]):
        return "activity"
    return "content"


def detect_chapter_info(page_text: str, current_chap_no: Optional[int], current_chap_title: str) -> tuple[Optional[int], str]:
    """Detects chapter number and title from page text."""
    lines = [l.strip() for l in page_text.splitlines() if l.strip()]
    for idx, line in enumerate(lines[:8]):
        # Match 'Chapter 1', 'UNIT 1', 'LESSON 1', '1. LAWS OF MOTION'
        chap_match = re.match(r"^(?:CHAPTER|UNIT|LESSON)\s*[-:]?\s*(\d+)\s*[:.\-]?\s*(.*)$", line, re.IGNORECASE)
        if chap_match:
            c_no = int(chap_match.group(1))
            c_title = chap_match.group(2).strip()
            if not c_title and idx + 1 < len(lines):
                c_title = lines[idx + 1].strip()
            return c_no, c_title or f"Chapter {c_no}"

        num_title_match = re.match(r"^(\d+)\s+([A-Z\s]{4,40})$", line)
        if num_title_match:
            c_no = int(num_title_match.group(1))
            c_title = num_title_match.group(2).strip().title()
            return c_no, c_title

    return current_chap_no, current_chap_title


def process_pdf_file(
    pdf_path: Path,
    board: str,
    class_level: int,
    subject: str,
    output_dir: Path,
    target_chunk_words: int = 250,
) -> int:
    """Extracts text from PDF, segments into semantic chunks, and saves to JSONL."""
    doc = pymupdf.open(pdf_path)
    book_title = doc.metadata.get("title") or pdf_path.stem.replace("_", " ").title()
    chunks = []
    
    current_chap_no = 1
    current_chap_title = f"{subject.replace('_', ' ').title()} - Part 1"
    
    chunk_counter = 1
    
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_no = page_idx + 1
        page_text = page.get_text()
        if not page_text or len(page_text.strip()) < 40:
            continue
            
        c_no, c_title = detect_chapter_info(page_text, current_chap_no, current_chap_title)
        if c_no is not None:
            current_chap_no = c_no
        if c_title:
            current_chap_title = c_title

        # Break text into paragraphs
        paragraphs = [p.strip() for p in page_text.split("\n\n") if p.strip()]
        current_words = []
        
        for para in paragraphs:
            p_words = para.split()
            current_words.extend(p_words)
            
            if len(current_words) >= target_chunk_words:
                chunk_text = " ".join(current_words)
                cid = f"{board}_{class_level}_{subject}_{pdf_path.stem[:12]}_p{page_no}_c{chunk_counter}"
                b_type = classify_block_type(chunk_text)
                
                context_header = f"Board: {board.upper()} | Class: {class_level} | Subject: {subject.title()} | Chapter {current_chap_no}: {current_chap_title} | Page: {page_no}"
                
                chunks.append({
                    "chunk_id": cid,
                    "text": chunk_text,
                    "context_header": context_header,
                    "board": board.lower(),
                    "class_level": class_level,
                    "subject": subject.lower(),
                    "book_title": book_title,
                    "term": None,
                    "chapter_no": current_chap_no,
                    "chapter_title": current_chap_title,
                    "section_title": None,
                    "block_type": b_type,
                    "page_start": page_no,
                    "page_end": page_no,
                    "source_file": pdf_path.name,
                })
                chunk_counter += 1
                current_words = []
                
        if current_words:
            chunk_text = " ".join(current_words)
            cid = f"{board}_{class_level}_{subject}_{pdf_path.stem[:12]}_p{page_no}_c{chunk_counter}"
            b_type = classify_block_type(chunk_text)
            context_header = f"Board: {board.upper()} | Class: {class_level} | Subject: {subject.title()} | Chapter {current_chap_no}: {current_chap_title} | Page: {page_no}"
            
            chunks.append({
                "chunk_id": cid,
                "text": chunk_text,
                "context_header": context_header,
                "board": board.lower(),
                "class_level": class_level,
                "subject": subject.lower(),
                "book_title": book_title,
                "term": None,
                "chapter_no": current_chap_no,
                "chapter_title": current_chap_title,
                "section_title": None,
                "block_type": b_type,
                "page_start": page_no,
                "page_end": page_no,
                "source_file": pdf_path.name,
            })
            chunk_counter += 1

    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f"{pdf_path.stem}_chunks.jsonl"
    
    with open(out_file, "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
            
    return len(chunks)


def process_all_raw_textbooks(raw_dir: Optional[Path] = None, processed_dir: Optional[Path] = None):
    """Discovers all PDFs under data/raw/{board}/class_{N}/{subject} and converts them to JSONL."""
    r_dir = Path(raw_dir or "data/raw")
    p_dir = Path(processed_dir or "data/processed")
    
    total_chunks = 0
    
    for pdf_file in r_dir.rglob("*.pdf"):
        rel_parts = pdf_file.relative_to(r_dir).parts
        if len(rel_parts) >= 3:
            board = rel_parts[0]
            class_str = rel_parts[1]
            subject = rel_parts[2]
            
            # Extract class number
            m = re.search(r"\d+", class_str)
            class_level = int(m.group(0)) if m else 10
            
            out_folder = p_dir / board / f"class_{class_level}" / subject
            n_chunks = process_pdf_file(pdf_file, board, class_level, subject, out_folder)
            print(f"Processed '{pdf_file.name}' -> {n_chunks} chunks in {out_folder}")
            total_chunks += n_chunks
            
    print(f"\nAll raw PDFs processed. Total chunks created: {total_chunks}")


if __name__ == "__main__":
    process_all_raw_textbooks()
