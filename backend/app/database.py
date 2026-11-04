"""SQLite persistence engine for users, sellers, lots, and dashboard metrics.
Zero external dependencies, fast, ACID-compliant, with WAL mode for concurrency.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("DATABASE_PATH", str(BASE_DIR / "grain_vision.db")))
TRANSACTION_DB_PATH = Path(os.getenv("TRANSACTION_DATABASE_PATH", str(BASE_DIR / "data" / "grain_vision.db")))


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    # PBKDF2-HMAC-SHA256 with 100,000 iterations (standard library)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return key.hex(), salt


def verify_password(password: str, hashed_key: str, salt: str) -> bool:
    new_key, _ = hash_password(password, salt)
    return secrets.compare_digest(new_key, hashed_key)


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'procurement_officer',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS google_accounts (
            google_sub TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            email TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sellers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            seller_code TEXT,
            location TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lot_id TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
            seller_name TEXT,
            image_filename TEXT,
            total_grains INTEGER NOT NULL DEFAULT 0,
            quality_score REAL,
            metrics_json TEXT,
            weight_kg REAL NOT NULL DEFAULT 0.0,
            weight_quintals REAL NOT NULL DEFAULT 0.0,
            base_price_per_quintal REAL,
            estimated_rate_per_kg REAL,
            total_estimated_price REAL,
            status TEXT NOT NULL DEFAULT 'assessed', -- 'assessed', 'accepted', 'rejected'
            rejection_reason TEXT,
            decision_notes TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_lots_user_id ON lots(user_id);
        CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
        CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        """)


        # Ensure a default demo user exists for immediate field evaluation
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = 'officer'")
        if not cursor.fetchone():
            hashed, salt = hash_password("grainvision2026")
            now = datetime.utcnow().isoformat()
            cursor.execute(
                "INSERT INTO users (username, password_hash, salt, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("officer", hashed, salt, "Procurement Officer", "procurement_officer", now),
            )
            default_user_id = cursor.lastrowid
            # Seed a sample seller
            cursor.execute(
                "INSERT INTO sellers (user_id, name, phone, seller_code, location, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (default_user_id, "Ramesh Naidu", "9848022338", "AP-EG-0104", "East Godavari, AP", now),
            )
            conn.commit()

    TRANSACTION_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(TRANSACTION_DB_PATH)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS lot_transactions (
            id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, timestamp TEXT NOT NULL,
            farmer_id TEXT, farmer_name TEXT NOT NULL DEFAULT '', grain_type TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('BUY','BUY_WITH_CUT','REJECT')),
            grade TEXT NOT NULL, net_weight_kg REAL NOT NULL,
            base_rate_per_quintal REAL NOT NULL, effective_rate_per_kg REAL NOT NULL,
            total_payout REAL NOT NULL, total_deduction_per_kg REAL NOT NULL,
            mass_percentages_json TEXT NOT NULL, deductions_json TEXT NOT NULL,
            rejection_reasons_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_lot_transactions_farmer ON lot_transactions(farmer_id);
        CREATE INDEX IF NOT EXISTS idx_lot_transactions_user_time ON lot_transactions(user_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_lot_transactions_status ON lot_transactions(status);
        """)


# --- User & Auth Operations ---

def create_user(username: str, password: str, full_name: str, role: str = "procurement_officer") -> dict[str, Any]:
    username = username.strip().lower()
    if not username or len(username) < 3:
        raise ValueError("Username must be at least 3 characters.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")
    hashed, salt = hash_password(password)
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (username, password_hash, salt, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (username, hashed, salt, full_name.strip() or username, role, now),
            )
            conn.commit()
            user_id = cursor.lastrowid
            return {"id": user_id, "username": username, "full_name": full_name, "role": role}
        except sqlite3.IntegrityError:
            raise ValueError(f"Username '{username}' is already registered.")


def authenticate_user(username: str, password: str) -> Optional[dict[str, Any]]:
    username = username.strip().lower()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, password_hash, salt, full_name, role FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if not row:
            return None
        if verify_password(password, row["password_hash"], row["salt"]):
            return {"id": row["id"], "username": row["username"], "full_name": row["full_name"], "role": row["role"]}
    return None


def get_or_create_google_user(google_sub: str, email: str, full_name: str) -> dict[str, Any]:
    """Resolve a verified Google subject to a least-privilege local operator account."""
    google_sub = google_sub.strip()
    email = email.strip().lower()
    full_name = full_name.strip() or email
    if not google_sub or not email:
        raise ValueError("Verified Google subject and email are required.")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.username, u.full_name, u.role, g.email
            FROM google_accounts g JOIN users u ON u.id = g.user_id
            WHERE g.google_sub = ?
        """, (google_sub,))
        row = cursor.fetchone()
        if row:
            return {"id": row["id"], "username": row["username"], "full_name": row["full_name"], "role": row["role"], "email": row["email"]}

        # Do not silently link an unrelated local account by email. Google subject is
        # the stable identity key; the generated username is not exposed as identity.
        cursor.execute("SELECT google_sub FROM google_accounts WHERE email = ?", (email,))
        if cursor.fetchone():
            raise ValueError("This email is already linked to another Google account.")

        username = "google_" + hashlib.sha256(google_sub.encode("utf-8")).hexdigest()[:24]
        password_hash, salt = hash_password(secrets.token_urlsafe(48))
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "INSERT INTO users (username, password_hash, salt, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (username, password_hash, salt, full_name, "procurement_officer", now),
        )
        user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO google_accounts (google_sub, user_id, email, created_at) VALUES (?, ?, ?, ?)",
            (google_sub, user_id, email, now),
        )
        conn.commit()
        return {"id": user_id, "username": username, "full_name": full_name, "role": "procurement_officer", "email": email}


