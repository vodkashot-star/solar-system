# SOLARIS NETWORK: Architecture Improvements & Implementation Roadmap
**Based on:** PLAN_CONTEXT.md v2.0.0  
**Date:** 2026-08-14  
**Status:** Production Assessment & Enhancement Plan

---

## 🎯 Executive Summary

Your SOLARIS Network architecture is **functionally complete** with solid foundations:
- ✅ Telegram bot with location-aware Station AIs
- ✅ 3D Solar System web dashboard (React Three Fiber)
- ✅ PostgreSQL persistence (player locations, chat logs)
- ✅ Multi-model LLM rotation for rate-limit resilience
- ✅ Express API bridge for Telegram ↔ Web sync

**Gaps Identified:**
1. **WebSocket/SSE missing** — web dashboard can't see real-time Telegram movements
2. **Model rotation incomplete** — only 2 models configured, 4 advertised
3. **Memory-based USER_LOCATIONS** — exists only in diagram, not implemented
4. **3D camera sync** — `/travel` updates DB but web client doesn't auto-follow
5. **Chat memory** — Station AIs have no conversation context
6. **Error recovery** — rate-limit fallback needs graceful degradation

---

## 🔥 Critical Improvements (High Priority)

### 1. **Real-Time Web ↔ Telegram Sync (Missing)**

**Current State:**
- Telegram bot updates `player_characters.current_body_id` via Express API
- Web client fetches bodies from `/api/bodies` once on mount
- **Problem:** No push notifications when another player `/travel`s

**Solution: Server-Sent Events (SSE)**

#### Why SSE Over WebSockets?
- **Simpler** — unidirectional server→client (perfect for location broadcasts)
- **Auto-reconnect** — browser EventSource handles connection drops
- **HTTP/2 multiplexing** — no extra ports, works through proxies
- **Lower overhead** — no handshake, no ping/pong frames

#### Implementation

**Express endpoint:**
```typescript
// server/routes.ts
const sseClients = new Set<Response>();

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  
  sseClients.add(res);
  
  req.on("close", () => {
    sseClients.delete(res);
  });
});

function broadcastPlayerMovement(userId: number, bodyId: number, bodyName: string) {
  const event = JSON.stringify({
    type: "player_moved",
    userId,
    bodyId,
    bodyName,
    timestamp: Date.now(),
  });
  
  for (const client of sseClients) {
    client.write(`data: ${event}\n\n`);
  }
}

// Call from PATCH /api/player/:telegramUserId/location after DB update
```

**Client integration:**
```typescript
// client/src/hooks/usePlayerMovements.ts
export function usePlayerMovements() {
  useEffect(() => {
    const events = new EventSource('/api/events');
    
    events.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'player_moved') {
        // Focus camera on new location
        useCameraFocus.getState().focus(data.bodyName);
        // Show notification toast
        console.log(`Player ${data.userId} traveled to ${data.bodyName}`);
      }
    });
    
    events.onerror = () => {
      console.warn('[SSE] Connection lost, retrying...');
    };
    
    return () => events.close();
  }, []);
}
```

**Files to modify:**
- `server/routes.ts` — add SSE endpoint + broadcast helper
- `client/src/hooks/usePlayerMovements.ts` — new hook
- `client/src/components/solar-system/SolarSystem.tsx` — import hook

---

### 2. **Complete Multi-Model Rotation**

**Current State:**
```python
for model in (OPENCODE_MODEL, OPENCODE_FALLBACK_MODEL):  # Only 2 models
```

**Advertised in PLAN_CONTEXT.md:**
- deepseek-v4-flash-free ✅
- nemotron-3-ultra-free ✅
- ling-3.0-flash-free ❌
- qwen-2.5-72b-free ❌

**Fix:**
```python
# spaceAI/telegram_bot.py
MODEL_ROTATION = [
    "deepseek-v4-flash-free",
    "nemotron-3-ultra-free",
    "ling-3.0-flash-free",
    "qwen-2.5-72b-free",
]

async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # ... existing code ...
    
    reply = None
    last_err = None
    for model in MODEL_ROTATION:
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[...],
                max_tokens=150,
                timeout=8.0,  # Add explicit timeout
            )
            reply = response.choices[0].message.content.strip()
            break
        except Exception as e:
            last_err = e
            if not _is_rate_limit(e):
                break  # Non-rate-limit error = stop rotation
    
    # ... existing fallback logic ...
```

