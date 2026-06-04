# 🌌 Clariva AI: Project Architecture & Technical Walkthrough

Welcome to the comprehensive guide for **Clariva AI**! This document explains what Clariva AI is, the technologies powering it, how they are connected, and the step-by-step flow of how data moves through the system.

---

## 🎯 What is Clariva AI? (In Simple Terms)

Imagine you have a stack of textbooks, a long YouTube lecture, a website article, and a recorded voice note, and you need to study them all for an exam. Reading and watching everything would take hours.

**Clariva AI** is like a super-smart, private study assistant. You feed it any of these sources (PDFs, text files, audio files, video files, websites, or YouTube links). It immediately "reads" and "listens" to them, breaks them down, and indexes them. 

Once loaded, you can chat with Clariva AI about these files. When you ask a question:
1. It searches through your documents.
2. It pulls out the exact paragraphs that contain the answer.
3. It types out a response **token-by-token** (just like ChatGPT or Gemini) and highlights exactly which file it retrieved the answer from, showing you a citation.

---

## 🛠️ The Tech Stack (What is used and why)

Clariva AI is built using a modern, decoupled web architecture. Here is a breakdown of the tech stack:

### 1. The Frontend (What you see and interact with)
- **Next.js 14 (React)**: The framework used to build the user interface. It renders pages quickly and handles routing (like switching between the login screen and the main chat dashboard).
- **Zustand**: A lightweight, fast state manager. It remembers things like: *Who is logged in? What documents are currently selected? Is the AI currently streaming an answer?*
- **Tailwind CSS**: A styling engine. It provides the premium, dark-mode visual theme, card grids, panels, and borders.
- **Framer Motion**: An animation library. It handles the smooth slide-in panels, fading menus, and pulsing stream cursors.

### 2. The Backend (The heavy-lifting engine)
- **FastAPI (Python)**: A high-performance, fast web server. It handles file uploads, database queries, web scraping, and text processing.
- **Whisper (OpenAI)**: A state-of-the-art speech-to-text model. When you upload a video or audio file, Whisper listens to the file and converts the speech into readable text.
- **PyMuPDF & Tesseract OCR**: Used to read PDFs. PyMuPDF extracts normal text from documents. If the PDF is scanned (just a set of images with no selectable text), Tesseract OCR (Optical Character Recognition) automatically kicks in, scans the pages, and extracts the text from the images.
- **Trafilatura**: A smart web scraper. When you paste a website URL, it extracts the main article text and ignores junk like ads, navigation bars, and cookies.

### 3. The RAG & Search Engine (How it finds answers)
- **FAISS (Facebook AI Similarity Search)**: A vector search library. Instead of searching for exact keywords (like a Ctrl+F search), it searches for **meanings** (semantics). It translates paragraphs into lists of numbers (embeddings) and finds chunks that are semantically close to your question.
- **Sentence-Transformers (`all-MiniLM-L6-v2`)**: The AI model that translates raw text into numbers (vectors) so FAISS can search through them.

### 4. Edge AI (The brain that answers questions)
- **Cloudflare Workers AI**: A serverless network that runs AI models directly at the edge (closer to the user).
- **Llama 3.1 8B Instruct**: The Large Language Model (LLM) hosted on Cloudflare Workers. It reads the retrieved paragraphs and writes the response.

### 5. Database & Security
- **Supabase PostgreSQL**: A secure cloud database that stores user accounts, file details, user notes, and feedback history.
- **Supabase Storage**: Private, secure cloud storage buckets where your FAISS search files are stored so they don't get lost when the backend restarts.
- **Row-Level Security (RLS)**: A security protocol. It ensures that **User A** can never view, search, or query the documents uploaded by **User B**.

---

## 🏗️ System Architecture & Connection Flow

The diagram below shows how the components are connected:

