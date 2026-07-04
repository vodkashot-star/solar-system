import { aiCache } from "../ai/data.js";

export async function onRequest(context) {
  const bodyCount = Object.keys(aiCache).length;
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "spaceai",
      cached_bodies: bodyCount,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
