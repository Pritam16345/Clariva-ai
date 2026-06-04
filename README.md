# 🌌 Clariva AI

**A high-fidelity, full-stack AI-powered Knowledge Base and Research Assistant.**

Clariva AI allows you to ingest diverse content streams—such as **YouTube videos**, **PDFs (with automatic OCR fallback)**, **websites**, and **audio/video files**—to build a unified semantic index. You can then query across single or multiple sources with sub-millisecond document retrieval and word-by-word streaming answers directly from edge LLMs.

🔗 **Live Demo:** [clariva-ai.vercel.app](https://clariva-ai.vercel.app)

---

## ✨ Features

*   🎥 **YouTube Ingestion:** Automatic transcript extraction using a resilient 6-layer fallback engine.
*   📄 **Smart PDF & TXT Reader:** PyMuPDF text parser with an **automatic OCR fallback** using Tesseract OCR and `pdf2image` for image-only/scanned documents.
*   🌐 **Website Scraping:** High-accuracy web content extraction powered by Trafilatura.
*   🎙️ **Audio & Video Ingestion:** Local OpenAI Whisper-based speech-to-text supporting standard media formats (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.mp4`, `.mov`, `.webm`, `.mkv`).
*   🔍 **Advanced RAG Engine:** Local FAISS vector index + Sentence-Transformers (`all-MiniLM-L6-v2`) embeddings with custom retrieval dynamic scoring.
*   💬 **Multi-Source Knowledge Chat:** Aggregates RAG contexts across selected files and documents dynamically for unified comparative analysis.
*   ⚡ **Edge-Powered AI Streaming:** Zero-GPU-overhead word-by-word response streaming powered by Cloudflare Workers AI and Llama 3.1 8B.
*   📌 **Interactive Research Studio:** A side-by-side workspace featuring a persistent Notes system to pin, annotate, and save AI findings.
*   👍 **Analytical Feedback loops:** Dual-state thumbs up/down user rating with per-source accuracy tracking in the DB.
*   🔐 **Enterprise-Grade Auth & Security:** Supabase Auth (Email, Google OAuth, and OTP password resets) coupled with custom **Row-Level Security (RLS)** policy locking.
*   🗂️ **Index Persistence:** Persistent FAISS vector indices safely persisted to Supabase Storage, surviving backend restarts and container lifecycles.
*   🛡️ **Isolated Tenant Data:** Scoped keys for FAISS index names, ensuring zero cross-account data leakage.
*   ⌨️ **Power-User Command Palette:** Globally accessible search bar (triggered by `Ctrl + K`) to search and filter through sources instantaneously.

---

## 🏗️ System Architecture

Clariva AI utilizes a decoupled edge-and-backend architecture designed to maximize streaming speeds and bypass hosting egress limits.

```
┌─────────────────────────────────────────────────────────────┐
│                       User Browser                          │
│         Next.js 14 + React 18 + Zustand + Tailwind          │
└───────────┬──────────────┬────────────────────────────┬─────┘
            │              │                            │
   REST API │     2. Context URL                        │ 3. Edge Stream
   + JWT    │     (FastAPI)                             │ (Worker AI)
            ▼              ▼                            ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│          FastAPI Backend             │   │    Cloudflare Workers AI     │
│       HuggingFace Spaces Docker      │   │ (Llama 3.1 8B Instruct Edge) │
│                                      │   └──────────────────────────────┘
│ • RAG Context Extraction (FAISS)     │
│ • Speech-to-Text (Whisper ASR)       │
│ • OCR Pipeline (Tesseract)           │
└───────┬──────────────┬───────────────┘
        │              │
        ▼              ▼
┌──────────────┐ ┌──────────────┐
│   Supabase   │ │   Supabase   │
│  PostgreSQL  │ │   Storage    │
│ (User Data)  │ │(FAISS Index) │
└──────────────┘ └──────────────┘
```

### The 2-Step RAG Loop:
1.  **Context Assembly:** When a user submits a query, the frontend first calls the FastAPI backend. The backend searches the local or Supabase-stored FAISS index, retrieves the most semantically relevant text chunks, and returns them to the browser.
2.  **Edge Inference:** The frontend forwards this context along with the user's question directly to the Cloudflare Worker. The worker runs edge inference and streams the response word-by-word back to the browser. This eliminates one network hop and prevents Hugging Face free-tier egress limitations.

---

## 🛠️ Technology Stack

| Component | Technologies Used |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **State Manager** | Zustand |
| **Backend Engine** | FastAPI, Python 3.10 |
| **Identity Provider** | Supabase Auth (Email, Google OAuth, OTP reset) |
| **Vector Indexing** | FAISS (FlatL2) |
| **Embeddings** | SentenceTransformers (`all-MiniLM-L6-v2`) |
| **Edge AI Model** | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) |
| **Speech Translation** | OpenAI Whisper (Base) |
| **Scanned OCR** | PyTesseract + PDF2Image + Poppler |
| **Databases** | Supabase PostgreSQL |
| **Index Repository** | Supabase Storage (Private public-scoped buckets) |
| **Deployment** | Vercel (Frontend), HuggingFace Spaces (Dockerized Backend) |

---

## 🚀 Local Installation & Setup

### Prerequisites
Make sure you have the following installed on your host system:
*   **Python 3.10+**
*   **Node.js 18+**
*   **FFmpeg** (Required for Audio/Video Whisper transcription)
*   **Tesseract OCR** (Required for OCR document fallback)
*   **Poppler** (Required for PDF to Image page conversion)

### 1. Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   # On Windows
   .\venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   pip install openai-whisper
   ```
4. Create a `.env` file inside the `backend/` folder:
   ```env
   DATABASE_URL=postgresql://<user>:<password>@<host>:6543/postgres
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
   ALLOWED_ORIGINS=http://localhost:3000
   FRONTEND_URL=http://localhost:3000
   ```
5. Spin up the local development server:
   ```bash
   uvicorn main:app --reload
   ```
   *The interactive Swagger documentation will be available at `http://localhost:8000/docs`*

### 2. Cloudflare Worker Deploy
1. Navigate to the worker directory:
   ```bash
   cd backend/my-ai-worker
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Deploy the worker to your Cloudflare account:
   ```bash
   npm run deploy
   ```

### 3. Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install node modules:
   ```bash
   npm install
   ```
3. Create a `.env.local` configuration file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_CF_WORKER_URL=https://your-worker.workers.dev
   ```
4. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:3000` in your browser to view the application.*

---

## 🎨 Architectural Decisions & Optimizations

### 1. Decoupled Edge Token Streaming
By streaming tokens directly from the Cloudflare Worker to the client browser instead of routing the stream through our FastAPI backend, we bypassed Hugging Face Space free-tier outbound request restrictions and achieved low-latency edge performance.

### 2. FAISS Persistence Engine
Instead of paying for expensive third-party vector databases like Pinecone, we store indices as local FAISS flat files. When a user creates or modifies a source, these indices are uploaded and persisted to Supabase Storage. If a backend instance spins down or restarts, indices are automatically fetched back to the disk.

### 3. Row-Level Security (RLS) & Client Isolation
All user tables (`users`, `notes`, `content_sources`, etc.) have Row-Level Security policies active. Additionally, we run our background RAG database tasks using an isolated `supabase_admin` client, ensuring user-mutated authentication states do not cause permission leakage or RLS failures.

---

## 📂 Project Structure

```
Clariva-ai/
├── backend/
│   ├── main.py              # FastAPI main routes
│   ├── auth.py              # Auth middleware + Dedicated Admin client
│   ├── crud.py              # SQL Database actions
│   ├── models.py            # SQLAlchemy Schema tables
│   ├── database.py          # DB engine and pool config
│   ├── requirements.txt     # Python modules list
│   └── my-ai-worker/        # Cloudflare worker files
│       ├── src/index.ts     # Edge model stream route
│       └── wrangler.jsonc   # Wrangler configuration
├── hf-space/
│   ├── main.py              # HuggingFace deployment mirror
│   ├── Dockerfile           # HF Spaces system setup
│   └── requirements.txt
├── frontend/
│   ├── app/                 # Next.js pages layout & routers
│   ├── components/          # Reusable chat, sidebar UI
│   ├── lib/api.ts           # Axios backend api client
│   └── store/               # Zustand global app store
└── README.md
```

---

> [!NOTE]  
> Built with care by [Pritam Kundu](https://github.com/Pritam16345). Contact for contributions and inquiries.