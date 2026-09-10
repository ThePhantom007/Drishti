"""FastAPI gateway exposing the MATLAB DR screening pipeline as a REST API.

Run: uvicorn main:app --reload --port 8000
Contract: docs/api_contract.md — web and Android teammates build against this.

This file is intentionally the single source of truth for every endpoint the
web dashboard and Android app call. Nothing here assumes a particular
frontend framework -- everything is plain JSON in, JSON (or a file) out.
"""
from __future__ import annotations

import datetime as dt
import logging
import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

import matlab_bridge
import tts
from auth import create_session, get_current_user, get_current_user_flexible, hash_password, require_roles, verify_password
from config import settings
from database import AuthSession, Patient, Screening, ReviewStatus, SessionLocal, User, UserRole, get_db, init_db
from schemas import (
    AnalyticsByDistrict,
    AnalyticsSummary,
    AnalyticsTrend,
    AuthResponse,
    DistrictBreakdown,
    ErrorResponse,
    ExplainabilityInfo,
    GradeDistribution,
    GradingInfo,
    GradingPaths,
    HealthResponse,
    LesionInfo,
    LoginRequest,
    PatientCreate,
    PatientDetail,
    PatientList,
    PatientOut,
    QualityInfo,
    QueueItem,
    RegisterRequest,
    RejectedResponse,
    ReportInfo,
    ReviewRequest,
    ReviewResponse,
    ScreeningResponse,
    ScreeningSummary,
    SyncItemResult,
    SyncResponse,
    TrendPoint,
    UserOut,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

ICDR_LABELS = ["No DR", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "Proliferative DR"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    matlab_bridge.start_engine()
    yield
    matlab_bridge.stop_engine()


app = FastAPI(title="DRISHTI Screening Gateway", lifespan=lifespan)

# The React dev server (drishti-frontend, Vite on localhost:5173) and any
# preview/prod frontend origin need explicit CORS to call this API from the
# browser -- without this, every fetch() from the frontend fails silently
# with a CORS error before it ever reaches these routes.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Report files (PDF/PNG/MP3) are served via explicit routes below, not a
# StaticFiles mount -- a mount can't run auth/ownership checks per-file,
# and (this was a real, previously-undiscovered bug) a mount registered
# at this prefix silently intercepts every request under it, including
# ones meant for a route with actual logic behind it, like on-demand
# audio generation -- see get_report_audio below, which never actually
# ran while a StaticFiles mount sat in front of it.


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", model_version=settings.model_version)


# ============================================================================
# Authentication
# ============================================================================
@app.post("/api/auth/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail=f"Username '{payload.username}' is already taken.")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole(payload.role),
        facility_id=payload.facility_id,
        district=payload.district,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    session = create_session(db, user)
    return AuthResponse(token=session.token, user=UserOut.model_validate(user))


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        # Deliberately the same message for "no such user" and "wrong
        # password" -- distinguishing them lets an attacker enumerate
        # valid usernames.
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    session = create_session(db, user)
    return AuthResponse(token=session.token, user=UserOut.model_validate(user))


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        session = db.get(AuthSession, token)
        if session:
            db.delete(session)
            db.commit()
    return {"status": "logged_out"}


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


# ============================================================================
# Patients
# ============================================================================
@app.post("/api/patients", response_model=PatientOut)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ASHA, UserRole.DOCTOR, UserRole.ADMIN)),
):
    patient = Patient(**payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _patient_out(patient)


@app.get("/api/patients", response_model=PatientList)
def list_patients(
    db: Session = Depends(get_db),
    limit: int = 200,
    district: Optional[str] = None,
    current_user: User = Depends(require_roles(UserRole.ASHA, UserRole.DOCTOR, UserRole.ADMIN)),
):
    """Powers the Patient History browser -- lists registered patients,
    most recently registered first, optionally filtered by district.
    ASHA workers only ever see patients they themselves registered --
    enforced here server-side, not just hidden in the UI, since a UI
    filter alone is not a real access boundary."""
    query = db.query(Patient)
    if current_user.role == UserRole.ASHA:
        query = query.filter(Patient.registered_by == current_user.username)
    if district:
        query = query.filter(Patient.district == district)
    patients = query.order_by(Patient.created_at.desc()).limit(limit).all()
    return PatientList(patients=[_patient_out(p) for p in patients])


@app.get("/api/patients/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ASHA, UserRole.DOCTOR, UserRole.ADMIN)),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if current_user.role == UserRole.ASHA and patient.registered_by != current_user.username:
        raise HTTPException(status_code=403, detail="You can only view patients you registered yourself.")
    return PatientDetail(
        **_patient_out(patient).model_dump(),
        screenings=[_screening_summary(s, patient.name) for s in patient.screenings],
    )


@app.get("/api/patients/{patient_id}/screenings", response_model=list[ScreeningSummary])
def get_patient_screenings(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ASHA, UserRole.DOCTOR, UserRole.ADMIN)),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if current_user.role == UserRole.ASHA and patient.registered_by != current_user.username:
        raise HTTPException(status_code=403, detail="You can only view patients you registered yourself.")
    return [_screening_summary(s, patient.name) for s in patient.screenings]


def _patient_out(patient: Patient) -> PatientOut:
    return PatientOut(
        id=patient.id, name=patient.name, external_id=patient.external_id, age=patient.age,
        sex=patient.sex, phone=patient.phone, preferred_language=patient.preferred_language,
        facility_id=patient.facility_id, district=patient.district, registered_by=patient.registered_by,
        created_at=patient.created_at, screening_count=len(patient.screenings),
    )


def _screening_summary(s: Screening, patient_name: Optional[str] = None) -> ScreeningSummary:
    grading_paths = None
    if s.rule_based_icdr_level is not None and s.icdr_level is not None:
        grading_paths = GradingPaths(
            rule_based_level=s.rule_based_icdr_level,
            rule_based_label=ICDR_LABELS[s.rule_based_icdr_level],
            learned_level=s.icdr_level,
            learned_label=s.icdr_label or ICDR_LABELS[s.icdr_level],
            disagreement=bool(s.grading_disagreement),
        )
    return ScreeningSummary(
        screening_id=s.id, patient_id=s.patient_id, patient_name=patient_name, eye=s.eye,
        status=s.status, icdr_level=s.icdr_level, icdr_label=s.icdr_label,
        effective_icdr_level=s.effective_icdr_level, referable=s.referable, confidence=s.confidence,
        requires_human_review=bool(s.requires_human_review), review_status=s.review_status.value,
        grading_paths=grading_paths,
        microaneurysm_count=s.microaneurysm_count, hemorrhage_count=s.hemorrhage_count,
        hard_exudate_area_pct=s.hard_exudate_area_pct, soft_exudate_present=s.soft_exudate_present,
        neovascularization_detected=s.neovascularization_detected,
        created_at=s.created_at, reviewed_at=s.reviewed_at, reviewer_id=s.reviewer_id,
        pdf_url=f"/api/reports/{s.report_id}/report.pdf" if s.report_id else None,
        annotated_image_url=f"/api/reports/{s.report_id}/annotated.png" if s.report_id else None,
        gradcam_image_url=f"/api/reports/{s.report_id}/heatmap.png" if s.report_id else None,
    )


# ============================================================================
# Screening (core pipeline call)
# ============================================================================
@app.post("/api/screen")
async def screen(
    image: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
    eye: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ASHA, UserRole.DOCTOR, UserRole.ADMIN)),
):
    if image.content_type not in settings.allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                status="error", error_code="invalid_file_type",
                message=f"Unsupported content type: {image.content_type}",
            ).model_dump(),
        )

    patient = None
    if patient_id:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="patient_id not found. Register the patient first via POST /api/patients.")
    else:
        patient = Patient(name=None)
        db.add(patient)
        db.commit()
        db.refresh(patient)

    tmp_path = settings.upload_tmp_dir / f"{uuid.uuid4().hex}_{image.filename}"
    with tmp_path.open("wb") as f:
        shutil.copyfileobj(image.file, f)

    try:
        result = matlab_bridge.run_screening_pipeline(str(tmp_path))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Pipeline execution failed")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                status="error", error_code="pipeline_failure", message=str(exc)
            ).model_dump(),
        ) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    resolved_lang = language or patient.preferred_language or "en"

    if result["status"] == "rejected":
        screening = Screening(
            patient_id=patient.id, eye=eye, status="rejected",
            recapture_message=result["recapture_message"],
            sharpness_score=result["quality"]["sharpness_score"],
            illumination_score=result["quality"]["illumination_score"],
            field_of_view_score=result["quality"]["field_of_view_score"],
            review_status=ReviewStatus.NOT_REQUIRED,
        )
        db.add(screening); db.commit(); db.refresh(screening)
        return RejectedResponse(
            status="rejected", screening_id=screening.id,
            quality=QualityInfo(**result["quality"]),
            recapture_message=result["recapture_message"],
        )

    grading, lesions, report = result["grading"], result["lesions"], result["report"]
    grading_paths_raw = result.get("grading_paths")
    review_status = ReviewStatus.PENDING if grading["requires_human_review"] else ReviewStatus.NOT_REQUIRED

    screening = Screening(
        patient_id=patient.id, eye=eye, status="graded",
        sharpness_score=result["quality"]["sharpness_score"],
        illumination_score=result["quality"]["illumination_score"],
        field_of_view_score=result["quality"]["field_of_view_score"],
        icdr_level=grading["icdr_level"], icdr_label=grading["icdr_label"],
        referable=grading["referable"], confidence=grading["confidence"],
        requires_human_review=grading["requires_human_review"],
        rule_based_icdr_level=grading_paths_raw["rule_based_level"] if grading_paths_raw else None,
        grading_disagreement=grading_paths_raw["disagreement"] if grading_paths_raw else None,
        microaneurysm_count=lesions["microaneurysm_count"], hemorrhage_count=lesions["hemorrhage_count"],
        hard_exudate_area_pct=lesions["hard_exudate_area_pct"],
        soft_exudate_present=lesions["soft_exudate_present"],
        neovascularization_detected=lesions["neovascularization_detected"],
        report_id=report["report_id"], summary_text=report["summary_text"], language=resolved_lang,
        processing_time_ms=result["processing_time_ms"], review_status=review_status,
    )
    db.add(screening); db.commit(); db.refresh(screening)

    audio_url = None
    try:
        tts.get_or_create_audio(report["report_id"], report["summary_text"], resolved_lang)
        audio_url = f"/api/reports/{report['report_id']}/audio?lang={resolved_lang}"
    except Exception:  # noqa: BLE001
        logger.exception("Audio generation failed for %s/%s", report["report_id"], resolved_lang)

    return ScreeningResponse(
        status="graded", screening_id=screening.id, patient_id=patient.id,
        quality=QualityInfo(**result["quality"]),
        grading=GradingInfo(**grading),
        grading_paths=GradingPaths(**grading_paths_raw) if grading_paths_raw else None,
        lesions=LesionInfo(**lesions),
        explainability=ExplainabilityInfo(
            gradcam_image_url=f"/api/reports/{report['report_id']}/heatmap.png",
            annotated_image_url=f"/api/reports/{report['report_id']}/annotated.png",
        ),
        report=ReportInfo(
            report_id=report["report_id"],
            pdf_url=f"/api/reports/{report['report_id']}/report.pdf",
            audio_url=audio_url,
            summary_text=report["summary_text"],
            language=resolved_lang,
        ),
        processing_time_ms=result["processing_time_ms"],
    )


