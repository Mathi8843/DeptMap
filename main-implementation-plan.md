Implementation Overview


DebtMap — Senior Developer Implementation Overview
Role: Senior Full Stack Developer
Date: June 2026
Goal: Ship a production-ready MVP of DebtMap in 30 days, then scale to ₹1L MRR by Day 90.

My First Thinking — Architecture Decisions
Before writing a single line of code, I'm making these non-negotiable architectural decisions:

Monorepo — frontend/, backend/, shared/ in one repo. No coordination overhead between repos when you're a solo builder.
Python backend, not Node — Semgrep is a Python tool. The entire security tooling ecosystem (bandit, safety, pip-audit) is Python. Fighting this is stupid. FastAPI gives us async + speed.
Next.js frontend — SSR matters because the dashboard pages need fresh data on load without client-side flash. Also, Next.js API routes let us handle lightweight proxy calls without spinning up another service.
Supabase — Gives us Postgres + Auth + Storage + Realtime in one. RLS is our multi-tenant security model. We eat our own cooking.
Background jobs with Redis Queue (RQ) — Scans are slow (10–60 seconds). Never block an HTTP request waiting for a scan. Webhook comes in → job queued → response 202 Accepted immediately → scan runs in worker → results pushed to frontend via Supabase Realtime.
No Docker for local dev — Too much friction. Use venv + .env files. Docker only for production.
Feature flags from day 1 — Free/Pro/Team gating via a single PLAN_LIMITS config object. Easy to change without touching component code.
System Architecture Diagram

┌────────────────────────────────────────────────────────────┐
│                        BROWSER                             │
│                   Next.js Frontend                         │
│         (Vercel · app.debtmap.io)                          │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                          │
│            (Railway · api.debtmap.io)                      │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Webhook      │  │ Scan API     │  │ Auth Middleware  │  │
│  │ Handler      │  │ Routes       │  │ (JWT verify)     │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────┘  │
│         │                 │                                │
│         ▼                 ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Redis Queue (RQ)                        │  │
│  │         Job: scan_repository(repo_id)                │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                  │
│         ┌───────────────┼───────────────┐                  │
│         ▼               ▼               ▼                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐        │
│  │  Semgrep   │  │ Claude API │  │ npm/PyPI APIs  │        │
│  │  Runner    │  │ Explainer  │  │ Pkg Validator  │        │
│  └────────────┘  └────────────┘  └────────────────┘        │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                     Supabase                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Postgres   │  │   Storage    │  │    Realtime     │  │
│  │   (main DB)  │  │ (PDF reports)│  │ (live scan push)│  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────┐    ┌─────────────────────────┐
│   Resend (email)    │    │   Razorpay (payments)    │
│   alerts on crit    │    │   subscriptions billing  │
└─────────────────────┘    └─────────────────────────┘
Monorepo Folder Structure

