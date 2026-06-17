import sys
import os
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import Request

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.routers.auth import github_callback

class TestGithubCallback(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.request = MagicMock(spec=Request)
        self.request.headers = {"accept": "application/json"}
        
        # Mock DB client
        self.db = MagicMock()
        self.table_mock = MagicMock()
        self.db.table.return_value = self.table_mock
        
    @patch("app.routers.auth.github_service.exchange_code_for_token")
    @patch("app.routers.auth.github_service.get_github_user")
    @patch("app.routers.auth.verify_oauth_state")
    @patch("app.routers.auth.encrypt_token")
    @patch("app.routers.auth.create_session_token")
    async def test_callback_existing_github_user_normal_login(
        self, mock_create_session, mock_encrypt, mock_verify_state, mock_get_user, mock_exchange
    ):
        """Test that normal login with a known github_id succeeds and updates the existing user."""
        mock_exchange.return_value = {"access_token": "gh_token"}
        mock_get_user.return_value = {
            "id": 144879284,
            "email": "test@example.com",
            "name": "Test User",
            "avatar_url": "http://avatar"
        }
        # No linked_user_id (normal login)
        mock_verify_state.return_value = None
        mock_encrypt.return_value = "encrypted_gh_token"
        mock_create_session.return_value = "session_jwt"
        
        # Mock DB query for existing github_id returning a match
        select_mock = MagicMock()
        eq_mock = MagicMock()
        execute_mock = MagicMock()
        
        self.table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = execute_mock
        
        # Simulate returning a user when querying by github_id
        # Let's say user exists with id="existing-uuid" and github_id="144879284"
        execute_mock.data = [{"id": "existing-uuid", "email": "test@example.com", "plan": "free"}]
        
        # Mock update execution
        update_mock = MagicMock()
        self.table_mock.update.return_value = update_mock
        update_eq_mock = MagicMock()
        update_mock.eq.return_value = update_eq_mock
        update_eq_mock.execute.return_value = MagicMock(data=[])

        response = await github_callback(
            request=self.request,
            code="test_code",
            state="test_state",
            db=self.db
        )
        
        # Assertions
        # Verify that we searched by github_id first
        self.db.table.assert_any_call("users")
        self.table_mock.select.assert_any_call("*")
        select_mock.eq.assert_any_call("github_id", "144879284")
        
        # Verify update was called on the correct user
        self.table_mock.update.assert_called_with({
            "github_id": "144879284",
            "github_access_token": "encrypted_gh_token",
            "name": "Test User",
            "avatar_url": "http://avatar",
        })
        update_mock.eq.assert_called_with("id", "existing-uuid")
        
        self.assertEqual(response["user_id"], "existing-uuid")
        self.assertEqual(response["session_token"], "session_jwt")

    @patch("app.routers.auth.github_service.exchange_code_for_token")
    @patch("app.routers.auth.github_service.get_github_user")
    @patch("app.routers.auth.verify_oauth_state")
    @patch("app.routers.auth.encrypt_token")
    @patch("app.routers.auth.create_session_token")
    async def test_callback_conflict_different_user(
        self, mock_create_session, mock_encrypt, mock_verify_state, mock_get_user, mock_exchange
    ):
        """Test that linking raises ValueError when github_id is already linked to a different user."""
        mock_exchange.return_value = {"access_token": "gh_token"}
        mock_get_user.return_value = {
            "id": 144879284,
            "email": "test@example.com",
            "name": "Test User"
        }
        # Explicit linked_user_id = "user-a-uuid" (trying to link)
        mock_verify_state.return_value = "user-a-uuid"
        
        # Mock DB queries
        # First query: select * from users where github_id = "144879284"
        # Second query: select * from users where id = "user-a-uuid" (in case it progresses, but it shouldn't)
        select_mock = MagicMock()
        eq_mock = MagicMock()
        execute_mock = MagicMock()
        
        self.table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = execute_mock
        
        # Simulating that github_id is already owned by User B ("user-b-uuid")
        execute_mock.data = [{"id": "user-b-uuid", "email": "other@example.com", "github_id": "144879284"}]

        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as context:
            await github_callback(
                request=self.request,
                code="test_code",
                state="test_state",
                db=self.db
            )
            
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("already linked to another user", str(context.exception.detail))

    @patch("app.routers.auth.github_service.exchange_code_for_token")
    @patch("app.routers.auth.github_service.get_github_user")
    @patch("app.routers.auth.verify_oauth_state")
    @patch("app.routers.auth.encrypt_token")
    @patch("app.routers.auth.create_session_token")
    async def test_callback_mock_user_id_ignored(
        self, mock_create_session, mock_encrypt, mock_verify_state, mock_get_user, mock_exchange
    ):
        """Test that the default mock user ID is ignored and normal login/creation takes place instead of incorrect linking."""
        mock_exchange.return_value = {"access_token": "gh_token"}
        mock_get_user.return_value = {
            "id": 144879284,
            "email": "new-user@example.com",
            "name": "New User"
        }
        # State contains default mock user ID
        mock_verify_state.return_value = "00000000-0000-0000-0000-000000000000"
        mock_encrypt.return_value = "encrypted_gh_token"
        mock_create_session.return_value = "session_jwt"
        
        # DB queries: github_id check -> email check -> insert
        select_mock = MagicMock()
        eq_mock = MagicMock()
        execute_mock = MagicMock()
        
        self.table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = execute_mock
        
        # Simulate that github_id and email are not registered yet
        execute_mock.data = []
        
        # Mock insert
        insert_mock = MagicMock()
        self.table_mock.insert.return_value = insert_mock
        insert_mock.execute.return_value = MagicMock(data=[{"id": "new-uuid"}])

        response = await github_callback(
            request=self.request,
            code="test_code",
            state="test_state",
            db=self.db
        )
        
        # Assert that it inserted a new user rather than trying to link/update
        self.table_mock.insert.assert_called_with({
            "github_id": "144879284",
            "email": "new-user@example.com",
            "name": "New User",
            "avatar_url": None,
            "github_access_token": "encrypted_gh_token",
            "plan": "free"
        })
        self.assertEqual(response["user_id"], "new-uuid")

if __name__ == "__main__":
    unittest.main()
