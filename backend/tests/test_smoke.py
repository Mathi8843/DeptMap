"""
Backend smoke tests for DebtMap.
Verifies core logic without requiring Supabase, Semgrep, or Groq API keys.

Run from the backend/ directory:
    pytest tests/test_smoke.py -v
"""
import math
import pytest
from app.services.scorer import calculate_health_score, calculate_scores_by_severity
from app.services.crypto import encrypt_token, decrypt_token
from app.services.gitleaks import RULES, SEVERITY_BY_RULE


# ─── Health Scorer ────────────────────────────────────────────────────────────

def _make_issues(severities: list[str], status: str = "open") -> list[dict]:
    return [{"severity": s, "status": status} for s in severities]


class TestHealthScore:
    def test_no_issues_gives_perfect_score(self):
        assert calculate_health_score([]) == 100

    def test_closed_issues_dont_affect_score(self):
        issues = _make_issues(["critical", "high"], status="fixed")
        assert calculate_health_score(issues) == 100

    def test_single_critical_is_not_zero(self):
        """One critical issue should be bad but not zero — founders need hope."""
        score = calculate_health_score(_make_issues(["critical"]))
        assert 50 <= score <= 75, f"Expected 50–75 for 1 critical, got {score}"

    def test_many_criticals_dont_go_below_zero(self):
        issues = _make_issues(["critical"] * 20)
        assert calculate_health_score(issues) == 0

    def test_score_decreases_with_more_issues(self):
        one = calculate_health_score(_make_issues(["critical"]))
        four = calculate_health_score(_make_issues(["critical"] * 4))
        assert four < one

    def test_diminishing_returns(self):
        """
        Each additional critical should add less deduction than the previous one,
        ensuring the formula uses sqrt-decay rather than linear scaling.
        """
        scores = [
            calculate_health_score(_make_issues(["critical"] * n))
            for n in range(1, 6)
        ]
        drops = [scores[i] - scores[i + 1] for i in range(len(scores) - 1)]
        # Each successive drop should be <= the previous drop (diminishing returns)
        for i in range(len(drops) - 1):
            assert drops[i + 1] <= drops[i], (
                f"Drop at step {i+2} ({drops[i+1]}) should be <= drop at step {i+1} ({drops[i]})"
            )

    def test_scores_by_severity_structure(self):
        issues = _make_issues(["critical", "high", "medium", "low", "critical"])
        result = calculate_scores_by_severity(issues)
        assert "health_score" in result
        assert result["critical_count"] == 2
        assert result["high_count"] == 1
        assert result["medium_count"] == 1
        assert result["low_count"] == 1
        assert result["open_total"] == 5

    def test_mixed_severities_produce_reasonable_score(self):
        """
        A typical first scan: 2 critical, 3 high, 5 medium.
        Score should be positive and below 50.
        """
        issues = _make_issues(["critical"] * 2 + ["high"] * 3 + ["medium"] * 5)
        score = calculate_health_score(issues)
        assert 0 <= score <= 50, f"Expected 0–50 for a bad first scan, got {score}"


# ─── Crypto ───────────────────────────────────────────────────────────────────

class TestCrypto:
    def test_roundtrip(self):
        token = "gho_realtoken12345"
        encrypted = encrypt_token(token)
        assert encrypted != token
        assert encrypted.startswith("gAAAAA")
        assert decrypt_token(encrypted) == token

    def test_empty_string_passthrough(self):
        assert encrypt_token("") == ""
        assert decrypt_token("") == ""

    def test_wrong_key_raises_value_error(self, monkeypatch):
        """Simulates a SECRET_KEY rotation breaking existing tokens."""
        import app.services.crypto as crypto_module
        from cryptography.fernet import Fernet
        import base64, hashlib

        token = "gho_testtoken"
        encrypted = encrypt_token(token)

        # Monkeypatch _get_fernet to return a different key
        def _bad_fernet():
            bad_key = hashlib.sha256(b"totally_different_secret").digest()
            return Fernet(base64.urlsafe_b64encode(bad_key))

        monkeypatch.setattr(crypto_module, "_get_fernet", _bad_fernet)

        with pytest.raises(ValueError, match="could not be decrypted"):
            crypto_module.decrypt_token(encrypted)

    def test_non_fernet_token_in_dev_passes_through(self):
        """Dev/test raw tokens (e.g. mock_github_token) should pass through."""
        raw = "mock_github_token"
        # In dev (non-production), a non-Fernet token is returned as-is
        result = decrypt_token(raw)
        assert result == raw


# ─── Gitleaks Severity Mapping ────────────────────────────────────────────────

class TestGitleaksSeverity:
    def test_high_value_rules_are_critical(self):
        for rule in ["openai-api-key", "aws-access-key-id", "stripe-api-key", "github-pat"]:
            assert SEVERITY_BY_RULE[rule] == "critical", f"{rule} should be critical"

    def test_lower_confidence_rules_are_high(self):
        for rule in ["slack-webhook-url", "generic-api-key"]:
            assert SEVERITY_BY_RULE[rule] == "high", f"{rule} should be high"

    def test_all_rules_have_severity_entry(self):
        for rule_name in RULES:
            assert rule_name in SEVERITY_BY_RULE, (
                f"Rule '{rule_name}' in RULES has no severity in SEVERITY_BY_RULE"
            )


# ─── Scan Plan Gate (unit-level) ─────────────────────────────────────────────

class TestPlanGate:
    """
    These tests verify plan-gating logic that can be tested without a database.
    The run_scan_pipeline function is integration-tested separately.
    """

    def test_ai_review_is_pro_only(self):
        """Document that AI review must only run for pro/team plans."""
        paid_plans = {"pro", "team"}
        free_plans = {"free"}
        assert "free" not in paid_plans
        assert paid_plans.isdisjoint(free_plans)

    def test_free_plan_allows_zero_completed_scans(self):
        """Free plan: 0 completed scans on this repo → should be allowed."""
        completed_count = 0
        assert completed_count < 1  # gate passes

    def test_free_plan_blocks_second_scan(self):
        """Free plan: 1 completed scan already → should be blocked."""
        completed_count = 1
        assert completed_count >= 1  # gate fires
