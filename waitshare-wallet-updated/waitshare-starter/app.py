from flask import Flask, jsonify, request, send_from_directory
from pathlib import Path
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime, timezone
import sqlite3
import uuid

BASE = Path(__file__).parent
DB = BASE / "waitshare.db"
app = Flask(__name__, static_folder="web", static_url_path="")

# DEMO ONLY. This fixed rate is for UI testing, not a live FX quote.
DEMO_USD_INR_RATE = Decimal("85.00")
MINIMUM_WITHDRAWAL_USD = Decimal("10.00")
DEMO_USER = "demo"


def db():
    con = sqlite3.connect(DB, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def init_db():
    with db() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                demo_balance REAL NOT NULL DEFAULT 0
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                event_type TEXT NOT NULL,
                amount REAL NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reference TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                amount_usd TEXT NOT NULL,
                amount_inr TEXT NOT NULL,
                exchange_rate TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        con.execute("INSERT OR IGNORE INTO users(username, demo_balance) VALUES(?, ?)",
                    (DEMO_USER, 12.50))
        # Add an initial visible demo reward history for a fresh database.
        count = con.execute("SELECT COUNT(*) AS n FROM events WHERE username=?", (DEMO_USER,)).fetchone()["n"]
        if count == 0:
            con.execute("INSERT INTO events(username,event_type,amount,created_at) VALUES(?,?,?,?)",
                        (DEMO_USER, "DEMO_STARTING_BALANCE", 12.50, now_iso()))


def require_demo_user(payload=None):
    # The starter has preview-only login, not real authentication.
    # Do not accept arbitrary usernames from the browser.
    username = DEMO_USER
    with db() as con:
        user = con.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not user:
        raise LookupError("Demo user not found")
    return user


@app.get("/")
def home():
    return send_from_directory("web", "index.html")


@app.get("/api/dashboard")
def dashboard():
    user = require_demo_user()
    balance = money(user["demo_balance"])
    with db() as con:
        events = con.execute(
            "SELECT event_type, amount, created_at FROM events WHERE username=? ORDER BY id DESC LIMIT 12",
            (DEMO_USER,)
        ).fetchall()
        withdrawals = con.execute(
            "SELECT reference, amount_usd, amount_inr, exchange_rate, status, created_at "
            "FROM withdrawals WHERE username=? ORDER BY id DESC LIMIT 8",
            (DEMO_USER,)
        ).fetchall()
    return jsonify({
        "username": DEMO_USER,
        "balance_usd": float(balance),
        "estimated_balance_inr": float(money(balance * DEMO_USD_INR_RATE)),
        "demo_exchange_rate": float(DEMO_USD_INR_RATE),
        "minimum_withdrawal_usd": float(MINIMUM_WITHDRAWAL_USD),
        "eligible": balance >= MINIMUM_WITHDRAWAL_USD,
        "is_demo": True,
        "events": [dict(e) for e in events],
        "withdrawals": [dict(w) for w in withdrawals]
    })


@app.post("/api/demo-event")
def demo_event():
    """Add fictional demo credits only. Never use this for payable earnings."""
    payload = request.get_json(silent=True) or {}
    try:
        seconds = int(payload.get("seconds", 10))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid demo duration"}), 400
    seconds = max(5, min(seconds, 60))
    demo_amount = money(Decimal(seconds) * Decimal("0.01"))
    now = now_iso()
    with db() as con:
        con.execute("UPDATE users SET demo_balance=demo_balance+? WHERE username=?",
                    (float(demo_amount), DEMO_USER))
        con.execute("INSERT INTO events(username,event_type,amount,created_at) VALUES(?,?,?,?)",
                    (DEMO_USER, "DEMO_TEST_REWARD", float(demo_amount), now))
    return jsonify({
        "message": f"Demo reward of ${demo_amount:.2f} added. This is fictional and not withdrawable cash.",
        "demo_credit_usd": float(demo_amount)
    })


@app.post("/api/withdrawals")
def create_demo_withdrawal():
    """Record a simulated withdrawal. No bank details or real payment are collected."""
    payload = request.get_json(silent=True) or {}
    try:
        amount = money(payload.get("amount_usd", "0"))
    except (InvalidOperation, TypeError, ValueError):
        return jsonify({"error": "Enter a valid withdrawal amount."}), 400

    if amount < MINIMUM_WITHDRAWAL_USD:
        return jsonify({"error": "Minimum withdrawal is $10.00."}), 400

    reference = "WS-DEMO-" + uuid.uuid4().hex[:12].upper()
    amount_inr = money(amount * DEMO_USD_INR_RATE)
    created_at = now_iso()

    # BEGIN IMMEDIATE serializes SQLite writers so two demo requests cannot
    # spend the same demo balance concurrently.
    con = db()
    try:
        con.execute("BEGIN IMMEDIATE")
        user = con.execute("SELECT demo_balance FROM users WHERE username=?", (DEMO_USER,)).fetchone()
        if not user:
            con.rollback()
            return jsonify({"error": "Demo account not found."}), 404
        balance = money(user["demo_balance"])
        if amount > balance:
            con.rollback()
            return jsonify({"error": "Insufficient demo wallet balance."}), 400

        con.execute("UPDATE users SET demo_balance=demo_balance-? WHERE username=?",
                    (float(amount), DEMO_USER))
        con.execute("""
            INSERT INTO withdrawals
            (reference, username, amount_usd, amount_inr, exchange_rate, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (reference, DEMO_USER, str(amount), str(amount_inr),
              str(DEMO_USD_INR_RATE), "SIMULATED_NOT_PAID", created_at))
        con.execute("INSERT INTO events(username,event_type,amount,created_at) VALUES(?,?,?,?)",
                    (DEMO_USER, "DEMO_WITHDRAWAL_REQUEST", -float(amount), created_at))
        con.commit()
    except Exception:
        con.rollback()
        app.logger.exception("Could not create simulated withdrawal")
        return jsonify({"error": "Could not create withdrawal request."}), 500
    finally:
        con.close()

    return jsonify({
        "message": "Demo withdrawal recorded. No money was transferred.",
        "reference": reference,
        "amount_usd": float(amount),
        "amount_inr": float(amount_inr),
        "status": "SIMULATED_NOT_PAID"
    }), 201


@app.get("/health")
def health():
    return jsonify({"ok": True, "mode": "demo_only"})


init_db()

if __name__ == "__main__":
    # Local development only. Use a production WSGI server when deploying.
    app.run(host="127.0.0.1", port=5000, debug=True)
