# DebtMap — Feature Roadmap & Implementation Tracker

> **DebtMap** is a SaaS security dashboard for non-technical founders that monitors code health,
> detects vulnerabilities, audits dependencies, and generates SOC 2 compliance reports — all
> presented in plain English without needing to understand code.
>
> **Frontend: COMPLETE (mock data)** | Next: Build FastAPI + Semgrep + Claude backend

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed & Shipped |
| 🔧 | Partially implemented / Needs polish |
| ⬜ | Not yet started |

---

## Phase 1 — Foundation & Core Layout ✅

- ✅ **Next.js 15 Project Setup** — App Router, TypeScript, Tailwind CSS v4
- ✅ **Global Design System** — Custom CSS variables for Dark/Light theming (`globals.css`)
- ✅ **Typography System** — Inter (body), Outfit (headings), Fira Code (monospace)
- ✅ **Dark / Light Theme Toggle** — `html.light` class strategy, synced via `AppContext`
- ✅ **Sidebar Navigation** — Active link state, section grouping (Overview / Manage), repo quick-access list
- ✅ **App-level Context (`AppContext.tsx`)** — Global state: repos, issues, packages, toasts, webhooks, theme
- ✅ **Mock Data Layer (`mock-data.ts`)** — Realistic simulated repos, issues, packages, user
- ✅ **Toast Notification System** — Animated slide-in toasts with auto-dismiss
- ✅ **Connect Repository Modal** — Simulated GitHub/GitLab repo connection flow

---

## Phase 2 — Dashboard & Core Pages ✅

- ✅ **Dashboard Overview Page** (`/dashboard`)
  - ✅ Overall security health score (circular SVG gauge)
  - ✅ Summary stat cards (open issues, critical, packages, repos)
  - ✅ Sparkline trend charts (Recharts)
  - ✅ Live Webhook Alert feed panel
  - ✅ Workspace CLI Terminal (animated scan log simulation)
  - ✅ Audit Scanner trigger with progress bar
- ✅ **Issues List Page** (`/issues`)
  - ✅ Filter by severity (critical / high / medium / low)
  - ✅ Filter by status (open / fixed / dismissed)
  - ✅ Search by title or repo name
  - ✅ Severity color-coded badges
- ✅ **Issue Detail Page** (`/issues/[id]`)
  - ✅ Plain-English vulnerability explanation
  - ✅ Impact bullet list
  - ✅ Code snippet viewer (dark code block)
  - ✅ AI-generated fix code block with diff view
  - ✅ One-click "Apply Fix" → simulated PR creation + webhook trigger
  - ✅ Dismiss vulnerability action
- ✅ **Packages / Dependency Audit Page** (`/packages`)
  - ✅ Color-coded package safety status (safe / suspect / dangerous / unknown)
  - ✅ Registry verification badge
  - ✅ Weekly downloads indicator
  - ✅ Actions: Verify, Replace with Safe Alternative, Ignore
- ✅ **Repositories Page** (`/repos`)
  - ✅ Health score per repository with color coding
  - ✅ Issue counts breakdown (critical / high / medium / low)
  - ✅ Last scanned timestamp
  - ✅ Language and privacy badges
  - ✅ Per-repo scan trigger
- ✅ **Trend Analytics Page** (`/trend`)
  - ✅ Historical health score line chart
  - ✅ Issues-over-time bar chart
  - ✅ Recharts integration with gradient fills

---

## Phase 3 — Compliance & Reporting 🔧

- ✅ **SOC 2 Report Page** (`/soc2`)
  - ✅ Compliance status checklist (CC, A, PI criteria)
  - ✅ Evidence summary per category
  - ✅ Overall compliance score bar
- ⬜ **Downloadable PDF Report** — Export SOC 2 summary as a branded PDF
- ⬜ **Evidence Timestamps** — Per-check last-verified date with audit trail
- ⬜ **SOC 2 Gap Analysis** — Show which criteria are failing and why, with recommended fixes

---

## Phase 4 — Settings & User Management 🔧

- ✅ **Settings Page** (`/settings`)
  - ✅ User profile section (name, email, avatar display)
  - ✅ Billing plan display and upgrade CTA
- ⬜ **Notification Preferences** — Configure which events trigger Slack/email alerts
- ⬜ **Webhook Endpoint Configuration** — User-defined webhook URLs for Slack / Teams / custom
- ⬜ **API Key Management** — Generate and revoke personal API tokens
- ⬜ **Team Member Invites** — Add teammates by email (Team/Enterprise plan)
- ⬜ **Connected OAuth Apps** — View/revoke GitHub, GitLab, Bitbucket OAuth connections

---

## Phase 5 — Onboarding & Growth ⬜

- ⬜ **Welcome Onboarding Flow** — Multi-step wizard for first-time users (connect repo → first scan → view results)
- ⬜ **Empty State Screens** — Friendly zero-data states when no repos are connected
- ⬜ **Plan Comparison Modal** — Visual plan comparison (Free / Pro / Team / Enterprise)
- ⬜ **Referral / Share Feature** — Share security score badge publicly or with investors

---

## Phase 6 — Advanced Features ⬜

- ⬜ **Real GitHub OAuth Integration** — Connect actual GitHub accounts via OAuth2
- ⬜ **Real Semgrep Scan Engine** — Server-side code scanning with Semgrep rules
- ⬜ **AI Fix Generation (GPT-4)** — Live AI-generated remediation code via OpenAI API
- ⬜ **CI/CD Badge Widget** — Embeddable security health badge for GitHub READMEs
- ⬜ **Scheduled Scans** — Cron-based daily/weekly automatic re-scans
- ⬜ **Slack Bot Integration** — Two-way Slack bot: query issues, trigger scans from Slack
- ⬜ **Audit History Log** — Full timestamped log of every scan, fix, and user action
- ⬜ **Multi-Org Support** — Switch between multiple organizations in one account

---

## Phase 7 — Performance & Polish ⬜

- ⬜ **Mobile Responsive Layout** — Sidebar collapse, touch-friendly cards on small screens
- ⬜ **Keyboard Shortcuts** — Power-user hotkeys (e.g. `S` to scan, `F` to filter)
- ⬜ **Accessibility (WCAG AA)** — ARIA labels, focus rings, color-contrast validation
- ⬜ **Skeleton Loading States** — Shimmer placeholders while data fetches
- ⬜ **Error Boundaries** — Graceful fallback UI for crashed components
- ⬜ **SEO / Meta Tags** — Page-level title/description tags for all routes

---

## Immediate Next Steps (Priority Queue)

1. ⬜ Polish Settings page — add Notification Preferences and Webhook config UI
2. ⬜ Add SOC 2 Gap Analysis section with actionable fix suggestions
3. ⬜ Add Mobile Responsive layout (sidebar collapse)
4. ⬜ Add Skeleton loading states for data-heavy pages
5. ⬜ Implement Welcome Onboarding Flow for first-time users
6. ⬜ Downloadable PDF Report for SOC 2

---

*Last updated: 2026-06-10 | Track this file across sessions to monitor progress.*
