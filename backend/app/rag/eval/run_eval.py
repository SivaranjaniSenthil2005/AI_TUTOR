"""Evaluation harness: evaluates retrieval modes across gold standard test sets."""

import datetime
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import typer
import yaml
from rich.console import Console
from rich.table import Table

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.rag.schemas import RetrievalFilters
from app.rag.retriever import HybridRetriever

app = typer.Typer(help="AI Tutor Retrieval Benchmark and Evaluation Harness")
console = Console()


def is_chunk_hit(chunk_meta: Any, item: Dict[str, Any]) -> bool:
    """Evaluates whether a returned chunk matches the expected ground truth item."""
    exp_chap_no = item.get("expected_chapter_no")
    exp_chap_title = (item.get("expected_chapter_title") or "").strip().lower()

    # Check chapter match
    chapter_matched = False
    if exp_chap_no is not None and chunk_meta.chapter_no is not None:
        if int(chunk_meta.chapter_no) == int(exp_chap_no):
            chapter_matched = True
    elif exp_chap_title and chunk_meta.chapter_title:
        if exp_chap_title in chunk_meta.chapter_title.lower():
            chapter_matched = True

    if not chapter_matched:
        return False

    # Check page overlap if expected_pages is specified
    exp_pages = item.get("expected_pages")
    if exp_pages:
        # exp_pages can be list of ints or [start, end]
        if isinstance(exp_pages, list) and len(exp_pages) > 0:
            min_exp = min(exp_pages)
            max_exp = max(exp_pages)
            c_start = chunk_meta.page_start or 1
            c_end = chunk_meta.page_end or c_start
            # Check if ranges overlap: max(start1, start2) <= min(end1, end2)
            if max(min_exp, c_start) > min(max_exp, c_end):
                return False

    return True


