import { aiCache } from "../data.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const bodyId = url.pathname.split("/").pop();
  const entry = aiCache[bodyId];

  if (!entry) {
    return new Response(JSON.stringify({ error: `Unknown body: ${bodyId}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(entry), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
