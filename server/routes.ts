import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { aiCache, corrections, celestialBodies } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const SPACEAI_URL      = process.env.SPACEAI_URL ?? "http://127.0.0.1:8000";
const PROXY_TIMEOUT_MS = 10_000;

// ── Helpers ────────────────────────────────────────────────────────────────

async function getAICache(): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db.select().from(aiCache);
    return Object.fromEntries(rows.map((r) => [r.bodyId, r]));
  } catch {
    return null;
  }
}

async function proxyToFastAI(req: Request, res: Response, endpoint: string): Promise<void> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${SPACEAI_URL}${endpoint}`, { signal: controller.signal });
    const data     = await upstream.json();
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
}

/**
 * Core correction handler — saves to Postgres and forwards to FastAPI.
 * Used by both POST /api/ai/correct and POST /api/classify/:bodyId/correct.
 */
async function handleCorrection(
  bodyId: string,
  body: Record<string, unknown>,
  res: Response,
): Promise<void> {
  const { predicted_type, corrected_type, features, uncertainty } = body;

  if (!corrected_type) {
    res.status(400).json({ error: "corrected_type required" });
    return;
  }

  try {
    await db.insert(corrections).values({
      bodyId,
      predictedType: (predicted_type as string) ?? "",
      correctedType: corrected_type as string,
      features:      (features as object) ?? {},
      uncertainty:   (uncertainty as number) ?? null,
      source:        "user",
    });
  } catch (err) {
    console.error("[db] failed to save correction:", err);
  }

  // Forward to FastAPI so retrain incorporates it — fail silently if offline
  try {
    await fetch(`${SPACEAI_URL}/classify/${bodyId}/correct`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
  } catch { /* FastAPI may be offline */ }

  res.json({ status: "ok" });
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerRoutes(app: Express): Server {

  app.get("/api/health", async (_req, res) => {
    try {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(aiCache);
      res.json({ status: "ok", cached_bodies: count ?? 0 });
    } catch {
      res.json({ status: "ok", cached_bodies: 0 });
    }
  });

  app.get("/api/ai/precomputed", async (req, res) => {
    const cached = await getAICache();
    if (cached && Object.keys(cached).length > 0) {
      res.json(cached);
    } else {
      // No DB cache — proxy directly to FastAPI
      await proxyToFastAI(req, res, "/precomputed");
    }
  });

  app.get("/api/ai/classify/:bodyId", async (req, res) => {
    try {
      const rows = await db.select().from(aiCache)
        .where(eq(aiCache.bodyId, req.params.bodyId))
        .limit(1);
      if (rows.length > 0) {
        res.json(rows[0]);
        return;
      }
    } catch { /* fall through to proxy */ }
    const params = req.query.toString();
    await proxyToFastAI(req, res, `/classify/${req.params.bodyId}?${params}`);
  });

  // POST /api/ai/correct  (used by AIClassificationPanel)
  app.post("/api/ai/correct", async (req, res) => {
    const bodyId = (req.body?.body_id as string) ?? "";
    if (!bodyId) {
      res.status(400).json({ error: "body_id required" });
      return;
    }
    await handleCorrection(bodyId, req.body ?? {}, res);
  });

  // POST /api/classify/:bodyId/correct  (mirrors FastAPI endpoint path)
  app.post("/api/classify/:bodyId/correct", async (req, res) => {
    await handleCorrection(req.params.bodyId, req.body ?? {}, res);
  });

  // ── Celestial bodies CRUD ────────────────────────────────────────────────

  app.get("/api/bodies", async (_req, res) => {
    try {
      res.json(await db.select().from(celestialBodies).orderBy(celestialBodies.name));
    } catch (err) {
      console.error("[db] failed to fetch celestial bodies:", err);
      res.status(500).json({ error: "Failed to fetch celestial bodies" });
    }
  });

  app.get("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    try {
      const rows = await db.select().from(celestialBodies)
        .where(eq(celestialBodies.id, id)).limit(1);
      rows.length > 0
        ? res.json(rows[0])
        : res.status(404).json({ error: "Body not found" });
    } catch (err) {
      console.error("[db] failed to fetch celestial body:", err);
      res.status(500).json({ error: "Failed to fetch celestial body" });
    }
  });

  app.post("/api/bodies", async (req, res) => {
    const { name, type } = req.body ?? {};
    if (!name || !type) {
      res.status(400).json({ error: "name and type required" });
      return;
    }
    try {
      const rows = await db.insert(celestialBodies).values(req.body).returning();
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[db] failed to create celestial body:", err);
      res.status(500).json({ error: "Failed to create celestial body" });
    }
  });

  app.patch("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const ALLOWED = new Set([
      "name","type","mass","radius","density","gravity","temperature",
      "orbitalPeriod","semiMajorAxis","eccentricity","inclination",
      "rotationPeriod","axialTilt","aiClassification","aiConfidenceScore",
    ]);
    const updates = Object.fromEntries(
      Object.entries(req.body ?? {}).filter(([k]) => ALLOWED.has(k))
    );
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    try {
      const rows = await db.update(celestialBodies).set(updates)
        .where(eq(celestialBodies.id, id)).returning();
      rows.length > 0
        ? res.json(rows[0])
        : res.status(404).json({ error: "Body not found" });
    } catch (err) {
      console.error("[db] failed to update celestial body:", err);
      res.status(500).json({ error: "Failed to update celestial body" });
    }
  });

  app.delete("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    try {
      const rows = await db.delete(celestialBodies)
        .where(eq(celestialBodies.id, id)).returning();
      rows.length > 0
        ? res.json({ status: "ok", deleted: rows[0] })
        : res.status(404).json({ error: "Body not found" });
    } catch (err) {
      console.error("[db] failed to delete celestial body:", err);
      res.status(500).json({ error: "Failed to delete celestial body" });
    }
  });

  return createServer(app);
}
