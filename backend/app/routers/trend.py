"""
Trend router — health score history for charts.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from app.database import get_db
from app.services import get_current_user_id

router = APIRouter(prefix="/api/trend", tags=["trend"])


@router.get("")
async def get_trend(
    repo_id: str | None = Query(None),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Get health score history for trend charts.
    Returns data formatted for Recharts (date label + score + introduced + fixed).
    """
    # Fetch user plan to verify trend chart authorization
    user_res = db.table("users").select("plan").eq("id", current_user_id).execute()
    if not user_res.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
        
    plan = user_res.data[0].get("plan", "free")
    if plan == "free":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="Technical debt trend history is available on premium plans. Please upgrade."
        )
    query = (
        db.table("health_history")
        .select("*, repos!inner(user_id)")
        .eq("repos.user_id", current_user_id)
        .order("recorded_at", desc=False)
    )
    if repo_id:
        query = query.eq("repo_id", repo_id)

    result = query.execute()
    history = result.data or []

    # Format for Recharts — last 12 data points
    formatted = []
    for point in history[-12:]:
        dt = datetime.fromisoformat(point["recorded_at"].replace("Z", "+00:00"))
        formatted.append({
            "date": dt.strftime("%b %d"),
            "score": point["score"],
            "introduced": point.get("introduced_count", 0),
            "fixed": point.get("fixed_count", 0),
        })

    return formatted
