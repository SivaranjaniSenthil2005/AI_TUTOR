"""Bulk PDF Downloader for AI Tutor Textbooks.

Reads reviewed manifest (data/manifest.yaml), politely downloads textbook PDFs,
validates PDF integrity with magic bytes and PyMuPDF, supports resume/skip,
logs download metadata to data/download_log.jsonl, and enforces rate limits.
"""

import os
import sys
import json
import hashlib
import datetime
import argparse
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import yaml

from scripts.polite_client import PoliteClient, RobotsDisallowedError


def is_valid_pdf(file_path: Path) -> Tuple[bool, str]:
    """Verify PDF integrity via magic bytes and PyMuPDF page count."""
    if not file_path.exists():
        return False, "File does not exist"

    file_size = file_path.stat().st_size
    if file_size < 100:
        return False, f"File too small ({file_size} bytes)"

    # 1. Magic bytes verification (%PDF-)
    try:
        with open(file_path, "rb") as f:
            header = f.read(1024)
            if b"%PDF-" not in header:
                return False, "Missing %PDF- header magic bytes"
    except Exception as e:
        return False, f"Header read error: {e}"

    # 2. PyMuPDF page count verification
    try:
        import pymupdf
        doc = pymupdf.open(str(file_path))
        page_count = len(doc)
        doc.close()
        if page_count <= 0:
            return False, "PDF contains 0 pages"
        return True, f"Valid PDF ({page_count} pages)"
    except ImportError:
        try:
            import fitz
            doc = fitz.open(str(file_path))
            page_count = len(doc)
            doc.close()
            if page_count <= 0:
                return False, "PDF contains 0 pages"
            return True, f"Valid PDF ({page_count} pages)"
        except ImportError:
            # If PyMuPDF not available in test environment, basic header check passes
            return True, "Valid PDF (header checked; PyMuPDF not installed)"
    except Exception as e:
        return False, f"Corrupted PDF structure (PyMuPDF error: {e})"


