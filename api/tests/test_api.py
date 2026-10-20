import asyncio
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

os.environ.pop("DATABASE_URL", None)
os.environ["EXPENSES_DB"] = str(Path(tempfile.mkdtemp()) / "test-expenses.db")

import app.main as main
from app.main import app
from app.main import Credentials, ExpenseInput, create_expense, delete_expense, get_current_user, list_expenses, login, register, update_expense
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


class ExpenseApiTest(unittest.TestCase):
    def test_account_and_expense_crud(self):
        registration = register(Credentials(username="test-user", password="correct-horse"))
        with self.assertRaises(HTTPException) as duplicate:
            register(Credentials(username="TEST-USER", password="another-password"))
        self.assertEqual(duplicate.exception.status_code, 409)

        login_result = login(Credentials(username="test-user", password="correct-horse"))
        self.assertEqual(login_result["user"]["username"], "test-user")
        user = get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=registration["access_token"])
        )

        expense_data = ExpenseInput(
            title="Market",
            amount=24.5,
            category="Food & drink",
            spent_at="2026-10-20",
            notes="Weekly shop",
        )
        created = create_expense(expense_data, user)
        self.assertEqual(len(list_expenses(user)), 1)

        updated = update_expense(
            created["id"],
            ExpenseInput(**{**expense_data.model_dump(), "title": "Groceries"}),
            user,
        )
        self.assertEqual(updated["title"], "Groceries")

        delete_expense(created["id"], user)
        self.assertEqual(list_expenses(user), [])

    def test_admin_login_lists_only_public_user_fields_and_exports_csv(self):
        with main.connect_db() as connection:
            existing_user_count = connection.query(main.User).count()
        register(Credentials(username="visible-user", password="user-password"))
        admin_password_hash = main.hash_password("admin-password")

        with patch.object(main, "ADMIN_USERNAME", "site-admin"), patch.object(
            main, "ADMIN_PASSWORD_HASH", admin_password_hash
        ):
            with self.assertRaises(HTTPException) as unauthorized:
                main.admin_login(Credentials(username="site-admin", password="wrong-password"))
            self.assertEqual(unauthorized.exception.status_code, 401)

            login_result = main.admin_login(Credentials(username="site-admin", password="admin-password"))
            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer",
                credentials=login_result["access_token"],
            )
            admin = main.get_current_admin(credentials)

            self.assertEqual(main.admin_current(admin), {"username": "site-admin"})
            self.assertEqual(main.admin_overview(admin)["total_users"], existing_user_count + 1)

            users = main.admin_users(admin)
            visible_user = next(user for user in users if user["username"] == "visible-user")
            self.assertNotIn("password_hash", visible_user)
            self.assertNotIn("id", visible_user)

            csv_response = main.admin_users_csv(admin)
            async def read_csv():
                return "".join([chunk async for chunk in csv_response.body_iterator])

            csv_body = asyncio.run(read_csv())
            self.assertTrue(csv_response.media_type.startswith("text/csv"))
            self.assertIn("username,created_at", csv_body)
            self.assertIn("visible-user", csv_body)
            self.assertNotIn("user-password", csv_body)
            self.assertNotIn(admin_password_hash, csv_body)

            main.admin_logout(credentials, admin)
            with self.assertRaises(HTTPException) as expired:
                main.get_current_admin(credentials)
            self.assertEqual(expired.exception.status_code, 401)

    def test_admin_endpoints_require_admin_session(self):
        with self.assertRaises(HTTPException) as unauthorized:
            main.get_current_admin(None)
        self.assertEqual(unauthorized.exception.status_code, 401)

    def test_admin_login_requires_server_configuration(self):
        with patch.object(main, "ADMIN_USERNAME", ""), patch.object(main, "ADMIN_PASSWORD_HASH", ""):
            with self.assertRaises(HTTPException) as unavailable:
                main.admin_login(Credentials(username="site-admin", password="admin-password"))
        self.assertEqual(unavailable.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()