```
                  ┌─────────────────────────────────────────────────────────────┐
                  │                       User Browser                          │
                  │         Next.js 14 + React 18 + Zustand + Tailwind          │
                  └───────────┬──────────────┬────────────────────────────┬─────┘
                              │              │                            │
                     REST API │     2. Context Request                    │ 3. Edge Stream Response
                     + JWT    │     (FastAPI Backend)                     │ (Cloudflare Worker AI)
                              ▼              ▼                            ▼
                  ┌──────────────────────────────────────┐   ┌──────────────────────────────┐
                  │          FastAPI Backend             │   │    Cloudflare Workers AI     │
                  │       Hosted on HuggingFace Space    │   │ (Llama 3.1 8B Instruct Edge) │
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

---

## 🔄 Step-by-Step Data Flow (How it works in detail)

Let's trace what happens during two main actions: **Adding a Source** and **Asking a Question**.

### Flow A: Ingesting a Source (Adding a File or URL)
1. **Upload / Submit**: You upload a PDF, MP3, or paste a URL in the sidebar.
2. **Text Extraction (Backend)**:
   - **PDF**: PyMuPDF extracts text. If blank, Tesseract OCR converts pages to images and reads the text from the images.
   - **Audio/Video**: The backend saves it temporarily, and Whisper ASR transcribes the spoken words.
   - **Web/YouTube**: Scrapers pull the text/captions.
3. **Database Logging**: The backend saves a record of this document (Title, ID, Owner, Full Text) in **Supabase PostgreSQL**.
4. **FAISS Indexing**:
   - The backend splits the full text into overlapping blocks (chunks of 400–1000 characters).
   - Sentence-Transformers converts each block into a vector.
   - FAISS compiles these vectors into a index file (`.faiss` and `.chunks.json`).
5. **Persistence**: The backend uploads these FAISS index files to **Supabase Storage**, scoped with a unique key `user{user_id}_{source_id}`, keeping tenant files isolated.

---

### Flow B: Asking a Question (The 2-Step RAG Chat Loop)
To bypass server delays and keep streaming speeds lightning-fast, Clariva AI separates **Context Search** from **AI Generation**:

#### Step 1: Gathering the Context
1. You type a question (e.g., *"What is Pritam's experience?"*).
2. The browser sends a request to the **FastAPI Backend** (`/chat/context` or `/chat/multi/context`) containing the source ID and your question.
3. The backend retrieves your document's text from the database.
4. **Dynamic k-Scaling**:
   - The backend calculates how many chunks to retrieve using `_get_retrieval_k`.
   - If the file is small (under 15,000 characters, like a typical resume), it retrieves **all chunks** (`k = 1000`). This ensures 100% text coverage so the AI never misses details.
   - For larger files, it searches the FAISS index to find the 6 closest matching chunks.
5. The backend compiles a context string (including the document title and summary metadata) and sends it back to the browser.

#### Step 2: Edge Inference & Streaming
1. The browser receives the context, combines it with your question, and makes a direct request to the **Cloudflare Worker AI**.
2. The Cloudflare Worker loads Llama 3.1 8B, reads the context, and starts streaming the answer back.
3. **Smooth Token Buffering (Frontend)**:
   - As chunks arrive from Cloudflare, the frontend pushes them into a character buffer.
   - An interval tick (15ms) pulls characters from the buffer at a steady typing speed (1 to 8 characters per tick depending on buffer load) to display a smooth, token-by-token typing animation.
   - A pulsing block cursor is appended to the message until the buffer is fully drained.

---

## 📂 Detailed Code Directory Layout

Here is a guide to where files reside and what they do in the workspace:

### 1. Frontend Repository (`frontend/`)
- [app/layout.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/app/layout.tsx): The root layout. Includes fonts, UI provider wrappers, toast alerts, and the floating credit footer.
- [app/page.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/app/page.tsx): The main marketing landing page.
- [app/dashboard/layout.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/app/dashboard/layout.tsx): The core dashboard structure. Manages sidebars, search boxes, notes panel toggles, and user logouts.
- [components/chat/ChatWindow.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/components/chat/ChatWindow.tsx): Handles chat histories, suggestion chips, citation popups, and the token-typing buffer queue.
- [components/chat/ChatInput.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/components/chat/ChatInput.tsx): The transparent, floating text input field.
- [components/chat/MessageBubble.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/components/chat/MessageBubble.tsx): Renders individual message blocks (user vs. AI) with markdown syntax highlighting, saving to notes, thumbs feedback, and citation badges.
- [components/sidebar/SourceItem.tsx](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/components/sidebar/SourceItem.tsx): Individual grid/list source cards with checkbox checkmark triggers.
- [store/useAppStore.ts](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/frontend/store/useAppStore.ts): The Zustand global state store.

### 2. Backend Repository (`backend/`)
- [main.py](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/backend/main.py): The main FastAPI routes (Authentication, source uploads, document scrapers, and RAG context search engines).
- [auth.py](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/backend/auth.py): Supabase security helper. Contains the `supabase_admin` client that runs operations securely.
- [crud.py](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/backend/crud.py): Database operations (saving documents, fetching notes, logging feedback).
- [models.py](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/backend/models.py): SQL database schemas.
- [my-ai-worker/](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/backend/my-ai-worker): The Cloudflare Worker code running the edge LLM.

### 3. Hugging Face Space Mirror (`hf-space/`)
- [Dockerfile](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/hf-space/Dockerfile): Configures the Docker container on Hugging Face. Installs Tesseract OCR, Poppler (PDF conversion), and FFmpeg.
- [main.py](file:///c:/Users/KIIT0001/Desktop/STUDY/ML PROJECTS/Clariva-ai/hf-space/main.py): The mirrored API backend deployment.