debtmap/
├── backend/                          # FastAPI Python app
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Settings (pydantic-settings)
│   │   ├── dependencies.py           # Auth middleware, DB session
│   │   │
│   │   ├── api/                      # Route handlers (thin layer)
│   │   │   ├── __init__.py
│   │   │   ├── webhooks.py           # POST /webhook/github
│   │   │   ├── repos.py              # GET/POST /repos
│   │   │   ├── scans.py              # GET /scans, POST /scans/trigger
│   │   │   ├── issues.py             # GET /issues, POST /issues/{id}/fix
│   │   │   ├── packages.py           # GET /packages/{scan_id}
│   │   │   ├── health_score.py       # GET /health-score/{repo_id}
│   │   │   ├── billing.py            # POST /billing/upgrade, /billing/webhook
│   │   │   └── reports.py            # GET /reports/soc2/{repo_id}
│   │   │
│   │   ├── services/                 # Business logic (the real code)
│   │   │   ├── __init__.py
│   │   │   ├── github_service.py     # GitHub App auth, clone, PR creation
│   │   │   ├── semgrep_service.py    # Run semgrep, parse output
│   │   │   ├── claude_service.py     # Claude API calls, caching, prompts
│   │   │   ├── package_service.py    # npm/PyPI validation, slopsquatting
│   │   │   ├── health_service.py     # Health score calculation
│   │   │   ├── alert_service.py      # Email + Slack notifications
│   │   │   ├── billing_service.py    # Razorpay subscription management
│   │   │   └── report_service.py     # SOC 2 report generation
│   │   │
│   │   ├── workers/                  # Background job workers (RQ)
│   │   │   ├── __init__.py
│   │   │   ├── scan_worker.py        # Main scan orchestrator job
│   │   │   └── alert_worker.py       # Async alert sending job
│   │   │
│   │   ├── models/                   # Pydantic models (request/response)
│   │   │   ├── __init__.py
│   │   │   ├── repo.py
│   │   │   ├── scan.py
│   │   │   ├── issue.py
│   │   │   └── billing.py
│   │   │
│   │   └── db/                       # Supabase client + queries
│   │       ├── __init__.py
│   │       ├── client.py             # Supabase Python client setup
│   │       └── queries/              # Named query functions
│   │           ├── repos.py
│   │           ├── scans.py
│   │           ├── issues.py
│   │           └── users.py
│   │
│   ├── tests/
│   │   ├── test_semgrep_service.py
│   │   ├── test_claude_service.py
│   │   ├── test_package_service.py
│   │   └── test_health_service.py
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/                         # Next.js 14 App Router
│   ├── app/
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── page.tsx                  # Landing page (/)
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # Magic link login
│   │   │   └── callback/page.tsx     # Supabase auth callback
│   │   │
│   │   ├── (dashboard)/              # Protected route group
│   │   │   ├── layout.tsx            # Sidebar + nav layout
│   │   │   ├── dashboard/page.tsx    # Main dashboard (Screen 01)
│   │   │   ├── issues/
│   │   │   │   ├── page.tsx          # Issues list
│   │   │   │   └── [id]/page.tsx     # Issue detail + AI fix (Screen 02)
│   │   │   ├── packages/page.tsx     # Slopsquatting scanner (Screen 03)
│   │   │   ├── trend/page.tsx        # Health score trend (Screen 04)
│   │   │   ├── soc2/page.tsx         # SOC 2 readiness (Screen 05)
│   │   │   ├── repos/
│   │   │   │   ├── page.tsx          # Repo list + connect new
│   │   │   │   └── connect/page.tsx  # GitHub OAuth connect flow
│   │   │   └── settings/page.tsx     # Plan, billing, alerts
│   │   │
│   │   └── api/                      # Next.js API routes (thin proxies)
│   │       └── auth/
│   │           └── callback/route.ts
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── AlertBanner.tsx
│   │   ├── dashboard/
│   │   │   ├── HealthScoreGauge.tsx  # The ring gauge component
│   │   │   ├── ScoreCard.tsx
│   │   │   ├── IssueItem.tsx
│   │   │   └── ScanStatus.tsx        # Live scan progress
│   │   ├── issues/
│   │   │   ├── IssueDetail.tsx
│   │   │   ├── CodeDiff.tsx          # Before/after code view
│   │   │   └── FixButton.tsx
│   │   ├── packages/
│   │   │   └── PackageRow.tsx
│   │   ├── trend/
│   │   │   └── HealthChart.tsx       # Recharts wrapper
│   │   └── billing/
│   │       └── PlanCard.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server-side Supabase client
│   │   ├── api.ts                    # Typed fetch wrapper for backend
│   │   ├── hooks/
│   │   │   ├── useRealtimeScan.ts    # Supabase Realtime subscription
│   │   │   ├── useHealthScore.ts
│   │   │   └── usePlan.ts            # Plan gating hook
│   │   └── utils/
│   │       ├── severity.ts           # Severity color/label helpers
│   │       └── format.ts             # Date, number formatters
│   │
│   ├── types/
│   │   └── database.ts               # Auto-generated Supabase types
│   │
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── .env.local.example
│
├── shared/                           # Shared types (if needed)
│   └── types.ts
│
├── supabase/
│   ├── migrations/                   # SQL migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_indexes.sql
│   └── seed.sql                      # Dev seed data
│
├── .github/
│   └── workflows/
│       ├── backend-tests.yml
│       └── deploy.yml
│
├── .gitignore
└── README.md
Database Schema (Supabase / PostgreSQL)
This is the most important design decision in the whole project. I spent the most time on this.

sql

