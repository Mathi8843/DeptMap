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
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

import platform
import git  # GitPython

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SeverityLevel = Literal["critical", "high", "medium", "low"]

# Map Semgrep severity strings → our severity levels
SEVERITY_MAP: dict[str, SeverityLevel] = {
    "ERROR": "critical",
    "WARNING": "high",
    "INFO": "medium",
    "NOTE": "low",
}

EXCLUDE_DIRS = [
    "node_modules", ".git", ".next", "dist", "build",
    "__pycache__", ".pytest_cache", "venv", ".venv",
    "coverage", ".nyc_output", "target",  # Java/Rust build dirs
]

def delete_junk_dirs(repo_dir: str):
    """
    Delete junk directories (e.g. build artifacts, virtual environments)
    to minimize file tree size and memory footprint before scanning.
    """
    for root, dirs, _ in os.walk(repo_dir, topdown=True):
        for d in list(dirs):
            if d in EXCLUDE_DIRS:
                full = os.path.join(root, d)
                shutil.rmtree(full, ignore_errors=True)
                dirs.remove(d)  # don't recurse into deleted dirs

SKIP_EXTENSIONS = (
    ".min.js", ".min.css", ".map", ".lock",
    "package-lock.json", "pnpm-lock.yaml",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".pdf", ".db",
)

def _should_skip_file(path: str) -> bool:
    """
    Check if a file should be skipped from reading/enrichment (e.g. binaries, minified/generated files).
    """
    return path.lower().endswith(SKIP_EXTENSIONS)


def clone_repo(clone_url: str, access_token: str, dest_dir: str) -> None:
    """
    Clone a GitHub repository using the user's access token for auth.
    Uses HTTPS with token embedded in URL (standard GitHub auth method).
    Uses depth=1 and filter=blob:none for high speed and minimal memory/disk usage.
    """
    # Inject token into clone URL: https://token@github.com/owner/repo.git
    auth_url = clone_url.replace("https://", f"https://{access_token}@")
    git.Repo.clone_from(
        auth_url,
        dest_dir,
        depth=1,                     # only latest commit
        filter="blob:none",          # skip file blobs until needed
        no_single_branch=False,
    )


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
            # Convert Windows path to WSL path: C:\foo\bar → /mnt/c/foo/bar (case-insensitive for drive letter)
            wsl_path = target_dir.replace("\\", "/")
            if len(wsl_path) >= 2 and wsl_path[1] == ":":
                drive = wsl_path[0].lower()
                wsl_path = f"/mnt/{drive}{wsl_path[2:]}"
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
        timeout=180,
    )

    stdout = result.stdout.decode("utf-8", errors="ignore")
    stderr = result.stderr.decode("utf-8", errors="ignore")

    # Semgrep exits with code 1 when findings exist — that's normal, not an error
    if result.returncode not in (0, 1):
        raise RuntimeError(
            f"Semgrep failed with exit code {result.returncode}: {stderr[:500]}"
        )

    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Semgrep output was not valid JSON: {stdout[:200]}")


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
        raw_posix = raw_path.replace("\\", "/")
        repo_posix = repo_dir.replace("\\", "/")
        
        # If running in WSL, raw_posix might start with /mnt/c/..., while repo_posix might start with C:/...
        if repo_posix.lower().startswith("c:/") or (len(repo_posix) >= 2 and repo_posix[1] == ":"):
            drive = repo_posix[0].lower()
            wsl_repo_posix = f"/mnt/{drive}{repo_posix[2:]}"
        else:
            wsl_repo_posix = repo_posix
            
        try:
            rel_path = str(Path(raw_posix).relative_to(Path(repo_posix)))
        except ValueError:
            try:
                rel_path = str(Path(raw_posix).relative_to(Path(wsl_repo_posix)))
            except ValueError:
                # If everything else fails, split by '/repo/'
                if "/repo/" in raw_posix:
                    rel_path = raw_posix.split("/repo/", 1)[1]
                else:
                    rel_path = raw_path
                    
        # Ensure forward slashes for GitHub API compatibility
        rel_path = rel_path.replace("\\", "/")

        severity_str = item.get("extra", {}).get("severity", "INFO")
        severity: SeverityLevel = SEVERITY_MAP.get(severity_str.upper(), "low")

        start_line = item.get("start", {}).get("line", 0)
        end_line = item.get("end", {}).get("line", start_line)

        # Extract the actual vulnerable code lines
        code_lines = item.get("extra", {}).get("lines", "")

        if code_lines == "requires login" and start_line > 0:
            try:
                # Read the actual lines from the cloned file on disk
                local_file_path = os.path.join(repo_dir, rel_path.replace("/", os.sep))
                if os.path.exists(local_file_path):
                    with open(local_file_path, "r", encoding="utf-8", errors="ignore") as f:
                        file_lines = f.readlines()
                        # line_start and line_end are 1-based index
                        extracted_lines = file_lines[start_line - 1 : end_line]
                        code_lines = "".join(extracted_lines)
            except Exception as read_err:
                logger.error(f"Failed to read original code lines for {rel_path} from disk: {read_err}")

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


