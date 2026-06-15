"""
Packages router — package registry audit results.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import get_db
from app.services import get_current_user_id

router = APIRouter(prefix="/api/packages", tags=["packages"])


@router.get("")
async def list_packages(
    repo_id: str | None = Query(None),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List package audit results, sorted dangerous first."""
    query = (
        db.table("packages")
        .select("*, repos!inner(user_id)")
        .eq("repos.user_id", current_user_id)
    )
    if repo_id:
        query = query.eq("repo_id", repo_id)

    result = query.execute()
    packages = result.data or []

    # Sort: dangerous → suspect → safe → unknown
    order = {"dangerous": 0, "suspect": 1, "safe": 2, "unknown": 3}
    packages.sort(key=lambda p: order.get(p.get("status", "unknown"), 3))
    return packages


@router.post("/{package_id}/action")
async def package_action(
    package_id: str,
    action: str = Query(..., description="replace | verify | ignore"),
    current_user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Apply an action to a flagged package.
    replace → marks as safe (founder is replacing with alternative)
    verify → marks as safe (founder manually confirmed it's OK)
    ignore → deletes the record entirely
    """
    if action not in ("replace", "verify", "ignore"):
        raise HTTPException(status_code=400, detail=f"Invalid action. Use: replace, verify, ignore")

    # Verify ownership
    pkg = db.table("packages").select("id, repo_id, repos!inner(user_id)").eq("id", package_id).execute()
    if not pkg.data or pkg.data[0]["repos"]["user_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if action == "ignore":
        db.table("packages").delete().eq("id", package_id).execute()
    else:
        db.table("packages").update({"status": "safe"}).eq("id", package_id).execute()

    return {"success": True, "action": action}
