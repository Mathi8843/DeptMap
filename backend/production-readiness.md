# Production Readiness — Task Checklist

> File: `backend/production-readiness.md`
>
> Each item links to the exact file:line reference. Mark `[x]` when completed
> and verify the fix before closing. Re-open if verification fails.

---

## 🔴 Critical (Will Cause Outages or Breaches)

- [x] **1. Background tasks block the event loop**
      `backend/app/routers/scans.py:93`
      Scans run in-process via FastAPI `BackgroundTasks`. A single scan
      (clone + Semgrep + Gitleaks + npm/pip audit + Groq) blocks the event
      loop for minutes. With 2+ concurrent scans the server becomes
      unresponsive.
      **Fix:** Removed `BackgroundTasks`. Web server only writes DB record.
      `worker.py` now polls DB and executes scans in a thread pool
      (concurrency cap of 3). Deploy `python worker.py` as a separate
      background service.

- [x] **2. No task persistence — scans lost on restart**
      `backend/worker.py`
      Worker crash mid-scan leaves scan stuck as `"running"` until stale
      guard (10 min). No retry for transient failures. No heartbeat to
      detect worker death quickly. No graceful shutdown.
      **Fix:** Added `heartbeat_at`, `retry_count`, `error_message` columns
      to scans table. Worker updates heartbeat every 5s. Startup recovery
      re-queues stale running scans within 30s. Graceful shutdown re-queues
      in-flight scans. Retry logic now uses persisted `retry_count` column.

- [x] **3. GitHub access token leaked via subprocess args**
      `backend/app/services/semgrep.py:80`
      ```python
      auth_url = clone_url.replace("https://", f"https://{access_token}@")
      ```
      Token is embedded in the clone URL passed to GitPython, which spawns
      a `git` subprocess. Visible in `ps aux`, `/proc/PID/cmdline`, and
      Git error output.
      **Fix:** Replaced URL-embedded token with `GIT_ASKPASS` mechanism.
      Token is written to a temp script, git reads it via stdin, script is
      deleted after clone. Token never appears in any command-line arg.

- [x] **4. No rate limiting on any endpoint**
      `backend/requirements.txt:13` (slowapi listed but unused)
      Auth endpoints (`/signin`, `/signup`) are open to brute force. Scan
      trigger is open to resource exhaustion. Webhook endpoint is open to
      flooding.
      **Fix:** Wired up `slowapi` (already in requirements). Added
      `app/rate_limit.py` with proxy-aware IP extraction. Tiered limits:
      signup 5/min, signin 10/min, scan trigger 10/min, OAuth 20/min,
      webhook 30/min, all others 100/min default.

- [x] **5. Default secrets with validation only in production**
      `backend/app/config.py:39,53-60`
      `secret_key` defaults to `"change-this-in-production"`. The model
      validator that catches this only fires when `app_env == "production"`.
      Deploying with `app_env=development` (or any other value) bypasses
      validation — JWT tokens are forgeable, webhooks are spoofable.
      **Fix:** Removed `app_env == "production"` guard. Validator now runs
      in every environment. In production, raises `ValueError` (hard block).
      In non-production, logs `CRITICAL` warning on every startup.

- [x] **6. Admin authorization is email-based only**
      `backend/app/routers/admin.py:13-24`
      Anyone with an `@debtmap.io` email becomes admin. No MFA, no role
      hierarchy, no audit log. The `/api/admin/insights` endpoint returns
      all users, repos, scans, and issues — massive data leak surface.
      **Fix:** Added `is_admin BOOLEAN DEFAULT FALSE` to the `users` table.
      Replaced email-based `check_admin_user` with a DB column lookup. The
      `ADMIN_EMAILS` list and email domain suffix check were removed. Run
      the SQL migration (`supabase_schema.sql:192`) to grant admin to
      existing users.

---

## 🟠 High (Performance Degradation or Data Integrity Risk)

