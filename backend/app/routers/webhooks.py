"""
GitHub Webhooks router.
Receives push events from GitHub and triggers automatic scans.

Setup in GitHub:
1. Go to your GitHub repo Settings → Webhooks → Add webhook
2. Payload URL: https://your-backend.com/api/webhooks/github
3. Content type: application/json
4. Secret: same value as GITHUB_WEBHOOK_SECRET in your .env
5. Events: Select "Just the push event"
"""
import asyncio
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import get_settings
from app.database import get_db
from app.rate_limit import limiter
from app.services import decrypt_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
settings = get_settings()


def verify_github_signature(payload: bytes, signature: str | None) -> bool:
    """
    Verify HMAC-SHA256 signature from GitHub.
    Without this, anyone could POST fake webhook events to trigger scans.
    """
    if not signature or not signature.startswith("sha256="):
        return False

    expected_sig = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_sig, signature)


@router.post("/github")
@limiter.limit("30/minute")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header(None, alias="X-Hub-Signature-256"),
    db=Depends(get_db),
):
    """
    Entry point for all GitHub webhook events.
    Currently handles: ping (test), push (trigger scan).
    """
    raw_body = await request.body()

    # Reject unverified webhooks
    if not verify_github_signature(raw_body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = x_github_event or "unknown"
    data = await request.json()

    if event == "ping":
        return {"message": "pong — Risk Guard AI webhook receiver online"}

    if event == "push":
        return await handle_push_event(data, db)

    logger.info(f"Unhandled webhook event: {event}")
    return {"message": f"Event '{event}' received — not handled"}


async def handle_push_event(data: dict, db) -> dict:
    """
    Handle a GitHub push event.
    Finds the connected repo in our DB and queues a scan.
    """
    repo_info = data.get("repository", {})
    full_name = repo_info.get("full_name")
    branch = data.get("ref", "").replace("refs/heads/", "")

    if not full_name:
        return {"message": "No repository info in payload"}

    # Only scan default branch pushes (ignore feature branches)
    default_branch = repo_info.get("default_branch", "main")
    if branch != default_branch:
        logger.info(f"Ignoring push to non-default branch: {branch}")
        return {"message": f"Ignoring push to branch '{branch}' (not default)"}

    # Find connected repo in our DB
    repo_result = db.table("repos").select("id, user_id, full_name").eq("full_name", full_name).execute()
    if not repo_result.data:
        return {"message": f"Repo '{full_name}' not connected to Risk Guard AI"}

    queued_scans = []
    for repo in repo_result.data:
        # Check user plan: free tier does not support push-triggered scans
        user_res = db.table("users").select("plan").eq("id", repo["user_id"]).execute()
        plan = "free"
        if user_res.data:
            plan = user_res.data[0].get("plan", "free")
            
        if plan == "free":
            logger.info(f"Ignoring push webhook for repo {full_name} — free plan does not support push-triggered scans.")
            continue

        scan_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        db.table("scans").insert({
            "id": scan_id,
            "repo_id": repo["id"],
            "status": "queued",
            "triggered_at": now,
            "findings_count": 0,
            "trigger_source": f"webhook:push:{branch}",
            "progress": 0,
            "log_messages": [f"[SYSTEM] Webhook triggered scan for push to {branch}..."],
        }).execute()

        queued_scans.append(scan_id)
        logger.info(f"Queued scan {scan_id} for {full_name} (push by {data.get('pusher', {}).get('name', 'unknown')})")

    return {
        "message": f"Scan(s) queued for {full_name}",
        "scan_ids": queued_scans,
    }
