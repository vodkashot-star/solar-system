🚀 SOLAR SYSTEM NETWORK: TELEGRAM RP & 3D SYSTEM ARCHITECTURE
Version: 2.1.0
Status: Production Implementation (Updated 2026-08-14)
Target Environment: Telegram API + Web 3D Dashboard + Python ML / LLM Service
1. Executive Summary & Vision
The Solaris Network Platform is a hybrid space-exploration and role-playing ecosystem designed to bridge Telegram's real-time messaging with a persistent 3D Solar System visualizer (system-3d.surge.sh).
The platform transforms Telegram topics and channels into deep-space station nodes ("Sectors") where pilots and automated Station AIs (e.g., A.R.E.S. Flight Command, Dr. Vance, Probe-09) interact, issue navigation vectors, log telemetry, and progress lore across the solar system. A Web Dashboard powered by React Three Fiber and Express renders real NASA celestial bodies and spacecraft models in real-time, matching player movements in Telegram.
2. System Architecture & Topology
                     ┌─────────────────────────────────────────┐  
                     │          Telegram Clients               │  
                     └────────────────────┬────────────────────┘  
                                          │ Webhook / Polling  
                                          ▼  
                     ┌─────────────────────────────────────────┐  
                     │          Telegram Bot Service           │  
                     │   (python-telegram-bot / spaceAI)       │  
                     │   • In-Memory USER_LOCATIONS Cache ✅   │
                     │   • Rolling Chat Context (6 msgs) ✅    │
                     │   • 4-Model Rotation + Health Track ✅  │
                     └────────────────────┬────────────────────┘  
                                          │  
            ┌─────────────────────────────┼─────────────────────────────┐  
            │                             │                             │  
            ▼                             ▼                             ▼  
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐  
│   Movement Handler    │     │   Station AI Core     │     │ Express API + SSE ✅  │  
│  (/travel & Routing)  │     │ (OpenCode Zen Multi)  │     │ (:5000 REST + Events) │  
│  • Updates Cache ✅   │     │ • Exp. Backoff ✅     │     │ • /api/events (SSE)   │
└───────────┬───────────┘     └───────────┬───────────┘     └───────────┬───────────┘  
            │                             │                             │  
            └─────────────────────────────┼─────────────────────────────┘  
                                          │  
                                          ▼  
                     ┌─────────────────────────────────────────┐  
                     │    LLM Router & Fallback Pipeline       │  
                     │  - Primary: DeepSeek V4 Flash ✅        │  
                     │  - Fallback: Nemotron 3 ✅              │  
                     │  - Tertiary: Ling 3.0 Flash ✅          │
                     │  - Final: Qwen 2.5 72B ✅               │
                     └────────────────────┬────────────────────┘  
                                          │  
            ┌─────────────────────────────┼─────────────────────────────┐  
            │                             │                             │  
            ▼                             ▼                             ▼  
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐  
│ Neon Postgres (DB)    │     │  spaceAI Python ML    │     │ In-Memory Bot State ✅│  
│ (Drizzle ORM Schema)  │     │  (:8000 Celestial ML) │     │ • USER_LOCATIONS      │  
│ • player_characters   │     │                       │     │ • USER_CONTEXTS       │
│ • chat_logs           │     │                       │     │ • MODEL_HEALTH        │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘  
                                          ▲  
                                          │ SSE + REST API ✅  
                                          │  
                     ┌────────────────────┴────────────────────┐  
                     │ 3D Client SPA (React Three Fiber / SPA) │  
                     │ • SSE Client (usePlayerMovements) ✅    │
                     │ • Auto-Follow Camera ✅                 │
                     └─────────────────────────────────────────┘  

3. Core Features & Functional Requirements
3.1 Commander & Fleet Engine
 * Pilot Profile Setup (/start):
   * Attributes: Telegram User ID, Callsign, Active Sector, Ship Class, Reputation Score.
   * Persistence: Stored in Neon PostgreSQL via Drizzle ORM (player_characters table).
 * Location-Aware Station AIs:
   * Station personas are dynamically mapped to canonical celestial_bodies IDs:
     * earth \rightarrow A.R.E.S. Flight Command (Orbital controller)
     * moon \rightarrow Dr. Vance (Lunar Gateway astrophysicist)
     * makemake \rightarrow Probe-09 (Kuiper Belt survey drone)