-- ============================================================
-- MIGRATION 001: INITIAL SCHEMA
-- ============================================================
-- Users extended profile (Supabase Auth handles base auth)
CREATE TABLE public.user_profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name     TEXT,
    plan          TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
    github_token  TEXT,                    -- Encrypted GitHub OAuth token
    slack_webhook TEXT,                    -- Team tier: Slack alerts URL
    razorpay_sub_id TEXT,                  -- Active Razorpay subscription ID
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);
-- GitHub repositories connected by user
CREATE TABLE public.repositories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    github_repo_id  BIGINT NOT NULL,       -- GitHub's internal repo ID
    full_name       TEXT NOT NULL,         -- e.g. "mathivanan/saas-app"
    default_branch  TEXT NOT NULL DEFAULT 'main',
    language        TEXT,                  -- Primary language detected
    is_private      BOOLEAN DEFAULT FALSE,
    last_scanned_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, github_repo_id)
);
-- Individual scan runs
CREATE TABLE public.scans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id),
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    trigger         TEXT NOT NULL DEFAULT 'manual'
                    CHECK (trigger IN ('push', 'manual', 'scheduled', 'pr')),
    commit_sha      TEXT,                  -- Git commit that triggered this scan
    branch          TEXT,
    health_score    INTEGER,               -- 0-100, set on completion
    total_issues    INTEGER DEFAULT 0,
    critical_count  INTEGER DEFAULT 0,
    high_count      INTEGER DEFAULT 0,
    medium_count    INTEGER DEFAULT 0,
    low_count       INTEGER DEFAULT 0,
    error_message   TEXT,                  -- Set if status = 'failed'
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- Individual security issues found in a scan
CREATE TABLE public.issues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id             UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    repo_id             UUID NOT NULL REFERENCES public.repositories(id),
    user_id             UUID NOT NULL REFERENCES public.user_profiles(id),
    -- From Semgrep
    semgrep_rule_id     TEXT NOT NULL,     -- e.g. "owasp.bola.missing-auth"
    severity            TEXT NOT NULL
                        CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    file_path           TEXT NOT NULL,     -- e.g. "src/api/users.js"
    line_start          INTEGER,
    line_end            INTEGER,
    code_snippet        TEXT,              -- The vulnerable code
    -- From Claude AI
    plain_english_title TEXT,              -- "Anyone can read any user's data"
    plain_english_body  TEXT,              -- The explanation paragraph
    impact_bullets      JSONB,             -- Array of impact strings
    ai_fix_code         TEXT,              -- The suggested fixed code
    ai_explanation_cached BOOLEAN DEFAULT FALSE,
    -- Status
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'fixed', 'dismissed', 'pr_opened')),
    fix_pr_url          TEXT,              -- GitHub PR URL if fix was opened
    dismissed_reason    TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);
-- Package safety scan results
CREATE TABLE public.package_scans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id         UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    repo_id         UUID NOT NULL REFERENCES public.repositories(id),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id),
    package_name    TEXT NOT NULL,
    package_manager TEXT NOT NULL CHECK (package_manager IN ('npm', 'pip', 'cargo')),
    status          TEXT NOT NULL
                    CHECK (status IN ('safe', 'suspect', 'dangerous', 'unknown')),
    exists_in_registry  BOOLEAN,
    weekly_downloads    BIGINT,
    registry_created_at TIMESTAMPTZ,
    alternative_name    TEXT,              -- e.g. "@supabase/supabase-js"
    reason              TEXT,              -- Why flagged
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- Health score history (one row per scan, for trend charts)
CREATE TABLE public.health_score_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id     UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
    scan_id     UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    score       INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now()
);
-- Claude explanation cache (avoid duplicate API calls)
CREATE TABLE public.ai_explanation_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key       TEXT UNIQUE NOT NULL,  -- hash(rule_id + code_snippet)
    plain_english_title TEXT NOT NULL,
    plain_english_body  TEXT NOT NULL,
    impact_bullets      JSONB,
    ai_fix_code         TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- Billing events log
CREATE TABLE public.billing_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id),
    event_type      TEXT NOT NULL,         -- e.g. "subscription.activated"
    razorpay_payload JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- ============================================================
-- MIGRATION 002: ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_scans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_score_history ENABLE ROW LEVEL SECURITY;
-- Users can only see their own data
CREATE POLICY "Users own their profiles"
    ON public.user_profiles FOR ALL
    USING (auth.uid() = id);
CREATE POLICY "Users own their repos"
    ON public.repositories FOR ALL
    USING (auth.uid() = user_id);
