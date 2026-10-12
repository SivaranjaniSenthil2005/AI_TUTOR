"""Command-line interface for AI Tutor LLM generation, learning modes, and failover testing."""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import List, Optional
import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.scope import validate_scope
from app.schemas import LearnerProfile
from app.services.memory import Turn
from app.services.answer import answer_question, stream_answer_question
from app.llm.router import LLMRouter, get_llm_router

app = typer.Typer(help="AI Tutor LLM Generation & Failover Tools")
console = Console(legacy_windows=False)


@app.command()
def ask(
    question: str = typer.Argument(..., help="Student question to ask"),
    board: str = typer.Option("cbse", "--board", "-b", help="Board: 'cbse' or 'tn'"),
    subject: str = typer.Option("science", "--subject", "-s", help="Subject: 'science' or 'social_science'"),
    chapter: Optional[int] = typer.Option(None, "--chapter", "-c", help="Optional chapter number filter"),
    mode: str = typer.Option("simple", "--mode", "-m", help="Learning mode: simple, step_by_step, example, exam"),
    reading_level: str = typer.Option("standard", "--reading-level", help="Learner profile reading level: easy, standard"),
    avoid_figurative: bool = typer.Option(False, "--avoid-figurative", help="Enforce strictly literal language for neurodiverse learners"),
    stream: bool = typer.Option(False, "--stream", help="Stream response tokens via terminal"),
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="Provider override (gemini, groq, mistral, openai, mock)"),
    mock: bool = typer.Option(False, "--mock", help="Force deterministic MockProvider"),
    k: int = typer.Option(5, "--k", help="Top chunks to retrieve"),
    speech: bool = typer.Option(True, "--speech", help="Display text-to-speech audio transcript"),
):
    """Ask a question grounded in Class 10 textbook curriculum with Phase 11 Advanced RAG."""
    try:
        norm_board, norm_class, norm_subject = validate_scope(board=board, class_level=10, subject=subject)
    except ValueError as e:
        console.print(f"[bold red]{e}[/bold red]")
        raise typer.Exit(code=1)

    profile = LearnerProfile(
        reading_level=reading_level,
        avoid_figurative_language=avoid_figurative,
    )

    console.print(Panel(
        f"[bold yellow]Question:[/bold yellow] {question}\n"
        f"[bold cyan]Scope:[/bold cyan] {norm_board.upper()} Class 10 {norm_subject.replace('_', ' ').title()}" +
        (f" (Chapter {chapter})" if chapter else "") +
        f"\n[bold magenta]Mode:[/bold magenta] {mode} | [bold blue]Reading Level:[/bold blue] {reading_level}" +
        (f" | [bold green]Literal Language:[/bold green] ON" if avoid_figurative else "") +
        f" | [bold dim]Provider:[/bold dim] {provider or ('mock' if mock else 'auto-fallback')}",
        title="[bold green]AI Tutor - Grounded Answer Generation (Phase 11)[/bold green]",
        border_style="green",
    ))

    if stream:
        async def _run_stream():
            console.print("\n[bold cyan]Answer:[/bold cyan] ", end="")
            final_data = {}

            async for event in stream_answer_question(
                question=question,
                board=norm_board,
                subject=norm_subject,
                chapter_no=chapter,
                mode=mode,
                learner_profile=profile,
                top_k=k,
                provider_override=provider,
                force_mock=mock,
            ):
                ev_type = event.get("event")
                ev_data = event.get("data", {})
                if ev_type == "meta":
                    if ev_data.get("rewritten_query"):
                        console.print(f"\n[bold yellow]Rewritten Query:[/bold yellow] {ev_data.get('rewritten_query')}")
                elif ev_type == "token":
                    console.print(ev_data.get("delta", ""), end="", highlight=False)
                elif ev_type == "done":
                    final_data = ev_data
                elif ev_type == "error":
                    console.print(f"\n[bold red]Stream Error: {ev_data.get('message')}[/bold red]")

            console.print("\n")
            _print_metadata(final_data)

        asyncio.run(_run_stream())
    else:
        async def _run_generate():
            with console.status("[bold cyan]Retrieving curriculum context & generating answer...[/bold cyan]"):
                res = await answer_question(
                    question=question,
                    board=norm_board,
                    subject=norm_subject,
                    chapter_no=chapter,
                    mode=mode,
                    learner_profile=profile,
                    top_k=k,
                    provider_override=provider,
                    force_mock=mock,
                )

            if res.rewritten_query:
                console.print(f"[bold yellow]Rewritten Query:[/bold yellow] {res.rewritten_query}")

            console.print(Panel(res.answer, title=f"[bold cyan]Tutor Answer ({res.mode.upper()})[/bold cyan]", border_style="cyan"))

            # Spoken TTS Text
            if speech and res.speech_text:
                console.print(Panel(res.speech_text, title="[bold green]Voice Output (Spoken Audio)[/bold green]", border_style="green"))

            # Follow-up Suggestions
            if res.suggested_questions:
                sug_table = Table(title="Suggested Follow-Up Questions (Gaze Target Buttons)")
                sug_table.add_column("#", justify="center", style="bold yellow")
                sug_table.add_column("Suggested Question", style="magenta")
                for s_idx, q_sug in enumerate(res.suggested_questions, start=1):
                    sug_table.add_row(str(s_idx), q_sug)
                console.print(sug_table)

            # Sources
            if res.sources:
                table = Table(title="Textbook Citations")
                table.add_column("Marker", style="bold yellow", justify="center")
                table.add_column("Book & Chapter", style="green")
                table.add_column("Pages", style="cyan", justify="center")
                table.add_column("Chunk ID", style="dim")

                for s in res.sources:
                    chap_info = s.chapter_title or (f"Chapter {s.chapter_no}" if s.chapter_no else "")
                    pages = f"p. {s.page_start}" if s.page_start == s.page_end else f"p. {s.page_start}-{s.page_end}"
                    table.add_row(f"[{s.citation_index}]", f"{s.book_title} ({chap_info})", pages, s.chunk_id)

                console.print(table)

            # Timings & Audit
            meta_table = Table(title="Execution Metrics per Stage")
            meta_table.add_column("Stage / Metric", style="bold")
            meta_table.add_column("Value", style="cyan")

            meta_table.add_row("Provider", res.provider)
            meta_table.add_row("Model", res.model)
            meta_table.add_row("Rewriting Stage", f"{res.latency_ms.rewriting:.1f} ms")
            meta_table.add_row("Expansion Stage", f"{res.latency_ms.expansion:.1f} ms")
            meta_table.add_row("Retrieval Stage", f"{res.latency_ms.retrieval:.1f} ms")
            meta_table.add_row("Generation Stage", f"{res.latency_ms.generation:.1f} ms")
            meta_table.add_row("Total Pipeline Latency", f"{res.latency_ms.total:.1f} ms")
            meta_table.add_row("Topic Hint", str(res.topic_hint or "N/A"))
            meta_table.add_row("Grounded", "[green]True[/green]" if res.grounded else "[red]False[/red]")

            console.print(meta_table)

        asyncio.run(_run_generate())


