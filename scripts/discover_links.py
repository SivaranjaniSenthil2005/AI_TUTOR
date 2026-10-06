"""Textbook link discovery script for AI Tutor.

Discovers textbook PDF links from CBSE/NCERT and Tamil Nadu State Board (TN SCERT)
listing pages or saved offline HTML files.

Enforces:
- English medium filtering (skips non-English languages with explicit logging)
- Standards 6 to 12 filtering (skips classes 1-5 and college)
- Polite HTTP fetching with robots.txt compliance and rate limits
- Draft manifest generation (never overwrites data/manifest.yaml)
- Offline HTML fallback parsing (--html-file)
"""

import os
import re
import sys
import argparse
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from bs4 import BeautifulSoup
import yaml

from scripts.polite_client import PoliteClient, RobotsDisallowedError


# Non-English language keywords to skip
NON_ENGLISH_KEYWORDS = [
    # Languages
    "hindi", "urdu", "tamil", "sanskrit", "telugu", "malayalam", "kannada",
    "marathi", "gujarati", "bengali", "punjabi", "odia", "arabic", "persian",
    # Hindi titles & subjects
    "vasant", "durva", "kshitij", "kritika", "sanchayan", "sparsh",
    "bal mahabharat", "bal ramkatha", "bhartiya", "samkalin", "ganit",
    "vigyan", "itihas", "bhugol", "rajniti", "arthashastra", "vyakaran",
    "abhyas", "apni zaban", "ghalib", "guldasta", "jahan-e-urdu", "khyaban",
    "dhanak", "shashwat", "bhaswati", "shemushi", "manika", "saral",
]

# Roman numeral conversion map
ROMAN_TO_INT = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5,
    "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10,
    "xi": 11, "xii": 12,
}

# NCERT book code class prefix map (a=1, b=2 ... f=6, g=7, h=8, i=9, j=10, k=11, l=12)
NCERT_CODE_PREFIX = {
    "a": 1, "b": 2, "c": 3, "d": 4, "e": 5,
    "f": 6, "g": 7, "h": 8, "i": 9, "j": 10,
    "k": 11, "l": 12,
}


def parse_class_level(text: str) -> Optional[int]:
    """Extract standard/class level (1-12) from text or code."""
    text_lower = text.lower()

    # Pattern: Class 6, Std 10, Standard XII, Grade 8
    m = re.search(r"(?:class|std|standard|grade)\s*[-_:]?\s*([0-9]{1,2}|[ivx]+)\b", text_lower)
    if m:
        val = m.group(1)
        if val.isdigit():
            num = int(val)
            if 1 <= num <= 12:
                return num
        elif val in ROMAN_TO_INT:
            return ROMAN_TO_INT[val]

    # Pattern: Roman numeral standalone e.g. "Class-X" or "(VI-VIII)"
    m_roman = re.search(r"\b(vi|vii|viii|ix|x|xi|xii|i|ii|iii|iv|v)\b", text_lower)
    if m_roman:
        val = m_roman.group(1)
        if val in ROMAN_TO_INT:
            return ROMAN_TO_INT[val]

    # Pattern: NCERT code e.g. "jesc1dd.zip", "hesc1.pdf", "fesc1" -> prefix 'j' is 10, 'h' is 8, 'f' is 6
    m_code = re.search(r"(?:^|[^a-zA-Z])([a-l])[a-z]{2,3}[0-9]", text_lower)
    if m_code:
        prefix = m_code.group(1)
        if prefix in NCERT_CODE_PREFIX:
            return NCERT_CODE_PREFIX[prefix]

    return None


def is_english_medium(title: str, url: str, medium_field: Optional[str] = None) -> Tuple[bool, str]:
    """Check if the textbook is English medium.
    
    Returns (is_english, reason_if_skipped).
    """
    combined = f"{title} {url} {medium_field or ''}".lower()

    # If explicit medium given
    if medium_field:
        med_lower = medium_field.strip().lower()
        if "english" in med_lower:
            return True, "English medium"
        if any(lang in med_lower for lang in ["tamil", "hindi", "urdu", "telugu", "kannada", "malayalam"]):
            return False, f"Non-English medium explicit: '{medium_field}'"

    # Check for non-English keywords
    for kw in NON_ENGLISH_KEYWORDS:
        if re.search(r"\b" + re.escape(kw) + r"\b", combined):
            return False, f"Matches non-English keyword: '{kw}'"

    return True, "English medium"


