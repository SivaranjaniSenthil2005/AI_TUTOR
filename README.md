# AI Tutor

> **An accessible AI tutor for neurodiverse school students (Standards 6–12, English medium), controlled by gaze and voice, powered by an Advanced RAG backend over Tamil Nadu State Board and CBSE/NCERT textbooks.**

---

## Overview

**AI Tutor** is designed to provide an inclusive, high-accessibility learning environment tailored for neurodiverse students. By combining hands-free multimodal interfaces (eye gaze navigation and voice interaction) with textbook-grounded retrieval-augmented generation (RAG), AI Tutor empowers students to learn at their own pace with verified curriculum content.

---

## Planned Architecture

```
[ Webcam ] ──> [ In-Browser Gaze Tracking (MediaPipe / WebGazer) ] ──> [ Accessible UI Navigation ]
[ Microphone ] ──> [ Voice STT (Web Speech / Whisper) ] ──┐
                                                           │
                                                           ▼
                                               [ Query Rewrite & Expansion ]
                                                           │
                                                           ▼
                             ┌─────────────────────────────┴─────────────────────────────┐
                             │                                                           │
                             ▼                                                           ▼
                [ Dense Vector Retrieval (ChromaDB) ]                       [ Sparse Retrieval (BM25) ]
                             │                                                           │
                             └─────────────────────────────┬─────────────────────────────┘
                                                           │
                                                           ▼
                                            [ Reciprocal Rank Fusion (RRF) ]
                                                           │
                                                           ▼
                                            [ Cross-Encoder Reranker ]
                                                           │
                                                           ▼
                                  [ LLM Generation (Gemini / Groq / OpenAI / Mistral) ]
                                                  (Provider Fallback Engine)
                                                           │
                                                           ▼
                                      [ Answer + Textual Citations & Page References ]
                                                           │
                                                           ▼
                                     [ High-Contrast Accessible UI + Audio TTS ]
```

### Key Workflow
1. **Multimodal Input:** Students can navigate the interface using eye gaze dwell-selection and ask questions via natural voice commands.
2. **Query Refinement:** Student queries are analyzed and expanded for standard-specific textbook contexts.
3. **Hybrid RAG Pipeline:** Dense semantic search (vector embeddings) and sparse keyword search (BM25) are fused via Reciprocal Rank Fusion (RRF) and scored with a cross-encoder reranker.
4. **Adaptive LLM Generation:** Prompt synthesis with strict grounding, citations, and fallback across LLM providers (Gemini, Groq, OpenAI, Mistral).
5. **Accessible Multimodal Output:** Clear high-contrast text rendering, simplified explanations, and audio narration via Text-to-Speech (TTS).

---

## Tech Stack

- **Frontend:**
  - Next.js (App Router)
  - TypeScript
  - Tailwind CSS
  - Web Speech API & In-Browser Gaze Processing
- **Backend:**
  - Python (FastAPI + Uvicorn)
  - Pydantic Settings
  - Pytest & HTTPX
- **RAG & Search Engine (Planned):**
  - Vector Store: ChromaDB
  - Sparse Index: BM25 / Rank-BM25
  - Cross-Encoder Reranker
- **LLM Integrations (Planned):**
  - Google Gemini API
  - Groq API
  - OpenAI API
  - Mistral AI API

---

## Project Structure

```
ai_tutor/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes and endpoints
│   │   ├── llm/           # LLM provider clients and fallbacks
│   │   ├── rag/           # Hybrid search, reranking, and ingestion
│   │   ├── schemas/       # Pydantic data schemas
│   │   ├── config.py      # Environment configuration
│   │   └── main.py        # FastAPI entrypoint
│   ├── tests/             # Pytest backend test suite
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Backend environment configuration template
├── frontend/              # Next.js App Router frontend application
├── data/
│   ├── raw/
│   │   ├── tn/            # Tamil Nadu State Board textbooks (gitignored)
│   │   └── cbse/          # CBSE / NCERT textbooks (gitignored)
│   ├── processed/         # Parsed chunks and vector indexes (gitignored)
│   └── README.md
├── scripts/               # Data ingestion, indexing, and utility scripts
├── .gitignore             # Git ignore configuration
├── LICENSE                # MIT License
└── README.md              # Project documentation
```

