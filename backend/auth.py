# auth.py — Supabase token validation and FastAPI dependency injection

import os
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from supabase import create_client, Client

import crud
from database import SessionLocal

#  Config 

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# These are kept for main.py compatibility but are handled centrally in Supabase now
ACCESS_TOKEN_EXPIRE_MINUTES  = 30
REFRESH_TOKEN_EXPIRE_DAYS    = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

#  DB dependency 

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


#  Token helpers (Mocked interfaces to match original main.py imports)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return data.get("supabase_access_token", "")


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return data.get("supabase_refresh_token", "")


def decode_token(token: str) -> dict:
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise ValueError("Invalid session")
        return {
            "sub": res.user.id,
            "type": "access",
            "email": res.user.email
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


#  Email handlers

def send_password_reset_email(to_email: str, token: str = ""):
    """
    Send a 6-digit OTP code via Supabase sign_in_with_otp.
    The frontend verifies it with type='email' and then updates the password.
    """
    try:
        supabase.auth.sign_in_with_otp({
            "email": to_email,
            "options": {
                "should_create_user": False,
            }
        })
        print(f"✅ Password reset OTP sent to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send OTP email via Supabase: {e}")


#  Google OAuth helper 

def verify_google_oauth_token(token: str) -> dict:
    try:
        res = supabase.auth.sign_in_with_id_token({
            "provider": "google",
            "id_token": token
        })
        if not res or not res.user or not res.session:
            raise ValueError("Invalid Google token mapped to Supabase")
            
        return {
            "email": res.user.email,
            "name": res.user.user_metadata.get("full_name", ""),
            "sub": res.user.id,
            "supabase_access_token": res.session.access_token,
            "supabase_refresh_token": res.session.refresh_token
        }
    except Exception as e:
        raise ValueError(f"Supabase Google OAuth validation failed: {str(e)}")


#  FastAPI dependency 

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_token(token)

    supabase_uid: Optional[str] = payload.get("sub")
    if not supabase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("email", "")
    
    # Auto-link or auto-create local DB user representation bridging Supabase
    user = crud.get_user_by_supabase_uid(db, supabase_uid)
    if not user:
        # Check if they exist by email but haven't been linked to supabase_uid yet
        existing_email_user = crud.get_user_by_email(db, email)
        if existing_email_user:
            existing_email_user.supabase_uid = supabase_uid
            db.commit()
            db.refresh(existing_email_user)
            user = existing_email_user
        else:
            # Create a brand new bridging representation 
            user = crud.create_user_from_supabase(db, supabase_uid, email, name=email.split("@")[0])

    return user