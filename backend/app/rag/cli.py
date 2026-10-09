"""Command-line interface for indexing and searching the AI Tutor RAG corpus."""

import json
import sys
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.rag.schemas import RetrievalFilters
from app.rag.indexer import CorpusIndexer
from app.rag.retriever import HybridRetriever

app = typer.Typer(help="AI Tutor RAG Command-Line Tools")
console = Console()


@app.command()
def index(
    all: bool = typer.Option(False, "--all", "-a", help="Index all discovered processed chunks"),
    board: Optional[str] = typer.Option(None, "--board", "-b", help="Filter by board ('tn' or 'cbse')"),
    class_level: Optional[int] = typer.Option(None, "--class", "-c", help="Filter by class level (6-12)"),
    subject: Optional[str] = typer.Option(None, "--subject", "-s", help="Filter by subject"),
    rebuild: bool = typer.Option(False, "--rebuild", "-r", help="Rebuild indexes from scratch"),
):
    """Indexes processed JSONL chunks into ChromaDB and BM25 partitions."""
    console.print("[bold cyan]AI Tutor - Corpus Indexer[/bold cyan]")
    if not all and not (board or class_level or subject):
        console.print("[yellow]Please specify --all or filters like --board, --class, --subject.[/yellow]")
        raise typer.Exit(code=1)

    indexer = CorpusIndexer()
    summary = indexer.index_corpus(
        board=board,
        class_level=class_level,
        subject=subject,
        rebuild=rebuild,
    )

    console.print(f"\n[bold green][OK] Indexing complete![/bold green]")
    console.print(f"Total Chunks Indexed: [bold]{summary['total_chunks_indexed']}[/bold]")
    console.print(f"Partitions Processed: [bold]{summary['total_partitions']}[/bold]\n")

    table = Table(title="Partition Indexing Summary")
    table.add_column("Board", style="cyan")
    table.add_column("Class", style="magenta")
    table.add_column("Subject", style="green")
    table.add_column("Chunks", justify="right")
    table.add_column("Chapters", justify="right")

    for p in summary["partitions"]:
        table.add_row(
            p["board"].upper(),
            str(p["class_level"]),
            p["subject"],
            str(p["chunk_count"]),
            str(p["chapter_count"]),
        )

    console.print(table)


@app.command()
def search(
    query: str = typer.Argument(..., help="Search query string"),
    board: str = typer.Option(..., "--board", "-b", help="Board: 'tn' or 'cbse'"),
    class_level: int = typer.Option(..., "--class", "-c", help="Class level (6-12)"),
    subject: str = typer.Option(..., "--subject", "-s", help="Subject"),
    chapter: Optional[int] = typer.Option(None, "--chapter", help="Optional chapter filter"),
    mode: str = typer.Option(
        "hybrid_rerank",
        "--mode",
        "-m",
        help="Retrieval mode: vector_only, bm25_only, hybrid, hybrid_rerank",
    ),
    k: int = typer.Option(5, "--k", help="Number of final results to return"),
    include_exercises: bool = typer.Option(
        False, "--include-exercises", help="Include exercise block types"
    ),
    debug: bool = typer.Option(False, "--debug", "-d", help="Display per-stage debug traces"),
):
    """Executes a hybrid retrieval query over the curriculum index."""
    console.print(f"[bold cyan]AI Tutor - Hybrid Retrieval Search[/bold cyan]")
    console.print(f"Query: [bold yellow]\"{query}\"[/bold yellow]")
    console.print(f"Target: [green]{board.upper()} Class {class_level} {subject}[/green]" + (f" (Chapter {chapter})" if chapter else "") + f" | Mode: [magenta]{mode}[/magenta]\n")

    filters = RetrievalFilters(
        board=board,
        class_level=class_level,
        subject=subject,
        chapter_no=chapter,
        include_exercises=include_exercises,
    )

    retriever = HybridRetriever()
    result = retriever.retrieve(
        query=query,
        filters=filters,
        mode=mode,
        top_k=k,
        include_debug_trace=debug,
    )

    if not result.chunks:
        console.print("[yellow]No relevant chunks found. Ensure the corpus is indexed.[/yellow]")
        return

    # Print results
    for item in result.chunks:
        c = item.chunk
        chapter_str = f"Ch {c.chapter_no}: {c.chapter_title}" if c.chapter_no else (c.chapter_title or "General")
        section_str = f" > {c.section_title}" if c.section_title else ""
        page_str = f"p.{c.page_start}" if c.page_start == c.page_end else f"pp.{c.page_start}-{c.page_end}"
        raw_snippet = c.text[:200].replace("\n", " ") + ("..." if len(c.text) > 200 else "")
        preview = raw_snippet.encode("ascii", "replace").decode("ascii")

        title_text = f"Rank #{item.rank} | Score: {item.score:.4f} | {chapter_str}{section_str} ({page_str}) [{c.block_type}]"
        console.print(Panel(preview, title=title_text, title_align="left", expand=False))

    # Print Stage Timings
    console.print("\n[bold]Stage Timings:[/bold]")
    timings_table = Table(show_header=True, header_style="bold blue")
    for stage, ms in result.timings_ms.items():
        timings_table.add_column(stage, justify="right")
    timings_table.add_row(*[f"{ms:.1f} ms" for ms in result.timings_ms.values()])
    console.print(timings_table)

    # Debug Trace
    if debug and result.debug_trace:
        console.print("\n[bold magenta]--- Debug Trace ---[/bold magenta]")
        console.print(json.dumps(result.debug_trace, indent=2))


@app.command()
def corpus():
    """Lists indexed corpus partitions and statistics."""
    indexer = CorpusIndexer()
    summary = indexer.get_corpus_summary()

    console.print(f"[bold cyan]AI Tutor - Corpus Summary[/bold cyan]")
    console.print(f"Total Chunks: [bold]{summary.total_chunks}[/bold] across [bold]{summary.total_partitions}[/bold] partitions\n")

    table = Table(title="Available Partitions")
    table.add_column("Board", style="cyan")
    table.add_column("Class", style="magenta")
    table.add_column("Subject", style="green")
    table.add_column("Chunks", justify="right")
    table.add_column("Chapters", justify="right")

    for p in summary.partitions:
        table.add_row(
            p.board.upper(),
            str(p.class_level),
            p.subject,
            str(p.chunk_count),
            str(p.chapter_count),
        )

    console.print(table)


if __name__ == "__main__":
    app()
