"""Pydantic models mirroring docs/api_contract.md exactly — keep these two
in sync; this file is the enforceable version of that doc."""
from __future__ import annotations

import datetime as dt
from typing import Literal, Optional

from pydantic import BaseModel, Field


class QualityInfo(BaseModel):
    adequate: bool
    sharpness_score: float
    illumination_score: float
    field_of_view_score: float
    issues: list[str] = []


class GradingInfo(BaseModel):
    icdr_level: int
    icdr_label: str
    referable: bool
    confidence: float
    requires_human_review: bool


class GradingPaths(BaseModel):
    """Dual-path grading: the interpretable rule-based ICDR ('4-2-1') estimate
    run alongside the trained model, kept separate so a disagreement between
    the two is a visible review signal rather than silently discarded."""
    rule_based_level: int
    rule_based_label: str
    learned_level: int
    learned_label: str
    disagreement: bool


class LesionInfo(BaseModel):
    microaneurysm_count: int
    hemorrhage_count: int
    hard_exudate_area_pct: float
    soft_exudate_present: bool
    neovascularization_detected: bool


class ExplainabilityInfo(BaseModel):
    gradcam_image_url: str
    annotated_image_url: str
    original_image_url: Optional[str] = None  # None if the original photo wasn't persisted (e.g. an old row)


class ReportInfo(BaseModel):
    report_id: str
    pdf_url: str
    audio_url: Optional[str] = None  # None until first requested (audio is generated on demand)
    summary_text: str
    language: str = "en"


class ScreeningResponse(BaseModel):
    status: Literal["graded"]
    screening_id: str
    patient_id: Optional[str] = None
    quality: QualityInfo
    grading: GradingInfo
    grading_paths: Optional[GradingPaths] = None
    lesions: LesionInfo
    explainability: ExplainabilityInfo
    report: ReportInfo
    processing_time_ms: int


class RejectedResponse(BaseModel):
    status: Literal["rejected"]
    screening_id: Optional[str] = None
    quality: QualityInfo
    recapture_message: str


class ErrorResponse(BaseModel):
    status: Literal["error"]
    error_code: str
    message: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_version: str


# ============================================================================
# Patients
# ============================================================================
class PatientCreate(BaseModel):
    name: Optional[str] = None
    external_id: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: str = "en"
    facility_id: Optional[str] = None
    district: Optional[str] = None
    registered_by: Optional[str] = None
    # Self-reported, captured once -- diabetes_duration is then computed
    # fresh from diabetes_diagnosed_year wherever it's displayed (see
    # PatientOut.diabetes_duration_label / ClinicalDataOut.diabetes_duration)
    # rather than stored as a string that immediately starts going stale.
    diabetes_type: Optional[str] = None
    diabetes_diagnosed_year: Optional[int] = Field(None, ge=1900, le=2100)


class PatientUpdate(BaseModel):
    """PATCH /api/patients/{patient_id} -- every field optional, and only
    the fields actually present in the request body get changed (see
    `exclude_unset` on the route). Lets the ASHA/doctor correct a
    demographic that was wrong or incomplete at registration, instead of
    the record being stuck with whatever was typed in the first time."""
    name: Optional[str] = None
    external_id: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    sex: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None
    facility_id: Optional[str] = None
    district: Optional[str] = None
    diabetes_type: Optional[str] = None
    diabetes_diagnosed_year: Optional[int] = Field(None, ge=1900, le=2100)


class PatientOut(BaseModel):
    id: str
    name: Optional[str]
    external_id: Optional[str]
    age: Optional[int]
    sex: Optional[str]
    phone: Optional[str]
    preferred_language: str
    facility_id: Optional[str]
    district: Optional[str]
    registered_by: Optional[str]
    diabetes_type: Optional[str] = None
    diabetes_diagnosed_year: Optional[int] = None
    # Computed, not stored -- see _diabetes_duration_label in main.py.
    diabetes_duration_years: Optional[int] = None
    diabetes_duration_label: Optional[str] = None
    created_at: dt.datetime
    screening_count: int = 0

    class Config:
        from_attributes = True


class ClinicalVitalsUpdate(BaseModel):
    """PATCH /api/screenings/{screening_id}/vitals payload. All optional --
    only the fields present get changed -- so a doctor filling in HbA1c
    alone during review doesn't clobber a blood pressure reading someone
    else already entered."""
    hba1c_pct: Optional[float] = Field(None, ge=0, le=20)
    bp_systolic: Optional[int] = Field(None, ge=0, le=300)
    bp_diastolic: Optional[int] = Field(None, ge=0, le=200)


