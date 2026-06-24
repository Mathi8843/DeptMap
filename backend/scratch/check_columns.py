import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def check():
    db = get_supabase()
    res = db.table("issues").select("*").limit(1).execute()
    if res.data:
        print("Columns in 'issues' table:", list(res.data[0].keys()))
    else:
        print("No issues found to check columns.")

if __name__ == "__main__":
    check()
