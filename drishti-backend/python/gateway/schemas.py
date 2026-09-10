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
    created_at: dt.datetime
    screening_count: int = 0

    class Config:
        from_attributes = True


class ScreeningSummary(BaseModel):
    """A lighter-weight screening representation for lists (patient history,
    review queue) -- the full ScreeningResponse is for a single fresh result."""
    screening_id: str
    patient_id: str
    patient_name: Optional[str] = None
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
