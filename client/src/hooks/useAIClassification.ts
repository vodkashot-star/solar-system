import { useState, useEffect } from "react";
import type { Body, AIAnalysis } from "@/components/solar-system/bodies";
import { AI_ENDPOINTS } from "@/lib/config";

/**
 * Manages AI classification data for solar system bodies.
 *
 * On mount it fetches the bulk pre-computed results from the precomputed
 * endpoint. Whenever `activeBody` changes it fetches a per-body
 * classification if one is not already cached, building up the cache
 * incrementally.
 *
 * All network errors are swallowed — the AI service is optional and the app
 * should continue to work without it.
 */
export function useAIClassification(activeBody: Body): Record<string, AIAnalysis> {
  const [aiCache, setAiCache] = useState<Record<string, AIAnalysis>>({});

  // One-time bulk fetch of pre-computed results.
  useEffect(() => {
    fetch(AI_ENDPOINTS.precomputed)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Record<string, AIAnalysis> | null) => {
        if (data) setAiCache(data);
      })
      .catch(() => {
        // AI service offline — fail silently.
      });
  }, []);

  // Per-body fetch when the active body changes and is not yet cached.
  useEffect(() => {
    if (aiCache[activeBody.id]) return;

    const {
      orbitalPeriod,
      axialTilt,
      mass,
      radius,
      eccentricity,
      density,
      gravity,
      temperature,
      semiMajorAxis,
      inclination,
      rotationPeriod,
    } = activeBody.properties;

    const params = new URLSearchParams({
      orbital_period: String(orbitalPeriod),
      axial_tilt: String(axialTilt),
      mass: String(mass),
      radius: String(radius),
      eccentricity: String(eccentricity),
      density: String(density),
      gravity: String(gravity),
      temperature: String(temperature),
      semi_major_axis: String(semiMajorAxis),
      inclination: String(inclination),
      rotation_period: String(rotationPeriod),
    });

    fetch(`${AI_ENDPOINTS.classify(activeBody.id)}?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AIAnalysis | null) => {
        if (data) setAiCache((prev) => ({ ...prev, [activeBody.id]: data }));
      })
      .catch(() => {
        // AI service offline — fail silently.
      });
  }, [activeBody.id, activeBody.properties, aiCache]);

  return aiCache;
}
