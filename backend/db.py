import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)

_DB_PATH = Path(settings.database_path)


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_tables_exist():
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = _get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS protected_users (
                email TEXT PRIMARY KEY,
                added_by TEXT NOT NULL,
                added_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                operator TEXT NOT NULL,
                target TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT
            );

            CREATE TABLE IF NOT EXISTS verify_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                operator TEXT NOT NULL,
                target TEXT NOT NULL,
                status TEXT NOT NULL,
                devices_challenged INTEGER NOT NULL DEFAULT 0,
                details TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_verify_log_timestamp ON verify_log(timestamp DESC);
        """)
        conn.commit()
        logger.info("Database tables ready at %s", _DB_PATH)
    finally:
        conn.close()


def get_protected_users() -> list[dict]:
    conn = _get_connection()
    try:
        rows = conn.execute("SELECT email, added_by, added_at FROM protected_users").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def is_protected_user(email: str) -> bool:
    conn = _get_connection()
    try:
        row = conn.execute(
            "SELECT 1 FROM protected_users WHERE email = ?", (email.lower(),)
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def add_protected_user(email: str, operator: str) -> bool:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            "INSERT OR IGNORE INTO protected_users (email, added_by, added_at) VALUES (?, ?, ?)",
            (email.lower(), operator, _now_iso()),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return False
    finally:
        conn.close()

    _write_audit_log(operator, email, "ADD_PROTECTED", f"Added {email} to protected list")
    return True


def remove_protected_user(email: str, operator: str) -> bool:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM protected_users WHERE email = ?", (email.lower(),)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return False
    finally:
        conn.close()

    _write_audit_log(operator, email, "REMOVE_PROTECTED", f"Removed {email} from protected list")
    return True


def _write_audit_log(operator: str, target: str, action: str, details: str | None = None):
    conn = _get_connection()
    try:
        conn.execute(
            "INSERT INTO audit_log (timestamp, operator, target, action, details) VALUES (?, ?, ?, ?, ?)",
            (_now_iso(), operator, target, action, details),
        )
        conn.commit()
    finally:
        conn.close()


def write_verification_log(
    operator: str, target: str, status: str, devices_challenged: int, details: str | None = None
):
    conn = _get_connection()
    try:
        conn.execute(
            "INSERT INTO verify_log (timestamp, operator, target, status, devices_challenged, details) VALUES (?, ?, ?, ?, ?, ?)",
            (_now_iso(), operator, target, status, devices_challenged, details),
        )
        conn.commit()
    finally:
        conn.close()


def get_verification_log(limit: int = 20) -> list[dict]:
    conn = _get_connection()
    try:
        rows = conn.execute(
            "SELECT timestamp, operator, target, status, devices_challenged, details FROM verify_log ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_audit_log(limit: int = 50) -> list[dict]:
    conn = _get_connection()
    try:
        rows = conn.execute(
            "SELECT timestamp, operator, target, action, details FROM audit_log ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()
