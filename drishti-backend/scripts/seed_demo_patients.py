"""Seeds 5 fully-populated demo patients so every page of drishti-frontend
has real data to show on a fresh install, without needing 5 real fundus
photos run through MATLAB first.

Because everything in this app reads from the one PostgreSQL database, seeding
it here is what "add data everywhere" actually means -- there is no
per-page copy of this data to keep in sync. Once seeded, these 5 patients
show up consistently in the Review Queue, Patient History, Admin Dashboard
analytics, and Capacity Planner's district breakdown, because all four
pages query the same rows.

Usage (from python/gateway/):
    python ../../scripts/seed_demo_patients.py

Safe to re-run: it checks for an existing patient with the same
external_id before inserting, so it won't create duplicates if you run it
twice. Delete output/drishti.db and re-run for a fully clean seed instead.
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python" / "gateway"))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from config import settings  # noqa: E402
from database import Patient, ReviewStatus, Screening, SessionLocal, User, UserRole, init_db, _uuid  # noqa: E402
from auth import hash_password  # noqa: E402

NOW = dt.datetime.utcnow()


def days_ago(n: int) -> dt.datetime:
    return NOW - dt.timedelta(days=n)


def make_report_files(report_id: str, icdr_level: int, icdr_label: str, district: str) -> None:
    """Generates a small placeholder annotated image + heatmap + PDF so the
    report URLs the API returns actually resolve to something viewable,
    instead of 404ing in the UI. Clearly labelled as demo data."""
    report_dir = settings.reports_dir / report_id
    report_dir.mkdir(parents=True, exist_ok=True)

    level_colors = {
        0: (76, 175, 80), 1: (255, 235, 59), 2: (255, 152, 0),
        3: (244, 67, 54), 4: (183, 28, 28),
    }
    color = level_colors.get(icdr_level, (100, 100, 100))

    for name, label in [("annotated.png", "Annotated Fundus (Demo)"), ("heatmap.png", "Grad-CAM Heatmap (Demo)")]:
        img = Image.new("RGB", (512, 512), color=(20, 20, 24))
        draw = ImageDraw.Draw(img)
        draw.ellipse([56, 56, 456, 456], outline=color, width=10, fill=(40, 30, 30))
        draw.ellipse([206, 206, 306, 306], outline=(255, 255, 255), width=3)
        draw.text((30, 20), label, fill=(255, 255, 255))
        draw.text((30, 470), f"DEMO DATA -- {icdr_label} -- {district}", fill=(200, 200, 200))
        img.save(report_dir / name)

    pdf_img = Image.new("RGB", (612, 792), color=(255, 255, 255))
    draw = ImageDraw.Draw(pdf_img)
    draw.text((40, 40), "DRISHTI Screening Report (Demo Seed Data)", fill=(0, 0, 0))
    draw.text((40, 80), f"ICDR Grade: {icdr_level} ({icdr_label})", fill=(0, 0, 0))
    draw.text((40, 110), f"District: {district}", fill=(0, 0, 0))
    pdf_img.save(report_dir / "report.pdf", "PDF")


PATIENTS = [
    dict(
        name="Ramesh Kumar", external_id="ASHA-REG-00231", age=58, sex="M",
        phone="9876500001", preferred_language="hi", district="Wardha Rural",
        facility_id="PHC-WARDHA-01", registered_by="asha_worker_17",
        screenings=[
            dict(days=60, eye="OD", icdr_level=1, icdr_label="Mild NPDR", referable=False,
                 confidence=0.91, rule_based_level=1, review_status=ReviewStatus.NOT_REQUIRED,
                 ma=4, hem=0, exudate_pct=0.1, soft_exudate=False, nv=False,
                 summary="Mild NPDR detected (ICDR level 1). Routine annual re-screening recommended."),
            dict(days=5, eye="OD", icdr_level=2, icdr_label="Moderate NPDR", referable=True,
                 confidence=0.62, rule_based_level=1, review_status=ReviewStatus.PENDING,
                 ma=11, hem=3, exudate_pct=0.6, soft_exudate=False, nv=False,
                 summary="Moderate NPDR detected (ICDR level 2). Referable -- ophthalmologist review pending."),
        ],
    ),
    dict(
        name="Sunita Devi", external_id="ASHA-REG-00198", age=45, sex="F",
        phone="9876500002", preferred_language="mr", district="Nanded",
        facility_id="PHC-NANDED-04", registered_by="asha_worker_17",
        screenings=[
            dict(days=90, eye="OS", icdr_level=0, icdr_label="No DR", referable=False,
                 confidence=0.97, rule_based_level=0, review_status=ReviewStatus.NOT_REQUIRED,
                 ma=0, hem=0, exudate_pct=0.0, soft_exudate=False, nv=False,
                 summary="No diabetic retinopathy detected. Continue annual screening."),
            dict(days=10, eye="OS", icdr_level=0, icdr_label="No DR", referable=False,
                 confidence=0.98, rule_based_level=0, review_status=ReviewStatus.NOT_REQUIRED,
                 ma=0, hem=0, exudate_pct=0.0, soft_exudate=False, nv=False,
                 summary="No diabetic retinopathy detected. Continue annual screening."),
        ],
    ),
    dict(
        name="Abdul Rahman", external_id="ASHA-REG-00312", age=67, sex="M",
        phone="9876500003", preferred_language="ur", district="Yavatmal",
        facility_id="PHC-YAVATMAL-02", registered_by="asha_worker_22",
        screenings=[
            dict(days=3, eye="OD", icdr_level=4, icdr_label="Proliferative DR", referable=True,
                 confidence=0.88, rule_based_level=4, review_status=ReviewStatus.PENDING,
                 ma=42, hem=18, exudate_pct=2.1, soft_exudate=True, nv=True,
                 summary="Proliferative DR detected (ICDR level 4). Referable -- recommend urgent "
                         "ophthalmologist follow-up within 1 week."),
        ],
    ),
    dict(
        name="Lakshmi Reddy", external_id="ASHA-REG-00287", age=52, sex="F",
        phone="9876500004", preferred_language="te", district="Amravati",
        facility_id="PHC-AMRAVATI-03", registered_by="asha_worker_17",
        screenings=[
            dict(days=120, eye="OD", icdr_level=1, icdr_label="Mild NPDR", referable=False,
                 confidence=0.93, rule_based_level=1, review_status=ReviewStatus.NOT_REQUIRED,
                 ma=3, hem=0, exudate_pct=0.2, soft_exudate=False, nv=False,
                 summary="Mild NPDR detected (ICDR level 1). Routine annual re-screening recommended."),
            dict(days=20, eye="OD", icdr_level=2, icdr_label="Moderate NPDR", referable=True,
                 confidence=0.79, rule_based_level=2, review_status=ReviewStatus.CONFIRMED,
                 reviewer_id="dr_sharma", reviewer_notes="Agreed with AI grade on review.",
                 ma=9, hem=2, exudate_pct=0.5, soft_exudate=False, nv=False,
                 summary="Moderate NPDR detected (ICDR level 2). Referable -- confirmed on review."),
        ],
    ),
    dict(
        name="Karthik Iyer", external_id="ASHA-REG-00355", age=39, sex="M",
        phone="9876500005", preferred_language="ta", district="Chandrapur Rural",
        facility_id="PHC-CHANDRAPUR-01", registered_by="asha_worker_22",
        screenings=[
            dict(days=1, eye="OS", icdr_level=2, icdr_label="Moderate NPDR", referable=True,
                 confidence=0.58, rule_based_level=3, review_status=ReviewStatus.OVERRIDDEN,
                 reviewer_id="dr_sharma", overridden_icdr_level=3,
                 reviewer_notes="Rule-based estimate matched severe features I could see on the annotated "
                                "image the AI grade missed -- overriding to Severe NPDR.",
                 ma=19, hem=9, exudate_pct=1.4, soft_exudate=True, nv=False,
                 summary="Moderate NPDR detected (ICDR level 2). Referable -- overridden to Severe NPDR "
                         "on ophthalmologist review."),
        ],
    ),
]


DEMO_USERS = [
    dict(username="dr_sharma", password="Demo@123", full_name="Dr. Anjali Sharma", role=UserRole.DOCTOR,
         facility_id="District Hospital Nanded"),
    dict(username="admin_deshmukh", password="Demo@123", full_name="Rohan Deshmukh", role=UserRole.ADMIN,
         district="Nanded"),
    dict(username="asha_worker_17", password="Demo@123", full_name="Sunita Kamble", role=UserRole.ASHA,
         district="Wardha Rural", facility_id="PHC-WARDHA-01"),
]


def seed_demo_users(db) -> int:
    """Seeds the three demo accounts the LoginModal's 'quick sign-in' cards
    use. Real accounts, real password hashing -- not a separate fake login
    path, just convenient known credentials for trying each role."""
    created = 0
    for u in DEMO_USERS:
        if db.query(User).filter(User.username == u["username"]).first():
            print(f"Skipping user {u['username']} -- already seeded.")
            continue
        db.add(User(
            username=u["username"], password_hash=hash_password(u["password"]),
            full_name=u["full_name"], role=u["role"],
            facility_id=u.get("facility_id"), district=u.get("district"),
        ))
        created += 1
    db.commit()
    return created


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        created_users = seed_demo_users(db)
        created_patients = 0
        created_screenings = 0

        for p in PATIENTS:
            existing = db.query(Patient).filter(Patient.external_id == p["external_id"]).first()
            if existing:
                print(f"Skipping {p['name']} ({p['external_id']}) -- already seeded.")
                continue

            patient = Patient(
                name=p["name"], external_id=p["external_id"], age=p["age"], sex=p["sex"],
                phone=p["phone"], preferred_language=p["preferred_language"], district=p["district"],
                facility_id=p["facility_id"], registered_by=p["registered_by"],
                created_at=days_ago(p["screenings"][0]["days"] + 1),
            )
            db.add(patient)
            db.flush()  # get patient.id without committing yet
            created_patients += 1

            for s in p["screenings"]:
                report_id = _uuid()[:12]
                created_at = days_ago(s["days"])
                disagreement = s["rule_based_level"] != s["icdr_level"]

                screening = Screening(
                    patient_id=patient.id, eye=s["eye"], status="graded",
                    sharpness_score=0.88, illumination_score=0.9, field_of_view_score=0.92,
                    icdr_level=s["icdr_level"], icdr_label=s["icdr_label"],
                    referable=s["referable"], confidence=s["confidence"],
                    requires_human_review=s["review_status"] == ReviewStatus.PENDING,
                    rule_based_icdr_level=s["rule_based_level"], grading_disagreement=disagreement,
                    microaneurysm_count=s["ma"], hemorrhage_count=s["hem"],
                    hard_exudate_area_pct=s["exudate_pct"], soft_exudate_present=s["soft_exudate"],
                    neovascularization_detected=s["nv"],
                    report_id=report_id, summary_text=s["summary"], language=p["preferred_language"],
                    processing_time_ms=1200, review_status=s["review_status"],
                    reviewer_id=s.get("reviewer_id"), reviewer_notes=s.get("reviewer_notes"),
                    overridden_icdr_level=s.get("overridden_icdr_level"),
                    reviewed_at=created_at + dt.timedelta(hours=6) if s["review_status"] != ReviewStatus.PENDING else None,
                    created_at=created_at,
                )
                db.add(screening)
                created_screenings += 1

                make_report_files(report_id, s["icdr_level"], s["icdr_label"], p["district"])

        db.commit()
        print(f"\nSeeded {created_users} demo user accounts (password 'Demo@123' for all).")
        print(f"Seeded {created_patients} patients, {created_screenings} screenings.")
        print("Restart drishti-backend (or just refresh the frontend) to see them.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
