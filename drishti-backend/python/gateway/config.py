"""Gateway configuration — loaded once at startup.

Kept intentionally separate from config/pipeline_config.yaml (which is the
MATLAB pipeline's own config): this file holds gateway/HTTP-layer settings
only. Pipeline thresholds live and are edited in one place (the YAML) so
there's no duplication/drift between the two layers.
"""
from __future__ import annotations

import os
from pathlib import Path
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parents[2]


def _normalize_database_url(url: str) -> str:
    """Some providers (Neon included, on older/alternate connection-string
    formats -- and this has long bitten Heroku/Render Postgres users too)
    hand out connection strings starting with `postgres://`, which
    SQLAlchemy rejects outright with NoSuchModuleError since it only
    recognizes the `postgresql://` scheme. Rewriting it here means pasting
    whichever variant your provider gives you just works, instead of
    failing at startup with an error that doesn't obviously point at the
    URL's scheme as the problem."""
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


class Settings(BaseModel):
    matlab_project_root: Path = REPO_ROOT / "matlab"
    pipeline_config_path: Path = REPO_ROOT / "config" / "pipeline_config.yaml"
    reports_dir: Path = REPO_ROOT / "output" / "reports"
    upload_tmp_dir: Path = REPO_ROOT / "output" / "uploads"
    max_upload_size_mb: int = 15
    allowed_content_types: tuple[str, ...] = ("image/jpeg", "image/png")
    model_version: str = os.environ.get("MODEL_VERSION", "dev")
    # Production database: PostgreSQL, set via the DATABASE_URL environment
    # variable (e.g. a Neon/Supabase connection string in deployment). Local
    # development falls back to a zero-config SQLite file automatically when
    # DATABASE_URL isn't set, so running the app locally doesn't require a
    # Postgres instance on hand.
    database_url: str = _normalize_database_url(
        os.environ.get("DATABASE_URL", f"sqlite:///{REPO_ROOT / 'output' / 'drishti.db'}")
    )
    default_review_confidence_threshold: float = 0.70  # must match config/pipeline_config.yaml's
                                                          # grading.confidence_review_threshold
    # Comma-separated list of origins allowed to call this API from a browser.
    # Defaults cover the Vite dev server (drishti-frontend, localhost:5173) and
    # the FastAPI docs UI itself. Add your deployed frontend's URL here (via
    # the CORS_ALLOWED_ORIGINS env var) once drishti-frontend is deployed.
    cors_allowed_origins: tuple[str, ...] = tuple(
        o.strip()
        for o in os.environ.get(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000",
        ).split(",")
        if o.strip()
    )


settings = Settings()
settings.reports_dir.mkdir(parents=True, exist_ok=True)
settings.upload_tmp_dir.mkdir(parents=True, exist_ok=True)