CREATE POLICY "Users own their scans"
    ON public.scans FOR ALL
    USING (auth.uid() = user_id);
CREATE POLICY "Users own their issues"
    ON public.issues FOR ALL
    USING (auth.uid() = user_id);
CREATE POLICY "Users own their package scans"
    ON public.package_scans FOR ALL
    USING (auth.uid() = user_id);
CREATE POLICY "Users own their score history"
    ON public.health_score_history FOR ALL
    USING (
        repo_id IN (
            SELECT id FROM public.repositories WHERE user_id = auth.uid()
        )
    );
-- ============================================================
-- MIGRATION 003: INDEXES
-- ============================================================
CREATE INDEX idx_scans_repo_id           ON public.scans(repo_id);
CREATE INDEX idx_scans_status            ON public.scans(status);
CREATE INDEX idx_issues_scan_id          ON public.issues(scan_id);
CREATE INDEX idx_issues_repo_id          ON public.issues(repo_id);
CREATE INDEX idx_issues_severity         ON public.issues(severity);
CREATE INDEX idx_issues_status           ON public.issues(status);
CREATE INDEX idx_pkg_scans_scan_id       ON public.package_scans(scan_id);
CREATE INDEX idx_health_history_repo_id  ON public.health_score_history(repo_id);
CREATE INDEX idx_ai_cache_key            ON public.ai_explanation_cache(cache_key);
Backend — Every API Endpoint
Auth (handled by Supabase — no custom endpoints needed)
All backend routes require a Supabase JWT passed as Authorization: Bearer <token>. The FastAPI middleware verifies this JWT using Supabase's JWT secret.


GET  /health                         → Server health check (no auth)
POST /webhook/github                 → GitHub App push/PR webhook (HMAC verified)
GET  /repos                          → List connected repos for current user
POST /repos                          → Connect a new GitHub repo
DELETE /repos/{repo_id}              → Disconnect a repo
POST /scans/trigger/{repo_id}        → Manually trigger a scan (queue job)
GET  /scans/{repo_id}                → List scans for a repo
GET  /scans/{scan_id}/status         → Poll scan status (for SSE or polling)
GET  /issues                         → All issues (filterable: severity, status, repo_id)
GET  /issues/{issue_id}              → Single issue with full AI explanation
POST /issues/{issue_id}/fix          → Trigger GitHub PR creation for this issue
POST /issues/{issue_id}/dismiss      → Mark issue as dismissed with reason
GET  /packages/{scan_id}             → Package safety results for a scan
GET  /health-score/{repo_id}         → Current score + last scan summary
GET  /health-score/{repo_id}/trend   → Score history (last 30 days)
POST /billing/create-subscription    → Create Razorpay subscription, return checkout URL
POST /billing/webhook                → Razorpay webhook (HMAC verified)
GET  /billing/status                 → Current plan + subscription details
GET  /reports/soc2/{repo_id}         → Generate SOC 2 readiness data (Team+)
POST /reports/soc2/{repo_id}/export  → Generate PDF report (Team+)
Backend — Service Layer Implementation
github_service.py — The Hardest Part
python

"""
Responsibilities:
- Authenticate as GitHub App using JWT
- Install token per repo (short-lived, 1hr)
- Clone repo to temp dir safely
- Create fix PRs via Octokit REST
"""
class GitHubService:
    def get_installation_token(self, installation_id: int) -> str:
        """
        GitHub App authentication flow:
        1. Sign a JWT with the App's private key (RS256)
        2. POST to /app/installations/{id}/access_tokens
        3. Returns a short-lived token (60 min)
        Cache this token per installation_id.
        """
    def clone_repo(self, full_name: str, token: str, branch: str) -> str:
        """
        Shallow clone to /tmp/debtmap-scans/{scan_id}/
        Use depth=1 for speed (we don't need history).
        Returns path to cloned directory.
        Always clean up in a finally block.
        """
        # git clone --depth=1 --branch {branch}
        #   https://x-access-token:{token}@github.com/{full_name}.git
        #   /tmp/debtmap-scans/{scan_id}
    def create_fix_pr(
        self,
        repo_full_name: str,
        token: str,
        issue: Issue,
        fixed_code: str
    ) -> str:
        """
        1. GET file contents at issue.file_path (get SHA for update)
        2. Compute the new file contents (apply fix)
        3. Create branch: debtmap/fix-{issue.id[:8]}
        4. PUT file with new contents + commit message
        5. POST pull_request: base=main, head=debtmap/fix-{id}
        Returns: PR HTML URL
        """
