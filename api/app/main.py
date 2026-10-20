from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Float, ForeignKey, Index, Integer, String, create_engine, delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL")
if os.getenv("VERCEL") and not DATABASE_URL:
    DB_PATH = Path(os.getenv("EXPENSES_DB", "/tmp/expenses.db"))
else:
    DB_PATH = Path(os.getenv("EXPENSES_DB", Path(__file__).resolve().parents[1] / "expenses.db"))

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"prepare_threshold": None})
else:
    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
SessionFactory = sessionmaker(bind=engine, expire_on_commit=False)
TOKEN_TTL = timedelta(days=30)
bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="Expense Tracker", version="1.0.0")
cors_env = os.getenv("CORS_ALLOWED_ORIGINS")
if cors_env:
    allowed_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
    allow_origin_regex = None
else:
    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    allow_origin_regex = r"^https://.*\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("users_username_lower_unique", text("lower(username)"), unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class AuthSession(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (Index("expenses_user_date", "user_id", "spent_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    spent_at: Mapped[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


@contextmanager
def connect_db():
    connection: Session = SessionFactory()
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_db():
    if not DATABASE_URL:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)


def utc_now():
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split("$", maxsplit=1)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def issue_session(connection: Session, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = (utc_now() + TOKEN_TTL).isoformat()
    connection.add(AuthSession(token_hash=token_hash, user_id=user_id, expires_at=expires_at))
    return token


def user_payload(user: User):
    return {"id": user.id, "username": user.username}


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str):
        value = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", value):
            raise ValueError("Use letters, numbers, dots, dashes, or underscores")
        return value


class ExpenseInput(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0, le=1_000_000_000)
    category: str = Field(min_length=1, max_length=40)
    spent_at: date
    notes: str = Field(default="", max_length=500)

    @field_validator("title", "category", "notes", mode="before")
    @classmethod
    def trim_text(cls, value: str):
        return value.strip()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue")
    token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    with connect_db() as connection:
        user = connection.scalar(
            select(User)
            .join(AuthSession, AuthSession.user_id == User.id)
            .where(AuthSession.token_hash == token_hash, AuthSession.expires_at > utc_now().isoformat())
        )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Sign in again.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@app.on_event("startup")
def startup():
    initialize_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: Credentials):
    try:
        with connect_db() as connection:
            user = User(
                username=payload.username,
                password_hash=hash_password(payload.password),
                created_at=utc_now().isoformat(),
            )
            connection.add(user)
            connection.flush()
            token = issue_session(connection, user.id)
            connection.commit()
    except IntegrityError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is already taken") from error
    return {"access_token": token, "token_type": "bearer", "user": user_payload(user)}


@app.post("/api/auth/login")
def login(payload: Credentials):
    with connect_db() as connection:
        user = connection.scalar(select(User).where(func.lower(User.username) == payload.username.lower()))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Username or password is incorrect")
        token = issue_session(connection, user.id)
        connection.commit()
    return {"access_token": token, "token_type": "bearer", "user": user_payload(user)}


@app.get("/api/auth/me")
def current_user(user: CurrentUser):
    return user_payload(user)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser):
    with connect_db() as connection:
        connection.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
        connection.commit()


def expense_payload(row: Expense):
    return {
        "id": row.id,
        "title": row.title,
        "amount": row.amount,
        "category": row.category,
        "spent_at": row.spent_at,
        "notes": row.notes,
    }


@app.get("/api/expenses")
def list_expenses(user: CurrentUser):
    with connect_db() as connection:
        rows = connection.scalars(
            select(Expense)
            .where(Expense.user_id == user.id)
            .order_by(Expense.spent_at.desc(), Expense.id.desc())
        ).all()
    return [expense_payload(row) for row in rows]


@app.post("/api/expenses", status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseInput, user: CurrentUser):
    with connect_db() as connection:
        row = Expense(
            user_id=user.id,
            title=payload.title,
            amount=payload.amount,
            category=payload.category,
            spent_at=payload.spent_at.isoformat(),
            notes=payload.notes,
            created_at=utc_now().isoformat(),
        )
        connection.add(row)
        connection.commit()
        connection.refresh(row)
    return expense_payload(row)


@app.put("/api/expenses/{expense_id}")
def update_expense(expense_id: int, payload: ExpenseInput, user: CurrentUser):
    with connect_db() as connection:
        row = connection.scalar(
            select(Expense).where(Expense.id == expense_id, Expense.user_id == user.id)
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
        row.title = payload.title
        row.amount = payload.amount
        row.category = payload.category
        row.spent_at = payload.spent_at.isoformat()
        row.notes = payload.notes
        connection.commit()
    return expense_payload(row)




@app.delete("/api/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, user: CurrentUser):
    with connect_db() as connection:
        result = connection.execute(
            delete(Expense).where(Expense.id == expense_id, Expense.user_id == user.id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
        connection.commit()


initialize_db()

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
if not STATIC_DIR.exists():
    STATIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if STATIC_DIR.exists():
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        target = STATIC_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(STATIC_DIR / "index.html")