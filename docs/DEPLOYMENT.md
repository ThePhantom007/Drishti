# Deployment Guide (Free Tier)

DRISHTI deploys as three pieces, all free, no credit card required:

| Piece | Where | Why this one |
|---|---|---|
| Database | [Neon](https://neon.tech) (PostgreSQL) | Permanent free tier, no card, scales to zero when idle |
| Backend (`drishti-backend`) | [Render](https://render.com) — web service | Genuine free web service tier, no card required |
| Frontend (`drishti-frontend`) | [Render](https://render.com) — static site | Same account, one dashboard, and static sites never sleep at all |
| Keep-alive for the backend | [UptimeRobot](https://uptimerobot.com) | Free, pings `/api/health` on a schedule so the backend's free-tier sleep never kicks in |

Everything below is driven by the single `render.yaml` at the repo root —
Render's "Blueprint" deploy reads it and sets up both services from one
click, rather than configuring each by hand.

Free-tier terms change over time — re-check Render/Neon/UptimeRobot's
current free-tier pages before you commit, but this was accurate as of
when this guide was written.

## Why one provider (Render) instead of splitting frontend/backend across two

Render's static sites are genuinely free with no sleep behavior at all
(they're just files on a CDN, no process to spin down) — so hosting both
services on Render means only the backend needs a keep-alive strategy,
and you only need one account/dashboard instead of two.

## Important: what this free setup does and doesn't give you

- **Render's free *web service* (the backend) sleeps after ~15 minutes of
  inactivity** and takes 30-60 seconds to wake on the next request. The
  UptimeRobot step below (pinging `/api/health` every 5 minutes) keeps it
  warm so real visitors don't hit that cold start. The free *static site*
  (the frontend) never sleeps — this only matters for the backend.
- **The MATLAB pipeline will not run on Render** (no MATLAB there, and
  never will be on any free host). `matlab_bridge.py` already detects this
  automatically and falls back to its built-in mock-inference mode — the
  deployed demo will show mock grading results, using the same fallback
  mechanism the rest of this project's documentation already describes.
  Real MATLAB inference only runs where MATLAB is actually installed.
- **Render's free web service disk is ephemeral.** Patient/screening
  *data* is safe because it lives in Postgres (Neon), not on Render's
  disk — but generated report *files* (PDF/annotated image/heatmap/audio,
  saved under `output/reports/`) live on the backend's local disk and will
  be wiped on every redeploy. Fine for a demo (files regenerate the next
  time a screening runs); persisting them long-term would need either a
  paid persistent disk or moving report storage to an object store (e.g.
  Cloudflare R2's free tier) — neither is set up here, since that's a real
  code change beyond deployment configuration.

## 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) (no card required for the
   free tier).
2. Create a new project. Neon gives you a connection string immediately,
   in the form `postgresql://user:password@host/dbname?sslmode=require`.
3. Copy that connection string — you'll paste it into Render in step 2.

The gateway doesn't need any other Postgres-specific setup: on first
request, `Base.metadata.create_all()` creates every table your models
declare (patients, screenings, users, sessions) directly against whatever
`DATABASE_URL` you give it. The three things that specifically make Neon
work reliably (the `psycopg2-binary` driver, `pool_pre_ping` so the app
reconnects cleanly after Neon suspends its compute on idle instead of
throwing a stale-connection error, and normalizing a `postgres://`-style
connection string to the `postgresql://` scheme SQLAlchemy actually
requires) are already handled in `drishti-backend/python/gateway/config.py`
and `database.py` — paste in your connection string as-is, either scheme.

## 2. Deploy both services (Render Blueprint)

1. Push this repository to GitHub.
2. In Render, "New" → "Blueprint", and point it at your repo. Render
   reads `render.yaml` at the repo root and sets up **both** services —
   `drishti-backend` (web service) and `drishti-frontend` (static site) —
   from this one file.
3. Render will prompt for the environment variables marked `sync: false`
   in `render.yaml`:
   - `drishti-backend`'s `DATABASE_URL` → the Neon connection string from
     step 1.
   - `drishti-backend`'s `CORS_ALLOWED_ORIGINS` → leave blank for now;
     come back once you have the frontend's URL (step below).
   - `drishti-frontend`'s `VITE_API_BASE_URL` → leave blank for now; come
     back once you have the backend's URL.
4. Deploy. Render gives each service its own URL, e.g.
   `https://drishti-backend.onrender.com` and
   `https://drishti-frontend.onrender.com`.
5. Now that you have both URLs, go back and fill in the two blanks from
   step 3: `CORS_ALLOWED_ORIGINS` on the backend gets the frontend's URL,
   `VITE_API_BASE_URL` on the frontend gets the backend's URL. Save each —
   Render redeploys automatically on an environment variable change.
   **The frontend needs a rebuild** for this to take effect (Vite bakes
   env vars in at build time), which the auto-redeploy handles.
6. Sanity-check the backend: `curl https://<your-backend-url>/api/health`
   should return `{"status":"ok",...}`.
7. Seed the three demo accounts and demo patients so the live deployment
   isn't empty on first visit — Render's dashboard has a "Shell" tab for
   the backend service; it opens inside `rootDir`
   (`drishti-backend/python/gateway/`), so run:
   ```bash
   python ../../scripts/seed_demo_patients.py
   ```

## 3. Keep the backend awake (UptimeRobot)

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free tier, no
   card required).
2. Add a new monitor:
   - Monitor type: HTTP(s)
   - URL: `https://<your-backend-url>/api/health`
   - Monitoring interval: 5 minutes (UptimeRobot's free-tier minimum)
3. That's it. As long as this monitor keeps pinging, Render's free web
   service never goes idle long enough to sleep, so real visitors don't
   hit the 30-60 second cold-start delay.

This only needs to run against the backend — the frontend static site
has no sleep behavior to work around.

## 4. Verify end-to-end

Open the frontend's Render URL, sign in with one of the seeded demo
accounts (`dr_sharma` / `admin_deshmukh` / `asha_worker_17`, password
`Demo@123` for all three — see the main `README.md`), and confirm you can
view the Review Queue / Patient History / run a screening. If you skip
the UptimeRobot step, the very first request after a period of
inactivity will be slow — that's the expected cold start, not a bug.