semgrep_service.py — The Scanning Core
python

"""
Strategy:
- Run semgrep as subprocess with --json output
- Use curated ruleset: p/owasp-top-ten + p/secrets + p/supply-chain
- Set hard timeout (60s) and max file size limits
- Parse output into our Issue models
"""
SEMGREP_RULESETS = [
    "p/owasp-top-ten",    # Authentication, injection, broken access control
    "p/secrets",           # Hardcoded API keys, passwords
    "p/supply-chain",      # Dependency confusion, package safety
]
SEVERITY_MAP = {
    "ERROR":   "critical",
    "WARNING": "high",
    "INFO":    "medium",
}
class SemgrepService:
    def run_scan(self, repo_path: str) -> list[RawFinding]:
        """
        subprocess.run([
            "semgrep", "--config", "p/owasp-top-ten",
            "--config", "p/secrets",
            "--json",
            "--timeout", "60",
            "--max-target-bytes", "1000000",  # Skip files >1MB
            "--no-git-ignore",
            repo_path
        ])
        Parse stdout JSON → list of RawFinding objects
        """
    def parse_findings(self, semgrep_json: dict) -> list[RawFinding]:
        """
        semgrep output structure:
        {
          "results": [
            {
              "check_id": "owasp.A01.broken-access-control",
              "path": "src/api/users.js",
              "start": {"line": 47},
              "end":   {"line": 52},
              "extra": {
                "severity": "ERROR",
                "lines": "app.get('/api/users/:id', ...)"
              }
            }
          ]
        }
        """
claude_service.py — The Core Value Proposition
python

"""
Critical design decisions:
1. CACHE aggressively. Same rule + same code → same explanation.
   Cache key = SHA256(rule_id + normalize(code_snippet))
2. Only explain Critical + High on Free. All on Pro.
3. Batch calls — process all issues for a scan in parallel (max 5 concurrent)
4. Structured output — use Claude's JSON mode to ensure parseable response
"""
SYSTEM_PROMPT = """
You are a security advisor for non-technical founders who built apps
using AI coding tools (Lovable, Bolt, Cursor). Your job is to explain
security issues in plain English — absolutely no jargon, no CVSS scores,
no CVE numbers unless the user asks.
Always respond in this exact JSON structure:
{
  "title": "Short title (max 10 words, plain English, e.g. 'Anyone can read your users data')",
  "explanation": "2-3 sentence plain English explanation of what's wrong. Use 'your app' not 'the code'.",
  "impact_bullets": ["What attacker could do #1", "What attacker could do #2", "Legal/business consequence"],
  "fixed_code": "The complete fixed version of the provided code snippet"
}
"""
class ClaudeService:
    async def explain_issue(
        self,
        rule_id: str,
        code_snippet: str,
        file_path: str
    ) -> ClaudeExplanation:
        """
        1. Compute cache_key = sha256(rule_id + code_snippet)
        2. Check ai_explanation_cache table
        3. If cache hit → return cached explanation (FREE API CALL AVOIDED)
        4. If cache miss → call Claude API
        5. Store result in cache table
        6. Return explanation
        """
    async def explain_batch(
        self,
        findings: list[RawFinding],
        max_concurrent: int = 5
    ) -> list[ClaudeExplanation]:
        """
        Use asyncio.Semaphore(max_concurrent) to limit parallel calls.
        Prioritise Critical > High > Medium (skip Low on Free plan).
        """
package_service.py — Slopsquatting Detection
python

