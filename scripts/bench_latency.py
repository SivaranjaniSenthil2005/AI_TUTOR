"""Latency and system performance benchmark for AI Tutor (Phase 13).

Runs N benchmark questions (default 30) across configurations:
1. REWRITE_MODE=auto, FAST_MODE=False (Standard pipeline)
2. REWRITE_MODE=off,  FAST_MODE=True  (Low-latency fast mode)

Measures:
- p50 and p95 for:
  - Query rewrite latency
  - Retrieval latency
  - Time-to-first-token (TTFT)
  - Total generation latency
  - End-to-end latency
- Index size on disk (Chroma, BM25)
- Embedding & reranker model warmup/load time
- Process memory footprint (RAM / RSS in MB)
- Export to data/eval/results/latency_bench.json
"""

import asyncio
import datetime
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import typer
from rich.console import Console
from rich.table import Table

# Add backend directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.config import settings
from app.services.answer import stream_answer_question
from app.rag.embeddings import get_embedding_model
from app.rag.reranker import get_reranker_model

console = Console(legacy_windows=False)
app = typer.Typer(help="AI Tutor Latency and System Benchmark")

BENCHMARK_QUESTIONS = [
    ("tn", "science", "What is Newton's first law of motion and inertia?"),
    ("tn", "science", "Explain Newton's second law with its mathematical equation."),
    ("tn", "science", "What are the main functions of chloroplasts in photosynthesis?"),
    ("tn", "science", "Explain the difference between light-dependent and dark reactions."),
    ("tn", "science", "Describe the structure of the human heart and double circulation."),
    ("tn", "science", "What are the key components of blood in human circulation?"),
    ("tn", "science", "What is the difference between direct current and alternating current?"),
    ("tn", "science", "Explain Ohm's law and electrical resistance in conductors."),
    ("tn", "science", "What is the principle of conservation of linear momentum?"),
    ("tn", "science", "Explain how respiration differs from breathing in organisms."),
    ("tn", "social_science", "What were the main causes of the First World War in 1914?"),
    ("tn", "social_science", "Explain the terms of the Treaty of Versailles."),
    ("tn", "social_science", "What were the primary effects of the Great Depression of 1929?"),
    ("tn", "social_science", "Describe the early resistance of Veerapandiya Kattabomman."),
    ("tn", "social_science", "What are the major physiographic divisions of India?"),
    ("tn", "social_science", "Explain the differences between Himalayan and Peninsular rivers."),
    ("tn", "social_science", "What are the powers and functions of the President of India?"),
    ("tn", "social_science", "Define gross domestic product and explain its components."),
    ("tn", "social_science", "What was the significance of the Non-Aligned Movement?"),
    ("tn", "social_science", "Describe the climatic characteristics of the Indian Monsoon."),
    ("cbse", "science", "What is a balanced chemical equation and why is it necessary?"),
    ("cbse", "science", "Explain displacement and double displacement chemical reactions."),
    ("cbse", "science", "What happens when an acid reacts with a metal?"),
    ("cbse", "science", "Why do stars twinkle in the night sky?"),
    ("cbse", "science", "Describe autotrophic and heterotrophic modes of nutrition."),
    ("cbse", "social_science", "What was the concept of nation-state developed in Europe?"),
    ("cbse", "social_science", "Describe the Salt March of 1930 led by Mahatma Gandhi."),
    ("cbse", "social_science", "What is the difference between power sharing in Belgium and Sri Lanka?"),
    ("cbse", "social_science", "Why is sustainable development crucial for future generations?"),
    ("cbse", "social_science", "What are the formal and informal sources of credit in India?"),
]


def get_dir_size_mb(directory_path: str) -> float:
    """Computes total size of a directory on disk in megabytes."""
    p = Path(directory_path)
    if not p.exists():
        return 0.0
    total = sum(f.stat().st_size for f in p.glob("**/*") if f.is_file())
    return round(total / (1024 * 1024), 2)