3.2 Sector Topology & Orbital Movement
 * Location Routing:
   * The universe is split into sectors corresponding to 39 public domain NASA GLB models (earth, jwst, voyager-2, juno-spacecraft, etc.).
   * /travel <sector> verifies target availability, updates currentBodyId in PostgreSQL, and hands off context to the local Station AI.
 * 3D Visualizer Sync (✅ REAL-TIME):
   * Web client subscribes to `/api/events` Server-Sent Events endpoint
   * Telegram `/travel` commands broadcast to all connected web clients via SSE
   * Camera auto-focuses on new body when player moves (unless manually focused)
   * Event payload: `{ type: "player_moved", userId, bodyId, bodyName, timestamp }`
   * Auto-reconnect on connection loss (browser EventSource handles this)

3.3 Chat Memory & Context (✅ IMPLEMENTED)
 * **Rolling Conversation Window**: Last 6 messages (3 turns) preserved per user
 * **Per-User Isolation**: Each Telegram user maintains separate conversation history
 * **Memory Cleanup**: Conversations idle >1 hour auto-pruned to prevent memory leaks
 * **Context-Aware Responses**: Station AIs remember prior conversation within session
 * **Prompt Structure**: System prompt + history + new message sent to LLM

3.4 Performance Optimizations (✅ IMPLEMENTED)
 * **In-Memory Location Cache (USER_LOCATIONS)**:
   * First message per user: 1-2s (Postgres query + cache)
   * Subsequent messages: <10ms (memory lookup)
   * 99% of messages avoid Neon cold-start latency
   * Cache updated on `/travel` movement
 * **Model Health Tracking**: Skip models with repeated failures
 * **Stale Context Pruning**: Background cleanup prevents memory leaks

3.5 Multi-Model Resiliency Pipeline (✅ IMPLEMENTED)
To prevent 429 FreeUsageLimitError bottlenecks on free inference tiers, spaceAI implements a **4-model rotation with health tracking and exponential backoff**:

**Model Rotation Order:**
1. **deepseek-v4-flash-free** (Primary) — Proven value leader, stable
2. **nemotron-3-ultra-free** (Secondary) — Frontier reasoning, 1M context
3. **ling-3.0-flash-free** (Tertiary) — Fast alternative
4. **qwen-2.5-72b-free** (Final) — Large model backup

**Resilience Features:**
- **Exponential Backoff**: 1s, 2s delays before rotating to next model
- **Health Tracking**: Skip models with >5 consecutive failures in last 5 minutes
- **Timeout Protection**: 8-second timeout per model attempt
- **Fallback Message**: Sci-fi styled "Relay Busy" notice after exhausting all models

**Performance Impact:**
- Rate-limit hit: Average 2-3s before successful rotation (vs. immediate failure)
- Model recovery: Failed models auto-rehabilitate after 5 minutes
- Cache optimization: In-memory location cache eliminates 1-2s DB latency per message
4. Technical Stack Specifications
| Layer | Technology Choice | Justification |
|---|---|---|
| Frontend Client | React 18, Three.js, React Three Fiber, Vite | Renders 3D Solar System models and orbits directly in browser |
| Web Server API | Express.js, TypeScript (:5000) | Serves API endpoints, manages production builds, proxies ML requests |
| Bot Service | Python 3.11, python-telegram-bot (spaceAI/bot.py) | Handles polling, /travel routes, and OpenAI SDK client execution |
| ML Engine | FastAPI, PyTest, Scikit-learn (spaceAI/src/predict.py) | Random Forest / SVC classification for orbital celestial telemetry |
| LLM Provider | OpenCode Zen Client (AsyncOpenAI) | Multi-model free tier inference engine for Station AI roleplay |
| Database | Neon PostgreSQL + Drizzle ORM | Serverless relational database for celestial bodies, player state, and chat logs |
| Static Deployment | Surge (system-3d.surge.sh) / Cloudflare Pages | Hosts high-performance static SPA client (npm run build:cf) |
5. Workflows & State Cycles
5.1 Player Location & Comms Flow
[User sends message in Telegram] ──► [Bot captures message & User ID]
                                                │
                                                ▼
                             [Fetch active location from USER_LOCATIONS / DB]
                                                │
                                                ▼
                             [Lookup Station AI persona & System Prompt]
                                                │
                                                ▼
                             [Execute LLM Call with Model Rotation Loop]
                                                │
                                                ▼
                             [Post formatted Markdown response to channel]

5.2 /travel Sector Navigation Flow
[User executes /travel moon] ──► [Bot validates destination against STATION_AIS]
                                                │
                                                ▼
                              [Update USER_LOCATIONS state in Postgres]
                                                │
                                                ▼
                              [Emit 'Trajectory Locked' narrative log]
                                                │
                                                ▼
                              [Web Client re-centers camera to 'moon.glb']


