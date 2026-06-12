"""
GitHub API service.
Handles: OAuth exchange, repo metadata fetch, file content access, PR creation.
Uses PyGithub library wrapping the GitHub REST API.
"""
import httpx
from github import Github, Auth, GithubException
from github.Repository import Repository as GHRepo
from app.config import get_settings

settings = get_settings()


async def exchange_code_for_token(code: str) -> dict:
    """
    Exchange GitHub OAuth code for an access token.
    Called after user authorizes on GitHub and is redirected back.
    Returns: { access_token, token_type, scope }
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
        )
        data = response.json()
        if "error" in data:
            raise ValueError(f"GitHub OAuth error: {data.get('error_description', data['error'])}")
        return data


async def get_github_user(access_token: str) -> dict:
    """
    Fetch authenticated GitHub user info using their access token.
    Returns: { id, login, email, name, avatar_url }
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        response.raise_for_status()
        return response.json()


def get_github_client(access_token: str) -> Github:
    """Create an authenticated PyGithub client for a user."""
    return Github(auth=Auth.Token(access_token))


def get_repo(access_token: str, full_name: str) -> GHRepo:
    """
    Get a GitHub repository object by full_name (owner/repo).
    Raises GithubException if not found or no access.
    """
    gh = get_github_client(access_token)
    return gh.get_repo(full_name)


def get_repo_metadata(access_token: str, full_name: str) -> dict:
    """
    Fetch core metadata about a repo needed for our DB.
    Returns dict matching our repos table schema.
    """
    repo = get_repo(access_token, full_name)
    return {
        "github_repo_id": repo.id,
        "full_name": repo.full_name,
        "language": repo.language or "Unknown",
        "default_branch": repo.default_branch,
        "is_private": repo.private,
        "clone_url": repo.clone_url,
        "size_kb": repo.size,
    }


def get_file_content(access_token: str, full_name: str, file_path: str, ref: str = "main") -> str:
    """
    Read a specific file from a GitHub repo.
    Used when creating a PR fix — we need the original file content.
    """
    repo = get_repo(access_token, full_name)
    try:
        content_file = repo.get_contents(file_path, ref=ref)
        if isinstance(content_file, list):
            raise ValueError(f"{file_path} is a directory, not a file")
        return content_file.decoded_content.decode("utf-8")
    except GithubException as e:
        raise ValueError(f"Cannot read {file_path}: {e.data.get('message', str(e))}")


def create_fix_pull_request(
    access_token: str,
    full_name: str,
    file_path: str,
    original_content: str,
    fixed_content: str,
    issue_title: str,
    issue_id: str,
    base_branch: str = "main",
) -> dict:
    """
    Create a GitHub PR with the AI-generated fix applied.
    
    Steps:
    1. Create new branch: debtmap/fix-{issue_id}
    2. Get current file SHA
    3. Update file with fixed content
    4. Open Pull Request from new branch → base branch
    
    Returns: { pr_number, pr_url, branch_name }
    """
    repo = get_repo(access_token, full_name)
    branch_name = f"debtmap/fix-{issue_id[:8]}"

    # Step 1: Get base branch SHA to branch from
    base_ref = repo.get_git_ref(f"heads/{base_branch}")
    base_sha = base_ref.object.sha

    # Step 2: Create new branch
    try:
        repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=base_sha)
    except GithubException as e:
        if e.status == 422:  # Branch already exists
            pass
        else:
            raise

    # Step 3: Get current file to obtain its SHA (required for update)
    try:
        current_file = repo.get_contents(file_path, ref=branch_name)
        if isinstance(current_file, list):
            raise ValueError("Path is a directory")
        file_sha = current_file.sha
    except GithubException:
        # File might not exist on new branch yet — get from base
        base_file = repo.get_contents(file_path, ref=base_branch)
        if isinstance(base_file, list):
            raise ValueError("Path is a directory")
        file_sha = base_file.sha

    # Step 4: Commit the fix
    commit_message = f"security-fix: {issue_title}\n\nAuto-generated fix by DebtMap AI. Issue ID: {issue_id}"
    repo.update_file(
        path=file_path,
        message=commit_message,
        content=fixed_content,
        sha=file_sha,
        branch=branch_name,
    )

    # Step 5: Create Pull Request
    pr = repo.create_pull(
        title=f"[DebtMap] Security Fix: {issue_title}",
        body=(
            f"## 🔒 Security Fix — Auto-generated by DebtMap\n\n"
            f"**Issue:** {issue_title}\n\n"
            f"**File:** `{file_path}`\n\n"
            f"This pull request was automatically created by DebtMap. "
            f"The AI-generated fix has been applied to resolve the detected vulnerability.\n\n"
            f"**Review and merge when ready.** If you have questions about this fix, "
            f"visit your DebtMap dashboard.\n\n"
            f"---\n*Issue ID: `{issue_id}`*"
        ),
        head=branch_name,
        base=base_branch,
    )

    return {
        "pr_number": pr.number,
        "pr_url": pr.html_url,
        "branch_name": branch_name,
    }


def list_user_repos(access_token: str) -> list[dict]:
    """
    List all repos the authenticated user has access to.
    Returns simplified list for frontend repo selection.
    """
    gh = get_github_client(access_token)
    user = gh.get_user()
    repos = []
    for repo in user.get_repos(sort="updated", direction="desc"):
        repos.append({
            "full_name": repo.full_name,
            "language": repo.language or "Unknown",
            "is_private": repo.private,
            "default_branch": repo.default_branch,
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else None,
        })
    return repos[:50]  # Return max 50 most recently updated