---

## Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

---

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

5. Run tests:
   ```bash
   pytest tests/
   ```

6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   The backend API will be available at `http://127.0.0.1:8000` (interactive documentation at `http://127.0.0.1:8000/docs`).

---

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Download MediaPipe models and assets (self-hosted):
   ```bash
   # Linux / macOS
   bash ../scripts/download_models.sh

   # Windows (PowerShell)
   powershell -ExecutionPolicy Bypass -File ..\scripts\download_models.ps1
   ```
   *This downloads `face_landmarker.task` (~29 MB) into `frontend/public/models/` for local client-side execution.*

4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Models and Assets

AI Tutor is architected to run client-side eye and face tracking completely offline in the browser without external CDN dependencies at runtime:
- **MediaPipe WASM Engine:** Pre-bundled in `frontend/public/mediapipe/wasm/`.
- **Face Landmarker Task Model:** The official MediaPipe `face_landmarker.task` model provides 478 3D landmarks (including 10 iris tracking points).
- **Download Automation:** Run `scripts/download_models.sh` (or `scripts/download_models.ps1` on Windows) to automatically fetch and place the model into `frontend/public/models/`. The model file is gitignored to keep the repository lightweight.

---

## Gaze Estimation

AI Tutor transforms raw facial and iris landmarks into a stable, low-latency gaze control vector for hands-free UI interaction:

### Pipeline Architecture
1. **Local Eye Coordinate Projection:**
   - For each eye, the iris center is projected onto the corner-to-corner horizontal axis and eyelid vertical axis.
   - Normalizing relative to the eye's anatomical geometry ensures stable gaze estimation invariant to head tilts.
2. **Head Pose Extraction:**
   - Euler angles (yaw, pitch, roll) are computed directly from the facial transformation matrix to distinguish between eye movement and head rotation.
3. **Blink & EAR Detection:**
   - Eye Aspect Ratio (EAR) detects blinks and eye closures with debouncing.
   - During blinks, gaze feature outputs are temporarily held at the last known valid state to prevent UI jumping.
4. **Adaptive Signal Smoothing (1€ Filter):**
   - A One Euro (1€) filter reduces jitter at low speeds while maintaining instant responsiveness during saccadic eye movements.
5. **Coarse Direction & Baseline Calibration:**
   - Classifies user gaze into `left`, `right`, `up`, `down`, and `center` with dead-zones and multi-frame hysteresis.
   - A quick 2-second "Set Center" calibration customizes the neutral baseline for individual student eye shapes and seating positions.

### Known Limitations
- **Webcam Resolution & Distance:** Best results occur when seated 40–70 cm from standard 720p/1080p webcams.
- **Lighting Conditions:** Extreme backlighting or deep facial shadows can degrade MediaPipe landmark accuracy.
- **Glasses & Reflections:** Strong glare or thick frames may occasionally occlude iris boundaries; diffuse front lighting is recommended.

---

## Calibration & Gaze-to-Screen Mapping

AI Tutor translates real-time gaze features (iris position, head yaw/pitch, and 2nd-degree polynomial interaction terms) into continuous normalized screen viewport coordinates `(x, y)` through a personalized calibration model.

### How Calibration Works
1. **Interactive Fullscreen Protocol:**
   - The user is guided through an automated 9-point training grid across screen corners, edges, and center.
   - Each target displays a shrinking circular guide animation with a ~700 ms settling period to let the user's eyes fixate before recording ~30 valid frames.
   - Outliers and blink artifacts are rejected in real-time, taking the robust median feature vector for each training point.
2. **Ridge Regression (L2 Regularization):**
   - High-dimensional polynomial features (linear terms + quadratic iris squares + iris cross product) are fitted to screen coordinates using closed-form Ridge Regression solved with Gaussian elimination and partial pivoting.
   - Optimal regularization parameter $\lambda$ is automatically selected across candidate values.
