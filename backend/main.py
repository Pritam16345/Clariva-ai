import os
import re
import time
import json
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Tuple

import numpy as np
import faiss
import requests
import yt_dlp
import trafilatura
import fitz
import whisper

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import crud
import models
from database import SessionLocal, engine
from auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    verify_google_oauth_token,
    send_password_reset_email,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)

embedding_model: SentenceTransformer = None   # type: ignore[assignment]
whisper_model: whisper.Whisper = None         # type: ignore[assignment]
rag_indexes: dict = {}

RAG_STORAGE_DIR = "rag_storage"
os.makedirs(RAG_STORAGE_DIR, exist_ok=True)

CLOUDFLARE_WORKER_URL = os.getenv(
    "CLOUDFLARE_WORKER_URL",
    "https://my-ai-worker.pritam-kundu.workers.dev",
)

def _upload_to_supabase(safe_key: str) -> bool:
    """Upload FAISS index and chunks to Supabase Storage."""
    from auth import supabase
    try:
        faiss_path  = f"{RAG_STORAGE_DIR}/{safe_key}.faiss"
        chunks_path = f"{RAG_STORAGE_DIR}/{safe_key}.chunks.json"
        
        if not os.path.exists(faiss_path) or not os.path.exists(chunks_path):
            return False
        
        # Upload .faiss file
        with open(faiss_path, "rb") as f:
            supabase.storage.from_("rag-indexes").upload(
                path=f"{safe_key}.faiss",
                file=f.read(),
                file_options={"content-type": "application/octet-stream",
                              "upsert": "true"}
            )
        
        # Upload .chunks.json file
        with open(chunks_path, "rb") as f:
            supabase.storage.from_("rag-indexes").upload(
                path=f"{safe_key}.chunks.json",
                file=f.read(),
                file_options={"content-type": "application/json",
                              "upsert": "true"}
            )
        
        print(f"✅ Uploaded {safe_key} to Supabase Storage")
        return True
    except Exception as e:
        print(f"⚠️ Supabase Storage upload failed (non-fatal): {e}")
        return False


def _download_from_supabase(safe_key: str) -> bool:
    """Download FAISS index and chunks from Supabase Storage."""
    from auth import supabase
    try:
        faiss_path  = f"{RAG_STORAGE_DIR}/{safe_key}.faiss"
        chunks_path = f"{RAG_STORAGE_DIR}/{safe_key}.chunks.json"
        
        # Download .faiss file
        faiss_bytes = supabase.storage.from_("rag-indexes").download(
            f"{safe_key}.faiss"
        )
        with open(faiss_path, "wb") as f:
            f.write(faiss_bytes)
        
        # Download .chunks.json file
        chunks_bytes = supabase.storage.from_("rag-indexes").download(
            f"{safe_key}.chunks.json"
        )
        with open(chunks_path, "wb") as f:
            f.write(chunks_bytes)
        
        print(f"✅ Downloaded {safe_key} from Supabase Storage")
        return True
    except Exception as e:
        print(f"⚠️ Supabase Storage download failed: {e}")
        return False


def _delete_from_supabase(safe_key: str) -> bool:
    """Delete FAISS index and chunks from Supabase Storage."""
    from auth import supabase
    try:
        supabase.storage.from_("rag-indexes").remove([
            f"{safe_key}.faiss",
            f"{safe_key}.chunks.json"
        ])
        print(f"✅ Deleted {safe_key} from Supabase Storage")
        return True
    except Exception as e:
        print(f"⚠️ Supabase Storage delete failed (non-fatal): {e}")
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embedding_model, whisper_model
    print("Loading AI models…")
    whisper_model = whisper.load_model("base")
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Models loaded.")
    models.Base.metadata.create_all(bind=engine)

    # Try to load indexes from Supabase Storage first
    from auth import supabase
    loaded = 0
    try:
        files = supabase.storage.from_("rag-indexes").list()
        faiss_files = [
            f["name"] for f in files 
            if f["name"].endswith(".faiss")
        ]
        for faiss_file in faiss_files:
            safe_key    = faiss_file.replace(".faiss", "")
            chunks_file = f"{safe_key}.chunks.json"
            faiss_path  = f"{RAG_STORAGE_DIR}/{safe_key}.faiss"
            chunks_path = f"{RAG_STORAGE_DIR}/{safe_key}.chunks.json"
            
            # Download if not on disk
            if not (os.path.exists(faiss_path) and 
                    os.path.exists(chunks_path)):
                if not _download_from_supabase(safe_key):
                    continue
            
            try:
                index  = faiss.read_index(faiss_path)
                chunks = json.load(open(chunks_path))
                rag_indexes[safe_key] = {"index": index, "chunks": chunks}
                loaded += 1
            except Exception as e:
                print(f"Failed to load {safe_key}: {e}")
                continue
    except Exception as e:
        print(f"⚠️ Could not list Supabase Storage (non-fatal): {e}")
        # Fall back to local disk
        for faiss_file in os.listdir(RAG_STORAGE_DIR):
            if faiss_file.endswith(".faiss"):
                safe_key    = faiss_file.replace(".faiss", "")
                chunks_path = f"{RAG_STORAGE_DIR}/{safe_key}.chunks.json"
                if os.path.exists(chunks_path):
                    try:
                        index  = faiss.read_index(
                            f"{RAG_STORAGE_DIR}/{faiss_file}"
                        )
                        chunks = json.load(open(chunks_path))
                        # Use safe_key as identifier (it already contains user{id}_)
                        rag_indexes[safe_key] = {
                            "index": index, 
                            "chunks": chunks
                        }
                        loaded += 1
                    except Exception:
                        continue
    
    print(f"Reloaded {loaded} RAG indexes.")

    yield
    print("Shutting down Clariva API.")


