"""Answer quality evaluation harness for AI Tutor (Phase 13).

Evaluates:
1. Grounded flag & citation validity (all [n] map to retrieved chunks)
2. Citation relevance (cited chunk's chapter matches expected chapter)
3. Refusal correctness on out-of-scope items & false-refusal rate on in-scope items
4. LLM-free readability metrics per learning mode:
   - Average sentence length
   - Average word length
   - Flesch-Kincaid grade level
   - Flesch reading ease
   - Share of sentences > 20 words
5. Optional LLM-as-judge (--judge flag, OFF by default):
   - Rates faithfulness (1-5) & correctness (1-5) using free provider chain
   - Rate-limit-aware pacing, disk caching at data/eval/results/judge_cache.json
   - Explicit caveats: judge scores are approximate and unvalidated
6. Human rating sheet CSV export: data/eval/results/human_rating_sheet.csv
"""

import asyncio
import csv
import datetime
import hashlib
import json
import logging
import os
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
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.config import settings
from app.services.answer import answer_question
from app.services.memory import Turn
from app.llm.router import get_llm_router

app = typer.Typer(help="AI Tutor Answer Quality & Readability Evaluation")
console = Console(legacy_windows=False)
logger = logging.getLogger("ai_tutor.eval.answers")


# ---------------------------------------------------------
# Readability Algorithms (LLM-Free Deterministic Metrics)
# ---------------------------------------------------------

def count_syllables_word(word: str) -> int:
    """Estimates syllables in an English word using standard heuristic."""
    w = word.lower().strip()
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    # Remove common non-syllabic endings
    w = re.sub(r"(?:[^laeiouy]|ed|es|e)$", "", w)
    w = re.sub(r"^y", "", w)
    syllables = len(re.findall(r"[aeiouy]{1,2}", w))
    return max(1, syllables)


def compute_readability_metrics(text: str) -> Dict[str, float]:
    """Computes Flesch-Kincaid grade, Flesch reading ease, and sentence metrics."""
    cleaned = re.sub(r"\[\d+\]", "", text)  # Strip citations
    cleaned = re.sub(r"(\*\*|#{1,6}\s|```|`|_)", "", cleaned).strip()

    # Split sentences by period, exclamation, question mark
    raw_sentences = re.split(r"[.!?]+(?:\s+|$)", cleaned)
    sentences = [s.strip() for s in raw_sentences if s.strip() and len(s.split()) >= 2]

    words = re.findall(r"\b[a-zA-Z0-9-']+\b", cleaned)

    num_sentences = max(1, len(sentences))
    num_words = max(1, len(words))

    total_syllables = sum(count_syllables_word(w) for w in words)
    total_chars = sum(len(w) for w in words)

    avg_sentence_len = num_words / num_sentences
    avg_word_len = total_chars / num_words
    syllables_per_word = total_syllables / num_words

    # Flesch-Kincaid Grade Level formula
    fk_grade = 0.39 * avg_sentence_len + 11.8 * syllables_per_word - 15.59
    fk_grade = max(1.0, min(18.0, round(fk_grade, 2)))

    # Flesch Reading Ease (higher = easier to read, 100 = very easy, 30 = very difficult)
    fre = 206.835 - 1.015 * avg_sentence_len - 84.6 * syllables_per_word
    fre = max(0.0, min(100.0, round(fre, 2)))

    # Share of sentences > 20 words
    long_sentences = sum(1 for s in sentences if len(s.split()) > 20)
    share_long_sentences = round((long_sentences / num_sentences) * 100.0, 1)

    return {
        "avg_sentence_length": round(avg_sentence_len, 2),
        "avg_word_length": round(avg_word_len, 2),
        "flesch_kincaid_grade": fk_grade,
        "flesch_reading_ease": fre,
        "share_long_sentences_pct": share_long_sentences,
        "total_words": num_words,
        "total_sentences": num_sentences,
    }


# ---------------------------------------------------------
# Optional LLM-as-Judge (Off by default, cached & paced)
# ---------------------------------------------------------

JUDGE_PROMPT_TEMPLATE = """You are an independent educational evaluator assessing an AI Tutor response for Class 10 school students.
Evaluate the candidate response based strictly on the provided retrieved textbook context.

QUESTION: {question}
RETRIEVED TEXTBOOK CONTEXT:
{context}

CANDIDATE TUTOR ANSWER:
{answer}

Rate on a 1-5 integer scale:
1. FAITHFULNESS (1-5):
   - 5: Fully faithful; every claim is grounded directly in the textbook excerpt.
   - 3: Mostly faithful; minor unverified claims or embellishments.
   - 1: Severe hallucination or contradicts textbook context.

2. CORRECTNESS (1-5):
   - 5: Scientifically and historically accurate for Class 10 standard.
   - 3: Partially correct or incomplete explanation.
   - 1: Factually wrong or misleading.

OUTPUT STRICT JSON ONLY:
{{"faithfulness": int, "correctness": int, "reason": "brief rationale"}}"""


