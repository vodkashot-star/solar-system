import { aiCache } from "./data.js";

const corrections = [];

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname.endsWith("/corrections")) {
    return new Response(JSON.stringify(corrections), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { body_id, correction_type, user_label } = body;
      if (!body_id || !correction_type) {
        return new Response(
          JSON.stringify({ error: "body_id and correction_type required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const entry = {
        id: corrections.length + 1,
        body_id,
        correction_type,
        user_label: user_label || null,
        timestamp: new Date().toISOString(),
      };
      corrections.push(entry);
      return new Response(JSON.stringify({ status: "ok", id: entry.id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
