"""
Semgrep scanner service.
Clones a GitHub repo into a temp directory, runs Semgrep with OWASP rules,
parses the JSON output, and returns structured findings.

Semgrep runtime notes:
- Linux/Mac: Runs natively via `semgrep scan`
- Windows: Runs via WSL (Windows Subsystem for Linux) — WSL must be installed
- Docker fallback: Uses `docker run semgrep/semgrep` if WSL is unavailable

Install WSL on Windows: Run `wsl --install` in admin PowerShell, then restart.
"""
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

import platform
import git  # GitPython

from app.config import get_settings

settings = get_settings()

SeverityLevel = Literal["critical", "high", "medium", "low"]

# Map Semgrep severity strings → our severity levels
SEVERITY_MAP: dict[str, SeverityLevel] = {
    "ERROR": "critical",
    "WARNING": "high",
    "INFO": "medium",
    "NOTE": "low",
}


def clone_repo(clone_url: str, access_token: str, dest_dir: str) -> None:
    """
    Clone a GitHub repository using the user's access token for auth.
    Uses HTTPS with token embedded in URL (standard GitHub auth method).
    """
    # Inject token into clone URL: https://token@github.com/owner/repo.git
    auth_url = clone_url.replace("https://", f"https://{access_token}@")
    git.Repo.clone_from(auth_url, dest_dir, depth=1)  # shallow clone for speed


def _get_semgrep_command(target_dir: str) -> list[str]:
    """
    Build the correct Semgrep command for the current OS.
    - Linux/Mac: semgrep scan <dir>
    - Windows + WSL: wsl semgrep scan <wsl_path>
    - Windows + Docker: docker run --rm -v <dir>:/src semgrep/semgrep semgrep scan /src
    """
    semgrep_args = [
        "scan",
        "--config", "auto",
        "--json",
        "--no-git-ignore",
        "--timeout", "60",
        "--max-memory", "1000",
    ]

    if platform.system() != "Windows":
        # Linux / macOS — use semgrep directly
        return ["semgrep"] + semgrep_args + [target_dir]

    # Windows: try WSL first
    try:
        wsl_check = subprocess.run(["wsl", "--status"], capture_output=True, timeout=5)
        if wsl_check.returncode == 0:
            # Convert Windows path to WSL path: C:\foo\bar → /mnt/c/foo/bar
            wsl_path = target_dir.replace("\\", "/").replace("C:", "/mnt/c").replace("D:", "/mnt/d")
            return ["wsl", "semgrep"] + semgrep_args + [wsl_path]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Windows: fallback to Docker
    # Requires: Docker Desktop installed and running
    docker_path = target_dir.replace("\\", "/")
    return [
        "docker", "run", "--rm",
        "-v", f"{docker_path}:/src",
        "semgrep/semgrep",
        "semgrep"
    ] + semgrep_args + ["/src"]


def run_semgrep(target_dir: str) -> dict:
    """
    Run Semgrep on a directory and return the raw JSON output.
    Automatically selects the correct command for Linux/Mac/Windows.
    """
    cmd = _get_semgrep_command(target_dir)
    logger.info(f"Running: {' '.join(cmd[:4])}...")

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=180,
    )

    # Semgrep exits with code 1 when findings exist — that's normal, not an error
    if result.returncode not in (0, 1):
        raise RuntimeError(
            f"Semgrep failed with exit code {result.returncode}: {result.stderr[:500]}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Semgrep output was not valid JSON: {result.stdout[:200]}")


def parse_findings(semgrep_output: dict, repo_dir: str) -> list[dict]:
    """
    Parse Semgrep JSON output into our finding format.
    Strips the absolute temp dir path from file paths (show relative paths only).
    
    Returns list of dicts matching our issues table schema
    (before Claude enrichment — plain_english_* fields will be empty).
    """
    findings = []
    results = semgrep_output.get("results", [])

    for item in results:
        raw_path = item.get("path", "")
        # Make path relative to repo root
        try:
            rel_path = str(Path(raw_path).relative_to(repo_dir))
        except ValueError:
            rel_path = raw_path

        severity_str = item.get("extra", {}).get("severity", "INFO")
        severity: SeverityLevel = SEVERITY_MAP.get(severity_str.upper(), "low")

        start_line = item.get("start", {}).get("line", 0)
        end_line = item.get("end", {}).get("line", start_line)

        # Extract the actual vulnerable code lines
        code_lines = item.get("extra", {}).get("lines", "")

        findings.append({
            "semgrep_rule_id": item.get("check_id", "unknown"),
            "severity": severity,
            "file_path": rel_path,
            "line_start": start_line,
            "line_end": end_line,
            "code_snippet": code_lines,
            # These will be filled in by Claude service:
            "plain_english_title": "",
            "plain_english_body": "",
            "impact_bullets": [],
            "ai_fix_code": code_lines,  # Default to original; Claude will replace
            # Raw Semgrep message (used as Claude context)
            "_raw_message": item.get("extra", {}).get("message", ""),
        })

    return findings


async def scan_repository(
    full_name: str,
    clone_url: str,
    access_token: str,
) -> tuple[list[dict], str]:
    """
    Full scan pipeline:
    1. Create temp directory
    2. Clone repo
    3. Run Semgrep
    4. Parse findings
    5. Clean up temp directory
    
    Returns: (findings_list, repo_dir_used)
    The caller (scan router) then enriches findings with Claude.
    """
    # Create isolated temp dir for this scan
    temp_dir = tempfile.mkdtemp(
        prefix=f"debtmap_{full_name.replace('/', '_')}_",
        dir=settings.scan_temp_dir if os.path.exists(settings.scan_temp_dir) else None,
    )

    try:
        repo_dir = os.path.join(temp_dir, "repo")
        os.makedirs(repo_dir, exist_ok=True)

        # Step 1: Clone
        clone_repo(clone_url, access_token, repo_dir)

        # Step 2: Scan
        raw_output = run_semgrep(repo_dir)

        # Step 3: Parse
        findings = parse_findings(raw_output, repo_dir)

        return findings, repo_dir

    finally:
        # Always clean up — repos can be large
        shutil.rmtree(temp_dir, ignore_errors=True)


def get_package_files(clone_url: str, access_token: str) -> dict[str, str]:
    """
    Clone repo and extract just package manifest files.
    Returns dict of { filename: content } for:
    - package.json (npm)
    - requirements.txt (pip)
    - Pipfile (pipenv)
    - pyproject.toml (poetry)
    
    Used by the registry service for slopsquatting detection.
    Faster than a full Semgrep scan.
    """
    target_files = ["package.json", "requirements.txt", "Pipfile", "pyproject.toml"]
    temp_dir = tempfile.mkdtemp(prefix="debtmap_pkgs_")
    results = {}

    try:
        repo_dir = os.path.join(temp_dir, "repo")
        clone_repo(clone_url, access_token, repo_dir)

        for fname in target_files:
            fpath = Path(repo_dir) / fname
            if fpath.exists():
                results[fname] = fpath.read_text(encoding="utf-8", errors="ignore")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return results
