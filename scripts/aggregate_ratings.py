"""Aggregate filled human evaluation rating sheets for AI Tutor.

Reads data/eval/results/human_rating_sheet.csv (or a user-provided CSV),
computes mean and spread (standard deviation, min, max) for:
- Correctness (1-5)
- Simplicity (1-5)
- Helpfulness (1-5)
across each learning mode (simple, step_by_step, example, exam).
"""

import csv
import sys
from pathlib import Path
from typing import Dict, List, Any
import numpy as np
import typer
from rich.console import Console
from rich.table import Table

console = Console(legacy_windows=False)
app = typer.Typer(help="Aggregate Human Rating Sheets for AI Tutor")


def analyze_ratings(csv_path: Path) -> Dict[str, Any]:
    """Parses CSV and computes per-mode rating statistics."""
    if not csv_path.exists():
        console.print(f"[red]Error: Rating sheet '{csv_path}' not found.[/red]")
        sys.exit(1)

    by_mode: Dict[str, Dict[str, List[float]]] = {}

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mode = row.get("mode", "unknown").strip().lower()
            if mode not in by_mode:
                by_mode[mode] = {"correctness": [], "simplicity": [], "helpfulness": []}

            for metric in ["correctness", "simplicity", "helpfulness"]:
                key = f"{metric}_1_5"
                raw_val = row.get(key, "").strip()
                if raw_val:
                    try:
                        val = float(raw_val)
                        if 1.0 <= val <= 5.0:
                            by_mode[mode][metric].append(val)
                    except ValueError:
                        pass

    summary = {}
    for mode, metrics in by_mode.items():
        summary[mode] = {}
        for m_name, vals in metrics.items():
            if vals:
                arr = np.array(vals)
                summary[mode][m_name] = {
                    "count": len(vals),
                    "mean": round(float(np.mean(arr)), 2),
                    "std": round(float(np.std(arr)), 2),
                    "min": round(float(np.min(arr)), 1),
                    "max": round(float(np.max(arr)), 1),
                }
            else:
                summary[mode][m_name] = {
                    "count": 0,
                    "mean": None,
                    "std": None,
                    "min": None,
                    "max": None,
                }

    return summary


@app.command()
def aggregate(
    csv_file: Optional[str] = typer.Option(
        None,
        "--file",
        "-f",
        help="Path to filled human_rating_sheet.csv",
    ),
):
    """Aggregates human ratings across learning modes."""
    target_path = (
        Path(csv_file)
        if csv_file
        else Path(__file__).resolve().parent.parent / "data" / "eval" / "results" / "human_rating_sheet.csv"
    )

    console.print(f"[bold cyan]AI Tutor - Human Evaluation Aggregator[/bold cyan]")
    console.print(f"Reading rating sheet: [underline]{target_path}[/underline]\n")

    stats = analyze_ratings(target_path)

    table = Table(title="Human Evaluation Ratings by Learning Mode (1-5 Scale)")
    table.add_column("Learning Mode", style="cyan")
    table.add_column("Ratings N", justify="right")
    table.add_column("Correctness (Mean ± SD)", justify="right")
    table.add_column("Simplicity (Mean ± SD)", justify="right")
    table.add_column("Helpfulness (Mean ± SD)", justify="right")

    for mode, m_dict in stats.items():
        c_stat = m_dict["correctness"]
        s_stat = m_dict["simplicity"]
        h_stat = m_dict["helpfulness"]

        n = c_stat["count"]
        c_str = f"{c_stat['mean']} ± {c_stat['std']}" if c_stat["mean"] else "No data"
        s_str = f"{s_stat['mean']} ± {s_stat['std']}" if s_stat["mean"] else "No data"
        h_str = f"{h_stat['mean']} ± {h_stat['std']}" if h_stat["mean"] else "No data"

        table.add_row(mode, str(n), c_str, s_str, h_str)

    console.print(table)


if __name__ == "__main__":
    app()
