"""
Admin Router
Provides administrative insights and usage metrics across the DebtMap platform.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.services import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_EMAILS = ["mathi@debtmap.io", "admin@debtmap.io"]

def check_admin_user(current_user_id: str = Depends(get_current_user_id), db=Depends(get_db)):
    """Dependency helper to verify the user is an administrator."""
    user_res = db.table("users").select("email").eq("id", current_user_id).execute()
    if not user_res.data:
        raise HTTPException(status_code=401, detail="User profile not found")
    
    email = user_res.data[0].get("email", "")
    # Restrict to configured admin emails or domain
    if email not in ADMIN_EMAILS and not email.endswith("@debtmap.io"):
        raise HTTPException(status_code=403, detail="Access denied: Administrator permissions required")
    return current_user_id

@router.get("/insights")
async def get_admin_insights(
    admin_user_id: str = Depends(check_admin_user),
    db=Depends(get_db)
):
    """Retrieve application metrics and insights across users, repositories, scans, and security issues."""
    try:
        # 1. Fetch Users
        users_res = db.table("users").select("id, plan, created_at").execute()
        users = users_res.data or []
        
        plan_counts = {"free": 0, "pro": 0, "team": 0, "enterprise": 0}
        for u in users:
            plan = u.get("plan", "free")
            if plan in plan_counts:
                plan_counts[plan] += 1
                
        # 2. Fetch Connected Repositories
        repos_res = db.table("repos").select("id, language, full_name").execute()
        repos = repos_res.data or []
        
        lang_counts = {}
        for r in repos:
            lang = r.get("language") or "Unknown"
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
            
        # 3. Fetch Scans
        scans_res = db.table("scans").select("id, status, findings_count, triggered_at, repos(full_name)").execute()
        scans = scans_res.data or []
        
        status_counts = {"queued": 0, "running": 0, "completed": 0, "failed": 0}
        for s in scans:
            status = s.get("status", "queued")
            if status in status_counts:
                status_counts[status] += 1
                
        # Sort to extract top 10 recent scans
        recent_scans = []
        sorted_scans = sorted(scans, key=lambda x: x.get("triggered_at", "") or "", reverse=True)
        for s in sorted_scans[:10]:
            repo_name = s.get("repos", {}).get("full_name") if s.get("repos") else "Deleted repository"
            recent_scans.append({
                "id": s["id"],
                "repo_name": repo_name,
                "status": s["status"],
                "findings_count": s.get("findings_count") or 0,
                "triggered_at": s.get("triggered_at")
            })

        # 4. Fetch Security Issues
        issues_res = db.table("issues").select("id, severity, status").execute()
        issues = issues_res.data or []
        
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        status_counts_issues = {"open": 0, "resolved": 0, "dismissed": 0}
        for i in issues:
            sev = i.get("severity", "low")
            if sev in severity_counts:
                severity_counts[sev] += 1
            status = i.get("status", "open")
            if status in status_counts_issues:
                status_counts_issues[status] += 1
                
        return {
            "stats": {
                "total_users": len(users),
                "total_repos": len(repos),
                "total_scans": len(scans),
                "total_issues": len(issues),
            },
            "plans": plan_counts,
            "languages": lang_counts,
            "scan_status": status_counts,
            "recent_scans": recent_scans,
            "issue_severity": severity_counts,
            "issue_status": status_counts_issues
        }
    except Exception as e:
        logger.exception("Failed to query admin insights")
        raise HTTPException(status_code=500, detail=f"Failed to load administrative insights: {str(e)}")
