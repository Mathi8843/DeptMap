# Frontend Audit Issues

## Architecture

- [x] **A1. Monolithic AppContext** — `lib/AppContext.tsx` (721 lines) handles auth, data fetching, scanning, notifications, theme, webhooks. Every state change re-renders entire tree.
- [ ] **A2. No API rewrites** — `next.config.ts` has no rewrites. API calls construct full URLs to backend port. CORS + mixed content risk.
- [x] **A3. No error boundaries** — Zero React error boundaries. A single crash kills the whole UI.
- [x] **A4. No loading/error/404 pages** — Missing `loading.tsx`, `error.tsx`, `not-found.tsx` at route level.

## Re-render & Performance

- [ ] **P1. Frequent context updates** — `scanProgress`, `scanLogs`, `scanStatus`, `toasts` change frequently. All consumers (sidebar, dashboard, repos) re-render on every update.
- [ ] **P2. Eager recharts import** — Heavy chart library imported directly in client components. No dynamic import / lazy loading.
- [ ] **P3. Render-blocking font loading** — Google Fonts loaded via CSS `@import url(...)` in `globals.css` instead of `next/font`.
- [ ] **P4. Hardcoded sparkline data** — `dashboard/page.tsx:82-85` uses static arrays with no real data.

## State Bugs

- [ ] **S1. Stale closure in fixIssueSimulate** — `AppContext.tsx:542` reads `issues` from closure instead of functional setState.
- [ ] **S2. Stale closure in dismissIssue** — `AppContext.tsx:600` same pattern as S1.
- [ ] **S3. triggerScan interval leak** — `setInterval` inside `useCallback` with no cleanup on unmount.
- [ ] **S4. Auth callback setTimeout leak** — `auth/callback/page.tsx` has multiple `setTimeout` calls with incomplete cleanup.

## Invalid CSS

- [ ] **C1. text-glow-rose** — Used in dashboard, soc2, packages pages. Not a valid class.
- [ ] **C2. glow-indigo/5, glow-amber/5, glow-rose/5, glow-purple/10** — Custom glow classes don't include `indigo` or `purple` variants.
- [ ] **C3. active:scale-98** — `soc2/page.tsx:85` should be `active:scale-[0.98]`.
- [ ] **C4. Fractional Tailwind values** — `px-4.5`, `py-5.5`, `h-5.5`, `gap-4.5`, `bg-white/3`, `border-white/8` — may not work in Tailwind v4 without bracket notation.
- [ ] **C5. Tailwind v3 config vestigial** — `tailwind.config.ts` exists but v4 uses `@theme` in CSS. Confusing and unused.

## UI/UX

- [ ] **U1. Simulated export** — `dashboard/page.tsx:97` uses `alert("PDF report generated successfully (simulated download)")` with no real implementation.
- [ ] **U2. Issue detail silent fallback** — `issues/[id]/page.tsx:22` falls back to `issues[0]` if ID not found, showing wrong data with no warning.
- [ ] **U3. Notification toggles not persisted** — Settings notification state resets on page refresh.
- [ ] **U4. user.name[0] no empty guard** — `settings/page.tsx:260`, `sidebar:184` will crash if name is empty string.
- [ ] **U5. Razorpay hardcoded to Pro** — `settings/page.tsx:121` always charges "DebtMap Pro" regardless of selected plan.

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
