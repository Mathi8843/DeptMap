# AGENTS.md

Guidance for coding agents working in this repository.

## Project

DebtMap — a full-stack security audit product for AI-generated apps.

- `backend/` — FastAPI service (auth, Semgrep scans, Groq explanations, package registry checks, health scoring, SOC 2, webhooks)
- `frontend/` — Next.js 16 App Router dashboard, stores non-sensitive profile data in `localStorage` (session token kept in memory only, transmitted via httpOnly cookie), calls backend via `frontend/lib/api.ts`, shares state via `frontend/lib/contexts/AuthContext.tsx`
- Root `*.md` and `*.html` files are planning/research reference — do not rewrite unless explicitly asked

## Key Commands

Backend (run from `backend/`):
```powershell
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
python test_setup.py
python check_config.py
```

Frontend (run from `frontend/`):
```powershell
npm install
npm run dev
npm run build
npm run lint
```

There is **no `npm run typecheck`** — only `lint` and `build` check TypeScript.

## Environment

Backend config is loaded from `backend/.env` by `backend/app/config.py` (pydantic-settings). Start from `backend/.env.example`.

Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SECRET_KEY`.
Optional: `GROQ_API_KEY`, `GROQ_MODEL` (falls back to rule-based explanations if unset).

Frontend uses `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).

Never commit `.env` files or real secrets.

## Architecture & Data Flow

- `apiFetch(path)` auto-prefixes `/api` — do not pass full backend URLs to it
- `apiFetch` sends `Authorization: Bearer <session_token>` (falls back to `mock-session-token`)
- Auth endpoint: `/api/auth/me`. Auth dependency: `get_current_user_id` from `backend/app/services/auth.py`
- Backend uses **service role key** (bypasses RLS). RLS policies exist for frontend anon-key usage
- `mock-session-token` → mock user ID `00000000-0000-0000-0000-000000000000` in non-production
- `mock_github_token` → mock data in semgrep/github services (scan returns synthetic findings)
- Frontend default user is pre-filled in `AppContext` with `mock-session-token` and auto-creates DB profile via `/api/auth/me`
- Scan pipeline (background task): clone → Semgrep → Groq enrichment → save issues → package audit → health score + history
- Health score: diminishing-returns formula using `weight × sqrt(count)` per severity bucket. Weights: critical=40, high=25, medium=12, low=5. Score clamped to [0, 100]. See `backend/app/services/scorer.py`.
- No Next.js API Route Handlers — all API calls go to the FastAPI backend

## Sharp Edges

- `slowapi` in `backend/requirements.txt` is **actively used** for rate limiting — `limiter` in `app/rate_limit.py` and `SlowAPIMiddleware` in `app/main.py` both depend on it. Do **not** remove it.
- `anthropic` is **not** in `requirements.txt` and was never used — actual AI explanations use `groq.py` via the Groq API
- Backend README mentions `claude.py` and `pr_creator.py` — those files **do not exist**; actual AI explanations use `groq.py` and PR creation uses `github.py`
- `backend/app/services/crypto.py` uses Fernet encryption for GitHub tokens; `decrypt_token` now raises `ValueError` on key-rotation failures (catches `InvalidToken` specifically) — callers must handle this as an HTTP 401 and prompt re-authentication
- Tailwind v4 uses `@theme` in `frontend/app/globals.css` — the v3-style `tailwind.config.ts` is mostly vestigial
- `eslint.config.mjs` has `@typescript-eslint/no-explicit-any: "off"` — `any` is permitted
- Route-group paths like `frontend/app/(dashboard)/...` need quoting in PowerShell
- Windows Semgrep requires WSL or Docker (see `_get_semgrep_command` in `semgrep.py`)
- `backend/scratch/` has dev/testing scripts (`clear_db.py`, `inspect_scans.py`, `test_mock_flow.py`)
- `python-multipart` is needed by FastAPI for form parsing (listed in requirements)
- The app mixes real backend calls with mock fallback — verify auth assumptions before touching login/onboarding/AppContext
- Always check `git status --short` before broad edits to avoid reverting user changes

## Verification

Frontend-only: `cd frontend; npm run lint; npm run build`
Backend-only: `cd backend; python check_config.py; python test_setup.py`
Smoke tests (no external services needed): `cd backend; pytest tests/test_smoke.py -v`
Full-stack: both frontend and backend commands above.

If a command cannot run due to missing credentials/network/WSL/Supabase, state the exact blocker.