async def run_llm_judge(
    question: str,
    context: str,
    answer: str,
    cache_path: Path,
) -> Dict[str, Any]:
    """Runs LLM-as-judge with disk caching and rate-limit aware pacing."""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache: Dict[str, Any] = {}
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}

    h = hashlib.sha256(f"{question}|||{answer}|||{context[:200]}".encode()).hexdigest()
    if h in cache:
        return cache[h]

    router = get_llm_router()
    prompt = JUDGE_PROMPT_TEMPLATE.format(
        question=question,
        context=context[:1500] if context else "(No textbook context retrieved)",
        answer=answer,
    )

    try:
        # Pacing
        await asyncio.sleep(0.5)
        res = await router.generate(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=120,
        )
        content = res.get("content", "{}").strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
        data = json.loads(content)
        f_score = int(data.get("faithfulness", 3))
        c_score = int(data.get("correctness", 3))
        result = {
            "faithfulness": max(1, min(5, f_score)),
            "correctness": max(1, min(5, c_score)),
            "reason": str(data.get("reason", "")),
        }
    except Exception as e:
        logger.warning(f"Judge evaluation failed: {e}")
        result = {"faithfulness": 3, "correctness": 3, "reason": f"Fallback: {e}"}

    cache[h] = result
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

    return result


# ---------------------------------------------------------
# Answer Evaluation Runner
# ---------------------------------------------------------

