"""telegram_bot.py — SOLARIS NETWORK: Telegram station AI chat.

Station AIs are mapped to celestial body ids (``celestial_bodies`` names /
app body ids like "earth"). Chat runs through the OpenCode Zen free-tier
model and is local — the bot has no DB dependency yet.

Run:
    TELEGRAM_BOT_TOKEN=... OPENCODE_API_KEY=... spaceAI/venv/bin/python -m spaceAI.telegram_bot
(or from spaceAI/:  ./venv/bin/python telegram_bot.py)
"""

import os
import socket
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
OPENCODE_MODEL = "deepseek-v4-flash-free"

# Location-Based Station AIs — keyed by the app's celestial body id
# (same ids as client/src/components/solar-system/bodies.ts).
STATION_AIS = {
    "earth": {"name": "A.R.E.S. Flight Command", "role": "Orbital controller at Earth station."},
    "moon": {"name": "Dr. Vance", "role": "Chief astrophysicist at Lunar Gateway."},
    "makemake": {"name": "Deep-Space Drone 09", "role": "Kuiper Belt exploration drone."},
}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🛸 *[SOLARIS NETWORK ONLINE]*\n"
        "Welcome Commander. Send a message to talk with local station AIs.",
        parse_mode="Markdown",
    )


async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    # TODO: map the Telegram topic / user location to a real bodyId (e.g. from
    # player_characters.current_body_id). Defaults to Earth for now.
    body_id = "earth"
    station = STATION_AIS.get(body_id, STATION_AIS["earth"])

    try:
        response = await client.chat.completions.create(
            model=OPENCODE_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"You are {station['name']}, {station['role']}. Keep replies under 3 sentences.",
                },
                {"role": "user", "content": user_text},
            ],
            max_tokens=150,
        )
        reply_text = response.choices[0].message.content or "(no response)"
    except Exception as e:  # network / model errors must not kill the handler
        await update.message.reply_text(f"⚠️ Station uplink degraded: {e}")
        return

    # Markdown can crash on invalid entities from model output — fall back to
    # plain text if Telegram rejects the styled reply.
    try:
        await update.message.reply_text(f"📡 *{station['name']}*:\n{reply_text}", parse_mode="Markdown")
    except Exception:
        await update.message.reply_text(f"📡 {station['name']}:\n{reply_text}")


def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_chat))

    print("🚀 Telegram Bot listening...")
    app.run_polling()


if __name__ == "__main__":
    main()