import logging
import uuid
from typing import Any
import httpx
from app.config import get_settings
from app.services.groq import get_client

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = (
    "You are a senior security architect. Your job is to explain the combined risk of "
    "multiple related vulnerabilities in a single system component or layer. Explain it in "
    "one clear, high-impact sentence that a non-technical startup founder can understand. "
    "Do NOT mention Semgrep or specific rule names; explain the combined risk (e.g. 'Your authentication "
    "system is compromised — login bypass means anyone can gain full control of user accounts')."
)

async def explain_combined_risk(component: str, issues: list[dict]) -> str:
    """Ask Groq to explain the combined risk of these issues, or use fallback."""
    api_key = get_client()
    
    # 1. Rule-based fallbacks for common components
    comp_lower = component.lower()
    if "auth" in comp_lower or "login" in comp_lower or "session" in comp_lower:
        fallback = "Your authentication system is compromised — multiple vulnerabilities working together mean attackers can bypass login and hijack user accounts."
    elif "db" in comp_lower or "database" in comp_lower or "sql" in comp_lower:
        fallback = "Your database interface has multiple exposures — attackers can inject malicious queries to access, alter, or delete any record in your database."
    elif "api" in comp_lower or "routes" in comp_lower or "endpoints" in comp_lower:
        fallback = "Multiple endpoints lack authorization checks, exposing system control panels and private APIs to unauthenticated visitors."
    else:
        fallback = f"Multiple vulnerabilities in the {component} component increase the attack surface and risk of unauthorized access or data exposure."

    if not api_key:
        return fallback

    # 2. Call Groq
    try:
        issues_summary = []
        for idx, iss in enumerate(issues):
            title = iss.get("plain_english_title", "Security vulnerability")
            body = iss.get("plain_english_body", "")
            issues_summary.append(f"{idx+1}. {title}: {body}")
            
        issues_list_text = "\n".join(issues_summary)
        
        prompt = (
            f"We found these security issues in our {component} component:\n\n"
            f"{issues_list_text}\n\n"
            f"These findings are in the same component. Write one sentence explaining the combined risk."
        )
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            explanation = data["choices"][0]["message"]["content"].strip()
            # Clean explanation (remove extra quotes if any)
            explanation = explanation.replace('"', '').strip()
            return explanation
    except Exception as e:
        logger.error(f"Groq combined risk explanation failed: {e}")
        return fallback


def group_findings(findings: list[dict]) -> list[dict]:
    """
    Groups findings by component. Returns a list of correlated group dicts:
    [
        {
            "component": "Authentication",
            "title": "Compromised Authentication System",
            "findings": [finding1, finding2, ...]
        },
        ...
    ]
    """
    # 1. Initialize buckets
    auth_bucket = []
    db_bucket = []
    api_bucket = []
    
    # Bucket for other files grouped by exact path
    file_buckets = {}
    
    # 2. Distribute findings to buckets
    for f in findings:
        rule_id = f.get("semgrep_rule_id", "").lower()
        file_path = f.get("file_path", "").lower()
        
        # Check auth
        if "auth" in file_path or "login" in file_path or "session" in file_path or "auth" in rule_id or "jwt" in rule_id:
            auth_bucket.append(f)
        # Check db
        elif "db" in file_path or "database" in file_path or "sql" in file_path or "models" in file_path or "prisma" in file_path or "sql" in rule_id:
            db_bucket.append(f)
        # Check api
        elif "api" in file_path or "routes" in file_path or "controllers" in file_path or "endpoints" in file_path or "route" in rule_id:
            api_bucket.append(f)
        # Fallback group by filename/path
        else:
            file_buckets.setdefault(f.get("file_path"), []).append(f)
            
    groups = []
    
    # Add layer-based groups if they contain at least 2 findings
    if len(auth_bucket) >= 2:
        groups.append({
            "component": "Authentication",
            "title": "Compromised Authentication System",
            "findings": auth_bucket
        })
    if len(db_bucket) >= 2:
        groups.append({
            "component": "Database",
            "title": "Exposed Database Layer",
            "findings": db_bucket
        })
    if len(api_bucket) >= 2:
        groups.append({
            "component": "API Gateway",
            "title": "Insecure API Endpoints",
            "findings": api_bucket
        })
        
    # Add file-based groups if they contain at least 2 findings and are not already captured
    for path, path_findings in file_buckets.items():
        if len(path_findings) >= 2:
            filename = path.split("/")[-1]
            # Avoid duplicating files that were already put in the other buckets
            # Filter findings that aren't already grouped
            filename_findings = []
            for pf in path_findings:
                if pf not in auth_bucket and pf not in db_bucket and pf not in api_bucket:
                    filename_findings.append(pf)
            if len(filename_findings) >= 2:
                groups.append({
                    "component": filename,
                    "title": f"Multiple Issues in {filename}",
                    "findings": filename_findings
                })
            
    return groups


async def correlate_scan_findings(
    repo_id: str,
    scan_id: str,
    findings: list[dict],
    db_client: Any
) -> list[dict]:
    """
    Runs correlation pass on findings. 
    Explains the combined risk using Groq.
    Saves the groups to the attack_surfaces database table.
    """
    # 1. Group findings
    groups = group_findings(findings)
    if not groups:
        return []
        
    attack_surfaces = []
    
    for g in groups:
        component = g["component"]
        title = g["title"]
        group_findings_list = g["findings"]
        
        # Get combined risk explanation
        description = await explain_combined_risk(component, group_findings_list)
        
        # Collect issue IDs (UUIDs)
        issue_ids = [f["id"] for f in group_findings_list if f.get("id")]
        
        surface_row = {
            "id": str(uuid.uuid4()),
            "repo_id": repo_id,
            "scan_id": scan_id,
            "title": title,
            "description": description,
            "component": component,
            "issue_ids": issue_ids,
        }
        attack_surfaces.append(surface_row)
        
    # Save to database (check if table exists first)
    if attack_surfaces:
        try:
            db_client.table("attack_surfaces").insert(attack_surfaces).execute()
        except Exception as e:
            logger.error(f"Failed to insert attack surfaces: {e}")
            
    return attack_surfaces
