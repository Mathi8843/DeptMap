import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000"
HEADERS = {"Authorization": "Bearer mock-session-token"}

def log_step(name):
    print(f"\n[STEP] {name}")

def run_test():
    # 1. Verify User Profile / Auto-creation
    log_step("Verifying User Profile / Auto-creation")
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS)
    assert r.status_code == 200, f"Auth failed: {r.text}"
    user_data = r.json()
    print(f"  [OK] Connected user: {user_data['name']} ({user_data['email']})")

    # 2. Verify GitHub Repo List Retrieval
    log_step("Retrieving GitHub Repositories List")
    r = requests.get(f"{BASE_URL}/api/repos/github-list", headers=HEADERS)
    assert r.status_code == 200, f"GitHub list failed: {r.text}"
    github_repos = r.json()
    assert len(github_repos) > 0, "No repos returned"
    print(f"  [OK] Found {len(github_repos)} mock repos: {[r['full_name'] for r in github_repos]}")

    # 3. Connect a Repository
    log_step("Connecting Repository")
    target_repo = "mathivanan/saas-app"
    
    # Check if already connected first, if so delete it so we start fresh
    r = requests.get(f"{BASE_URL}/api/repos", headers=HEADERS)
    existing_repos = r.json()
    for repo in existing_repos:
        if repo["full_name"] == target_repo:
            print(f"  [INFO] Repository {target_repo} already exists, deleting first...")
            del_r = requests.delete(f"{BASE_URL}/api/repos/{repo['id']}", headers=HEADERS)
            assert del_r.status_code == 200, f"Deletion failed: {del_r.text}"
            
    r = requests.post(f"{BASE_URL}/api/repos?github_repo_full_name={target_repo}&generator=Lovable", headers=HEADERS)
    assert r.status_code == 200, f"Connect failed: {r.text}"
    repo_info = r.json()
    repo_id = repo_info["id"]
    print(f"  [OK] Connected {target_repo} successfully. ID: {repo_id}")

    # 4. Trigger Scan
    log_step("Triggering Security Scan")
    r = requests.post(f"{BASE_URL}/api/scans?repo_id={repo_id}", headers=HEADERS)
    assert r.status_code == 200, f"Trigger scan failed: {r.text}"
    scan_info = r.json()
    scan_id = scan_info["scan_id"]
    print(f"  [OK] Scan triggered. ID: {scan_id}, Status: {scan_info['status']}")

    # 5. Poll Scan Status
    log_step("Polling Scan Status")
    completed = False
    for _ in range(20):
        time.sleep(1)
        r = requests.get(f"{BASE_URL}/api/scans/{scan_id}/status", headers=HEADERS)
        assert r.status_code == 200, f"Status check failed: {r.text}"
        status_data = r.json()
        print(f"  Progress: {status_data['progress']}% | Logs: {status_data['log_messages'][-1] if status_data['log_messages'] else 'None'}")
        if status_data["status"] == "completed":
            completed = True
            break
        elif status_data["status"] == "failed":
            print(f"  [FAIL] Scan failed on backend.")
            sys.exit(1)
            
    assert completed, "Scan timed out"
    print("  [OK] Scan completed successfully!")

    # 6. Retrieve Open Issues
    log_step("Loading Security Issues")
    r = requests.get(f"{BASE_URL}/api/issues?repo_id={repo_id}", headers=HEADERS)
    assert r.status_code == 200, f"Fetch issues failed: {r.text}"
    issues = r.json()
    assert len(issues) == 2, f"Expected 2 mock issues, got {len(issues)}"
    print(f"  [OK] Loaded {len(issues)} open issues:")
    for issue in issues:
        print(f"    - [{issue['severity'].upper()}] {issue['plain_english_title']} in {issue['file_path']}")

    # 7. Test AI Fix PR Creation
    log_step("Testing AI-Generated PR Fix")
    issue_id = issues[0]["id"]
    r = requests.post(f"{BASE_URL}/api/issues/{issue_id}/fix", headers=HEADERS)
    assert r.status_code == 200, f"PR creation failed: {r.text}"
    pr_data = r.json()
    assert pr_data["success"] == True
    print(f"  [OK] Fix PR generated successfully:")
    print(f"    PR Number: #{pr_data['pr_number']}")
    print(f"    PR Link: {pr_data['pr_url']}")

    # 8. Clean up connected repo
    log_step("Cleaning up database state")
    r = requests.delete(f"{BASE_URL}/api/repos/{repo_id}", headers=HEADERS)
    assert r.status_code == 200
    print("  [OK] Database state cleaned. Integration test passed! (Success)")

if __name__ == "__main__":
    run_test()
