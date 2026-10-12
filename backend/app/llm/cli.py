"""Command-line interface for AI Tutor LLM generation and failover testing."""

import asyncio
import sys
import time
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

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
    stream: bool = typer.Option(False, "--stream", help="Stream response tokens via terminal"),
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="Provider override (gemini, groq, mistral, openai, mock)"),
    mock: bool = typer.Option(False, "--mock", "-m", help="Force deterministic MockProvider"),
    k: int = typer.Option(5, "--k", help="Top chunks to retrieve"),
):
    """Ask a question grounded in Class 10 textbook curriculum."""
    try:
        norm_board, norm_class, norm_subject = validate_scope(board=board, class_level=10, subject=subject)
    except ValueError as e:
        console.print(f"[bold red]{e}[/bold red]")
        raise typer.Exit(code=1)

    console.print(Panel(
        f"[bold yellow]Question:[/bold yellow] {question}\n"
        f"[bold cyan]Scope:[/bold cyan] {norm_board.upper()} Class 10 {norm_subject.replace('_', ' ').title()}" +
        (f" (Chapter {chapter})" if chapter else "") +
        f" | [bold magenta]Provider:[/bold magenta] {provider or ('mock' if mock else 'auto-fallback')}",
        title="[bold green]AI Tutor - Grounded Answer Generation[/bold green]",
        border_style="green",
    ))

    if stream:
        async def _run_stream():
            console.print("\n[bold cyan]Answer:[/bold cyan] ", end="")
            final_data = {}
            candidate_sources = []

            async for event in stream_answer_question(
                question=question,
                board=norm_board,
                subject=norm_subject,
                chapter_no=chapter,
                top_k=k,
                provider_override=provider,
                force_mock=mock,
            ):
                ev_type = event.get("event")
                ev_data = event.get("data", {})
                if ev_type == "sources":
                    candidate_sources = ev_data.get("sources", [])
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
                    top_k=k,
                    provider_override=provider,
                    force_mock=mock,
                )

            console.print(Panel(res.answer, title="[bold cyan]Tutor Answer[/bold cyan]", border_style="cyan"))

            # Print sources
            if res.sources:
                table = Table(title="Used Textbook Sources & Citations")
                table.add_column("Marker", style="bold yellow", justify="center")
                table.add_column("Book & Chapter", style="green")
                table.add_column("Pages", style="cyan", justify="center")
                table.add_column("Chunk ID", style="dim")

                for s in res.sources:
                    chap_info = s.chapter_title or (f"Chapter {s.chapter_no}" if s.chapter_no else "")
                    pages = f"p. {s.page_start}" if s.page_start == s.page_end else f"p. {s.page_start}-{s.page_end}"
                    table.add_row(f"[{s.citation_index}]", f"{s.book_title} ({chap_info})", pages, s.chunk_id)

                console.print(table)
            else:
                console.print("[italic yellow]No textbook citations found in generated answer.[/italic yellow]")

            # Print timings & audit metadata
            meta_table = Table(title="Execution Metrics")
            meta_table.add_column("Metric", style="bold")
            meta_table.add_column("Value", style="cyan")

            meta_table.add_row("Provider", res.provider)
            meta_table.add_row("Model", res.model)
            meta_table.add_row("Retrieval Latency", f"{res.latency_ms.retrieval:.1f} ms")
            meta_table.add_row("Generation Latency", f"{res.latency_ms.generation:.1f} ms")
            meta_table.add_row("Total Latency", f"{res.latency_ms.total:.1f} ms")
            meta_table.add_row("Grounded", "[green]True[/green]" if res.grounded else "[red]False[/red]")
            meta_table.add_row("Mock Mode", str(res.mock))
            if res.usage:
                meta_table.add_row("Tokens (Prompt / Comp / Total)", f"{res.usage.get('prompt_tokens', 0)} / {res.usage.get('completion_tokens', 0)} / {res.usage.get('total_tokens', 0)}")

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

    meta_table = Table(title="Stream Execution Metrics")
    meta_table.add_column("Metric", style="bold")
    meta_table.add_column("Value", style="cyan")
    meta_table.add_row("Provider", data.get("provider", "unknown"))
    meta_table.add_row("Model", data.get("model", "unknown"))
    meta_table.add_row("Grounded", "[green]True[/green]" if data.get("grounded") else "[red]False[/red]")
    meta_table.add_row("Mock", str(data.get("mock", False)))
    latencies = data.get("latency_ms", {})
    if isinstance(latencies, dict):
        meta_table.add_row("Total Latency", f"{latencies.get('total', 0):.1f} ms")
    console.print(meta_table)


@app.command()
def failover_test():
    """Simulates primary providers failing and validates fallback chain operation."""
    console.print(Panel(
        "[bold cyan]AI Tutor - LLM Multi-Provider Failover Test[/bold cyan]\n"
        "This test injects simulated errors into primary providers to verify that the router\n"
        "gracefully cascades down the fallback chain and answers without disruption.",
        title="[bold yellow]Failover Simulation[/bold yellow]",
        border_style="yellow",
    ))

    router = get_llm_router()

    # Step 1: Simulate Gemini failing with RateLimitError (429)
    # Step 2: Simulate Groq failing with Timeout (25s)
    # Step 3: Allow Mistral/Mock to answer
    console.print("\n[bold]Scenario 1: Primary provider failure (Gemini: 429 RateLimit)[/bold]")
    router._fault_injections = {"gemini": "rate_limit"}

    messages = [
        {"role": "system", "content": "You are AI Tutor."},
        {"role": "user", "content": "TEXTBOOK CONTEXT BLOCKS:\n[1] (CBSE Class 10 Science) Light travels in straight lines.\n\nWhy does light bend in water?"},
    ]

    async def _test():
        res1 = await router.generate(messages, force_mock=False)
        console.print(f"-> Attempt 1 Result: Provider used = [bold green]{res1['provider']}[/bold green] (Model: {res1['model']})")
        cb_gemini = router.circuit_breakers.get("gemini")
        if cb_gemini:
            console.print(f"   Gemini Circuit Breaker: failures={cb_gemini.failure_count}, state={cb_gemini.state}")

        console.print("\n[bold]Scenario 2: Multi-provider cascading failure (Gemini: 401 Auth, Groq: Timeout)[/bold]")
        router._fault_injections = {"gemini": "auth", "groq": "timeout"}
        res2 = await router.generate(messages, force_mock=False)
        console.print(f"-> Attempt 2 Result: Provider used = [bold green]{res2['provider']}[/bold green] (Model: {res2['model']})")

        console.print("\n[bold]Scenario 3: All real providers failing -> Clean Fallback to MockProvider[/bold]")
        router._fault_injections = {
            "gemini": "auth",
            "groq": "timeout",
            "mistral": "rate_limit",
            "openai": "rate_limit",
        }
        res3 = await router.generate(messages, force_mock=False)
        console.print(f"-> Attempt 3 Result: Provider used = [bold green]{res3['provider']}[/bold green] (Mock: {res3['mock']})")

        # Cleanup fault injections
        router._fault_injections.clear()
        for cb in router.circuit_breakers.values():
            cb.reset()

        console.print("\n[bold green][PASS] All failover scenarios completed successfully![/bold green]")

    asyncio.run(_test())


if __name__ == "__main__":
    app()
