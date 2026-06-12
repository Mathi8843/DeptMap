from app.config import get_settings
s = get_settings()
print("Config loads OK")
print(f"Supabase URL: {s.supabase_url}")
print(f"GitHub Client ID: {s.github_client_id[:8]}...")
print(f"Claude API key placeholder: {s.anthropic_api_key == 'sk-ant-your-key-here'}")
print(f"Anthropic key starts with sk-ant: {s.anthropic_api_key.startswith('sk-ant')}")
