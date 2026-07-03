"""
Admin Router
Provides administrative insights and usage metrics across the Risk Guard AI platform.
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
    Retrieve advanced application metrics and administrative insights.
    """
    try:
        # 1. Users — exact count + sample for plan breakdown + recent sign-ups
        users_res = db.table("users").select("id, email, name, plan, created_at", count="exact").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        total_users = users_res.count or 0
        plan_counts = {"free": 0, "pro": 0, "team": 0, "enterprise": 0}
        recent_users = []
        
        for u in (users_res.data or []):
            plan = u.get("plan", "free")
            if plan in plan_counts:
                plan_counts[plan] += 1
            if len(recent_users) < 10:
                recent_users.append({
                    "id": u["id"],
                    "email": u.get("email"),
                    "name": u.get("name") or "Unknown",
                    "plan": plan,
                    "created_at": u.get("created_at"),
                })

        # 2. Repos — exact count + sample for language / generator breakdown + average health score + top vulnerable
        repos_res = db.table("repos").select("id, full_name, language, generator, health_score, critical_count, high_count, created_at, users(name, email)", count="exact").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        total_repos = repos_res.count or 0
        
        lang_counts = {}
        generator_counts = {}
        scores = []
        vulnerable_repos_raw = []
        
        for r in (repos_res.data or []):
            lang = r.get("language") or "Unknown"
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
            
            gen = r.get("generator") or "Unknown"
            generator_counts[gen] = generator_counts.get(gen, 0) + 1
            
            h_score = r.get("health_score")
            if h_score is not None:
                scores.append(h_score)
                if h_score < 100:
                    vulnerable_repos_raw.append(r)
            else:
                # Assume 100 if not scanned yet
                scores.append(100)
                
        avg_health_score = int(sum(scores) / len(scores)) if scores else 100
        
        # Sort vulnerable repos by health score ascending (most vulnerable first)
        vulnerable_repos_raw.sort(key=lambda x: x.get("health_score", 100))
        top_vulnerable_repos = []
        for r in vulnerable_repos_raw[:10]:
            user_info = r.get("users") or {}
            top_vulnerable_repos.append({
                "id": r["id"],
                "repo_name": r["full_name"],
                "health_score": r.get("health_score", 100),
                "critical_count": r.get("critical_count") or 0,
                "high_count": r.get("high_count") or 0,
                "created_at": r.get("created_at"),
                "user_name": user_info.get("name") or "Unknown",
                "user_email": user_info.get("email") or "Unknown",
            })

        # 3. Scans — exact count + status breakdown + recent scans
        scans_res = db.table("scans").select("id, status, findings_count, triggered_at, repos(full_name)", count="exact").order("triggered_at", desc=True).range(offset, offset + limit - 1).execute()
        total_scans = scans_res.count or 0
        scans = scans_res.data or []
        status_counts = {"queued": 0, "running": 0, "completed": 0, "failed": 0, "retrying": 0}
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

        # 4. Issues — exact count + sample for severity/status breakdown + common rule titles
        issues_res = db.table("issues").select("severity, status, semgrep_rule_id, plain_english_title", count="exact").range(offset, offset + limit - 1).execute()
        total_issues = issues_res.count or 0
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        status_counts_issues = {"open": 0, "resolved": 0, "dismissed": 0, "fixed": 0}
        vuln_counts = {}
        
        for i in (issues_res.data or []):
            sev = i.get("severity", "low")
            if sev in severity_counts:
                severity_counts[sev] += 1
            st = i.get("status", "open")
            if st in status_counts_issues:
                status_counts_issues[st] += 1
            
            rule_id = i.get("semgrep_rule_id") or "unknown"
            title = i.get("plain_english_title") or rule_id
            if title not in vuln_counts:
                vuln_counts[title] = {"count": 0, "rule_id": rule_id}
            vuln_counts[title]["count"] += 1
            
        sorted_vulns = sorted(vuln_counts.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
        common_vulnerabilities = [
            {"title": title, "rule_id": val["rule_id"], "count": val["count"]}
            for title, val in sorted_vulns
        ]

        # 5. Packages — exact count + status breakdown + dangerous package details
        packages_res = db.table("packages").select("id, package_name, package_manager, status, reason, checked_at, repos(full_name)", count="exact").range(offset, offset + limit - 1).execute()
        total_packages = packages_res.count or 0
        package_status_counts = {"safe": 0, "suspect": 0, "dangerous": 0, "unknown": 0}
        dangerous_packages = []
        
        for p in (packages_res.data or []):
            status = p.get("status", "unknown")
            if status in package_status_counts:
                package_status_counts[status] += 1
            
            if status in ["dangerous", "suspect"] and len(dangerous_packages) < 10:
                repo_name = p.get("repos", {}).get("full_name") if p.get("repos") else "Deleted repository"
                dangerous_packages.append({
                    "id": p["id"],
                    "package_name": p["package_name"],
                    "package_manager": p["package_manager"],
                    "status": p["status"],
                    "reason": p.get("reason") or "Suspect dependencies flagged",
                    "repo_name": repo_name,
                    "checked_at": p.get("checked_at")
                })

        return {
            "stats": {
                "total_users": total_users,
                "total_repos": total_repos,
                "total_scans": total_scans,
                "total_issues": total_issues,
                "total_packages": total_packages,
                "avg_health_score": avg_health_score,
                "dangerous_packages_count": package_status_counts.get("dangerous", 0) + package_status_counts.get("suspect", 0),
            },
            "plans": plan_counts,
            "languages": lang_counts,
            "generators": generator_counts,
            "scan_status": status_counts,
            "recent_scans": recent_scans,
            "recent_users": recent_users,
            "top_vulnerable_repos": top_vulnerable_repos,
            "issue_severity": severity_counts,
            "issue_status": status_counts_issues,
            "common_vulnerabilities": common_vulnerabilities,
            "package_status": package_status_counts,
            "dangerous_packages": dangerous_packages,
        }
    except Exception as e:
        logger.exception("Failed to query admin insights")
        raise HTTPException(status_code=500, detail=f"Failed to load administrative insights: {str(e)}")
