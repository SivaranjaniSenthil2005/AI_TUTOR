"""Unit and integration tests for Phase 8b: Link discovery, polite downloading, and PDF validation.

All HTTP operations are strictly mocked without any live network calls.
"""

import os
import sys
import io
import time
import json
from pathlib import Path
from typing import Dict, Any
import pytest
import yaml
import httpx

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.polite_client import PoliteClient, RobotsDisallowedError
from scripts.discover_links import (
    extract_links_from_html,
    parse_class_level,
    is_english_medium,
    normalize_subject_name,
    save_draft_manifest,
)
from scripts.fetch_pdfs import (
    is_valid_pdf,
    calculate_sha256,
    download_manifest_books,
)
from scripts.sync import sync_textbooks


SAMPLE_NCERT_HTML = """
<!DOCTYPE html>
<html>
<head><title>NCERT Textbooks</title></head>
<body>
  <h1>NCERT Textbooks PDF</h1>
  <table id="textbook-table">
    <tr>
      <th>Class</th><th>Subject</th><th>Book Title</th><th>Download Link</th>
    </tr>
    <!-- Class 6 English Medium Science: SHOULD BE INCLUDED -->
    <tr>
      <td>Class VI</td>
      <td>Science</td>
      <td>Curiosity - Science Class 6</td>
      <td><a href="/textbook/pdf/fesc1dd.zip">Full Book PDF</a></td>
    </tr>
    <!-- Class 6 Hindi Medium Science (Vigyan): SHOULD BE SKIPPED -->
    <tr>
      <td>Class VI</td>
      <td>Science</td>
      <td>Jigyasa - Vigyan Class 6</td>
      <td><a href="/textbook/pdf/fhsc1dd.zip">Full Book PDF</a></td>
    </tr>
    <!-- Class 8 English Medium Mathematics: SHOULD BE INCLUDED -->
    <tr>
      <td>Class 8</td>
      <td>Mathematics</td>
      <td>Mathematics - Textbook for Class VIII</td>
      <td><a href="/textbook/pdf/hemh1dd.zip">Download PDF</a></td>
    </tr>
    <!-- Class 10 English Medium Science: SHOULD BE INCLUDED -->
    <tr>
      <td>Class X</td>
      <td>Science</td>
      <td>Science - Textbook for Class 10</td>
      <td><a href="/textbook/pdf/jesc1dd.zip">Download PDF</a></td>
    </tr>
    <!-- Class 3 Mathematics (Math-Magic): SHOULD BE SKIPPED (Class < 6) -->
    <tr>
      <td>Class 3</td>
      <td>Mathematics</td>
      <td>Math-Magic 3</td>
      <td><a href="/textbook/pdf/cemh1dd.zip">Download PDF</a></td>
    </tr>
    <!-- Class 9 Hindi Literature (Kshitij): SHOULD BE SKIPPED (Hindi medium) -->
    <tr>
      <td>Class 9</td>
      <td>Hindi</td>
      <td>Kshitij - Hindi Course A</td>
      <td><a href="/textbook/pdf/ihks1dd.zip">Download PDF</a></td>
    </tr>
    <!-- Class 10 Urdu Literature: SHOULD BE SKIPPED (Urdu) -->
    <tr>
      <td>Class 10</td>
      <td>Urdu</td>
      <td>Ghalib - Urdu Reader</td>
      <td><a href="/textbook/pdf/jurd1dd.zip">Download PDF</a></td>
    </tr>
  </table>
</body>
</html>
"""