"""
Algorithm:
1. Parse all package files in the repo
2. For each package, query npm/PyPI registry
3. Classify based on: exists?, downloads?, age?, name similarity?
"""
DANGER_THRESHOLDS = {
    "min_weekly_downloads": 100,      # Below this = suspect
    "max_age_days_new": 30,           # Created in last 30 days = suspect if low downloads
    "name_similarity_threshold": 0.85 # Very similar to popular package = suspect
}
class PackageService:
    def parse_package_files(self, repo_path: str) -> list[str]:
        """
        Check for: package.json, requirements.txt, pyproject.toml, Pipfile
        Parse and return list of all package names.
        """
    async def validate_npm_package(self, name: str) -> PackageResult:
        """
        GET https://registry.npmjs.org/{name}
        404 → DANGEROUS (doesn't exist)
        200 → check weekly downloads from /downloads/point/last-week/{name}
        """
    async def validate_pypi_package(self, name: str) -> PackageResult:
        """
        GET https://pypi.org/pypi/{name}/json
        404 → DANGEROUS
        200 → check upload_time of latest version
        """
    def classify_package(self, registry_data: dict) -> PackageStatus:
        """
        DANGEROUS: doesn't exist in registry
        SUSPECT:   exists but <100 weekly downloads OR <30 days old
                   OR name similarity to popular package > 0.85
        SAFE:      exists, >100 weekly downloads, established
        """
health_service.py — Score Calculation
python

"""
Health score is a product decision, not just a math problem.
It needs to feel right to a non-technical founder.
Design principle: a single CRITICAL issue should always feel alarming.
"""
SCORE_WEIGHTS = {
    "critical":           -20,
    "high":               -8,
    "medium":             -3,
    "low":                -1,
    "pkg_dangerous":      -15,
    "pkg_suspect":        -5,
}
# Cap total deduction per category (so 100 criticals doesn't go to -1000)
CATEGORY_CAPS = {
    "critical": -60,   # max -60 from criticals (3 criticals = game over)
    "high":     -40,
    "medium":   -20,
    "low":      -10,
}
def calculate_health_score(
    issues: list[Issue],
    packages: list[PackageScan]
) -> int:
    score = 100
    for severity, weight in SCORE_WEIGHTS.items():
        count = count_by_severity(issues, packages, severity)
        deduction = max(count * weight, CATEGORY_CAPS.get(severity, -999))
        score += deduction  # weight is negative
    return max(0, min(100, score))
scan_worker.py — The Orchestrator Job (Background)
This is the main job that runs in the Redis Queue worker. It ties everything together.

python

def run_full_scan(scan_id: str):
    """
    This function runs in a background RQ worker process.
    Steps:
    1.  Load scan + repo + user from Supabase
    2.  Update scan.status = 'running' → broadcast via Realtime
    3.  Get GitHub installation token for repo
    4.  Clone repo to /tmp/debtmap-scans/{scan_id}/
    5.  Run Semgrep → list of raw findings
    6.  Run package validator → list of package results
    7.  Save raw findings to issues table (status: open, no AI yet)
    8.  Broadcast partial results via Supabase Realtime (user sees issues appearing)
    9.  Batch call Claude API for Critical + High issues (respect plan limits)
    10. Update issues with AI explanations
    11. Calculate health score from all issues
    12. Update scan: status='completed', health_score=X, counts=Y
    13. Insert row into health_score_history
    14. Clean up /tmp/debtmap-scans/{scan_id}/
    15. Trigger alert_worker if new critical issues found
    16. Broadcast final completion via Supabase Realtime
    
    On any unhandled exception:
    - Update scan.status = 'failed', scan.error_message = str(e)
    - Clean up temp dir
    - Log to monitoring
    """
Frontend — Page by Page Implementation
Page 1: /dashboard — Main Dashboard
Data fetching: Server component fetches latest scan + issues on load. Supabase Realtime subscription in a client component updates the scan status live during active scans.

Key components:

ScanStatus — shows "Scanning..." with a progress indicator via Realtime
AlertBanner — pulls latest Critical issues, auto-hides when resolved
ScoreCard × 4 — Health Score, Open Issues, Critical Count, Fixed This Month
HealthScoreGauge × N — one per connected repo (the ring gauge with conic-gradient)
IssueItem × 3 — most recent critical issues with "Fix it" button
State management: No Zustand/Redux needed. Server components + Supabase Realtime hooks cover everything.

Page 2: /issues/[id] — Issue Detail + AI Fix
The most important page in the product.

Left panel:

Plain English title + explanation paragraph
Impact bullets (what could go wrong)
Severity badge with colour coding
Right panel:

Code diff viewer — before (red) / after (green) the fix
"Open fix as GitHub PR" → POST /issues/{id}/fix → returns PR URL → open in new tab
"Copy code" → clipboard API
"Dismiss" → modal asking for reason → POST /issues/{id}/dismiss
Implementation note: Use react-syntax-highlighter with a dark theme for the code panels. Don't build a custom code viewer.

