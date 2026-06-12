"""
Health score calculator.
Computes a 0–100 score per repository based on open issue severity.
Higher score = healthier codebase.

Formula:
  score = 100 - (28 × critical) - (14 × high) - (6 × medium) - (2 × low)
  Clamped to [0, 100]

This matches the scoring visible in the frontend mock data.
"""
from typing import Literal


WEIGHTS: dict[str, int] = {
    "critical": 28,
    "high": 14,
    "medium": 6,
    "low": 2,
}


def calculate_health_score(issues: list[dict]) -> int:
    """
    Calculate health score from a list of open issues.
    Each issue dict must have a 'severity' key.
    
    Returns integer 0-100.
    """
    open_issues = [i for i in issues if i.get("status") == "open"]

    deduction = sum(
        WEIGHTS.get(issue.get("severity", "low"), 2)
        for issue in open_issues
    )

    score = max(0, min(100, 100 - deduction))
    return score


def calculate_scores_by_severity(issues: list[dict]) -> dict:
    """
    Returns a breakdown dict for dashboard display.
    """
    open_issues = [i for i in issues if i.get("status") == "open"]
    return {
        "health_score": calculate_health_score(issues),
        "critical_count": sum(1 for i in open_issues if i.get("severity") == "critical"),
        "high_count": sum(1 for i in open_issues if i.get("severity") == "high"),
        "medium_count": sum(1 for i in open_issues if i.get("severity") == "medium"),
        "low_count": sum(1 for i in open_issues if i.get("severity") == "low"),
        "open_total": len(open_issues),
        "fixed_total": sum(1 for i in issues if i.get("status") == "fixed"),
    }


SOC2_CONTROL_MAPPING: dict[str, list[str]] = {
    "CC6.1": [
        "broken-object-level-authorization",
        "missing-authentication",
        "express-missing-auth",
        "jwt-none-alg",
        "hardcoded-credentials",
    ],
    "CC6.2": [
        "sql-injection",
        "nosql-injection",
        "command-injection",
        "path-traversal",
    ],
    "CC6.3": [
        "sensitive-data-exposure",
        "cleartext-transmission",
        "insecure-hash",
        "hardcoded-secret",
    ],
    "CC7.1": [
        "xss",
        "csrf",
        "cors-misconfiguration",
        "open-redirect",
    ],
    "CC7.2": [
        "vulnerable-dependency",
        "outdated-package",
        "prototype-pollution",
    ],
    "CC9.1": [
        "error-handling",
        "information-disclosure",
        "debug-enabled",
        "stack-trace-exposure",
    ],
}


def compute_soc2_status(issues: list[dict]) -> list[dict]:
    """
    Map open issues to SOC 2 Trust Services Criteria controls.
    Returns list of control status objects for the SOC 2 report page.
    """
    open_issues = [i for i in issues if i.get("status") == "open"]

    controls = []
    for control_id, rule_keywords in SOC2_CONTROL_MAPPING.items():
        # Find issues that match this control's rule keywords
        matching_issues = []
        for issue in open_issues:
            rule_id = issue.get("semgrep_rule_id", "").lower()
            if any(kw in rule_id for kw in rule_keywords):
                matching_issues.append(issue.get("plain_english_title", issue.get("semgrep_rule_id", "")))

        if len(matching_issues) == 0:
            status = "passing"
        elif len(matching_issues) <= 2:
            status = "partial"
        else:
            status = "failing"

        controls.append({
            "id": control_id,
            "name": _control_name(control_id),
            "status": status,
            "issues": matching_issues,
        })

    return controls


def _control_name(control_id: str) -> str:
    NAMES = {
        "CC6.1": "Logical and Physical Access Controls",
        "CC6.2": "Prior to Issuing System Credentials",
        "CC6.3": "Access Restriction for New Systems",
        "CC7.1": "Detection of Threats & Vulnerabilities",
        "CC7.2": "Response to Identified Vulnerabilities",
        "CC9.1": "Risk Mitigation Activities",
    }
    return NAMES.get(control_id, control_id)
