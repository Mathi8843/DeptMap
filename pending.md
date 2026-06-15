# Pending — Security Engines & Platform Features

Current state vs. the multi-engine security architecture vision.

**Implemented today:** Semgrep (static analysis) + custom HTTP registry checker (npm/PyPI) + Groq AI explanations + Git-based PR fix.

## 🔴 Layer 1 — Static Analysis (Incomplete)

| Engine | Status | Notes |
|--------|--------|-------|
| Semgrep | ✅ Done | `backend/app/services/semgrep.py` — `--config=auto`, 3k+ OWASP rules |
| CodeQL | ❌ Missing | No CodeQL CLI or GitHub Code Scanning integration |

**Pending:** Add CodeQL as a second static analyzer (runs alongside Semgrep, findings merged).

---

## 🔴 Layer 2 — Dependency Scanning (Partial)

| Engine | Status | Notes |
|--------|--------|-------|
| npm audit | ❌ Missing | Current `registry.py` does custom HTTP existence checks — does **not** run `npm audit` for known CVEs |
| pip-audit | ❌ Missing | No `pip-audit` CLI integration |
| OWASP Dependency Check | ❌ Missing | No Java dependency scanning |
| cargo audit | ❌ Missing | No Rust scanning |
| govulncheck | ❌ Missing | No Go scanning |
| CVE database lookup | ❌ Missing | Registry checker flags hallucinated/missing packages only — does not check for known CVEs in real packages |

**Current:** `backend/app/services/registry.py` checks npm/PyPI existence + weekly downloads. Detects AI-hallucinated packages but misses known-vulnerable versions.

**Pending:** Integrate `npm audit`, `pip-audit`, OWASP DC, cargo-audit, govulncheck. Add CVE matching (via OSV or NVD API) for all detected packages.

---

## 🔴 Layer 3 — Secret Detection (Missing)

| Engine | Status | Notes |
|--------|--------|-------|
| Gitleaks | ❌ Missing | No dedicated secrets scanner |
| TruffleHog | ❌ Missing | No dedicated secrets scanner |

**Current:** Semgrep rules catch some hardcoded secrets (generic patterns). No entropy-based scanning, no credential fingerprinting.

**Pending:** Integrate Gitleaks or TruffleHog as a parallel scanner. Add pre-commit/CLI secret scanning.

---

## 🔴 Layer 4 — Infrastructure Scanning (Missing)

| Engine | Status | Notes |
|--------|--------|-------|
| Trivy (Dockerfile) | ❌ Missing | No container image scanning |
| Trivy (Terraform/K8s) | ❌ Missing | No IaC misconfiguration scanning |
| GitHub Actions audit | ❌ Missing | No CI/CD pipeline security review |

**Pending:** Add Trivy or similar for Dockerfile, Terraform, K8s manifest, and CI/CD scanning.

---

## 🔴 Layer 5 — AI Code Smell Detection (Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Architecture review | ❌ Missing | No cross-file architectural analysis |
| Code smell detection | ❌ Missing | No detection of: 400-line functions, nested loops, duplicated logic, dead code |
| Maintainability scoring | ❌ Missing | No maintainability index or technical debt estimation |

**Current:** Groq LLM only explains Semgrep findings — it never reviews the codebase independently.

**Pending:** New `/api/analyze/code-smells` endpoint. Prompt LLM to review each file for architecture issues, duplicate logic, maintainability problems. Return structured JSON (file path, issue type, severity, suggestion).

---

## 🔴 Layer 6 — AI Vulnerability Review (Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Independent AI security review | ❌ Missing | LLM never scans code independently — only explains Semgrep findings |
| Zero-day / logic-flaw detection | ❌ Missing | No prompt asking LLM to find novel vulnerabilities beyond Semgrep rules |

**Pending:** New `/api/analyze/vulnerability-review` endpoint. Full file context → LLM prompted as "senior security engineer" to find exploitable logic flaws. Results merged with Semgrep findings in correlation engine.

---

