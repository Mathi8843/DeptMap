import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def check():
    db = get_supabase()
    try:
        res = db.table("attack_surfaces").select("*").limit(1).execute()
        print("Success! Table 'attack_surfaces' exists. Data:", res.data)
    except Exception as e:
        print("Table 'attack_surfaces' does NOT exist:", e)

if __name__ == "__main__":
    check()