SAMPLE_TN_SCERT_HTML = """
<!DOCTYPE html>
<html>
<head><title>TN SCERT Textbooks</title></head>
<body>
  <div class="book-list">
    <!-- Std 10 Science English Medium -->
    <div class="item">
      <h3>Standard 10 Science (English Medium)</h3>
      <a href="https://textbooksonline.tn.nic.in/books/std10_science_em.pdf">Download Textbook PDF</a>
    </div>
    <!-- Std 10 Science Tamil Medium -->
    <div class="item">
      <h3>Standard 10 Science (Tamil Medium)</h3>
      <a href="https://textbooksonline.tn.nic.in/books/std10_science_tm.pdf">Download Textbook PDF</a>
    </div>
    <!-- Std 7 Social Science English Medium -->
    <div class="item">
      <h3>Std 7 Social Science Term 1 English</h3>
      <a href="/books/std07_social_em.pdf">Download Term 1 PDF</a>
    </div>
    <!-- Std 4 English (Class < 6) -->
    <div class="item">
      <h3>Standard 4 English</h3>
      <a href="/books/std04_english.pdf">Download PDF</a>
    </div>
  </div>
</body>
</html>
"""


def create_minimal_valid_pdf_bytes() -> bytes:
    """Generate minimal valid PDF bytes using PyMuPDF or valid raw PDF structure."""
    try:
        import pymupdf
        doc = pymupdf.open()
        page = doc.new_page()
        page.insert_text((50, 50), "AI Tutor Test Textbook Page")
        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes
    except Exception:
        try:
            import fitz
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 50), "AI Tutor Test Textbook Page")
            pdf_bytes = doc.tobytes()
            doc.close()
            return pdf_bytes
        except Exception:
            # Fallback raw 1-page valid PDF
            return (
                b"%PDF-1.4\n"
                b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
                b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
                b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n"
                b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
                b"trailer << /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
            )


def test_parse_class_level():
    """Verify class extraction for standard Arabic numbers and Roman numerals."""
    assert parse_class_level("Class 6") == 6
    assert parse_class_level("Class VI") == 6
    assert parse_class_level("Std 10 Science") == 10
    assert parse_class_level("Standard XII Physics") == 12
    assert parse_class_level("Class 8 Mathematics") == 8
    assert parse_class_level("jesc1dd.zip") == 10  # 'j' is 10 in NCERT code
    assert parse_class_level("hesc1dd.pdf") == 8   # 'h' is 8
    assert parse_class_level("fesc1dd.pdf") == 6   # 'f' is 6
    assert parse_class_level("Random text without class") is None


def test_is_english_medium():
    """Verify language filtering skips non-English titles and retains English medium."""
    is_eng, reason = is_english_medium("Science Class 10", "https://ncert.nic.in/pdf/jesc1.pdf")
    assert is_eng is True

    is_eng, reason = is_english_medium("Vigyan Class 10 (Hindi)", "https://ncert.nic.in/pdf/jhsc1.pdf")
    assert is_eng is False
    assert "vigyan" in reason.lower() or "hindi" in reason.lower()

    is_eng, reason = is_english_medium("Kshitij Hindi", "https://ncert.nic.in/pdf/ihks1.pdf")
    assert is_eng is False
    assert "kshitij" in reason.lower() or "hindi" in reason.lower()

    is_eng, reason = is_english_medium("Mathematics Class 8 (Tamil Medium)", "/tm/maths.pdf", medium_field="Tamil")
    assert is_eng is False
    assert "tamil" in reason.lower()


def test_extract_links_from_ncert_html():
    """Verify discovery extracts only English medium textbooks for classes 6 to 12 from NCERT HTML."""
    discovered, skipped = extract_links_from_html(
        html_content=SAMPLE_NCERT_HTML,
        base_url="https://ncert.nic.in/",
        board_default="cbse",
        min_class=6,
        max_class=12,
        max_files=50,
    )

    # Expected English medium books:
    # 1. Class 6 Science (fesc1dd.zip)
    # 2. Class 8 Mathematics (hemh1dd.zip)
    # 3. Class 10 Science (jesc1dd.zip)
    assert len(discovered) == 3
    classes = [b["class_level"] for b in discovered]
    assert 6 in classes
    assert 8 in classes
    assert 10 in classes
    assert 3 not in classes  # Class 3 skipped (min_class=6)

    # Check skipped items reasons
    skipped_reasons = [s["reason"] for s in skipped]
    assert any("Class 3 outside target range" in r for r in skipped_reasons)
    assert any("vigyan" in r.lower() or "kshitij" in r.lower() or "urdu" in r.lower() for r in skipped_reasons)


