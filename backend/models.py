# models.py — SQLAlchemy ORM models
# User, ContentSource, RefreshToken, Feedback, Note,
# PasswordResetToken, MagicLinkToken, OAuthAccount

from sqlalchemy import (
    Boolean, Column, Integer, String, Text, ForeignKey, DateTime, func,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    supabase_uid    = Column(String, unique=True, index=True, nullable=True)
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)   # nullable for OAuth-only users

    sources        = relationship("ContentSource",    back_populates="owner", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken",     back_populates="owner", cascade="all, delete-orphan")
    feedbacks      = relationship("Feedback",         back_populates="user",  cascade="all, delete-orphan")
    notes          = relationship("Note",             back_populates="user",  cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount",     back_populates="user",  cascade="all, delete-orphan")


class ContentSource(Base):
    __tablename__ = "content_sources"

    id                = Column(Integer, primary_key=True, index=True)
    source_identifier = Column(String, index=True, nullable=False)
    title             = Column(String, nullable=True)
    source_type       = Column(String, nullable=False)
    content           = Column(Text,   nullable=False)
    summary           = Column(Text,   nullable=True)
    owner_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at        = Column(DateTime, server_default=func.now(), nullable=False)

    owner     = relationship("User",     back_populates="sources")
    feedbacks = relationship("Feedback", back_populates="source", cascade="all, delete-orphan")
    notes     = relationship("Note",     back_populates="source", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    token      = Column(String, unique=True, index=True, nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="refresh_tokens")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id         = Column(Integer, primary_key=True, index=True)
    source_id  = Column(Integer, ForeignKey("content_sources.id"), nullable=False)
    question   = Column(Text,    nullable=False)
    answer     = Column(Text,    nullable=False)
    rating     = Column(Integer, nullable=False)   # 1 = thumbs up  |  -1 = thumbs down
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    source = relationship("ContentSource", back_populates="feedbacks")
    user   = relationship("User",          back_populates="feedbacks")


class Note(Base):
    __tablename__ = "notes"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    source_id  = Column(Integer, ForeignKey("content_sources.id"), nullable=False)
    question   = Column(Text,    nullable=False)
    answer     = Column(Text,    nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user   = relationship("User",          back_populates="notes")
    source = relationship("ContentSource", back_populates="notes")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider         = Column(String, nullable=False)          # "google"
    provider_user_id = Column(String, nullable=False, index=True)
    access_token     = Column(Text,   nullable=True)
    created_at       = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="oauth_accounts")