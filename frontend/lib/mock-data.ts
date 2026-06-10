// Mock data for the DebtMap frontend — replace with real API calls later

export const mockUser = {
  id: "usr_01",
  name: "Mathivanan G",
  email: "mathi@debtmap.io",
  plan: "pro" as "free" | "pro" | "team" | "enterprise",
};

export const mockRepos = [
  {
    id: "repo_01",
    full_name: "mathivanan/saas-app",
    language: "TypeScript",
    default_branch: "main",
    is_private: true,
    last_scanned_at: "2026-06-10T10:48:00Z",
    health_score: 34,
    critical_count: 2,
    high_count: 5,
    medium_count: 2,
    low_count: 3,
    generator: "Lovable",
  },
  {
    id: "repo_02",
    full_name: "mathivanan/api-backend",
    language: "Python",
    default_branch: "main",
    is_private: true,
    last_scanned_at: "2026-06-10T10:48:00Z",
    health_score: 78,
    critical_count: 0,
    high_count: 1,
    medium_count: 4,
    low_count: 2,
    generator: "Cursor",
  },
  {
    id: "repo_03",
    full_name: "mathivanan/landing-page",
    language: "JavaScript",
    default_branch: "main",
    is_private: false,
    last_scanned_at: "2026-06-10T10:48:00Z",
    health_score: 96,
    critical_count: 0,
    high_count: 0,
    medium_count: 1,
    low_count: 0,
    generator: "Bolt",
  },
];

