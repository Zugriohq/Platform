import { verifyProfileToken } from "../_lib/waitlist-profile-token.js";

const ALLOWED_MARKETS = new Set(["fx", "gold", "synthetics", "multiple"]);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clean(value, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, status: "unavailable" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, status: "invalid" }, 400);
  }

  const token = clean(body.profileToken, 4096);
  const market = clean(body.market);
  const verified = await verifyProfileToken(env, token);

  if (!verified || !ALLOWED_MARKETS.has(market)) {
    return json({ ok: false, status: "invalid" }, 400);
  }

  try {
    await env.DB.prepare(
      "UPDATE waitlist SET market = ?, updated_at = ? WHERE email = ? COLLATE NOCASE"
    ).bind(market, new Date().toISOString(), String(verified.email).toLowerCase()).run();
  } catch (error) {
    console.error("waitlist_segment_update_failed", error?.message || String(error));
    return json({ ok: false, status: "unavailable" }, 503);
  }

  // Same response whether or not a matching row existed.
  return json({ ok: true, status: "accepted" }, 200);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, status: "method_not_allowed" }, 405);
}