class ClinicalDataOut(BaseModel):
    """Display-ready clinical vitals for a screening -- pre-formatted
    ('8.4%', '135/85 mmHg') to match what the frontend already renders,
    but now backed by real per-screening values instead of a hardcoded
    fallback string baked into the component."""
    hba1c: Optional[str] = None
    hba1c_pct: Optional[float] = None
    blood_pressure: Optional[str] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    # e.g. "Type 2 (14 yrs)" -- computed from the patient's
    # diabetes_diagnosed_year at read time (see _diabetes_duration_label),
    # not stored as a frozen string.
    diabetes_duration: Optional[str] = None


class ScreeningSummary(BaseModel):
    """A lighter-weight screening representation for lists (patient history,
    review queue) -- the full ScreeningResponse is for a single fresh result."""
    screening_id: str
    patient_id: str
    patient_name: Optional[str] = None
    # Demographics/vitals below are read from the linked Patient/Screening
    # rows (see main._screening_summary) -- previously absent from this
    # model entirely, which is *why* the review queue and case detail view
    # always showed the same hardcoded placeholder age/date/HbA1c/BP no
    # matter which patient was actually selected: the real values never
    # made it into the API response for the frontend to display.
    age: Optional[int] = None
    sex: Optional[str] = None
    district: Optional[str] = None
    date: Optional[str] = None  # ISO date (YYYY-MM-DD) the screening was taken
    clinical_data: Optional[ClinicalDataOut] = None
    eye: Optional[str] = None
    status: str
    icdr_level: Optional[int] = None
    icdr_label: Optional[str] = None
    effective_icdr_level: Optional[int] = None
    referable: Optional[bool] = None
    confidence: Optional[float] = None
    requires_human_review: bool = False
    review_status: str
    grading_paths: Optional[GradingPaths] = None
    microaneurysm_count: Optional[int] = None
    hemorrhage_count: Optional[int] = None
    hard_exudate_area_pct: Optional[float] = None
    soft_exudate_present: Optional[bool] = None
    neovascularization_detected: Optional[bool] = None
    created_at: dt.datetime
    reviewed_at: Optional[dt.datetime] = None
    reviewer_id: Optional[str] = None
    pdf_url: Optional[str] = None
    annotated_image_url: Optional[str] = None
    gradcam_image_url: Optional[str] = None
    original_image_url: Optional[str] = None


class PatientDetail(PatientOut):
    screenings: list[ScreeningSummary] = []


class PatientList(BaseModel):
    patients: list[PatientOut]


# ============================================================================
# Review queue (ophthalmologist web dashboard)
# ============================================================================
class QueueItem(ScreeningSummary):
    priority_score: float
    lesion_summary: Optional[str] = None


class ReviewRequest(BaseModel):
    reviewer_id: str
    decision: Literal["confirm", "override"]
    overridden_icdr_level: Optional[int] = Field(
        None, ge=0, le=4, description="Required when decision='override'."
    )
    notes: Optional[str] = None


class ReviewResponse(BaseModel):
    screening_id: str
    review_status: str
    effective_icdr_level: int
    reviewer_id: str
    reviewed_at: dt.datetime


# ============================================================================
# Analytics (admin/district dashboard)
# ============================================================================
class GradeDistribution(BaseModel):
    no_dr: int = 0
    mild_npdr: int = 0
    moderate_npdr: int = 0
    severe_npdr: int = 0
    proliferative_dr: int = 0


class AnalyticsSummary(BaseModel):
    total_patients: int
    total_screenings: int
    total_graded: int
    total_rejected: int
    total_referable: int
    referral_rate: float
    review_rate: float              # fraction of graded screenings that required human review
    pending_review_count: int
    avg_confidence: Optional[float]
    avg_review_turnaround_hours: Optional[float]
    grade_distribution: GradeDistribution


class TrendPoint(BaseModel):
    date: str  # ISO date, e.g. "2026-09-01"
    screenings: int
    referrals: int


class AnalyticsTrend(BaseModel):
    days: int
    points: list[TrendPoint]


class DistrictBreakdown(BaseModel):
    district: str
    total_screenings: int
    referral_rate: float
    pending_review_count: int


class AnalyticsByDistrict(BaseModel):
    districts: list[DistrictBreakdown]


# ============================================================================
# Offline sync (Android app)
# ============================================================================
class SyncItemResult(BaseModel):
    client_local_id: str
    status: Literal["graded", "rejected", "error"]
    screening_id: Optional[str] = None
    icdr_level: Optional[int] = None
    referable: Optional[bool] = None
    error_message: Optional[str] = None


class SyncResponse(BaseModel):
    results: list[SyncItemResult]



# --- Authentication -----------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=1)
    role: Literal["doctor", "admin", "asha"]
    facility_id: Optional[str] = None
    district: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    full_name: Optional[str]
    role: str
    facility_id: Optional[str]
    district: Optional[str]
    created_at: dt.datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# --- Notifications -------------------------------------------------------

class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    desc: str
    time: str  # human-relative ("12 mins ago"), computed at request time
    patient_id: Optional[str] = None
    case_id: Optional[str] = None
    read: bool


class NotificationList(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