## 🔴 Layer 7 — Repository Understanding (Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Cross-file dependency graph | ❌ Missing | No parsing of imports to build frontend→backend→DB→auth→payment maps |
| Service boundary detection | ❌ Missing | No understanding of middleware layers, auth flows, route hierarchies |
| Data flow mapping | ❌ Missing | No tracing of user input → sanitization → database write paths |

**Current:** Semgrep enrichment only reads imported files for context on single findings. No repository-wide architecture model.

**Pending:** Build a Repository Parser Engine that builds a dependency graph from imports/routes/middleware. Feed this graph into the AI Analysis Engine for reasoning about missing auth, broken access control, and data exposure paths.

---

## 🔴 Layer 8 — Risk Correlation Engine (Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Cross-engine correlation | ❌ Missing | Findings from different engines are never merged or correlated |
| Thematic risk grouping | ❌ Missing | "Auth system compromised" grouping does not exist |
| Attack-path analysis | ❌ Missing | No chain of vulnerabilities mapped to exploitation path |

**Current:** Issues are listed independently per-engine. A hardcoded JWT secret (Semgrep) + old JWT library (npm audit) + exposed API key (Gitleaks) → three separate issues, never correlated as "Authentication system compromised."

**Pending:** Build a Correlation Engine that groups related findings across engines by: affected component, data flow path, MITRE ATT&CK mapping, exploitability chain. Outputs correlated risk statements.

---

## 🔴 Layer 9 — AI Fix Generator (Partial)

| Feature | Status | Notes |
|---------|--------|-------|
| Single-file fix PR | ✅ Done | `backend/app/routers/issues.py` + `backend/app/services/github.py` |
| Multi-file fix | ❌ Missing | No support for changes spanning multiple files |
| Per-repo context injection | ❌ Missing | Fix prompt has project context but no repository-wide conventions |

**Pending:** Extend AI fix to handle multi-file patches. Add repository-wide convention injection into the fix prompt (framework choice, coding style, auth patterns in use).

---

## 🔴 Layer 10 — Verification Pipeline (Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Post-fix re-scan | ❌ Missing | No automated re-scan after fix is applied |
| Test runner integration | ❌ Missing | No test execution to verify fix doesn't break things |
| Lint check | ❌ Missing | No lint pass on generated fix code |
| Build check | ❌ Missing | No build validation before PR is opened |

**Current:** Fix PR is created immediately after AI generates the patch. No verification step exists.

**Pending:** Add a verification pipeline that: runs Semgrep on fixed code → runs linter → runs build → runs tests → only then creates PR. If any step fails, report failure and don't open PR.

---

## 🔴 Platform Features (Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Prioritized fix queue | ❌ Missing | Issues sorted by severity only — no business-context or exploitability scoring |
| Cross-repo dashboard | ❌ Missing | No aggregated view across all user's repos |
| CVE feed / advisory ingestion | ❌ Missing | No periodic CVE database sync |
| Scheduled recurring scans | ❌ Missing | Scans are manual-only (no cron/webhook-triggered periodic scans beyond push webhook) |
| API-first engine architecture | ❌ Missing | Engines are tight-coupled in `run_scan_pipeline` — no pluggable engine interface |
| Fix validation + rollback | ❌ Missing | No mechanism to validate a fix in production or roll it back |
| Real-time alerting pipeline | ❌ Missing | Webhook alerts are mocked in `AppContext` — no real Slack/email integration |

---

## 📋 Current Scan Pipeline (for reference)

```
clone → Semgrep → Groq enrichment → save issues → package registry check → health score
```

## 🏗️ Target Scan Pipeline

```
clone → Repository Parser Engine ─┐
                                  ├→ Static Analysis (Semgrep + CodeQL)
                                  ├→ Dependency Audit (npm audit, pip-audit, OWASP DC, cargo audit, govulncheck)
                                  ├→ Secret Detection (Gitleaks / TruffleHog)
                                  ├→ Infrastructure Scan (Trivy)
                                  ├→ AI Code Smell Review
                                  ├→ AI Vulnerability Review
                                  │
                                  └→ Correlation Engine ─→ Risk Scoring ─→ AI Fix ─→ Validation ─→ PR
```
