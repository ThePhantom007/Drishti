# drishti-backend — SIH26038 (Backend / ML / MATLAB portion)

Automated Diabetic Retinopathy screening pipeline: image QA/enhancement → structure
segmentation → severity grading → explainability → REST API → Simulink capacity model.

This repo covers **only the non-frontend, non-Android portion** of the SIH submission:
MATLAB image-processing/DL pipeline, the Python model-training + ONNX export code,
the FastAPI gateway that exposes it as a REST service, and the Simulink resource-allocation
model. The website and Kotlin Android app consume this service over the HTTP contract
defined in `docs/api_contract.md` and are built/maintained separately by the rest of the team.

## Architecture

```
Fundus image (upload)
        │
        ▼
┌─────────────────────────┐
│  FastAPI Gateway (Py)   │  python/gateway/  — REST endpoint, validation, orchestration
└───────────┬──────────────┘
            │  MATLAB Engine API
            ▼
┌─────────────────────────┐
│   MATLAB Pipeline        │  matlab/pipeline/ — QA, enhancement, segmentation,
│                          │  grading, Grad-CAM, report generation
└───────────┬──────────────┘
            │  imports trained models
            ▼
┌─────────────────────────┐
│ Python training + ONNX  │  python/training/ — train in PyTorch, export ONNX,
│                          │  MATLAB imports via importNetworkFromPyTorch/ONNX
└──────────────────────────┘

Separately: matlab/simulink/ — discrete-event capacity model for district-level
screening throughput (patients/day vs. reviewer capacity vs. bandwidth).
```

## File tree

```
drishti-backend/
├── README.md
├── config/
│   └── pipeline_config.yaml        # thresholds, paths, toolbox flags
├── data/
│   └── README.md                   # dataset setup: APTOS 2019 / IDRiD / Messidor-2
├── docs/
│   ├── architecture.md
│   └── api_contract.md             # REST schema — hand this to web/Android teammates
├── matlab/
│   ├── startup.m
│   ├── pipeline/
│   │   ├── runScreeningPipeline.m      # orchestrator, calls all modules in order
│   │   ├── assessImageQuality.m        # Module 1a — focus/illumination/FOV check
│   │   ├── enhanceImage.m              # Module 1b — CLAHE, illum norm, denoise
│   │   ├── segmentOpticDiscFovea.m     # Module 2a
│   │   ├── segmentVessels.m            # Module 2b
│   │   ├── detectMicroaneurysms.m      # Module 2c
│   │   ├── segmentExudates.m           # Module 2d
│   │   ├── classifyHemorrhages.m       # Module 2e
│   │   ├── detectNeovascularization.m  # Module 2f
│   │   ├── gradeDRSeverity.m           # Module 3 — ICDR 0-4 grading
│   │   ├── generateGradCAM.m           # Module 4a — explainability heatmap
│   │   ├── calibrateConfidence.m       # Module 4b — Platt-scaled confidence
│   │   └── generateReport.m            # Module 4c — annotated PDF/JSON report
│   ├── models/
│   │   └── importPyTorchModel.m        # ONNX -> MATLAB dlnetwork import helper
│   ├── simulink/
│   │   ├── buildCapacityModel.m        # programmatically builds the .slx model
│   │   └── runCapacitySweep.m          # parameter sweep -> optimal staffing/bandwidth
│   ├── tests/
│   │   └── test_pipeline.m             # smoke tests against sample images
│   └── utils/
│       ├── loadConfig.m
│       └── ioHelpers.m
└── python/
    ├── requirements.txt
    ├── gateway/
    │   ├── main.py                     # FastAPI app, /api/screen endpoint
    │   ├── matlab_bridge.py            # wraps MATLAB Engine API for Python
    │   ├── schemas.py                  # pydantic request/response models
    │   └── config.py
    └── training/
        ├── dataset.py                  # APTOS/IDRiD/Messidor-2 loader
        ├── train_severity_classifier.py
        ├── train_segmentation_models.py
        └── export_onnx.py
```

## Quickstart

1. **Data**: follow `data/README.md` to download APTOS 2019 + IDRiD + Messidor-2.
2. **Train** (Python, GPU recommended — any Python 3.10+ works fine here):
   ```bash
   cd python/training
   pip install -r ../requirements-training.txt
   python train_severity_classifier.py --data-dir ../../data/aptos2019 --epochs 30
   python export_onnx.py --checkpoint runs/severity_best.pt --out ../../matlab/models/severity_net.onnx
   ```
3. **MATLAB**: open `matlab/startup.m` in MATLAB, then in the console:
   ```matlab
   run('matlab/startup.m')
   result = runScreeningPipeline('data/aptos2019/sample_001.png');
   ```
4. **Serve as API** — check your MATLAB release's supported Python versions first
   ([MathWorks compatibility table](https://www.mathworks.com/support/requirements/python-compatibility.html));
   if your default Python is newer than what's supported (e.g. Python 3.14 vs.
   MATLAB R2026a's 3.9-3.13), create a separate venv on a supported version
   just for the gateway:
   ```bash
   py -3.12 -m venv gateway-venv        # or whichever supported version you have
   gateway-venv\Scripts\activate        # Windows
   cd python/gateway
   pip install -r ../requirements-gateway.txt
   uvicorn main:app --reload --port 8000
   ```
   Website/Android teammates POST an image to `http://localhost:8000/api/screen` per
   `docs/api_contract.md`. Training and gateway environments are independent —
   you don't need MATLAB or matlabengine installed just to train models.

   **What the gateway now includes** (beyond the core `/api/screen` call): patient
   registration and history, a prioritized ophthalmologist review queue with
   confirm/override, district-level analytics, offline batch sync for the Android
   app, and native-language audio read-out of results. All state is persisted to
   PostgreSQL (configured via the `DATABASE_URL` environment variable; a local
   SQLite file is used automatically as a zero-config fallback for local
   development). Full endpoint-by-endpoint documentation, including exact
   request/response JSON for every one of these, is in `docs/api_contract.md` —
   that file is the actual source of truth for the web/Android team, this README
   is just the setup steps.
5. **Ensemble multiple trained models** (optional, only if it measurably helps):
   ```bash
   cd python/training
   python evaluate_ensemble.py --checkpoints runs/run_A/epoch_08.pt runs/run_E/epoch_12.pt \
       --data-dir ../../data/messidor2 --tta
   ```
   Compares the combined prediction against each individual checkpoint on
   Messidor-2. If it wins, export each checkpoint individually with
   `export_onnx.py` and set `grading.severity_model` in
   `config/pipeline_config.yaml` to a **list** of the resulting filenames —
   `getSeverityNet.m`/`predictSeverity.m`/`generateGradCAM.m` already support
   averaging predictions across an ensemble in the deployed MATLAB pipeline.
6. **Simulink capacity model**: in MATLAB, `run('matlab/simulink/buildCapacityModel.m')`
   then `run('matlab/simulink/runCapacitySweep.m')` to get the optimal reviewer-count /
   bandwidth recommendation table used in the pitch deck.

## Toolboxes required
Image Processing Toolbox, Computer Vision Toolbox, Deep Learning Toolbox,
Statistics and Machine Learning Toolbox, Simulink. (Medical Imaging Toolbox optional —
only needed if you move to DICOM-format fundus images instead of PNG/JPEG.)
