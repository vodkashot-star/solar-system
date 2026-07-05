const corrections = [];

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const bodyId = url.pathname.split("/").filter(Boolean).at(-2);

  if (request.method === "GET") {
    return new Response(JSON.stringify(corrections), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { predicted_type, corrected_type } = body;
      if (!corrected_type) {
        return new Response(
          JSON.stringify({ error: "corrected_type required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const entry = {
        id: corrections.length + 1,
        body_id: bodyId,
        predicted_type: predicted_type || null,
        corrected_type,
        features: body.features || [],
        uncertainty: body.uncertainty ?? 0,
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