**Also add:**
```python
# Model health tracking
MODEL_HEALTH = {model: {"failures": 0, "last_success": 0} for model in MODEL_ROTATION}

def update_model_health(model: str, success: bool):
    if success:
        MODEL_HEALTH[model]["failures"] = 0
        MODEL_HEALTH[model]["last_success"] = time.time()
    else:
        MODEL_HEALTH[model]["failures"] += 1

# Skip models with >5 consecutive failures in last 5 minutes
def get_healthy_models():
    cutoff = time.time() - 300
    return [
        m for m in MODEL_ROTATION
        if MODEL_HEALTH[m]["failures"] < 5 or MODEL_HEALTH[m]["last_success"] > cutoff
    ]
```

---

### 3. **In-Memory Location Cache (USER_LOCATIONS)**

**Diagram shows:** `In-Memory State Cache (USER_LOCATIONS Map)`  
**Reality:** All location lookups hit Postgres

**Why it matters:**
- Neon cold-start latency: ~1-2s per query
- Every Telegram message = 1 location query = 1-2s delay before AI responds
- 100 messages/hour = 100-200s wasted on DB round-trips

**Solution:**
```python
# spaceAI/telegram_bot.py (top of file)
USER_LOCATIONS: dict[int, str] = {}  # telegram_user_id → body_name (lowercase)

async def _get_location(telegram_user_id: int) -> str:
    """Fetch location from cache → DB → default to Earth."""
    if telegram_user_id in USER_LOCATIONS:
        return USER_LOCATIONS[telegram_user_id]
    
    # Cache miss — load from DB
    location = (await _db(_player_location, telegram_user_id)) or "Earth"
    body_key = location.strip().lower()
    USER_LOCATIONS[telegram_user_id] = body_key
    return body_key

async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # ... existing code ...
    body_id = await _get_location(user.id)
    if body_id not in STATION_AIS:
        body_id = "earth"
    station = STATION_AIS[body_id]
    # ... rest of handler ...

# Update cache on /travel
async def travel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # ... after successful DB update ...
    USER_LOCATIONS[user.id] = body_key  # Cache the new location
```

**Impact:**
- First message per user: 1-2s (DB query)
- Subsequent messages: <10ms (memory lookup)
- 99% of messages avoid DB latency

---

### 4. **Chat Memory / Conversation Context**

**Current State:**
```python
messages=[
    {"role": "system", "content": "You are A.R.E.S. ..."},
    {"role": "user", "content": user_text},  # Only the latest message
]
```

**Problem:** Station AIs forget previous conversation after 1 turn

**Solution: Rolling Context Window**
```python
# Per-user conversation history (last N messages)
USER_CONTEXTS: dict[int, list[dict]] = {}
MAX_CONTEXT_MESSAGES = 6  # 3 turns = 6 messages (user + AI)

async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_text = update.message.text
    
    # Get or init conversation history
    if user.id not in USER_CONTEXTS:
        USER_CONTEXTS[user.id] = []
    
    history = USER_CONTEXTS[user.id]
    
    # Build messages with system prompt + history + new message
    messages = [
        {
            "role": "system",
            "content": f"You are {station['name']}, {station['role']}. "
                       f"Keep replies under 3 sentences. Remember prior conversation."
        },
        *history,  # Past conversation
        {"role": "user", "content": user_text},
    ]
    
    # ... LLM call ...
    
    if reply:
        # Update history (keep last MAX_CONTEXT_MESSAGES messages)
        history.append({"role": "user", "content": user_text})
        history.append({"role": "assistant", "content": reply})
        USER_CONTEXTS[user.id] = history[-MAX_CONTEXT_MESSAGES:]
```

**Memory Management:**
```python
# Prune stale conversations (>1 hour idle)
import time
USER_CONTEXT_TIMESTAMPS: dict[int, float] = {}

def prune_stale_contexts():
    cutoff = time.time() - 3600
    stale = [uid for uid, ts in USER_CONTEXT_TIMESTAMPS.items() if ts < cutoff]
    for uid in stale:
        USER_CONTEXTS.pop(uid, None)
        USER_CONTEXT_TIMESTAMPS.pop(uid, None)

# Call in background task
asyncio.create_task(periodic_prune())
```

---

## 🚀 Medium Priority Improvements

### 5. **Rate-Limit Backoff Strategy**

**Current:** Immediately tries next model on 429  
**Better:** Exponential backoff before rotating

```python
import asyncio

async def call_llm_with_backoff(model: str, messages: list, max_retries=2):
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
                delay = 2 ** attempt  # 1s, 2s, 4s
                await asyncio.sleep(delay)
    raise  # Exhausted retries

async def handle_chat(...):
    for model in get_healthy_models():
        try:
            response = await call_llm_with_backoff(model, messages)
            reply = response.choices[0].message.content.strip()
            update_model_health(model, success=True)
            break
        except Exception as e:
            update_model_health(model, success=False)
            # Continue to next model
```

---

### 6. **3D Camera Auto-Follow on /travel**

**Current:** Web client doesn't react to Telegram movements  
**Fix:** SSE + focus store

