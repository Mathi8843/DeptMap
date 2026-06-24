"""
Pydantic models for all API request/response schemas.
These define the shape of data flowing through the API.
"""
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ─── Auth ─────────────────────────────────────────────────────────────────────

class GitHubCallbackRequest(BaseModel):
    code: str  # OAuth code from GitHub


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    plan: str


# ─── Repository ───────────────────────────────────────────────────────────────

class RepoConnectRequest(BaseModel):
    github_repo_full_name: str = Field(
        ..., example="mathivanan/saas-app",
        description="owner/repo format from GitHub"
    )
    generator: str = Field("Unknown", example="Lovable")


class RepoResponse(BaseModel):
    id: str
    user_id: str
    github_repo_id: int
    full_name: str
    language: Optional[str]
    default_branch: str
    is_private: bool
    last_scanned_at: Optional[datetime]
    health_score: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    generator: str
    created_at: datetime


# ─── Scan ─────────────────────────────────────────────────────────────────────

class ScanTriggerRequest(BaseModel):
    repo_id: str


class ScanStatusResponse(BaseModel):
    scan_id: str
    repo_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: int  # 0–100
    log_messages: list[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    findings_count: int = 0


# ─── Issue ────────────────────────────────────────────────────────────────────

class IssueResponse(BaseModel):
    id: str
    repo_id: str
    repo_name: str
    scan_id: str
    semgrep_rule_id: str
    severity: Literal["critical", "high", "medium", "low"]
    file_path: str
    line_start: int
    line_end: int
    code_snippet: str
    plain_english_title: str
    plain_english_body: str
    impact_bullets: list[str]
    ai_fix_code: str
    status: Literal["open", "fixed", "dismissed"]
    fix_pr_url: Optional[str]
    confidence: Optional[int] = None
    what_changed: Optional[str] = None
    created_at: datetime


class IssueDismissRequest(BaseModel):
    issue_id: str


class IssueFixResponse(BaseModel):
    success: bool
    pr_url: Optional[str]
    pr_number: Optional[int]
    message: str


# ─── Package ──────────────────────────────────────────────────────────────────

class PackageResponse(BaseModel):
    id: str
    repo_id: str
    scan_id: str
    package_name: str
    package_manager: Literal["npm", "pypi", "unknown"]
    status: Literal["safe", "suspect", "dangerous", "unknown"]
    exists_in_registry: bool
    weekly_downloads: Optional[int]
    reason: str
    alternative_name: Optional[str]
    checked_at: datetime


# ─── Health Trend ─────────────────────────────────────────────────────────────

class HealthDataPoint(BaseModel):
    date: str  # e.g. "Jun 10"
    score: int
    introduced: int
    fixed: int
    recorded_at: datetime


# ─── SOC 2 ───────────────────────────────────────────────────────────────────

class Soc2ControlResponse(BaseModel):
    id: str  # e.g. "CC6.1"
    name: str
    status: Literal["passing", "failing", "partial"]
    issues: list[str]  # issue titles blocking this control


class Soc2ReportResponse(BaseModel):
    repo_id: str
    readiness_percent: int
    controls: list[Soc2ControlResponse]
    passing_count: int
    failing_count: int
    partial_count: int
    generated_at: datetime


# ─── Webhook ──────────────────────────────────────────────────────────────────

class GitHubPushPayload(BaseModel):
    """Subset of fields we care about from GitHub push event."""
    ref: str          # e.g. "refs/heads/main"
    repository: dict  # contains full_name, id, clone_url
    sender: dict      # contains login


class GitHubPRPayload(BaseModel):
    """Subset of fields from GitHub pull_request event."""
    action: str       # opened, synchronize, closed
    pull_request: dict
    repository: dict