def _rate_limit_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = decode_token(auth.split(" ", 1)[1])
            return str(payload.get("sub", get_remote_address(request)))
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)

app = FastAPI(title="Clariva API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/")
async def root():
    return {"status": "running", "service": "clariva-backend"}



_allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))  # keeps Supabase alive
    return {"status": "ok"}

class UserCreate(BaseModel):
    name:     str
    email:    str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email:    str
    password: str


class URLRequest(BaseModel):
    url: str


class ChatRequest(BaseModel):
    source_identifier: str
    question:          str


class ChatMultiRequest(BaseModel):
    question: str
    source_ids: list[int] | None = None


class FeedbackRequest(BaseModel):
    source_id: int
    question:  str
    answer:    str
    rating:    Literal[1, -1]          # strictly thumbs-up or thumbs-down


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    token: str


class EmailRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class VerifyOTPRequest(BaseModel):
    email: str
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class NoteCreate(BaseModel):
    source_id: int
    question: str
    answer: str

def _source_dict(s: models.ContentSource) -> dict:
    return {
        "id":                s.id,
        "source_identifier": s.source_identifier,
        "title":             s.title,
        "source_type":       s.source_type,
        "summary":           s.summary,
        "owner_id":          s.owner_id,
    }


from auth import supabase

@app.post("/register", tags=["auth"])
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        res = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {
                "data": {"name": user.name}
            }
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    if not res.user:
        raise HTTPException(status_code=400, detail="Sign up failed. User already exists or disabled.")
        
    db_user = crud.get_user_by_supabase_uid(db, res.user.id)
    if not db_user:
        db_user = crud.create_user_from_supabase(db, res.user.id, user.email, user.name)
        
    return {"id": db_user.id, "name": db_user.name, "email": db_user.email}


@app.post("/token", tags=["auth"])
def login_for_token(user: UserLogin, db: Session = Depends(get_db)):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    if not res.session or not res.user:
        raise HTTPException(status_code=401, detail="Authentication failed")

    db_user = crud.get_user_by_supabase_uid(db, res.user.id)
    if not db_user:
        # Link to pre-existing account if exists, else create new
        db_user = crud.get_user_by_email(db, user.email)
        if db_user:
            db_user.supabase_uid = res.user.id
            db.commit()
            db.refresh(db_user)
        else:
            name = res.user.user_metadata.get("name", user.email.split("@")[0])
            db_user = crud.create_user_from_supabase(db, res.user.id, user.email, name)

    return {
        "access_token":  res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "token_type":    "bearer",
        "user": {
            "id":    db_user.id,
            "name":  db_user.name,
            "email": db_user.email,
        },
    }


