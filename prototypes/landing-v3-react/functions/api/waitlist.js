const ALLOWED = {
  role: new Set(["independent_trader","prop_trader","trading_team","researcher","broker_partner","investor"]),
  market: new Set(["fx","gold","synthetics","stocks","crypto","multiple"]),
  horizon: new Set(["scalping","intraday","swing","multiple"]),
  mode: new Set(["signal","semi_auto","auto","full_auto_interest"]),
  strategy: new Set(["price_action_apa","smc","ict","qmr","other"]),
  platform: new Set(["desktop","mobile","both"]),
  discovery: new Set(["instagram","x","linkedin","friend","community","search","other"]),
};

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

function isEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function optionalText(value, max = 300) {
  return clean(value, max);
}

async function verifyTurnstile(env, request, token) {
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  form.set("idempotency_key", crypto.randomUUID());

  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form }
  );

  if (!response.ok) return { success: false, "error-codes": ["siteverify-http-error"] };

  const result = await response.json();
  if (result.action && result.action !== "waitlist") {
    return { success: false, "error-codes": ["action-mismatch"] };
  }

  const allowedHostnames = clean(env.TURNSTILE_HOSTNAMES, 500)
    .split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if (
    result.success &&
    allowedHostnames.length &&
    (!result.hostname || !allowedHostnames.includes(String(result.hostname).toLowerCase()))
  ) {
    return { success: false, "error-codes": ["hostname-mismatch"] };
  }

  return result;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB || !env.TURNSTILE_SECRET) {
    return json({ ok: false, status: "unavailable" }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 20000) {
    return json({ ok: false, status: "invalid" }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, status: "invalid" }, 400);
  }

  if (body.company) {
    // Honeypot: do not reveal detection behavior.
    return json({ ok: true, status: "accepted" });
  }

  const email = clean(body.email, 254).toLowerCase();
  const role = clean(body.role);
  const market = clean(body.market);
  const horizon = clean(body.horizon);
  const mode = clean(body.mode);
  const strategy = clean(body.strategy);
  const platform = clean(body.platform);
  const country = clean(body.country, 80);
  const discovery = clean(body.discovery);
  const token = clean(body.token, 2048);

  if (
    !isEmail(email) ||
    !ALLOWED.role.has(role) ||
    !ALLOWED.market.has(market) ||
    !ALLOWED.horizon.has(horizon) ||
    !ALLOWED.mode.has(mode) ||
    !ALLOWED.strategy.has(strategy) ||
    !ALLOWED.platform.has(platform) ||
    country.length < 2 ||
    !ALLOWED.discovery.has(discovery) ||
    body.consent !== true ||
    !token
  ) {
    return json({ ok: false, status: "invalid" }, 400);
  }

  const turnstile = await verifyTurnstile(env, request, token);
  if (!turnstile.success) {
    return json({ ok: false, status: "challenge_failed" }, 400);
  }

  const now = new Date();
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const id = crypto.randomUUID();
  const source = optionalText(body.source, 80) || "landing-v3";
  const referrer = optionalText(body.referrer, 500);
  const utmSource = optionalText(body.utm_source, 100);
  const utmMedium = optionalText(body.utm_medium, 100);
  const utmCampaign = optionalText(body.utm_campaign, 160);

  try {
    await env.DB
      .prepare(
        `INSERT OR IGNORE INTO waitlist_signups (
          id, email, role, market, horizon, mode, strategy, platform,
          country, discovery,
          consent, consent_version, consent_at, source, referrer,
          utm_source, utm_medium, utm_campaign,
          created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id, email, role, market, horizon, mode, strategy, platform,
        country, discovery,
        "waitlist-v1", now.toISOString(), source, referrer,
        utmSource, utmMedium, utmCampaign,
        now.toISOString(), expires.toISOString()
      )
      .run();
  } catch (error) {
    console.error("waitlist_insert_failed", error?.message || String(error));
    return json({ ok: false, status: "unavailable" }, 503);
  }

  // Deliberately return the same accepted response for first-time and duplicate emails.
  return json({ ok: true, status: "accepted" }, 200);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, status: "method_not_allowed" }, 405);
}
