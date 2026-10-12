"""Evaluation harness: evaluates retrieval modes and Phase 11 Advanced RAG across gold sets."""

import asyncio
import datetime
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
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
from app.services.memory import Turn
from app.rag.query.rewrite import rewrite_query
from app.rag.query.expand import expand_query, retrieve_with_multiquery
from app.services.answer import answer_question

app = typer.Typer(help="AI Tutor Retrieval Benchmark and Evaluation Harness")
console = Console(legacy_windows=False)


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
        if isinstance(exp_pages, list) and len(exp_pages) > 0:
            min_exp = min(exp_pages)
            max_exp = max(exp_pages)
            c_start = chunk_meta.page_start or 1
            c_end = chunk_meta.page_end or c_start
            if max(min_exp, c_start) > min(max_exp, c_end):
                return False

    return True


def _load_gold_items(gold_file: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Path]:
    """Helper to locate and load gold set items."""
    gold_path = None
    if gold_file:
        gold_path = Path(gold_file)
    else:
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
        console.print(f"[red]Error: No gold evaluation set found.[/red]")
        raise typer.Exit(code=1)

    with open(gold_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    items = data.get("items", [])
    valid_items = [it for it in items if it.get("question", "").strip()]
    return valid_items, gold_path


@app.command()
def evaluate(
    gold_file: Optional[str] = typer.Option(None, "--file", "-f", help="Path to gold set YAML file"),
    top_k: int = typer.Option(5, "--k", help="Top-K evaluation cutoff"),
    compare_rewrite: bool = typer.Option(False, "--compare-rewrite", help="Compare no rewrite vs rewrite vs multi-query"),
    answer_checks: bool = typer.Option(False, "--answer-checks", help="Run LLM-free answer verification checks"),
    mock: bool = typer.Option(True, "--mock", help="Use MockProvider for deterministic offline run"),
):
    """Runs retrieval benchmarks, rewrite comparisons, or answer grounding checks."""
    valid_items, gold_path = _load_gold_items(gold_file)
    console.print(f"[bold cyan]AI Tutor - Evaluation Suite[/bold cyan]")
    console.print(f"Loaded [bold]{len(valid_items)}[/bold] items from {gold_path}\n")

    if answer_checks:
        _run_answer_checks(valid_items, mock=mock)
        return

    if compare_rewrite:
        _run_compare_rewrite(valid_items, top_k=top_k, mock=mock)
        return

    # Standard Phase 9 4-mode benchmark
    _run_standard_retrieval_benchmark(valid_items, gold_path, top_k=top_k)


def _run_standard_retrieval_benchmark(valid_items: List[Dict[str, Any]], gold_path: Path, top_k: int):
    """Standard evaluation of 4 retrieval modes."""
    # Filter out negative refusal items for pure retrieval quality benchmark
    eval_items = [it for it in valid_items if not it.get("expected_refusal")]
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

        for it in eval_items:
            q = it["question"]
            filters = RetrievalFilters(
                board=it["board"],
                class_level=int(it["class_level"]),
                subject=it["subject"],
                include_exercises=False,
            )

            res = retriever.retrieve(query=q, filters=filters, mode=mode, top_k=top_k)
            timings_list.append(res.timings_ms)

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

        n_q = len(eval_items)
        results_by_mode[mode] = {
            "hit@1": (hit1_count / n_q) * 100.0 if n_q else 0.0,
            "hit@3": (hit3_count / n_q) * 100.0 if n_q else 0.0,
            "hit@5": (hit5_count / n_q) * 100.0 if n_q else 0.0,
            "mrr": sum(reciprocal_ranks) / n_q if n_q else 0.0,
        }

    table = Table(title="Retrieval Mode Quality Comparison")
    table.add_column("Mode", style="cyan")
    table.add_column("Hit@1", justify="right")
    table.add_column("Hit@3", justify="right")
    table.add_column("Hit@5", justify="right")
    table.add_column("MRR", justify="right")

    for m in modes:
        r = results_by_mode[m]
        table.add_row(m, f"{r['hit@1']:.1f}%", f"{r['hit@3']:.1f}%", f"{r['hit@5']:.1f}%", f"{r['mrr']:.3f}")
    console.print(table)


def _run_compare_rewrite(valid_items: List[Dict[str, Any]], top_k: int = 5, mock: bool = True):
    """Compares retrieval performance: no rewrite vs rewrite only vs rewrite + multi-query."""
    eval_items = [it for it in valid_items if not it.get("expected_refusal")]
    retriever = HybridRetriever(final_k=top_k)

    approaches = ["no_rewrite", "rewrite_only", "rewrite_multi_query"]
    results: Dict[str, Dict[str, Any]] = {}

    async def _evaluate_item(it: Dict[str, Any], approach: str) -> Optional[int]:
        q = it["question"]
        hist_raw = it.get("history") or []
        turns = [Turn(role=t.get("role", "student"), text=t.get("text", "")) for t in hist_raw]

        filters = RetrievalFilters(
            board=it["board"],
            class_level=int(it["class_level"]),
            subject=it["subject"],
            include_exercises=False,
        )

        if approach == "no_rewrite":
            res = retriever.retrieve(query=q, filters=filters, mode="hybrid_rerank", top_k=top_k)
        elif approach == "rewrite_only":
            rew_res = await rewrite_query(question=q, history=turns, force_mock=mock)
            res = retriever.retrieve(query=rew_res.standalone_query, filters=filters, mode="hybrid_rerank", top_k=top_k)
        else:
            # rewrite + multi_query
            rew_res = await rewrite_query(question=q, history=turns, force_mock=mock)
            vars_list = await expand_query(rew_res.standalone_query, subject=it["subject"], force_mock=mock)
            res = await retrieve_with_multiquery(
                standalone_query=rew_res.standalone_query,
                filters=filters,
                variants=vars_list,
                top_k=top_k,
            )

        for r_idx, sc in enumerate(res.chunks, start=1):
            if is_chunk_hit(sc.chunk, it):
                return r_idx
        return None

    for app_name in approaches:
        console.print(f"Benchmarking approach: [bold green]{app_name}[/bold green]...")
        hit1, hit3, hit5 = 0, 0, 0
        rec_ranks = []

        for it in eval_items:
            rank = asyncio.run(_evaluate_item(it, app_name))
            if rank:
                if rank <= 1:
                    hit1 += 1
                if rank <= 3:
                    hit3 += 1
                if rank <= 5:
                    hit5 += 1
                rec_ranks.append(1.0 / rank)
            else:
                rec_ranks.append(0.0)

        n = len(eval_items)
        results[app_name] = {
            "hit@1": (hit1 / n) * 100.0 if n else 0.0,
            "hit@3": (hit3 / n) * 100.0 if n else 0.0,
            "hit@5": (hit5 / n) * 100.0 if n else 0.0,
            "mrr": sum(rec_ranks) / n if n else 0.0,
        }

    table = Table(title="Advanced RAG Query Processing Comparison")
    table.add_column("Approach", style="cyan")
    table.add_column("Hit@1", justify="right")
    table.add_column("Hit@3", justify="right")
    table.add_column("Hit@5", justify="right")
    table.add_column("MRR", justify="right")

    for app_name in approaches:
        r = results[app_name]
        table.add_row(app_name, f"{r['hit@1']:.1f}%", f"{r['hit@3']:.1f}%", f"{r['hit@5']:.1f}%", f"{r['mrr']:.3f}")
    console.print(table)


def _run_answer_checks(valid_items: List[Dict[str, Any]], mock: bool = True):
    """Runs automated answer verification checks on citations, speech text, and refusals."""
    table = Table(title="Tutor Answer Quality & Grounding Checks")
    table.add_column("Question", style="dim", max_width=32)
    table.add_column("Citations Valid", justify="center")
    table.add_column("No Hallucinated Citations", justify="center")
    table.add_column("No Speech Markdown", justify="center")
    table.add_column("Refusal / Grounded", justify="center")
    table.add_column("Status", justify="center")

    total_pass = 0

    for it in valid_items:
        q = it["question"]
        hist_raw = it.get("history") or []
        turns = [Turn(role=t.get("role", "student"), text=t.get("text", "")) for t in hist_raw]

        ans_res = asyncio.run(
            answer_question(
                question=q,
                board=it["board"],
                subject=it["subject"],
                history=turns,
                force_mock=mock,
            )
        )

        is_refusal_expected = it.get("expected_refusal", False)
        is_refusal = any(ind in ans_res.answer.lower() for ind in ["couldn't find", "not found", "cannot find", "not in your"])

        # Check 1: Citation format
        citations_valid = True
        no_hallucinated_sources = True
        if is_refusal or is_refusal_expected:
            # If refused, citations must be empty
            citations_valid = len(ans_res.sources) == 0
        else:
            if not ans_res.sources and ans_res.grounded:
                citations_valid = False
            for s in ans_res.sources:
                if s.citation_index <= 0 or not s.chunk_id:
                    citations_valid = False

        # Check 2: No markdown in speech_text
        speech = ans_res.speech_text
        has_markdown = bool(re.search(r"(\*\*|#{1,6}\s|\[\s*\d+\s*\]|```)", speech))
        speech_ok = not has_markdown

        # Check 3: Refusal behavior
        refusal_ok = True
        if is_refusal_expected:
            refusal_ok = is_refusal

        overall_ok = citations_valid and no_hallucinated_sources and speech_ok and refusal_ok
        if overall_ok:
            total_pass += 1

        status_text = "[green]PASS[/green]" if overall_ok else "[red]FAIL[/red]"
        table.add_row(
            q[:30] + "...",
            "[green]YES[/green]" if citations_valid else "[red]NO[/red]",
            "[green]YES[/green]" if no_hallucinated_sources else "[red]NO[/red]",
            "[green]YES[/green]" if speech_ok else "[red]NO[/red]",
            "[green]OK[/green]" if refusal_ok else "[red]FAIL[/red]",
            status_text,
        )

    console.print(table)
    console.print(f"\nTotal Passed: [bold green]{total_pass} / {len(valid_items)}[/bold green]")


if __name__ == "__main__":
    app()
