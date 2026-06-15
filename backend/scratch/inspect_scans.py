import sys
import os

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def inspect_scans():
    print("Connecting to Supabase...")
    db = get_supabase()
    try:
        result = db.table("scans").select("*").limit(1).execute()
        print("Success! Connection OK.")
        if result.data:
            print("Columns in scans table:")
            print(list(result.data[0].keys()))
        else:
            print("scans table is empty. Trying to describe by inserting dummy data or checking schema...")
            # We can select columns using a fake select query
            # or try to insert a dummy record and catch the error to see columns.
            try:
                # Try to select non-existent column to see if it fails
                db.table("scans").select("id, progress").limit(1).execute()
                print("Column 'progress' EXISTS in database scans table!")
            except Exception as e:
                print("Column 'progress' DOES NOT EXIST in database:", e)
    except Exception as e:
        print("Failed to query scans table:", e)

if __name__ == "__main__":
    inspect_scans()