3. **5-Point Independent Validation:**
   - 5 unseen validation coordinates measure true generalization precision (Mean Error & P90 Error as % of screen diagonal and equivalent pixels).
   - Calibrations are graded automatically:
     - **Good:** Mean error $< 8\%$ of screen diagonal (high precision)
     - **Okay:** Mean error $< 15\%$ of screen diagonal (usable for medium-large targets)
     - **Poor:** Mean error $\ge 15\%$ of screen diagonal (recalibration recommended with lighting/posture tips)
4. **Adaptive 1€ Screen Smoothing & Gaze Dot:**
   - Live predicted screen points are filtered with an adaptive One Euro filter, maintaining smooth fixation stability while preserving rapid saccadic transitions.
   - A lightweight, hardware-accelerated fixed gaze dot overlay (`GazeDot`) renders the current gaze location using `requestAnimationFrame`.
5. **Persistence & Viewport Drift Detection:**
   - Calibration weights and calibration viewport dimensions are stored in browser `localStorage`.
   - If the window or display resolution changes by more than 15%, the user is gently notified to recalibrate for optimal mapping accuracy.

### Tips for Good Calibration
- **Lighting:** Ensure even, diffuse lighting in front of your face. Avoid strong backlights or lamps directly behind you.
- **Camera Position:** Keep your webcam at or near eye level, centered above your display.
- **Distance:** Sit upright at a comfortable arm's length (~50–65 cm) from the screen.
- **Head Stability:** Keep your head fairly steady during calibration; let your eyes move naturally to track the dot.
- **Glasses:** Angle your screen or adjust room lights to minimize reflections and glare on lenses.
- **Fullscreen Mode:** Calibrate in browser fullscreen (`F11` or via the Fullscreen button) to maximize screen area mapping.

### Honest Limitations
- **Region-Level Accuracy:** Webcam-based eye tracking without infrared hardware typically achieves an accuracy of ~5–10% of screen diagonal (a region or quadrant of the screen, not single-pixel precision).
- **Target Design:** Consequently, AI Tutor's user interface is purposefully designed with large, high-contrast interactive targets and forgiving dwell zones rather than small desktop buttons.

---

## Eye-Controlled UI & Dwell Selection (Phase 6)

AI Tutor allows neurodiverse learners to operate the entire application using eye gaze alone. Looking at any button highlights the target, displays a filling circular or linear progress indicator, and triggers activation automatically. Mouse and keyboard interactions remain fully active as seamless fallbacks.

```
[ Gaze Point (x, y) ] ──> [ Hit Testing & Expanded Bounds (+24px) ]
                                      │
                                      ▼
                        [ Dwell State Machine ]
                  idle ──> hovering ──> dwelling ──> activated ──> cooldown
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
    [ Stickiness (+40px Exit) ]                   [ Blink Grace Period (250ms) ]
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                      [ Target onActivate & Sound Chime ]
```

### Core Gaze UI Engine (`frontend/lib/gazeui/`)

1. **Target Registry (`registry.ts`):**
   - Interactive components register their DOM element, priority, hit padding, and activation callback on mount, and unregister on unmount.
2. **Hit Testing & Caching (`hitTest.ts`):**
   - Evaluates gaze point against expanded target boundaries (default `+24px` padding) to forgive webcam estimation inaccuracy.
   - When multiple targets overlap, the engine calculates Euclidean distance from the gaze point to each element's center and selects the closest target.
   - Target bounding rects are cached per animation frame and invalidated on scroll or resize to eliminate layout thrashing.
3. **Dwell State Machine (`dwell.ts`):**
   - **Progressive Dwell:** Dwell progress advances from `0.0` to `1.0` based on the configured dwell duration (default `1.2s`, configurable from `0.6s` to `3.0s`).
   - **Stickiness Margin:** Once dwell starts on a target, the gaze must cross a larger exit margin (`+40px`) before progress cancels, preventing natural eye micro-jitter from aborting selections.
   - **Grace Period & Blink Resilience:** If the user blinks or glances away briefly for $< 250\text{ ms}$, progress freezes in place instead of resetting. If the gaze remains lost longer, progress decays smoothly to zero.
   - **Cooldown & Lock:** Upon reaching `1.0`, the target fires `onActivate` once and enters a `1000 ms` cooldown. The user must glance away before that target can re-arm, preventing runaway double-fires.