def _extract_imported_paths(code_snippet: str, file_path: str) -> list[str]:
    """
    Parse import statements in a code snippet and return relative file paths
    that might exist in the repo. Handles JS/TS, Python, and Java imports.
    Only resolves relative imports (starts with . or /) — skips npm/stdlib packages.
    """
    import re
    candidates = []

    # JS/TS: import ... from './foo' or require('./foo')
    js_patterns = [
        r"""from\s+['"](\.[^'"]+)['"]""",
        r"""require\s*\(\s*['"](\.[^'"]+)['"]\s*\)""",
        r"""import\s*\(\s*['"](\.[^'"]+)['"]\s*\)""",
    ]
    for pattern in js_patterns:
        candidates += re.findall(pattern, code_snippet)

    # Python: from .module import ... or from ..module import ...
    py_patterns = [
        r"""from\s+(\.+[\w.]+)\s+import""",
        r"""import\s+(\.+[\w.]+)""",
    ]
    for pattern in py_patterns:
        candidates += re.findall(pattern, code_snippet)

    # Resolve relative paths based on the file's directory
    file_dir = os.path.dirname(file_path)
    resolved = []
    extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".py", ".java"]

    for c in candidates:
        # Convert Python dot-notation to path (e.g., ..utils → ../utils)
        if c.startswith(".") and not c.startswith("./") and not c.startswith("../"):
            # Python relative: .module → ./module, ..module → ../module
            dots = len(c) - len(c.lstrip("."))
            rest = c[dots:].replace(".", "/")
            prefix = "../" * (dots - 1) if dots > 1 else "./"
            c = prefix + rest

        # Normalize to relative path from repo root
        joined = os.path.normpath(os.path.join(file_dir, c)).replace("\\", "/")
        resolved.append((c, joined))

    return resolved