def create_session(user_id: int, days_valid: int = 30) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    expires_at = (now + timedelta(days=days_valid)).isoformat()
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now.isoformat(), expires_at),
        )
        conn.commit()
    return token


def get_user_from_token(token: str) -> Optional[dict[str, Any]]:
    if not token:
        return None
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.username, u.full_name, u.role
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
        """, (token, now))
        row = cursor.fetchone()
        if row:
            return {"id": row["id"], "username": row["username"], "full_name": row["full_name"], "role": row["role"]}
    return None


def delete_session(token: str) -> None:
    with get_db_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


# --- Seller Operations ---

def list_sellers(user_id: int) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, phone, seller_code, location, created_at
            FROM sellers
            WHERE user_id = ?
            ORDER BY name ASC
        """, (user_id,))
        return [dict(row) for row in cursor.fetchall()]


def create_seller(user_id: int, name: str, phone: str, seller_code: str = "", location: str = "") -> dict[str, Any]:
    name = name.strip()
    phone = phone.strip()
    if not name or not phone:
        raise ValueError("Seller name and phone number are required.")
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sellers (user_id, name, phone, seller_code, location, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, name, phone, seller_code.strip() or None, location.strip() or None, now))
        conn.commit()
        return {
            "id": cursor.lastrowid,
            "user_id": user_id,
            "name": name,
            "phone": phone,
            "seller_code": seller_code.strip() or None,
            "location": location.strip() or None,
            "created_at": now,
        }


