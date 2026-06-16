import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def inspect():
    db = get_supabase()
    res = db.table("issues").select("*").execute()
    print("Issues in database:")
    for issue in res.data:
        print(f"ID: {issue['id']}, Rule: {issue['semgrep_rule_id']}, Title: {issue['plain_english_title']}, Status: {issue['status']}")

if __name__ == "__main__":
    inspect()