Page 3: /packages — Slopsquatting Scanner
Straightforward table. Three states per row: Safe (green), Suspect (amber), Dangerous (red pulsing dot).

Key UX detail: the "What is slopsquatting?" explainer banner stays visible. Non-technical users need context. Don't hide it.

Page 4: /trend — Health Score Over Time
Two charts side by side using recharts:

AreaChart — health score over last 8 weeks (red fill going down)
BarChart — issues introduced vs. fixed per week (stacked red/green)
Data comes from health_score_history table, joined with scan issue counts.

Page 5: /soc2 — SOC 2 Readiness (Team Tier Gate)
Plan gate: If user.plan !== 'team' && user.plan !== 'enterprise' → show upgrade prompt, not the actual page.

SOC 2 control mapping logic lives in the backend report_service.py. The frontend just renders the response. Each control shows: control ID, description, status (Passing/Failing/Partial), and which specific issues are causing it to fail.

PDF export: POST /reports/soc2/{repo_id}/export → backend generates PDF via weasyprint → stores in Supabase Storage → returns signed URL → frontend opens in new tab.

Page 6: /repos/connect — GitHub OAuth + Repo Selection
Flow:

User clicks "Connect GitHub"
Redirect to GitHub OAuth: https://github.com/apps/debtmap/installations/new
GitHub redirects back with installation_id
Backend exchanges for installation token, fetches list of accessible repos
Show checkbox list of repos → user picks which ones to monitor
POST /repos for each selected repo
Trigger initial scan for each
Feature Gating — Plan Limits Config
typescript

// lib/plan-limits.ts — Single source of truth for all plan gates
export const PLAN_LIMITS = {
  free: {
    max_repos: 1,
    scan_frequency: 'weekly',
    ai_explanations: false,
    slopsquatting: false,
    one_click_pr: false,
    soc2_report: false,
    slack_alerts: false,
    email_alerts: false,
    trend_chart: false,
  },
  pro: {
    max_repos: Infinity,
    scan_frequency: 'on_push',
    ai_explanations: true,
    slopsquatting: true,
    one_click_pr: true,
    soc2_report: false,
    slack_alerts: false,
    email_alerts: true,
    trend_chart: true,
  },
  team: {
    max_repos: Infinity,
    scan_frequency: 'on_push_and_pr',
    ai_explanations: true,
    slopsquatting: true,
    one_click_pr: true,
    soc2_report: true,
    slack_alerts: true,
    email_alerts: true,
    trend_chart: true,
  },
} as const;
// Usage in any component:
// const { plan } = usePlan();
// if (!PLAN_LIMITS[plan].soc2_report) return <UpgradePrompt feature="SOC 2 Report" />;
Environment Variables
Backend .env
bash

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Service role — backend only, never expose
# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=your-webhook-secret
# Claude API
ANTHROPIC_API_KEY=sk-ant-...
# Redis (for RQ job queue)
REDIS_URL=redis://localhost:6379
# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=alerts@debtmap.io
# App
APP_URL=https://app.debtmap.io
ENVIRONMENT=production
Frontend .env.local
bash

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Anon key — safe to expose
NEXT_PUBLIC_API_URL=https://api.debtmap.io
Infrastructure & Deployment
Layer	Service	Why
Frontend	Vercel (free → pro)	Zero-config Next.js deployment. Edge network.
Backend API	Railway	Easy Python deployment. $5/month. Supports background workers.
Redis Queue	Railway (Redis addon)	Same cluster as backend. Minimal latency.
Database	Supabase (free → pro)	Postgres + RLS + Realtime + Auth all-in-one.
File Storage	Supabase Storage	PDF reports stored here. S3-compatible.
Monitoring	Sentry (free tier)	Catch worker crashes, API errors. Critical for a security tool.
Domain	Cloudflare	debtmap.io — DNS + SSL + DDoS protection.
CI/CD: GitHub Actions → on push to main:

Run Python tests (pytest)
Run TypeScript type check (tsc --noEmit)
Deploy backend to Railway
Deploy frontend to Vercel (auto via Vercel GitHub integration)
Security — We Must Eat Our Own Cooking
A security tool with a security vulnerability is a dead company. Non-negotiable:

