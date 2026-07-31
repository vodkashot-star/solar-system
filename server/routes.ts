import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { aiCache, corrections, celestialBodies } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const SPACEAI_URL      = process.env.SPACEAI_URL ?? "http://127.0.0.1:8000";
const PROXY_TIMEOUT_MS = 10_000;

// ── File-based cache fallback ──────────────────────────────────────────────
// FastAPI's precompute step writes spaceAI/data/ai_cache.json. Load it once at
// startup so classification endpoints work even when both Postgres and
// FastAPI (:8000) are offline.
const FILE_CACHE_PATH = path.resolve(process.cwd(), "spaceAI/data/ai_cache.json");

function loadFileCache(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(FILE_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`[cache] Unexpected shape in ${FILE_CACHE_PATH}`);
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error(`[cache] Failed to load ${FILE_CACHE_PATH}:`, err);
    }
    return {};
  }
}

const FILE_CACHE = loadFileCache();
const FILE_CACHE_COUNT = Object.keys(FILE_CACHE).length;
if (FILE_CACHE_COUNT > 0) {
  console.log(`[cache] Loaded ${FILE_CACHE_COUNT} classifications from ${FILE_CACHE_PATH}`);
}

// ── Pending corrections queue ──────────────────────────────────────────────
// Corrections are forwarded to FastAPI so retrain can use them. When FastAPI
// is offline the correction is queued to disk; FastAPI drains the queue on
// startup, so no correction is ever orphaned in Postgres only.
const PENDING_CORRECTIONS_PATH = path.resolve(
  process.cwd(),
  "spaceAI/data/pending_corrections.json",
);

function queuePendingCorrection(bodyId: string, body: Record<string, unknown>): void {
  try {
    let pending: Array<Record<string, unknown>> = [];
    if (fs.existsSync(PENDING_CORRECTIONS_PATH)) {
      const raw = fs.readFileSync(PENDING_CORRECTIONS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) pending = parsed;
    }
    pending.push({ body_id: bodyId, ...body, queued_at: new Date().toISOString() });
    fs.writeFileSync(
      PENDING_CORRECTIONS_PATH,
      JSON.stringify(pending, null, 2) + "\n",
      "utf-8",
    );
    console.log(`[corrections] FastAPI offline — queued correction for ${bodyId}`);
  } catch (err) {
    console.error("[corrections] Failed to queue pending correction:", err);
  }
}

function mergeCacheSources(...sources: Array<Record<string, unknown> | null>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [bodyId, entry] of Object.entries(source)) {
      if (!(bodyId in merged)) merged[bodyId] = entry;
    }
  }
  return merged;
}

// ── Taxonomy auto-sync ──────────────────────────────────────────────────────

const TAXONOMY_PATH = path.resolve(process.cwd(), "spaceAI/data/solar_system.json");

const VALID_CATEGORIES = new Set([
  "Star", "Planet", "DwarfPlanet", "Asteroid", "Comet", "Interstellar", "Moon", "Spacecraft",
]);

const ID_TO_TAXONOMY_NAME: Record<string, string> = {
  "io":              "Io",
  "oumuamua":        "1I/'Oumuamua",
  "borisov":         "2I/Borisov",
  "churyumov":       "67P/Churyumov-Gerasimenko",
  "tempel1":         "9P/Tempel 1",
  "wild2":           "81P/Wild 2",
  "hubble":          "Hubble",
  "jwst":            "JWST",
  "apollo-lm":       "Apollo Lunar Module",
  "voyager":         "Voyager",
  "voyager-2":       "Voyager2",
  "juno":            "Juno",
  "juno-spacecraft": "Juno",
};

// Disambiguate entries with identical names (asteroid Juno vs spacecraft Juno)
const ID_TO_EXPECTED_CATEGORY: Record<string, string> = {
  "juno":            "Asteroid",
  "juno-spacecraft": "Spacecraft",
};

/** Update the body's category in spaceAI/data/solar_system.json. Failures are non-fatal. */
function syncTaxonomyToJson(bodyId: string, correctedType: string): void {
  if (!VALID_CATEGORIES.has(correctedType)) {
    console.warn(`[taxonomy] Invalid category "${correctedType}" — skipping`);
    return;
  }
  try {
    const name = ID_TO_TAXONOMY_NAME[bodyId] ??
      bodyId.charAt(0).toUpperCase() + bodyId.slice(1);

    if (!fs.existsSync(TAXONOMY_PATH)) {
      console.warn(`[taxonomy] File not found: ${TAXONOMY_PATH}`);
      return;
    }

    const raw     = fs.readFileSync(TAXONOMY_PATH, "utf-8");
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) { console.warn("[taxonomy] Expected array"); return; }

    const expectedCategory = ID_TO_EXPECTED_CATEGORY[bodyId];
    let updated = false;

    for (const entry of entries) {
      if (entry.name !== name) continue;
      if (expectedCategory && entry.category !== expectedCategory) continue;
      entry.category = correctedType;
      updated = true;
      break;
    }

    if (!updated) {
      console.warn(`[taxonomy] No entry found for body_id="${bodyId}" (name="${name}")`);
      return;
    }

    fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
    console.log(`[taxonomy] Synced ${bodyId} → ${correctedType}`);
  } catch (err) {
    console.error("[taxonomy] Sync failed:", err);
  }
}

