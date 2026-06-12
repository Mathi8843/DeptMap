"""
Groq AI explanation service.
Takes a raw Semgrep finding and returns:
- plain_english_title: one-line title a non-developer understands
- plain_english_body: 2-3 sentence plain English explanation
- impact_bullets: 3 bullet points of real-world consequences
- ai_fix_code: corrected version of the vulnerable code

Uses Groq Chat Completions API via httpx.
Falls back to intelligent rule-based explanations if API key is not set.
"""
import json
import logging
import re
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Rule-based fallbacks (work without Groq key) ────────────────────────────
# Maps Semgrep rule ID keywords → human-readable explanations
# These cover the most common vulnerability patterns from vibe-coded apps
RULE_FALLBACKS: dict[str, dict] = {
    "sql-injection": {
        "title": "Search box can be used to steal your entire database",
        "body": "Your app builds database queries by directly combining user input with SQL code. An attacker can type special characters into a search box or URL to read, modify, or delete any data in your database — including all user accounts and payment details.",
        "bullets": [
            "Attacker can read every user's email, password hash, and personal data",
            "Attacker can delete all records or modify prices/balances",
            "GDPR/DPDP violation — mandatory breach notification required",
        ],
        "fix_hint": "Use parameterized queries or an ORM (e.g., Prisma, SQLAlchemy). Never concatenate user input into SQL strings.",
    },
    "hardcoded-secret": {
        "title": "Your secret API key or password is visible in the source code",
        "body": "A password, API key, or secret token has been written directly into the code. Anyone who can see your GitHub repository or the deployed app files can steal these credentials and use them.",
        "bullets": [
            "Attacker can use your API key to rack up charges on your account",
            "Third-party services (Stripe, Twilio, etc.) can be fully accessed",
            "GitHub automatically scans and flags exposed secrets — public repos trigger alerts",
        ],
        "fix_hint": "Move the secret to a .env file. Use os.environ.get() or process.env. Never commit .env files to git.",
    },
    "missing-auth": {
        "title": "Anyone can access this page or action without logging in",
        "body": "This API route or page has no authentication check. Any person on the internet — without an account — can call this endpoint and perform actions meant only for logged-in users.",
        "bullets": [
            "Strangers can view, modify, or delete other users' data",
            "Admin-only actions accessible to anyone with the right URL",
            "User trust destroyed if discovered — major churn risk",
        ],
        "fix_hint": "Add authentication middleware to this route. Check for a valid session token before processing the request.",
    },
    "broken-object": {
        "title": "Users can read or edit other users' private data",
        "body": "Your app uses an ID from the URL or request body to fetch data but doesn't check if the logged-in user actually owns that data. User 1 can change the ID in the URL to 2 and access User 2's private information.",
        "bullets": [
            "Any user can read any other user's orders, messages, or profile",
            "Billing data, addresses, and private content exposed",
            "Classic IDOR vulnerability — in top 10 most exploited web flaws",
        ],
        "fix_hint": "Always filter database queries by the authenticated user's ID: WHERE user_id = current_user.id",
    },
    "xss": {
        "title": "Attackers can inject malicious scripts that run in your users' browsers",
        "body": "Your app displays user-provided content without sanitizing it. An attacker can post a comment or fill a form field with JavaScript code that then runs in other users' browsers — stealing their session tokens and taking over their accounts.",
        "bullets": [
            "Attacker can steal login cookies and impersonate any user",
            "Fake login forms injected into your pages to harvest passwords",
            "Can redirect users to phishing sites automatically",
        ],
        "fix_hint": "Escape all user-generated content before rendering it in HTML. Use your framework's safe rendering methods (e.g., React's JSX auto-escapes by default).",
    },
    "insecure-direct": {
        "title": "File or resource paths can be manipulated to access unauthorized files",
        "body": "Your app uses user input to construct file paths or resource locations without validating them. An attacker can use special path characters like `../` to navigate outside the intended directory and access sensitive system files.",
        "bullets": [
            "Server configuration files and .env files could be read",
            "Access to other users' uploaded files",
            "In severe cases, system files like /etc/passwd accessible",
        ],
        "fix_hint": "Validate that the resolved path starts with the expected base directory. Use path.resolve() and check with path.startsWith(baseDir).",
    },
    "cors": {
        "title": "Any website on the internet can make requests to your API as your users",
        "body": "Your API allows requests from any origin (website). This means a malicious website can make API calls to your backend on behalf of your logged-in users — reading their data or performing actions without their knowledge.",
        "bullets": [
            "Malicious sites can read authenticated user data from your API",
            "Actions (payments, deletions) can be triggered from third-party sites",
            "Session tokens exploited without user interaction",
        ],
        "fix_hint": "Set CORS to only allow your specific frontend domain. Never use wildcard (*) origin in production with credentials enabled.",
    },
    "command-injection": {
        "title": "Attackers can run any command on your server",
        "body": "Your app passes user input directly to a system shell command. An attacker can add extra shell commands using characters like `;`, `&&`, or `|` — gaining full control of your server.",
        "bullets": [
            "Complete server takeover — attacker can install malware",
            "All data on the server can be stolen or destroyed",
            "Server used to attack other systems (DDoS, spam)",
        ],
        "fix_hint": "Never use shell=True with user input. Use subprocess with a list of arguments, not a string. Validate all input before using in system calls.",
    },
    "prototype-pollution": {
        "title": "Malicious data can corrupt your application's core JavaScript objects",
        "body": "Your code merges or copies objects without checking for dangerous keys like `__proto__` or `constructor`. An attacker can send specially crafted JSON that modifies the base JavaScript Object prototype, potentially bypassing security checks or crashing your app.",
        "bullets": [
            "Authentication checks can be bypassed in some configurations",
            "Application crashes or undefined behavior for all users",
            "Can escalate to Remote Code Execution in Node.js environments",
        ],
        "fix_hint": "Use Object.create(null) for lookup objects, or validate that merged objects don't contain __proto__, constructor, or prototype keys.",
    },
    "cleartext": {
        "title": "Sensitive data is being sent or stored without encryption",
        "body": "Passwords, tokens, or sensitive information are being transmitted or stored in plain text. Anyone intercepting network traffic or reading the database can see this data directly.",
        "bullets": [
            "Passwords readable by anyone with database access",
            "Network traffic interception exposes user credentials",
            "Regulatory violation — GDPR requires encryption of personal data",
        ],
        "fix_hint": "Hash passwords with bcrypt. Use HTTPS for all traffic. Encrypt sensitive fields before storing in the database.",
    },
}


