"""
Admin Router
Provides administrative insights and usage metrics across the DebtMap platform.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import get_db
from app.services import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

def check_admin_user(current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """Dependency helper to verify the user has admin privileges via DB flag."""
    user_res = db.table("users").select("is_admin").eq("id", current_user_id).execute()
    if not user_res.data:
        raise HTTPException(status_code=401, detail="User profile not found")
    
    if not user_res.data[0].get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied: Administrator permissions required")
    return current_user_id

@router.get("/insights")
async def get_admin_insights(
    admin_user_id: str = Depends(check_admin_user),
    db=Depends(get_db),
    limit: int = Query(500, ge=1, le=5000, description="Number of rows to sample per table for breakdowns"),
    offset: int = Query(0, ge=0, description="Offset for paginated sample"),
):
    """
    Retrieve application metrics and insights.

    - `stats.*` are exact total counts (from `count=exact`).
    - Breakdowns (plans, languages, scan_status, issue_severity, issue_status)
      are computed from a paginated **sample** of the first `limit` rows
      starting at `offset`. Increase `limit` for more accurate breakdowns.
    """
    try:
        # 1. Users — exact count + sample for plan breakdown
        users_res = db.table("users").select("plan", count="exact").range(offset, offset + limit - 1).execute()
        total_users = users_res.count or 0
        plan_counts = {"free": 0, "pro": 0, "team": 0, "enterprise": 0}
        for u in (users_res.data or []):
            plan = u.get("plan", "free")
            if plan in plan_counts:
                plan_counts[plan] += 1

        # 2. Repos — exact count + sample for language breakdown
        repos_res = db.table("repos").select("language", count="exact").range(offset, offset + limit - 1).execute()
        total_repos = repos_res.count or 0
        lang_counts = {}
        for r in (repos_res.data or []):
            lang = r.get("language") or "Unknown"
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

        # 3. Scans — exact count + sample for status breakdown + recent scans
        scans_res = db.table("scans").select("id, status, findings_count, triggered_at, repos(full_name)", count="exact").order("triggered_at", desc=True).range(offset, offset + limit - 1).execute()
        total_scans = scans_res.count or 0
        scans = scans_res.data or []
        status_counts = {"queued": 0, "running": 0, "completed": 0, "failed": 0}
        recent_scans = []
        for s in scans:
            status = s.get("status", "queued")
            if status in status_counts:
                status_counts[status] += 1
            if len(recent_scans) < 10:
                repo_name = s.get("repos", {}).get("full_name") if s.get("repos") else "Deleted repository"
                recent_scans.append({
                    "id": s["id"],
                    "repo_name": repo_name,
                    "status": s["status"],
                    "findings_count": s.get("findings_count") or 0,
                    "triggered_at": s.get("triggered_at"),
                })

        # 4. Issues — exact count + sample for severity/status breakdown
        issues_res = db.table("issues").select("severity, status", count="exact").range(offset, offset + limit - 1).execute()
        total_issues = issues_res.count or 0
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        status_counts_issues = {"open": 0, "resolved": 0, "dismissed": 0}
        for i in (issues_res.data or []):
            sev = i.get("severity", "low")
            if sev in severity_counts:
                severity_counts[sev] += 1
            st = i.get("status", "open")
            if st in status_counts_issues:
                status_counts_issues[st] += 1

        return {
            "stats": {
                "total_users": total_users,
                "total_repos": total_repos,
                "total_scans": total_scans,
                "total_issues": total_issues,
            },
            "plans": plan_counts,
            "languages": lang_counts,
            "scan_status": status_counts,
            "recent_scans": recent_scans,
            "issue_severity": severity_counts,
            "issue_status": status_counts_issues,
        }
    except Exception as e:
        logger.exception("Failed to query admin insights")
        raise HTTPException(status_code=500, detail=f"Failed to load administrative insights: {str(e)}")
