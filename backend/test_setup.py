"""
Test script - verifies Supabase tables and services are working.
Run: venv\Scripts\python test_setup.py
"""
import sys
import os
os.environ["PYTHONIOENCODING"] = "utf-8"

def test_supabase():
    print("\n[1/3] Testing Supabase connection...")
    try:
        from app.database import get_supabase
        db = get_supabase()
        tables = ["users", "repos", "scans", "issues", "packages", "health_history"]
        all_ok = True
        for table in tables:
            try:
                result = db.table(table).select("*").limit(1).execute()
                print(f"  [OK] Table '{table}' exists")
            except Exception as e:
                print(f"  [FAIL] Table '{table}': {str(e)[:80]}")
                all_ok = False
        return all_ok
    except Exception as e:
        print(f"  [FAIL] Supabase connection: {str(e)[:120]}")
        return False


def test_claude_fallback():
    print("\n[2/3] Testing Claude service...")
    try:
        from app.services.claude import get_client, _match_fallback
        has_key = get_client() is not None
        print(f"  Claude API: {'[OK] Key configured' if has_key else '[INFO] No key - fallback mode active'}")
        test_rules = [
            "javascript.express.security.audit.express-sql-injection",
            "generic.secrets.security.detected-hardcoded-password",
            "python.lang.security.audit.missing-auth",
        ]
        for rule in test_rules:
            match = _match_fallback(rule)
            if match:
                print(f"  [OK] Rule matched: {match['title'][:55]}")
            else:
                print(f"  [INFO] No match for {rule.split('.')[-1]} - will use generic fallback")
        return True
    except Exception as e:
        print(f"  [FAIL] Claude service: {e}")
        return False


def test_semgrep_wsl():
    print("\n[3/3] Testing Semgrep via WSL...")
    import subprocess, platform
    if platform.system() != "Windows":
        try:
            r = subprocess.run(["semgrep", "--version"], capture_output=True, text=True, timeout=10)
            print(f"  [OK] Semgrep native: {r.stdout.strip()}")
            return True
        except FileNotFoundError:
            print("  [FAIL] Semgrep not in PATH")
            return False
    try:
        r = subprocess.run(["wsl", "--", "semgrep", "--version"], capture_output=True, text=True, timeout=15)
        if r.returncode == 0:
            print(f"  [OK] Semgrep via WSL: {r.stdout.strip()}")
            return True
        else:
            err = r.stderr.strip()[:80]
            print(f"  [WAIT] Semgrep not ready in WSL yet: {err}")
            return False
    except FileNotFoundError:
        print("  [FAIL] WSL not found")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("  DebtMap Backend - Setup Verification")
    print("=" * 50)
    r1 = test_supabase()
    r2 = test_claude_fallback()
    r3 = test_semgrep_wsl()
    print("\n" + "=" * 50)
    print(f"  Supabase tables:      {'OK' if r1 else 'FAIL'}")
    print(f"  Claude / fallback:    {'OK' if r2 else 'FAIL'}")
    print(f"  Semgrep (WSL/native): {'OK' if r3 else 'INSTALLING...'}")
    if r1 and r2:
        print("\n  Backend ready! Run:")
        print("  venv\\Scripts\\uvicorn app.main:app --reload --port 8000")
    print("=" * 50)