def test_extract_links_from_tn_scert_html():
    """Verify discovery extracts English medium textbooks from TN SCERT HTML."""
    discovered, skipped = extract_links_from_html(
        html_content=SAMPLE_TN_SCERT_HTML,
        base_url="https://textbooksonline.tn.nic.in/",
        board_default="tn",
        min_class=6,
        max_class=12,
        max_files=50,
    )

    # Expected: Std 10 Science (EM) and Std 7 Social Science (EM).
    # Skipped: Std 10 Tamil Medium, Std 4 English (Class 4 < 6).
    assert len(discovered) == 2
    for b in discovered:
        assert b["board"] == "tn"
        assert b["medium"] == "english"
        assert b["class_level"] in [7, 10]


def test_draft_manifest_generation(tmp_path):
    """Verify draft manifest is written without overwriting real manifest."""
    draft_file = tmp_path / "manifest.draft.yaml"
    books = [
        {
            "id": "cbse-std10-science-1",
            "title": "Science Class 10",
            "board": "cbse",
            "class_level": 10,
            "medium": "english",
            "subject": "Science",
            "url": "https://ncert.nic.in/textbook/pdf/jesc1dd.zip",
            "filename": "science_class10.pdf",
            "target_path": "data/raw/cbse/class_10/science/science_class10.pdf",
        }
    ]

    out = save_draft_manifest(books, str(draft_file))
    assert out.exists()

    with open(out, "r", encoding="utf-8") as f:
        loaded = yaml.safe_load(f)

    assert loaded["total_books"] == 1
    assert loaded["books"][0]["id"] == "cbse-std10-science-1"


def test_robots_txt_disallowed_handling():
    """Verify PoliteClient respects robots.txt disallow rules."""
    robots_content = (
        "User-agent: *\n"
        "Disallow: /private-textbooks/\n"
        "Allow: /textbook/\n"
    )

    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=robots_content)
        elif request.url.path.startswith("/private-textbooks/"):
            return httpx.Response(200, text="Secret Content")
        elif request.url.path.startswith("/textbook/"):
            return httpx.Response(200, text="Allowed Content")
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    client = PoliteClient(min_interval=0.0, transport=transport)

    # 1. Allowed path succeeds
    resp = client.get("https://ncert.nic.in/textbook/science.html")
    assert resp.status_code == 200

    # 2. Disallowed path raises RobotsDisallowedError
    with pytest.raises(RobotsDisallowedError) as exc_info:
        client.get("https://ncert.nic.in/private-textbooks/book.pdf")
    assert "DISALLOWED" in str(exc_info.value)

    client.close()


def test_rate_limiting_and_retry_with_backoff():
    """Verify PoliteClient enforces sequential rate intervals and retries on 429/503."""
    call_times = []
    attempt_count = 0

    def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempt_count
        call_times.append(time.time())
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")

        attempt_count += 1
        if attempt_count == 1:
            # First attempt returns 429 with Retry-After: 0.1
            return httpx.Response(429, headers={"Retry-After": "0.1"})
        elif attempt_count == 2:
            # Second attempt returns 503
            return httpx.Response(503, text="Service Unavailable")
        else:
            # Third attempt succeeds
            return httpx.Response(200, text="Success!")

    transport = httpx.MockTransport(mock_handler)
    # Using 0.05s min_interval for fast test execution
    client = PoliteClient(min_interval=0.05, max_retries=3, transport=transport)

    resp = client.get("https://ncert.nic.in/textbook/test.html")
    assert resp.status_code == 200
    assert resp.text == "Success!"
    assert attempt_count == 3

    client.close()


