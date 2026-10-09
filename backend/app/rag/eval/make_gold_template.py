"""Helper script to sample chunks and generate a draft gold evaluation YAML template."""

import random
import sys
from pathlib import Path
from typing import Optional
import typer
import yaml
from rich.console import Console

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.rag.indexer import scan_processed_chunks

app = typer.Typer(help="Draft Gold Set Generator for AI Tutor Evaluation")
console = Console()


@app.command()
def generate(
    board: str = typer.Option(..., "--board", "-b", help="Board: 'tn' or 'cbse'"),
    class_level: int = typer.Option(..., "--class", "-c", help="Class level (6-12)"),
    subject: str = typer.Option(..., "--subject", "-s", help="Subject"),
    n: int = typer.Option(10, "--n", help="Number of items to sample"),
    output_path: Optional[str] = typer.Option(None, "--output", "-o", help="Custom output path"),
):
    """Samples chunks across chapters and creates a draft gold_set.draft.yaml."""
    console.print(f"[bold cyan]AI Tutor - Gold Evaluation Template Generator[/bold cyan]")
    console.print(f"Target: [green]{board.upper()} Class {class_level} {subject}[/green] | Sample Count: [yellow]{n}[/yellow]\n")

    partitions = scan_processed_chunks(
        board_filter=board,
        class_filter=class_level,
        subject_filter=subject,
    )

    part_key = (board.lower(), int(class_level), subject.lower())
    chunks = partitions.get(part_key, [])

    if not chunks:
        console.print(f"[red]Error: No processed chunks found for {board} class {class_level} {subject}.[/red]")
        console.print("[yellow]Please run the chunking / ingestion pipeline first.[/yellow]")
        raise typer.Exit(code=1)

    # Filter for content chunks with valid chapter numbers
    content_chunks = [c for c in chunks if c.block_type in ("content", "summary") and c.chapter_no is not None]
    if not content_chunks:
        content_chunks = chunks

    # Group by chapter to ensure diverse chapter representation
    by_chapter = {}
    for c in content_chunks:
        chap = c.chapter_no or 0
        if chap not in by_chapter:
            by_chapter[chap] = []
        by_chapter[chap].append(c)

    sampled_chunks = []
    chapter_keys = list(by_chapter.keys())
    random.seed(42)  # Deterministic sampling

    while len(sampled_chunks) < n and any(by_chapter.values()):
        for chap in chapter_keys:
            if by_chapter[chap] and len(sampled_chunks) < n:
                sampled_chunks.append(by_chapter[chap].pop(random.randint(0, len(by_chapter[chap]) - 1)))

    items = []
    for c in sampled_chunks:
        snippet = c.text[:150].replace("\n", " ").strip()
        items.append(
            {
                "question": "",  # To be filled by educator / reviewer
                "board": c.board,
                "class_level": c.class_level,
                "subject": c.subject,
                "expected_chapter_no": c.chapter_no,
                "expected_chapter_title": c.chapter_title,
                "expected_pages": [c.page_start, c.page_end] if c.page_start != c.page_end else [c.page_start],
                "notes": f"Derived from section '{c.section_title or 'General'}': {snippet}...",
            }
        )

    out_file = Path(
        output_path or f"{settings.EVAL_DIR}/gold_set.draft.{board}_c{class_level}_{subject}.yaml"
    )
    out_file.parent.mkdir(parents=True, exist_ok=True)

    with open(out_file, "w", encoding="utf-8") as f:
        yaml.dump({"items": items}, f, sort_keys=False, allow_unicode=True)

    console.print(f"[bold green][OK] Successfully generated draft gold set with {len(items)} items![/bold green]")
    console.print(f"Saved to: [bold underline]{out_file}[/bold underline]")
    console.print("\n[dim]Next step: Open the YAML file, fill in the 'question' fields with realistic student queries, and copy to data/eval/gold_set.yaml.[/dim]")


if __name__ == "__main__":
    app()
