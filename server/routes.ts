import type { Express } from "express";
import { createServer, type Server } from "http";

const SPACEAI_URL = process.env.SPACEAI_URL ?? "http://127.0.0.1:8000";
const PROXY_TIMEOUT_MS = 10_000;
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Periodic cache cleanup (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const expiredKeys: string[] = [];
  cache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      expiredKeys.push(key);
    }
  });
  expiredKeys.forEach(key => cache.delete(key));
}, 10 * 60 * 1000);

export async function registerRoutes(app: Express): Promise<Server> {
  console.log(`[spaceai] proxy target: ${SPACEAI_URL}`);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/ai/correct", async (req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    try {
      const upstream = await fetch(`${SPACEAI_URL}/classify/${req.body.body_id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        res.status(504).json({ error: "AI service timed out" });
      } else {
        res.status(503).json({ error: "AI service unavailable" });
      }
    } finally {
      clearTimeout(timer);
    }
  });

  app.get("/api/ai/precomputed", async (_req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    try {
      const upstream = await fetch(`${SPACEAI_URL}/precomputed`, {
        signal: controller.signal,
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        res.status(504).json({ error: "AI service timed out" });
      } else {
        res.status(503).json({ error: "AI service unavailable" });
      }
    } finally {
      clearTimeout(timer);
    }
  });

  app.get("/api/ai/classify/:bodyId", async (req, res) => {
    // Safely forward only string query params — drop arrays/objects
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") params.set(k, v);
    }

    const cacheKey = `${req.params.bodyId}?${params}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      return res.json(cachedEntry.data);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const upstream = await fetch(
        `${SPACEAI_URL}/classify/${req.params.bodyId}?${params}`,
        { signal: controller.signal }
      );
      const data = await upstream.json();
      if (upstream.ok) cache.set(cacheKey, { data, timestamp: Date.now() });
      res.status(upstream.status).json(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        res.status(504).json({ error: "AI service timed out" });
      } else {
        res.status(503).json({ error: "AI service unavailable" });
      }
    } finally {
      clearTimeout(timer);
    }
  });

  return createServer(app);
}
