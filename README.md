# AI Tutor

[![CI](https://github.com/SivaranjaniSenthil2005/AI_TUTOR/actions/workflows/ci.yml/badge.svg)](https://github.com/SivaranjaniSenthil2005/AI_TUTOR/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![WCAG 2.1 AA](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-emerald.svg)](docs/ACCESSIBILITY_CHECKLIST.md)
[![Evaluation Report](https://img.shields.io/badge/Evaluation-Phase%2013%20Audited-blue.svg)](docs/EVALUATION.md)

> **Accessible AI Tutor for neurodiverse school students over Tamil Nadu State Board and CBSE/NCERT textbooks.**

---

## Innovation Statement

Traditional digital educational tools heavily rely on rapid mouse manipulation, dense text walls, and ungrounded general-purpose AI chat interfaces that easily hallucinate.

**AI Tutor** bridges accessibility and educational equity by pairing:
1. **Multimodal Hands-Free Interaction:** Real-time webcam eye-gaze tracking and voice interaction designed for learners with motor differences, tremors, or sensory sensitivities.
2. **Curriculum-Grounded Hybrid RAG:** A syllabus-restricted retrieval-augmented generation engine operating strictly over Class 10 Science and Social Science textbooks (Tamil Nadu State Board and CBSE/NCERT), delivering verified citations, out-of-scope refusal integrity, and tailored neurodiverse reading modes (Simple, Story, Analogy, Exam).
3. **Privacy-by-Design Computer Vision:** 100% in-browser MediaPipe facial landmark processing—zero video frames, facial imagery, or student question logs ever leave the local machine.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Browser (Next.js 15 & React)"]
        Cam["Webcam Video"] --> MP["MediaPipe FaceMesh (Local CV)"]
        MP --> Gaze["Gaze Coordinates & Dwell Machine"]
        Mic["Microphone"] --> STT["Speech-to-Text (STT)"]
        UI["High-Contrast Accessible UI"]
        TTS["Web Speech Narration (TTS)"]
    end

    subgraph Backend ["Backend API (FastAPI & Python 3.11)"]
        Router["/api/ask & Guardrails"]
        Rewrite["Query Expansion & Normalizer"]
        
        subgraph RAG ["Hybrid Retrieval Pipeline"]
            Chroma["ChromaDB (Dense Vector Search)"]
            BM25["BM25Okapi (Sparse Keyword Search)"]
            RRF["Reciprocal Rank Fusion (RRF)"]
            Rerank["Cross-Encoder Reranker"]
        end
        
        LLM["Provider Fallback Chain (Gemini / Groq / OpenRouter / HF / Mock)"]
    end

    Gaze --> UI
    STT --> Router
    UI --> Router
    Router --> Rewrite
    Rewrite --> Chroma
    Rewrite --> BM25
    Chroma --> RRF
    BM25 --> RRF
    RRF --> Rerank
    Rerank --> LLM
    LLM --> UI
    UI --> TTS
```

---

## Core Capabilities & Features

- **Hands-Free Gaze Control:**
  - Dynamic dwell selection with customizable activation intervals (`0.8s`, `1.2s`, `1.6s`).
  - Gaze edge scrolling for hands-free reading of extended textbook answers.
  - Emergency Gaze Pause Bar with recovery grace periods to combat visual fatigue and "Midas Touch" accidental triggers.
  - 5-point in-browser gaze calibration with automated accuracy grading (`Good`, `Moderate`, `Poor`).
  - Mouse-simulation mode for standard workstations and dev testing.
- **Multimodal Voice Interaction:**
  - Single-click or dwell-activated speech recognition with speech-to-text confirmation.
  - Synchronized read-along audio narration with active sentence-level highlighting.
  - Complete audio-visual mutual exclusion (speech recognition automatically pauses screen reading to prevent acoustic feedback).
- **Textbook-Grounded Hybrid RAG Engine:**
  - Dense semantic retrieval (`all-MiniLM-L6-v2`) fused with lexical indexing (`Rank-BM25`) via Reciprocal Rank Fusion (`RRF k=60`).
  - Cross-encoder reranking prioritizes highest-relevance syllabus passages.
  - Automated citation extraction: Every response contains verified `[n]` clickable chips mapping directly to textbook chapter titles and page spans.
  - Out-of-Scope refusal enforcement: Gracefully and politely refuses off-syllabus queries outside Class 10 Science and Social Science.
- **Neurodiverse Learning Adaptations:**
  - **Simple Mode:** Short sentences, grade-appropriate vocabulary, and lower cognitive load.
  - **Story Mode:** Narrative metaphors bridging abstract concepts to memorable everyday scenarios.
  - **Analogy Mode:** Structural analogies explaining complex mechanisms through relatable real-world models.
  - **Exam Style:** Clear, bullet-pointed syllabus answers with definitions, formulas, and textbook terminology.
- **Accessibility & Sensory Comfort:**
  - Toggleable high-contrast dark theme (`.high-contrast`) and enlarged typography (`.large-text`).
  - Respects `prefers-reduced-motion` to eliminate disorienting animations.
  - Screen reader announcements using `aria-live="polite"` and `role="status"` containers.
  - Subtle audio confirmation chimes for non-visual dwell feedback.

---

## User Interface & Screenshots

| Onboarding Flow | Main Learning Workspace |
| :---: | :---: |
| ![Onboarding](docs/screenshots/01_onboarding.png) | ![Main Workspace](docs/screenshots/02_main_workspace.png) |
| *Step-by-step setup with camera check and board selection* | *Gaze-controlled chat, source citations, and learning modes* |

| Learner Settings & Accessibility | Privacy & Data Protection Panel |
| :---: | :---: |
| ![Settings](docs/screenshots/03_settings_modal.png) | ![Privacy Panel](docs/screenshots/04_privacy_panel.png) |
| *Personalized dwell speeds, high contrast, and voice pace* | *Zero-data-collection guarantee & local CV processing* |

| Gaze & Usability Evaluation Lab (`/eval`) |
| :---: |
| ![Eval Lab](docs/screenshots/05_eval_lab.png) |
| *Dev-only suite for target selection, Midas touch tests, and automated SUS scoring* |

---

## 2-Minute Demonstration Script

To experience or record a complete walkthrough of AI Tutor:

1. **Minute 0:00 - Launch & First-Run Setup:**
   - Open `http://localhost:3000`. The onboarding wizard guides the student.
   - Choose **Tamil Nadu State Board** or **CBSE (NCERT)**, select **Class 10 Science**.
   - Either enable the webcam for eye-gaze tracking or select **"Skip Eye Control"** (or toggle **"Sim Gaze"** in the bottom-right corner).
2. **Minute 0:30 - Ask a Textbook Question:**
   - Select or type: *"What is Ohm's Law and its formula?"*
   - Observe the streamed response with formula highlights: `V = I × R`.
   - Click or dwell on the `[1]` citation badge to inspect the textbook chapter and verified source passage.
3. **Minute 1:00 - Neurodiverse Learning Modes:**
   - Switch mode from **Exam Style** to **Simple Mode** or **Analogy Mode**.
   - Observe the dynamic rewriting: sentence length and vocabulary complexity measurably decrease while grounding remains 100% textbook-faithful.
4. **Minute 1:30 - Hands-Free Voice & Gaze Interaction:**
   - Dwell on the **"Read Aloud 🔊"** button to start synchronized sentence read-along audio.
   - Notice the yellow sentence highlight following along with speech.
   - Dwell on the **"Pause Eye Control"** bar to take a cognitive break without triggering accidental clicks.
5. **Minute 1:50 - Evaluation Lab (`/eval`):**
   - Navigate to `http://localhost:3000/eval` to inspect the evaluation tooling, target dwell trials, and SUS survey.

---

## Evaluation & Empirical Benchmarks (Phase 13 Summary)

All figures below are measured by reproducible test harnesses and documented in detail in [docs/EVALUATION.md](docs/EVALUATION.md).

| Evaluation Dimension | Metric | Measured Value | Target Benchmark | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Retrieval Accuracy** | Hit@5 (Hybrid + Rerank) | **93.3%** [83.3% - 100.0%] | > 85% | **PASS** |
| **Retrieval Ranking** | Mean Reciprocal Rank (MRR) | **0.867** [0.725 - 0.983] | > 0.70 | **PASS** |
| **Answer Grounding** | Textbook Grounded Rate | **100.0%** | 100% | **PASS** |
| **Citation Integrity** | Citation Validity (all `[n]` map to source) | **100.0%** | 100% | **PASS** |
| **Scope Integrity** | Out-of-Scope Refusal Correctness | **100.0%** | 100% | **PASS** |
| **Simple Mode Readability** | Flesch-Kincaid Grade Level | **Grade 7.6** (vs Exam Grade 9.2) | Grade < 8.0 | **PASS** |
| **Adversarial Safety Suite** | Offline Safety & Injection Suite (`pytest`) | **19 / 19 Passed (100%)** | 100% | **PASS** |
| **System Latency** | End-to-End Latency (Fast Mode p50) | **2285.5 ms** | < 3000 ms | **PASS** |
| **Gaze Target Selection** | Accuracy on 6-target Dwell Trials | **95.0%** | > 90% | **PASS** |
| **System Usability Scale** | Standard SUS Score | **85.0 / 100 (Grade A - Excellent)** | > 68 (Avg) | **PASS** |
| **Accessibility Audit** | Axe-Core Playwright Audits (5 screens) | **0 Violations (WCAG 2.1 AA)** | 0 Violations | **PASS** |
| **Lighthouse Accessibility**| Core App Accessibility Score | **96 / 100** | > 90 / 100 | **PASS** |
| **Secret & Hygiene Scan** | Leak Scanner (`scripts/scan_secrets.py`)| **0 Credentials Found (Clean)** | 0 Leaks | **PASS** |

*For complete subgroup breakdowns, ablation tables, bootstrap confidence intervals, and charts, refer to [docs/EVALUATION.md](docs/EVALUATION.md).*

---

## Quickstart & Local Installation

### Prerequisites
- **Python 3.11+**
- **Node.js 20+**
- Webcam & microphone (optional; mock and mouse simulation modes available)

### 1. Clone Repository & Setup Backend
```powershell
# Clone
git clone https://github.com/SivaranjaniSenthil2005/AI_TUTOR.git
cd AI_TUTOR

# Setup Backend Virtual Environment
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install pytest psutil matplotlib
```

### 2. Setup Frontend
```powershell
cd ../frontend
npm install
```

### 3. Run Locally
**Terminal 1 (Backend):**
```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Reproducing the Evaluation Suite

You can execute every benchmark and generate the evaluation report offline with single commands:

```powershell
# 1. Run Unified Evaluation & Generate docs/EVALUATION.md
backend\.venv\Scripts\python.exe -m scripts.run_all_evals

# 2. Run Offline Safety & Prompt Injection Suite
backend\.venv\Scripts\pytest.exe backend/tests/safety/test_safety.py -v

# 3. Run Accessibility Audits (Playwright + Axe-Core)
cd frontend
npx playwright test e2e/accessibility.spec.ts

# 4. Run Secret & Repository Hygiene Scanner
backend\.venv\Scripts\python.exe scripts/scan_secrets.py

# 5. Run Backend Resource & Latency Benchmark
backend\.venv\Scripts\python.exe scripts/bench_latency.py --queries 30
```

---

## Accessibility, Ethics & Privacy

- **WCAG 2.1 AA Compliance:** Full keyboard tab traversal, explicit focus indicators, form labeling, and skip controls. Documented in [docs/ACCESSIBILITY_CHECKLIST.md](docs/ACCESSIBILITY_CHECKLIST.md).
- **Privacy Guarantee:** Facial tracking is computed in-memory via WebAssembly MediaPipe. No biometric frames are stored on disk or sent over any network.
- **Volunteer & Minor Ethics Protocol:** Usability testing must begin with consenting adult volunteers. Testing involving school students requires prior parental/guardian consent and institutional approval.

---

## Data Sources & Licensing

- **Code License:** [MIT License](LICENSE).
- **Textbook Attribution & Fair Dealing:** Textbooks used to construct syllabus indexes are the intellectual property of the **Tamil Nadu State Council of Educational Research and Training (TNSCERT) / Tamil Nadu Textbook and Educational Services Corporation** and the **National Council of Educational Research and Training (NCERT)**. Raw textbook PDFs and copyrighted materials are not distributed in this repository.

---

## Known Limitations & Future Work

### Current Scope & Limitations
- Strictly constrained to **Class 10 Science and Social Science (English Medium)**.
- MediaPipe eye-tracking is subject to lighting conditions, camera distance, and glare on spectacles.
- Free-tier LLM providers occasionally experience rate-limiting spikes; Fast Mode (`REWRITE_MODE=off`) mitigates latency.

### Planned Enhancements
- Expand to Standards 6–9 and 11–12, and include Mathematics.
- Support **Tamil Medium** textbooks with bilingual explanation switching.
- Integrated retrieval-practice and interactive quiz modes.
- Cognitive fatigue and blink-rate tracking to prompt adaptive study breaks.
- Native mobile and tablet layout optimization for specialized assistive mounts.
