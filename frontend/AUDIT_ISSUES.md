# Frontend Audit Issues

## Architecture

- [x] **A1. Monolithic AppContext** — Deleted. Replaced by 5 focused contexts (Theme, Toast, Auth, Data, Scan) with memoized values. No cascading re-renders.
- [ ] **A2. No API rewrites** — `next.config.ts` has no rewrites. API calls construct full URLs to backend port. CORS + mixed content risk.
- [x] **A3. No error boundaries** — Zero React error boundaries. A single crash kills the whole UI.
- [x] **A4. No loading/error/404 pages** — Missing `loading.tsx`, `error.tsx`, `not-found.tsx` at route level.

## Re-render & Performance

- [x] **P1. Frequent context updates** — Context values memoized with `useMemo`. Each consumer imports only the hooks it needs — scan ticks no longer re-render non-scan components.
- [x] **P2. Eager recharts import** — Sparkline and trend chart components dynamically loaded via `next/dynamic` with `{ ssr: false }`.
- [x] **P3. Render-blocking font loading** — Migrated to `next/font/google` with CSS custom properties. `@import` removed from `globals.css`.
- [x] **P4. Hardcoded sparkline data** — Sparkline data now derives from backend `/trend` endpoint, falling back to static data when unavailable.

## State Bugs

- [x] **S1. Stale closure in fixIssueSimulate** — `DataContext.tsx` now reads `issuesRef.current` instead of stale closure `issues`.
- [x] **S2. Stale closure in dismissIssue** — `DataContext.tsx` now reads `issuesRef.current` instead of stale closure `issues`.
- [x] **S3. triggerScan interval leak** — `ScanContext.tsx` interval stored in `pollIntervalRef`, cleared by unmount cleanup effect and on scan completion/failure.
- [x] **S4. Auth callback setTimeout leak** — all `setTimeout` calls collected in a `timers` array; `useEffect` cleanup clears every timer on unmount.

## Invalid CSS

- [x] **C1. text-glow-rose** — Added `.text-glow-rose` utility to `globals.css` with `text-shadow`.
- [x] **C2. glow-indigo/5, glow-amber/5, glow-rose/5, glow-purple/10** — Added `.glow-indigo` and `.glow-purple` classes; removed non-functional `/5`, `/10` opacity suffixes.
- [x] **C3. active:scale-98** — Changed to `active:scale-[0.98]` in `soc2/page.tsx`.
- [x] **C4. Fractional Tailwind values** — `px-4.5` → `px-[1.125rem]`, `h-5.5` → `h-[1.375rem]`, `gap-4.5` → `gap-[1.125rem]`, `w-4.5` → `w-[1.125rem]`, `translate-x-4.5` → `translate-x-[1.125rem]`. `py-5.5` never existed — no-op.
- [x] **C5. Tailwind v3 config vestigial** — Deleted `tailwind.config.ts`. All config is in `@theme` within `globals.css`.

## UI/UX

- [x] **U1. Simulated export** — Replaced `alert` with a real JSON export: `handleExport` builds a structured report and triggers a file download.
- [x] **U2. Issue detail silent fallback** — Removed `|| issues[0]` fallback; shows the error UI when issue ID not found, with a warning toast.
- [x] **U3. Notification toggles not persisted** — State initialises from `localStorage["debtmap_notifications"]` and syncs on change via `useEffect`.
- [x] **U4. user.name[0] no empty guard** — `settings/page.tsx` now uses `user.name ? user.name[0] : "?"` (sidebar was already guarded).
- [x] **U5. Razorpay hardcoded to Pro** — Plan name/description and post-verification `plan` field are now driven by `selectedPlanKey`.

## Accessibility

- [x] **X1. No skip-to-content link** — Added skip-to-content link in root layout, visible on focus; `id="main-content"` on dashboard `<main>` element.
- [x] **X2. Toggle switches lack ARIA** — All 4 toggle buttons in settings now have `role="switch"`, `aria-checked`, and `aria-label`.
- [x] **X3. Potential contrast issues** — Dark theme `--text-muted` changed to `#94a3b8` (8.3:1 on bg), light theme to `#475569` (6.6:1 on bg). Both pass WCAG AA comfortably.

## Dead Code & Quality

- [x] **D1. Unused variables** — Removed `DEMO_REPOS` and `MOCK_FALLBACK_REPOS` from `onboarding/page.tsx`.
- [x] **D2. statusMessage unused** — Now rendered below the GitHub connect button on Step 1.
- [x] **D3. No API timeout** — `apiFetch` wraps `fetch` with `AbortController` and a 30-second default timeout; throws `"Request timed out"` on abort.
- [x] **D4. Inconsistent error handling** — Replaced the two remaining `alert()` calls in the dashboard (connect error + empty export) with `showToast`.

## Auth & Security

- [ ] **H1. localStorage session token** — XSS-vulnerable. Should use httpOnly cookies for production.
- [ ] **H2. Missing CSRF protection** — `credentials: "include"` on every request with no CSRF token.
