# crud.py — All database CRUD operations for User, ContentSource, RefreshToken, Feedback, Note, Tokens, OAuth

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session
from passlib.context import CryptContext

import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


#  User 

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def create_user(db: Session, name: str, email: str, password: Optional[str] = None) -> models.User:
    hashed = pwd_context.hash(password) if password else "oauth_only_no_password"
    user   = models.User(name=name, email=email, hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return pwd_context.verify(plain, hashed)


#  OAuth 

def get_user_by_oauth(db: Session, provider: str, provider_user_id: str) -> Optional[models.User]:
    oauth = db.query(models.OAuthAccount).filter(
        models.OAuthAccount.provider         == provider,
        models.OAuthAccount.provider_user_id == provider_user_id
    ).first()
    return oauth.user if oauth else None


def create_oauth_account(
    db: Session, user_id: int, provider: str, provider_user_id: str, access_token: str
) -> models.OAuthAccount:
    record = models.OAuthAccount(
        user_id=user_id,
        provider=provider,
        provider_user_id=provider_user_id,
        access_token=access_token,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


#  Content Sources 

def get_sources_by_owner(db: Session, owner_id: int) -> list[models.ContentSource]:
    return (
        db.query(models.ContentSource)
        .filter(models.ContentSource.owner_id == owner_id)
        .order_by(models.ContentSource.id.desc())
        .all()
    )


def get_content_by_source_and_owner(
    db: Session,
    owner_id: int,
    source_identifier: str,
) -> Optional[models.ContentSource]:
    return (
        db.query(models.ContentSource)
        .filter(
            models.ContentSource.owner_id          == owner_id,
            models.ContentSource.source_identifier == source_identifier,
        )
        .first()
    )


def get_source_by_id(db: Session, source_id: int) -> Optional[models.ContentSource]:
    return db.query(models.ContentSource).filter(models.ContentSource.id == source_id).first()


def create_content_source(
    db: Session,
    source_identifier: str,
    source_type: str,
    content: str,
    title: str,
    owner_id: int,
    summary: Optional[str] = None,
) -> models.ContentSource:
    record = models.ContentSource(
        source_identifier=source_identifier,
        source_type=source_type,
        content=content,
        title=title,
        owner_id=owner_id,
        summary=summary,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_source_summary(
    db: Session, source_id: int, summary: str
) -> Optional[models.ContentSource]:
    source = db.query(models.ContentSource).filter(models.ContentSource.id == source_id).first()
    if source:
        source.summary = summary
        db.commit()
        db.refresh(source)
    return source


def delete_content_source_by_id(
    db: Session, source_id: int, owner_id: int
) -> Optional[models.ContentSource]:
    record = (
        db.query(models.ContentSource)
        .filter(
            models.ContentSource.id       == source_id,
            models.ContentSource.owner_id == owner_id,
        )
        .first()
    )
    if record:
        db.delete(record)
        db.commit()
    return record


#  Notes 

def create_note(
    db: Session, user_id: int, source_id: int, question: str, answer: str
) -> models.Note:
    record = models.Note(user_id=user_id, source_id=source_id, question=question, answer=answer)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_notes_by_user(db: Session, user_id: int) -> list[models.Note]:
    return (
        db.query(models.Note)
        .filter(models.Note.user_id == user_id)
        .order_by(models.Note.id.desc())
        .all()
    )


def delete_note(db: Session, note_id: int, user_id: int) -> Optional[models.Note]:
    record = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.user_id == user_id)
        .first()
    )
    if record:
        db.delete(record)
        db.commit()
    return record


#  Refresh Tokens 

def store_refresh_token(
    db: Session, token: str, user_id: int, expires_at: datetime
) -> models.RefreshToken:
    record = models.RefreshToken(token=token, user_id=user_id, expires_at=expires_at)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_refresh_token(db: Session, token: str) -> Optional[models.RefreshToken]:
    return (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.token == token)
        .first()
    )


def delete_refresh_token(db: Session, token: str) -> bool:
    record = db.query(models.RefreshToken).filter(models.RefreshToken.token == token).first()
    if record:
        db.delete(record)
        db.commit()
        return True
    return False


def delete_expired_refresh_tokens(db: Session) -> int:
    now   = datetime.now(timezone.utc)
    count = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.expires_at < now)
        .delete()
    )
    db.commit()
    return count


def delete_user_refresh_tokens(db: Session, user_id: int) -> int:
    count = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.user_id == user_id)
        .delete()
    )
    db.commit()
    return count


#  Password Reset & Magic Link Tokens 

def create_password_reset_token(
    db: Session, user_id: int, token: str, expires_at: datetime
) -> models.PasswordResetToken:
    record = models.PasswordResetToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_valid_password_reset_token(db: Session, token: str) -> Optional[models.PasswordResetToken]:
    now = datetime.now(timezone.utc)
    return (
        db.query(models.PasswordResetToken)
        .filter(
            models.PasswordResetToken.token      == token,
            models.PasswordResetToken.used       == False,
            models.PasswordResetToken.expires_at > now,
        )
        .first()
    )


def mark_password_reset_token_used(db: Session, token: models.PasswordResetToken) -> None:
    token.used = True
    db.commit()


def create_magic_link_token(
    db: Session, user_id: int, token: str, expires_at: datetime
) -> models.MagicLinkToken:
    record = models.MagicLinkToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_valid_magic_link_token(db: Session, token: str) -> Optional[models.MagicLinkToken]:
    now = datetime.now(timezone.utc)
    return (
        db.query(models.MagicLinkToken)
        .filter(
            models.MagicLinkToken.token      == token,
            models.MagicLinkToken.used       == False,
            models.MagicLinkToken.expires_at > now,
        )
        .first()
    )


def mark_magic_link_token_used(db: Session, token: models.MagicLinkToken) -> None:
    token.used = True
    db.commit()


#  Feedback 

def create_feedback(
    db: Session,
    source_id: int,
    question: str,
    answer: str,
    rating: int,
    user_id: int,
) -> models.Feedback:
    record = models.Feedback(
        source_id=source_id,
        question=question,
        answer=answer,
        rating=rating,
        user_id=user_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_feedback_stats(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(
            models.Feedback.source_id,
            models.ContentSource.title,
            sa_func.count(models.Feedback.id).label("total"),
            sa_func.sum(
                sa_func.case((models.Feedback.rating == 1, 1), else_=0)
            ).label("positive"),
            sa_func.sum(
                sa_func.case((models.Feedback.rating == -1, 1), else_=0)
            ).label("negative"),
        )
        .join(models.ContentSource, models.Feedback.source_id == models.ContentSource.id)
        .filter(models.Feedback.user_id == user_id)
        .group_by(models.Feedback.source_id, models.ContentSource.title)
        .all()
    )

    stats = []
    for row in rows:
        total    = row.total    or 0
        positive = row.positive or 0
        negative = row.negative or 0
        accuracy = round((positive / total) * 100, 1) if total > 0 else 0.0
        stats.append({
            "source_id":        row.source_id,
            "source_title":     row.title,
            "total_feedback":   total,
            "positive":         positive,
            "negative":         negative,
            "accuracy_percent": accuracy,
        })
    return stats

# ── Supabase Integration ──────────────────────────────────────────────────────

def get_user_by_supabase_uid(db: Session, supabase_uid: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.supabase_uid == supabase_uid).first()


def create_user_from_supabase(db: Session, supabase_uid: str, email: str, name: str) -> models.User:
    user = models.User(
        supabase_uid=supabase_uid,
        email=email,
        name=name,
        hashed_password=None
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user