def _print_metadata(data: dict):
    """Print streaming summary metadata."""
    sources = data.get("sources", [])
    if sources:
        table = Table(title="Textbook Sources")
        table.add_column("Marker", style="bold yellow", justify="center")
        table.add_column("Book & Chapter", style="green")
        table.add_column("Pages", style="cyan", justify="center")
        for s in sources:
            chap = s.get("chapter_title", "")
            pages = f"p. {s.get('page_start', 1)}-{s.get('page_end', 1)}"
            table.add_row(f"[{s.get('citation_index', '')}]", f"{s.get('book_title', '')} ({chap})", pages)
        console.print(table)

    if data.get("speech_text"):
        console.print(Panel(data.get("speech_text"), title="[bold green]Voice Output (Spoken Audio)[/bold green]", border_style="green"))

    lat = data.get("latency_ms", {})
    meta_table = Table(title="Stream Execution Metrics")
    meta_table.add_column("Stage", style="bold")
    meta_table.add_column("Latency (ms)", style="cyan")
    for st, val in lat.items():
        meta_table.add_row(st.title(), f"{val:.1f} ms")
    console.print(meta_table)


@app.command()
def failover_test():
    """Runs a simulated multi-provider failover test demonstrating circuit breaking."""
    console.print("[bold cyan]AI Tutor - LLM Failover & Circuit Breaker Simulation[/bold cyan]\n")
    router = get_llm_router()

    console.print("[bold yellow]1. Simulating Provider Failures...[/bold yellow]")
    router.inject_fault("gemini", "rate_limit")
    router.inject_fault("groq", "auth")

    async def _test():
        messages = [
            {"role": "system", "content": "You are AI Tutor."},
            {"role": "user", "content": "What is photosynthesis?"},
        ]
        res = await router.generate(messages)
        console.print(f"[bold green][OK] Generation Succeeded via Failover![/bold green]")
        console.print(f"Active Provider Used: [bold cyan]{res['provider']}[/bold cyan] ({res['model']})")
        console.print(f"Latency: [bold]{res['latency_ms']:.1f} ms[/bold]\n")

        status = router.get_status()
        console.print("[bold blue]Provider Status & Circuit Breakers:[/bold blue]")
        table = Table()
        table.add_column("Provider", style="cyan")
        table.add_column("State", style="bold")
        table.add_column("Failures", justify="center")
        table.add_column("Cooldown Remaining", justify="right")

        for p, cb in status["circuit_breakers"].items():
            state_color = "green" if cb["state"] == "CLOSED" else "red"
            table.add_row(
                p,
                f"[{state_color}]{cb['state']}[/{state_color}]",
                str(cb["failure_count"]),
                f"{cb['cooldown_remaining_sec']}s",
            )
        console.print(table)

    asyncio.run(_test())
    router.clear_faults()


if __name__ == "__main__":
    app()