def normalize_subject_name(subject_raw: str, title: str) -> str:
    """Normalize subject to standard curriculum subject name."""
    s = f"{subject_raw} {title}".lower()
    if "math" in s or "ganit" in s:
        return "Mathematics"
    if "science" in s or "vigyan" in s or "physics" in s or "chemistry" in s or "biology" in s:
        if "physics" in s:
            return "Physics"
        if "chemistry" in s:
            return "Chemistry"
        if "biology" in s:
            return "Biology"
        return "Science"
    if "social" in s or "history" in s or "geography" in s or "civics" in s or "political" in s:
        if "history" in s:
            return "History"
        if "geography" in s:
            return "Geography"
        if "political" in s or "civics" in s:
            return "Political Science"
        if "economics" in s:
            return "Economics"
        return "Social Science"
    if "english" in s or "honeysuckle" in s or "beehive" in s or "first flight" in s:
        return "English"
    if "computer" in s or "informatics" in s:
        return "Computer Science"
    
    cleaned = subject_raw.strip().title()
    return cleaned if cleaned else "General"


def extract_links_from_html(
    html_content: str,
    base_url: str,
    board_default: str = "cbse",
    min_class: int = 6,
    max_class: int = 12,
    max_files: int = 50,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
    """Parse HTML and discover textbook PDF links with polite filtering.
    
    Returns (discovered_books, skipped_items).
    """
    soup = BeautifulSoup(html_content, "html.parser")
    discovered: List[Dict[str, Any]] = []
    skipped: List[Dict[str, str]] = []
    seen_urls = set()

    # Strategy 1: Table-based listings (common in TN SCERT and state portals)
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            row_text = " ".join(c.get_text(strip=True) for c in cells)
            links = row.find_all("a", href=True)
            for a in links:
                href = a["href"]
                link_text = a.get_text(strip=True) or row_text
                full_url = urljoin(base_url, href)

                # Check if PDF or zip or textbook link
                if not (full_url.lower().endswith(".pdf") or full_url.lower().endswith(".zip") or "textbook" in full_url.lower()):
                    continue

                if full_url in seen_urls:
                    continue

                seen_urls.add(full_url)

                class_lvl = parse_class_level(f"{link_text} {row_text} {href}")
                if class_lvl is None:
                    skipped.append({"url": full_url, "title": link_text, "reason": "Class level could not be identified"})
                    continue

                if class_lvl < min_class or class_lvl > max_class:
                    skipped.append({"url": full_url, "title": link_text, "reason": f"Class {class_lvl} outside target range (Std {min_class}-{max_class})"})
                    continue

                is_eng, eng_reason = is_english_medium(f"{link_text} {row_text}", full_url)
                if not is_eng:
                    skipped.append({"url": full_url, "title": link_text, "reason": eng_reason})
                    continue

                subject = normalize_subject_name(link_text, row_text)
                clean_title = link_text if len(link_text) > 3 else f"{subject} Class {class_lvl}"
                board = "tn" if ("tn" in base_url.lower() or "tamil" in row_text.lower() or board_default == "tn") else "cbse"
                safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]+", "_", Path(urlparse(full_url).path).name or f"{subject.lower()}_class{class_lvl}.pdf")
                if not safe_name.lower().endswith(".pdf"):
                    safe_name += ".pdf"

                target_path = f"data/raw/{board}/class_{class_lvl}/{subject.lower().replace(' ', '_')}/{safe_name}"

                book_entry = {
                    "id": f"{board}-std{class_lvl}-{subject.lower().replace(' ', '_')}-{len(discovered)+1}",
                    "title": clean_title,
                    "board": board,
                    "class_level": class_lvl,
                    "medium": "english",
                    "subject": subject,
                    "url": full_url,
                    "filename": safe_name,
                    "target_path": target_path,
                }
                discovered.append(book_entry)
                if len(discovered) >= max_files:
                    return discovered, skipped

    # Strategy 2: Direct Anchor Tags <a> anywhere in the document
    all_links = soup.find_all("a", href=True)
    for a in all_links:
        href = a["href"]
        full_url = urljoin(base_url, href)

        if full_url in seen_urls:
            continue

        # Look for PDF links or book chapter links
        is_pdf = full_url.lower().endswith(".pdf") or full_url.lower().endswith(".zip")
        is_textbook_link = "textbook" in full_url.lower() or "book" in full_url.lower() or "pdf" in href.lower()
        if not (is_pdf or is_textbook_link):
            continue

        seen_urls.add(full_url)

        link_text = a.get_text(strip=True)
        title_attr = a.get("title", "")
        # Find nearest enclosing block container (tr, li, div, section, p)
        container = a.find_parent(["tr", "li", "div", "section", "p"])
        container_text = container.get_text(" ", strip=True) if container else ""
        combined_text = f"{link_text} {title_attr} {container_text}".strip()

        class_lvl = parse_class_level(f"{combined_text} {href}")
        if class_lvl is None:
            skipped.append({"url": full_url, "title": link_text or href, "reason": "Class level could not be identified"})
            continue

        if class_lvl < min_class or class_lvl > max_class:
            skipped.append({"url": full_url, "title": link_text or href, "reason": f"Class {class_lvl} outside target range (Std {min_class}-{max_class})"})
            continue

        is_eng, eng_reason = is_english_medium(combined_text, full_url)
        if not is_eng:
            skipped.append({"url": full_url, "title": link_text or href, "reason": eng_reason})
            continue

        subject = normalize_subject_name(link_text, combined_text)
        board = "tn" if ("tn" in base_url.lower() or "textbooksonline" in base_url.lower() or board_default == "tn") else "cbse"
        
        path_name = Path(urlparse(full_url).path).name
        safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]+", "_", path_name or f"{subject.lower()}_class{class_lvl}.pdf")
        if not safe_name.lower().endswith(".pdf"):
            safe_name += ".pdf"

        target_path = f"data/raw/{board}/class_{class_lvl}/{subject.lower().replace(' ', '_')}/{safe_name}"

        clean_title = link_text if len(link_text) > 3 else f"{subject} Class {class_lvl}"
        book_entry = {
            "id": f"{board}-std{class_lvl}-{subject.lower().replace(' ', '_')}-{len(discovered)+1}",
            "title": clean_title,
            "board": board,
            "class_level": class_lvl,
            "medium": "english",
            "subject": subject,
            "url": full_url,
            "filename": safe_name,
            "target_path": target_path,
        }
        discovered.append(book_entry)
        seen_urls.add(full_url)
        if len(discovered) >= max_files:
            break

    # Strategy 3: Form option dropdown inspection (e.g. NCERT select options)
    select_class = soup.find("select", attrs={"name": re.compile(r"class|std|tclass", re.I)})
    select_subject = soup.find("select", attrs={"name": re.compile(r"sub|subject|tsubject", re.I)})
    if select_class and select_subject:
        print("[INFO] Detected interactive form dropdowns on page.")
        print("[INFO] For complex JS-driven form submissions (e.g. NCERT textbook.php), please save the resolved HTML or chapter list page with File > Save As and run with --html-file.")

    return discovered, skipped


