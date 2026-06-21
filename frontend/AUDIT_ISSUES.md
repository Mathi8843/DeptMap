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

- [ ] **X1. No skip-to-content link** — Missing keyboard navigation skip link.
- [ ] **X2. Toggle switches lack ARIA** — Custom toggles lack `role="switch"` and `aria-checked`.
- [ ] **X3. Potential contrast issues** — `text-text-muted` (#64748b) on dark bg (#06060c) may fail WCAG AA.

## Dead Code & Quality

- [ ] **D1. Unused variables** — `DEMO_REPOS`, `MOCK_FALLBACK_REPOS` defined but unused in `onboarding/page.tsx`.
- [ ] **D2. statusMessage unused** — Set but never displayed in onboarding UI.
- [ ] **D3. No API timeout** — `apiFetch` hangs indefinitely if backend doesn't respond.
- [ ] **D4. Inconsistent error handling** — Mix of `showToast`, `alert()`, `console.error`, inline state.

## Auth & Security

- [ ] **H1. localStorage session token** — XSS-vulnerable. Should use httpOnly cookies for production.
- [ ] **H2. Missing CSRF protection** — `credentials: "include"` on every request with no CSRF token.
