"""Gold Evaluation Set Template Generator for AI Tutor.

Generates structured gold-set evaluation templates (~20 items per board/subject)
covering all 5 item types:
- 8 direct (factual concept queries)
- 4 paraphrase (reworded / student vernacular)
- 4 follow-up (conversational turns with pronouns/ellipses)
- 2 noisy (phonetic STT mishearings or typos)
- 2 out-of-scope (expected refusal queries)

Usage:
  python -m app.rag.eval.make_gold_template --board tn --subject science
  python -m app.rag.eval.make_gold_template --all
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
import typer
import yaml
from rich.console import Console

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.config import settings
from app.rag.indexer import scan_processed_chunks

app = typer.Typer(help="Gold Set Template Generator for AI Tutor Evaluation")
console = Console(legacy_windows=False)


CURRICULUM_SAMPLE_PROMPTS = {
    ("tn", "science"): [
        ("direct", 1, "Laws of Motion", "What is Newton's first law of motion and inertia?"),
        ("direct", 1, "Laws of Motion", "State Newton's second law of motion with mathematical formula."),
        ("direct", 1, "Laws of Motion", "Define impulse and state its unit."),
        ("direct", 12, "Plant Anatomy and Plant Physiology", "What are the main functions of chloroplasts in photosynthesis?"),
        ("direct", 12, "Plant Anatomy and Plant Physiology", "Explain the difference between light-dependent and dark reactions."),
        ("direct", 12, "Plant Anatomy and Plant Physiology", "What is the role of stomata in plant transpiration?"),
        ("direct", 14, "Transportation in Plants and Circulation in Animals", "Describe the structure of the human heart and double circulation."),
        ("direct", 14, "Transportation in Plants and Circulation in Animals", "What are the components of blood and their functions?"),
        ("paraphrase", 1, "Laws of Motion", "Why do passengers jerk forward when a bus applies sudden brakes?"),
        ("paraphrase", 1, "Laws of Motion", "How is mass related to an object's resistance to movement?"),
        ("paraphrase", 12, "Plant Anatomy and Plant Physiology", "How do green leaves convert atmospheric carbon dioxide into sugar?"),
        ("paraphrase", 14, "Transportation in Plants and Circulation in Animals", "Why does blood travel through the human heart twice per cycle?"),
        ("follow_up", 12, "Plant Anatomy and Plant Physiology", "Where does it happen inside the cell?"),
        ("follow_up", 12, "Plant Anatomy and Plant Physiology", "What are its key end products?"),
        ("follow_up", 1, "Laws of Motion", "Give a real-life example of it."),
        ("follow_up", 14, "Transportation in Plants and Circulation in Animals", "What happens if its valves fail to close properly?"),
        ("noisy", 1, "Laws of Motion", "nutons ther law of moshun action and reackshun"),
        ("noisy", 12, "Plant Anatomy and Plant Physiology", "wot is fotosinthesis in leef cell"),
        ("out_of_scope", None, None, "What is the capital city of France?"),
        ("out_of_scope", None, None, "Solve the calculus integration of x squared dx."),
    ],
    ("tn", "social_science"): [
        ("direct", 1, "Outbreak of World War I and Its Aftermath", "What were the main causes of the First World War in 1914?"),
        ("direct", 1, "Outbreak of World War I and Its Aftermath", "Explain the terms of the Treaty of Versailles."),
        ("direct", 2, "World between two World Wars", "What were the consequences of the Great Depression of 1929?"),
        ("direct", 2, "World between two World Wars", "Describe the rise of Fascism in Italy under Mussolini."),
        ("direct", 6, "Early Revolts against British Rule in Tamil Nadu", "Explain the role of Veerapandiya Kattabomman in resisting the British."),
        ("direct", 6, "Early Revolts against British Rule in Tamil Nadu", "Describe the Palayakkarar system and its significance."),
        ("direct", 1, "India - Location, Relief and Drainage", "What are the major physiographic divisions of India?"),
        ("direct", 1, "India - Location, Relief and Drainage", "Explain the difference between Himalayan and Peninsular rivers."),
        ("paraphrase", 1, "Outbreak of World War I and Its Aftermath", "Why did European powers enter military alliances before 1914?"),
        ("paraphrase", 2, "World between two World Wars", "How did economic collapse in America impact world trade in 1929?"),
        ("paraphrase", 6, "Early Revolts against British Rule in Tamil Nadu", "Why did southern chieftains rebel against the English East India Company?"),
        ("paraphrase", 1, "India - Location, Relief and Drainage", "Why do north Indian rivers flow throughout the year while south Indian rivers dry up in summer?"),
        ("follow_up", 1, "Outbreak of World War I and Its Aftermath", "When was it signed?"),
        ("follow_up", 2, "World between two World Wars", "Who was its primary leader?"),
        ("follow_up", 6, "Early Revolts against British Rule in Tamil Nadu", "Where did this battle take place?"),
        ("follow_up", 1, "India - Location, Relief and Drainage", "What are their main tributaries?"),
        ("noisy", 1, "Outbreak of World War I and Its Aftermath", "treaty of versales condishuns in 1919"),
        ("noisy", 6, "Early Revolts against British Rule in Tamil Nadu", "veerapandya kataboman revolt agaynst brtish"),
        ("out_of_scope", None, None, "What is the current stock price of Apple Inc?"),
        ("out_of_scope", None, None, "Explain the rules of quantum computing qubits."),
    ],
    ("cbse", "science"): [
        ("direct", 1, "Chemical Reactions and Equations", "What is a balanced chemical equation and why should it be balanced?"),
        ("direct", 1, "Chemical Reactions and Equations", "Explain displacement and double displacement reactions with examples."),
        ("direct", 2, "Acids, Bases and Salts", "What happens when an acid reacts with a metal?"),
        ("direct", 2, "Acids, Bases and Salts", "Explain the importance of pH in everyday life."),
        ("direct", 5, "Life Processes", "What are the differences between autotrophic and heterotrophic nutrition?"),
        ("direct", 5, "Life Processes", "Describe the process of respiration in human beings."),
        ("direct", 9, "Light - Reflection and Refraction", "State the laws of reflection of light."),
        ("direct", 10, "Human Eye and the Colourful World", "Why do stars twinkle in the night sky?"),
        ("paraphrase", 1, "Chemical Reactions and Equations", "Why must the number of atoms stay equal before and after a chemical reaction?"),
        ("paraphrase", 2, "Acids, Bases and Salts", "Why does tooth decay occur when mouth pH drops below 5.5?"),
        ("paraphrase", 5, "Life Processes", "How do cells extract energy from digested glucose food?"),
        ("paraphrase", 10, "Human Eye and the Colourful World", "Why does the sun appear reddish early in the morning?"),
        ("follow_up", 1, "Chemical Reactions and Equations", "Give a chemical equation for it."),
        ("follow_up", 2, "Acids, Bases and Salts", "How can you test it with litmus paper?"),
        ("follow_up", 5, "Life Processes", "Where does this stage take place in mitochondria?"),
        ("follow_up", 10, "Human Eye and the Colourful World", "Does this also happen on the Moon?"),
        ("noisy", 1, "Chemical Reactions and Equations", "balansed chemikal equashun defnition"),
        ("noisy", 10, "Human Eye and the Colourful World", "y do starz twinckle at nite"),
        ("out_of_scope", None, None, "How to cook Italian pasta carbonara?"),
        ("out_of_scope", None, None, "What are the symptoms of appendicitis surgery recovery?"),
    ],
    ("cbse", "social_science"): [
        ("direct", 1, "The Rise of Nationalism in Europe", "What was the concept of nation-state developed in 19th century Europe?"),
        ("direct", 1, "The Rise of Nationalism in Europe", "Explain the Civil Code of 1804 (Napoleonic Code)."),
        ("direct", 2, "Nationalism in India", "Why did Mahatma Gandhi organize the Non-Cooperation Movement?"),
        ("direct", 2, "Nationalism in India", "Describe the Salt March of 1930 and its significance."),
        ("direct", 1, "Power Sharing", "What is the difference between power sharing in Belgium and Sri Lanka?"),
        ("direct", 1, "Power Sharing", "Why is power sharing desirable in a democracy?"),
        ("direct", 1, "Development", "What are the common indicators of economic development?"),
        ("direct", 1, "Development", "Why is sustainable development crucial for future generations?"),
        ("paraphrase", 1, "The Rise of Nationalism in Europe", "How did Napoleon reform administrative and legal systems in conquered territories?"),
        ("paraphrase", 2, "Nationalism in India", "Why did salt become a powerful symbol of united protest against British colonial rule?"),
        ("paraphrase", 1, "Power Sharing", "How did Belgium prevent civil conflict between Dutch and French speaking citizens?"),
        ("paraphrase", 1, "Development", "Why does per capita income alone fail to tell us about equitable distribution of wealth?"),
        ("follow_up", 2, "Nationalism in India", "When did this movement take place?"),
        ("follow_up", 2, "Nationalism in India", "Why did he call it off after Chauri Chaura?"),
        ("follow_up", 1, "Power Sharing", "What constitutional amendments did they introduce?"),
        ("follow_up", 1, "Development", "Which international agency publishes this index?"),
        ("noisy", 2, "Nationalism in India", "gandhiji salt march dandi yatra in 1930"),
        ("noisy", 1, "Power Sharing", "power shareing in belgium and srilanka diffrence"),
        ("out_of_scope", None, None, "What is the best investment portfolio for retirement?"),
        ("out_of_scope", None, None, "Explain the rules of cricket leg before wicket rule."),
    ],
}


def build_template_items(board: str, subject: str) -> List[Dict[str, Any]]:
    """Builds 20 curated gold questions for the given board and subject."""
    key = (board.lower(), subject.lower())
    prompt_list = CURRICULUM_SAMPLE_PROMPTS.get(key, [])

    items = []
    for idx, (itype, chap_no, chap_title, q_text) in enumerate(prompt_list, start=1):
        item_id = f"{board}_{subject[:3]}_{idx:02d}"
        record: Dict[str, Any] = {
            "item_id": item_id,
            "item_type": itype,
            "question": q_text,
            "board": board,
            "class_level": 10,
            "subject": subject,
        }

        if itype == "out_of_scope":
            record["expected_refusal"] = True
            record["notes"] = "Negative test: Expected to be politely declined by safety guardrail."
        else:
            record["expected_chapter_no"] = chap_no
            record["expected_chapter_title"] = chap_title
            record["notes"] = f"Curriculum evaluation item ({itype}) for Class 10 {subject.replace('_', ' ').title()}."

            if itype == "follow_up":
                record["history"] = [
                    {"role": "student", "text": f"Explain {chap_title}."},
                    {"role": "tutor", "text": f"This chapter covers the key concepts of {chap_title} in your Class 10 textbook."},
                ]

        items.append(record)

    return items


@app.command()
def generate(
    board: Optional[str] = typer.Option(None, "--board", "-b", help="Board: 'tn' or 'cbse'"),
    subject: Optional[str] = typer.Option(None, "--subject", "-s", help="Subject: 'science' or 'social_science'"),
    all_targets: bool = typer.Option(False, "--all", "-a", help="Generate templates for all 4 curriculum targets"),
    output_dir: Optional[str] = typer.Option(None, "--output-dir", "-o", help="Custom output directory"),
):
    """Generates standard Class 10 gold evaluation YAML templates (20 items each)."""
    console.print(f"[bold cyan]AI Tutor - Phase 13 Gold Evaluation Template Generator[/bold cyan]")

    target_dir = Path(output_dir) if output_dir else Path(settings.EVAL_DIR) / "templates"
    target_dir.mkdir(parents=True, exist_ok=True)

    targets = []
    if all_targets:
        targets = [
            ("tn", "science"),
            ("tn", "social_science"),
            ("cbse", "science"),
            ("cbse", "social_science"),
        ]
    elif board and subject:
        targets = [(board.lower(), subject.lower())]
    else:
        console.print("[yellow]Please specify --board and --subject, or pass --all to generate all 4 sets.[/yellow]")
        raise typer.Exit(code=1)

    generated_files = []
    all_items_combined = []

    for b, s in targets:
        items = build_template_items(b, s)
        out_file = target_dir / f"gold_set.{b}_c10_{s}.yaml"
        with open(out_file, "w", encoding="utf-8") as f:
            yaml.dump({"items": items}, f, sort_keys=False, allow_unicode=True)
        console.print(f"[green][OK] Generated {len(items)} items for {b.upper()} Class 10 {s} -> {out_file}[/green]")
        generated_files.append(out_file)
        all_items_combined.extend(items)

    # Also generate master gold_set.draft.yaml combining all 80 items
    master_file = Path(settings.EVAL_DIR) / "gold_set.draft.yaml"
    with open(master_file, "w", encoding="utf-8") as f:
        yaml.dump({"items": all_items_combined}, f, sort_keys=False, allow_unicode=True)
    console.print(f"\n[bold green][OK] Master draft gold set (80 items across all boards) created at: {master_file}[/bold green]")
    console.print("[dim]You can review this draft, customize questions, and copy it to data/eval/gold_set.yaml.[/dim]")


if __name__ == "__main__":
    app()
