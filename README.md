<div align="center">

# DRISHTI
### Explainable AI Diabetic Retinopathy Screening for Rural India

**Smart India Hackathon 2026 · Problem Statement SIH26038 · Team Veyronix**

[![Live Demo](https://img.shields.io/badge/demo-live-2ea44f)](https://drishti-frontend-c9mj.onrender.com/)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![Category](https://img.shields.io/badge/category-Software-informational)
![Theme](https://img.shields.io/badge/theme-MedTech%20%2F%20BioTech%20%2F%20HealthTech-red)

[Live App](https://drishti-frontend-c9mj.onrender.com/) ·
[Presentation](submission/Veyronix_SIH26038_DRISHTI_PPT.pdf) ·
[Demo Video](https://drive.google.com/file/d/1fnFgtoWxl9rME_tax4MdIlPC4LXKwcv0/view?usp=sharing) ·
[Architecture](docs/architecture.md)

</div>

---

A single ophthalmologist can safely oversee diabetic retinopathy screening
for **100,000+ patients a year** — not by working faster, but because
DRISHTI's dual-path AI pipeline clears the confident cases automatically,
explains every grade with lesion-level visual evidence, and routes only
the genuinely uncertain or referable cases to a human. An ASHA worker
captures a fundus photo at a rural PHC — from a native Android app or the
web portal — and gets a graded, explained result back in seconds; the
ophthalmologist reviewer sees only what needs their judgment.

## The Problem

India has an estimated **101 million people living with diabetes**
(ICMR-INDIAB, 2023). Roughly **12.5% develop diabetic retinopathy** —
about 12.6 million people — and **4.0%** (~4 million) have
vision-threatening DR (SMART-India study, *Lancet Global Health*, 2022).
DR is a leading *preventable* cause of blindness, and the failure point
isn't disease incidence — it's screening capacity. Ophthalmologists
capable of grading a fundus photo are concentrated in urban centers, far
from the rural PHCs where most at-risk patients actually live and where
annual screening would need to happen.

## The Solution

DRISHTI is a MATLAB + Python hybrid remote screening pipeline built around
one idea: **AI should triage, not diagnose alone.**

A fundus photo goes through six stages — image quality gating → adaptive
enhancement → lesion segmentation → dual-path ICDR severity grading →
Grad-CAM explainability → report and voice generation — and comes out the
other end as either an automatically cleared result or a case flagged for
tele-review, never a silent AI-only diagnosis on a borderline finding.

Grading is **dual-path by design**: an interpretable, rule-based ICDR
("4-2-1") estimate runs alongside a trained deep-learning ensemble, and
when the two disagree, that disagreement is surfaced as a visible review
signal rather than quietly resolved in the background.

## Key Features

- **Quality gating with actionable feedback** — blurry, dark, or
  off-target captures are rejected at the point of capture with a
  specific reason, not silently mis-graded
- **Dual-path ICDR grading** — rule-based and trained-model estimates
  cross-check each other; disagreement is a review signal, not hidden
- **Grad-CAM explainability + calibrated confidence** — every grade ships
  with the visual evidence behind it, and low-confidence cases are gated
  into mandatory human review rather than returned as-is
- **Prioritized ophthalmologist review queue** — severity- and
  confidence-sorted, with one-click confirm/override, real-time
  notifications on new referable cases, and a full audit trail of who
  reviewed what
- **Longitudinal patient history** — repeat-screening trajectory tracking
  across visits, not just a single point-in-time result
- **Three fully gated roles** — ASHA field worker, ophthalmologist, and
  program administrator, each restricted to their own tabs and data,
  enforced on both the frontend and the backend API
- **District-level program analytics** and a Simulink-based capacity
  model for planning district-scale rollout
- **Voice read-out in 23 languages** — all 22 languages of the Eighth
  Schedule to the Constitution, plus English — for ASHA-led communication
  with patients who may not read the language of the report
- **Native Android app** for ASHA field workers, mirroring the full
  capture-and-screen workflow with offline-first capture/sync and push
  notifications
- **Validated on Messidor-2** — a fully external benchmark never trained
  or tuned on — with the real numbers reported in-app, including where
  the target metric isn't yet met

## Built for Three Different Users

| | ASHA / Field Worker | Ophthalmologist | District Admin |
|---|---|---|---|
| **Surface** | Native Android app + mobile-first web portal | Web review studio | Web dashboard |
| **Does** | Guided fundus capture, one-handed patient registration, offline queue with sync-on-connect | Reviews a severity/confidence-sorted queue, confirms or overrides AI grades against Grad-CAM evidence | Monitors district KPIs and plans reviewer/bandwidth capacity |
| **Gets** | Native-language diagnosis + care audio, push notifications | Full patient history, one-click audit trail | Trend charts, Simulink-recommended staffing vs. actual load |

## How It Works

```text
ASHA Worker (Android app / web)         Doctor / Admin (web)
              |                                  |
              v                                  v
                   Backend API (FastAPI)
                            |
                            +----> PostgreSQL
                            |
                            v
                MATLAB + Python ML Pipeline
                            |
                            v
      Screening result: grade · referral · heatmap · report · audio
```

Full technical breakdown: [docs/architecture.md](docs/architecture.md).

## Validation

The classical computer-vision pipeline (quality gating, enhancement,
lesion segmentation, rule-based ICDR) runs end-to-end with no trained
model required. The trained severity classifier is evaluated on
Messidor-2 — a benchmark completely untouched during training.

**Getting from a baseline model to a deployable one** (referable-DR
sensitivity on Messidor-2, target ≥ 0.90):

| Iteration | Referable-DR sensitivity |
|---|---|
| Baseline model | 0.50 |
| + Ben Graham color normalisation, + IDRiD data | 0.62 |
| + Weighted ensemble (final) | **0.74** |

**Final deployed model** — a weighted ensemble of three independently
seeded checkpoints (I07 · 0.376, K10 · 0.086, K11 · 0.538):

| Metric | Value |
|---|---|
| Sensitivity / Specificity | 0.7352 / 0.8508 |
| Quadratic Weighted Kappa | 0.5509 |
| Effective sensitivity (AI + mandatory human review) | **0.8928** — near target |
| Review rate at 100,000 patients/year | 43.6% → ~73% reviewer utilization |

**Risks we tested for, and how they're addressed:**

| Risk | Why it matters | Mitigation |
|---|---|---|
| Cross-camera domain shift | Confirmed via external Messidor-2 testing | Ben Graham color normalisation + multi-source (APTOS + IDRiD) training |
| Rare-class (severe/PDR) data scarcity | Causes unstable, biased predictions | Class-weighted sampling + ordinal-aware loss + seed/checkpoint selection |
| Silent misdiagnosis | Any AI-alone system can be confidently wrong | Calibrated confidence gates mandatory human review — never a silent miss |
| District rollout planning | Unknown staffing/bandwidth needs | Simulink capacity model sizes reviewers & bandwidth for target volume |
| Field-worker adoption & digital literacy | ASHA workers need a genuinely one-handed tool | Android app + web portal with native-language read-outs |

## Impact

- **Social** — early detection of preventable blindness for the
  populations with the least specialist access; native-language voice
  read-out removes the literacy/language barrier for ASHA-led delivery;
  turns ASHA workers and rural PHCs into real screening points.
- **Economic** — frees scarce ophthalmologist time for genuinely
  referable cases only, via automatic triage; avoids the costlier
  late-stage treatment and lost productivity that comes from preventable
  blindness; the Simulink capacity model lets a district right-size
  staffing and bandwidth investment instead of guessing.
- **Environmental** — fewer screening-only trips to distant clinics;
  reduces load on already overstretched public hospital infrastructure;
  deployable on existing smartphones and low-cost fundus-lens hardware,
  with no new infrastructure required.

## Tech Stack

| Layer | Technology |
|---|---|
| ASHA Android app | Kotlin, offline-first capture & sync, native-language voice |
| Web frontend | React, Vite |
| Backend | Python, FastAPI |
| Machine learning | PyTorch + timm (EfficientNet-B3) trained and exported to ONNX, imported into MATLAB for inference and Grad-CAM |
| Classical pipeline & modeling | MATLAB (Image Processing, Computer Vision, Deep Learning Toolboxes), Simulink |
| Database | PostgreSQL |
| Deployment | Render (backend + web frontend), Neon (PostgreSQL), UptimeRobot |

## Screenshots

![login.png](assets/screenshots/login.png)
![screening-portal.png](assets/screenshots/screening-portal.png)
![case-detail.png](assets/screenshots/case-detail.png)
![review-queue.png](assets/screenshots/review-queue.png)
![patient-history.png](assets/screenshots/patient-history.png)
![admin-dashboard.png](assets/screenshots/admin-dashboard.png)
![capacity-planner.png](assets/screenshots/capacity-planner.png)
![benchmarks.png](assets/screenshots/benchmarks.png)

## Getting Started

Three components, each installed independently.

**Backend**
```bash
git clone <YOUR_REPOSITORY_URL>
cd DRISHTI/drishti-backend/python/gateway
pip install -r ../requirements-gateway.txt   # or requirements-deploy.txt to skip the MATLAB dependency
```
Set `DATABASE_URL` to a PostgreSQL connection string (see
`docs/DEPLOYMENT.md` for a free Neon instance), then:
```bash
uvicorn main:app --reload
```
Seed three demo accounts and demo patients, from `drishti-backend/`:
```bash
python scripts/seed_demo_patients.py
```
Sign in with `dr_sharma` / `admin_deshmukh` / `asha_worker_17`, password
`Demo@123` for all three.

**Web frontend**
```bash
cd DRISHTI/drishti-frontend
npm install
npm run dev
```
Set `VITE_API_BASE_URL` in `.env` if the backend isn't on
`http://localhost:8000`.

## Repository Structure

```text
DRISHTI/
├── android/                # Native Android app for ASHA field workers
├── assets/screenshots/
├── docs/                   # architecture, deployment
├── drishti-backend/        # FastAPI gateway + MATLAB/Python ML pipeline
│   ├── python/gateway/     # REST API, auth, database models
│   ├── matlab/             # 6-stage screening pipeline
├── drishti-frontend/       # React + Vite web app
├── submission/             # presentation
├── render.yaml
├── requirements.txt
└── LICENSE
```

## Research and References

| Category | Detail | Source |
|---|---|---|
| Dataset | APTOS 2019 Blindness Detection | Kaggle — primary training set (~3,662 graded fundus images) |
| Dataset | IDRiD (Indian Diabetic Retinopathy Image Dataset) | idrid.grand-challenge.org — segmentation masks + grading, Indian population |
| Dataset | Messidor-2 + adjudicated grades | ADCIS (images) + Kaggle google-brain/messidor2-dr-grades (Krause et al.) — external validation |
| Method | ICDR Severity Scale | Wilkinson et al., *Ophthalmology*, 2003 |
| Method | Confidence calibration | Guo et al., "On Calibration of Modern Neural Networks," ICML 2017 |
| Method | Cross-camera color normalisation | Graham, B., Kaggle DR Detection — winning solution, 2015 |
| Public health | 101M Indians living with diabetes | Anjana et al., ICMR-INDIAB, *Lancet Diabetes & Endocrinology*, 2023 |
| Public health | 12.5% DR / 4.0% vision-threatening DR prevalence | SMART-India study, *Lancet Global Health*, 2022 |
| Feasibility | Smartphone fundus imaging validation | Wintergerst et al., *Ophthalmology*, 2020 |

## What's Next

- Persistent object storage (e.g. Cloudflare R2) for generated report
  files, so they survive a redeploy on ephemeral hosting the way
  patient/screening data already does via PostgreSQL
- A capacity-planning API endpoint backed by the real Simulink model
  parameters, replacing the current simplified client-side estimate
- Signed, expiring URLs for report files, for stronger access control on
  shared links

## License

APACHE 2.0 — see [LICENSE](LICENSE).

---

<div align="center">Team Veyronix · NSUT012 · Smart India Hackathon 2026</div>