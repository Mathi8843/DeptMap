import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def check():
    db = get_supabase()
    try:
        res = db.table("issues").select("id, confidence, what_changed").limit(1).execute()
        print("Success! Columns exist. Data:", res.data)
    except Exception as e:
        print("Failed to query columns:", e)

if __name__ == "__main__":
    check()
