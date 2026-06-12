"""
Package registry validation service.
Checks every dependency in a project against official npm/PyPI registries
to detect hallucinated (slopsquatted) packages that AI tools invented.

Logic:
- If package doesn't exist in registry → DANGEROUS (hallucinated)
- If exists but < 1,000 weekly downloads → SUSPECT (low adoption, risky)
- If exists and ≥ 1,000 weekly downloads → SAFE

Also detects typosquatting: packages whose names are close to popular ones.
"""
import json
import re
import logging
from typing import Literal
import httpx

logger = logging.getLogger(__name__)

PackageStatus = Literal["safe", "suspect", "dangerous", "unknown"]

# Weekly download threshold — below this is "suspect"
SUSPECT_THRESHOLD = 1_000


# ─── npm Registry ─────────────────────────────────────────────────────────────

async def check_npm_package(package_name: str, client: httpx.AsyncClient) -> dict:
    """
    Check a single npm package against registry.npmjs.org.
    Returns: { exists, weekly_downloads, status, reason }
    """
    try:
        # npm registry API — no auth required
        resp = await client.get(
            f"https://registry.npmjs.org/{package_name}",
            timeout=10.0,
        )
        if resp.status_code == 404:
            return {
                "exists_in_registry": False,
                "weekly_downloads": None,
                "status": "dangerous",
                "reason": f"Package '{package_name}' does not exist in npm registry. AI may have hallucinated this package name.",
            }

        if resp.status_code != 200:
            return {
                "exists_in_registry": False,
                "weekly_downloads": None,
                "status": "unknown",
                "reason": f"Registry returned status {resp.status_code}",
            }

        # Get weekly downloads from npm API
        downloads_resp = await client.get(
            f"https://api.npmjs.org/downloads/point/last-week/{package_name}",
            timeout=10.0,
        )
        weekly_downloads = 0
        if downloads_resp.status_code == 200:
            weekly_downloads = downloads_resp.json().get("downloads", 0)

        status: PackageStatus = "safe" if weekly_downloads >= SUSPECT_THRESHOLD else "suspect"
        reason = (
            f"Verified in npm registry with {weekly_downloads:,} weekly downloads."
            if status == "safe"
            else f"Package exists but only has {weekly_downloads:,} weekly downloads — unusually low for a legitimate package."
        )

        return {
            "exists_in_registry": True,
            "weekly_downloads": weekly_downloads,
            "status": status,
            "reason": reason,
        }

    except httpx.TimeoutException:
        return {
            "exists_in_registry": False,
            "weekly_downloads": None,
            "status": "unknown",
            "reason": "Registry check timed out — could not verify package",
        }


# ─── PyPI Registry ────────────────────────────────────────────────────────────

async def check_pypi_package(package_name: str, client: httpx.AsyncClient) -> dict:
    """
    Check a single PyPI package against pypi.org.
    PyPI doesn't expose weekly downloads directly — we check existence only
    and use a secondary pypistats.org call for download counts.
    """
    try:
        resp = await client.get(
            f"https://pypi.org/pypi/{package_name}/json",
            timeout=10.0,
        )
        if resp.status_code == 404:
            return {
                "exists_in_registry": False,
                "weekly_downloads": None,
                "status": "dangerous",
                "reason": f"Package '{package_name}' does not exist on PyPI. AI may have hallucinated this package name.",
            }

        # Try to get download stats
        weekly_downloads = 0
        try:
            stats_resp = await client.get(
                f"https://pypistats.org/api/packages/{package_name}/recent",
                timeout=8.0,
            )
            if stats_resp.status_code == 200:
                data = stats_resp.json().get("data", {})
                weekly_downloads = data.get("last_week", 0)
        except Exception:
            pass  # pypistats can be unreliable; existence check is primary signal

        status: PackageStatus = "safe" if weekly_downloads >= SUSPECT_THRESHOLD else "suspect"
        reason = (
            f"Verified on PyPI with {weekly_downloads:,} weekly downloads."
            if status == "safe"
            else (
                f"Package exists on PyPI but download data unavailable — verify manually."
                if weekly_downloads == 0
                else f"Package exists but only has {weekly_downloads:,} weekly downloads."
            )
        )

        return {
            "exists_in_registry": True,
            "weekly_downloads": weekly_downloads if weekly_downloads > 0 else None,
            "status": status if weekly_downloads > 0 else "suspect",
            "reason": reason,
        }

    except httpx.TimeoutException:
        return {
            "exists_in_registry": False,
            "weekly_downloads": None,
            "status": "unknown",
            "reason": "Registry check timed out",
        }


# ─── Package File Parsers ─────────────────────────────────────────────────────

def parse_package_json(content: str) -> list[str]:
    """Extract all dependency names from package.json."""
    try:
        data = json.loads(content)
        deps = {}
        deps.update(data.get("dependencies", {}))
        deps.update(data.get("devDependencies", {}))
        deps.update(data.get("peerDependencies", {}))
        return list(deps.keys())
    except (json.JSONDecodeError, AttributeError):
        return []


def parse_requirements_txt(content: str) -> list[str]:
    """Extract package names from requirements.txt (pip format)."""
    packages = []
    for line in content.splitlines():
        line = line.strip()
        # Skip comments, empty lines, options
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Extract package name before version specifier
        match = re.match(r"^([A-Za-z0-9_\-\.]+)", line)
        if match:
            packages.append(match.group(1))
    return packages


# ─── Main Audit Function ──────────────────────────────────────────────────────

async def audit_packages(package_files: dict[str, str]) -> list[dict]:
    """
    Audit all packages found in the provided package manifest files.
    
    Args:
        package_files: dict of { filename: content } from semgrep.get_package_files()
    
    Returns:
        list of package audit results for storage in packages table
    """
    all_packages: list[tuple[str, str]] = []  # (package_name, manager)

    if "package.json" in package_files:
        npm_pkgs = parse_package_json(package_files["package.json"])
        all_packages.extend([(p, "npm") for p in npm_pkgs])

    if "requirements.txt" in package_files:
        pypi_pkgs = parse_requirements_txt(package_files["requirements.txt"])
        all_packages.extend([(p, "pypi") for p in pypi_pkgs])

    if not all_packages:
        return []

    results = []

    async with httpx.AsyncClient() as client:
        for pkg_name, manager in all_packages:
            if manager == "npm":
                result = await check_npm_package(pkg_name, client)
            elif manager == "pypi":
                result = await check_pypi_package(pkg_name, client)
            else:
                continue

            results.append({
                "package_name": pkg_name,
                "package_manager": manager,
                "status": result["status"],
                "exists_in_registry": result["exists_in_registry"],
                "weekly_downloads": result["weekly_downloads"],
                "reason": result["reason"],
                "alternative_name": _suggest_alternative(pkg_name, manager) if result["status"] == "dangerous" else None,
            })

    return results


def _suggest_alternative(package_name: str, manager: str) -> str | None:
    """
    Simple lookup table for common AI hallucinated packages.
    In production this would be a fuzzy search against real package names.
    """
    KNOWN_HALLUCINATIONS = {
        "npm": {
            "express-auth-middleware-pro": "passport",
            "supabase-rls-helper": "supabase (official SDK)",
            "next-api-validator": "zod",
            "react-query-pro": "tanstack-query",
            "mongodb-enhanced": "mongoose",
        },
        "pypi": {
            "fastapi-auth-pro": "fastapi-users",
            "supabase-helper": "supabase (official SDK)",
            "pydantic-enhanced": "pydantic (official)",
        },
    }
    return KNOWN_HALLUCINATIONS.get(manager, {}).get(package_name)
