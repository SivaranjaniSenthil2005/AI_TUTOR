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

## Data Sources and Usage

- **Curriculum Textbooks:** School textbooks for Tamil Nadu State Board (SCERT) and CBSE / NCERT (Standards 6 through 12) are **NOT** included in this repository.
- **Downloading Data:** Users and educators must download official textbook PDFs directly from their respective portals:
  - Tamil Nadu State Board: [TN SCERT Textbooks Portal](https://www.textbooksonline.tn.nic.in/) -> place in `data/raw/tn/`
  - CBSE / NCERT: [NCERT Official Portal](https://ncert.nic.in/textbook.php) -> place in `data/raw/cbse/`
- **Attribution:** We gratefully acknowledge and credit **Tamil Nadu State Council of Educational Research and Training (TN SCERT)** and the **National Council of Educational Research and Training (NCERT)** for their curriculum resources.
- **License Notice:** The MIT License in this repository applies strictly to the source code and software architecture. It does not license or grant copyright over any textbook materials.

---

## Privacy & Neurodiversity-First Design

- **Camera & Video Privacy:** All gaze and facial landmark processing runs entirely **on-device inside the browser** using client-side WebAssembly/WebGPU. No raw video feed, frames, or biometric recordings are ever uploaded, transmitted, or stored on any server.
- **Accessible UI:** High-contrast color palettes, large typography, distraction-free layouts, visual focus cues, and dual gaze/voice activation are prioritized for accessible student experiences.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details. Copyright (c) 2026 Sivaranjani.