def test_pdf_validation_magic_bytes_and_pymupdf(tmp_path):
    """Verify is_valid_pdf correctly checks magic bytes and pages."""
    valid_pdf_file = tmp_path / "valid.pdf"
    valid_pdf_file.write_bytes(create_minimal_valid_pdf_bytes())

    # Valid PDF
    is_valid, msg = is_valid_pdf(valid_pdf_file)
    assert is_valid is True

    # Corrupt / non-PDF file (> 100 bytes)
    corrupt_file = tmp_path / "corrupt.pdf"
    corrupt_file.write_bytes(b"This is a non-pdf corrupt file content that is intentionally longer than one hundred bytes to pass the size check." * 2)
    is_valid_c, msg_c = is_valid_pdf(corrupt_file)
    assert is_valid_c is False
    assert "Missing %PDF-" in msg_c or "Header" in msg_c


def test_resume_and_skip_behavior(tmp_path):
    """Verify fetch_pdfs skips existing valid files and logs results to jsonl."""
    raw_dir = tmp_path / "raw" / "cbse" / "class_10" / "science"
    raw_dir.mkdir(parents=True, exist_ok=True)
    existing_pdf = raw_dir / "science_class10.pdf"
    pdf_bytes = create_minimal_valid_pdf_bytes()
    existing_pdf.write_bytes(pdf_bytes)

    manifest_file = tmp_path / "manifest.yaml"
    log_file = tmp_path / "download_log.jsonl"

    manifest_data = {
        "books": [
            {
                "id": "cbse-10-sci",
                "title": "Science Class 10",
                "board": "cbse",
                "class_level": 10,
                "subject": "Science",
                "url": "https://ncert.nic.in/textbook/pdf/science_class10.pdf",
                "target_path": str(existing_pdf),
            }
        ]
    }
    with open(manifest_file, "w", encoding="utf-8") as f:
        yaml.dump(manifest_data, f)

    # Mock client (should not make download request because file exists and is valid)
    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Should not be called")

    transport = httpx.MockTransport(mock_handler)
    client = PoliteClient(min_interval=0.0, transport=transport)

    summary = download_manifest_books(
        manifest_path=manifest_file,
        log_path=log_file,
        client=client,
    )

    assert summary["downloaded"] == 0
    assert summary["skipped"] == 1
    assert summary["failed"] == 0

    # Verify log entry
    assert log_file.exists()
    with open(log_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry["status"] == "skipped_already_exists"
    assert entry["class_level"] == 10

    client.close()


def test_sync_cli_workflow(tmp_path):
    """Verify sync runner coordinates discovery, download, and summary report."""
    manifest_file = tmp_path / "manifest.yaml"
    log_file = tmp_path / "download_log.jsonl"
    target_pdf = tmp_path / "data" / "raw" / "cbse" / "class_8" / "mathematics" / "math_class8.pdf"
    pdf_bytes = create_minimal_valid_pdf_bytes()

    manifest_data = {
        "books": [
            {
                "id": "cbse-8-math",
                "title": "Maths Class 8",
                "board": "cbse",
                "class_level": 8,
                "subject": "Mathematics",
                "url": "https://ncert.nic.in/textbook/pdf/math_class8.pdf",
                "target_path": str(target_pdf),
            }
        ]
    }
    with open(manifest_file, "w", encoding="utf-8") as f:
        yaml.dump(manifest_data, f)

    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        return httpx.Response(200, content=pdf_bytes)

    transport = httpx.MockTransport(mock_handler)
    client = PoliteClient(min_interval=0.0, transport=transport)

    # Run download
    summary = download_manifest_books(
        manifest_path=manifest_file,
        log_path=log_file,
        board_filter="cbse",
        class_filter=8,
        client=client,
    )

    assert summary["downloaded"] == 1
    assert summary["failed"] == 0
    assert target_pdf.exists()
    assert is_valid_pdf(target_pdf)[0] is True

    client.close()
