import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def test():
    db = get_supabase()
    # Try calling common rpc names
    rpc_names = ["exec_sql", "execute_sql", "run_sql", "sql"]
    for name in rpc_names:
        try:
            print(f"Testing rpc '{name}'...")
            res = db.rpc(name, {"query": "SELECT 1"}).execute()
            print(f"  [SUCCESS] {name}: {res.data}")
            return
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")

if __name__ == "__main__":
    test()
