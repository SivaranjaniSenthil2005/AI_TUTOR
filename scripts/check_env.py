#!/usr/bin/env python3
"""
Environment & Health Verification Script for AI Tutor (Phase 12).
Verifies:
  - backend/.env present
  - at least one provider reachable or mock fallback
  - retrieval indexes built
  - calls /api/scope and /api/llm/status if backend is running
Prints structured diagnostic status and exact instructions to fix any issue.
"""

import sys
import os
import json
from pathlib import Path
import urllib.request
import urllib.error

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_status(name: str, passed: bool, detail: str = ""):
    symbol = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
    print(f"  {symbol} {BOLD}{name}{RESET} {detail}")


def check_env_file():
    backend_env = BACKEND_DIR / ".env"
    root_env = ROOT_DIR / ".env"
    passed = backend_env.exists() or root_env.exists()
    detail = ""
    if passed:
        loc = "backend/.env" if backend_env.exists() else ".env (root)"
        detail = f"Found at {loc}"
    else:
        detail = f"{YELLOW}Missing backend/.env! Create one from .env.example{RESET}"
    print_status("Environment File (.env)", passed, detail)
    return passed


def check_indexes():
    chroma_dir = ROOT_DIR / "data" / "index" / "chroma"
    bm25_dir = ROOT_DIR / "data" / "index" / "bm25"
    processed_dir = ROOT_DIR / "data" / "processed"

    has_chroma = chroma_dir.exists() and any(chroma_dir.iterdir())
    has_bm25 = bm25_dir.exists() and any(bm25_dir.iterdir())
    has_processed = processed_dir.exists() and any(processed_dir.iterdir())

    passed = (has_chroma or has_bm25) or has_processed
    detail = ""
    if has_chroma and has_bm25:
        detail = "Vector (Chroma) & Keyword (BM25) indexes ready"
    elif has_processed:
        detail = "Processed chunks found (hybrid index partial or in memory)"
    else:
        detail = f"{YELLOW}Indexes not built. Run 'python scripts/process_pdfs.py'{RESET}"

    print_status("Curriculum Retrieval Indexes", passed, detail)
    return passed


def check_backend_endpoints():
    base_url = "http://127.0.0.1:8000"
    scope_url = f"{base_url}/api/scope"
    llm_url = f"{base_url}/api/llm/status"

    backend_running = False
    scope_ok = False
    llm_ok = False
    provider_info = ""

    # Check /api/scope
    try:
        req = urllib.request.Request(scope_url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                scope_data = json.loads(resp.read().decode())
                scope_ok = "supported_boards" in scope_data
                backend_running = True
    except Exception:
        scope_ok = False

    # Check /api/llm/status
    try:
        req = urllib.request.Request(llm_url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                llm_data = json.loads(resp.read().decode())
                enabled = llm_data.get("enabled_providers", [])
                llm_ok = len(enabled) > 0
                provider_info = f"(Enabled: {', '.join(enabled)})"
    except Exception:
        llm_ok = False

    if backend_running:
        print_status("Backend Server (127.0.0.1:8000)", True, "Online & responsive")
        print_status("Scope API (/api/scope)", scope_ok, "Class 10 TN & CBSE scope served")
        print_status("LLM Router (/api/llm/status)", llm_ok, provider_info)
    else:
        print_status(
            "Backend Server (127.0.0.1:8000)",
            False,
            f"{YELLOW}Server not currently running on 127.0.0.1:8000 (run 'npm run dev:all'){RESET}",
        )
        # Check offline provider config from env
        env_text = ""
        backend_env = BACKEND_DIR / ".env"
        root_env = ROOT_DIR / ".env"
        if backend_env.exists():
            env_text += backend_env.read_text(encoding="utf-8", errors="ignore")
        if root_env.exists():
            env_text += root_env.read_text(encoding="utf-8", errors="ignore")

        has_keys = any(
            k in env_text and len(env_text.split(k)[1].split("\n")[0].strip(" =\"'")) > 5
            for k in ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "MISTRAL_API_KEY"]
        )
        if has_keys:
            print_status("LLM Provider Keys (Offline Check)", True, "API keys detected in .env")
        else:
            print_status(
                "LLM Provider Keys (Offline Check)",
                True,
                "No API keys detected; mock provider fallback is active",
            )

    return backend_running and scope_ok and llm_ok


def main():
    print(f"\n{CYAN}{BOLD}=== AI Tutor Environment & Diagnostic Check ==={RESET}\n")

    env_ok = check_env_file()
    idx_ok = check_indexes()
    api_ok = check_backend_endpoints()

    print(f"\n{BOLD}Diagnostic Summary:{RESET}")
    all_ready = env_ok and idx_ok

    if all_ready:
        print(f"{GREEN}{BOLD}✓ AI Tutor environment is fully configured and ready!{RESET}")
        print("To start the app:")
        print(f"  {CYAN}npm run dev:all{RESET}   (Starts both backend and frontend)")
        print(f"  Open browser at: {BOLD}http://localhost:3000{RESET}\n")
    else:
        print(f"{YELLOW}{BOLD}Action Items to Fix:{RESET}")
        if not env_ok:
            print("  1. Create a `backend/.env` file containing your API keys (or leave empty for Mock provider).")
        if not idx_ok:
            print("  2. Build textbook index: run `python scripts/process_pdfs.py`")
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
