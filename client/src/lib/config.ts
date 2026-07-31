/**
 * Client-side API configuration.
 *
 * All API calls use relative `/api/...` paths so no base URL is needed.
 * In development, Vite proxies `/api` → `localhost:5000` (Express).
 * In production, the same origin serves both the frontend and the API.
 */

/** Root prefix for every API request. */
export const API_BASE = "/api" as const;

/** AI classification endpoints. */
export const AI_ENDPOINTS = {
  precomputed: `${API_BASE}/ai/precomputed`,
  classify: (bodyId: string) => `${API_BASE}/ai/classify/${bodyId}`,
  correct: `${API_BASE}/ai/correct`,
} as const;