@app.post("/token/refresh", tags=["auth"])
def refresh_access_token(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        res = supabase.auth.refresh_session(body.refresh_token)
        if not res.session:
            raise ValueError("No session returned")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "token_type": "bearer"
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")


@app.post("/logout", tags=["auth"])
def logout_user(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        # Invalidates session upstream at Supabase
        supabase.auth.admin.sign_out(body.refresh_token) 
    except Exception:
        pass
    return {"message": "Logged out successfully"}


@app.post("/auth/google", tags=["auth"])
def google_auth(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        from auth import verify_google_oauth_token
        info = verify_google_oauth_token(body.token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    email = info["email"]
    sub = info["sub"]
    
    db_user = crud.get_user_by_supabase_uid(db, sub)
    if not db_user:
        db_user = crud.get_user_by_email(db, email)
        if db_user:
            db_user.supabase_uid = sub
            db.commit()
            db.refresh(db_user)
        else:
            name = info.get("name") or email.split("@")[0]
            db_user = crud.create_user_from_supabase(db, sub, email, name)

    return {
        "access_token":  info.get("supabase_access_token"),
        "refresh_token": info.get("supabase_refresh_token"),
        "token_type":    "bearer",
        "user": {
            "id":    db_user.id,
            "name":  db_user.name,
            "email": db_user.email,
        },
    }





@app.post("/auth/forgot-password", tags=["auth"])
@limiter.limit("5/hour")
def request_password_reset(request: Request, body: EmailRequest, db: Session = Depends(get_db)):
    from auth import send_password_reset_email
    send_password_reset_email(body.email)
    return {"message": "If an account exists, a reset link was sent."}


@app.post("/auth/verify-otp", tags=["auth"])
def verify_otp_endpoint(body: VerifyOTPRequest, db: Session = Depends(get_db)):
    from auth import supabase
    try:
        # Verify the 6-digit OTP
        res = supabase.auth.verify_otp({"email": body.email, "token": body.token, "type": "email"})
        if not res.session or not res.user:
            raise ValueError("Invalid OTP token")
            
        # Update user password utilizing new recovery session
        supabase.auth.update_user({"password": body.new_password})
        
        # Link or create local user
        db_user = crud.get_user_by_supabase_uid(db, res.user.id)
        if not db_user:
            db_user = crud.get_user_by_email(db, res.user.email)
            if db_user:
                db_user.supabase_uid = res.user.id
                db.commit()
                db.refresh(db_user)
            else:
                name = res.user.email.split("@")[0]
                db_user = crud.create_user_from_supabase(db, res.user.id, res.user.email, name)
                
        return {
            "access_token":  res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "token_type":    "bearer",
            "user": {
                "id":    db_user.id,
                "name":  db_user.name,
                "email": db_user.email,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token or password update failed")


@app.post("/auth/reset-password", tags=["auth"])
def reset_password(body: PasswordResetConfirm, db: Session = Depends(get_db)):
    try:
        res = supabase.auth.verify_otp({"token_hash": body.token, "type": "recovery"})
        if not res.user:
            raise ValueError("Invalid recovery token")
            
        supabase.auth.update_user({"password": body.new_password})
        return {"message": "Password reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.get("/sources/{user_id}", tags=["sources"])
def get_user_sources(
    user_id: int,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return [_source_dict(s) for s in crud.get_sources_by_owner(db, owner_id=user_id)]


@app.delete("/sources/{source_id}", tags=["sources"])
def delete_source(
    source_id:    int,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    deleted = crud.delete_content_source_by_id(db, source_id=source_id, owner_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Source not found or no permission to delete")
    scoped   = f"user{current_user.id}_{deleted.source_identifier}"
    safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
    rag_indexes.pop(safe_key, None)

    for ext in [".faiss", ".chunks.json"]:
        path = f"{RAG_STORAGE_DIR}/{safe_key}{ext}"
        if os.path.exists(path):
            os.remove(path)

    # Also delete from Supabase Storage
    _delete_from_supabase(safe_key)

    return {"message": "Source deleted successfully"}


@app.get("/sources/{source_id}/stats", tags=["sources"])
def get_source_stats(
    source_id:    int,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    source = crud.get_source_by_id(db, source_id=source_id)
    if not source or source.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Source not found")
        
    word_count = len(source.content.split())
    read_time_min = max(1, word_count // 200)
    
    # get chunks from memory if it exists, otherwise estimate
    scoped   = f"user{current_user.id}_{source.source_identifier}"
    safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
    index_data = rag_indexes.get(safe_key)
    chunk_count = len(index_data["chunks"]) if index_data else max(1, len(source.content) // 1000)
    
    length = len(source.content)
    retrieval_mode = "Full document" if length < 6000 else f"RAG ({chunk_count} chunks)"

    return {
        "word_count": word_count,
        "read_time_minutes": read_time_min,
        "chunk_count": chunk_count,
        "retrieval_mode": retrieval_mode,
    }


@app.get("/sources/{source_id}/chunks", tags=["sources"])
def get_source_chunks(
    source_id:    int,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    source = crud.get_source_by_id(db, source_id=source_id)
    if not source or source.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Source not found")
        
    scoped   = f"user{current_user.id}_{source.source_identifier}"
    safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
    if safe_key not in rag_indexes:
        _load_rag_index(source.source_identifier, current_user.id)
        
    data = rag_indexes.get(safe_key)
    return {"chunks": data["chunks"] if data else []}


@app.post("/process-source", tags=["sources"])
@limiter.limit("10/hour")
def process_source(
    request:      Request,
    body:         URLRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    existing = crud.get_content_by_source_and_owner(
        db, owner_id=int(current_user.id), source_identifier=body.url
    )
    if existing:
        return _source_dict(existing)

    source_type = (
        "youtube"
        if "youtube.com" in body.url or "youtu.be" in body.url
        else "website"
    )

    if source_type == "youtube":
        title, content = _process_youtube(body.url)
    else:
        title, content = body.url, _scrape_website_content(body.url)

    new_source = crud.create_content_source(
        db,
        source_identifier=str(body.url),
        source_type=str(source_type),
        content=str(content),
        title=str(title),
        owner_id=int(current_user.id),
    )
    _build_rag_index(str(body.url), str(content), int(current_user.id))

    summary = _generate_summary(str(content))
    if summary:
        crud.update_source_summary(db, source_id=int(new_source.id), summary=str(summary))

    return _source_dict(new_source)


@app.post("/process-pdf-upload", tags=["sources"])
@limiter.limit("10/hour")
def process_pdf_upload(
    request:      Request,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
    file:         UploadFile   = File(...),
):
    existing = crud.get_content_by_source_and_owner(
        db, owner_id=current_user.id, source_identifier=file.filename
    )
    if existing:
        return _source_dict(existing)

    content    = _extract_pdf_text(file)
    new_source = crud.create_content_source(
        db,
        source_identifier=str(file.filename),
        source_type="pdf",
        content=str(content),
        title=str(file.filename),
        owner_id=int(current_user.id),
    )
    _build_rag_index(str(file.filename), str(content), int(current_user.id))

    summary = _generate_summary(str(content))
    if summary:
        crud.update_source_summary(db, source_id=int(new_source.id), summary=str(summary))

    return _source_dict(new_source)


@app.post("/process-text-upload", tags=["sources"])
@limiter.limit("10/hour")
def process_text_upload(
    request:      Request,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
    file:         UploadFile   = File(...),
):
    existing = crud.get_content_by_source_and_owner(
        db, owner_id=current_user.id, source_identifier=file.filename
    )
    if existing:
        return _source_dict(existing)

    content_bytes = file.file.read()
    content = content_bytes.decode('utf-8', errors='ignore')

    new_source = crud.create_content_source(
        db,
        source_identifier=str(file.filename),
        source_type="txt",
        content=str(content),
        title=str(file.filename),
        owner_id=int(current_user.id),
    )
    _build_rag_index(str(file.filename), str(content), int(current_user.id))

    summary = _generate_summary(str(content))
    if summary:
        crud.update_source_summary(db, source_id=int(new_source.id), summary=str(summary))

    return _source_dict(new_source)

@app.post("/process-audio-upload", tags=["sources"])
@limiter.limit("5/hour")
def process_audio_upload(
    request:      Request,
    db:           Session     = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    file:         UploadFile  = File(...),
):
    # Determine source type
    video_exts = {".mp4", ".mov", ".webm", ".mkv"}
    file_ext   = os.path.splitext(file.filename)[1].lower()
    source_type = "video" if file_ext in video_exts else "audio"

    # Return existing if already processed
    existing = crud.get_content_by_source_and_owner(
        db, owner_id=current_user.id,
        source_identifier=file.filename
    )
    if existing:
        return _source_dict(existing)

    # Transcribe
    content = _transcribe_audio(file)
    fname_str = str(file.filename or "audio_file")
    title   = os.path.splitext(fname_str)[0]

    new_source = crud.create_content_source(
        db,
        source_identifier=str(file.filename),
        source_type=str(source_type),
        content=str(content),
        title=str(title),
        owner_id=int(current_user.id),
    )
    _build_rag_index(str(file.filename), str(content), int(current_user.id))

    summary = _generate_summary(str(content))
    if summary:
        crud.update_source_summary(
            db, source_id=int(new_source.id), summary=str(summary)
        )

    return _source_dict(new_source)

@app.post("/chat", tags=["chat"])
@limiter.limit("60/hour")
def chat_streaming(
    request:      Request,
    body:         ChatRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    db_source = crud.get_content_by_source_and_owner(
        db, owner_id=current_user.id, source_identifier=body.source_identifier
    )
    if not db_source:
        raise HTTPException(status_code=403, detail="Source does not belong to you")

    if len(str(db_source.content)) < 6000:
        relevant_context = str(db_source.content)
    else:
        params = _get_chunk_params(str(db_source.content))
        scoped   = f"user{int(current_user.id)}_{body.source_identifier}"
        safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
        
        if safe_key not in rag_indexes:
            _load_rag_index(str(body.source_identifier), int(current_user.id))
            if safe_key in rag_indexes:
                rag_indexes[safe_key]["chunk_size"] = params["chunk_size"]

        if safe_key not in rag_indexes or rag_indexes[safe_key].get("chunk_size") != params["chunk_size"]:
            _build_rag_index(str(body.source_identifier), str(db_source.content), int(current_user.id))
        
        k = _get_retrieval_k(str(db_source.content), body.question)
        if k > 100:
            k = len(rag_indexes[safe_key]["chunks"])
        relevant_context = _search_rag_index(safe_key, body.question, k=k)

    prompt = f"""You are a precise assistant answering questions from documents.

STRICT RULES:
- Answer using ONLY the context provided below
- If asked about multiple items (projects, skills, jobs), list ALL of them
- Never truncate a list — if there are 4 projects, mention all 4
- Use bullet points for lists to ensure clarity
- If information is not in the context, say "Not found in this document"
- Never hallucinate or add information not in the context

CONTEXT:
---
{relevant_context}
---

QUESTION: {body.question}

Answer completely and thoroughly:"""

    def event_stream():
        try:
            with requests.post(
                CLOUDFLARE_WORKER_URL,
                json={"prompt": prompt},
                headers={"Content-Type": "application/json"},
                stream=True,
                timeout=60,
            ) as resp:
                resp.raise_for_status()

                content_type = resp.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    full_text = resp.json().get("response", "Error parsing AI response.")
                    for i, word in enumerate(full_text.split(" ")):
                        token = word if i == 0 else f" {word}"
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        time.sleep(0.04)
                else:
                    for line in resp.iter_lines():
                        if line:
                            decoded = line.decode('utf-8')
                            if decoded.startswith("data: "):
                                data_str = decoded[6:]
                                if data_str == "[DONE]":
                                    continue
                                try:
                                    data_json = json.loads(data_str)
                                    if "response" in data_json:
                                        token = data_json["response"]
                                        yield f"data: {json.dumps({'token': token})}\n\n"
                                except Exception:
                                    pass

            yield "data: [DONE]\n\n"
        except requests.exceptions.RequestException as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Context-only endpoints (browser calls Cloudflare Worker directly) ──────

@app.post("/chat/context", tags=["chat"])
@limiter.limit("60/hour")
def get_chat_context(
    request:      Request,
    body:         ChatRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    """Return retrieved RAG context + question so the frontend can call the AI directly."""
    source = crud.get_content_by_source_and_owner(
        db,
        owner_id=int(current_user.id),
        source_identifier=body.source_identifier,
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    scoped_key = re.sub(
        r'[^a-zA-Z0-9_-]', '_',
        f"user{int(current_user.id)}_{body.source_identifier}"
    )

    if scoped_key not in rag_indexes:
        _load_rag_index(str(body.source_identifier), int(current_user.id))
    if scoped_key not in rag_indexes:
        _build_rag_index(str(body.source_identifier), str(source.content), int(current_user.id))
    if scoped_key not in rag_indexes:
        raise HTTPException(status_code=404, detail="Source not indexed")

    index_data = rag_indexes[scoped_key]
    index      = index_data["index"]
    chunks     = index_data["chunks"]

    q_embedding = embedding_model.encode([body.question])
    q_embedding = np.array(q_embedding, dtype=np.float32)

    k = min(6, len(chunks))
    distances, indices = index.search(q_embedding, k)

    scored = sorted(
        [
            (float(distances[0][i]), chunks[indices[0][i]])
            for i in range(k)
            if 0 <= indices[0][i] < len(chunks)
        ],
        key=lambda x: x[0],
    )
    top_chunks = [chunk for _, chunk in scored]
    context    = "\n\n".join(top_chunks)

    return {
        "context":      context,
        "question":     body.question,
        "source_title": str(source.title or body.source_identifier),
        "source_type":  str(source.source_type),
    }


@app.post("/chat/multi/context", tags=["chat"])
@limiter.limit("60/hour")
def get_multi_chat_context(
    request:      Request,
    body:         ChatMultiRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    """Return aggregated RAG context from multiple sources for direct AI calls."""
    sources = crud.get_sources_by_owner(db, owner_id=int(current_user.id))
    if body.source_ids:
        sources = [s for s in sources if int(s.id) in body.source_ids]

    if not sources:
        raise HTTPException(status_code=404, detail="No sources found")

    all_scored: list[tuple[float, str, str]] = []

    for source in sources:
        scoped_key = re.sub(
            r'[^a-zA-Z0-9_-]', '_',
            f"user{int(current_user.id)}_{str(source.source_identifier)}"
        )

        if scoped_key not in rag_indexes:
            _load_rag_index(str(source.source_identifier), int(current_user.id))
        if scoped_key not in rag_indexes:
            continue

        index_data = rag_indexes[scoped_key]
        index      = index_data["index"]
        chunks     = index_data["chunks"]

        q_embedding = embedding_model.encode([body.question])
        q_embedding = np.array(q_embedding, dtype=np.float32)

        k = min(3, len(chunks))
        distances, indices = index.search(q_embedding, k)

        for i in range(k):
            if 0 <= indices[0][i] < len(chunks):
                all_scored.append((
                    float(distances[0][i]),
                    chunks[indices[0][i]],
                    str(source.title or source.source_identifier),
                ))

    if not all_scored:
        raise HTTPException(status_code=404, detail="No indexed sources found")

    all_scored.sort(key=lambda x: x[0])
    top = all_scored[:6]
    context = "\n\n".join(
        f"[From: {title}]\n{chunk}" for _, chunk, title in top
    )

    return {
        "context":  context,
        "question": body.question,
    }



@app.post("/chat/sync", tags=["chat"])
@limiter.limit("60/hour")
def chat_sync(
    request:      Request,
    body:         ChatRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    db_source = crud.get_content_by_source_and_owner(
        db, owner_id=current_user.id, source_identifier=body.source_identifier
    )
    if not db_source:
        raise HTTPException(status_code=403, detail="Source does not belong to you")

    if len(str(db_source.content)) < 6000:
        relevant_context = str(db_source.content)
    else:
        params = _get_chunk_params(str(db_source.content))
        scoped   = f"user{int(current_user.id)}_{body.source_identifier}"
        safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
        
        if safe_key not in rag_indexes:
            _load_rag_index(str(body.source_identifier), int(current_user.id))
            if safe_key in rag_indexes:
                rag_indexes[safe_key]["chunk_size"] = params["chunk_size"]

        if safe_key not in rag_indexes or rag_indexes[safe_key].get("chunk_size") != params["chunk_size"]:
            _build_rag_index(str(body.source_identifier), str(db_source.content), int(current_user.id))
        
        k = _get_retrieval_k(str(db_source.content), body.question)
        if k > 100:
            k = len(rag_indexes[safe_key]["chunks"])
        relevant_context = _search_rag_index(safe_key, body.question, k=k)

    prompt = f"""You are a precise assistant answering questions from documents.

STRICT RULES:
- Answer using ONLY the context provided below
- If asked about multiple items (projects, skills, jobs), list ALL of them
- Never truncate a list — if there are 4 projects, mention all 4
- Use bullet points for lists to ensure clarity
- If information is not in the context, say "Not found in this document"
- Never hallucinate or add information not in the context

CONTEXT:
---
{relevant_context}
---

QUESTION: {body.question}

Answer completely and thoroughly:"""

    try:
        resp = requests.post(
            CLOUDFLARE_WORKER_URL,
            json={"prompt": prompt},
            headers={"Content-Type": "application/json"},
            timeout=60,
        )
        resp.raise_for_status()
        return {"answer": resp.json().get("response", "Error parsing AI response.")}
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=500, detail=f"AI service error: {exc}")


@app.post("/chat/multi", tags=["chat"])
@limiter.limit("60/hour")
def chat_multi_source(
    request:      Request,
    body:         ChatMultiRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    sources = crud.get_sources_by_owner(db, owner_id=int(current_user.id))
    if body.source_ids:
        sources = [s for s in sources if int(s.id) in body.source_ids]

    if not sources:
        raise HTTPException(status_code=400, detail="No sources available to query.")

    scored_chunks: list[dict] = []

    for source in sources:
        sid = str(source.source_identifier)

        if len(str(source.content)) < 6000:
            scored_chunks.append({
                "text":              str(source.content),
                "score":             0.0,
                "source_title":      str(source.title or sid),
                "source_identifier": sid,
            })
            continue

        params = _get_chunk_params(str(source.content))
        scoped   = f"user{int(current_user.id)}_{sid}"
        safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
        
        if safe_key not in rag_indexes:
            _load_rag_index(sid, int(current_user.id))
            if safe_key in rag_indexes:
                rag_indexes[safe_key]["chunk_size"] = params["chunk_size"]

        if safe_key not in rag_indexes or rag_indexes[safe_key].get("chunk_size") != params["chunk_size"]:
            _build_rag_index(sid, str(source.content), int(current_user.id))

        index_data = rag_indexes.get(safe_key)
        if not index_data:
            continue

        k = _get_retrieval_k(str(source.content), body.question)
        if k > 100:
            k = len(index_data["chunks"])
        actual_k = min(k, len(index_data["chunks"]))
        if actual_k == 0:
            continue

        query_emb = embedding_model.encode([body.question])
        distances, indices = index_data["index"].search(
            np.array(query_emb, dtype=np.float32), actual_k
        )

        for dist, idx in zip(distances[0], indices[0]):
            if 0 <= idx < len(index_data["chunks"]):
                scored_chunks.append({
                    "text":              index_data["chunks"][idx],
                    "score":             float(dist),
                    "source_title":      source.title or sid,
                    "source_identifier": sid,
                })

    if not scored_chunks:
        raise HTTPException(status_code=404, detail="No relevant content found across sources")

    scored_chunks.sort(key=lambda c: c["score"])
    top_chunks = scored_chunks[:6]

    merged_context = "\n\n".join(
        f"[Source: {c['source_title']}]\n{c['text']}" for c in top_chunks
    )
    prompt = f"""You are a precise assistant answering questions from multiple documents.

STRICT RULES:
- Answer using ONLY the context provided below
- If asked about multiple items, list ALL of them
- Never truncate a list — if there are 4 things, mention all 4
- For each piece of information you use, cite the source name in brackets.
- If information is not in the context, say "Not found in the sources"

CONTEXT:
---
{merged_context}
---

QUESTION: {body.question}

Answer completely and thoroughly:"""

    def event_stream():
        try:
            with requests.post(
                CLOUDFLARE_WORKER_URL,
                json={"prompt": prompt},
                headers={"Content-Type": "application/json"},
                stream=True,
                timeout=60,
            ) as resp:
                resp.raise_for_status()

                # Yield sources first
                sources_used = list({c["source_title"] for c in top_chunks})
                yield f"data: {json.dumps({'sources': sources_used})}\n\n"

                content_type = resp.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    full_text = resp.json().get("response", "Error parsing AI response.")
                    for i, word in enumerate(full_text.split(" ")):
                        token = word if i == 0 else f" {word}"
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        time.sleep(0.04)
                else:
                    for line in resp.iter_lines():
                        if line:
                            decoded = line.decode('utf-8')
                            if decoded.startswith("data: "):
                                data_str = decoded[6:]
                                if data_str == "[DONE]":
                                    continue
                                try:
                                    data_json = json.loads(data_str)
                                    if "response" in data_json:
                                        token = data_json["response"]
                                        yield f"data: {json.dumps({'token': token})}\n\n"
                                except Exception:
                                    pass

            yield "data: [DONE]\n\n"

        except requests.exceptions.RequestException as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/feedback", tags=["feedback"])
def submit_feedback(
    body:         FeedbackRequest,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    source = crud.get_source_by_id(db, source_id=body.source_id)
    if not source or source.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Source not found or forbidden")

    feedback = crud.create_feedback(
        db,
        source_id=body.source_id,
        question=body.question,
        answer=body.answer,
        rating=body.rating,
        user_id=current_user.id,
    )
    return {"id": feedback.id, "message": "Feedback recorded"}


@app.get("/feedback/stats", tags=["feedback"])
def get_feedback_stats(
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    return crud.get_feedback_stats(db, user_id=current_user.id)


@app.post("/notes", tags=["notes"])
def create_note(
    body:         NoteCreate,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    source = crud.get_source_by_id(db, source_id=body.source_id)
    if not source or source.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Source not found")
        
    note = crud.create_note(
        db, 
        user_id=current_user.id, 
        source_id=body.source_id, 
        question=body.question, 
        answer=body.answer
    )
    return {
        "id": note.id,
        "source_id": note.source_id,
        "question": note.question,
        "answer": note.answer,
        "created_at": note.created_at,
    }


@app.get("/notes", tags=["notes"])
def get_notes(
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    notes = crud.get_notes_by_user(db, user_id=current_user.id)
    return [
        {
            "id": n.id,
            "source_id": n.source_id,
            "source_title": n.source.title if n.source else "Unknown",
            "question": n.question,
            "answer": n.answer,
            "created_at": n.created_at,
        }
        for n in notes
    ]


@app.delete("/notes/{note_id}", tags=["notes"])
def delete_note(
    note_id:      int,
    db:           Session      = Depends(get_db),
    current_user: models.User  = Depends(get_current_user),
):
    deleted = crud.delete_note(db, note_id=note_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}


@app.get("/health", tags=["meta"])
def health_check():
    return {
        "status":          "ok",
        "models_loaded":   embedding_model is not None,
        "indexes_in_mem":  len(rag_indexes),
    }


def _get_chunk_params(content: str) -> dict:
    length = len(content)
    if length < 6000:
        return {"chunk_size": 400, "chunk_overlap": 80}
    elif length < 30000:
        return {"chunk_size": 600, "chunk_overlap": 120}  
    else:
        return {"chunk_size": 1000, "chunk_overlap": 150}

def _get_retrieval_k(content: str, query: str) -> int:
    list_keywords = ["all", "every", "list", "how many", "each", 
                     "projects", "skills", "experience", "education",
                     "what are", "tell me about"]
    is_list_query = any(kw in query.lower() for kw in list_keywords)
    
    length = len(content)
    if length < 6000:
        return 1000 # Return safely a large number, endpoint caps it to actual chunk list length
    elif length < 30000:
        return 8 if is_list_query else 5
    else:
        return 6 if is_list_query else 4

def _load_rag_index(source_identifier: str, owner_id: int) -> bool:
    """
    Attempt to load a per-user scoped FAISS index and its text chunks from disk.
    The key is prefixed with 'user{owner_id}_' to ensure data isolation.
    """
    scoped   = f"user{owner_id}_{source_identifier}"
    safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
    faiss_path  = f"{RAG_STORAGE_DIR}/{safe_key}.faiss"
    chunks_path = f"{RAG_STORAGE_DIR}/{safe_key}.chunks.json"
    
    # Try disk first
    if not (os.path.exists(faiss_path) and os.path.exists(chunks_path)):
        # Not on disk — try downloading from Supabase Storage
        print(f"Index not on disk, trying Supabase Storage: {safe_key}")
        if not _download_from_supabase(safe_key):
            return False
            
    # Load from disk (either was already there or just downloaded)
    try:
        index  = faiss.read_index(faiss_path)
        chunks = json.load(open(chunks_path))
        rag_indexes[safe_key] = {
            "index":  index,
            "chunks": chunks,
        }
        return True
    except Exception as e:
        print(f"Failed to load index {safe_key}: {e}")
        return False

def _build_rag_index(source_identifier: str, text: str, owner_id: int) -> None:
    """
    Split text into chunks, generate embeddings, build a FAISS index,
    and persist both the index and chunks to disk with user-scoped names.
    """
    params = _get_chunk_params(text)
    splitter = RecursiveCharacterTextSplitter(chunk_size=params["chunk_size"], chunk_overlap=params["chunk_overlap"])
    chunks   = splitter.split_text(text)
    if not chunks:
        chunks = [text] if text else ["Empty content"]
    embeddings = embedding_model.encode(chunks)
    index      = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(np.array(embeddings, dtype=np.float32))
    
    scoped   = f"user{owner_id}_{source_identifier}"
    safe_key = re.sub(r'[^a-zA-Z0-9_-]', '_', scoped)
    rag_indexes[safe_key] = {"index": index, "chunks": chunks, "chunk_size": params["chunk_size"]}
    
    # Save to disk
    faiss.write_index(index, f"{RAG_STORAGE_DIR}/{safe_key}.faiss")
    with open(f"{RAG_STORAGE_DIR}/{safe_key}.chunks.json", "w") as f:
        json.dump(chunks, f)
        
    print(f"RAG index built and saved: {safe_key} ({len(chunks)} chunks)")

    # Upload to Supabase Storage for persistence
    _upload_to_supabase(safe_key)


def _search_rag_index(source_identifier: str, query: str, k: int = 3) -> str:
    if source_identifier not in rag_indexes:
        return "No content found for this source."
    data    = rag_indexes[source_identifier]
    actual_k = min(k, len(data["chunks"]))
    if actual_k == 0:
        return "No content found for this source."
    q_emb = embedding_model.encode([query])
    _, indices = data["index"].search(np.array(q_emb, dtype=np.float32), actual_k)
    return "\n\n".join(
        data["chunks"][i] for i in indices[0] if 0 <= i < len(data["chunks"])
    )


def _generate_summary(content: str) -> str:
    try:
        prompt = (
            "Summarize the following content in exactly 3 concise sentences:\n\n"
            + content[:3000]
        )
        resp = requests.post(
            CLOUDFLARE_WORKER_URL,
            json={"prompt": prompt},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as exc:
        print(f"Summary generation failed (non-fatal): {exc}")
        return ""


def _process_youtube(url: str) -> Tuple[str, str]:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
    import xml.etree.ElementTree as ET

    match = re.search(r"(?:v=|youtu\.be/|shorts/)([^&\n?#]+)", url)
    if not match:
        raise HTTPException(status_code=422, detail="Invalid YouTube URL")
    video_id = match.group(1)

    title = "Unknown YouTube Video"

    try:
        with yt_dlp.YoutubeDL({
            "quiet": True,
            "skip_download": True,
            "ignoreerrors": True,
            "no_warnings": True,
            "logger": type("NullLogger", (), {
                    "debug": lambda s, m: None,
                    "info":  lambda s, m: None,
                    "warning": lambda s, m: None,
                    "error": lambda s, m: None,
            })(),
        }) as ydl:
            info = ydl.extract_info(url, download=False)
            if info:
                title = info.get("title", title)
    except Exception:
        pass

    if title == "Unknown YouTube Video":
        try:
            resp = requests.get(
                f"https://www.youtube.com/watch?v={video_id}",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=10,
            )
            og_match = re.search(r'<meta property="og:title" content="([^"]+)"', resp.text)
            if og_match:
                title = og_match.group(1)
        except Exception:
            pass

    if title == "Unknown YouTube Video":
        try:
            oembed = requests.get(
                f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json",
                timeout=10,
            ).json()
            title = oembed.get("title", title)
        except Exception:
            pass

    try:
        ytt = YouTubeTranscriptApi()
        try:
            fetched = ytt.fetch(video_id, languages=['en'])
        except Exception as e:
            print(f"YouTube transcript fetch failed: {e}")
            transcript_list = ytt.list_transcripts(video_id)
            transcript    = None
            for t in transcript_list:
                transcript = t
                break
            if not transcript:
                raise Exception("No transcripts available")
            if transcript.is_generated:
                title = "(Auto-generated) " + title
            fetched = transcript.fetch()

        full_text = " ".join(seg["text"] for seg in fetched.to_raw_data())
        if full_text.strip():
            return title, full_text
    except Exception:
        pass

    try:
        ydl_opts_po = {
            "quiet": True,
            "skip_download": True,
            "writesubtitles": True,
            "allsubtitles": True,
            "extractor_args": {"youtube": {"player_client": ["web"]}},
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            }
        }
        with yt_dlp.YoutubeDL(ydl_opts_po) as ydl:
            info = ydl.extract_info(url, download=False)
            subs = info.get("subtitles", {}) or info.get("automatic_captions", {})
            if subs:
                subs_list = subs.get('en') or list(subs.values())[0]
                if subs_list:
                    sub_url = subs_list[0]['url']
                    sub_resp = requests.get(sub_url)
                    clean_text = re.sub(r'<[^>]+>', '', sub_resp.text)
                    if clean_text.strip():
                        return title, clean_text
    except Exception:
        pass

    if os.path.exists("cookies.txt"):
        try:
            ydl_opts_cookie = {
                "quiet": True,
                "skip_download": True,
                "writesubtitles": True,
                "allsubtitles": True,
                "cookiefile": "cookies.txt",
            }
            with yt_dlp.YoutubeDL(ydl_opts_cookie) as ydl:
                info = ydl.extract_info(url, download=False)
                subs = info.get("subtitles", {}) or info.get("automatic_captions", {})
                if subs:
                    subs_list = subs.get('en') or list(subs.values())[0]
                    if subs_list:
                        sub_url = subs_list[0]['url']
                        sub_resp = requests.get(sub_url)
                        clean_text = re.sub(r'<[^>]+>', '', sub_resp.text)
                        if clean_text.strip():
                            return title, clean_text
        except Exception:
            pass

    try:
        resp = requests.get(f"https://www.youtube.com/watch?v={video_id}", headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        })
        match_tracks = re.search(r'"captionTracks":\[(.*?)\]', resp.text)
        if match_tracks:
            tracks_json = "[" + match_tracks.group(1) + "]"
            tracks = json.loads(tracks_json)
            if tracks:
                baseUrl = tracks[0].get("baseUrl")
                if baseUrl:
                    xml_resp = requests.get(baseUrl)
                    root = ET.fromstring(xml_resp.text)
                    text = " ".join([child.text for child in root if child.text])
                    if text.strip():
                        return title, text
    except Exception:
        pass

    if os.getenv("YOUTUBE_API_KEY"):
        try:
            api_key = os.getenv("YOUTUBE_API_KEY")
            cap_resp = requests.get(f"https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId={video_id}&key={api_key}").json()
            if "items" in cap_resp and len(cap_resp["items"]) > 0:
                caption_id = cap_resp["items"][0]["id"]
                track_resp = requests.get(f"https://www.googleapis.com/youtube/v3/captions/{caption_id}?key={api_key}")
                if track_resp.status_code == 200:
                    return title, track_resp.text
        except Exception:
            pass

    raise HTTPException(
        status_code=422,
        detail={
            "error": "youtube_blocked",
            "message": "YouTube is blocked on your current network.",
            "suggestions": [
                "Try on a different network (mobile hotspot)",
                "Upload a text file with the transcript manually"
            ]
        }
    )


def _scrape_website_content(url: str) -> str:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    return trafilatura.extract(resp.text) or "Could not extract content from this URL."


def _extract_pdf_text(file: UploadFile) -> str:
    uid      = uuid.uuid4().hex
    tmp_path = f"temp_{uid}_{file.filename}"
    try:
        with open(tmp_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
        with fitz.open(tmp_path) as doc:
            text = "".join(page.get_text() for page in doc)
        return text or "This PDF contains no extractable text."
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _transcribe_audio(file: UploadFile) -> str:
    """Save uploaded audio/video to temp path, transcribe with Whisper, clean up."""
    allowed_extensions = {
        ".mp3", ".wav", ".m4a", ".ogg",        # audio
        ".mp4", ".mov", ".webm", ".mkv",        # video
    }
    fname_str = str(file.filename or "unknown_file")
    file_ext  = os.path.splitext(fname_str)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported format '{file_ext}'. "
                   f"Supported: {', '.join(sorted(allowed_extensions))}"
        )

    if whisper_model is None:
        raise HTTPException(
            status_code=503,
            detail="Whisper model not loaded. Please try again in a moment."
        )

    uid      = uuid.uuid4().hex
    tmp_path = f"temp_media_{uid}{file_ext}"
    try:
        with open(tmp_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)

        print(f"Transcribing: {file.filename} ...")
        result  = whisper_model.transcribe(tmp_path, fp16=False)
        content = str(result.get("text", "")).strip()

        if not content:
            raise HTTPException(
                status_code=422,
                detail="No speech detected in this file. "
                       "Make sure the file contains audible speech."
            )
        return content
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)