- [x] **7. Synchronous PyGithub in async context**
      `backend/app/services/github.py:61-210`
      `get_github_client()`, `get_repo()`, `get_file_content()`,
      `create_fix_pull_request()` use the synchronous PyGithub library,
      blocking the event loop on every GitHub API call.
      **Fix:** Added 4 `_async` wrapper functions (`get_repo_metadata_async`,
      `list_user_repos_async`, `get_file_content_async`,
      `create_fix_pull_request_async`) that run the sync PyGithub calls in
      the default thread pool executor. Updated all callers in `repos.py`,
      `scans.py`, and `issues.py` to `await` the wrappers. Uses `functools.partial`
      for multi-arg functions. No new dependencies.

- [x] **8. Webhook signature verification only in production**
      `backend/app/routers/webhooks.py:63`
      ```python
      if settings.is_production and not verify_github_signature(...):
      ```
      In non-production environments, webhooks are accepted without
      signature verification. Any exposed dev deployment is trivially
      exploitable.
      **Fix:** Removed the `settings.is_production and ` guard.
      Signature is now verified in every environment. The Issue #5 fix
      already logs a CRITICAL warning on startup if the webhook secret
      is the default value.

- [x] **9. Supabase client singleton without connection management**
      `backend/app/database.py:11-22`
      `@lru_cache` creates one Supabase client for the app lifetime. No
      connection health checks, no reconnection logic, no pool monitoring.
      A Supabase-side restart or key rotation requires full app restart.
      **Fix:** Replaced `@lru_cache` with a module-level variable + TTL-based
      refresh (300s). Client is recreated every 5 minutes to pick up key
      rotations and recover from transient outages. `/health` endpoint now
      verifies Supabase connectivity with a lightweight query, returning
      503 if the database is unreachable.

- [x] **10. No observability**
      `backend/app/main.py:15-18`
      Only `logging.basicConfig(...)` exists — no structured logging, no
      distributed tracing, no metrics, no alerting. Cannot track latency
      percentiles, correlate logs, or monitor error rates.
      **Fix:** Added `RequestIDMiddleware` (starlette `BaseHTTPMiddleware`)
      that injects an 8-char UUID into a `contextvars.ContextVar` and
      `X-Request-ID` response header. Added `ContextFilter` that reads the
      context var and adds it to every log record. Log format now includes
      `%request_id` column. Every log line (startup, request, error, DB)
      carries the same request ID for correlation. `/health` endpoint
      verifies Supabase connectivity (from Issue #9). No new dependencies.

- [x] **11. Scan pipeline has no overall timeout**
      `backend/app/routers/scans.py:136-356`
      No timeout on `git clone`. No timeout on the pipeline as a whole.
      A stuck step blocks the scan thread indefinitely.
      **Fix:** Wrapped the pipeline body in `asyncio.wait_for(_run_pipeline(),
      timeout=600)`. If any step (including git clone, which had no timeout)
      exceeds 10 minutes cumulatively, `asyncio.TimeoutError` is raised,
      caught, and the scan is marked as failed with "Scan timed out after
      10 minutes". Individual sub-step timeouts (semgrep 180s, gitleaks 120s,
      npm 40s, pip 50s, groq 30s) remain as fine-grained guards.

---

## 🟡 Medium (Should Fix Before Significant Production Load)

- [x] **12. Token in clone URL may appear in error logs**
      `backend/app/services/semgrep.py:80`
      Even with the URL-based approach, if the clone fails, GitPython may
      emit the auth URL (with token) in logs and stderr.
      **Fix:** Already resolved by Issue #3 (GIT_ASKPASS). The `clone_url`
      is now `f"https://github.com/{repo['full_name']}.git"` — no token
      embedded. The token lives only in the temp askpass script, never in
      the clone URL, Git subprocess args, or Git error output.