export const mockIssues = [
  {
    id: "iss_01",
    repo_id: "repo_01",
    repo_name: "saas-app",
    semgrep_rule_id: "owasp.A01.bola-missing-ownership-check",
    severity: "critical" as const,
    file_path: "src/api/users.js",
    line_start: 47,
    line_end: 53,
    code_snippet: `app.get('/api/users/:id', async (req, res) => {
  const user = await db.users.find({ id: req.params.id });
  res.json(user); // ← no auth check!
});`,
    plain_english_title: "Anyone can read any user's data",
    plain_english_body:
      "Your user profile endpoint doesn't check if the person asking is actually the account owner. Any logged-in user can change the ID in the URL and read someone else's profile, messages, or payment info.",
    impact_bullets: [
      "Users' emails, phone numbers, and addresses are exposed",
      "Subscription status and payment history visible to anyone",
      "GDPR / DPDP violation — potential legal liability",
    ],
    ai_fix_code: `app.get('/api/users/:id', requireAuth, async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const user = await db.users.find({ id: req.params.id });
  res.json(user);
});`,
    status: "open" as const,
    fix_pr_url: null,
    created_at: "2026-06-10T10:48:00Z",
  },
  {
    id: "iss_02",
    repo_id: "repo_01",
    repo_name: "saas-app",
    semgrep_rule_id: "owasp.A02.hardcoded-secret",
    severity: "critical" as const,
    file_path: "src/payment.js",
    line_start: 12,
    line_end: 14,
    code_snippet: `const stripe = require('stripe');
const client = stripe('sk_live_AbCdEfGhIjKlMnOpQrStUvWx');
// ← hardcoded secret key!`,
    plain_english_title: "Your Stripe secret key is visible to everyone",
    plain_english_body:
      "Your payment secret key is written directly into your code file. Anyone who views your GitHub repository or the deployed JavaScript can see it and make charges to your Stripe account.",
    impact_bullets: [
      "Attacker can make unlimited charges to your Stripe account",
      "Stripe will suspend your account if detected",
      "Customer payment data could be compromised",
    ],
    ai_fix_code: `// Move to environment variable
const stripe = require('stripe');
const client = stripe(process.env.STRIPE_SECRET_KEY);`,
    status: "open" as const,
    fix_pr_url: null,
    created_at: "2026-06-10T10:50:00Z",
  },
  {
    id: "iss_03",
    repo_id: "repo_01",
    repo_name: "saas-app",
    semgrep_rule_id: "owasp.A03.sql-injection",
    severity: "high" as const,
    file_path: "src/api/search.js",
    line_start: 23,
    line_end: 27,
    code_snippet: `const results = await db.query(
  \`SELECT * FROM products WHERE name LIKE '%\${req.query.q}%'\`
);`,
    plain_english_title: "Search box can be used to steal your database",
    plain_english_body:
      "Your search feature passes user input directly into the database query without any safety checks. An attacker can type a special query into your search box and read, modify, or delete your entire database.",
    impact_bullets: [
      "Full database contents readable by anyone",
      "All user data, passwords, and private records exposed",
      "Database can be completely deleted with one request",
    ],
    ai_fix_code: `const results = await db.query(
  'SELECT * FROM products WHERE name LIKE ?',
  [\`%\${req.query.q}%\`]
);`,
    status: "open" as const,
    fix_pr_url: null,
    created_at: "2026-06-10T10:52:00Z",
  },
  {
    id: "iss_04",
    repo_id: "repo_01",
    repo_name: "saas-app",
    semgrep_rule_id: "owasp.A07.missing-auth-on-admin",
    severity: "high" as const,
    file_path: "src/api/admin.js",
    line_start: 8,
    line_end: 15,
    code_snippet: `app.get('/api/admin/users', async (req, res) => {
  const users = await db.users.findAll();
  res.json(users); // no admin check!
});`,
    plain_english_title: "Admin panel is accessible without logging in",
    plain_english_body:
      "Your admin endpoint that lists all users has no authentication check. Anyone who knows the URL can access your entire user list without needing an account.",
    impact_bullets: [
      "Complete user list with emails accessible publicly",
      "Admin features can be exploited without credentials",
      "Violates GDPR data access principles",
    ],
    ai_fix_code: `app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);
});`,
    status: "fixed" as const,
    fix_pr_url: "https://github.com/mathivanan/saas-app/pull/42",
    created_at: "2026-06-09T14:22:00Z",
  },
  {
    id: "iss_05",
    repo_id: "repo_02",
    repo_name: "api-backend",
    semgrep_rule_id: "owasp.A02.cors-wildcard",
    severity: "high" as const,
    file_path: "main.py",
    line_start: 18,
    line_end: 22,
    code_snippet: `app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← allows ALL origins
    allow_methods=["*"],
)`,
    plain_english_title: "Any website can make requests to your API",
    plain_english_body:
      "Your API is configured to accept requests from any website on the internet. This means malicious websites can make requests to your API pretending to be a logged-in user.",
    impact_bullets: [
      "Any website can make authenticated requests on behalf of your users",
      "CSRF attacks become trivially easy",
      "User sessions can be hijacked by malicious sites",
    ],
    ai_fix_code: `app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.yoursite.com"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_credentials=True,
)`,
    status: "open" as const,
    fix_pr_url: null,
    created_at: "2026-06-10T09:15:00Z",
  },
  {
    id: "iss_06",
    repo_id: "repo_01",
    repo_name: "saas-app",
    semgrep_rule_id: "owasp.A05.missing-rate-limit",
    severity: "medium" as const,
    file_path: "src/api/auth.js",
    line_start: 5,
    line_end: 12,
    code_snippet: `app.post('/api/auth/login', async (req, res) => {
  const user = await db.users.findByEmail(req.body.email);
  if (!user || user.password !== hash(req.body.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // no rate limiting!
});`,
    plain_english_title: "Login page has no brute force protection",
    plain_english_body:
      "Your login endpoint doesn't limit how many times someone can try wrong passwords. An attacker can try millions of password combinations automatically until they break into any account.",
    impact_bullets: [
      "Accounts can be broken into by trying many passwords",
      "No alerting when suspicious login attempts occur",
      "Password guessing attacks will succeed on weak passwords",
    ],
    ai_fix_code: `const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  // ... rest of handler
});`,
    status: "open" as const,
    fix_pr_url: null,
    created_at: "2026-06-10T10:53:00Z",
  },
];