4. **Web Audio Synthesizer (`sound.ts`):**
   - Synthesizes subtle feedback directly through the Web Audio API without downloading external sound files:
     - Soft tick on dwell initiation
     - Cheerful two-tone harmonic chime (D5 $\rightarrow$ A5) on successful activation
     - Mellow tone on pause / rising chime on resume
5. **High-Performance React Integration (`GazeContext.tsx` & `useGazeTarget.ts`):**
   - Runs on `requestAnimationFrame` without triggering global re-renders on every frame.
   - Target components subscribe individually to progress events to animate circular SVG progress rings and highlight borders efficiently.

### Midas Touch Protection

To prevent accidental activations when students are simply reading or gazing across the interface:
- **Prominent Pause Button:** Always visible in the navigation header (shortcut: `[P]`).
- **Dimmed Gaze Dot:** When paused, the gaze dot dims and dwell activations are locked.
- **Safe 2x Resume Dwell:** A large "Resume Eye Control" banner requires a $2\times$ longer dwell duration (e.g. `2.4s`) to resume hands-free control, preventing accidental resumption.
- **Automatic Face Absence Pause:** If the student steps away or turns their head for more than 3 seconds, eye control pauses automatically with a friendly message and resumes as soon as their face returns.

### Gaze Edge Scrolling (`GazeScrollArea.tsx`)

- Top and bottom bands (`Look Here to Scroll Up / Down`) smoothly scroll workspace content when gazed at.
- Scroll velocity ramps up smoothly (from $3\text{ px/frame}$ to $18\text{ px/frame}$) the longer the gaze remains in the zone, respecting the eye control pause state.

### Gaze-Friendly Design Rules

AI Tutor enforces strict ergonomic principles for webcam eye tracking:
- **Maximum ~6 Targets per View:** Minimizes visual clutter and maximizes spatial target separation.
- **Generous Target Spacing:** Minimum gap of at least $24\text{ px}$ between adjacent targets to eliminate neighbor mis-hits.
- **Large Accessible Buttons:** Minimum target height of $72\text{ px}$ with clear icons, large bold typography, and distinct focus rings.
- **Corner Avoidance:** Important interactive controls are never placed at the extreme screen corners where webcam accuracy is lowest.
- **Full Fallback Support:** All `GazeButton` elements are standard semantic `<button>` elements that support mouse clicks and keyboard navigation (`Tab`, `Enter`, `Space`).

---

## Voice Input & Output (Phase 7)

AI Tutor integrates hands-free voice input (Speech-to-Text) and natural audio narration (Text-to-Speech) designed specifically for neurodiverse learners, fully operable via eye gaze and mouse/keyboard.

```
[ Microphone ] ──> [ SpeechToTextProvider (Web Speech STT) ] ──> [ Interim / Final Transcript ]
                                                                             │
                                                                             ▼
                                                                [ Confirmation Card ]
                                                        ( "Did I hear you right?" )
                                                     ┌───────────────┼───────────────┐
                                                     ▼               ▼               ▼
                                               [ Yes, Ask ]     [ Try Again ]    [ Cancel ]
                                                     │
                                                     ▼
                                      [ AI Tutor Mock / RAG Engine ]
                                                     │
                                                     ▼
                                 [ TextToSpeechProvider (SpeechSynthesis) ]
                                                     │
                                                     ▼
                                 [ Read-Along Sentence & Word Highlighting ]
```

### 1. Pluggable Provider Abstraction (`frontend/lib/voice/`)

All voice interactions are decoupled from React components through clean TypeScript provider interfaces, allowing seamless replacement with backend models (such as OpenAI Whisper, ElevenLabs, or self-hosted FastSpeech) without changing any UI code:

- **`types.ts`:**
  - `SpeechToTextProvider`: `start(options)`, `stop()`, `abort()`, `isSupported()`, and event callbacks (`onInterim`, `onFinal`, `onError`, `onStateChange`, `onStart`, `onEnd`).
  - `TextToSpeechProvider`: `speak(text, options)`, `pause()`, `resume()`, `cancel()`, `isSupported()`, `getVoices()`, and event callbacks (`onStart`, `onBoundary`, `onEnd`, `onError`).
