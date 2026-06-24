"""
Gitleaks secret detection service with built-in regex fallback.
Runs Gitleaks if available (native, WSL, or Docker),
and falls back to a custom regex scanner if Gitleaks is not available.
"""
import json
import logging
import os
import platform
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Standard regexes for detecting secrets
RULES = {
    "openai-api-key": r"(?:sk-proj-[a-zA-Z0-9-_]{40,})|(?:sk-live-[a-zA-Z0-9-_]{40,})|(?:sk-[a-zA-Z0-9]{48})",
    "aws-access-key-id": r"\b(?:AKIA|ASCA|ASIA)[0-9A-Z]{16}\b",
    "github-pat": r"\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{82})\b",
    "stripe-api-key": r"\b(?:sk|rk)_live_[0-9a-zA-Z]{24}\b",
    "slack-webhook-url": r"https://hooks\.slack\.com/services/T[A-Z0-9_]+/B[A-Z0-9_]+/[a-zA-Z0-9_]+",
    "generic-api-key": r"\b(?:api[_-]?key|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['\"]([a-zA-Z0-9-_=]{16,})['\"]",
}


def _get_gitleaks_command(target_dir: str, report_path: str) -> list[str]:
    """
    Build the correct Gitleaks command for the current OS/environment.
    - Linux/Mac: gitleaks detect --source=<dir> --report-format=json --report-path=<report_path> --exit-code=0
    - Windows + WSL: wsl gitleaks detect --source=<wsl_path> --report-format=json --report-path=<wsl_report_path> --exit-code=0
    - Windows + Docker: docker run --rm -v <dir>:/src zricethezav/gitleaks:latest detect --source=/src --report-format=json --report-path=/src/report.json --exit-code=0
    """
    gitleaks_args = [
        "detect",
        "--source", target_dir,
        "--report-format", "json",
        "--report-path", report_path,
        "--exit-code", "0",
    ]

    if platform.system() != "Windows":
        return ["gitleaks"] + gitleaks_args

    # Windows: try WSL first
    try:
        wsl_check = subprocess.run(["wsl", "--status"], capture_output=True, timeout=5)
        if wsl_check.returncode == 0:
            # Convert Windows path to WSL path: C:\foo\bar → /mnt/c/foo/bar
            wsl_path = target_dir.replace("\\", "/")
            if len(wsl_path) >= 2 and wsl_path[1] == ":":
                drive = wsl_path[0].lower()
                wsl_path = f"/mnt/{drive}{wsl_path[2:]}"
            
            wsl_report_path = report_path.replace("\\", "/")
            if len(wsl_report_path) >= 2 and wsl_report_path[1] == ":":
                drive = wsl_report_path[0].lower()
                wsl_report_path = f"/mnt/{drive}{wsl_report_path[2:]}"

            # Run Gitleaks in WSL
            return ["wsl", "gitleaks", "detect", "--source", wsl_path, "--report-format", "json", "--report-path", wsl_report_path, "--exit-code", "0"]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Windows: fallback to Docker
    docker_src = target_dir.replace("\\", "/")
    docker_report_dir = os.path.dirname(report_path).replace("\\", "/")
    report_filename = os.path.basename(report_path)
    
    # Mount source directory to /src, and let report write inside /src so it's accessible on host
    return [
        "docker", "run", "--rm",
        "-v", f"{docker_src}:/src",
        "zricethezav/gitleaks:latest",
        "detect",
        "--source", "/src",
        "--report-format", "json",
        "--report-path", f"/src/{report_filename}",
        "--exit-code", "0"
    ]


def run_gitleaks(target_dir: str, temp_dir: str) -> list[dict]:
    """
    Run Gitleaks binary/container. Returns list of parsed findings or empty list if no secrets found.
    Raises FileNotFoundError if Gitleaks command fails or is not available.
    """
    report_path = os.path.join(temp_dir, "gitleaks_report.json")
    cmd = _get_gitleaks_command(target_dir, report_path)
    
    logger.info(f"Running Gitleaks: {' '.join(cmd[:4])}...")
    
    # Check if the command binary is available in environment
    binary = cmd[0]
    if binary == "gitleaks" and not shutil.which("gitleaks"):
        raise FileNotFoundError("Gitleaks native binary not in PATH")
        
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )
    
    # If using Docker or WSL, check if the command executed successfully
    if result.returncode != 0:
        raise RuntimeError(f"Gitleaks execution failed: {result.stderr[:500]}")
        
    # Check if report file exists
    if not os.path.exists(report_path):
        # In Docker mode, since we wrote report to /src/report_filename, it should be in target_dir / report_filename
        docker_report_path = os.path.join(target_dir, os.path.basename(report_path))
        if os.path.exists(docker_report_path):
            shutil.move(docker_report_path, report_path)
        else:
            return []  # No report means no leaks found (or exited with 0 and no output)
            
    try:
        with open(report_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)
    except Exception as e:
        logger.error(f"Failed to read/parse Gitleaks report: {e}")
        return []