export const mockPackages = [
  {
    id: "pkg_01",
    package_name: "express-auth-middleware-pro",
    package_manager: "npm",
    status: "dangerous" as const,
    exists_in_registry: false,
    weekly_downloads: 0,
    reason: "AI-generated · Not found in npm registry",
    alternative_name: "passport",
  },
  {
    id: "pkg_02",
    package_name: "supabase-rls-helper",
    package_manager: "npm",
    status: "dangerous" as const,
    exists_in_registry: false,
    weekly_downloads: 0,
    reason: "Hallucinated · Use @supabase/supabase-js instead",
    alternative_name: "@supabase/supabase-js",
  },
  {
    id: "pkg_03",
    package_name: "next-api-validator",
    package_manager: "npm",
    status: "suspect" as const,
    exists_in_registry: true,
    weekly_downloads: 12,
    reason: "Possibly hallucinated · Only 12 weekly downloads",
    alternative_name: "zod",
  },
  {
    id: "pkg_04",
    package_name: "express",
    package_manager: "npm",
    status: "safe" as const,
    exists_in_registry: true,
    weekly_downloads: 50000000,
    reason: "Verified · 50M weekly downloads",
    alternative_name: null,
  },
  {
    id: "pkg_05",
    package_name: "@supabase/supabase-js",
    package_manager: "npm",
    status: "safe" as const,
    exists_in_registry: true,
    weekly_downloads: 2400000,
    reason: "Verified · Official Supabase SDK",
    alternative_name: null,
  },
  {
    id: "pkg_06",
    package_name: "stripe",
    package_manager: "npm",
    status: "safe" as const,
    exists_in_registry: true,
    weekly_downloads: 9800000,
    reason: "Verified · Official Stripe SDK",
    alternative_name: null,
  },
  {
    id: "pkg_07",
    package_name: "react",
    package_manager: "npm",
    status: "safe" as const,
    exists_in_registry: true,
    weekly_downloads: 240000000,
    reason: "Verified · 240M weekly downloads",
    alternative_name: null,
  },
  {
    id: "pkg_08",
    package_name: "axios",
    package_manager: "npm",
    status: "safe" as const,
    exists_in_registry: true,
    weekly_downloads: 90000000,
    reason: "Verified · Official axios package",
    alternative_name: null,
  },
];

export const mockHealthHistory = [
  { date: "Apr 1", score: 80, introduced: 2, fixed: 1 },
  { date: "Apr 8", score: 75, introduced: 3, fixed: 2 },
  { date: "Apr 15", score: 68, introduced: 4, fixed: 1 },
  { date: "Apr 22", score: 62, introduced: 5, fixed: 2 },
  { date: "May 1", score: 55, introduced: 4, fixed: 1 },
  { date: "May 8", score: 47, introduced: 6, fixed: 3 },
  { date: "May 15", score: 41, introduced: 5, fixed: 2 },
  { date: "Jun 1", score: 38, introduced: 3, fixed: 1 },
  { date: "Jun 10", score: 34, introduced: 2, fixed: 1 },
];

export const mockSoc2Controls = [
  {
    id: "CC6.1",
    name: "Logical and physical access controls",
    status: "failing" as const,
    issues: ["BOLA in /api/users/:id", "Admin endpoint unprotected"],
  },
  {
    id: "CC6.6",
    name: "Encryption in transit and at rest",
    status: "partial" as const,
    issues: ["CORS wildcard allows all origins"],
  },
  {
    id: "CC7.2",
    name: "System monitoring and alerting",
    status: "failing" as const,
    issues: ["No rate limiting on login", "No anomaly detection"],
  },
  {
    id: "CC8.1",
    name: "Change management (code review process)",
    status: "passing" as const,
    issues: [],
  },
  {
    id: "CC9.2",
    name: "Vendor risk management",
    status: "failing" as const,
    issues: ["3 hallucinated packages detected"],
  },
  {
    id: "A1.1",
    name: "Performance and availability monitoring",
    status: "passing" as const,
    issues: [],
  },
  {
    id: "PI1.1",
    name: "Privacy notice and consent management",
    status: "partial" as const,
    issues: ["No cookie consent implementation found"],
  },
  {
    id: "CC5.2",
    name: "Security awareness training documentation",
    status: "passing" as const,
    issues: [],
  },
];

export const PLAN_LIMITS = {
  free: {
    max_repos: 1,
    scan_frequency: "weekly",
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
    scan_frequency: "on_push",
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
    scan_frequency: "on_push_and_pr",
    ai_explanations: true,
    slopsquatting: true,
    one_click_pr: true,
    soc2_report: true,
    slack_alerts: true,
    email_alerts: true,
    trend_chart: true,
  },
  enterprise: {
    max_repos: Infinity,
    scan_frequency: "on_push_and_pr",
    ai_explanations: true,
    slopsquatting: true,
    one_click_pr: true,
    soc2_report: true,
    slack_alerts: true,
    email_alerts: true,
    trend_chart: true,
  },
} as const;