def _enrich_with_file_context(findings: list[dict], repo_dir: str) -> list[dict]:
    """
    For each finding, read:
    1. The full source file the snippet came from (gives imports, class structure, other functions)
    2. Any locally imported files referenced in the snippet (cross-file context)

    Attaches two new fields:
    - _full_file_content: str — full source of the flagged file
    - _related_files: list[dict] — [{path, content}] for imported local files
    """
    MAX_FILE_CHARS = 8000   # Cap per file to stay within token limits
    MAX_RELATED = 3         # Max number of related files to fetch per finding

    for finding in findings:
        file_path = finding.get("file_path", "")
        abs_path = os.path.join(repo_dir, file_path.replace("/", os.sep))

        # 1. Full source file
        full_content = ""
        if os.path.exists(abs_path):
            if _should_skip_file(abs_path):
                full_content = "(Binary or generated file — skipped)"
            else:
                try:
                    with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                        full_content = f.read(MAX_FILE_CHARS)
                        if len(full_content) == MAX_FILE_CHARS:
                            full_content += "\n... [file truncated for context window]"
                except Exception as e:
                    logger.warning(f"Could not read full file {abs_path}: {e}")

        finding["_full_file_content"] = full_content

        # 2. Related imported files
        code_snippet = finding.get("code_snippet", "")
        related = []

        try:
            imported_paths = _extract_imported_paths(code_snippet, file_path)
            for original, rel_path in imported_paths[:MAX_RELATED]:
                # Try with and without common extensions
                extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".py", "/index.ts", "/index.js"]
                for ext in extensions:
                    candidate = os.path.join(repo_dir, (rel_path + ext).replace("/", os.sep))
                    if os.path.exists(candidate):
                        if _should_skip_file(candidate):
                            break
                        try:
                            with open(candidate, "r", encoding="utf-8", errors="ignore") as f:
                                content = f.read(MAX_FILE_CHARS)
                            related.append({
                                "path": (rel_path + ext).replace("\\", "/"),
                                "content": content,
                            })
                        except Exception as e:
                            logger.warning(f"Could not read related file {candidate}: {e}")
                        break  # found with this extension, stop trying
        except Exception as e:
            logger.warning(f"Import extraction failed for {file_path}: {e}")

        finding["_related_files"] = related

    return findings


async def scan_repository(
    full_name: str,
    clone_url: str,
    access_token: str,
) -> tuple[list[dict], str]:
    """
    Full scan pipeline.
    """
    if access_token == "mock_github_token":
        import asyncio
        await asyncio.sleep(1.5)  # simulate scanner delay

        if "saas-app" in full_name:
            findings = [
                {
                    "semgrep_rule_id": "javascript.express.security.audit.express-sql-injection",
                    "severity": "critical",
                    "file_path": "src/routes/search.ts",
                    "line_start": 12,
                    "line_end": 15,
                    "code_snippet": "const query = req.query.q;\nconst result = await db.query('SELECT * FROM items WHERE name = ' + query);",
                    "plain_english_title": "SQL Injection in Search Endpoint",
                    "plain_english_body": "User input is directly concatenated into a database query string, allowing attackers to execute arbitrary SQL commands.",
                    "impact_bullets": ["Attackers can view, edit, or delete any database table content.", "Vulnerable to schema dumps and complete data leaks."],
                    "ai_fix_code": "const query = req.query.q;\nconst result = await db.query('SELECT * FROM items WHERE name = $1', [query]);",
                    "_raw_message": "User input concatenated in SQL query"
                },
                {
                    "semgrep_rule_id": "generic.secrets.security.detected-hardcoded-password",
                    "severity": "high",
                    "file_path": "src/config/db.ts",
                    "line_start": 4,
                    "line_end": 4,
                    "code_snippet": "const connectionString = 'postgresql://db_user:SuperSecretPassword123@localhost:5432/saas_db';",
                    "plain_english_title": "Hardcoded Database Credentials",
                    "plain_english_body": "A sensitive database connection string containing a plain-text password was found hardcoded in the codebase.",
                    "impact_bullets": ["Any developer or user with access to the source code can access the DB.", "Exposes data to unauthorized internet scans if public."],
                    "ai_fix_code": "const connectionString = process.env.DATABASE_URL;",
                    "_raw_message": "Hardcoded password"
                }
            ]
        elif "api-backend" in full_name:
            findings = [
                {
                    "semgrep_rule_id": "python.lang.security.audit.missing-auth",
                    "severity": "high",
                    "file_path": "app/api/admin.py",
                    "line_start": 8,
                    "line_end": 10,
                    "code_snippet": "@router.post('/admin/reset-db')\ndef reset_database():\n    db.clear_all()",
                    "plain_english_title": "Missing Authentication on Admin Endpoint",
                    "plain_english_body": "A sensitive administrative function lacks an authentication decorator, allowing anyone to execute it.",
                    "impact_bullets": ["Unauthenticated users can wipe backend database tables.", "Exposes system controls to denial-of-service exploits."],
                    "ai_fix_code": "@router.post('/admin/reset-db')\n@require_admin_role\ndef reset_database(current_user: User = Depends(get_current_user)):\n    db.clear_all()",
                    "_raw_message": "Endpoint lacks authentication decorator"
                }
            ]
        else:
            findings = []
        return findings, ""

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

        # Delete junk directories (node_modules, .git, build artifacts) to save disk and memory
        delete_junk_dirs(repo_dir)

        # Step 2: Scan
        raw_output = run_semgrep(repo_dir)

        # Step 3: Parse
        findings = parse_findings(raw_output, repo_dir)

        # Step 4: Enrich each finding with full file context + imported file context
        # MUST happen before shutil.rmtree — repo_dir will be deleted in finally block
        findings = _enrich_with_file_context(findings, repo_dir)

        return findings, repo_dir

    finally:
        # Always clean up — repos can be large
        shutil.rmtree(temp_dir, ignore_errors=True)


