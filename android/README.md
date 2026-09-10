# DRISHTI — Field Worker Android App

**AI-assisted diabetic retinopathy screening for community health workers.**
Android client (SIH26038 · Team Veyronix) for ASHA/field workers to capture a retina
photo, get an on-the-spot AI grading, and hand the patient a native-language audio
explanation — no ophthalmologist required at the point of capture.

> This repo is the **ASHA/field-worker Android app** — one of three frontends against a
> shared FastAPI backend (the other two are ophthalmologist and district-admin web
> dashboards). See `docs/api_contract.md` for the full REST API this app talks to.

## Why

Diabetic retinopathy is a leading cause of preventable blindness, and screening for it
is bottlenecked on scarce ophthalmologists — especially in rural and semi-urban India.
DRISHTI puts an AI grading pipeline in the hands of ASHA workers already doing
door-to-door health visits: capture a fundus photo, get an instant ICDR grade and
referral recommendation, and let the patient hear their result explained in their own
language, even before a specialist sees the case.

## What this app does

- **Register or walk in a patient** — a short form, or skip straight to capture for a
  walk-in (the backend auto-creates a minimal record)
- **Guided retina capture** — OD/OS eye selection, on-screen alignment guide
- **Instant grading** — ICDR severity, referability, lesion counts, and a
  plain-language summary, right after upload
- **Native-language audio** — the diagnosis read aloud in the patient's preferred
  language (11 Indian languages supported)
- **Quality gate feedback** — a blurry or poorly-lit capture gets a specific,
  actionable retake message instead of a generic error
- **Offline-first** — captures queue locally and batch-sync when connectivity returns,
  with per-item retry on failure
- **Patient history** — repeat screenings per patient, most-recent-first

## Tech stack

- **Language**: Kotlin
- **Architecture**: MVVM + Repository pattern
- **UI**: XML layouts, Fragments, Jetpack Navigation Component, ViewBinding,
  Material Components
- **Networking**: Retrofit + Gson (see `data/network/model/` for the full set of
  request/response DTOs, generated from `docs/api_contract.md`)
- **Planned**: CameraX (guided capture), Room (offline queue), DataStore (settings),
  WorkManager (background sync retries) — see `DEPENDENCIES.md`

## Screen flow

```
Home ("Today's Patients" + Scan New Patient)
 ├─> Patient Registration (short form, or Skip for walk-in)
 │     └─> Capture (guided camera, OD/OS toggle)
 │           └─> Processing (loading)
 │                 ├─> Result – Graded (status badge, summary, Play Audio, View PDF)
 │                 └─> Result – Rejected (quality gate failed, recapture message)
 ├─> Patient History (tap a patient in the queue)
 │     └─> New Screening -> Capture (repeat screening)
 ├─> Sync Queue (tap the always-visible sync indicator)
 └─> Settings (language, facility, about)
```

## Getting started

1. Clone the repo and open it in Android Studio (Koala or newer recommended).
2. Add the dependencies in [`DEPENDENCIES.md`](DEPENDENCIES.md) to `app/build.gradle`
   if they aren't already present.
3. Point the app at your backend's base URL (see `docs/api_contract.md` — defaults to
   `http://localhost:8000` in dev) once the Retrofit service layer is wired in.
4. Build and run. Screens currently render with mock/sample data (matching the sample
   payloads in the API contract) so the full flow is clickable before the network layer
   is connected.

## Project structure

```
app/src/main/
  res/                      — layouts, the liquid-glass theme, drawables, nav_graph.xml
  java/com/veyronix/drishti/
    ui/                     — one package per screen (Fragment + layout pairing)
    ui/adapter/             — RecyclerView adapters
    model/                  — UI-layer mock/display models
    data/network/model/     — Retrofit/Gson request & response DTOs for every endpoint
                              in docs/api_contract.md
docs/
  api_contract.md           — the REST API this app (and the two web dashboards) consume
README.md                   — you are here
INTEGRATION.md              — theme system, integration steps, what's stubbed vs. real
DEPENDENCIES.md             — full app/build.gradle dependency list
```

## Status

UI and navigation are complete and clickable end-to-end with mock data. Network models
are written against the API contract. Retrofit service wiring, ViewModels, Room-backed
offline queue, and CameraX capture are in progress — see the `// TODO` comments
throughout `ui/*` for exactly where each piece plugs in, and `INTEGRATION.md` for the
full list of what's deliberately left out of this pass.

## Team

Veyronix — Smart India Hackathon 2026, problem statement SIH26038.

## License

TODO — add a license before making this repo public.
