import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { aiCache, corrections, celestialBodies } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

let fallbackCache: Record<string, unknown> | null = null;

function loadFallbackCache(): Record<string, unknown> {
  if (fallbackCache) return fallbackCache;
  const jsonPath = path.resolve(import.meta.dirname, "..", "spaceAI", "data", "ai_cache.json");
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    fallbackCache = JSON.parse(raw);
    console.log(`[spaceai] loaded ${Object.keys(fallbackCache!).length} precomputed classifications (fallback)`);
  } catch {
    console.warn("[spaceai] no fallback cache file found, using empty cache");
    fallbackCache = {};
  }
  return fallbackCache!;
}

async function getAICache() {
  try {
    const rows = await db.select().from(aiCache);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.bodyId] = row;
    }
    return result;
  } catch {
    return null;
  }
}

export function registerRoutes(app: Express): Server {
  app.get("/api/health", async (_req, res) => {
    try {
      const result = await db.select({ count: sql<number>`count(*)::int` }).from(aiCache);
      res.json({ status: "ok", cached_bodies: result[0]?.count ?? 0 });
    } catch {
      const fallback = loadFallbackCache();
      res.json({ status: "ok", cached_bodies: Object.keys(fallback).length });
    }
  });

  app.get("/api/ai/precomputed", async (_req, res) => {
    const cached = await getAICache();
    if (cached) {
      res.json(cached);
    } else {
      res.json(loadFallbackCache());
    }
  });

  app.get("/api/ai/classify/:bodyId", async (req, res) => {
    try {
      const rows = await db.select().from(aiCache).where(eq(aiCache.bodyId, req.params.bodyId)).limit(1);
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.status(404).json(null);
      }
    } catch {
      const fallback = loadFallbackCache();
      const entry = fallback[req.params.bodyId];
      if (entry) {
        res.json(entry);
      } else {
        res.status(404).json(null);
      }
    }
  });

  app.post("/api/ai/correct", async (req, res) => {
    const { body_id, predicted_type, corrected_type, features, uncertainty } = req.body ?? {};
    if (!body_id || !corrected_type) {
      res.status(400).json({ error: "body_id and corrected_type required" });
      return;
    }
    try {
      await db.insert(corrections).values({
        bodyId: body_id,
        predictedType: predicted_type ?? "",
        correctedType: corrected_type,
        features: features ?? {},
        uncertainty: uncertainty ?? null,
        source: "user",
      });
      res.json({ status: "ok" });
    } catch (err) {
      console.error("[db] failed to save correction:", err);
      res.status(500).json({ error: "Failed to save correction" });
    }
  });

  app.post("/api/classify/:bodyId/correct", async (req, res) => {
    const bodyId = req.params.bodyId;
    const { predicted_type, corrected_type, features, uncertainty } = req.body ?? {};
    if (!corrected_type) {
      res.status(400).json({ error: "corrected_type required" });
      return;
    }
    try {
      await db.insert(corrections).values({
        bodyId,
        predictedType: predicted_type ?? "",
        correctedType: corrected_type,
        features: features ?? {},
        uncertainty: uncertainty ?? null,
        source: "user",
      });
      res.json({ status: "ok" });
    } catch (err) {
      console.error("[db] failed to save correction:", err);
      res.status(500).json({ error: "Failed to save correction" });
    }
  });

  app.get("/api/bodies", async (_req, res) => {
    try {
      const bodies = await db.select().from(celestialBodies).orderBy(celestialBodies.name);
      res.json(bodies);
    } catch (err) {
      console.error("[db] failed to fetch celestial bodies:", err);
      res.status(500).json({ error: "Failed to fetch celestial bodies" });
    }
  });

  app.get("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const rows = await db.select().from(celestialBodies).where(eq(celestialBodies.id, id)).limit(1);
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.status(404).json({ error: "Body not found" });
      }
    } catch (err) {
      console.error("[db] failed to fetch celestial body:", err);
      res.status(500).json({ error: "Failed to fetch celestial body" });
    }
  });

  app.post("/api/bodies", async (req, res) => {
    const { name, type, mass, radius, density, gravity, temperature, orbitalPeriod, semiMajorAxis, eccentricity, inclination, rotationPeriod, axialTilt, aiClassification, aiConfidenceScore } = req.body ?? {};
    if (!name || !type) {
      res.status(400).json({ error: "name and type required" });
      return;
    }
    try {
      const rows = await db.insert(celestialBodies).values({ name, type, mass, radius, density, gravity, temperature, orbitalPeriod, semiMajorAxis, eccentricity, inclination, rotationPeriod, axialTilt, aiClassification, aiConfidenceScore }).returning();
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[db] failed to create celestial body:", err);
      res.status(500).json({ error: "Failed to create celestial body" });
    }
  });

  app.patch("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const allowedColumns = ["name", "type", "mass", "radius", "density", "gravity", "temperature", "orbitalPeriod", "semiMajorAxis", "eccentricity", "inclination", "rotationPeriod", "axialTilt", "aiClassification", "aiConfidenceScore"];
    const updates: Record<string, unknown> = {};
    for (const col of allowedColumns) {
      if (req.body[col] !== undefined) {
        updates[col] = req.body[col];
      }
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    try {
      const rows = await db.update(celestialBodies).set(updates).where(eq(celestialBodies.id, id)).returning();
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.status(404).json({ error: "Body not found" });
      }
    } catch (err) {
      console.error("[db] failed to update celestial body:", err);
      res.status(500).json({ error: "Failed to update celestial body" });
    }
  });

  app.delete("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const rows = await db.delete(celestialBodies).where(eq(celestialBodies.id, id)).returning();
      if (rows.length > 0) {
        res.json({ status: "ok", deleted: rows[0] });
      } else {
        res.status(404).json({ error: "Body not found" });
      }
    } catch (err) {
      console.error("[db] failed to delete celestial body:", err);
      res.status(500).json({ error: "Failed to delete celestial body" });
    }
  });

  return createServer(app);
}
