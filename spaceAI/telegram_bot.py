"""telegram_bot.py — SOLARIS NETWORK: Telegram station AI chat.

Station AIs are mapped to celestial body ids (``celestial_bodies`` names /
app body ids like "earth", "moon", "makemake"). Chat runs through the OpenCode
Zen free-tier model with a fallback model on rate limits.

Persistence (optional, keyed off root .env DATABASE_URL):
- ``player_characters``: auto-registered on /start, location = current_body_id
- ``chat_logs``: every user message + AI reply logged per station body

Commands:
- /start — register / show current station
- /travel <body name> — move to a body; location syncs to the web app via the
  Express API (PATCH /api/player/<id>/location), direct DB update as fallback

Run:
    TELEGRAM_BOT_TOKEN=... OPENCODE_API_KEY=... spaceAI/venv/bin/python -m spaceAI.telegram_bot
(or from spaceAI/:  ./venv/bin/python telegram_bot.py)
"""

import asyncio
import json
import os
import socket
import threading
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

# Bot runs with cwd=spaceAI (npm script); root .env holds the tokens.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# This box has no IPv6 route, but DNS prefers AAAA records for
# api.telegram.org / opencode.ai — force IPv4 resolution for all sockets.
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_first_getaddrinfo(*args, **kwargs):
    results = _orig_getaddrinfo(*args, **kwargs)
    return sorted(results, key=lambda r: r[0] != socket.AF_INET)


socket.getaddrinfo = _ipv4_first_getaddrinfo

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from openai import AsyncOpenAI

# OpenCode Zen Free Model Client
client = AsyncOpenAI(
    base_url="https://opencode.ai/zen/v1",
    api_key=os.getenv("OPENCODE_API_KEY", "your_api_key_here"),
)

# 4-Model Rotation for Rate-Limit Resilience
MODEL_ROTATION = [
    "deepseek-v4-flash-free",
    "nemotron-3-ultra-free",
    "ling-3.0-flash-free",
    "qwen-2.5-72b-free",
]

# Model health tracking (skip models with repeated failures)
import time
MODEL_HEALTH = {model: {"failures": 0, "last_success": 0} for model in MODEL_ROTATION}

def update_model_health(model: str, success: bool):
    if success:
        MODEL_HEALTH[model]["failures"] = 0
        MODEL_HEALTH[model]["last_success"] = time.time()
    else:
        MODEL_HEALTH[model]["failures"] += 1

def get_healthy_models():
    """Skip models with >5 consecutive failures in last 5 minutes."""
    cutoff = time.time() - 300
    return [
        m for m in MODEL_ROTATION
        if MODEL_HEALTH[m]["failures"] < 5 or MODEL_HEALTH[m]["last_success"] > cutoff
    ]

# Express API base for web↔Telegram location sync (the bot and the web app
# share the same Postgres, so the PATCH endpoint is the single source of truth).
SOLARIS_API_URL = os.getenv("SOLARIS_API_URL", "http://127.0.0.1:5000")

# Location-Based Station AIs — keyed by the app's celestial body id
# (same ids as client/src/components/solar-system/bodies.ts).
STATION_AIS = {
    "earth": {"name": "A.R.E.S. Flight Command", "role": "Orbital controller at Earth station."},
    "moon": {"name": "Dr. Vance", "role": "Chief astrophysicist at Lunar Gateway."},
    "makemake": {"name": "Deep-Space Drone 09", "role": "Kuiper Belt exploration drone."},
}

# ---------------------------------------------------------------------------
# In-Memory State Caches (Performance Optimization)
# ---------------------------------------------------------------------------

# USER_LOCATIONS: telegram_user_id → body_name (lowercase)
# Avoids 1-2s Postgres query per message (Neon cold-start latency)
USER_LOCATIONS: dict[int, str] = {}

# USER_CONTEXTS: telegram_user_id → conversation history (rolling window)
# Last 6 messages (3 turns) for conversation continuity
USER_CONTEXTS: dict[int, list[dict]] = {}
MAX_CONTEXT_MESSAGES = 6

# USER_CONTEXT_TIMESTAMPS: track idle time for memory cleanup
USER_CONTEXT_TIMESTAMPS: dict[int, float] = {}

def prune_stale_contexts():
    """Remove conversations idle >1 hour to prevent memory leaks."""
    cutoff = time.time() - 3600
    stale = [uid for uid, ts in USER_CONTEXT_TIMESTAMPS.items() if ts < cutoff]
    for uid in stale:
        USER_CONTEXTS.pop(uid, None)
        USER_CONTEXT_TIMESTAMPS.pop(uid, None)
        USER_LOCATIONS.pop(uid, None)

