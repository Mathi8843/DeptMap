from app.config import get_settings
s = get_settings()
print("Config loads OK")
print(f"Supabase URL: {s.supabase_url}")
print(f"GitHub Client ID: {s.github_client_id[:8]}...")
print(f"Groq API key configured: {bool(s.groq_api_key)}")
print(f"Groq model: {s.groq_model}")
