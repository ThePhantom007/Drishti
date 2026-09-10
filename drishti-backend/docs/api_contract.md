# REST API Contract — DRISHTI Screening Backend

Hand this to the web and Android teammates. Base URL during dev: `http://localhost:8000`.
Interactive docs (auto-generated from the actual code, always up to date): `http://localhost:8000/docs`.

This backend now supports three distinct frontend surfaces, all against the same API:
- **ASHA/field-worker app (Android)**: capture, offline sync, native-language audio
- **Ophthalmologist review dashboard (Web)**: prioritized queue, confirm/override
- **District/program admin dashboard (Web)**: aggregate analytics

---

## Patients

### POST /api/patients
Register a patient. All fields optional except nothing is strictly required — a walk-in
screening with no prior registration is also supported (see `/api/screen` below).

**Request** (`application/json`)
```json
{
  "name": "Ramesh Kumar",
  "external_id": "ASHA-REG-00231",
  "age": 54,
  "sex": "M",
  "phone": "9876543210",
  "preferred_language": "hi",
  "facility_id": "PHC-NAN-014",
  "district": "Nanded",
  "registered_by": "asha_worker_17"
}
```

**Response 200**
```json
{
  "id": "9f1c2a...", "name": "Ramesh Kumar", "external_id": "ASHA-REG-00231",
  "age": 54, "sex": "M", "phone": "9876543210", "preferred_language": "hi",
  "facility_id": "PHC-NAN-014", "district": "Nanded", "registered_by": "asha_worker_17",
  "created_at": "2026-09-02T10:15:00", "screening_count": 0
}
```

