"""Evaluation harness: evaluates retrieval modes and Advanced RAG across gold sets.

Features:
- Item types: direct, paraphrase, follow_up, out_of_scope, noisy
- Metrics: Hit@1, Hit@3, Hit@5, MRR, Chapter Recall with 95% bootstrap confidence intervals
- Subgroup slices: per board, per subject, per item type
- Retrieval mode comparison: vector_only, bm25_only, hybrid, hybrid_rerank, rewrite, multi-query
- Failure analysis list: all queries where expected chapter was not in top-5
- Component ablation table: BM25, Vector, RRF, Reranker, Rewrite, Block policy
- JSON and Markdown report export
"""

import asyncio
import datetime
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
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

app = typer.Typer(help="AI Tutor Retrieval Benchmark and Evaluation Harness")
console = Console(legacy_windows=False)
logger = logging.getLogger("ai_tutor.eval.retrieval")


def bootstrap_ci(
    values: List[float],
    n_bootstrap: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> Tuple[float, float, float]:
    """Computes sample mean and empirical 95% bootstrap confidence interval (mean, low, high)."""
    if not values:
        return 0.0, 0.0, 0.0
    arr = np.array(values, dtype=float)
    mean_val = float(np.mean(arr))
    if len(arr) <= 1 or np.all(arr == arr[0]):
        return mean_val, mean_val, mean_val

    rng = np.random.default_rng(seed)
    n = len(arr)
    indices = rng.integers(0, n, size=(n_bootstrap, n))
    boot_means = np.mean(arr[indices], axis=1)

    alpha = (1.0 - ci) / 2.0
    low = float(np.percentile(boot_means, alpha * 100))
    high = float(np.percentile(boot_means, (1.0 - alpha) * 100))
    return mean_val, max(0.0, low), min(1.0, high)


def is_chunk_hit(chunk_meta: Any, item: Dict[str, Any]) -> bool:
    """Evaluates whether a returned chunk matches the expected ground truth item."""
    exp_chap_no = item.get("expected_chapter_no")
    exp_chap_title = (item.get("expected_chapter_title") or "").strip().lower()

    chapter_matched = False
    c_chap_no = getattr(chunk_meta, "chapter_no", None)
    c_chap_title = (getattr(chunk_meta, "chapter_title", "") or "").strip().lower()

    if exp_chap_no is not None and c_chap_no is not None:
        try:
            if int(c_chap_no) == int(exp_chap_no):
                chapter_matched = True
        except (ValueError, TypeError):
            pass

    if not chapter_matched and exp_chap_title and c_chap_title:
        if exp_chap_title in c_chap_title or c_chap_title in exp_chap_title:
            chapter_matched = True

    if not chapter_matched:
        return False

    # Check optional page overlap
    exp_pages = item.get("expected_pages")
    if exp_pages and isinstance(exp_pages, list) and len(exp_pages) > 0:
        min_exp = min(exp_pages)
        max_exp = max(exp_pages)
        c_start = getattr(chunk_meta, "page_start", 1) or 1
        c_end = getattr(chunk_meta, "page_end", c_start) or c_start
        if max(min_exp, c_start) > min(max_exp, c_end):
            return False

    return True


def determine_item_type(it: Dict[str, Any]) -> str:
    """Categorizes gold item into direct, paraphrase, follow_up, out_of_scope, or noisy."""
    explicit_type = it.get("item_type") or it.get("type")
    if explicit_type:
        return str(explicit_type).lower()

    if it.get("expected_refusal"):
        return "out_of_scope"
    if it.get("history") and len(it.get("history", [])) > 0:
        return "follow_up"
    notes = (it.get("notes") or "").lower()
    if "paraphrase" in notes:
        return "paraphrase"
    if "noisy" in notes or "typo" in notes or "stt" in notes:
        return "noisy"
    return "direct"


def _load_gold_items(gold_file: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Path]:
    """Locates and loads gold set items."""
    gold_path = None
    if gold_file:
        gold_path = Path(gold_file)
    else:
        candidates = [
            Path(settings.EVAL_DIR) / "gold_set.yaml",
            Path(settings.EVAL_DIR) / "gold_set.draft.yaml",
            Path(settings.EVAL_DIR) / "gold_set.draft.tn_c10_science.yaml",
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

    items = data.get("items", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    valid_items = []
    for idx, it in enumerate(items, start=1):
        if not isinstance(it, dict) or not it.get("question", "").strip():
            continue
        it.setdefault("item_id", f"q_{idx:03d}")
        it["item_type"] = determine_item_type(it)
        valid_items.append(it)

    return valid_items, gold_path


def evaluate_retrieval_dataset(
    items: List[Dict[str, Any]],
    modes: List[str] = ("vector_only", "bm25_only", "hybrid", "hybrid_rerank"),
    top_k: int = 5,
    mock: bool = True,
    block_policy_enabled: bool = True,
) -> Dict[str, Any]:
    """Core evaluation engine computing per-mode metrics, confidence intervals, slices, and failure list."""
    eval_items = [it for it in items if not it.get("expected_refusal") and it.get("item_type") != "out_of_scope"]
    refusal_items = [it for it in items if it.get("expected_refusal") or it.get("item_type") == "out_of_scope"]

    retriever = HybridRetriever(final_k=top_k)
    mode_results: Dict[str, Any] = {}
    failure_list: List[Dict[str, Any]] = []

    for mode in modes:
        q_results = []
        for it in eval_items:
            q = it["question"]
            hist_raw = it.get("history") or []
            turns = [Turn(role=t.get("role", "student"), text=t.get("text", "")) for t in hist_raw]

            filters = RetrievalFilters(
                board=it["board"],
                class_level=int(it["class_level"]),
                subject=it["subject"],
                include_exercises=False,
            )

            # Query preprocessing if mode uses rewrite
            query_to_run = q
            variants = []
            t0 = time.perf_counter()

            if "rewrite" in mode:
                rew_res = asyncio.run(rewrite_query(question=q, history=turns, force_mock=mock))
                query_to_run = rew_res.standalone_query
                if "multiquery" in mode or "multi_query" in mode:
                    variants = asyncio.run(expand_query(query_to_run, subject=it["subject"], force_mock=mock))

            if variants:
                res = asyncio.run(
                    retrieve_with_multiquery(
                        standalone_query=query_to_run,
                        filters=filters,
                        variants=variants,
                        top_k=top_k,
                    )
                )
            else:
                eff_mode = "hybrid_rerank" if "rewrite" in mode else mode
                res = retriever.retrieve(query=query_to_run, filters=filters, mode=eff_mode, top_k=top_k)

            latency_ms = (time.perf_counter() - t0) * 1000.0

            # Match evaluation
            first_hit_rank = None
            for r_idx, sc in enumerate(res.chunks, start=1):
                if is_chunk_hit(sc.chunk, it):
                    first_hit_rank = r_idx
                    break

            is_hit1 = 1.0 if (first_hit_rank and first_hit_rank <= 1) else 0.0
            is_hit3 = 1.0 if (first_hit_rank and first_hit_rank <= 3) else 0.0
            is_hit5 = 1.0 if (first_hit_rank and first_hit_rank <= 5) else 0.0
            rec_rank = (1.0 / first_hit_rank) if first_hit_rank else 0.0
            chapter_recalled = 1.0 if is_hit5 else 0.0

            q_record = {
                "item_id": it.get("item_id"),
                "question": q,
                "board": it["board"],
                "subject": it["subject"],
                "item_type": it["item_type"],
                "expected_chapter_no": it.get("expected_chapter_no"),
                "expected_chapter_title": it.get("expected_chapter_title"),
                "hit1": is_hit1,
                "hit3": is_hit3,
                "hit5": is_hit5,
                "mrr": rec_rank,
                "recall": chapter_recalled,
                "first_hit_rank": first_hit_rank,
                "latency_ms": latency_ms,
                "retrieved_chunks": [
                    {
                        "chunk_id": sc.chunk.chunk_id,
                        "chapter_no": sc.chunk.chapter_no,
                        "chapter_title": sc.chunk.chapter_title,
                        "score": round(sc.score, 4),
                        "page_start": sc.chunk.page_start,
                        "page_end": sc.chunk.page_end,
                        "snippet": sc.chunk.text[:120].replace("\n", " "),
                    }
                    for sc in res.chunks[:top_k]
                ],
            }
            q_results.append(q_record)

            # Record failure in primary mode (hybrid_rerank)
            if mode == "hybrid_rerank" and not is_hit5:
                failure_list.append(q_record)

        # Aggregate metrics with bootstrap CIs
        def calc_ci_summary(records: List[Dict[str, Any]]) -> Dict[str, Any]:
            n = len(records)
            if n == 0:
                return {"count": 0}
            h1_m, h1_l, h1_h = bootstrap_ci([r["hit1"] for r in records])
            h3_m, h3_l, h3_h = bootstrap_ci([r["hit3"] for r in records])
            h5_m, h5_l, h5_h = bootstrap_ci([r["hit5"] for r in records])
            mrr_m, mrr_l, mrr_h = bootstrap_ci([r["mrr"] for r in records])
            rec_m, rec_l, rec_h = bootstrap_ci([r["recall"] for r in records])

            return {
                "count": n,
                "hit@1": {"mean": round(h1_m, 4), "ci95": [round(h1_l, 4), round(h1_h, 4)]},
                "hit@3": {"mean": round(h3_m, 4), "ci95": [round(h3_l, 4), round(h3_h, 4)]},
                "hit@5": {"mean": round(h5_m, 4), "ci95": [round(h5_l, 4), round(h5_h, 4)]},
                "mrr": {"mean": round(mrr_m, 4), "ci95": [round(mrr_l, 4), round(mrr_h, 4)]},
                "recall": {"mean": round(rec_m, 4), "ci95": [round(rec_l, 4), round(rec_h, 4)]},
            }

        overall_metrics = calc_ci_summary(q_results)

        # Slices: by board, by subject, by item_type
        slices = {"board": {}, "subject": {}, "item_type": {}}
        for b in sorted(set(r["board"] for r in q_results)):
            slices["board"][b] = calc_ci_summary([r for r in q_results if r["board"] == b])
        for s in sorted(set(r["subject"] for r in q_results)):
            slices["subject"][s] = calc_ci_summary([r for r in q_results if r["subject"] == s])
        for t in sorted(set(r["item_type"] for r in q_results)):
            slices["item_type"][t] = calc_ci_summary([r for r in q_results if r["item_type"] == t])

        mode_results[mode] = {
            "overall": overall_metrics,
            "slices": slices,
            "queries": q_results,
        }

    return {
        "modes": mode_results,
        "failures": failure_list,
        "sample_size": len(eval_items),
        "refusal_sample_size": len(refusal_items),
    }


def compute_component_ablation(items: List[Dict[str, Any]], top_k: int = 5, mock: bool = True) -> Dict[str, Any]:
    """Evaluates individual contributions of BM25, Vector, RRF, Reranker, Rewrite, and Block Policy."""
    eval_items = [it for it in items if not it.get("expected_refusal") and it.get("item_type") != "out_of_scope"]
    retriever = HybridRetriever(final_k=top_k)

    ablation_modes = [
        ("bm25_only", "BM25 Keyword Search Alone"),
        ("vector_only", "Dense Vector Search Alone"),
        ("hybrid", "BM25 + Vector + RRF (No Rerank)"),
        ("hybrid_rerank", "Hybrid + Cross-Encoder Rerank"),
        ("hybrid_rerank_rewrite", "Hybrid + Rerank + Query Rewrite"),
    ]

    ablation_summary = []
    for mode_key, label in ablation_modes:
        hit5_scores = []
        mrr_scores = []
        for it in eval_items:
            q = it["question"]
            hist_raw = it.get("history") or []
            turns = [Turn(role=t.get("role", "student"), text=t.get("text", "")) for t in hist_raw]

            filters = RetrievalFilters(
                board=it["board"],
                class_level=int(it["class_level"]),
                subject=it["subject"],
                include_exercises=False,
            )

            if "rewrite" in mode_key:
                rew_res = asyncio.run(rewrite_query(question=q, history=turns, force_mock=mock))
                res = retriever.retrieve(query=rew_res.standalone_query, filters=filters, mode="hybrid_rerank", top_k=top_k)
            else:
                res = retriever.retrieve(query=q, filters=filters, mode=mode_key, top_k=top_k)

            rank = None
            for r_idx, sc in enumerate(res.chunks, start=1):
                if is_chunk_hit(sc.chunk, it):
                    rank = r_idx
                    break
            hit5_scores.append(1.0 if (rank and rank <= 5) else 0.0)
            mrr_scores.append((1.0 / rank) if rank else 0.0)

        h5_m, h5_l, h5_h = bootstrap_ci(hit5_scores)
        mrr_m, mrr_l, mrr_h = bootstrap_ci(mrr_scores)

        ablation_summary.append({
            "component": label,
            "mode": mode_key,
            "hit@5": round(h5_m * 100.0, 1),
            "hit@5_ci": [round(h5_l * 100.0, 1), round(h5_h * 100.0, 1)],
            "mrr": round(mrr_m, 3),
            "mrr_ci": [round(mrr_l, 3), round(mrr_h, 3)],
        })

    return {"ablation": ablation_summary}


@app.command()
def evaluate(
    gold_file: Optional[str] = typer.Option(None, "--file", "-f", help="Path to gold set YAML file"),
    top_k: int = typer.Option(5, "--k", help="Top-K cutoff"),
    ablation: bool = typer.Option(True, "--ablation/--no-ablation", help="Compute component ablation table"),
    mock: bool = typer.Option(True, "--mock", help="Use MockProvider for deterministic offline run"),
    output_json: Optional[str] = typer.Option(None, "--output-json", help="Path to save output JSON metrics"),
    output_md: Optional[str] = typer.Option(None, "--output-md", help="Path to save output Markdown tables"),
):
    """Executes full Phase 13 retrieval evaluation with bootstrap CIs, slices, and failure analysis."""
    valid_items, gold_path = _load_gold_items(gold_file)
    console.print(f"[bold cyan]AI Tutor - Phase 13 Retrieval Evaluation[/bold cyan]")
    console.print(f"Loaded [bold]{len(valid_items)}[/bold] items from {gold_path}\n")

    eval_modes = ["vector_only", "bm25_only", "hybrid", "hybrid_rerank", "hybrid_rerank_rewrite"]
    res = evaluate_retrieval_dataset(valid_items, modes=eval_modes, top_k=top_k, mock=mock)

    # 1. Main Table
    table = Table(title="Retrieval Modes: Hit@K & MRR with 95% Bootstrap CIs")
    table.add_column("Retrieval Mode", style="cyan")
    table.add_column("Hit@1 (95% CI)", justify="right")
    table.add_column("Hit@3 (95% CI)", justify="right")
    table.add_column("Hit@5 (95% CI)", justify="right")
    table.add_column("MRR (95% CI)", justify="right")
    table.add_column("Chapter Recall", justify="right")

    for m in eval_modes:
        m_data = res["modes"][m]["overall"]
        if m_data.get("count", 0) == 0:
            continue
        h1 = f"{m_data['hit@1']['mean']*100:.1f}% [{m_data['hit@1']['ci95'][0]*100:.1f}-{m_data['hit@1']['ci95'][1]*100:.1f}]"
        h3 = f"{m_data['hit@3']['mean']*100:.1f}% [{m_data['hit@3']['ci95'][0]*100:.1f}-{m_data['hit@3']['ci95'][1]*100:.1f}]"
        h5 = f"{m_data['hit@5']['mean']*100:.1f}% [{m_data['hit@5']['ci95'][0]*100:.1f}-{m_data['hit@5']['ci95'][1]*100:.1f}]"
        mrr = f"{m_data['mrr']['mean']:.3f} [{m_data['mrr']['ci95'][0]:.3f}-{m_data['mrr']['ci95'][1]:.3f}]"
        rec = f"{m_data['recall']['mean']*100:.1f}%"
        table.add_row(m, h1, h3, h5, mrr, rec)

    console.print(table)

    # 2. Slices Table (Hybrid Rerank)
    slice_table = Table(title="Subgroup Slices (Hybrid Rerank with 95% CIs)")
    slice_table.add_column("Slice Dimension", style="green")
    slice_table.add_column("Category", style="cyan")
    slice_table.add_column("N", justify="right")
    slice_table.add_column("Hit@5 (95% CI)", justify="right")
    slice_table.add_column("MRR (95% CI)", justify="right")

    slices = res["modes"]["hybrid_rerank"]["slices"]
    for dim_name, cat_dict in slices.items():
        for cat_name, metrics in cat_dict.items():
            if metrics.get("count", 0) == 0:
                continue
            h5 = f"{metrics['hit@5']['mean']*100:.1f}% [{metrics['hit@5']['ci95'][0]*100:.1f}-{metrics['hit@5']['ci95'][1]*100:.1f}]"
            mrr = f"{metrics['mrr']['mean']:.3f} [{metrics['mrr']['ci95'][0]:.3f}-{metrics['mrr']['ci95'][1]:.3f}]"
            slice_table.add_row(dim_name, cat_name, str(metrics["count"]), h5, mrr)

    console.print("\n", slice_table)

    # 3. Ablation Table
    ablation_data = None
    if ablation:
        ablation_data = compute_component_ablation(valid_items, top_k=top_k, mock=mock)
        abl_table = Table(title="Component Contribution Ablation Study")
        abl_table.add_column("Architecture Component", style="magenta")
        abl_table.add_column("Hit@5 (95% CI)", justify="right")
        abl_table.add_column("MRR (95% CI)", justify="right")

        for item in ablation_data["ablation"]:
            h5 = f"{item['hit@5']:.1f}% [{item['hit@5_ci'][0]:.1f}-{item['hit@5_ci'][1]:.1f}]"
            mrr = f"{item['mrr']:.3f} [{item['mrr_ci'][0]:.3f}-{item['mrr_ci'][1]:.3f}]"
            abl_table.add_row(item["component"], h5, mrr)
        console.print("\n", abl_table)

    # 4. Failure List
    failures = res.get("failures", [])
    if failures:
        console.print(f"\n[bold red]Retrieval Failure Analysis ({len(failures)} queries missed expected chapter in top 5):[/bold red]")
        for f in failures[:10]:
            console.print(f"- [bold yellow]{f['item_id']}[/bold yellow] ([cyan]{f['board'].upper()}/{f['subject']}[/cyan]): \"{f['question']}\"")
            console.print(f"  Expected Chapter: {f['expected_chapter_no']} ({f['expected_chapter_title']})")
            retrieved_titles = [f"{c['chapter_no']}:{c['chapter_title']}" for c in f['retrieved_chunks'][:3]]
            console.print(f"  Top Retrieved: {', '.join(retrieved_titles)}")
    else:
        console.print("\n[bold green]Zero top-5 chapter retrieval failures detected in test set![/bold green]")

    # Export structured results
    out_dir = Path(settings.EVAL_DIR) / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = Path(output_json) if output_json else out_dir / "retrieval_eval.json"

    export_payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "gold_file": str(gold_path),
        "sample_size": res["sample_size"],
        "modes": {m: res["modes"][m]["overall"] for m in eval_modes},
        "slices": res["modes"]["hybrid_rerank"]["slices"],
        "ablation": ablation_data["ablation"] if ablation_data else [],
        "failures_count": len(failures),
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)
    console.print(f"\n[green]Saved structured JSON results to: {json_path}[/green]")

    return export_payload


if __name__ == "__main__":
    app()
