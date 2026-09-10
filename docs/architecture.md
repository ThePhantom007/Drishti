# System Architecture

## High-level flow

```
ASHA Worker / Doctor / Admin (browser)
  |
  v
Frontend (drishti-frontend — React + Vite)
  |
  v
Backend API (drishti-backend — FastAPI gateway, python/gateway/)
  |
  +----> PostgreSQL (patients, screenings, users, review audit trail)
  |
  v
MATLAB + Python ML Pipeline (drishti-backend/matlab/, python/training/)
  |  Image Quality Gate -> Adaptive Enhancement -> Lesion Segmentation ->
  |  Dual-Path ICDR Grading (rule-based + trained EfficientNet-B3 ensemble)
  |  -> Grad-CAM Explainability -> Report + Multilingual Voice Read-out
  v
Screening Result (ICDR grade, referral decision, annotated image,
Grad-CAM heatmap, PDF report, native-language audio)
  |
  v
Frontend (Review Queue for doctors, Patient History, Program Analytics,
Simulink Capacity Model for administrators)
```

## Components

### Frontend (`drishti-frontend/`)

React + Vite single-page app. Role-gated after sign-in: ASHA field
workers see the screening capture flow and their own patient history;
doctors see the prioritized review queue, full patient history, and
model benchmarks; administrators see program-wide analytics and the
Simulink-based capacity planning tool. Talks to the backend exclusively
over the REST contract documented in
`drishti-backend/docs/api_contract.md`.

### Backend API (`drishti-backend/python/gateway/`)

FastAPI service. Owns:
- Authentication (registration/login, PBKDF2-HMAC-SHA256 password
  hashing, opaque bearer session tokens) and role-based access control,
  enforced on the endpoints themselves (not just hidden in the UI).
- Patient registration and the review workflow (pending → confirmed /
  overridden), including the dual-path rule-based-vs-trained-model
  disagreement signal.
- District-level analytics and report file serving (PDF, annotated
  image, Grad-CAM heatmap, generated audio).
- Bridging to the MATLAB pipeline (`matlab_bridge.py`) for real
  inference, with an automatic mock-inference fallback when MATLAB isn't
  available on the current machine (e.g. a cloud deployment).

### Machine Learning / MATLAB Pipeline (`drishti-backend/matlab/`, `python/training/`)

A hybrid MATLAB + Python pipeline: models are trained in PyTorch,
exported to ONNX, and imported into MATLAB (`importNetworkFromONNX`) for
inference and Grad-CAM generation alongside MATLAB's Image Processing
and Computer Vision Toolboxes. Six stages: image quality gating, adaptive
(CLAHE + Ben Graham) enhancement, classical-CV lesion segmentation,
dual-path ICDR severity grading, Grad-CAM explainability with
calibrated-confidence human review gating, and report/audio generation.
Validated on APTOS 2019 + IDRiD (training) and Messidor-2 (a fully
external benchmark never trained or tuned on) — see
`drishti-backend/README.md` and the in-app Benchmarks page for the actual
validation numbers.

### Database (PostgreSQL)

Stores patients, screenings (including both the rule-based and
learned-model grades, and the human reviewer's final decision), user
accounts, and session tokens. Every dashboard in the frontend — the
review queue, patient history, program analytics, and capacity model —
reads from this same database, so there's a single source of truth
rather than per-page mock data.

## For reviewers

This repository deviates from the plain `src/main.py` single-file layout
in the top-level template because it's a two-service project (a FastAPI
backend with its own ML pipeline, and a separate React frontend) rather
than a single script — the template's own "Repository Structure" section
explicitly allows keeping "your normal project folders" instead of
forcing everything into `src/`. See the root `README.md` for exact
install/run instructions for both services, and
`drishti-backend/docs/api_contract.md` for the full REST API reference.
