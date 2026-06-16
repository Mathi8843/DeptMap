import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def inspect():
    db = get_supabase()
    res = db.table("scans").select("*").order("triggered_at", desc=True).limit(1).execute()
    if res.data:
        scan = res.data[0]
        print(f"Scan ID: {scan['id']}, Status: {scan['status']}, Progress: {scan['progress']}")
        print("Log messages:")
        for log in scan['log_messages']:
            print(f"  {log}")
    else:
        print("No scans found.")

if __name__ == "__main__":
    inspect()
