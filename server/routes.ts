import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";

let precomputedCache: Record<string, unknown> | null = null;

function loadPrecomputed(): Record<string, unknown> {
  if (precomputedCache) return precomputedCache!;
  const jsonPath = path.resolve(import.meta.dirname, "..", "spaceAI", "data", "ai_cache.json");
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    precomputedCache = JSON.parse(raw);
    console.log(`[spaceai] loaded ${Object.keys(precomputedCache!).length} precomputed classifications`);
  } catch (err) {
    console.error("[spaceai] failed to load ai_cache.json:", err);
    precomputedCache = {};
  }
  return precomputedCache!;
}

const corrections: Array<{
  bodyId: string;
  predictedType: string;
  correctedType: string;
  timestamp: number;
}> = [];

export function registerRoutes(app: Express): Server {
  const precomputed = loadPrecomputed();

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", cached_bodies: Object.keys(precomputed).length });
  });

  app.get("/api/ai/precomputed", (_req, res) => {
    res.json(precomputed);
  });

  app.get("/api/ai/classify/:bodyId", (req, res) => {
    const entry = precomputed[req.params.bodyId];
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json(null);
    }
  });

  app.post("/api/ai/correct", (req, res) => {
    const { body_id, predicted_type, corrected_type } = req.body ?? {};
    if (!body_id || !corrected_type) {
      res.status(400).json({ error: "body_id and corrected_type required" });
      return;
    }
    corrections.push({
      bodyId: body_id,
      predictedType: predicted_type ?? "",
      correctedType: corrected_type,
      timestamp: Date.now(),
    });
    res.json({ status: "ok" });
  });

  app.post("/api/classify/:bodyId/correct", (req, res) => {
    const bodyId = req.params.bodyId;
    const { predicted_type, corrected_type } = req.body ?? {};
    if (!corrected_type) {
      res.status(400).json({ error: "corrected_type required" });
      return;
    }
    corrections.push({
      bodyId,
      predictedType: predicted_type ?? "",
      correctedType: corrected_type,
      timestamp: Date.now(),
    });
    res.json({ status: "ok" });
  });

  return createServer(app);
}