// Static fallback classifications for known spacecraft that may not have
// precomputed entries in the ai_cache DB table. These prevent a 503 when
// the FastAPI backend (:8000) is offline.
const STATIC_CLASSIFICATIONS: Record<string, {
  classification: string;
  confidence: number;
  alternatives: { type: string; score: number }[];
  features: { name: string; value: number; importance: number }[];
  similarObjects: { bodyId: string; similarity: number }[];
}> = {
  "apollo-lm": {
    classification: "Spacecraft",
    confidence: 0.92,
    alternatives: [{ type: "Lander", score: 0.08 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "huygens", similarity: 0.65 }],
  },
  "new-horizons": {
    classification: "Spacecraft",
    confidence: 0.95,
    alternatives: [{ type: "Flyby Spacecraft", score: 0.05 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "voyager", similarity: 0.82 }],
  },
  "juno-spacecraft": {
    classification: "Spacecraft",
    confidence: 0.93,
    alternatives: [{ type: "Orbiter", score: 0.07 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "cassini", similarity: 0.78 }],
  },
  "voyager": {
    classification: "Spacecraft",
    confidence: 0.97,
    alternatives: [{ type: "Interstellar Probe", score: 0.03 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "voyager-2", similarity: 0.95 }],
  },
  "voyager-2": {
    classification: "Spacecraft",
    confidence: 0.97,
    alternatives: [{ type: "Interstellar Probe", score: 0.03 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "voyager", similarity: 0.95 }],
  },
  "cassini": {
    classification: "Spacecraft",
    confidence: 0.94,
    alternatives: [{ type: "Orbiter", score: 0.06 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "juno-spacecraft", similarity: 0.78 }],
  },
  "huygens": {
    classification: "Spacecraft",
    confidence: 0.91,
    alternatives: [{ type: "Atmospheric Probe", score: 0.09 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "apollo-lm", similarity: 0.65 }],
  },
  "perseverance": {
    classification: "Spacecraft",
    confidence: 0.96,
    alternatives: [{ type: "Rover", score: 0.04 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "curiosity", similarity: 0.88 }],
  },
  "curiosity": {
    classification: "Spacecraft",
    confidence: 0.96,
    alternatives: [{ type: "Rover", score: 0.04 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "perseverance", similarity: 0.88 }],
  },
};

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

  // Auto-sync the corrected type to solar_system.json
  syncTaxonomyToJson(bodyId, corrected_type as string);

  // Forward to FastAPI so retrain incorporates it — queue to disk if offline
  try {
    const upstream = await fetch(`${SPACEAI_URL}/classify/${bodyId}/correct`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    if (!upstream.ok) queuePendingCorrection(bodyId, body);
  } catch {
    queuePendingCorrection(bodyId, body);
  }

  res.json({ status: "ok" });
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerRoutes(app: Express): Server {

  app.get("/api/health", async (_req, res) => {
    try {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(aiCache);
      res.json({ status: "ok", cached_bodies: (count ?? 0) + FILE_CACHE_COUNT });
    } catch {
      res.json({ status: "ok", cached_bodies: FILE_CACHE_COUNT });
    }
  });

  app.get("/api/ai/precomputed", async (req, res) => {
    const cached = await getAICache();
    // Merge DB → file cache → static fallbacks so known spacecraft always
    // appear and the bulk endpoint works with FastAPI offline.
    const merged = mergeCacheSources(cached, FILE_CACHE);
    for (const [bodyId, entry] of Object.entries(STATIC_CLASSIFICATIONS)) {
      if (!(bodyId in (merged ?? {}))) {
        (merged as Record<string, unknown>)[bodyId] = {
          bodyId,
          classification: entry.classification,
          confidence: entry.confidence,
          alternatives: entry.alternatives,
          features: entry.features,
          similarObjects: entry.similarObjects,
        };
      }
    }
    if (Object.keys(merged).length > 0) {
      res.json(merged);
    } else {
      // No cache anywhere — proxy directly to FastAPI
      await proxyToFastAI(req, res, "/precomputed");
    }
  });

  app.get("/api/ai/classify/:bodyId", async (req, res) => {
    const bodyId = req.params.bodyId;
    try {
      const rows = await db.select().from(aiCache)
        .where(eq(aiCache.bodyId, bodyId))
        .limit(1);
      if (rows.length > 0) {
        res.json(rows[0]);
        return;
      }
    } catch { /* fall through to static or proxy */ }

    // File cache fallback (precompute output) when DB has no entry
    if (bodyId in FILE_CACHE) {
      res.json({ bodyId, ...FILE_CACHE[bodyId] as object });
      return;
    }

    // Static fallback for known spacecraft when DB has no entry
    if (bodyId in STATIC_CLASSIFICATIONS) {
      const entry = STATIC_CLASSIFICATIONS[bodyId];
      res.json({
        bodyId,
        classification: entry.classification,
        confidence: entry.confidence,
        alternatives: entry.alternatives,
        features: entry.features,
        similarObjects: entry.similarObjects,
      });
      return;
    }

    const params = req.query.toString();
    await proxyToFastAI(req, res, `/classify/${bodyId}?${params}`);
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
