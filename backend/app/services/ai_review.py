"""
AI Review service.
Selects up to 20 most important files from the cloned repository.
Sends each file to Groq to identify novel vulnerabilities (logic flaws, auth bypass, rate limit issues, etc.).
"""
import os
import json
import logging
import asyncio
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

EXCLUDE_DIRS = {
    "node_modules", ".git", ".next", "dist", "build",
    "__pycache__", ".pytest_cache", "venv", ".venv",
    "coverage", ".nyc_output", "target",
}

SKIP_EXTENSIONS = (
    ".min.js", ".min.css", ".map", ".lock",
    "package-lock.json", "pnpm-lock.yaml",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".pdf", ".db",
)

PRIORITY_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java",
    ".cs", ".rb", ".php", ".rs", ".kt", ".swift"
}

SYSTEM_PROMPT = """You are a senior security engineer reviewing code for a non-technical founder.
Your job is to find novel vulnerabilities that a static analysis tool would miss, specifically focusing on logic flaws, missing auth checks, and data exposure.
Explain these issues in plain English that a non-developer can understand. Avoid technical jargon or explain it simply.

Always respond with valid JSON only, using the exact JSON schema provided. Do not include any markdown, backticks (like ```json), or conversational prefix/suffix."""

USER_PROMPT_TEMPLATE = """Review this source code file for security vulnerabilities:

─── FILE PATH ───
{file_path}

─── FILE CONTENT ───
```
{file_content}
```

Identify any security flaws, logic bugs, unauthorized data access/modifications, missing rate limits, or exposed sensitive data.
For each vulnerability, provide a plain English explanation, impact bullets, confidence score, and a code correction.

If you find vulnerabilities, respond with this exact JSON format:
{{
  "findings": [
    {{
      "severity": "critical", // Must be one of: "critical", "high", "medium", "low"
      "line_start": 10,       // Start line of the vulnerable code snippet (1-indexed)
      "line_end": 15,         // End line of the vulnerable code snippet (1-indexed)
      "code_snippet": "vulnerable_code_here", // Exact code snippet containing the flaw
      "plain_english_title": "Concise title in 8 words or less (e.g. 'Anyone can read any user\\'s private settings')",
      "plain_english_body": "2-3 sentences explaining the vulnerability in plain English to a non-developer. Focus on the business and privacy impact.",
      "impact_bullets": [
        "First consequence (e.g. 'Attackers can steal private documents')",
        "Second consequence",
        "Third consequence"
      ],
      "ai_fix_code": "corrected_code_snippet_here", // Corrected version of the snippet ONLY
      "confidence": 85,       // Integer 0-100 representing confidence in the fix
      "what_changed": "One sentence explaining what this fix changed in plain English."
    }}
  ]
}}

If the file has NO vulnerabilities, respond with:
{{
  "findings": []
}}"""

def get_important_files(repo_dir: str, limit: int = 20) -> list[str]:
    all_files = []
    
    for root, dirs, files in os.walk(repo_dir, topdown=True):
        # Prune excluded directories in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
        
        for file in files:
            if file.startswith('.'):
                continue
            if file.lower().endswith(SKIP_EXTENSIONS):
                continue
                
            full_path = os.path.join(root, file)
            try:
                stat = os.stat(full_path)
                size = stat.st_size
                # Only keep files between 200B and 100KB
                if 200 <= size <= 100_000:
                    rel_path = os.path.relpath(full_path, repo_dir).replace('\\', '/')
                    all_files.append((rel_path, file, size))
            except Exception:
                continue

    # Sort files
    # Category 1: files with priority extensions, sorted by size descending
    # Category 2: other text files, sorted by size descending
    priority_files = []
    other_files = []
    
    for rel_path, file_name, size in all_files:
        ext = os.path.splitext(file_name)[1].lower()
        if ext in PRIORITY_EXTENSIONS:
            priority_files.append((rel_path, size))
        else:
            other_files.append((rel_path, size))
            
    priority_files.sort(key=lambda x: x[1], reverse=True)
    other_files.sort(key=lambda x: x[1], reverse=True)
    
    selected = priority_files[:limit]
    if len(selected) < limit:
        needed = limit - len(selected)
        selected.extend(other_files[:needed])
        
    return [path for path, size in selected]


async def review_file(file_path: str, repo_dir: str, semaphore: asyncio.Semaphore) -> list[dict]:
    """
    Review a single file using Groq LLM.
    """
    async with semaphore:
        api_key = settings.groq_api_key
        if not api_key or api_key == "gsk-your-key-here" or api_key.strip() == "":
            logger.warning("Groq API key not configured. Skipping AI review for file.")
            return []
            
        full_path = os.path.join(repo_dir, file_path)
        if not os.path.exists(full_path):
            return []
            
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Failed to read file {file_path} for AI review: {e}")
            return []
            
        prompt = USER_PROMPT_TEMPLATE.format(
            file_path=file_path,
            file_content=content
        )
        
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                
                resp_text = data["choices"][0]["message"]["content"].strip()
                # Sanitize response
                if resp_text.startswith("```"):
                    resp_text = resp_text.split("```")[1]
                    if resp_text.startswith("json"):
                        resp_text = resp_text[4:]
                resp_text = resp_text.strip("` \n\r")
                
                result = json.loads(resp_text)
                findings = result.get("findings", [])
                
                # Enrich findings with file path and default rule info
                enriched_findings = []
                for f in findings:
                    severity = f.get("severity", "high")
                    if severity not in ("critical", "high", "medium", "low"):
                        severity = "high"
                        
                    enriched_findings.append({
                        "semgrep_rule_id": "ai-review-logic-flaw",
                        "severity": severity,
                        "file_path": file_path,
                        "line_start": int(f.get("line_start", 1)),
                        "line_end": int(f.get("line_end", 1)),
                        "code_snippet": f.get("code_snippet", ""),
                        "plain_english_title": f.get("plain_english_title", "Logic flaw identified"),
                        "plain_english_body": f.get("plain_english_body", "A potential business logic vulnerability was discovered during AI review."),
                        "impact_bullets": f.get("impact_bullets", ["Potential unauthorized access or actions", "Risk of data exposure", "Impacts application security integrity"]),
                        "ai_fix_code": f.get("ai_fix_code", ""),
                        "confidence": int(f.get("confidence", 80)),
                        "what_changed": f.get("what_changed", "Applied security hardening recommendations."),
                        "source": "ai_review"
                    })
                return enriched_findings
        except Exception as e:
            logger.error(f"Groq review failed for file {file_path}: {e}")
            return []


async def run_ai_review(repo_dir: str, limit: int = 20) -> list[dict]:
    """
    Scans the repository folder and performs AI review on up to `limit` files in parallel.
    """
    important_files = get_important_files(repo_dir, limit=limit)
    if not important_files:
        logger.info("No files selected for AI review.")
        return []
        
    logger.info(f"Starting AI review on {len(important_files)} files: {important_files}")
    
    semaphore = asyncio.Semaphore(3)
    tasks = [review_file(fp, repo_dir, semaphore) for fp in important_files]
    results = await asyncio.gather(*tasks)
    
    flat_findings = []
    for res in results:
        flat_findings.extend(res)
        
    logger.info(f"AI review complete. Found {len(flat_findings)} findings.")
    return flat_findings
