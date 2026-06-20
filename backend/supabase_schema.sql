-- ═══════════════════════════════════════════════════════════════
-- DebtMap — Supabase Database Schema
-- Run this in Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Note: Supabase Auth handles the auth.users table automatically.
-- This is our extended profile table.

CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id       TEXT UNIQUE,
    email           TEXT NOT NULL,
    name            TEXT,
    avatar_url      TEXT,
    github_access_token TEXT,  -- Store encrypted in production
    plan            TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
    plan_expires_at TIMESTAMPTZ,
    is_admin        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Repositories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.repos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    github_repo_id  BIGINT UNIQUE NOT NULL,
    full_name       TEXT NOT NULL,           -- e.g. "mathivanan/saas-app"
    language        TEXT,
    default_branch  TEXT DEFAULT 'main',
    is_private      BOOLEAN DEFAULT true,
    last_scanned_at TIMESTAMPTZ,
    health_score    INTEGER DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    critical_count  INTEGER DEFAULT 0,
    high_count      INTEGER DEFAULT 0,
    medium_count    INTEGER DEFAULT 0,
    low_count       INTEGER DEFAULT 0,
    generator       TEXT DEFAULT 'Unknown',  -- Lovable, Bolt, Cursor, etc.
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repos_user_id ON public.repos(user_id);

-- ── Scans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'retrying')),
    triggered_at    TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    findings_count  INTEGER DEFAULT 0,
    trigger_source  TEXT DEFAULT 'manual',   -- 'manual' | 'webhook:push:main'
    progress        INTEGER DEFAULT 0,
    log_messages    JSONB DEFAULT '[]'::jsonb,
    retry_count     INTEGER DEFAULT 0,        -- number of retries attempted
    heartbeat_at    TIMESTAMPTZ,              -- last worker heartbeat (for crash detection)
    error_message   TEXT                      -- last error detail for debugging
);

CREATE INDEX IF NOT EXISTS idx_scans_repo_id ON public.scans(repo_id);

-- ── Security Issues ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.issues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id             UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    scan_id             UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    semgrep_rule_id     TEXT NOT NULL,
    severity            TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    file_path           TEXT NOT NULL,
    line_start          INTEGER NOT NULL,
    line_end            INTEGER NOT NULL,
    code_snippet        TEXT,
    plain_english_title TEXT,
    plain_english_body  TEXT,
    impact_bullets      JSONB DEFAULT '[]'::jsonb,   -- Array of strings
    ai_fix_code         TEXT,
    status              TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'fixed', 'dismissed')),
    fix_pr_url          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_repo_id ON public.issues(repo_id);
CREATE INDEX IF NOT EXISTS idx_issues_scan_id ON public.issues(scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_status  ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON public.issues(severity);

-- ── Packages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.packages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id             UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    scan_id             UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    package_name        TEXT NOT NULL,
    package_manager     TEXT NOT NULL CHECK (package_manager IN ('npm', 'pypi', 'unknown')),
    status              TEXT NOT NULL DEFAULT 'unknown'
                            CHECK (status IN ('safe', 'suspect', 'dangerous', 'unknown')),
    exists_in_registry  BOOLEAN DEFAULT false,
    weekly_downloads    INTEGER,
    reason              TEXT,
    alternative_name    TEXT,
    checked_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_repo_id ON public.packages(repo_id);

-- ── Health Score History ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id         UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    introduced_count INTEGER DEFAULT 0,
    fixed_count      INTEGER DEFAULT 0,
    recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_history_repo_id ON public.health_history(repo_id);

-- ════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- Every query is automatically scoped to the authenticated user.
-- Users can ONLY see their own data — enforced at database level.
-- ════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_history ENABLE ROW LEVEL SECURITY;

-- Note: Our backend uses the SERVICE ROLE KEY which bypasses RLS.
-- These policies apply when frontend uses the ANON KEY with user JWT.

-- Users can only read their own profile
CREATE POLICY "users_own_profile" ON public.users
    FOR ALL USING (id = auth.uid());

-- Users can only see their own repos
CREATE POLICY "repos_own_data" ON public.repos
    FOR ALL USING (user_id = auth.uid());

-- Issues visible only through repo ownership
CREATE POLICY "issues_own_data" ON public.issues
    FOR ALL USING (
        repo_id IN (
            SELECT id FROM public.repos
            WHERE user_id = auth.uid()
        )
    );

-- Packages visible only through repo ownership
CREATE POLICY "packages_own_data" ON public.packages
    FOR ALL USING (
        repo_id IN (
            SELECT id FROM public.repos
            WHERE user_id = auth.uid()
        )
    );

-- Health history visible only through repo ownership
CREATE POLICY "health_history_own_data" ON public.health_history
    FOR ALL USING (
        repo_id IN (
            SELECT id FROM public.repos
            WHERE user_id = auth.uid()
        )
    );

-- Scans visible only through repo ownership
CREATE POLICY "scans_own_data" ON public.scans
    FOR ALL USING (
        repo_id IN (
            SELECT id FROM public.repos
            WHERE user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════════
-- Issue #2 Migration (run once after schema is created)
-- ═══════════════════════════════════════════════════════════════
-- ALTER TABLE public.scans
--   ADD COLUMN IF NOT EXISTS retry_count  INTEGER DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
--   ADD COLUMN IF NOT EXISTS error_message TEXT;
--
-- ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS scans_status_check;
-- ALTER TABLE public.scans
--   ADD CONSTRAINT scans_status_check
--     CHECK (status IN ('queued', 'running', 'completed', 'failed', 'retrying'));

-- ═══════════════════════════════════════════════════════════════
-- Issue #6 Migration (run once after schema is created)
-- ═══════════════════════════════════════════════════════════════
-- ALTER TABLE public.users
--   ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
--
-- -- Grant admin to existing admin emails:
-- UPDATE public.users SET is_admin = TRUE
-- WHERE email IN ('mathi@debtmap.io', 'admin@debtmap.io');
