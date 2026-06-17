"""
Create Admin User helper script
Registers admin@debtmap.io with password 123456789 in Supabase.
"""
import sys
import os

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_supabase

def create_admin():
    db = get_supabase()
    email = "admin@debtmap.io"
    password = "123456789"
    name = "Admin User"
    
    print(f"Signing up user {email}...")
    try:
        # Check if user already exists in auth.users by attempting to sign in or if sign_up fails
        auth_response = db.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "name": name
            }
        })
        
        if not auth_response.user:
            print("Failed to register user account in Supabase Auth.")
            return
            
        user_id = auth_response.user.id
        print(f"Supabase Auth registration successful. User ID: {user_id}")
        
        print("Upserting profile in public.users table...")
        db.table("users").upsert({
            "id": user_id,
            "email": email,
            "name": name,
            "github_access_token": None,
            "plan": "free"
        }).execute()
        print("Public profile upserted successfully.")
        print(f"\nSuccessfully created administrator account!\nEmail: {email}\nPassword: {password}")
        
    except Exception as e:
        print(f"Error creating admin user: {e}")

if __name__ == "__main__":
    create_admin()