def _match_fallback(rule_id: str) -> dict | None:
    """Match a Semgrep rule ID to a known fallback explanation."""
    rule_lower = rule_id.lower()
    for keyword, data in RULE_FALLBACKS.items():
        if keyword in rule_lower:
            return data
    return None


def _generic_fallback(finding: dict) -> dict:
    """Generate a generic explanation when no specific rule match exists."""
    rule_id = finding.get("semgrep_rule_id", "")
    severity = finding.get("severity", "medium")
    file_path = finding.get("file_path", "your code")

    # Make a readable title from the rule ID
    rule_parts = rule_id.split(".")
    readable = rule_parts[-1].replace("-", " ").replace("_", " ") if rule_parts else "security issue"

    return {
        "plain_english_title": f"Security issue detected: {readable}",
        "plain_english_body": (
            f"A {severity}-severity security issue was found in `{file_path}`. "
            f"The scanner detected a pattern that could allow attackers to compromise your application. "
            f"Review the flagged code and consult a developer to assess the impact."
        ),
        "impact_bullets": [
            f"Potential {severity} security vulnerability in {file_path}",
            "Could expose user data or application functionality to attackers",
            "Recommend developer review before deploying to production",
        ],
        "ai_fix_code": finding.get("code_snippet", "# Manual review required"),
    }


def get_client() -> str | None:
    """Get Groq API key. Returns None if no API key is configured."""
    key = settings.groq_api_key
    if not key or key == "gsk-your-key-here" or key.strip() == "":
        return None
    return key.strip()


