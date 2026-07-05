"""
Health score calculator.
Computes a 0–100 score per repository based on open issue severity.
Higher score = healthier codebase.

Formula (diminishing-returns per severity bucket):
  For each severity level, deduction = base_weight × √count  (rounded).
  Weights: critical=40, high=25, medium=12, low=5
  This means the 1st critical costs ~40pts, the 4th costs only ~20pts extra,
  avoiding the 0/100 cliff that discourages founders from fixing issues.
  Final score clamped to [0, 100].
"""
import math
from typing import Literal


# Base deduction weights per severity bucket (applied via sqrt-decay)
WEIGHTS: dict[str, int] = {
    "critical": 40,
    "high":     25,
    "medium":   12,
    "low":       5,
}


def _severity_deduction(count: int, weight: int) -> float:
    """
    Diminishing-returns deduction: weight × sqrt(count).
    First issue hurts a lot; subsequent issues of the same severity hurt less.
    """
    if count <= 0:
        return 0.0
    return weight * math.sqrt(count)


def calculate_health_score(issues: list[dict]) -> int:
    """
    Calculate health score from a list of open issues.
    Each issue dict must have a 'severity' key.

    Returns integer 0-100.
    """
    open_issues = [i for i in issues if i.get("status") == "open"]

    counts: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for issue in open_issues:
        sev = issue.get("severity", "low")
        if sev in counts:
            counts[sev] += 1

    total_deduction = sum(
        _severity_deduction(counts[sev], weight)
        for sev, weight in WEIGHTS.items()
    )

    score = max(0, min(100, round(100 - total_deduction)))
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
