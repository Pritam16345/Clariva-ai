# 🌌 Clariva AI

**A high-fidelity, full-stack AI-powered Knowledge Base and Research Assistant.**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=009688)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

Clariva AI allows you to ingest diverse content streams—such as **YouTube videos**, **PDFs (with automatic OCR fallback)**, **websites**, and **audio/video files**—to build a unified semantic index. You can then query across single or multiple sources with advanced context re-ranking, sub-millisecond document retrieval, and word-by-word streaming answers directly from edge LLMs.

🔗 **Live Demo:** [clariva-ai.vercel.app](https://clariva-ai.vercel.app)

---

## ✨ Enterprise-Grade Features

*   🚀 **Asynchronous Task Queue:** Document ingestion (PDF OCR, Whisper audio transcription, Vector embeddings) is fully decoupled into `FastAPI BackgroundTasks`. The UI remains lightning fast and non-blocking while heavy machine learning operations execute in the background.
*   🎯 **Advanced RAG with Cross-Encoder Re-Ranking:** Implements a two-stage retrieval pipeline. FAISS retrieves the top 30 chunks, which are then passed through `cross-encoder/ms-marco-MiniLM-L-6-v2` to strictly score and rerank contextual relevance, eliminating AI hallucinations.
*   🐳 **Dockerized Microservices:** Seamless local orchestration using `docker-compose`, spinning up the Frontend (Next.js), Backend (FastAPI), PostgreSQL, and Redis instances with a single command.
*   🎥 **YouTube Ingestion:** Automatic transcript extraction using a resilient 6-layer fallback engine.
*   📄 **Smart PDF & TXT Reader:** PyMuPDF text parser with an **automatic OCR fallback** using Tesseract OCR and `pdf2image` for image-only/scanned documents.
*   🎙️ **Audio & Video Ingestion:** Local OpenAI Whisper-based speech-to-text supporting standard media formats (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.mp4`, `.mov`, `.webm`, `.mkv`).
*   💬 **Multi-Source Knowledge Chat:** Aggregates RAG contexts across selected files and documents dynamically for unified comparative analysis.
*   ⚡ **Edge-Powered AI Streaming:** Zero-GPU-overhead word-by-word response streaming powered by Cloudflare Workers AI and Llama 3.1 8B.
*   📌 **Interactive Research Studio:** A side-by-side workspace featuring a persistent Notes system to pin, annotate, and save AI findings.
*   🔐 **Enterprise-Grade Auth & Security:** Supabase Auth (Email, Google OAuth, and OTP password resets) coupled with custom **Row-Level Security (RLS)** policy locking.

---

## 🏗️ System Architecture

Clariva AI utilizes a decoupled edge-and-backend architecture designed to maximize streaming speeds, prevent API timeouts, and bypass hosting egress limits.

```mermaid
flowchart TD
    %% Define Styles
    classDef frontend fill:#3178c6,stroke:#fff,stroke-width:2px,color:#fff;
    classDef backend fill:#009688,stroke:#fff,stroke-width:2px,color:#fff;
    classDef edge fill:#f38020,stroke:#fff,stroke-width:2px,color:#fff;
    classDef database fill:#7b1fa2,stroke:#fff,stroke-width:2px,color:#fff;
    classDef external fill:#424242,stroke:#fff,stroke-width:2px,color:#fff;

    %% Components
    User((User))
    
    subgraph Frontend [1. Client-Side]
        UI[Next.js Web Interface]:::frontend
    end
    
    subgraph Backend [2. FastAPI Backend on Hugging Face]
        API[API Router]:::backend
        Queue[Background Tasks Worker]:::backend
        Auth[Auth Service]:::backend
        Processor[Document Extractor\n(PyMuPDF / Whisper)]:::backend
        Reranker[Cross-Encoder Reranker]:::backend
    end
    
    subgraph Storage [3. Databases]
        SQL[(Supabase Postgres\nUser & Metadata)]:::database
        FAISS[(FAISS Vector DB\nText Embeddings)]:::database
    end
    
    subgraph Edge [4. Real-Time Streaming]
        Streamer[Cloudflare Worker]:::edge
    end
    
    LLM[Google Gemini / Llama 3.1 8B]:::external
    
    %% Flow
    User -->|Interacts| UI
    
    %% File Upload Flow
    UI -->|1. Uploads Document| API
    API <-->|Validates Session| Auth
    API -->|Saves Processing State| SQL
    API -.->|Triggers Async Task| Queue
    Queue -->|Sends File| Processor
    Processor -->|Generates Vectors| FAISS
    
    %% Question Retrieval Flow
    UI -->|2. Asks Question| API
    API -->|Dense Search| FAISS
    FAISS -->|Returns 30 Chunks| API
    API -->|Passes to| Reranker
    Reranker -->|Returns Top 5 Best| API
    API -->|Returns Context| UI
    
    %% LLM Generation Flow
    UI -->|3. Sends Question + Context| Streamer
    Streamer -->|Prompts Model| LLM
    LLM -->|Generates Answer| Streamer
    Streamer -.->|Streams Real-Time| UI
```

### The 3-Step RAG Loop:
1.  **Async Ingestion:** Documents are uploaded and acknowledged instantly by the API. The FastAPI Background Task takes over to run Whisper/OCR, chunk the text, encode it using `SentenceTransformers`, and persist it to FAISS.
2.  **Context Re-ranking:** Upon a query, FAISS fetches the top 30 semantic matches. A Cross-Encoder model critically evaluates these 30 chunks against the user's question, sorting them by absolute relevance and pruning the list to the top 5 to eliminate hallucinations.
3.  **Edge Inference:** The frontend forwards this hyper-filtered context along with the question directly to the Cloudflare Worker. The worker runs edge inference and streams the response word-by-word back to the browser. 

---

## 🛠️ Technology Stack

| Component | Technologies Used |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **State Manager** | Zustand |
| **Backend Engine** | FastAPI, Python 3.10, BackgroundTasks |
| **Identity Provider** | Supabase Auth (Email, Google OAuth, OTP reset) |
| **Vector Indexing** | FAISS (FlatL2) |
| **Embeddings** | SentenceTransformers (`all-MiniLM-L6-v2`) |
| **Re-ranking Model** | CrossEncoder (`cross-encoder/ms-marco-MiniLM-L-6-v2`) |
| **Edge AI Model** | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) |
| **Speech Translation** | OpenAI Whisper (Base) |
| **Databases** | Supabase PostgreSQL, Redis (Caching) |
| **Deployment** | Vercel (Web), HuggingFace Spaces (Backend), Docker Compose (Local) |

---

## 🚀 Local Installation & Setup

We use `docker-compose` to seamlessly boot the entire architecture (Frontend, Backend, Postgres, and Redis) locally.

### 1. Requirements
Make sure you have installed:
*   [Docker](https://www.docker.com/) & Docker Compose

### 2. Quick Start (Dockerized)
1. Clone the repository and configure your `.env` variables at the root.
2. Run the deployment command:
   ```bash
   docker compose up --build
   ```
3. Access the Application:
   - **Frontend UI:** `http://localhost:3000`
   - **Backend API Docs:** `http://localhost:7860/docs`

### 3. Manual Installation (Without Docker)
If you prefer running components manually, refer to the `frontend/` and `backend/` package files. Ensure you have **Python 3.10+**, **Node 18+**, **FFmpeg**, and **Tesseract OCR** installed on your host system.

---

## 🎨 Advanced Architectural Optimizations

### 1. Asynchronous ML Queue
Processing multi-hour audio files via Whisper or 100-page scanned PDFs via PyTesseract takes time. Instead of blocking the FastAPI event loop, these heavy ML workloads are offloaded to an asynchronous background queue, resulting in instant API responses and a non-blocking UI.

### 2. Dual-Stage Retrieval (Cross-Encoder)
Standard RAG relies on dense vector search (FAISS) which occasionally surfaces irrelevant chunks based solely on vocabulary proximity. We implemented a secondary Cross-Encoder model (`ms-marco`) that strictly re-evaluates the FAISS results, dramatically improving final AI answer accuracy.

### 3. Decoupled Edge Token Streaming
By streaming tokens directly from the Cloudflare Worker to the client browser instead of routing the stream through our FastAPI backend, we bypass Hugging Face Space free-tier outbound request restrictions and achieve zero-bottleneck edge performance.

### 4. FAISS Persistence Engine
Instead of paying for expensive third-party vector databases, we store indices as local FAISS flat files. When a user creates or modifies a source, these indices are backed up to Supabase Storage. If a backend instance restarts, indices are automatically fetched back to disk.

---

## 📂 Project Structure

```
Clariva-ai/
├── docker-compose.yml       # Local orchestration 
├── backend/
│   ├── main.py              # FastAPI async routes & Re-ranking logic
│   ├── auth.py              # Auth middleware + Dedicated Admin client
│   ├── crud.py              # SQL Database actions
│   ├── models.py            # SQLAlchemy Schema tables
│   ├── requirements.txt     # Python ML dependencies
│   └── my-ai-worker/        # Cloudflare edge worker
├── hf-space/
│   ├── main.py              # HuggingFace deployment mirror
│   └── Dockerfile           # HF Spaces system setup
└── frontend/
    ├── app/                 # Next.js 14 layout & routers
    ├── components/          # Reusable chat, polling, sidebar UI
    ├── lib/api.ts           # Axios backend api client
    └── store/               # Zustand global app store
```

---

> [!NOTE]  
> Built with care by [Pritam Kundu](https://github.com/Pritam16345). Contact for contributions and inquiries.