```typescript
// client/src/hooks/usePlayerMovements.ts (from Improvement #1)
events.addEventListener('message', (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'player_moved') {
    const { focus } = useCameraFocus.getState();
    
    // Only auto-follow if user isn't currently focused on something else
    if (!useCameraFocus.getState().isFocused) {
      focus(data.bodyName);
    }
    
    // Show notification regardless
    toast.info(`Player ${data.userId} traveled to ${data.bodyName}`);
  }
});
```

**Optional:** Add a "Follow Player" toggle button that enables auto-focus

---

### 7. **Structured Station AI Personas**

**Current:** Hardcoded in bot + diagram  
**Better:** Database-driven with richer context

```sql
-- Add to shared/schema.ts
export const stationAIs = pgTable('station_ais', {
  id: serial('id').primaryKey(),
  bodyId: integer('body_id').references(() => celestialBodies.id),
  name: text('name').notNull(),
  role: text('role').notNull(),
  systemPrompt: text('system_prompt'),
  personality: text('personality'),
  backstory: text('backstory'),
  maxTokens: integer('max_tokens').default(150),
});
```

**Migration:**
```python
# Load from DB instead of STATION_AIS dict
async def get_station_ai(body_key: str):
    # Query Express API: GET /api/stations/<body_key>
    # Fallback to default A.R.E.S. if not found
```

---

### 8. **Telegram Topic/Channel Routing**

**PLAN_CONTEXT mentions:** "Telegram topics and channels become Sectors"  
**Not implemented:** Bot only handles direct messages

**Add:**
```python
async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Check if message is in a topic/channel
    if update.message.chat.type in ("group", "supergroup"):
        topic_id = update.message.message_thread_id  # Telegram Topics feature
        # Map topic_id → sector/body
        body_id = TOPIC_TO_SECTOR.get(topic_id, "earth")
    else:
        # Private chat — use player location
        body_id = await _get_location(user.id)
    
    station = STATION_AIS.get(body_id, STATION_AIS["earth"])
    # ... rest of handler ...
```

---

## 📋 Nice-to-Have Enhancements

### 9. **Reputation System**

**Schema exists:** `player_characters.reputation`  
**Not used:** Always defaults to 0

**Ideas:**
- +1 per `/travel` (exploration reward)
- +5 for reaching a new body for the first time
- +10 for chatting with all 3 Station AIs in a session
- Display rank in `/start` message

### 10. **Fleet System (Multi-Player Visualization)**

**Diagram shows:** "Commander & Fleet Engine"  
**Missing:** No fleet concept, only single-player locations

**Add:**
```typescript
// client/src/components/solar-system/PlayerShips.tsx
export function PlayerShips({ players }: { players: PlayerLocation[] }) {
  return (
    <group>
      {players.map(p => (
        <mesh key={p.userId} position={getBodyPosition(p.bodyId)}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color="#00ffff" />
          {/* Add player name label above ship */}
        </mesh>
      ))}
    </group>
  );
}
```

### 11. **Mission Objectives / Quest System**

Leverage `chat_logs` to track player achievements:
- "Reach the Kuiper Belt" (travel to Makemake)
- "Consult all 3 Station AIs"
- "Send 10 messages to Dr. Vance"

---

## 🛠️ Implementation Priority

