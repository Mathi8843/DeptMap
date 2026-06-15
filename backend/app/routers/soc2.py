"""
SOC 2 compliance router.
Generates readiness report by mapping open issues to SOC 2 Trust Services Criteria.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from app.database import get_db
from app.services.scorer import compute_soc2_status
from app.services import get_current_user_id

router = APIRouter(prefix="/api/soc2", tags=["soc2"])


@router.get("")
async def get_soc2_report(
    repo_id: str | None = Query(None),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Generate SOC 2 readiness report.
    Maps open issues to SOC 2 Trust Services Criteria controls.
    Calculates readiness percentage based on control pass/fail/partial status.
    """
    # Get all issues for user (open and fixed — we need the full picture)
    query = (
        db.table("issues")
        .select("*, repos!inner(user_id)")
        .eq("repos.user_id", current_user_id)
    )
    if repo_id:
        query = query.eq("repo_id", repo_id)

    result = query.execute()
    issues = result.data or []

    controls = compute_soc2_status(issues)
    passing = sum(1 for c in controls if c["status"] == "passing")
    failing = sum(1 for c in controls if c["status"] == "failing")
    partial = sum(1 for c in controls if c["status"] == "partial")
    readiness = round(((passing + partial * 0.5) / max(len(controls), 1)) * 100)

    return {
        "repo_id": repo_id or "all",
        "readiness_percent": readiness,
        "controls": controls,
        "passing_count": passing,
        "failing_count": failing,
        "partial_count": partial,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
