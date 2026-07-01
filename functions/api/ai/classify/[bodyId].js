const PROXY_TIMEOUT_MS = 10_000;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const bodyId = url.pathname.split("/").pop();
  const params = url.searchParams.toString();
  const cacheKey = `${bodyId}?${params}`;

  const spaceaiUrl = env.SPACEAI_URL || null;

  if (!spaceaiUrl) {
    return new Response(
      JSON.stringify({ error: "AI service not configured (set SPACEAI_URL env)" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const upstream = await fetch(
      `${spaceaiUrl}/classify/${bodyId}${params ? "?" + params : ""}`,
      { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) },
    );
    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = err?.name === "TimeoutError" ? 504 : 503;
    const message = status === 504 ? "AI service timed out" : "AI service unavailable";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
