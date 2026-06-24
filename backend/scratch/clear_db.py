import sys
import os

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def clear_database():
    print("Connecting to Supabase...")
    db = get_supabase()
    
    # Ordered dependency list to delete child tables before parent tables
    tables = ["health_history", "packages", "attack_surfaces", "issues", "scans", "repos", "users"]
    
    print("\nStarting database cleanup...")
    for table in tables:
        try:
            print(f"  Clearing table '{table}'...")
            # Supabase delete requires a filter to prevent accidental full-table wipes
            result = db.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            print(f"    [OK] Table '{table}' cleared successfully.")
        except Exception as e:
            print(f"    [FAIL] Could not clear table '{table}': {e}")
            
    print("\nDatabase reset complete!")

if __name__ == "__main__":
    print("WARNING: This will delete ALL users, repositories, scans, issues, and history from the database.")
    confirm = input("Do you want to proceed? (y/N): ")
    if confirm.lower() == 'y':
        clear_database()
    else:
        print("Operation canceled.")
