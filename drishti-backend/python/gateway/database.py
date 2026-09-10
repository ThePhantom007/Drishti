"""Persistent storage for patients, screenings, and the review workflow.

Production database: PostgreSQL, connected via SQLAlchemy through the
DATABASE_URL environment variable. Local development can run against a
zero-config SQLite file automatically when DATABASE_URL isn't set, so
contributors don't need a local Postgres instance running just to work
on the app day to day.

This is what makes the dashboards in docs/api_contract.md possible: without
persistence, there is no patient history, no review queue, and no analytics
to aggregate — every screening would be a stateless, forgotten one-off.
"""
from __future__ import annotations

import datetime as dt
import enum
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from config import settings


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return uuid.uuid4().hex


class ReviewStatus(str, enum.Enum):
    NOT_REQUIRED = "not_required"   # confident enough to clear automatically
    PENDING = "pending"             # awaiting ophthalmologist review
    CONFIRMED = "confirmed"         # reviewer agreed with the AI grade
    OVERRIDDEN = "overridden"       # reviewer changed the grade


class UserRole(str, enum.Enum):
    DOCTOR = "doctor"   # ophthalmologist reviewer
    ADMIN = "admin"     # district/state program administrator
    ASHA = "asha"       # field worker running screenings


class User(Base):
    """A real, password-authenticated account. Distinct from `Patient` --
    this is who is *using* the system (ASHA worker, doctor, admin), not
    who is being screened."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False)
    facility_id = Column(String, nullable=True)
    district = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class AuthSession(Base):
    """An opaque bearer token issued at login/registration. Deliberately
    not JWT -- a random token looked up server-side means a logout or an
    admin revocation actually invalidates it immediately, with zero new
    dependencies (stdlib `secrets` only)."""
    __tablename__ = "auth_sessions"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=True)          # optional -- some field workflows use ID-only
    external_id = Column(String, nullable=True)    # e.g. an ASHA worker's own patient register number
    age = Column(Integer, nullable=True)
    sex = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    preferred_language = Column(String, default="en")  # drives the voice read-out language by default
    facility_id = Column(String, nullable=True)    # PHC/health-centre code, powers the district/geo dashboard
    district = Column(String, nullable=True)
    registered_by = Column(String, nullable=True)  # ASHA/field worker identifier
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    screenings = relationship("Screening", back_populates="patient", order_by="Screening.created_at.desc()")


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    eye = Column(String, nullable=True)  # "OD" / "OS"

    status = Column(String, nullable=False)  # "graded" | "rejected"
    recapture_message = Column(Text, nullable=True)

    # Quality
    sharpness_score = Column(Float, nullable=True)
    illumination_score = Column(Float, nullable=True)
    field_of_view_score = Column(Float, nullable=True)

    # Grading
    icdr_level = Column(Integer, nullable=True)
    icdr_label = Column(String, nullable=True)
    referable = Column(Boolean, nullable=True)
    confidence = Column(Float, nullable=True)
    requires_human_review = Column(Boolean, default=False)

    # Dual-path grading -- the rule-based ICDR ("4-2-1") estimate computed
    # alongside the trained model inside gradeDRSeverity.m. icdr_level above
    # IS the learned/model grade; this is the separate rule-based one, kept
    # so a disagreement between the two surfaces as a real review signal
    # instead of being silently discarded (see runScreeningPipeline.m).
    rule_based_icdr_level = Column(Integer, nullable=True)
    grading_disagreement = Column(Boolean, nullable=True)

    # Lesions (flattened -- fine for a hackathon-scale dataset; a JSON column
    # would be the move if this schema needs to grow much further)
    microaneurysm_count = Column(Integer, nullable=True)
    hemorrhage_count = Column(Integer, nullable=True)
    hard_exudate_area_pct = Column(Float, nullable=True)
    soft_exudate_present = Column(Boolean, nullable=True)
    neovascularization_detected = Column(Boolean, nullable=True)

    # Report artefacts
    report_id = Column(String, nullable=True)
    summary_text = Column(Text, nullable=True)
    language = Column(String, default="en")
    processing_time_ms = Column(Integer, nullable=True)

    # Review workflow -- this IS the human-in-the-loop safety mechanism made concrete
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.NOT_REQUIRED, nullable=False)
    reviewer_id = Column(String, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    overridden_icdr_level = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    # Offline-sync bookkeeping (Android app, offline-first capture)
    client_local_id = Column(String, nullable=True)  # the app's own offline queue ID, echoed back on sync
    captured_at = Column(DateTime, nullable=True)     # when the photo was actually taken, vs. created_at (when it reached the server)

    created_at = Column(DateTime, default=dt.datetime.utcnow)

    patient = relationship("Patient", back_populates="screenings")

    @property
    def effective_icdr_level(self) -> int | None:
        """The grade that should actually be acted on: the reviewer's
        override if one exists, otherwise the AI's grade. Every consumer
        (analytics, patient history, exports) should read this, not
        icdr_level directly, or a confirmed override would be silently ignored."""
        if self.review_status == ReviewStatus.OVERRIDDEN and self.overridden_icdr_level is not None:
            return self.overridden_icdr_level
        return self.icdr_level


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    # pool_pre_ping + pool_recycle matter specifically for Neon (and most
    # serverless/managed Postgres): Neon suspends its compute after a period
    # of inactivity and resumes it on the next connection, which silently
    # invalidates any connections SQLAlchemy was already holding open in its
    # pool -- without pre-ping, the next request to reuse one of those dead
    # connections fails with something like "SSL connection has been closed
    # unexpectedly" instead of transparently reconnecting. Harmless no-op
    # for SQLite (there's no real network connection to go stale), so this
    # applies unconditionally rather than needing another sqlite/postgres
    # branch.
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _auto_migrate() -> None:
    """Lightweight dev-mode schema sync for SQLite.

    Base.metadata.create_all() only creates tables that don't exist yet --
    it never alters a table that's already there, so every time a column is
    added to a model (like rule_based_icdr_level / grading_disagreement),
    anyone with an existing drishti.db from before that change hits
    'OperationalError: no such column'. This adds any columns the ORM
    models declare but the actual on-disk table is missing, so pulling
    updated code just works against an existing database instead of
    requiring everyone to delete output/drishti.db and lose their data.

    Deliberately conservative: only ever ADDs columns, never renames or
    drops anything, and only runs against SQLite (a real deployment behind
    Postgres should use a proper migration tool instead, e.g. Alembic).
    """
    if not settings.database_url.startswith("sqlite"):
        return

    from sqlalchemy import inspect  # local import: only needed here

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue  # create_all() already handles brand-new tables
            existing_columns = {c["name"] for c in inspector.get_columns(table_name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                col_type = column.type.compile(dialect=engine.dialect)
                conn.exec_driver_sql(f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {col_type}')


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _auto_migrate()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
