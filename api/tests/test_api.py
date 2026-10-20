import os
from pathlib import Path
import tempfile
import unittest

os.environ.pop("DATABASE_URL", None)
os.environ["EXPENSES_DB"] = str(Path(tempfile.mkdtemp()) / "test-expenses.db")

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


if __name__ == "__main__":
    unittest.main()