# Clariva AI

**A full-stack, AI-powered knowledge base and research assistant.**

Feed Clariva a YouTube video, PDF, website URL, or audio/video file. It ingests the content, builds a FAISS vector index, and lets you ask questions with streaming AI-generated answers — all within a beautiful three-panel interface.

🔗 **Live Demo:** [clariva-ai.vercel.app](https://clariva-ai.vercel.app)

---

## Features

- 🎥 **YouTube ingestion** — transcript extraction with 6-layer fallback
- 📄 **PDF & TXT ingestion** — PyMuPDF text extraction
- 🌐 **Website ingestion** — Trafilatura content scraping
- 🎙️ **Audio & Video ingestion** — OpenAI Whisper speech-to-text (MP3, MP4, WAV, M4A)
- 🔍 **RAG-powered Q&A** — FAISS vector search + Sentence-Transformers embeddings
- ⚡ **Streaming responses** — word-by-word token streaming via Cloudflare Workers AI
- 💬 **Multi-source chat** — query across multiple knowledge bases simultaneously
- 📌 **Notes system** — pin and save AI responses for later reference
- 👍 **Feedback system** — thumbs up/down with per-source accuracy tracking
- 🔐 **Full auth** — email/password, Google OAuth, OTP password reset via Supabase
- 🗂️ **Persistent indexes** — FAISS indexes stored in Supabase Storage, survive server restarts
- 🛡️ **Per-user isolation** — scoped FAISS keys, zero cross-account data leakage
- ⌨️ **Command palette** — Ctrl+K source search
- 🌙 **Dark mode** — sleek dark-first UI

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                          │
│         Next.js 14 + React 18 + Zustand                 │
└──────────────────┬──────────────────┬───────────────────┘
                   │                  │
          REST API │        Direct    │ Streaming
          + JWT    │        fetch     │
                   ▼                  ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│   FastAPI Backend    │   │   Cloudflare Workers AI       │
│   HuggingFace Spaces │   │   (Llama 3 8B Instruct)      │
│                      │   └──────────────────────────────┘
│  • RAG Pipeline      │
│  • Whisper ASR       │
│  • Auth (Supabase)   │
│  • Rate Limiting     │
└──────┬───────────────┘
       │
       ├──────────────────► Supabase PostgreSQL (users, sources, notes)
       │
       └──────────────────► Supabase Storage (FAISS indexes persistence)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State Management | Zustand |
| Backend | FastAPI, Python 3.10 |
| Authentication | Supabase Auth (email, Google OAuth, OTP) |
| Embeddings | SentenceTransformers (all-MiniLM-L6-v2) |
| Vector Store | FAISS (persisted to Supabase Storage) |
| LLM | Cloudflare Workers AI (Llama 3 8B) |
| Speech-to-Text | OpenAI Whisper (base model) |
| Database | Supabase PostgreSQL |
| File Storage | Supabase Storage |
| Rate Limiting | slowapi |
| Frontend Hosting | Vercel |
| Backend Hosting | HuggingFace Spaces (Docker) |

---

## Local Setup

### Backend

```bash
cd backend
python -m venv acpenv
acpenv\Scripts\activate        # Windows
# source acpenv/bin/activate   # Linux/Mac
pip install -r requirements.txt
pip install openai-whisper
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
SECRET_KEY=your-secret-key
```

```bash
uvicorn main:app --reload
# API docs at http://localhost:8000/docs
```

### Cloudflare Worker

```bash
cd backend/my-ai-worker
npm install
npx wrangler deploy
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CF_WORKER_URL=https://your-worker.workers.dev
```

```bash
npm run dev
# App at http://localhost:3000
```

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys on push to main |
| Backend | HuggingFace Spaces | Docker container |
| Database | Supabase | PostgreSQL + Storage |
| AI Worker | Cloudflare Workers | `npx wrangler deploy` |
| ffmpeg | System dependency | Required for audio/video |

---

## Design Decisions

### Why FAISS over Pinecone/Qdrant?
FAISS runs entirely in-process with zero infrastructure overhead. For a personal or small-team knowledge base, it provides sub-millisecond search without needing a separate vector database service. FAISS indexes are persisted to Supabase Storage so they survive container restarts. Migrating to Pinecone would be straightforward since the embedding layer is fully decoupled.

### Why Whisper base?
The `base` model (74M parameters) offers the best trade-off between accuracy and speed for CPU inference. It runs at ~1x real-time on CPU, acceptable for on-demand ingestion. The `small`/`medium` models provide marginal gains but require significantly more memory — unsuitable for free-tier hosting.

### Why Cloudflare Workers for LLM?
Cloudflare Workers AI provides free-tier access to open-source LLMs (Llama 3) with global edge deployment, eliminating GPU infrastructure costs. The worker acts as a thin proxy, making it trivial to swap the underlying model or migrate to OpenAI/Anthropic by changing a single URL. Calling the worker directly from the browser also reduces backend load and improves streaming latency.

### Why call Cloudflare Worker from the browser directly?
The backend retrieves and ranks context chunks (RAG), then returns them to the frontend. The frontend calls the Cloudflare Worker directly for token streaming. This eliminates one network hop through the backend, improves streaming latency, and works around HuggingFace's outbound network restrictions on free tier.

---

## Repository Structure

```
Clariva-ai/
├── backend/
│   ├── main.py          # FastAPI app, all endpoints
│   ├── auth.py          # Supabase auth + JWT dependency
│   ├── crud.py          # Database CRUD operations
│   ├── models.py        # SQLAlchemy ORM models
│   ├── database.py      # SQLAlchemy engine setup
│   ├── migrate.py       # DB migration script
│   ├── requirements.txt
│   ├── Dockerfile       # HuggingFace deployment
│   └── my-ai-worker/    # Cloudflare Worker
│       └── src/index.ts
├── frontend/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   ├── lib/api.ts       # API client
│   └── store/           # Zustand store
└── README.md
```

---

Built with care by [Pritam Kundu](https://github.com/Pritam16345)