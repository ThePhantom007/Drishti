"""Authentication: password hashing, session tokens, and role-based access
control dependencies.

Deliberately zero new pip dependencies -- password hashing uses stdlib
`hashlib.pbkdf2_hmac` (200,000 iterations, per-user random salt) rather
than bcrypt/passlib, and sessions are opaque `secrets.token_urlsafe`
tokens looked up in the database rather than JWTs. Both are perfectly
sound choices for this project's scale, and avoiding bcrypt's C-extension
wheel entirely sidesteps yet another "works on my machine" install
problem on top of the MATLAB engine dependency this project already has.
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import os
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session as DBSession

from database import AuthSession, User, UserRole, get_db

SESSION_LIFETIME = dt.timedelta(days=14)
PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(derived).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_b64, hash_b64 = stored.split("$", 1)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except (ValueError, TypeError):
        return False
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(derived, expected)


def create_session(db: DBSession, user: User) -> AuthSession:
    session = AuthSession(
        token=secrets.token_urlsafe(32),
        user_id=user.id,
        expires_at=dt.datetime.utcnow() + SESSION_LIFETIME,
    )
    db.add(session)
    db.commit()
    return session


def get_current_user(
    authorization: str | None = Header(default=None),
    db: DBSession = Depends(get_db),
) -> User:
    """Resolves the bearer token in the Authorization header to a User.
    Raises 401 for anything missing/invalid/expired -- every protected
    route depends on this (directly, or via require_roles below)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated. Include 'Authorization: Bearer <token>'.")
    token = authorization[7:].strip()
    return _resolve_session_token(db, token)


def get_current_user_flexible(
    authorization: str | None = Header(default=None),
    token: str | None = None,
    db: DBSession = Depends(get_db),
) -> User:
    """Same as get_current_user, but also accepts the token as a `?token=`
    query parameter. Needed for report files (PDF/PNG/MP3) that get loaded
    via plain <img src>/<a href>/<audio src> tags in the browser, which
    can't attach a custom Authorization header the way fetch() can."""
    bearer_token = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:].strip()
    resolved = bearer_token or token
    if not resolved:
        raise HTTPException(status_code=401, detail="Not authenticated. Sign in again to view this report.")
    return _resolve_session_token(db, resolved)


def _resolve_session_token(db: DBSession, token: str) -> User:
    session = db.get(AuthSession, token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")
    if session.expires_at < dt.datetime.utcnow():
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return user


def require_roles(*roles: UserRole):
    """Dependency factory: require_roles(UserRole.DOCTOR, UserRole.ADMIN)
    protects a route to only those roles, 403-ing everyone else who is
    still a valid logged-in user. Keeping this separate from
    get_current_user means routes can require *any* logged-in user by
    just depending on get_current_user directly."""
    allowed = set(roles)

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            allowed_names = ", ".join(r.value for r in allowed)
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of these roles: {allowed_names}. Your role: {user.role.value}.",
            )
        return user

    return dependency