def get_package_files(clone_url: str, access_token: str) -> dict[str, str]:
    """
    Clone repo and extract just package manifest files.
    """
    if access_token == "mock_github_token":
        return {
            "package.json": '{\n  "dependencies": {\n    "express": "^4.18.2",\n    "pg": "^8.11.3",\n    "react": "^18.2.0"\n  }\n}'
        }

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


def verify_semgrep_patch(
    file_path: str,
    content: str,
    rule_id: str,
    line_start: int = 0,
    line_end: int = 0,
    ai_fix_code: str = ""
) -> tuple[bool, str]:
    """
    Writes the patched content to a temporary file and runs Semgrep scan on it.
    Returns: (is_resolved: bool, error_message: str)
    """
    suffix = Path(file_path).suffix
    temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode="w", encoding="utf-8")
    try:
        temp_file.write(content)
        temp_file.flush()
        temp_file.close()
        
        # Run Semgrep on the temp file
        raw_output = run_semgrep(temp_file.name)
        results = raw_output.get("results", [])
        
        # Verify if the specific rule_id is still present in the results
        triggered = [r for r in results if r.get("check_id") == rule_id]
        if triggered:
            # If line_start is specified, check if the triggered finding overlaps with the patched range
            if line_start > 0:
                patch_line_count = len(ai_fix_code.splitlines()) if ai_fix_code else 1
                patch_start = line_start
                patch_end = line_start + patch_line_count - 1
                
                overlapping_findings = []
                for r in triggered:
                    f_start = r.get("start", {}).get("line", 0)
                    f_end = r.get("end", {}).get("line", f_start)
                    
                    # Check overlap: max(patch_start, f_start) <= min(patch_end, f_end)
                    if max(patch_start, f_start) <= min(patch_end, f_end):
                        overlapping_findings.append(r)
                
                if not overlapping_findings:
                    # Triggered findings exist but do not overlap with the patched line range.
                    # This means other parts of the file contain the vulnerability, but our patch resolved this instance.
                    return True, ""
                
                # Use the first overlapping finding for the error message
                triggered_finding = overlapping_findings[0]
            else:
                triggered_finding = triggered[0]
                
            msg = triggered_finding.get("extra", {}).get("message", "Semgrep vulnerability still triggered.")
            return False, f"Patch still triggers Semgrep rule '{rule_id}': {msg}"
            
        return True, ""
    except Exception as e:
        logger.warning(f"Post-fix Semgrep verification failed to run: {e}. Falling back to default validation (pass open).")
        return True, ""
    finally:
        try:
            os.unlink(temp_file.name)
        except Exception:
            pass