# ---------------------------------------------------------------------------
# PostgreSQL persistence (psycopg2; sync calls hop over asyncio.to_thread)
# ---------------------------------------------------------------------------
import psycopg2 as pg  # noqa: E402  (imported after socket patch on purpose? no — after third-party is fine)

DATABASE_URL = os.getenv("DATABASE_URL")
_db_lock = threading.Lock()
_db_conn = None
_warned_errors = set()


def _connect():
    global _db_conn
    _db_conn = pg.connect(DATABASE_URL, connect_timeout=5)
    return _db_conn


def _db_call(fn, *args):
    """Run a sync DB call on the shared connection; reconnect once on failure.

    Returns None on any DB problem — the bot must stay alive without the DB
    (fail-silent philosophy, same as the web client).
    """
    if not DATABASE_URL:
        return None
    global _db_conn
    with _db_lock:
        for _ in range(2):
            try:
                if _db_conn is None or _db_conn.closed:
                    _connect()
                return fn(_db_conn, *args)
            except pg.OperationalError:
                _db_conn = None
            except Exception as e:  # missing table / type mismatch etc.
                key = type(e).__name__
                if key not in _warned_errors:
                    _warned_errors.add(key)
                    print(f"⚠ DB unavailable ({key}): {str(e)[:120]}")
                return None
        return None


async def _db(fn, *args):
    return await asyncio.to_thread(_db_call, fn, *args)


def _ensure_earth(conn):
    cur = conn.cursor()
    cur.execute("SELECT id FROM celestial_bodies WHERE lower(name) = 'earth'")
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO celestial_bodies (name, type, fact) "
        "VALUES ('Earth', 'planet', 'Home world of SOLARIS flight control.') "
        "RETURNING id"
    )
    earth_id = cur.fetchone()[0]
    conn.commit()
    return earth_id


def _upsert_player(conn, telegram_user_id, name):
    """Register the player at Earth on first contact; return location body name."""
    earth_id = _ensure_earth(conn)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO player_characters (telegram_user_id, name, current_body_id, reputation) "
        "VALUES (%s, %s, %s, 0) ON CONFLICT (telegram_user_id) DO NOTHING",
        (telegram_user_id, name, earth_id),
    )
    created = cur.rowcount == 1
    conn.commit()
    return created


def _player_name(conn, telegram_user_id):
    cur = conn.cursor()
    cur.execute("SELECT name FROM player_characters WHERE telegram_user_id = %s", (telegram_user_id,))
    row = cur.fetchone()
    return row[0] if row else None