def run_regex_fallback_scanner(repo_dir: str) -> list[dict]:
    """
    Built-in regex-based secrets scanner in Python.
    Scans files in repository directory and returns list of findings.
    """
    findings = []
    compiled_rules = {name: re.compile(pattern) for name, pattern in RULES.items()}
    
    exclude_dirs = {".git", "node_modules", "venv", ".next", "__pycache__", "dist", "build"}
    placeholders = {"your_api_key", "your-api-key", "placeholder", "my_secret", "my-secret", "your_key_here", "xxxx", "123456"}
    
    for root, dirs, files in os.walk(repo_dir):
        # In-place modify dirs to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            file_path = os.path.join(root, file)
            # Skip large files or binary files
            if os.path.getsize(file_path) > 1 * 1024 * 1024:  # > 1MB
                continue
            
            # Simple text extension check (skip image, zip, pdf, etc.)
            ext = os.path.splitext(file)[1].lower()
            if ext in {".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".pdf", ".tar", ".gz", ".mp3", ".mp4", ".woff", ".woff2", ".eot", ".ttf"}:
                continue
                
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue
                
            # Run regexes
            lines = content.splitlines()
            for line_idx, line in enumerate(lines):
                # Clean line from whitespace
                clean_line = line.strip()
                if not clean_line:
                    continue
                    
                for rule_name, regex in compiled_rules.items():
                    matches = regex.findall(line)
                    for match in matches:
                        # If the match is a tuple (e.g. from capturing group), get the first item or full string
                        match_str = match[0] if isinstance(match, tuple) else match
                        
                        # Filter out common placeholders
                        if match_str.lower() in placeholders or len(match_str) < 6:
                            continue
                            
                        rel_path = os.path.relpath(file_path, repo_dir).replace("\\", "/")
                        findings.append({
                            "RuleID": rule_name,
                            "Description": f"Hardcoded {rule_name.replace('-', ' ')} detected",
                            "StartLine": line_idx + 1,
                            "EndLine": line_idx + 1,
                            "File": rel_path,
                            "Match": match_str,
                        })
    return findings


def scan_dir(repo_dir: str, full_name: str, access_token: str = None) -> list[dict]:
    """
    Scan an existing directory with Gitleaks (no cloning).
    Falls back to a Python-based regex scanner if Gitleaks is not available.
    """
    if access_token == "mock_github_token":
        if "saas-app" in full_name:
            return [
                {
                    "semgrep_rule_id": "gitleaks.openai-api-key",
                    "severity": "critical",
                    "file_path": "src/config/openai.ts",
                    "line_start": 3,
                    "line_end": 3,
                    "code_snippet": "const openaiApiKey = 'sk-proj-a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0';",
                    "plain_english_title": "Exposed OpenAI API Key",
                    "plain_english_body": "A live OpenAI API key was found hardcoded in your code. Anyone with access to the codebase can steal this key and run up API usage charges on your account.",
                    "impact_bullets": [
                        "Attacker can abuse your OpenAI quota, leading to huge bills.",
                        "API account access can be blocked/suspended by OpenAI due to leakage.",
                        "Exposes proprietary prompts/data to external users."
                    ],
                    "ai_fix_code": "const openaiApiKey = process.env.OPENAI_API_KEY;",
                    "confidence": 98,
                    "what_changed": "Replaced the hardcoded OpenAI API key string with process.env.OPENAI_API_KEY.",
                    "_raw_message": "OpenAI API key detected"
                }
            ]
        return []

    # Parent dir of repo_dir is where we can put the report file
    temp_dir = os.path.dirname(repo_dir) if repo_dir else tempfile.gettempdir()

    # Run secrets scanning
    raw_findings = []
    scanner_used = "Gitleaks binary"
    
    try:
        raw_findings = run_gitleaks(repo_dir, temp_dir)
    except Exception as e:
        logger.warning(f"Gitleaks runner failed or was unavailable: {e}. Falling back to Python regex scanner...")
        raw_findings = run_regex_fallback_scanner(repo_dir)
        scanner_used = "built-in Python regex engine"
        
    logger.info(f"Secret scan completed with {scanner_used}. Found {len(raw_findings)} leak(s).")

    # Parse raw findings into issues schema
    findings = []
    for item in raw_findings:
        rel_path = item.get("File", "").replace("\\", "/")
        start_line = item.get("StartLine", 1)
        end_line = item.get("EndLine", start_line)
        
        # Extract actual lines of code from disk
        code_lines = ""
        local_file_path = os.path.join(repo_dir, rel_path.replace("/", os.sep))
        if os.path.exists(local_file_path):
            try:
                with open(local_file_path, "r", encoding="utf-8", errors="ignore") as f:
                    file_lines = f.readlines()
                    if 1 <= start_line <= len(file_lines):
                        code_lines = "".join(file_lines[start_line - 1 : end_line])
            except Exception as e:
                logger.warning(f"Could not read code lines for secret finding: {e}")
                
        if not code_lines:
            code_lines = item.get("Match", "")

        rule_id = f"gitleaks.{item.get('RuleID', 'secret')}"
        
        # Extract full file content for AI context
        full_content = ""
        if os.path.exists(local_file_path):
            try:
                with open(local_file_path, "r", encoding="utf-8", errors="ignore") as f:
                    full_content = f.read(8000)
                    if len(full_content) == 8000:
                        full_content += "\n... [file truncated for context window]"
            except Exception as e:
                logger.warning(f"Could not read full file context: {e}")

        findings.append({
            "semgrep_rule_id": rule_id,
            "severity": "critical",
            "file_path": rel_path,
            "line_start": start_line,
            "line_end": end_line,
            "code_snippet": code_lines,
            "plain_english_title": "",
            "plain_english_body": "",
            "impact_bullets": [],
            "ai_fix_code": code_lines,
            "_raw_message": f"Secret detected: {item.get('Description', 'Hardcoded credential')}",
            "_full_file_content": full_content,
            "_related_files": [],
        })

    return findings



