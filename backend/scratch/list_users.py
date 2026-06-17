import sys
import os

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def list_users():
    db = get_supabase()
    
    print("=== Supabase Auth Users ===")
    try:
        auth_users = db.auth.admin.list_users()
        for u in auth_users:
            print(f"ID: {u.id}")
            print(f"  Email: {u.email}")
            print(f"  Confirmed At: {u.confirmed_at}")
            print(f"  Email Confirmed At: {u.email_confirmed_at}")
            print(f"  Metadata: {u.user_metadata}")
            print("-" * 30)
    except Exception as e:
        print(f"Error fetching auth users: {e}")
        
    print("\n=== Public.users Table ===")
    try:
        public_users = db.table("users").select("*").execute()
        for u in public_users.data:
            print(f"ID: {u.get('id')}")
            print(f"  Email: {u.get('email')}")
            print(f"  Name: {u.get('name')}")
            print(f"  Plan: {u.get('plan')}")
            print("-" * 30)
    except Exception as e:
        print(f"Error fetching public users: {e}")

if __name__ == "__main__":
    list_users()
