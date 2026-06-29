import type { Express } from "express";
import { createServer, type Server } from "http";

const SPACEAI_URL = process.env.SPACEAI_URL ?? "http://localhost:8000";
const PROXY_TIMEOUT_MS = 10_000;
const cache = new Map<string, unknown>();

export async function registerRoutes(app: Express): Promise<Server> {
  console.log(`[spaceai] proxy target: ${SPACEAI_URL}`);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ai/classify/:bodyId", async (req, res) => {
    // Safely forward only string query params — drop arrays/objects
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") params.set(k, v);
    }

    const cacheKey = `${req.params.bodyId}?${params}`;
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const upstream = await fetch(
        `${SPACEAI_URL}/classify/${req.params.bodyId}?${params}`,
        { signal: controller.signal }
      );
      const data = await upstream.json();
      if (upstream.ok) cache.set(cacheKey, data);
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