@app.command()
def evaluate(
    gold_file: Optional[str] = typer.Option(
        None, "--file", "-f", help="Path to gold set YAML file"
    ),
    top_k: int = typer.Option(5, "--k", help="Top-K evaluation cutoff"),
):
    """Runs all 4 retrieval modes on the gold set and calculates comparative metrics."""
    console.print("[bold cyan]AI Tutor - RAG Retrieval Evaluation Suite[/bold cyan]")

    # Find gold set path
    gold_path = None
    if gold_file:
        gold_path = Path(gold_file)
    else:
        # Check standard locations
        candidates = [
            Path(settings.EVAL_DIR) / "gold_set.yaml",
            Path(settings.EVAL_DIR) / "gold_set.draft.yaml",
            Path(__file__).parent / "gold_set.example.yaml",
        ]
        for c in candidates:
            if c.exists():
                gold_path = c
                break

    if not gold_path or not gold_path.exists():
        console.print(
            f"[red]Error: No gold evaluation set found at {gold_path or 'data/eval/gold_set.yaml'}.[/red]"
        )
        console.print(
            "[yellow]Create one using `python -m app.rag.eval.make_gold_template` or supply with --file.[/yellow]"
        )
        raise typer.Exit(code=1)

    console.print(f"Loading gold set from: [bold]{gold_path}[/bold]\n")
    with open(gold_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    items = data.get("items", [])
    valid_items = [it for it in items if it.get("question", "").strip()]

    if not valid_items:
        console.print(
            "[red]Error: Gold set contains no items with questions populated.[/red]"
        )
        raise typer.Exit(code=1)

    console.print(f"Evaluating [bold]{len(valid_items)}[/bold] benchmark queries...\n")

    modes = ["vector_only", "bm25_only", "hybrid", "hybrid_rerank"]
    results_by_mode: Dict[str, Dict[str, Any]] = {}
    retriever = HybridRetriever(final_k=top_k)

    for mode in modes:
        console.print(f"Running mode: [bold magenta]{mode}[/bold magenta]...")
        hit1_count = 0
        hit3_count = 0
        hit5_count = 0
        reciprocal_ranks = []
        timings_list: List[Dict[str, float]] = []

        query_eval_details = []

        for it in valid_items:
            q = it["question"]
            filters = RetrievalFilters(
                board=it["board"],
                class_level=int(it["class_level"]),
                subject=it["subject"],
                include_exercises=False,
            )

            res = retriever.retrieve(query=q, filters=filters, mode=mode, top_k=top_k)
            timings_list.append(res.timings_ms)

            # Determine rank of first hit
            first_hit_rank = None
            for r_idx, scored_item in enumerate(res.chunks, start=1):
                if is_chunk_hit(scored_item.chunk, it):
                    first_hit_rank = r_idx
                    break

            if first_hit_rank is not None:
                if first_hit_rank <= 1:
                    hit1_count += 1
                if first_hit_rank <= 3:
                    hit3_count += 1
                if first_hit_rank <= 5:
                    hit5_count += 1
                reciprocal_ranks.append(1.0 / first_hit_rank)
            else:
                reciprocal_ranks.append(0.0)

            query_eval_details.append(
                {
                    "question": q,
                    "first_hit_rank": first_hit_rank,
                    "returned_count": len(res.chunks),
                    "timings_ms": res.timings_ms,
                }
            )

        n_q = len(valid_items)
        hit1 = (hit1_count / n_q) * 100.0
        hit3 = (hit3_count / n_q) * 100.0
        hit5 = (hit5_count / n_q) * 100.0
        mrr = sum(reciprocal_ranks) / n_q

        # Compute average timings
        avg_timings: Dict[str, float] = {}
        for k_t in ["vector_ms", "bm25_ms", "fusion_ms", "rerank_ms", "total_ms"]:
            vals = [t.get(k_t, 0.0) for t in timings_list if k_t in t]
            if vals:
                avg_timings[k_t] = sum(vals) / len(vals)

        results_by_mode[mode] = {
            "hit@1": hit1,
            "hit@3": hit3,
            "hit@5": hit5,
            "mrr": mrr,
            "avg_timings_ms": avg_timings,
            "query_details": query_eval_details,
        }

    # Print Comparative Results Table
    console.print("\n[bold green]Retrieval Quality Benchmark Results:[/bold green]")
    table = Table(title="Retrieval Mode Comparison")
    table.add_column("Mode", style="cyan")
    table.add_column("Hit@1", justify="right")
    table.add_column("Hit@3", justify="right")
    table.add_column("Hit@5", justify="right")
    table.add_column("MRR", justify="right")
    table.add_column("Total Latency", justify="right", style="yellow")

    for m in modes:
        r = results_by_mode[m]
        tot_lat = r["avg_timings_ms"].get("total_ms", 0.0)
        table.add_row(
            m,
            f"{r['hit@1']:.1f}%",
            f"{r['hit@3']:.1f}%",
            f"{r['hit@5']:.1f}%",
            f"{r['mrr']:.3f}",
            f"{tot_lat:.1f} ms",
        )

    console.print(table)

    # Print Average Stage Latency
    console.print("\n[bold blue]Average Stage Latencies (ms):[/bold blue]")
    lat_table = Table()
    lat_table.add_column("Mode", style="cyan")
    lat_table.add_column("Vector", justify="right")
    lat_table.add_column("BM25", justify="right")
    lat_table.add_column("Fusion", justify="right")
    lat_table.add_column("Reranker", justify="right")
    lat_table.add_column("Total", justify="right", style="bold")

    for m in modes:
        t = results_by_mode[m]["avg_timings_ms"]
        lat_table.add_row(
            m,
            f"{t.get('vector_ms', 0.0):.1f}",
            f"{t.get('bm25_ms', 0.0):.1f}",
            f"{t.get('fusion_ms', 0.0):.1f}",
            f"{t.get('rerank_ms', 0.0):.1f}",
            f"{t.get('total_ms', 0.0):.1f}",
        )
    console.print(lat_table)

    # Save to data/eval/results_{timestamp}.json
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(settings.EVAL_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_json = out_dir / f"results_{ts}.json"

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "timestamp": ts,
                "gold_file": str(gold_path),
                "total_queries": len(valid_items),
                "results_by_mode": results_by_mode,
            },
            f,
            indent=2,
        )

    console.print(f"\n[bold green][OK] Benchmark results saved to:[/bold green] {out_json}")


if __name__ == "__main__":
    app()