- [x] **13. Unused dependencies in requirements**
      `backend/requirements.txt:9,13`
      `anthropic==0.40.0` was listed but never imported. (`slowapi==0.1.9`
      is now used — Issue #4 wired it up for rate limiting.)
      **Fix:** Removed `anthropic==0.40.0` from `requirements.txt`.
      `slowapi` retained as it is actively used.

- [ ] **14. Dockerfile not production-ready**
      `backend/Dockerfile:1-22`
      - Runs as root (no `USER` directive)
      - No `HEALTHCHECK` instruction
      - No `.dockerignore` (`.env`, `scratch/`, `__pycache__` included)
      - No multi-stage build
      - `pip install` without hash pinning
      **Fix:** Add non-root user, HEALTHCHECK, `.dockerignore`, multi-stage
      build, and hash-pinned dependencies.

- [ ] **15. No database migration strategy**
      `backend/supabase_schema.sql`
      Schema exists as a single SQL file. No migration tool (Alembic,
      Flyway). Schema changes require manual SQL execution with no version
      tracking or rollback.
      **Fix:** Set up Alembic for async migrations. Version all schema
      changes. Automate migration runs in CI/deploy.

- [ ] **16. Silently caught exceptions**
      `backend/app/services/semgrep.py:120` (WSL check), `backend/app/routers/scans.py:185-186,208-209` (Gitleaks/Registry errors)
      Several try/except blocks use `pass` or log at low severity.
      Failures in background tasks can go unnoticed.
      **Fix:** Log every caught exception at `WARNING` or higher with the
      traceback. Use structured logging for error monitoring.

- [ ] **17. CORS includes Vercel preview deployments**
      `backend/app/main.py:63`
      `https://dept-map.vercel.app` is hardcoded. Vercel preview
      deployments use `*.vercel.app` subdomains, creating a broad CORS
      surface.
      **Fix:** Restrict to explicit production domains, or remove the
      Vercel wildcard and use the `ALLOWED_ORIGINS` env var for previews.

- [ ] **18. No graceful shutdown for background tasks**
      `backend/app/main.py:24-36`
      No SIGTERM/SIGINT handler to wait for in-flight scans or re-queue
      them before shutdown.
      **Fix:** Register signal handlers that set a shutdown flag, wait
      for running scans (with timeout), and mark interrupted scans as
      "queued" for the worker.

- [ ] **19. Client-side admin detection duplicated**
      `frontend/app/page.tsx`, `frontend/app/auth/callback/page.tsx`,
      `frontend/lib/AppContext.tsx`
      Admin email checks are duplicated in the frontend alongside the
      backend check. This is cosmetic but creates two sources of truth.
      **Fix:** Remove client-side admin checks. Use the backend
      `/api/admin/insights` endpoint as the single source of truth.
      The frontend should derive admin status from the user profile, not
      from local email string matching.

---

## 🟢 Low (Nice-to-Have Improvements)

- [ ] **20. No request ID / correlation IDs on logs**
      Impossible to trace a single request's log lines across services.
      **Fix:** Add a middleware that injects a UUID request ID into the
      logging context.

- [ ] **21. Admin insights endpoint returns all records**
      `backend/app/routers/admin.py:35-78`
      No pagination on users, repos, scans, or issues queries. Will fail
      as data grows.
      **Fix:** Add `limit` and `offset` query params. Add server-side
      pagination to all table queries.

- [ ] **22. `allowed_origins` parsing is fragile**
      `backend/app/main.py:53-57`
      Comma-splits a raw string. Spaces, trailing commas, or malformed
      URLs are not validated.
      **Fix:** Parse as a list using Pydantic's field validation, or
      accept a JSON list instead.

- [ ] **23. Large default for `max_repo_size_mb`**
      `backend/app/config.py:47`
      500MB is very large for a shallow clone + scan. Risk of disk
      exhaustion and OOM.
      **Fix:** Lower the default (100MB) and make the limit configurable
      per plan tier.

- [ ] **24. No API versioning prefix**
      Endpoints are at `/api/...` with no version prefix
      (`/api/v1/...`).
      **Fix:** Add version prefix to all routers. Maintain backward
      compatibility when iterating.

---

## Progress

| Severity | Total | Completed |
|----------|-------|-----------|
| 🔴 Critical | 6 | 6 |
| 🟠 High | 5 | 4 |
| 🟡 Medium | 7 | 3 |
| 🟢 Low | 5 | 0 |
| **Total** | **23** | **13** |

---

*Generated: 2026-06-20 by backend-architect analysis*
*Last updated: 2026-06-20*