def _get_screening_by_report(db: Session, report_id: str) -> Screening:
    screening = db.query(Screening).filter(Screening.report_id == report_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail="Report not found")
    return screening


def _check_report_access(db: Session, screening: Screening, user: User) -> None:
    """Mirrors the same ASHA-sees-only-their-own-patients rule enforced on
    GET /api/patients -- an ASHA account can view report files for
    patients they registered, doctors/admins can view any report."""
    if user.role == UserRole.ASHA:
        patient = db.get(Patient, screening.patient_id)
        if not patient or patient.registered_by != user.username:
            raise HTTPException(status_code=403, detail="You can only view reports for patients you registered yourself.")


@app.get("/api/reports/{report_id}/report.pdf")
def get_report_pdf(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    screening = _get_screening_by_report(db, report_id)
    _check_report_access(db, screening, current_user)
    pdf_path = settings.reports_dir / report_id / "report.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Report PDF has not been generated yet")
    return FileResponse(pdf_path, media_type="application/pdf")


@app.get("/api/reports/{report_id}/annotated.png")
def get_report_annotated_image(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    screening = _get_screening_by_report(db, report_id)
    _check_report_access(db, screening, current_user)
    image_path = settings.reports_dir / report_id / "annotated.png"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Annotated image has not been generated yet")
    return FileResponse(image_path, media_type="image/png")


@app.get("/api/reports/{report_id}/heatmap.png")
def get_report_heatmap_image(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    screening = _get_screening_by_report(db, report_id)
    _check_report_access(db, screening, current_user)
    image_path = settings.reports_dir / report_id / "heatmap.png"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Grad-CAM heatmap has not been generated yet")
    return FileResponse(image_path, media_type="image/png")


@app.get("/api/reports/{report_id}/audio")
def get_report_audio(
    report_id: str,
    lang: str = "hi",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_flexible),
):
    screening = _get_screening_by_report(db, report_id)
    _check_report_access(db, screening, current_user)
    if not screening.summary_text:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        audio_path = tts.get_or_create_audio(report_id, screening.summary_text, lang)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return FileResponse(audio_path, media_type="audio/mpeg")


# ============================================================================
# Review queue (ophthalmologist web dashboard)
# ============================================================================
@app.get("/api/queue", response_model=list[QueueItem])
def get_review_queue(
    db: Session = Depends(get_db),
    limit: int = 100,
    status: str = "pending",
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    """status='pending' (default) returns the prioritized review queue.
    status='reviewed' returns recently confirmed/overridden screenings --
    this is what powers the Review Queue's "Reviewed & Signed" tab and its
    signed-today count. These used to be indistinguishable to the frontend
    because this endpoint only ever returned pending items; once a case
    was reviewed it simply vanished from every view that read from here,
    with no way to see it again without a separate query."""
    if status not in ("pending", "reviewed"):
        raise HTTPException(status_code=400, detail="status must be 'pending' or 'reviewed'")

    def build_items(screenings: list[Screening], priority_fn) -> list[QueueItem]:
        items = []
        for s in screenings:
            patient = db.get(Patient, s.patient_id)
            summary = _screening_summary(s, patient.name if patient else None)
            lesion_bits = []
            if s.microaneurysm_count:
                lesion_bits.append(f"{s.microaneurysm_count} microaneurysms")
            if s.hemorrhage_count:
                lesion_bits.append(f"{s.hemorrhage_count} hemorrhages")
            if s.neovascularization_detected:
                lesion_bits.append("neovascularisation suspected")
            items.append(QueueItem(**summary.model_dump(), priority_score=priority_fn(s),
                                     lesion_summary=", ".join(lesion_bits) or None))
        return items

    if status == "reviewed":
        reviewed = (
            db.query(Screening)
            .filter(Screening.review_status.in_([ReviewStatus.CONFIRMED, ReviewStatus.OVERRIDDEN]))
            .order_by(Screening.reviewed_at.desc())
            .limit(limit)
            .all()
        )
        # Most-recently-reviewed first is the natural order here; no
        # urgency-based re-ranking needed since these are already resolved.
        return build_items(reviewed, priority_fn=lambda s: 0.0)

    pending = (
        db.query(Screening)
        .filter(Screening.review_status == ReviewStatus.PENDING)
        .order_by(Screening.created_at.asc())
        .limit(1000)
        .all()
    )

    def priority(s: Screening) -> float:
        level = s.icdr_level or 0
        conf = s.confidence if s.confidence is not None else 1.0
        return level * 10 + (1 - conf) * 5

    ranked = sorted(pending, key=priority, reverse=True)[:limit]
    return build_items(ranked, priority_fn=priority)


@app.post("/api/review/{screening_id}", response_model=ReviewResponse)
def submit_review(
    screening_id: str,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    screening = db.get(Screening, screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    if screening.review_status not in (ReviewStatus.PENDING,):
        raise HTTPException(status_code=409, detail=f"Screening is not pending review (status={screening.review_status.value})")

    if payload.decision == "override" and payload.overridden_icdr_level is None:
        raise HTTPException(status_code=400, detail="overridden_icdr_level is required when decision='override'")

    screening.review_status = ReviewStatus.CONFIRMED if payload.decision == "confirm" else ReviewStatus.OVERRIDDEN
    # The authenticated user is the reviewer of record -- not whatever the
    # client claims in the payload, which anyone could set to impersonate
    # someone else in the audit log now that this is a real auth boundary.
    screening.reviewer_id = current_user.username
    screening.reviewer_notes = payload.notes
    if payload.decision == "override":
        screening.overridden_icdr_level = payload.overridden_icdr_level
    screening.reviewed_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(screening)

    return ReviewResponse(
        screening_id=screening.id, review_status=screening.review_status.value,
        effective_icdr_level=screening.effective_icdr_level, reviewer_id=screening.reviewer_id,
        reviewed_at=screening.reviewed_at,
    )


# ============================================================================
# Analytics (admin/district dashboard)
# ============================================================================
@app.get("/api/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_screenings = db.query(func.count(Screening.id)).scalar() or 0
    total_graded = db.query(func.count(Screening.id)).filter(Screening.status == "graded").scalar() or 0
    total_rejected = db.query(func.count(Screening.id)).filter(Screening.status == "rejected").scalar() or 0
    total_referable = db.query(func.count(Screening.id)).filter(Screening.referable.is_(True)).scalar() or 0
    pending_review_count = db.query(func.count(Screening.id)).filter(Screening.review_status == ReviewStatus.PENDING).scalar() or 0
    review_required_count = db.query(func.count(Screening.id)).filter(Screening.requires_human_review.is_(True)).scalar() or 0
    avg_confidence = db.query(func.avg(Screening.confidence)).filter(Screening.status == "graded").scalar()

    reviewed = (
        db.query(Screening)
        .filter(Screening.reviewed_at.isnot(None), Screening.created_at.isnot(None))
        .all()
    )
    if reviewed:
        turnaround_hours = [(s.reviewed_at - s.created_at).total_seconds() / 3600.0 for s in reviewed]
        avg_turnaround = sum(turnaround_hours) / len(turnaround_hours)
    else:
        avg_turnaround = None

    dist = GradeDistribution()
    for level, field in enumerate(["no_dr", "mild_npdr", "moderate_npdr", "severe_npdr", "proliferative_dr"]):
        count = db.query(func.count(Screening.id)).filter(Screening.icdr_level == level).scalar() or 0
        setattr(dist, field, count)

    return AnalyticsSummary(
        total_patients=total_patients, total_screenings=total_screenings, total_graded=total_graded,
        total_rejected=total_rejected, total_referable=total_referable,
        referral_rate=(total_referable / total_graded) if total_graded else 0.0,
        review_rate=(review_required_count / total_graded) if total_graded else 0.0,
        pending_review_count=pending_review_count,
        avg_confidence=float(avg_confidence) if avg_confidence is not None else None,
        avg_review_turnaround_hours=avg_turnaround,
        grade_distribution=dist,
    )


@app.get("/api/analytics/trend", response_model=AnalyticsTrend)
def analytics_trend(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    since = dt.datetime.utcnow() - dt.timedelta(days=days)
    rows = db.query(Screening).filter(Screening.created_at >= since).all()

    by_day: dict[str, dict[str, int]] = {}
    for s in rows:
        day = s.created_at.date().isoformat()
        by_day.setdefault(day, {"screenings": 0, "referrals": 0})
        by_day[day]["screenings"] += 1
        if s.referable:
            by_day[day]["referrals"] += 1

    points = [TrendPoint(date=d, screenings=v["screenings"], referrals=v["referrals"])
              for d, v in sorted(by_day.items())]
    return AnalyticsTrend(days=days, points=points)


@app.get("/api/analytics/by-district", response_model=AnalyticsByDistrict)
def analytics_by_district(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    patients = db.query(Patient).filter(Patient.district.isnot(None)).all()
    by_district: dict[str, list[Screening]] = {}
    for patient in patients:
        by_district.setdefault(patient.district, []).extend(patient.screenings)

    breakdown = []
    for district, screenings in by_district.items():
        graded = [s for s in screenings if s.status == "graded"]
        referable_count = sum(1 for s in graded if s.referable)
        pending = sum(1 for s in screenings if s.review_status == ReviewStatus.PENDING)
        breakdown.append(DistrictBreakdown(
            district=district, total_screenings=len(screenings),
            referral_rate=(referable_count / len(graded)) if graded else 0.0,
            pending_review_count=pending,
        ))
    breakdown.sort(key=lambda d: -d.total_screenings)
    return AnalyticsByDistrict(districts=breakdown)


# ============================================================================
# Offline sync (Android app -- offline-first capture, deferred upload)
# ============================================================================
@app.post("/api/sync", response_model=SyncResponse)
async def sync_offline_batch(
    images: list[UploadFile] = File(...),
    local_ids: list[str] = Form(...),
    patient_ids: list[str] = Form(...),
    captured_ats: list[str] = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ASHA, UserRole.DOCTOR, UserRole.ADMIN)),
):
    if not (len(images) == len(local_ids) == len(patient_ids) == len(captured_ats)):
        raise HTTPException(status_code=400, detail="images, local_ids, patient_ids, and captured_ats must all be the same length")

    results: list[SyncItemResult] = []
    for image, local_id, patient_id, captured_at_str in zip(images, local_ids, patient_ids, captured_ats):
        try:
            patient = db.get(Patient, patient_id)
            if not patient:
                results.append(SyncItemResult(client_local_id=local_id, status="error",
                                                 error_message=f"Unknown patient_id '{patient_id}'"))
                continue

            tmp_path = settings.upload_tmp_dir / f"{uuid.uuid4().hex}_{image.filename}"
            with tmp_path.open("wb") as f:
                shutil.copyfileobj(image.file, f)
            try:
                result = matlab_bridge.run_screening_pipeline(str(tmp_path))
            finally:
                tmp_path.unlink(missing_ok=True)

            try:
                captured_at = dt.datetime.fromisoformat(captured_at_str)
            except ValueError:
                captured_at = None

            if result["status"] == "rejected":
                screening = Screening(
                    patient_id=patient_id, status="rejected", recapture_message=result["recapture_message"],
                    review_status=ReviewStatus.NOT_REQUIRED, client_local_id=local_id, captured_at=captured_at,
                )
                db.add(screening); db.commit(); db.refresh(screening)
                results.append(SyncItemResult(client_local_id=local_id, status="rejected", screening_id=screening.id))
                continue

            grading, lesions, report = result["grading"], result["lesions"], result["report"]
            review_status = ReviewStatus.PENDING if grading["requires_human_review"] else ReviewStatus.NOT_REQUIRED
            screening = Screening(
                patient_id=patient_id, status="graded",
                icdr_level=grading["icdr_level"], icdr_label=grading["icdr_label"],
                referable=grading["referable"], confidence=grading["confidence"],
                requires_human_review=grading["requires_human_review"],
                microaneurysm_count=lesions["microaneurysm_count"], hemorrhage_count=lesions["hemorrhage_count"],
                hard_exudate_area_pct=lesions["hard_exudate_area_pct"],
                soft_exudate_present=lesions["soft_exudate_present"],
                neovascularization_detected=lesions["neovascularization_detected"],
                report_id=report["report_id"], summary_text=report["summary_text"],
                processing_time_ms=result["processing_time_ms"], review_status=review_status,
                client_local_id=local_id, captured_at=captured_at,
            )
            db.add(screening); db.commit(); db.refresh(screening)
            results.append(SyncItemResult(
                client_local_id=local_id, status="graded", screening_id=screening.id,
                icdr_level=grading["icdr_level"], referable=grading["referable"],
            ))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Sync item %s failed", local_id)
            results.append(SyncItemResult(client_local_id=local_id, status="error", error_message=str(exc)))

    return SyncResponse(results=results)