def _player_location(conn, telegram_user_id):
    cur = conn.cursor()
    cur.execute(
        "SELECT cb.name FROM player_characters pc"
        " JOIN celestial_bodies cb ON cb.id = pc.current_body_id"
        " WHERE pc.telegram_user_id = %s",
        (telegram_user_id,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _body_db_id(conn, body_key):
    cur = conn.cursor()
    cur.execute("SELECT id FROM celestial_bodies WHERE lower(name) = %s", (body_key,))
    row = cur.fetchone()
    return row[0] if row else _ensure_earth(conn)


def _find_body(conn, query):
    """Resolve a /travel destination. Exact case-insensitive name match wins;
    otherwise return up to 5 LIKE matches so the caller can disambiguate.

    Returns [] when nothing matches; None (from _db_call) means DB unavailable.
    """
    q = (query or "").strip().lower()
    if not q:
        return []
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM celestial_bodies WHERE lower(name) = %s", (q,))
    exact = cur.fetchall()
    if exact:
        return [(row[0], row[1]) for row in exact]
    cur.execute(
        "SELECT id, name FROM celestial_bodies WHERE lower(name) LIKE %s"
        " ORDER BY name LIMIT 5",
        (f"%{q}%",),
    )
    return [(row[0], row[1]) for row in cur.fetchall()]


def _move_player(conn, telegram_user_id, body_id, name):
    """Travel: upsert the player at the destination body (create or relocate)."""
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO player_characters (telegram_user_id, name, current_body_id, reputation) "
        "VALUES (%s, %s, %s, 0) "
        "ON CONFLICT (telegram_user_id) DO UPDATE SET current_body_id = EXCLUDED.current_body_id",
        (telegram_user_id, name, body_id),
    )
    conn.commit()


def _log_message(conn, body_key, sender_name, message, is_ai):
    body_id = _body_db_id(conn, body_key or "earth")
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_logs (body_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
        (body_id, sender_name, message, 1 if is_ai else 0),
    )
    conn.commit()


# ---------------------------------------------------------------------------

async def _get_location(telegram_user_id: int) -> str:
    """Fetch location from cache → DB → default to Earth.
    
    Cache hit: <10ms (memory lookup)
    Cache miss: 1-2s (Postgres query, then cached)
    """
    if telegram_user_id in USER_LOCATIONS:
        return USER_LOCATIONS[telegram_user_id]
    
    # Cache miss — load from DB and cache the result
    location = (await _db(_player_location, telegram_user_id)) or "Earth"
    body_key = location.strip().lower()
    USER_LOCATIONS[telegram_user_id] = body_key
    return body_key


def _is_rate_limit(err: Exception) -> bool:
    text = str(err)
    return "429" in text or "FreeUsageLimitError" in text


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    created = await _db(_upsert_player, user.id, user.first_name or "Recruit")
    location = (await _db(_player_location, user.id)) or "Earth"
    station = STATION_AIS.get(location.strip().lower(), STATION_AIS["earth"])

    if created:
        text = (
            "🛸 *[SOLARIS NETWORK ONLINE]*\n"
            f"Registration complete, Commander **{user.first_name or 'Recruit'}**.\n"
            f"You are stationed at {location} — {station['name']}.\n"
            "Send a message to talk with local station AIs."
        )
    else:
        text = (
            "🛸 *[SOLARIS NETWORK ONLINE]*\n"
            f"Welcome back, Commander **{user.first_name or 'Recruit'}**.\n"
            f"Current station: {location} — {station['name']}.\n"
            "Send a message to talk with local station AIs."
        )
    await update.message.reply_text(text, parse_mode="Markdown")


async def call_llm_with_backoff(model: str, messages: list, max_retries=2):
    """Call LLM with exponential backoff on rate-limits."""
    for attempt in range(max_retries):
        try:
            return await client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=150,
                timeout=8.0,
            )
        except Exception as e:
            if not _is_rate_limit(e):
                raise
            if attempt < max_retries - 1:
                delay = 2 ** attempt  # 1s, 2s
                await asyncio.sleep(delay)
    raise  # Exhausted retries


async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_text = update.message.text
    sender = (await _db(_player_name, user.id)) or user.first_name or "Unknown"

    # Location-based routing with in-memory cache (10x faster than DB query)
    body_id = await _get_location(user.id)
    if body_id not in STATION_AIS:
        body_id = "earth"
    station = STATION_AIS[body_id]

    await _db(_log_message, body_id, sender, user_text, False)

    # Get or initialize conversation history for this user
    if user.id not in USER_CONTEXTS:
        USER_CONTEXTS[user.id] = []
    history = USER_CONTEXTS[user.id]
    USER_CONTEXT_TIMESTAMPS[user.id] = time.time()

    # Build messages with system prompt + conversation history + new message
    messages = [
        {
            "role": "system",
            "content": f"You are {station['name']}, {station['role']}. "
                       f"Keep replies under 3 sentences. Remember prior conversation.",
        },
        *history,  # Past conversation (up to 6 messages)
        {"role": "user", "content": user_text},
    ]

    # 4-Model rotation with health tracking and exponential backoff
    reply = None
    last_err = None
    for model in get_healthy_models():
        try:
            response = await call_llm_with_backoff(model, messages)
            reply = response.choices[0].message.content.strip()
            update_model_health(model, success=True)
            break
        except Exception as e:
            update_model_health(model, success=False)
            last_err = e
            if not _is_rate_limit(e):
                break  # Non-rate-limit error = stop rotation

    if reply is None:
        if last_err is not None and not _is_rate_limit(last_err):
            reply = f"*[Signal lost with {station['name']}... Error: {str(last_err)[:80]}]*"
        else:
            reply = (
                f"⚠️ *[{station['name']} Relay Busy]*: High sub-space chatter detected. "
                "Systems calibrating... Please repeat your message in a few seconds."
            )

    # Update conversation history (keep last MAX_CONTEXT_MESSAGES messages)
    if reply and not reply.startswith("*[Signal lost"):
        history.append({"role": "user", "content": user_text})
        history.append({"role": "assistant", "content": reply})
        USER_CONTEXTS[user.id] = history[-MAX_CONTEXT_MESSAGES:]

    await _db(_log_message, body_id, station["name"], reply, True)

    # Markdown can crash on invalid entities from model output — fall back to
    # plain text if Telegram rejects the styled reply.
    try:
        await update.message.reply_text(f"📡 *{station['name']}*:\n{reply}", parse_mode="Markdown")
    except Exception:
        await update.message.reply_text(f"📡 {station['name']}:\n{reply}")