def calculate_sha256(file_path: Path) -> str:
    """Compute SHA256 checksum of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def log_download_event(
    log_path: Path,
    record: Dict[str, Any],
) -> None:
    """Append a JSON record to download_log.jsonl."""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_manifest(manifest_path: Path) -> List[Dict[str, Any]]:
    """Load textbook entries from YAML manifest."""
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"Manifest file '{manifest_path}' not found.\n"
            f"Run `python -m scripts.discover_links` to generate a draft manifest, "
            f"review it, and copy it to '{manifest_path}'."
        )

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if isinstance(data, dict):
        return data.get("books", [])
    elif isinstance(data, list):
        return data
    return []


def download_manifest_books(
    manifest_path: Path = Path("data/manifest.yaml"),
    log_path: Path = Path("data/download_log.jsonl"),
    board_filter: Optional[str] = None,
    class_filter: Optional[int] = None,
    subject_filter: Optional[str] = None,
    max_files: int = 50,
    force: bool = False,
    dry_run: bool = False,
    client: Optional[PoliteClient] = None,
) -> Dict[str, Any]:
    """Download textbooks according to reviewed manifest with resume support."""
    books = load_manifest(manifest_path)
    if not books:
        print(f"[INFO] Manifest '{manifest_path}' contains no book entries.")
        return {"downloaded": 0, "skipped": 0, "failed": 0, "total_mb": 0.0}

    # Filter books
    filtered_books: List[Dict[str, Any]] = []
    for b in books:
        if board_filter and b.get("board", "").lower() != board_filter.lower():
            continue
        if class_filter is not None and int(b.get("class_level", 0)) != class_filter:
            continue
        if subject_filter and subject_filter.lower() not in b.get("subject", "").lower():
            continue
        filtered_books.append(b)

    total_target = min(len(filtered_books), max_files)
    print(f"\n[INFO] Starting bulk PDF download:")
    print(f"       Manifest: {manifest_path}")
    print(f"       Total matching textbooks in manifest: {len(filtered_books)}")
    print(f"       Max files to download this run: {total_target}")
    if dry_run:
        print("       [DRY RUN MODE] No files will be downloaded.")

    own_client = False
    if client is None:
        client = PoliteClient()
        own_client = True

    downloaded_count = 0
    skipped_count = 0
    failed_count = 0
    total_bytes_downloaded = 0

    try:
        for idx, book in enumerate(filtered_books[:max_files], start=1):
            url = book.get("url", "")
            title = book.get("title", "Untitled")
            board = book.get("board", "cbse")
            class_lvl = book.get("class_level", "general")
            subject = book.get("subject", "General")
            
            # Target path
            raw_target = book.get("target_path")
            if not raw_target:
                safe_fn = book.get("filename") or f"{subject.lower()}_class{class_lvl}.pdf"
                raw_target = f"data/raw/{board}/class_{class_lvl}/{subject.lower().replace(' ', '_')}/{safe_fn}"
            
            target_path = Path(raw_target)

            print(f"\n[{idx}/{total_target}] Checking '{title}' (Std {class_lvl} {subject})")
            print(f"       URL: {url}")
            print(f"       Target: {target_path}")

            # 1. Check existing file & resume
            if target_path.exists() and not force:
                valid, msg = is_valid_pdf(target_path)
                if valid:
                    file_size = target_path.stat().st_size
                    sha = calculate_sha256(target_path)
                    print(f"       [SKIP] Already exists and verified ({msg}, {file_size / (1024*1024):.2f} MB)")
                    skipped_count += 1
                    log_download_event(log_path, {
                        "url": url,
                        "title": title,
                        "board": board,
                        "class_level": class_lvl,
                        "subject": subject,
                        "target_path": str(target_path),
                        "file_size_bytes": file_size,
                        "sha256": sha,
                        "download_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "http_status": 200,
                        "status": "skipped_already_exists",
                    })
                    continue
                else:
                    print(f"       [RE-DOWNLOAD] Existing file is invalid ({msg}). Re-downloading...")
                    try:
                        target_path.unlink()
                    except Exception:
                        pass

            if dry_run:
                print("       [DRY RUN] Would download from URL.")
                continue

            # 2. Download politely
            try:
                status_code, sha256_hex, bytes_dl = client.stream_download(url, str(target_path))
                
                # Validate downloaded PDF
                valid, val_msg = is_valid_pdf(target_path)
                if not valid:
                    print(f"       [FAILED] Downloaded file invalid: {val_msg}")
                    failed_count += 1
                    try:
                        target_path.unlink()
                    except Exception:
                        pass
                    log_download_event(log_path, {
                        "url": url,
                        "title": title,
                        "board": board,
                        "class_level": class_lvl,
                        "subject": subject,
                        "target_path": str(target_path),
                        "file_size_bytes": bytes_dl,
                        "sha256": sha256_hex,
                        "download_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "http_status": status_code,
                        "status": f"failed_validation_{val_msg}",
                    })
                    continue

                downloaded_count += 1
                total_bytes_downloaded += bytes_dl
                mb = bytes_dl / (1024 * 1024)
                print(f"       [SUCCESS] Downloaded {mb:.2f} MB ({val_msg})")

                log_download_event(log_path, {
                    "url": url,
                    "title": title,
                    "board": board,
                    "class_level": class_lvl,
                    "subject": subject,
                    "target_path": str(target_path),
                    "file_size_bytes": bytes_dl,
                    "sha256": sha256_hex,
                    "download_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "http_status": status_code,
                    "status": "downloaded",
                })

            except RobotsDisallowedError as rde:
                print(f"       [ROBOTS DISALLOWED] {rde}")
                failed_count += 1
                log_download_event(log_path, {
                    "url": url,
                    "title": title,
                    "board": board,
                    "class_level": class_lvl,
                    "subject": subject,
                    "target_path": str(target_path),
                    "file_size_bytes": 0,
                    "sha256": "",
                    "download_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "http_status": 403,
                    "status": "robots_disallowed",
                })
            except Exception as exc:
                print(f"       [ERROR] Download failed: {exc}")
                failed_count += 1
                log_download_event(log_path, {
                    "url": url,
                    "title": title,
                    "board": board,
                    "class_level": class_lvl,
                    "subject": subject,
                    "target_path": str(target_path),
                    "file_size_bytes": 0,
                    "sha256": "",
                    "download_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "http_status": 500,
                    "status": f"error_{exc}",
                })

    finally:
        if own_client:
            client.close()

    total_mb = total_bytes_downloaded / (1024 * 1024)
    print("\n========================================================================")
    print(" DOWNLOAD SUMMARY")
    print(f"   Downloaded: {downloaded_count}")
    print(f"   Skipped (Already Valid): {skipped_count}")
    print(f"   Failed: {failed_count}")
    print(f"   Total Downloaded Data: {total_mb:.2f} MB")
    print(f"   Download Log: {log_path}")
    print("========================================================================\n")

    return {
        "downloaded": downloaded_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "total_mb": total_mb,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI Tutor Polite Bulk PDF Downloader (Manifest-Driven, Resumable)"
    )
    parser.add_argument("--manifest", default="data/manifest.yaml", help="Path to reviewed YAML manifest (default: data/manifest.yaml)")
    parser.add_argument("--log-file", default="data/download_log.jsonl", help="Path to download log file (default: data/download_log.jsonl)")
    parser.add_argument("--board", choices=["cbse", "tn"], help="Filter by educational board")
    parser.add_argument("--class", dest="class_level", type=int, help="Filter by class level (e.g. 8)")
    parser.add_argument("--subject", help="Filter by subject keyword (e.g. Science)")
    parser.add_argument("--max-files", type=int, default=50, help="Maximum number of files to download (default: 50)")
    parser.add_argument("--force", action="store_true", help="Force re-download even if valid PDF already exists")
    parser.add_argument("--dry-run", action="store_true", help="Check manifest and target files without downloading")

    args = parser.parse_args()

    PoliteClient.print_compliance_notice()

    manifest_file = Path(args.manifest)
    if not manifest_file.exists():
        # Check if draft exists to help user
        draft_file = Path("data/manifest.draft.yaml")
        if draft_file.exists():
            print(f"[NOTICE] '{manifest_file}' does not exist, but found draft '{draft_file}'.")
            print(f"         Please review '{draft_file}' and copy/rename it to '{manifest_file}':")
            print(f"         cp {draft_file} {manifest_file}\n")
        else:
            print(f"[ERROR] Manifest file '{manifest_file}' not found.", file=sys.stderr)
            print("        Run link discovery first:", file=sys.stderr)
            print("        python -m scripts.discover_links --url https://ncert.nic.in/textbook.php", file=sys.stderr)
        return 1

    summary = download_manifest_books(
        manifest_path=manifest_file,
        log_path=Path(args.log_file),
        board_filter=args.board,
        class_filter=args.class_level,
        subject_filter=args.subject,
        max_files=args.max_files,
        force=args.force,
        dry_run=args.dry_run,
    )

    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
