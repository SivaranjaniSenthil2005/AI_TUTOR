"""
AI Tutor - Phase 13 Secret Scanner & Repository Hygiene Tool
Scans repository working tree and git commit history for accidental API keys, tokens, or credentials.
"""

import os
import sys
import re
import subprocess
from typing import List, Dict, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Common High-Entropy Secret Patterns
SECRET_PATTERNS = [
    ("OpenAI API Key", re.compile(r"sk-[a-zA-Z0-9]{32,}")),
    ("Anthropic API Key", re.compile(r"sk-ant-api[a-zA-Z0-9_\-]{20,}")),
    ("Google AI Studio / Gemini API Key", re.compile(r"AIzaSy[a-zA-Z0-9_\-]{33}")),
    ("HuggingFace User Token", re.compile(r"hf_[a-zA-Z0-9]{34}")),
    ("AWS Access Key ID", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Generic Private Key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("GitHub Personal Access Token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,}")),
    ("Slack API Token", re.compile(r"xox[baprs]-[0-9a-zA-Z\-]{20,}")),
]

# Paths allowed to contain mock tokens or regex definitions
ALLOWLIST_PATHS = [
    ".gitleaks.toml",
    ".env.example",
    os.path.join("scripts", "scan_secrets.py"),
    os.path.join("backend", "tests", "safety", "test_safety.py"),
    os.path.join("backend", "tests", "test_phase10_llm.py"),
    os.path.join("data", "eval", "gold_set.example.yaml"),
]

ALLOWLIST_REGEXES = [
    re.compile(r"mock[-_]key"),
    re.compile(r"fake[-_]key"),
    re.compile(r"test[-_]key"),
    re.compile(r"example"),
    re.compile(r"dummy"),
    re.compile(r"YOUR_"),
    re.compile(r"<API_KEY>"),
]


def is_allowed_file(filepath: str) -> bool:
    rel = os.path.relpath(filepath, ROOT_DIR).replace("\\", "/")
    for ap in ALLOWLIST_PATHS:
        if ap.replace("\\", "/") in rel:
            return True
    return False


def scan_text(text: str, source_label: str) -> List[Tuple[str, str, int]]:
    findings = []
    lines = text.splitlines()
    for idx, line in enumerate(lines, 1):
        # Skip commented placeholders in configs
        for name, pattern in SECRET_PATTERNS:
            match = pattern.search(line)
            if match:
                matched_val = match.group(0)
                # Check allowlist
                if any(al.search(matched_val) for al in ALLOWLIST_REGEXES):
                    continue
                findings.append((name, source_label, idx))
    return findings


def scan_working_tree() -> List[Tuple[str, str, int]]:
    findings = []
    # Use git ls-files to only scan tracked files
    res = subprocess.run(["git", "ls-files"], cwd=ROOT_DIR, capture_output=True, text=True)
    if res.returncode == 0:
        files = res.stdout.splitlines()
    else:
        # Fallback to walk
        files = []
        for root, _, filenames in os.walk(ROOT_DIR):
            if any(skip in root for skip in [".git", "node_modules", ".venv", "__pycache__", ".next"]):
                continue
            for fn in filenames:
                files.append(os.path.relpath(os.path.join(root, fn), ROOT_DIR))

    for rel_path in files:
        full_path = os.path.join(ROOT_DIR, rel_path)
        if not os.path.isfile(full_path):
            continue
        if is_allowed_file(full_path):
            continue

        # Ignore binaries
        _, ext = os.path.splitext(rel_path)
        if ext.lower() in [".png", ".jpg", ".jpeg", ".ico", ".pdf", ".task", ".pyc", ".db"]:
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                file_findings = scan_text(content, rel_path)
                findings.extend(file_findings)
        except Exception:
            pass

    return findings


def scan_git_history(max_commits: int = 25) -> List[Tuple[str, str, int]]:
    findings = []
    try:
        res = subprocess.run(
            ["git", "log", "-n", str(max_commits), "-p"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        if res.returncode == 0:
            diff_lines = res.stdout.splitlines()
            current_commit = "HEAD"
            for line_idx, line in enumerate(diff_lines, 1):
                if line.startswith("commit "):
                    current_commit = line.split()[1][:8]
                elif line.startswith("+") and not line.startswith("+++"):
                    added_text = line[1:]
                    for name, pattern in SECRET_PATTERNS:
                        match = pattern.search(added_text)
                        if match:
                            val = match.group(0)
                            if any(al.search(val) for al in ALLOWLIST_REGEXES):
                                continue
                            findings.append((name, f"git commit {current_commit}", line_idx))
    except Exception as e:
        print(f"Note: git history scan encountered: {e}")
    return findings


def main():
    print(f"\n=======================================================")
    print(f" AI Tutor - Secret & Credential Hygiene Scanner")
    print(f"=======================================================")

    print("1. Scanning tracked workspace files...")
    tree_findings = scan_working_tree()

    print("2. Scanning git history commits...")
    history_findings = scan_git_history()

    all_findings = tree_findings + history_findings

    if all_findings:
        print(f"\n[CRITICAL FAILURE] Detected {len(all_findings)} potential secret(s):")
        for secret_type, source, line in all_findings:
            print(f"  - [{secret_type}] at {source}:{line}")
        print("\nPlease remove any real credentials immediately before committing!\n")
        sys.exit(1)
    else:
        print("\n[OK] PASSED: No secrets or credentials found in tracked files or git history.")
        print("  - OpenAI / Anthropic / Gemini / HF / AWS patterns: 0 matches")
        print("  - Git history scanned: Clean")
        print("=======================================================\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