- **`webSpeechStt.ts` (`WebSpeechSttProvider`):** Implements browser `SpeechRecognition` / `webkitSpeechRecognition` with dialect support (`en-IN` default, `en-US` toggle), interim live results, and user-friendly error classification.
- **`browserTts.ts` (`BrowserTtsProvider`):** Implements `window.speechSynthesis` with sentence chunking (prevents Chrome's ~15 s silence cutoff), asynchronous voice resolution, speed pacing ($0.6\times$ to $1.4\times$, default $0.9\times$), and character-to-sentence/word boundary mapping.
- **`index.ts`:** Factory functions `createSpeechToTextProvider()` and `createTextToSpeechProvider()`.

### 2. Neurodiverse-Centered Interaction Features

- **Confirmation Step ("Did I hear you right?"):**
  - Neurodiverse students frequently encounter speech disfluencies or recognition inaccuracies.
  - After speaking, the system presents a high-contrast confirmation card displaying the transcribed question with three large gaze buttons: **"Yes, Ask Tutor"**, **"Try Again"**, and **"Cancel"**.
- **Read-Along Text Highlighting (`ReadAlongText.tsx`):**
  - Synchronizes visual reading with audio listening by highlighting the active spoken sentence with a high-contrast cyan border/glow and underlining the active word in real time.
- **Mutual Exclusion:**
  - The microphone is automatically silenced before speech synthesis begins, and text-to-speech is paused before listening starts, preventing the microphone from picking up synthetic audio feedback.
- **Typed Input Fallback:**
  - For students who prefer or need typing, an accessible typed input box is always available alongside the voice button.
- **Audio Control Center (`ListenView.tsx` & `GazeSettingsModal.tsx`):**
  - Large gaze-operable speed adjusters ("Slower" / "Faster"), instant voice cycler across English voices, test speech playback, and an auto-read toggle.

### 3. Voice Privacy & Browser Support

- **Browser Service Notice:** In Chromium browsers (Google Chrome, Microsoft Edge), Web Speech STT may communicate with the browser vendor's secure speech recognition service. Text-to-Speech (TTS) runs **100% locally** in the browser.
- **Zero Audio Storage:** AI Tutor never records, uploads, logs, or stores audio files or student voice data on any server.
- **Browser Compatibility:** Recommended on **Google Chrome** or **Microsoft Edge**. If accessed from an unsupported browser (such as Mozilla Firefox), AI Tutor gracefully informs the student and activates the typed keyboard fallback.

### 4. Adding Custom STT / TTS Providers Later

To connect a backend Whisper or Cloud TTS model, simply implement the provider interface and register it in `frontend/lib/voice/index.ts`:

```typescript
// Example: Custom Backend Whisper STT Provider
import type { SpeechToTextProvider, SpeechToTextEvents } from "./types";

export class BackendWhisperSttProvider implements SpeechToTextProvider {
  // Implement start(), stop(), abort(), isSupported(), setEvents()
}
```

---

## Data Sources and Usage

- **Curriculum Textbooks:** School textbooks for Tamil Nadu State Board (SCERT) and CBSE / NCERT (Standards 6 through 12) are **NOT** included in this repository.
- **Downloading Data:** Users and educators must download official textbook PDFs directly from their respective portals:
  - Tamil Nadu State Board: [TN SCERT Textbooks Portal](https://www.textbooksonline.tn.nic.in/) -> place in `data/raw/tn/`
  - CBSE / NCERT: [NCERT Official Portal](https://ncert.nic.in/textbook.php) -> place in `data/raw/cbse/`
- **Attribution:** We gratefully acknowledge and credit **Tamil Nadu State Council of Educational Research and Training (TN SCERT)** and the **National Council of Educational Research and Training (NCERT)** for their curriculum resources.
- **License Notice:** The MIT License in this repository applies strictly to the source code and software architecture. It does not license or grant copyright over any textbook materials.

---

## Fetching Textbooks & Polite Ingestion (Phase 8b)

AI Tutor includes polite, manifest-driven tools to discover and download English-medium textbooks (Standards 6 to 12) from official educational portals (NCERT and Tamil Nadu SCERT).

```
[ Listing URL or Offline HTML ] ──> [ scripts/discover_links.py ]
                                                    │
                                                    ▼
                                     [ data/manifest.draft.yaml ]
                                                    │ (Human Review & Verification)
                                                    ▼
                                       [ data/manifest.yaml ]
                                                    │
                                                    ▼
                                       [ scripts/fetch_pdfs.py ] ──> [ data/download_log.jsonl ]
                                                    │
                                                    ▼
                                 [ data/raw/{board}/class_{N}/{subject}/ ]
                                 (Magic Bytes & PyMuPDF Verified PDFs)
```

### 1. Review-Then-Download Workflow

To ensure complete accuracy, copyright compliance, and safety, textbook acquisition follows a strict two-step process:

1. **Discover Links to Draft Manifest:**
   ```bash
   # Online link discovery with robots.txt checking
   python -m scripts.discover_links --url https://ncert.nic.in/textbook.php --board cbse
   ```
   This generates a draft manifest at `data/manifest.draft.yaml` filtering for English medium and Classes 6–12. It **never** overwrites your active manifest automatically.

2. **Offline HTML Fallback Mode (For JavaScript-Rendered Portals):**
   If a portal requires JavaScript or complex form selections:
   - Open the portal in your browser, select the desired class/subject, and save the webpage locally (**File > Save As** as `saved_page.html`).
   - Run discovery in offline mode:
     ```bash
     python -m scripts.discover_links --html-file saved_page.html --base-url https://ncert.nic.in/ --board cbse
     ```

3. **Human Review & Approval:**
   Inspect `data/manifest.draft.yaml`, verify the textbook titles and subjects, and copy/rename it to `data/manifest.yaml`:
   ```bash
   cp data/manifest.draft.yaml data/manifest.yaml
   ```

4. **Polite Resumable Download:**
   ```bash
   python -m scripts.fetch_pdfs --manifest data/manifest.yaml --board cbse --class 8
   ```

5. **Single Convenience Command (`scripts.sync`):**
   ```bash
   # Synchronize Class 8 CBSE science and mathematics
   python -m scripts.sync --board cbse --class 8
   ```

### 2. Polite Scraping Rules & Safety Guarantees

All network requests strictly enforce:
- **`robots.txt` Compliance:** Evaluates host rules with `urllib.robotparser.RobotFileParser` before every request. Disallowed endpoints are skipped with clear instructions to use offline HTML fallback.
- **Sequential Rate Limiting:** Enforces a minimum interval of 2.0 seconds between requests (at most 1 request per 2 seconds). Requests are strictly sequential (never parallel).
- **Exponential Backoff & `Retry-After`:** Automatically handles HTTP 429 and 5xx responses by honoring `Retry-After` headers and applying exponential backoff.
- **Descriptive Identity:** Identifies requests via custom User-Agent (`AI-Tutor-Bot/1.0`, configurable via `AI_TUTOR_USER_AGENT` or `AI_TUTOR_CONTACT`).
- **Gradual Scale Up (`--max-files`):** Default limit of 50 files per run prevents unexpected bandwidth or storage exhaustion.

### 3. PDF Integrity Verification & Resume Support

- **Integrity Validation:** Every existing and newly downloaded file is validated by verifying `%PDF-` magic bytes and reading the document page count via **PyMuPDF** (`pymupdf`). Corrupted or incomplete partial downloads (`.part`) are automatically detected and cleaned up.
- **Resume Support:** Existing valid files are skipped automatically without re-downloading.
- **Audit Logging:** Every download or skip event is recorded with file size, SHA256 checksum, HTTP status, and timestamp in `data/download_log.jsonl`.

### 4. Storage & Copyright Expectations

- **Disk Space:** Each standard textbook PDF is typically between 10 MB and 45 MB. A full curriculum set for Standards 6–12 across core subjects requires approximately 1.5 GB to 3.5 GB of disk space.
- **Git Hygiene:** All downloaded PDFs, draft manifests, and download logs are strictly gitignored (`.gitignore`).
- **Copyright Notice:** Textbook materials are the intellectual property of their respective publishers (NCERT / TN SCERT). Users are responsible for ensuring personal, educational, and fair-use compliance.

---

## Hybrid Retrieval & RAG Core (Phase 9)

AI Tutor features a hybrid retrieval pipeline combining dense semantic vector search (ChromaDB + BGE embeddings) and sparse keyword search (BM25 with Lucene smoothing), fused via Reciprocal Rank Fusion (RRF), shaped by an educational block policy, and reranked using a cross-encoder model.

```
[ User Query ]
      │
      ├─────────────────────────────────────────┐
      ▼                                         ▼
[ Dense Vector Search (ChromaDB) ]   [ Sparse Keyword Search (BM25) ]
(BAAI/bge-small-en-v1.5, Top 20)     (Partition-Scoped BM25, Top 20)
      │                                         │
      └────────────────────┬────────────────────┘
                           ▼
            [ Reciprocal Rank Fusion (RRF) ]
                Score = Σ 1 / (k + rank)
                           │
                           ▼
          [ Educational Block Type Policy ]
    (Excludes exercises; boosts summary/glossary)
                           │
                           ▼
         [ Deduplication & Section Capping ]
         (Max 2 chunks per textbook section)
                           │
                           ▼
      [ Cross-Encoder Reranker (Top Fused K) ]
     (cross-encoder/ms-marco-MiniLM-L-6-v2)
                           │
                           ▼
           [ Top K Grounded Curriculum Chunks ]
```

### 1. Building the Corpus Index

To index all processed textbook chunks in `data/processed/` into ChromaDB and BM25:

```bash
# Index all available curriculum partitions
python -m app.rag.cli index --all

# Or filter by board, class level, or subject
python -m app.rag.cli index --board cbse --class 10 --subject science
```

### 2. Searching the Index from the CLI

```bash
# Run a hybrid search with cross-encoder reranking
python -m app.rag.cli search "why does light bend in water" --board cbse --class 10 --subject science --mode hybrid_rerank --k 5

# Inspect per-stage candidates and rankings with --debug
python -m app.rag.cli search "causes of first world war" --board tn --class 10 --subject social_science --debug
```

Supported retrieval modes:
- `vector_only`: Dense semantic search using BGE embeddings.
- `bm25_only`: Fast keyword search over partition BM25 indexes.
- `hybrid`: Parallel vector + BM25 search fused with RRF (k=60).
- `hybrid_rerank` *(default)*: Hybrid RRF candidates rescored with cross-encoder.

### 3. Model Downloads & Storage Notes

- **Embedding Model:** `BAAI/bge-small-en-v1.5` (~130 MB). Embeds chapter/section context headers alongside text.
- **Reranker Model:** `cross-encoder/ms-marco-MiniLM-L-6-v2` (~80 MB).
- **First-Run Behavior:** Models download automatically on first use to the local HuggingFace cache directory (`~/.cache/huggingface/hub/`) and execute on CPU or GPU seamlessly.

### 4. Benchmark Evaluation Suite

AI Tutor includes an evaluation harness measuring **Hit@1**, **Hit@3**, **Hit@5**, and **Mean Reciprocal Rank (MRR)**:

```bash
# 1. Generate a draft gold template sampling real chunks
python -m app.rag.eval.make_gold_template --board cbse --class 10 --subject science --n 10

# 2. Run evaluation across all 4 retrieval modes
python -m app.rag.eval.run_eval --file data/eval/gold_set.yaml
```

---

## Privacy & Neurodiversity-First Design

- **Camera & Video Privacy:** All gaze and facial landmark processing runs entirely **on-device inside the browser** using client-side WebAssembly/WebGPU. No raw video feed, frames, or biometric recordings are ever uploaded, transmitted, or stored on any server.
- **Accessible UI:** High-contrast color palettes, large typography, distraction-free layouts, visual focus cues, and dual gaze/voice activation are prioritized for accessible student experiences.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details. Copyright (c) 2026 Sivaranjani.