def get_memory_rss_mb() -> float:
    """Returns resident set size (physical RAM) of current process in MB."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        return round(process.memory_info().rss / (1024 * 1024), 1)
    except Exception:
        return 0.0


def percentile(data: List[float], p: float) -> float:
    """Calculates percentile from list of floats."""
    if not data:
        return 0.0
    return round(float(np.percentile(np.array(data), p)), 2)


async def benchmark_single_query(
    board: str,
    subject: str,
    question: str,
    mock: bool = True,
) -> Dict[str, Any]:
    """Measures latency breakdown for a single streaming query."""
    t_start = time.perf_counter()
    ttft_ms: Optional[float] = None
    first_token_seen = False
    tokens_count = 0
    final_meta = {}

    async for event in stream_answer_question(
        question=question,
        board=board,
        subject=subject,
        force_mock=mock,
    ):
        etype = event.get("event")
        if etype == "token" and not first_token_seen:
            ttft_ms = (time.perf_counter() - t_start) * 1000.0
            first_token_seen = True
            tokens_count += 1
        elif etype == "token":
            tokens_count += 1
        elif etype == "done":
            final_meta = event.get("data", {})

    t_end = time.perf_counter()
    e2e_ms = (t_end - t_start) * 1000.0

    latencies = final_meta.get("latency_ms", {})
    rewrite_ms = float(latencies.get("rewriting", 0.0))
    retrieval_ms = float(latencies.get("retrieval", 0.0))
    gen_ms = float(latencies.get("generation", 0.0))

    if ttft_ms is None:
        ttft_ms = e2e_ms

    return {
        "rewrite_ms": rewrite_ms,
        "retrieval_ms": retrieval_ms,
        "ttft_ms": round(ttft_ms, 2),
        "generation_ms": round(gen_ms, 2),
        "e2e_ms": round(e2e_ms, 2),
        "tokens_count": tokens_count,
        "provider": final_meta.get("provider", "mock"),
    }


def run_benchmark_configuration(
    questions: List[Tuple[str, str, str]],
    rewrite_mode: str = "auto",
    fast_mode: bool = False,
    mock: bool = True,
) -> Dict[str, Any]:
    """Runs latency benchmark for a specific RAG configuration."""
    # Apply settings override
    settings.REWRITE_MODE = rewrite_mode
    settings.FAST_MODE = fast_mode

    records = []
    for b, s, q in questions:
        rec = asyncio.run(benchmark_single_query(b, s, q, mock=mock))
        records.append(rec)

    rewrites = [r["rewrite_ms"] for r in records]
    retrievals = [r["retrieval_ms"] for r in records]
    ttfts = [r["ttft_ms"] for r in records]
    gens = [r["generation_ms"] for r in records]
    e2es = [r["e2e_ms"] for r in records]

    providers = list(set(r["provider"] for r in records))

    return {
        "config": f"rewrite={rewrite_mode}, fast_mode={fast_mode}",
        "query_count": len(questions),
        "providers_used": providers,
        "rewrite": {"p50": percentile(rewrites, 50), "p95": percentile(rewrites, 95)},
        "retrieval": {"p50": percentile(retrievals, 50), "p95": percentile(retrievals, 95)},
        "ttft": {"p50": percentile(ttfts, 50), "p95": percentile(ttfts, 95)},
        "generation": {"p50": percentile(gens, 50), "p95": percentile(gens, 95)},
        "e2e": {"p50": percentile(e2es, 50), "p95": percentile(e2es, 95)},
    }


@app.command()
def run(
    n_queries: int = typer.Option(30, "--n", "-n", help="Number of benchmark queries to run"),
    mock: bool = typer.Option(True, "--mock/--live", help="Use MockProvider (fast offline benchmark)"),
    output_json: Optional[str] = typer.Option(None, "--output", "-o", help="Path to save JSON benchmark metrics"),
):
    """Executes latency & performance benchmark across RAG configurations."""
    console.print(f"[bold cyan]AI Tutor - Phase 13 Latency & System Benchmark[/bold cyan]")
    selected_queries = BENCHMARK_QUESTIONS[:min(n_queries, len(BENCHMARK_QUESTIONS))]
    console.print(f"Running [yellow]{len(selected_queries)}[/yellow] queries per configuration (mock={mock})...\n")

    # 1. System footprint & index sizes
    t_load_start = time.perf_counter()
    _ = get_embedding_model().model
    _ = get_reranker_model().model
    model_load_ms = round((time.perf_counter() - t_load_start) * 1000.0, 1)

    chroma_size_mb = get_dir_size_mb(settings.CHROMA_DIR)
    bm25_size_mb = get_dir_size_mb(settings.BM25_DIR)
    memory_rss_mb = get_memory_rss_mb()

    # 2. Benchmark Standard Configuration
    console.print("Benchmarking [magenta]Standard Mode (REWRITE_MODE=auto, FAST_MODE=False)[/magenta]...")
    standard_res = run_benchmark_configuration(
        selected_queries,
        rewrite_mode="auto",
        fast_mode=False,
        mock=mock,
    )

    # 3. Benchmark Fast Mode
    console.print("Benchmarking [green]Fast Mode (REWRITE_MODE=off, FAST_MODE=True)[/green]...")
    fast_res = run_benchmark_configuration(
        selected_queries,
        rewrite_mode="off",
        fast_mode=True,
        mock=mock,
    )

    # 4. Latency Results Table
    table = Table(title="Latency & Response Time Percentiles (p50 / p95 in ms)")
    table.add_column("Pipeline Configuration", style="cyan")
    table.add_column("Rewrite (ms)", justify="right")
    table.add_column("Retrieval (ms)", justify="right")
    table.add_column("TTFT (ms)", justify="right")
    table.add_column("Generation (ms)", justify="right")
    table.add_column("End-to-End (ms)", justify="right")

    for res in [standard_res, fast_res]:
        cfg_name = res["config"]
        rw = f"{res['rewrite']['p50']} / {res['rewrite']['p95']}"
        ret = f"{res['retrieval']['p50']} / {res['retrieval']['p95']}"
        tt = f"{res['ttft']['p50']} / {res['ttft']['p95']}"
        gen = f"{res['generation']['p50']} / {res['generation']['p95']}"
        e2e = f"{res['e2e']['p50']} / {res['e2e']['p95']}"
        table.add_row(cfg_name, rw, ret, tt, gen, e2e)

    console.print("\n", table)

    # 5. System Footprint Table
    t_sys = Table(title="Backend Resource & Storage Footprint")
    t_sys.add_column("Component", style="green")
    t_sys.add_column("Metric", justify="right")

    t_sys.add_row("Chroma Vector Store Size", f"{chroma_size_mb} MB")
    t_sys.add_row("BM25 Keyword Index Size", f"{bm25_size_mb} MB")
    t_sys.add_row("RAG Model Warmup / Load Time", f"{model_load_ms} ms")
    t_sys.add_row("Process Memory Footprint (RSS)", f"{memory_rss_mb} MB")
    console.print("\n", t_sys)

    # Export JSON
    out_dir = ROOT_DIR / "data" / "eval" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = Path(output_json) if output_json else out_dir / "latency_bench.json"

    export_payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "query_count": len(selected_queries),
        "configurations": {
            "standard": standard_res,
            "fast_mode": fast_res,
        },
        "system_footprint": {
            "chroma_dir_mb": chroma_size_mb,
            "bm25_dir_mb": bm25_size_mb,
            "model_load_ms": model_load_ms,
            "memory_rss_mb": memory_rss_mb,
        },
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)
    console.print(f"\n[green][OK] Saved benchmark metrics to: {out_file}[/green]")

    return export_payload


if __name__ == "__main__":
    app()