### GET /api/patients/{patient_id}
Full patient record plus their complete screening history (for the "repeat screening
trends" view on both platforms). `screenings` is ordered most-recent-first.

### GET /api/patients/{patient_id}/screenings
Just the screening history list (lighter payload than the full patient detail call).

---

## Screening (core pipeline)

### POST /api/screen
**Request**: `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | file (jpeg/png) | yes | Fundus photograph |
| `patient_id` | string | no | If omitted, a minimal walk-in patient record is auto-created |
| `eye` | string | no | `"OD"` (right) or `"OS"` (left) |
| `language` | string | no | ISO code (see supported list below). Defaults to the patient's `preferred_language`, or `"en"`. If not `"en"`, audio is generated synchronously and `report.audio_url` is populated immediately. |

**Response 200 — graded**
```json
{
  "status": "graded",
  "screening_id": "a1b2c3...",
  "patient_id": "9f1c2a...",
  "quality": { "adequate": true, "sharpness_score": 0.82, "illumination_score": 0.91, "field_of_view_score": 0.95, "issues": [] },
  "grading": { "icdr_level": 2, "icdr_label": "Moderate NPDR", "referable": true, "confidence": 0.88, "requires_human_review": false },
  "lesions": { "microaneurysm_count": 14, "hemorrhage_count": 3, "hard_exudate_area_pct": 1.2, "soft_exudate_present": false, "neovascularization_detected": false },
  "explainability": { "gradcam_image_url": "/api/reports/abc123/heatmap.png", "annotated_image_url": "/api/reports/abc123/annotated.png" },
  "report": {
    "report_id": "abc123",
    "pdf_url": "/api/reports/abc123/report.pdf",
    "audio_url": "/api/reports/abc123/audio?lang=hi",
    "summary_text": "Moderate NPDR detected (ICDR level 2). Referable — recommend ophthalmologist follow-up within 3 months.",
    "language": "hi"
  },
  "processing_time_ms": 1840
}
```

**Response 200 — rejected (quality gate failed)**
```json
{
  "status": "rejected",
  "screening_id": "a1b2c3...",
  "quality": { "adequate": false, "sharpness_score": 0.31, "illumination_score": 0.88, "field_of_view_score": 0.90, "issues": ["image_too_blurry"] },
  "recapture_message": "Image is out of focus. Please hold the camera steady and retake."
}
```

`requires_human_review == true` means the UI should show "Pending specialist review" rather
than a final grade badge — treat `icdr_level` as provisional in that case, not final.

### GET /api/reports/{report_id}/report.pdf
Full PDF download. **Identical on both platforms** — no "view only" restriction at the
backend; Android can download and hand it to its own share/print intent just as freely as
the web dashboard can offer a direct download link.

### GET /api/reports/{report_id}/audio?lang=hi
Native-language voice read-out (MP3) of the diagnosis and care instructions — the ASHA
worker's primary use case, and available identically to the web dashboard as a secondary
use case (e.g. a reviewer double-checking what the patient was told). Generated on first
request per (report, language) and cached after that.

**Supported `lang` codes**: `en` (English), `hi` (Hindi), `bn` (Bengali), `ta` (Tamil),
`te` (Telugu), `mr` (Marathi), `gu` (Gujarati), `kn` (Kannada), `ml` (Malayalam),
`pa` (Punjabi), `ur` (Urdu).

**Response**: `audio/mpeg` binary, or a JSON error (400 unsupported language, 503 if the
translation/TTS service isn't installed/reachable, 404 if the report doesn't exist).

---

## Review Queue (ophthalmologist web dashboard)

### GET /api/queue?limit=100
Returns cases with `review_status == "pending"` — i.e. only cases the pipeline's calibrated
confidence flagged as needing a human, never the full screening list. **Sorted by priority,
not chronologically**: severity first, then low confidence, with oldest-first as a
tiebreaker. Each item includes a `priority_score` (for the frontend to show visually, e.g.
color-coding) and a `lesion_summary` one-liner for a fast scan of the queue.

```json
[
  {
    "screening_id": "a1b2c3...", "patient_id": "9f1c2a...", "patient_name": "Ramesh Kumar",
    "icdr_level": 3, "icdr_label": "Severe NPDR", "confidence": 0.61,
    "requires_human_review": true, "review_status": "pending",
    "priority_score": 31.95, "lesion_summary": "22 microaneurysms, 8 hemorrhages",
    "pdf_url": "...", "annotated_image_url": "...", "gradcam_image_url": "..."
  }
]
```

### POST /api/review/{screening_id}
The reviewer's confirm/override action — this is what actually resolves a pending case.

**Request**
```json
{ "reviewer_id": "dr_sharma", "decision": "override", "overridden_icdr_level": 2, "notes": "Borderline; grading as moderate on review." }
```
`decision` is `"confirm"` or `"override"`. `overridden_icdr_level` (0–4) is required only for
`"override"`. Returns 409 if the screening isn't currently pending (e.g. already reviewed).

**Response 200**
```json
{ "screening_id": "a1b2c3...", "review_status": "overridden", "effective_icdr_level": 2, "reviewer_id": "dr_sharma", "reviewed_at": "2026-09-02T11:02:10" }
```
Always read `effective_icdr_level` (not `icdr_level`) when displaying a reviewed case's
grade anywhere in the app — it correctly reflects an override, `icdr_level` does not change.

---

## Analytics (district/program admin dashboard)

### GET /api/analytics/summary
Top-line KPIs for a dashboard header.
```json
{
  "total_patients": 1240, "total_screenings": 1580, "total_graded": 1490, "total_rejected": 90,
  "total_referable": 310, "referral_rate": 0.208, "review_rate": 0.155, "pending_review_count": 12,
  "avg_confidence": 0.84, "avg_review_turnaround_hours": 6.4,
  "grade_distribution": { "no_dr": 1180, "mild_npdr": 210, "moderate_npdr": 70, "severe_npdr": 22, "proliferative_dr": 8 }
}
```

### GET /api/analytics/trend?days=30
Daily screening/referral counts for a trend chart.
```json
{ "days": 30, "points": [ { "date": "2026-08-15", "screenings": 42, "referrals": 9 }, ... ] }
```

### GET /api/analytics/by-district
Per-district breakdown (requires patients to have `district` set at registration) — feeds
the geographic coverage view, and pairs with the Simulink capacity model's staffing
recommendation for a "current load vs. recommended capacity" indicator.
```json
{ "districts": [ { "district": "Nanded", "total_screenings": 340, "referral_rate": 0.19, "pending_review_count": 4 }, ... ] }
```

---

## Offline Sync (Android app — offline-first capture)

### POST /api/sync
Batch-uploads screenings captured while offline. `multipart/form-data` with four
same-length, matching-order lists:

| Field | Type | Notes |
|---|---|---|
| `images` | file[] | One per queued capture |
| `local_ids` | string[] | The app's own offline-queue IDs, echoed back so the app can reconcile |
| `patient_ids` | string[] | Must already exist (register patients before/while offline, sync those too if needed) |
| `captured_ats` | string[] | ISO 8601 timestamp of actual capture time (distinct from server receipt time) |

Each item is processed independently — one corrupt image doesn't fail the whole batch.

**Response 200**
```json
{ "results": [
  { "client_local_id": "local_042", "status": "graded", "screening_id": "a1b2c3...", "icdr_level": 1, "referable": false },
  { "client_local_id": "local_043", "status": "error", "error_message": "Unknown patient_id 'xyz'" }
] }
```
Match `client_local_id` back to your local queue to mark each item synced/failed.

---

## GET /api/health
`{"status": "ok", "model_version": "..."}` — use for app startup connectivity checks.

## Error shape (all endpoints)
```json
{ "status": "error", "error_code": "...", "message": "..." }
```

## Notes for both frontends
- The backend's production database is PostgreSQL, configured via the
  `DATABASE_URL` environment variable; nothing about the API changes based
  on which database is behind it.
- `requires_human_review` and `review_status` are the two fields that drive every
  "pending/needs review" UI state — don't infer review status from `confidence` directly in
  the frontend, the backend's calibrated threshold is the source of truth.
- The native-language audio feature needs `gTTS` + `deep-translator` installed and internet
  access on the server (see `python/requirements-gateway.txt`) — treat a 503 from the audio
  endpoint as "feature temporarily unavailable," not a hard error, since both underlying
  services are free/best-effort, not paid guaranteed-uptime APIs.