Never store raw GitHub tokens in plaintext — encrypt with AES-256 before writing to DB
Temp repo clones — always in /tmp/, always deleted in finally block, never accessible via HTTP
Supabase RLS on every table — no exceptions, tested with a second user account in dev
Webhook HMAC verification — both GitHub and Razorpay webhooks must verify signature before processing
Rate limiting on scan endpoints — 10 scans/hour per user on Free, 100/hour on Pro
Semgrep timeout + file size limits — prevent DoS via large repos
No AI-generated code auto-merged — PR is always created for human review, never auto-merged
Audit log — every fix action, plan change, and report export logged to billing_events
The Build Order — What I Code First
This is the order I'd actually code things, not the order they appear in the UI:


WEEK 1 (Days 1–7): The Core Pipeline
├── Day 1-2: Project setup (monorepo, envs, Supabase schema, Railway + Vercel)
├── Day 3-4: GitHub App registration + webhook handler + repo cloning
├── Day 5-6: Semgrep service + scan worker (no AI yet, just raw findings)
└── Day 7: Basic Next.js dashboard (static UI, no real data yet)
WEEK 2 (Days 8–14): Making It Smart + Secure
├── Day 8-9: Claude service + caching layer (plain English explanations)
├── Day 10: Package slopsquatting detector
├── Day 11: Health score algorithm
└── Day 12-14: Connect frontend to real data (dashboard, issues list)
WEEK 3 (Days 15–21): Making It Shippable
├── Day 15-16: GitHub OAuth + repo connect flow
├── Day 17-18: Supabase Auth (magic link login)
├── Day 19: Razorpay billing + plan gating
└── Day 20-21: Email alerts (Resend) + scan status Realtime
WEEK 4 (Days 22–30): Polish + Launch
├── Day 22-23: Issue detail page + Code diff view
├── Day 24-25: Health trend charts (Recharts)
├── Day 26: Slopsquatting page
├── Day 27-28: Bug fixes, edge cases, error states
├── Day 29: Write launch post for Lovable/Bolt Discord
└── Day 30: Launch. Target 15 paying Pro users.
Phase 2 Features (Days 31–60) — After First Revenue
Once I have paying customers and proof that the core loop works:

One-click GitHub PR — github_service.create_fix_pr() + FixButton component wiring
PR-level scanning — webhook on pull_request event + Team tier gate
SOC 2 readiness report — report_service.py + weasyprint PDF + /soc2 page
Slack alerts — alert_service.py + slack_sdk + webhook URL per team
Health score trend chart — Recharts AreaChart on /trend page
GitHub Marketplace listing — submit for review (takes 2–3 weeks)
ProductHunt launch — schedule for Day 45
Phase 3 Features (Days 61–90) — Scale
VS Code extension — separate TypeScript project, scans on save
White-label mode — custom logo + domain for agency resellers
Lovable/Bolt integration — outreach to partnership team with traction numbers
Shareable report URL — public debtmap.io/report/{token} for investor DD
Weekly security newsletter — automated from scan data (Resend + cron)
Key Metrics to Track from Day 1

Product Health:
- Scan success rate (target: >95%)
- Median scan duration (target: <45 seconds)
- AI explanation cache hit rate (target: >40% after month 1)
- False positive rate (track dismissals)
Business Health:
- Free → Pro conversion rate (target: >8%)
- MRR (target: ₹60K by Day 30, ₹1L by Day 90)
- Repos connected per user (proxy for activation)
- Weekly active users (users who viewed dashboard)
What I'm Most Worried About
In order of losing sleep:

GitHub App approval taking longer than expected — Mitigation: use direct install links for first 30 days, apply for marketplace listing immediately.

The PR fix feature creating bad patches — Mitigation: ship it in Phase 2, not MVP. Get feedback on explanation quality first. Never auto-merge.

Claude explanation quality being generic — This is 80% of the product. I will personally write and test 20 different prompt variations against real Lovable/Bolt repos before shipping.

One big repo causing an OOM crash in the worker — Mitigation: --max-target-bytes in Semgrep, 60s timeout, and Railway auto-restarts workers.

Our own Supabase being misconfigured — I will run a full RLS audit using a second test account before launch. A security tool with a security flaw is game over.

Implementation Overview — DebtMap · Mathivanan G · June 2026
"Ship fast. Secure your own stack first."