# ---------------------------------------------------------------------------
# /travel — move the player to a body, syncing web ↔ Telegram locations.
# ---------------------------------------------------------------------------

def _sync_location_via_api(telegram_user_id, payload):
    """PATCH Express /api/player/<id>/location (single source of truth for both
    the web app and the bot). Returns the parsed player JSON, or None on any
    failure (Express down / non-200). Blocking — call via asyncio.to_thread.
    """
    try:
        url = f"{SOLARIS_API_URL}/api/player/{telegram_user_id}/location"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            method="PATCH",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
        return None
    except Exception:
        return None


def _station_for(body_name):
    return STATION_AIS.get((body_name or "").strip().lower())


TRAVEL_USAGE = (
    "🛸 *[SOLARIS NAVIGATION]* — travel command\n"
    "Usage: `/travel <body name>` — e.g. `/travel mars`, `/travel moon`.\n\n"
    "*Operational stations:*\n"
    "• Earth — A.R.E.S. Flight Command\n"
    "• Moon — Dr. Vance\n"
    "• Makemake — Deep-Space Drone 09\n"
    "Any body in the SOLARIS catalog is a valid destination."
)


async def _reply_arrival(update: Update, user, body_name: str):
    station = _station_for(body_name)
    if station:
        text = (
            "🛸 *[SOLARIS NETWORK]* — course locked, Commander "
            f"**{user.first_name or 'Recruit'}**.\n"
            f"Arrived at **{body_name}** — {station['name']}.\n"
            "Send a message to talk with local station AIs."
        )
    else:
        text = (
            "🛸 *[SOLARIS NETWORK]* — course locked, Commander "
            f"**{user.first_name or 'Recruit'}**.\n"
            f"You have arrived at **{body_name}**."
        )
    await update.message.reply_text(text, parse_mode="Markdown")


async def _reply_signal_lost(update: Update):
    text = (
        "*[Signal lost with SOLARIS Network...]* Unable to update your location "
        "right now. Try `/travel` again in a moment."
    )
    try:
        await update.message.reply_text(text, parse_mode="Markdown")
    except Exception:
        await update.message.reply_text(text.replace("*", ""))


async def travel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    query = " ".join(context.args).strip()

    if not query:
        await update.message.reply_text(TRAVEL_USAGE, parse_mode="Markdown")
        return

    # Resolve against the catalog: exact case-insensitive name, else LIKE matches.
    matches = await _db(_find_body, query)

    if matches is None:
        # Postgres unreachable — let Express resolve the body by name instead
        # (its PATCH route does the same case-insensitive lookup).
        player = await asyncio.to_thread(
            _sync_location_via_api, user.id, {"bodyName": query}
        )
        if player and player.get("bodyName"):
            await _reply_arrival(update, user, player["bodyName"])
        else:
            await _reply_signal_lost(update)
        return

    if not matches:
        text = (
            f"🛸 *[SOLARIS NAVIGATION]* — no body named \"{query}\" in the catalog.\n"
            "Check the name (e.g. `/travel mars`) or use `/travel` for the station list."
        )
        await update.message.reply_text(text, parse_mode="Markdown")
        return

    if len(matches) > 1:
        listing = "\n".join(f"• {name}" for _id, name in matches)
        text = (
            f"🛸 *[SOLARIS NAVIGATION]* — \"{query}\" is ambiguous. Did you mean:\n"
            f"{listing}"
        )
        await update.message.reply_text(text, parse_mode="Markdown")
        return

    body_id, body_name = matches[0]
    player_name = (await _db(_player_name, user.id)) or user.first_name or "Recruit"

    # Express PATCH first (same Postgres as the web app — single source of
    # truth). Only if Express is unreachable do we update the DB directly; both
    # paths write the same destination so there is never a conflicting write.
    player = await asyncio.to_thread(_sync_location_via_api, user.id, {"bodyId": body_id})
    if player:
        body_name = player.get("bodyName") or body_name
    else:
        await _db(_move_player, user.id, body_id, player_name)
        location = (await _db(_player_location, user.id)) or ""
        if not location:
            await _reply_signal_lost(update)
            return
        body_name = location

    # Update in-memory location cache
    USER_LOCATIONS[user.id] = body_name.strip().lower()

    await _reply_arrival(update, user, body_name)


def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("travel", travel))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_chat))

    print("🚀 Telegram Bot listening...", flush=True)
    app.run_polling()


if __name__ == "__main__":
    main()