# Expense Tracker

A small personal expense tracker with a React interface, FastAPI backend, and local SQLite database.

## Run locally

In one terminal, start the API:

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

In another terminal, start the web app:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The SQLite database is created at `api/expenses.db`; set `EXPENSES_DB` to change its location. API documentation is available at `http://127.0.0.1:8000/docs`.

Create an account with a unique username and a password of at least 8 characters. Password confirmation happens in the signup form; passwords are salted and hashed before storage. Expenses are private to the signed-in account and displayed in Indian rupees (INR).

## Administrator view

The separate administrator view is available at `/admin`. It shows registered usernames and signup times, deployment metadata, and a CSV export. It does not expose password hashes, session tokens, or users' expenses.

Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` on the API server to enable administrator sign-in. Generate a salted password hash using the same `hash_password` function as the API; do not store or commit the administrator password in source control. The admin password hash belongs in a root-readable server environment file, not in Amplify's frontend environment variables.

The optional deployment fields `ADMIN_DEPLOYMENT_REGION`, `ADMIN_EC2_INSTANCE_ID`, `ADMIN_EC2_SECURITY_GROUP_ID`, `ADMIN_FRONTEND_URL`, and `ADMIN_API_URL` populate the deployment details shown to administrators. The admin session expires after eight hours.