def get_seller_by_id(seller_id: int, user_id: int) -> Optional[dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sellers WHERE id = ? AND user_id = ?", (seller_id, user_id))
        row = cursor.fetchone()
        return dict(row) if row else None


# --- Lot Operations ---

def generate_lot_id() -> str:
    today_str = datetime.utcnow().strftime("%Y%m%d")
    random_suffix = secrets.token_hex(2).upper()
    return f"LOT-{today_str}-{random_suffix}"


def create_lot_record(
    user_id: int,
    seller_id: Optional[int],
    seller_name: Optional[str],
    image_filename: Optional[str],
    total_grains: int,
    quality_score: Optional[float],
    metrics: dict[str, Any],
    weight_kg: float,
    base_price_per_quintal: Optional[float],
    estimated_rate_per_kg: Optional[float],
    total_estimated_price: Optional[float],
) -> dict[str, Any]:
    lot_id = generate_lot_id()
    weight_quintals = round(weight_kg / 100.0, 3)
    now = datetime.utcnow().isoformat()
    metrics_json = json.dumps(metrics)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO lots (
                lot_id, user_id, seller_id, seller_name, image_filename,
                total_grains, quality_score, metrics_json, weight_kg, weight_quintals,
                base_price_per_quintal, estimated_rate_per_kg, total_estimated_price,
                status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assessed', ?)
        """, (
            lot_id, user_id, seller_id, seller_name, image_filename,
            total_grains, quality_score, metrics_json, weight_kg, weight_quintals,
            base_price_per_quintal, estimated_rate_per_kg, total_estimated_price,
            now
        ))
        conn.commit()
        record_id = cursor.lastrowid
        return {
            "id": record_id,
            "lot_id": lot_id,
            "user_id": user_id,
            "seller_id": seller_id,
            "seller_name": seller_name,
            "total_grains": total_grains,
            "quality_score": quality_score,
            "weight_kg": weight_kg,
            "weight_quintals": weight_quintals,
            "base_price_per_quintal": base_price_per_quintal,
            "estimated_rate_per_kg": estimated_rate_per_kg,
            "total_estimated_price": total_estimated_price,
            "status": "assessed",
            "created_at": now,
        }


def update_lot_decision(
    lot_id: str,
    user_id: int,
    decision: str,
    rejection_reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    decision = decision.strip().lower()
    if decision not in ("accepted", "rejected"):
        raise ValueError("Decision must be 'accepted' or 'rejected'.")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE lots
            SET status = ?, rejection_reason = ?, decision_notes = ?
            WHERE lot_id = ? AND user_id = ?
        """, (decision, rejection_reason if decision == "rejected" else None, notes, lot_id, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return None

        cursor.execute("SELECT * FROM lots WHERE lot_id = ? AND user_id = ?", (lot_id, user_id))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_user_lots(user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, lot_id, seller_id, seller_name, total_grains, quality_score,
                   weight_kg, weight_quintals, estimated_rate_per_kg, total_estimated_price,
                   status, rejection_reason, decision_notes, created_at
            FROM lots
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
        """, (user_id, limit))
        return [dict(row) for row in cursor.fetchall()]


def get_dashboard_summary(user_id: int) -> dict[str, Any]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total_lots,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_lots,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_lots,
                SUM(CASE WHEN status = 'assessed' THEN 1 ELSE 0 END) as pending_lots,
                SUM(CASE WHEN status = 'accepted' THEN COALESCE(total_estimated_price, 0) ELSE 0 END) as total_procurement_value,
                SUM(CASE WHEN status = 'accepted' THEN COALESCE(weight_kg, 0) ELSE 0 END) as total_procured_weight_kg
            FROM lots
            WHERE user_id = ?
        """, (user_id,))
        stats = dict(cursor.fetchone())

        cursor.execute("""
            SELECT id, lot_id, seller_name, quality_score, weight_kg, total_estimated_price, status, created_at
            FROM lots
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 5
        """, (user_id,))
        recent = [dict(row) for row in cursor.fetchall()]

        return {
            "total_lots": stats["total_lots"] or 0,
            "accepted_lots": stats["accepted_lots"] or 0,
            "rejected_lots": stats["rejected_lots"] or 0,
            "pending_lots": stats["pending_lots"] or 0,
            "total_procurement_value": round(stats["total_procurement_value"] or 0.0, 2),
            "total_procured_weight_kg": round(stats["total_procured_weight_kg"] or 0.0, 2),
            "recent_activity": recent,
        }


def save_lot_transaction(user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    from uuid import uuid4
    valuation = payload["fci_valuation"]
    status = valuation.get("status")
    if status not in ("BUY", "BUY_WITH_CUT", "REJECT"):
        raise ValueError("fci_valuation.status must be BUY, BUY_WITH_CUT, or REJECT.")
    timestamp, record_id = datetime.utcnow().isoformat(timespec="seconds") + "Z", str(uuid4())
    record = {
        "id": record_id, "timestamp": timestamp, "farmer_id": payload.get("farmer_id"),
        "farmer_name": payload.get("farmer_name") or "", "grain_type": payload.get("grain_type") or "Swarna Paddy",
        "status": status, "grade": valuation.get("grade") or "Ungraded",
        "net_weight_kg": float(payload.get("net_weight_kg", valuation.get("total_lot_weight_kg", 0))),
        "base_rate_per_quintal": float(valuation.get("base_rate_per_quintal", 0)),
        "effective_rate_per_kg": float(valuation.get("effective_rate_per_kg", 0)),
        "total_payout": float(valuation.get("estimated_total_payout", 0)),
        "total_deduction_per_kg": float(valuation.get("total_deduction_per_kg", 0)),
        "mass_percentages": valuation.get("mass_percentages") or {},
        "deductions": valuation.get("deductions") or [], "rejection_reasons": valuation.get("rejection_reasons") or [],
    }
    with sqlite3.connect(str(TRANSACTION_DB_PATH)) as conn:
        conn.execute("INSERT INTO lot_transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            record_id, user_id, timestamp, record["farmer_id"], record["farmer_name"], record["grain_type"], status,
            record["grade"], record["net_weight_kg"], record["base_rate_per_quintal"], record["effective_rate_per_kg"],
            record["total_payout"], record["total_deduction_per_kg"], json.dumps(record["mass_percentages"]),
            json.dumps(record["deductions"]), json.dumps(record["rejection_reasons"]),
        ))
    return record


def list_lot_transactions(user_id: int, limit: int = 50, offset: int = 0, farmer_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
    clauses, values = ["user_id = ?"], [user_id]
    if farmer_id:
        clauses.append("farmer_id = ?"); values.append(farmer_id)
    if status:
        clauses.append("status = ?"); values.append(status)
    values.extend([limit, offset])
    with sqlite3.connect(str(TRANSACTION_DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(f"SELECT * FROM lot_transactions WHERE {' AND '.join(clauses)} ORDER BY timestamp DESC LIMIT ? OFFSET ?", values).fetchall()
    return [{**dict(row), "mass_percentages": json.loads(row["mass_percentages_json"]), "deductions": json.loads(row["deductions_json"]), "rejection_reasons": json.loads(row["rejection_reasons_json"])} for row in rows]


def get_lot_transaction_summary(user_id: int) -> dict[str, Any]:
    with sqlite3.connect(str(TRANSACTION_DB_PATH)) as conn:
        row = conn.execute("""SELECT COUNT(*), SUM(CASE WHEN status IN ('BUY','BUY_WITH_CUT') THEN 1 ELSE 0 END),
            SUM(CASE WHEN status='REJECT' THEN 1 ELSE 0 END), SUM(total_payout), SUM(net_weight_kg)/100.0
            FROM lot_transactions WHERE user_id=?""", (user_id,)).fetchone()
    return {"total_lots_assessed": row[0] or 0, "total_lots_accepted": row[1] or 0,
            "total_lots_rejected": row[2] or 0, "total_procurement_value": round(row[3] or 0, 2),
            "total_procured_weight_quintals": round(row[4] or 0, 3)}