SYSTEM_PROMPT = """You are a security advisor for DebtMap, a tool that helps non-technical startup founders understand code vulnerabilities.

Your job is to explain security issues in plain English that a non-developer can understand and act on. Avoid technical jargon, CVE numbers, and acronyms unless you explain them simply.

Always respond with valid JSON only — no markdown, no prose outside the JSON object.
"""

USER_PROMPT_TEMPLATE = """A static analysis scanner found this security issue in a founder's codebase.

Semgrep Rule: {rule_id}
Severity: {severity}
File: {file_path}, Lines {line_start}-{line_end}
Raw scanner message: {raw_message}

Vulnerable code:
```
{code_snippet}
```

Explain this to a non-technical founder and provide a fix. Respond with this exact JSON structure:
{{
  "plain_english_title": "A title in 8 words or less that explains what's broken in human terms (e.g. 'Anyone can read any user\\'s data')",
  "plain_english_body": "2-3 sentences explaining the vulnerability as if talking to a non-developer. Use real-world impact language.",
  "impact_bullets": [
    "First real-world consequence",
    "Second consequence",
    "Third consequence"
  ],
  "ai_fix_code": "The corrected version of the code snippet with the vulnerability fixed."
}}"""


async def explain_finding(finding: dict) -> dict:
    """
    Explain a Semgrep finding in plain English.
    
    Priority:
    0. Already explained (bypass)
    1. Groq API (if key is configured)
    2. Rule-based fallback (if rule matches our table)
    3. Generic fallback
    """
    if finding.get("plain_english_title"):
        return {
            "plain_english_title": finding["plain_english_title"],
            "plain_english_body": finding.get("plain_english_body", ""),
            "impact_bullets": finding.get("impact_bullets", []),
            "ai_fix_code": finding.get("ai_fix_code", finding.get("code_snippet", "")),
        }

    api_key = get_client()

    if api_key:
        # Use Groq AI
        try:
            prompt = USER_PROMPT_TEMPLATE.format(
                rule_id=finding.get("semgrep_rule_id", "unknown"),
                severity=finding.get("severity", "unknown"),
                file_path=finding.get("file_path", "unknown"),
                line_start=finding.get("line_start", 0),
                line_end=finding.get("line_end", 0),
                raw_message=finding.get("_raw_message", "No message available"),
                code_snippet=finding.get("code_snippet", "No code available"),
            )
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "model": settings.groq_model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"].strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                result = json.loads(content)
                return result
        except Exception as e:
            logger.error(f"Groq API call failed: {e} — falling back to rule table")

    # Fallback: rule-based explanation
    matched = _match_fallback(finding.get("semgrep_rule_id", ""))
    if matched:
        logger.info(f"Using rule-based fallback for: {finding.get('semgrep_rule_id')}")
        return {
            "plain_english_title": matched["title"],
            "plain_english_body": matched["body"],
            "impact_bullets": matched["bullets"],
            "ai_fix_code": f"# AI Fix Tip: {matched['fix_hint']}\n\n" + finding.get("code_snippet", ""),
        }

    # Last resort: generic
    return _generic_fallback(finding)


async def explain_findings_batch(findings: list[dict], max_concurrent: int = 3) -> list[dict]:
    """
    Explain multiple findings. Batches Groq calls to respect rate limits.
    Falls back gracefully if Groq is unavailable.
    """
    import asyncio

    enriched = []
    has_groq = get_client() is not None
    mode = "Groq AI" if has_groq else "rule-based fallback (no Groq key)"
    logger.info(f"Explaining {len(findings)} findings using {mode}")

    for i in range(0, len(findings), max_concurrent):
        batch = findings[i:i + max_concurrent]
        tasks = [explain_finding(f) for f in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for finding, result in zip(batch, results):
            if isinstance(result, Exception):
                logger.error(f"explain_finding raised: {result}")
                result = _generic_fallback(finding)

            enriched.append({
                **finding,
                "plain_english_title": result.get("plain_english_title", "Security issue detected"),
                "plain_english_body": result.get("plain_english_body", ""),
                "impact_bullets": result.get("impact_bullets", []),
                "ai_fix_code": result.get("ai_fix_code", finding.get("code_snippet", "")),
            })

        if has_groq and i + max_concurrent < len(findings):
            await asyncio.sleep(0.5)

    return enriched