| Priority | Item | Impact | Effort | Status |
|----------|------|--------|--------|--------|
| **P0** | In-Memory Location Cache (#3) | High (10x faster bot) | 30 min | ❌ Missing |
| **P0** | Complete Model Rotation (#2) | High (resilience) | 15 min | ⚠️ Partial |
| **P1** | Chat Memory/Context (#4) | High (UX quality) | 1 hour | ❌ Missing |
| **P1** | SSE Real-Time Sync (#1) | High (web↔TG sync) | 2 hours | ❌ Missing |
| **P1** | Rate-Limit Backoff (#5) | Medium (stability) | 30 min | ⚠️ Basic |
| **P2** | Camera Auto-Follow (#6) | Medium (visual sync) | 30 min | ❌ Missing |
| **P2** | DB-Driven Station AIs (#7) | Medium (extensibility) | 2 hours | ❌ Missing |
| **P3** | Topic/Channel Routing (#8) | Low (multi-player) | 1 hour | ❌ Missing |
| **P3** | Reputation System (#9) | Low (gamification) | 1 hour | ❌ Schema only |
| **P3** | Fleet Visualization (#10) | Low (multi-player UX) | 3 hours | ❌ Missing |

---

## 🔧 Quick Wins (Start Here)

### Day 1: Performance & Resilience (3 hours)
1. ✅ Add `USER_LOCATIONS` in-memory cache (30 min)
2. ✅ Complete model rotation to 4 models (15 min)
3. ✅ Add rate-limit backoff strategy (30 min)
4. ✅ Add chat memory/context (1 hour)
5. ✅ Test with 10 rapid `/travel` + messages (30 min)

### Day 2: Real-Time Sync (3 hours)
1. ✅ Add SSE `/api/events` endpoint (1 hour)
2. ✅ Add `usePlayerMovements` hook (30 min)
3. ✅ Integrate with SolarSystem camera focus (30 min)
4. ✅ Add toast notifications for movements (30 min)
5. ✅ Test with 2 Telegram clients + web dashboard (30 min)

### Day 3: Polish (2 hours)
1. ✅ Add reputation tracking on `/travel` (30 min)
2. ✅ Add camera auto-follow toggle (30 min)
3. ✅ Update PLAN_CONTEXT.md with actual architecture (30 min)
4. ✅ Write deployment guide for Render (30 min)

---

## 🎨 Architecture Diagram (Updated)

```
                     ┌─────────────────────────────────────────┐
                     │          Telegram Clients               │
                     └────────────────────┬────────────────────┘
                                          │ Webhook / Polling
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │          Telegram Bot Service           │
                     │   (python-telegram-bot / spaceAI)       │
                     │   • In-Memory USER_LOCATIONS Cache      │  ← NEW
                     │   • Rolling Chat Context (per user)     │  ← NEW
                     │   • 4-Model Rotation + Health Tracking  │  ← FIXED
                     └────────────────────┬────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│   Movement Handler    │     │   Station AI Core     │     │ Express API + SSE     │  ← NEW
│  (/travel + Routing)  │     │ (OpenCode Zen Multi)  │     │ (:5000 REST + Events) │
│  • Broadcasts to SSE  │     │ • Exponential Backoff │     │ • /api/events (SSE)   │
└───────────┬───────────┘     └───────────┬───────────┘     └───────────┬───────────┘
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │    LLM Router & Fallback Pipeline       │
                     │  - Primary: DeepSeek V4 Flash           │
                     │  - Fallback: Nemotron/Ling/Qwen (all 4) │  ← FIXED
                     │  - Per-Model Health Tracking            │  ← NEW
                     └────────────────────┬────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│ Neon Postgres (DB)    │     │  spaceAI Python ML    │     │ In-Memory Bot State   │  ← NEW
│ (Drizzle ORM Schema)  │     │  (:8000 Celestial ML) │     │ • USER_LOCATIONS      │
│ • player_characters   │     │                       │     │ • USER_CONTEXTS       │
│ • chat_logs           │     │                       │     │ • MODEL_HEALTH        │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘
                                          ▲
                                          │ SSE + REST API  ← NEW
                                          │
                     ┌────────────────────┴────────────────────┐
                     │ 3D Client SPA (React Three Fiber / SPA) │
                     │ • SSE Client (usePlayerMovements)       │  ← NEW
                     │ • Auto-Follow Camera                    │  ← NEW
                     └─────────────────────────────────────────┘
```

---

## 📝 Files to Modify

### New Files
- `client/src/hooks/usePlayerMovements.ts` — SSE client for real-time sync
- `shared/schema.ts` — add `stationAIs` table (optional)

### Modified Files
- `spaceAI/telegram_bot.py` — add USER_LOCATIONS cache, chat memory, 4-model rotation, backoff
- `server/routes.ts` — add `/api/events` SSE endpoint, broadcast helper
- `client/src/components/solar-system/SolarSystem.tsx` — integrate SSE hook
- `PLAN_CONTEXT.md` — update with actual implementation details

---

## ✅ Validation Checklist

After implementing improvements:
- [ ] Run `npm test` — all 185 tests pass
- [ ] Run `npm run validate` — typecheck + tests
- [ ] Test Telegram bot with 4+ rapid messages (cache working)
- [ ] Test `/travel mars` in Telegram → web camera focuses Mars (SSE working)
- [ ] Test 2-turn conversation — AI remembers context
- [ ] Test rate-limit scenario — bot rotates through 4 models
- [ ] Check Render logs — no DB query spam on every message
- [ ] Check web browser console — SSE connection stable

---

## 🚀 Deployment Notes

**Render services (render.yaml):**
- `solar-system-api` — already configured ✅
- `solar-system-ml` — already configured ✅
- `solar-system-bot` — already configured ✅

**New environment variables:**
- None needed (all improvements use existing config)

**Database migrations:**
- None required for P0-P1 improvements
- Optional: add `station_ais` table for P2

**Monitoring:**
- Add Sentry alerts for LLM rotation failures
- Track SSE client count in `/api/health`
- Log USER_LOCATIONS cache hit rate

---

## 📚 References

- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [React Three Fiber Camera Controls](https://docs.pmnd.rs/react-three-fiber/api/hooks#usethree)