def _load_gold_items(gold_file: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Path]:
    """Locates and loads gold set items."""
    gold_path = None
    if gold_file:
        gold_path = Path(gold_file)
    else:
        candidates = [
            Path(settings.EVAL_DIR) / "gold_set.yaml",
            Path(settings.EVAL_DIR) / "gold_set.draft.yaml",
            Path(__file__).parent.parent / "rag" / "eval" / "gold_set.example.yaml",
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
    valid_items = [it for it in items if isinstance(it, dict) and it.get("question", "").strip()]
    return valid_items, gold_path


def run_answer_evaluation(
    gold_items: List[Dict[str, Any]],
    modes: List[str] = ("simple", "step_by_step", "example", "exam"),
    mock: bool = True,
    judge_enabled: bool = False,
    cache_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Evaluates answer generation across all learning modes for the provided gold items."""
    in_scope_items = [it for it in gold_items if not it.get("expected_refusal")]
    out_of_scope_items = [it for it in gold_items if it.get("expected_refusal")]

    results_by_mode: Dict[str, Any] = {}
    rating_sheet_rows: List[Dict[str, Any]] = []

    judge_cache = cache_path or Path(settings.EVAL_DIR) / "results" / "judge_cache.json"

    for mode in modes:
        mode_records: List[Dict[str, Any]] = []
        grounded_count = 0
        valid_citations_count = 0
        relevant_citations_count = 0
        false_refusals_count = 0
        all_readability: List[Dict[str, float]] = []
        judge_faithfulness: List[int] = []
        judge_correctness: List[int] = []

        for idx, it in enumerate(in_scope_items, start=1):
            q = it["question"]
            hist_raw = it.get("history") or []
            turns = [Turn(role=t.get("role", "student"), text=t.get("text", "")) for t in hist_raw]

            # Execute answer pipeline
            ans_res = asyncio.run(
                answer_question(
                    question=q,
                    board=it["board"],
                    subject=it["subject"],
                    mode=mode,
                    learning_mode=mode,
                    history=turns,
                    force_mock=mock,
                )
            )

            is_refusal = any(
                p in ans_res.answer.lower()
                for p in ["couldn't find", "not found", "cannot find", "not in your"]
            )
            if is_refusal:
                false_refusals_count += 1

            if ans_res.grounded:
                grounded_count += 1

            # Citation validity check
            cited_indices = [int(m) for m in re.findall(r"\[(\d+)\]", ans_res.answer)]
            source_indices = [s.citation_index for s in ans_res.sources]
            citations_valid = True
            for c_idx in cited_indices:
                if c_idx not in source_indices:
                    citations_valid = False
            if citations_valid and (not cited_indices or len(ans_res.sources) > 0):
                valid_citations_count += 1

            # Citation relevance check (matches expected chapter)
            exp_chap = it.get("expected_chapter_no")
            citation_relevant = False
            if ans_res.sources and exp_chap is not None:
                for s in ans_res.sources:
                    if s.chapter_no == exp_chap:
                        citation_relevant = True
                        break
            elif not exp_chap:
                citation_relevant = True
            if citation_relevant:
                relevant_citations_count += 1

            # Readability
            readability = compute_readability_metrics(ans_res.answer)
            all_readability.append(readability)

            # Optional Judge
            judge_score = None
            if judge_enabled:
                context_str = "\n".join([s.text_snippet for s in ans_res.sources])
                judge_res = asyncio.run(run_llm_judge(q, context_str, ans_res.answer, judge_cache))
                judge_faithfulness.append(judge_res["faithfulness"])
                judge_correctness.append(judge_res["correctness"])
                judge_score = judge_res

            record = {
                "question_id": it.get("item_id", f"q_{idx:03d}"),
                "board": it["board"],
                "subject": it["subject"],
                "question": q,
                "mode": mode,
                "answer": ans_res.answer,
                "grounded": ans_res.grounded,
                "citations_valid": citations_valid,
                "citation_relevant": citation_relevant,
                "is_refusal": is_refusal,
                "provider": ans_res.provider,
                "readability": readability,
                "judge": judge_score,
            }
            mode_records.append(record)

            # Rating sheet entry
            rating_sheet_rows.append({
                "question_id": it.get("item_id", f"q_{idx:03d}"),
                "board": it["board"],
                "subject": it["subject"],
                "question": q,
                "mode": mode,
                "answer": ans_res.answer.replace("\n", " "),
                "sources": "; ".join([f"[{s.citation_index}] {s.book_title} p.{s.page_start}" for s in ans_res.sources]),
                "correctness_1_5": "",
                "simplicity_1_5": "",
                "helpfulness_1_5": "",
                "notes": "",
            })

        n_in = max(1, len(in_scope_items))
        avg_readability = {
            "avg_sentence_length": round(sum(r["avg_sentence_length"] for r in all_readability) / n_in, 2),
            "avg_word_length": round(sum(r["avg_word_length"] for r in all_readability) / n_in, 2),
            "flesch_kincaid_grade": round(sum(r["flesch_kincaid_grade"] for r in all_readability) / n_in, 2),
            "flesch_reading_ease": round(sum(r["flesch_reading_ease"] for r in all_readability) / n_in, 2),
            "share_long_sentences_pct": round(sum(r["share_long_sentences_pct"] for r in all_readability) / n_in, 1),
        }

        results_by_mode[mode] = {
            "total_questions": len(in_scope_items),
            "grounded_rate_pct": round((grounded_count / n_in) * 100.0, 1),
            "citation_validity_pct": round((valid_citations_count / n_in) * 100.0, 1),
            "citation_relevance_pct": round((relevant_citations_count / n_in) * 100.0, 1),
            "false_refusal_rate_pct": round((false_refusals_count / n_in) * 100.0, 1),
            "readability": avg_readability,
            "judge_faithfulness_avg": round(sum(judge_faithfulness) / len(judge_faithfulness), 2) if judge_faithfulness else None,
            "judge_correctness_avg": round(sum(judge_correctness) / len(judge_correctness), 2) if judge_correctness else None,
        }

    # Evaluate refusal on out_of_scope items
    correct_refusals = 0
    for it in out_of_scope_items:
        q = it["question"]
        ans_res = asyncio.run(
            answer_question(
                question=q,
                board=it["board"],
                subject=it["subject"],
                force_mock=mock,
            )
        )
        is_refusal = any(
            p in ans_res.answer.lower()
            for p in ["couldn't find", "not found", "cannot find", "not in your", "i am an accessible ai tutor"]
        )
        if is_refusal:
            correct_refusals += 1

    n_out = max(1, len(out_of_scope_items))
    refusal_accuracy_pct = round((correct_refusals / n_out) * 100.0, 1)

    return {
        "modes": results_by_mode,
        "refusal_accuracy_pct": refusal_accuracy_pct,
        "out_of_scope_count": len(out_of_scope_items),
        "in_scope_count": len(in_scope_items),
        "rating_sheet_rows": rating_sheet_rows,
        "judge_enabled": judge_enabled,
    }


@app.command()
def evaluate(
    gold_file: Optional[str] = typer.Option(None, "--file", "-f", help="Path to gold set YAML file"),
    judge: bool = typer.Option(False, "--judge", help="Enable optional LLM-as-judge scoring (approximate heuristic)"),
    mock: bool = typer.Option(True, "--mock", help="Use MockProvider for deterministic run"),
    output_json: Optional[str] = typer.Option(None, "--output-json", help="Path to output JSON"),
    output_csv: Optional[str] = typer.Option(None, "--output-csv", help="Path to output Human Rating CSV sheet"),
):
    """Runs answer quality, citation validity, and readability evaluation across learning modes."""
    valid_items, gold_path = _load_gold_items(gold_file)
    console.print(f"[bold cyan]AI Tutor - Phase 13 Answer Quality & Readability Evaluation[/bold cyan]")
    console.print(f"Loaded [bold]{len(valid_items)}[/bold] items from {gold_path}\n")

    res = run_answer_evaluation(
        gold_items=valid_items,
        mock=mock,
        judge_enabled=judge,
    )

    # Table 1: Grounding and Quality
    t_quality = Table(title="Answer Grounding, Citations & Refusals Across Learning Modes")
    t_quality.add_column("Learning Mode", style="cyan")
    t_quality.add_column("Grounded %", justify="right")
    t_quality.add_column("Citation Validity %", justify="right")
    t_quality.add_column("Citation Relevance %", justify="right")
    t_quality.add_column("False Refusal Rate %", justify="right")

    for mode, m_data in res["modes"].items():
        t_quality.add_row(
            mode,
            f"{m_data['grounded_rate_pct']:.1f}%",
            f"{m_data['citation_validity_pct']:.1f}%",
            f"{m_data['citation_relevance_pct']:.1f}%",
            f"{m_data['false_refusal_rate_pct']:.1f}%",
        )
    console.print(t_quality)

    console.print(f"\n[bold green]Out-of-Scope Correct Refusal Rate:[/bold green] [yellow]{res['refusal_accuracy_pct']:.1f}%[/yellow] (N={res['out_of_scope_count']})")

    # Table 2: Readability Metrics
    t_read = Table(title="LLM-Free Readability Metrics Per Learning Mode")
    t_read.add_column("Learning Mode", style="magenta")
    t_read.add_column("FK Grade Level", justify="right")
    t_read.add_column("Reading Ease", justify="right")
    t_read.add_column("Avg Sentence Len", justify="right")
    t_read.add_column("Avg Word Len", justify="right")
    t_read.add_column("Sentences > 20 Words", justify="right")

    for mode, m_data in res["modes"].items():
        rd = m_data["readability"]
        t_read.add_row(
            mode,
            f"Grade {rd['flesch_kincaid_grade']:.1f}",
            f"{rd['flesch_reading_ease']:.1f}",
            f"{rd['avg_sentence_length']:.1f} wds",
            f"{rd['avg_word_length']:.1f} chars",
            f"{rd['share_long_sentences_pct']:.1f}%",
        )
    console.print("\n", t_read)

    if judge:
        console.print("\n[bold yellow]Notice on LLM-as-Judge:[/bold yellow] [dim]Judge ratings are approximate, automated heuristics and NOT ground truth.[/dim]")
        t_judge = Table(title="LLM-as-Judge Ratings (1-5 Rubric)")
        t_judge.add_column("Mode", style="cyan")
        t_judge.add_column("Faithfulness (1-5)", justify="right")
        t_judge.add_column("Correctness (1-5)", justify="right")
        for mode, m_data in res["modes"].items():
            t_judge.add_row(
                mode,
                str(m_data["judge_faithfulness_avg"] or "N/A"),
                str(m_data["judge_correctness_avg"] or "N/A"),
            )
        console.print(t_judge)

    # Export rating sheet CSV
    out_dir = Path(settings.EVAL_DIR) / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = Path(output_csv) if output_csv else out_dir / "human_rating_sheet.csv"

    if res.get("rating_sheet_rows"):
        fieldnames = [
            "question_id", "board", "subject", "question", "mode", "answer",
            "sources", "correctness_1_5", "simplicity_1_5", "helpfulness_1_5", "notes"
        ]
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(res["rating_sheet_rows"])
        console.print(f"\n[green][OK] Exported human evaluation sheet to: {csv_path}[/green]")

    # Export JSON results
    json_path = Path(output_json) if output_json else out_dir / "answers_eval.json"
    export_payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "gold_file": str(gold_path),
        "in_scope_count": res["in_scope_count"],
        "out_of_scope_count": res["out_of_scope_count"],
        "refusal_accuracy_pct": res["refusal_accuracy_pct"],
        "modes": res["modes"],
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)
    console.print(f"[green][OK] Saved answer evaluation JSON to: {json_path}[/green]")


if __name__ == "__main__":
    app()
