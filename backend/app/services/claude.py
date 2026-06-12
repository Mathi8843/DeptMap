"""
Claude AI explanation service.
Takes a raw Semgrep finding and returns:
- plain_english_title: one-line title a non-developer understands
- plain_english_body: 2-3 sentence plain English explanation
- impact_bullets: 3 bullet points of real-world consequences
- ai_fix_code: corrected version of the vulnerable code

Uses Claude 3.5 Sonnet via the Anthropic Python SDK.
Structured JSON output via Claude's response format.
"""
import json
import logging
from anthropic import Anthropic, APIError
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Anthropic client (singleton-style, thread-safe)
_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


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
  "plain_english_title": "A title in 8 words or less that explains what's broken in human terms (e.g. 'Anyone can read any user's data')",
  "plain_english_body": "2-3 sentences explaining the vulnerability as if talking to a non-developer. Use real-world impact language. Explain what an attacker could do, not what the code does wrong.",
  "impact_bullets": [
    "First real-world consequence (e.g. 'Users' emails and payment history visible to anyone')",
    "Second consequence (e.g. 'GDPR / DPDP violation — potential legal liability')",
    "Third consequence (e.g. 'If discovered publicly, users will leave immediately')"
  ],
  "ai_fix_code": "The corrected version of the code snippet with the vulnerability fixed. Keep it minimal — only change what's needed. Include a brief comment on the added line explaining what it does."
}}"""


async def explain_finding(finding: dict) -> dict:
    """
    Send a Semgrep finding to Claude and get back plain English explanation + fix.
    
    Args:
        finding: dict from semgrep.parse_findings()
    
    Returns:
        dict with keys: plain_english_title, plain_english_body, impact_bullets, ai_fix_code
    """
    prompt = USER_PROMPT_TEMPLATE.format(
        rule_id=finding.get("semgrep_rule_id", "unknown"),
        severity=finding.get("severity", "unknown"),
        file_path=finding.get("file_path", "unknown"),
        line_start=finding.get("line_start", 0),
        line_end=finding.get("line_end", 0),
        raw_message=finding.get("_raw_message", "No message available"),
        code_snippet=finding.get("code_snippet", "No code available"),
    )

    try:
        client = get_client()
        message = client.messages.create(
            model=settings.claude_model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract text content from Claude response
        content = message.content[0].text.strip()

        # Remove markdown code fences if Claude added them
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        result = json.loads(content)

        # Validate required fields
        required = ["plain_english_title", "plain_english_body", "impact_bullets", "ai_fix_code"]
        for field in required:
            if field not in result:
                raise ValueError(f"Claude response missing field: {field}")

        return result

    except (APIError, json.JSONDecodeError, ValueError, KeyError) as e:
        logger.error(f"Claude explanation failed for {finding.get('semgrep_rule_id')}: {e}")
        # Return safe fallback so the scan doesn't fail entirely
        return {
            "plain_english_title": _fallback_title(finding.get("semgrep_rule_id", "")),
            "plain_english_body": (
                f"A security issue was detected in {finding.get('file_path', 'your code')}. "
                f"The scanner identified a potential vulnerability that could affect your application's security. "
                f"Please review the code at line {finding.get('line_start', '?')} carefully."
            ),
            "impact_bullets": [
                "Security vulnerability detected — manual review required",
                "Could expose user data or application credentials",
                "Recommend consulting with a developer to assess impact",
            ],
            "ai_fix_code": finding.get("code_snippet", "# Review this code manually"),
        }


async def explain_findings_batch(findings: list[dict], max_concurrent: int = 3) -> list[dict]:
    """
    Explain multiple findings with rate limiting.
    Processes in batches to avoid Claude API rate limits.
    Returns the findings list with plain_english_* fields populated.
    """
    import asyncio

    enriched = []
    # Process in batches of max_concurrent
    for i in range(0, len(findings), max_concurrent):
        batch = findings[i:i + max_concurrent]
        tasks = [explain_finding(f) for f in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for finding, result in zip(batch, results):
            if isinstance(result, Exception):
                logger.error(f"Failed to explain finding: {result}")
                # Use the fallback from explain_finding's except block
                result = await explain_finding(finding)

            enriched.append({
                **finding,
                "plain_english_title": result.get("plain_english_title", "Security issue detected"),
                "plain_english_body": result.get("plain_english_body", ""),
                "impact_bullets": result.get("impact_bullets", []),
                "ai_fix_code": result.get("ai_fix_code", finding.get("code_snippet", "")),
            })

        # Small delay between batches to respect rate limits
        if i + max_concurrent < len(findings):
            await asyncio.sleep(0.5)

    return enriched


def _fallback_title(rule_id: str) -> str:
    """Generate a readable fallback title from a Semgrep rule ID."""
    # e.g. "javascript.express.security.audit.express-missing-auth" → "Missing auth security issue"
    parts = rule_id.split(".")
    last = parts[-1].replace("-", " ").replace("_", " ") if parts else "security issue"
    return f"Security issue: {last}"