def save_draft_manifest(
    books: List[Dict[str, Any]],
    output_path: str = "data/manifest.draft.yaml",
) -> Path:
    """Write draft manifest file. Never overwrites data/manifest.yaml."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    manifest_data = {
        "version": "1.0",
        "description": "AI Tutor Draft Textbook Manifest (Review before copying to data/manifest.yaml)",
        "total_books": len(books),
        "books": books,
    }

    with open(out, "w", encoding="utf-8") as f:
        f.write("# ========================================================================\n")
        f.write("# AI TUTOR DRAFT TEXTBOOK MANIFEST\n")
        f.write("# Please review this file, verify metadata, and copy/rename to:\n")
        f.write("#   data/manifest.yaml\n")
        f.write("# ========================================================================\n\n")
        yaml.dump(manifest_data, f, sort_keys=False, default_flow_style=False, allow_unicode=True)

    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI Tutor Polite Textbook Link Discovery (NCERT / TN SCERT, English Medium, Std 6-12)"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", help="URL of textbook listing page (e.g. https://ncert.nic.in/textbook.php)")
    group.add_argument("--html-file", help="Path to locally saved offline HTML file (File > Save As fallback)")

    parser.add_argument("--base-url", default="https://ncert.nic.in/", help="Base URL for resolving relative links when using --html-file")
    parser.add_argument("--board", choices=["cbse", "tn", "auto"], default="auto", help="Educational board name")
    parser.add_argument("--output", default="data/manifest.draft.yaml", help="Output draft manifest file path (default: data/manifest.draft.yaml)")
    parser.add_argument("--max-files", type=int, default=50, help="Maximum number of textbook files to discover (default: 50)")
    parser.add_argument("--min-class", type=int, default=6, help="Minimum class level (default: 6)")
    parser.add_argument("--max-class", type=int, default=12, help="Maximum class level (default: 12)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print detailed skip and discovery logs")

    args = parser.parse_args()

    PoliteClient.print_compliance_notice()

    html_content = ""
    base_url = args.base_url

    if args.html_file:
        html_path = Path(args.html_file)
        if not html_path.exists():
            print(f"[ERROR] HTML file not found: {args.html_file}", file=sys.stderr)
            return 1
        print(f"[INFO] Reading offline HTML file: {args.html_file}")
        with open(html_path, "r", encoding="utf-8", errors="replace") as f:
            html_content = f.read()
    elif args.url:
        base_url = args.url
        print(f"[INFO] Connecting politely to: {args.url}")
        client = PoliteClient()
        try:
            resp = client.get(args.url)
            resp.raise_for_status()
            html_content = resp.text
        except RobotsDisallowedError as rde:
            print(f"[ROBOTS DISALLOWED] {rde}", file=sys.stderr)
            return 2
        except Exception as e:
            print(f"[ERROR] Failed to fetch {args.url}: {e}", file=sys.stderr)
            print("[TIP] You can save the page HTML locally in your browser (File > Save As) and run:", file=sys.stderr)
            print(f"      python -m scripts.discover_links --html-file saved_page.html --base-url {args.url}", file=sys.stderr)
            return 1
        finally:
            client.close()

    board_name = args.board
    if board_name == "auto":
        board_name = "tn" if ("tn" in base_url.lower() or "tamil" in base_url.lower()) else "cbse"

    books, skipped = extract_links_from_html(
        html_content=html_content,
        base_url=base_url,
        board_default=board_name,
        min_class=args.min_class,
        max_class=args.max_class,
        max_files=args.max_files,
    )

    print("\n--- Link Discovery Summary ---")
    print(f"Board: {board_name.upper()}")
    print(f"Discovered English Medium Textbooks (Classes {args.min_class}-{args.max_class}): {len(books)}")
    print(f"Skipped items: {len(skipped)}")

    if args.verbose or len(books) == 0:
        if skipped:
            print("\nSkipped Items Details (Sample up to 10):")
            for item in skipped[:10]:
                print(f" - [{item['reason']}] {item['title']} -> {item['url']}")

    if not books:
        print("\n[WARNING] No matching PDF links discovered.")
        print("[TIP] If the site uses JavaScript / dynamic forms to populate books, save the rendered page HTML (File > Save As) and run:")
        print(f"      python -m scripts.discover_links --html-file saved_page.html --base-url {base_url}")
        return 0

    draft_path = save_draft_manifest(books, args.output)
    print(f"\n[SUCCESS] Draft manifest saved to: {draft_path}")
    print(f"          To use for downloading, please review it and save/copy as: data/manifest.yaml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
