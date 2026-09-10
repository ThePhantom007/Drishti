# Architecture Notes

## Why the Python-train / MATLAB-serve split
Model training (data augmentation, experimentation, GPU utilization) is fastest in
PyTorch. MATLAB's Deep Learning Toolbox can import a trained model directly via ONNX
(`importNetworkFromONNX`), so we train where iteration speed is highest and deploy where
the problem statement requires (MATLAB pipeline + Simulink capacity model). This is a
documented, legitimate MathWorks workflow, not a workaround.

## Why a FastAPI gateway in front of MATLAB instead of calling MATLAB directly
1. Decouples the web/Android team's timeline from MATLAB availability/licensing —
   they build against a JSON contract, not a MATLAB install.
2. MATLAB Engine API for Python lets the gateway call `.m` functions in-process; this
   keeps the "real" pipeline logic in MATLAB (satisfying the problem statement's tooling
   requirement) while presenting a normal REST surface to the rest of the app.
3. Matches the same service-boundary pattern used in prior work (async task queue behind
   a REST API) — familiar territory, just swapping the worker implementation.

## Pipeline module boundaries (matlab/pipeline/)
Each stage is a standalone function with a single well-defined input/output so modules
can be independently unit-tested and independently swapped (e.g. replacing a rule-based
optic disc localizer with a trained detector) without touching the orchestrator.

```
runScreeningPipeline.m
  ├─> assessImageQuality.m  --reject--> [recapture feedback, stop]
  ├─> enhanceImage.m                          (only if borderline-adequate)
  ├─> segmentOpticDiscFovea.m
  ├─> segmentVessels.m
  ├─> detectMicroaneurysms.m
  ├─> segmentExudates.m
  ├─> classifyHemorrhages.m
  ├─> detectNeovascularization.m
  ├─> gradeDRSeverity.m         (consumes all lesion/structure outputs above)
  ├─> calibrateConfidence.m
  ├─> generateGradCAM.m
  └─> generateReport.m
```

## Simulink capacity model
Models the screening program as a discrete-event queueing system:
- **Source**: patient arrivals (Poisson process, rate derived from
  `patients_per_year_target / working_days_per_year`)
- **Server 1**: AI pipeline processing (deterministic-ish service time, from measured
  `processing_time_ms`)
- **Branch**: confident cases exit immediately; `requires_human_review` cases route to
- **Server 2**: ophthalmologist review queue (service time = `avg_review_time_sec_flagged`)
- **Constraint block**: bandwidth ceiling from `bandwidth_per_image_mb` × arrival rate

`runCapacitySweep.m` sweeps reviewer headcount and bandwidth allocation to find the
minimum resourcing that keeps the review queue stable at the target patient volume —
this produces the staffing/bandwidth recommendation table for the pitch deck.

## What's intentionally left as a stub / TODO
The segmentation and grading `.m` files include the correct function signatures,
config wiring, and documented expected behavior, but the actual trained-model
inference calls are marked `% TODO` until you've trained and exported models per
`python/training/`. This keeps the pipeline runnable end-to-end on dummy outputs
immediately, so the API/report/Simulink layers can be developed and demoed in parallel
with model training rather than blocked on it.
