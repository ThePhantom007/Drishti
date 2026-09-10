"""Thin wrapper around the MATLAB Engine API for Python.

Starts a single persistent MATLAB engine at app startup (starting a fresh
engine per-request would dominate latency — engine startup is several
seconds; a resident engine reduces per-request overhead to just the pipeline
execution time itself). Requires the `matlabengine` package matching your
installed MATLAB release: `pip install matlabengine==<release-version>`.

If MATLAB/the engine package isn't installed (e.g. a teammate without a
MATLAB license running the gateway to test the JSON contract), falls back to
a mock so /api/screen still returns a structurally valid response.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from config import settings

logger = logging.getLogger("matlab_bridge")

_engine = None
_MOCK_MODE = False

try:
    import matlab.engine  # type: ignore
except ImportError:
    matlab = None  # type: ignore
    _MOCK_MODE = True
    logger.warning(
        "matlabengine package not found — running gateway in MOCK MODE. "
        "Install with: pip install matlabengine==<version matching your MATLAB release>"
    )


def start_engine() -> None:
    """Call once at FastAPI startup."""
    global _engine
    if _MOCK_MODE:
        logger.warning("MOCK MODE: skipping real MATLAB engine startup.")
        return

    logger.info("Starting MATLAB engine (this takes a few seconds)...")
    _engine = matlab.engine.start_matlab()
    _engine.addpath(str(settings.matlab_project_root), nargout=0)
    _engine.eval(f"run('{settings.matlab_project_root / 'startup.m'}')", nargout=0)
    logger.info("MATLAB engine ready.")


def stop_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.quit()
        _engine = None


def run_screening_pipeline(image_path: str) -> dict[str, Any]:
    """Call runScreeningPipeline.m and return its output as a plain dict.

    MATLAB structs come back as matlab.engine struct-like objects; we
    round-trip through jsonencode on the MATLAB side (simpler and more
    robust than recursively walking MATLAB struct/array types in Python)
    and parse the resulting JSON string here.
    """
    if _MOCK_MODE or _engine is None:
        return _mock_result(image_path)

    result_struct = _engine.runScreeningPipeline(image_path, nargout=1)
    json_str = _engine.jsonencode(result_struct, nargout=1)
    return json.loads(json_str)


def _mock_result(image_path: str) -> dict[str, Any]:
    """Structurally valid stand-in so the gateway/API contract can be
    developed and tested without a MATLAB install present."""
    logger.warning("Returning MOCK screening result for %s", image_path)
    return {
        "status": "graded",
        "quality": {
            "adequate": True, "sharpness_score": 0.85, "illumination_score": 0.9,
            "field_of_view_score": 0.93, "issues": [],
        },
        "grading": {
            "icdr_level": 2, "icdr_label": "Moderate NPDR", "referable": True,
            "confidence": 0.62, "requires_human_review": True,
        },
        "grading_paths": {
            "rule_based_level": 1, "rule_based_label": "Mild NPDR",
            "learned_level": 2, "learned_label": "Moderate NPDR",
            "disagreement": True,
        },
        "lesions": {
            "microaneurysm_count": 9, "hemorrhage_count": 2, "hard_exudate_area_pct": 0.8,
            "soft_exudate_present": False, "neovascularization_detected": False,
        },
        "report": {
            "report_id": "mock0001", "pdf_url": "", "heatmap_path": "", "annotated_path": "",
            "summary_text": "[MOCK] Moderate NPDR detected. Referable — recommend follow-up.",
            "language": "en",
        },
        "processing_time_ms": 42,
    }
