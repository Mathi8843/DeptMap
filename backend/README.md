# DebtMap Backend

FastAPI backend for DebtMap — AI code security scanner for vibe-coded apps.

## Stack
- **FastAPI** — async Python API server
- **Semgrep** — SAST static analysis engine (3,000+ OWASP rules)
- **Claude API** — plain English explanations + AI fix generation
- **npm/PyPI Registry APIs** — slopsquatting/hallucinated package detection
- **GitHub API (PyGithub)** — repo cloning, PR creation, OAuth
- **Supabase** — PostgreSQL database + Auth + Row-Level Security

## Setup

### 1. Create virtual environment
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

### 4. Run the server
```bash
uvicorn app.main:app --reload --port 8000
```

API available at: http://localhost:8000  
API docs at: http://localhost:8000/docs

## Project Structure
```
backend/
├── app/
│   ├── main.py          # FastAPI app entry point + CORS
│   ├── config.py        # Settings from .env
│   ├── database.py      # Supabase client singleton
│   ├── routers/
│   │   ├── auth.py      # GitHub OAuth callback
│   │   ├── repos.py     # Connect/list repositories
│   │   ├── scans.py     # Trigger scans
│   │   ├── issues.py    # Issue management + dismiss
│   │   ├── packages.py  # Package safety results
│   │   ├── trend.py     # Health score history
│   │   ├── soc2.py      # SOC 2 control status
│   │   └── webhooks.py  # GitHub push/PR webhook receiver
│   └── services/
│       ├── github.py    # GitHub API client
│       ├── semgrep.py   # Semgrep scanner
│       ├── claude.py    # Claude AI explanation layer
│       ├── registry.py  # npm/PyPI registry checker
│       ├── scorer.py    # Health score algorithm
│       └── pr_creator.py # GitHub PR creation from AI fix
├── requirements.txt
├── .env.example
└── README.md
```
