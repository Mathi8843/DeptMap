"""
Scratch script to verify Post-fix Verification Pipeline (Layer 10).
Test SQL Injection, secrets detection, and package audits fixes verification.
Run: venv\\Scripts\\python scratch\\test_postfix_verification.py
"""
import sys
import os
# Add backend directory to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.routers.issues import verify_patch_content

def run_tests():
    print("=" * 60)
    print("  Testing Post-fix Verification Pipeline (Layer 10)")
    print("=" * 60)
    
    # ─── 1. Test Gitleaks / Secret Verification ──────────────────────────────
    print("\n[1/3] Testing Gitleaks / Secret Verification...")
    gitleaks_rule = "gitleaks.openai-api-key"
    
    vulnerable_secrets_content = "const key = 'sk-proj-a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0';"
    resolved_secrets_content = "const key = process.env.OPENAI_API_KEY;"
    
    # Vulnerable patch should fail
    ok, err = verify_patch_content("src/config/openai.ts", vulnerable_secrets_content, gitleaks_rule, "")
    print(f"  Vulnerable secrets patch: ok={ok}, err={err}")
    assert not ok, "Vulnerable secrets patch should have failed"
    assert "Verification failed" in err
    
    # Resolved patch should succeed
    ok, err = verify_patch_content("src/config/openai.ts", resolved_secrets_content, gitleaks_rule, "")
    print(f"  Resolved secrets patch: ok={ok}, err={err}")
    assert ok, f"Resolved secrets patch failed: {err}"
    print("  [OK] Secrets verification works correctly!")

    # ─── 2. Test Package Audit Dependency Verification ───────────────────────
    print("\n[2/3] Testing Dependency Vulnerability Verification...")
    dep_rule = "vulnerable-dependency.express"
    original_snippet = '    "express": "^4.18.2",'
    
    vulnerable_dep_content = '{\n  "dependencies": {\n    "express": "^4.18.2",\n    "react": "^18.2.0"\n  }\n}'
    resolved_dep_content = '{\n  "dependencies": {\n    "express": "^4.19.2",\n    "react": "^18.2.0"\n  }\n}'
    
    # Vulnerable patch (same version) should fail
    ok, err = verify_patch_content("package.json", vulnerable_dep_content, dep_rule, original_snippet)
    print(f"  Vulnerable dependency patch: ok={ok}, err={err}")
    assert not ok, "Vulnerable dependency patch should have failed"
    assert "Verification failed" in err
    
    # Resolved patch (upgraded version) should succeed
    ok, err = verify_patch_content("package.json", resolved_dep_content, dep_rule, original_snippet)
    print(f"  Resolved dependency patch: ok={ok}, err={err}")
    assert ok, f"Resolved dependency patch failed: {err}"
    print("  [OK] Dependency verification works correctly!")

    # ─── 3. Test Semgrep Static Analysis Verification ────────────────────────
    print("\n[3/3] Testing Semgrep Verification...")
    semgrep_rule = "javascript.browser.security.eval-detected.eval-detected"
    
    # eval vulnerable snippet
    vulnerable_eval_content = """
    const express = require('express');
    const app = express();
    app.get('/run', (req, res) => {
        const code = req.query.code;
        eval(code);
        res.send("OK");
    });
    """
    
    # eval resolved snippet
    resolved_eval_content = """
    const express = require('express');
    const app = express();
    app.get('/run', (req, res) => {
        const code = req.query.code;
        // Removed unsafe eval
        res.send("OK");
    });
    """
    
    # Vulnerable Semgrep patch should fail
    ok, err = verify_patch_content("src/routes/run.js", vulnerable_eval_content, semgrep_rule, "")
    print(f"  Vulnerable Semgrep patch: ok={ok}, err={err}")
    assert not ok, "Vulnerable Semgrep patch should have failed"
    assert "Semgrep" in err
    
    # Resolved Semgrep patch should succeed
    ok, err = verify_patch_content("src/routes/run.js", resolved_eval_content, semgrep_rule, "")
    print(f"  Resolved Semgrep patch: ok={ok}, err={err}")
    assert ok, f"Resolved Semgrep patch failed: {err}"
    print("  [OK] Semgrep verification works correctly!")
    
    print("\n" + "=" * 60)
    print("  All verification tests passed successfully! (Success)")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
