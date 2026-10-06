"""Convenience synchronization workflow for AI Tutor textbooks.

Usage:
  python -m scripts.sync --board cbse --class 8
  python -m scripts.sync --board tn --class 10 --subject Science --ingest
"""

import sys
import argparse
from pathlib import Path
from typing import Optional

from scripts.polite_client import PoliteClient
from scripts.fetch_pdfs import download_manifest_books
from scripts.discover_links import extract_links_from_html, save_draft_manifest


def sync_textbooks(
    board: str = "cbse",
    class_level: Optional[int] = None,
    subject: Optional[str] = None,
    manifest_path: Path = Path("data/manifest.yaml"),
    draft_path: Path = Path("data/manifest.draft.yaml"),
    discover_url: Optional[str] = None,
    discover_html: Optional[str] = None,
    max_files: int = 50,
    force: bool = False,
    dry_run: bool = False,
    ingest: bool = False,
) -> int:
    """Execute end-to-end sync: discovery check, polite download, and optional ingestion."""
    PoliteClient.print_compliance_notice()

    print(f"[SYNC] Target Board: {board.upper()}")
    if class_level:
        print(f"[SYNC] Target Class: Standard {class_level}")
    if subject:
        print(f"[SYNC] Target Subject: {subject}")

    # Check manifest
    if not manifest_path.exists():
        if discover_html or discover_url:
            print(f"[SYNC] Manifest '{manifest_path}' not found. Running link discovery...")
            html_content = ""
            base_url = discover_url or "https://ncert.nic.in/"
            if discover_html:
                with open(discover_html, "r", encoding="utf-8", errors="replace") as f:
                    html_content = f.read()
            elif discover_url:
                client = PoliteClient()
                try:
                    resp = client.get(discover_url)
                    resp.raise_for_status()
                    html_content = resp.text
                finally:
                    client.close()

            min_c = class_level if class_level else 6
            max_c = class_level if class_level else 12
            books, skipped = extract_links_from_html(
                html_content=html_content,
                base_url=base_url,
                board_default=board,
                min_class=min_c,
                max_class=max_c,
                max_files=max_files,
            )
            save_draft_manifest(books, str(draft_path))
            print(f"[SYNC] Discovered {len(books)} textbooks.")
            print(f"[SYNC] Draft saved to '{draft_path}'. Please review and copy to '{manifest_path}':")
            print(f"       cp {draft_path} {manifest_path}\n")
            return 0
        elif draft_path.exists():
            print(f"[SYNC] Found draft manifest at '{draft_path}', but '{manifest_path}' is not yet reviewed.")
            print(f"       Please review '{draft_path}' and copy it to '{manifest_path}' to proceed with downloads.")
            return 1
        else:
            print(f"[ERROR] Manifest '{manifest_path}' not found.", file=sys.stderr)
            print("        Run discovery with --discover-url or --discover-html to generate draft manifest.", file=sys.stderr)
            return 1

    # Run bulk download
    print(f"[SYNC] Running manifest-driven download for {board.upper()} (Class {class_level or 'all'})...")
    summary = download_manifest_books(
        manifest_path=manifest_path,
        log_path=Path("data/download_log.jsonl"),
        board_filter=board,
        class_filter=class_level,
        subject_filter=subject,
        max_files=max_files,
        force=force,
        dry_run=dry_run,
    )

    if summary["failed"] > 0:
        print(f"[SYNC WARNING] {summary['failed']} downloads encountered errors. Check data/download_log.jsonl.")

    # Ingestion step (if --ingest requested)
    if ingest:
        print("\n[SYNC] Ingestion requested (--ingest)...")
        try:
            # Check if ingestion script/module is present
            import importlib
            ingest_mod = None
            for mod_name in ["scripts.ingest", "app.rag.ingest", "scripts.ingest_textbooks"]:
                try:
                    ingest_mod = importlib.import_module(mod_name)
                    break
                except ImportError:
                    continue

            if ingest_mod and hasattr(ingest_mod, "ingest_textbooks"):
                print(f"[SYNC] Invoking ingestion engine ({ingest_mod.__name__})...")
                ingest_mod.ingest_textbooks(board=board, class_level=class_level, subject=subject)
            else:
                print(f"[SYNC INFO] Textbooks verified in data/raw/{board}/. Ready for RAG ingestion pipeline.")
        except Exception as e:
            print(f"[SYNC ERROR] Ingestion error: {e}", file=sys.stderr)

    return 0 if summary["failed"] == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI Tutor Textbook Synchronization Pipeline (Discover -> Review -> Download -> Ingest)"
    )
    parser.add_argument("--board", choices=["cbse", "tn"], default="cbse", help="Educational board (default: cbse)")
    parser.add_argument("--class", dest="class_level", type=int, help="Target class standard (6-12)")
    parser.add_argument("--subject", help="Target subject keyword (e.g. Science, Mathematics)")
    parser.add_argument("--manifest", default="data/manifest.yaml", help="Path to reviewed manifest (default: data/manifest.yaml)")
    parser.add_argument("--draft", default="data/manifest.draft.yaml", help="Path to draft manifest (default: data/manifest.draft.yaml)")
    parser.add_argument("--discover-url", help="Optional URL to run discovery if manifest does not exist")
    parser.add_argument("--discover-html", help="Optional HTML file to run discovery if manifest does not exist")
    parser.add_argument("--max-files", type=int, default=50, help="Maximum files to download (default: 50)")
    parser.add_argument("--force", action="store_true", help="Force re-download of existing verified files")
    parser.add_argument("--dry-run", action="store_true", help="Simulate synchronization without downloading")
    parser.add_argument("--ingest", action="store_true", help="Run textbook ingestion pipeline for downloaded files")

    args = parser.parse_args()

    return sync_textbooks(
        board=args.board,
        class_level=args.class_level,
        subject=args.subject,
        manifest_path=Path(args.manifest),
        draft_path=Path(args.draft),
        discover_url=args.discover_url,
        discover_html=args.discover_html,
        max_files=args.max_files,
        force=args.force,
        dry_run=args.dry_run,
        ingest=args.ingest,
    )


if __name__ == "__main__":
    sys.exit(main())
