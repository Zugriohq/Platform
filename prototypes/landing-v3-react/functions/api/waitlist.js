const ALLOWED = {
  role: new Set(["independent_trader","prop_trader","trading_team","researcher","broker_partner","investor"]),
  market: new Set(["fx","gold","synthetics","stocks","crypto","multiple"]),
  horizon: new Set(["scalping","intraday","swing","multiple"]),
  mode: new Set(["signal","semi_auto","auto","full_auto_interest"]),
  strategy: new Set(["price_action_structure","smc","supply_demand","breakout_momentum","other"]),
  platform: new Set(["desktop","mobile","both"]),
  discovery: new Set(["instagram","x","linkedin","friend","community","search","other"]),
};


function brevoReady(env) {
  return Boolean(
    env.BREVO_API_KEY &&
    env.BREVO_LIST_ID &&
    env.BREVO_WELCOME_TEMPLATE_ID &&
    env.BREVO_SENDER_EMAIL
  );
}

async function brevoRequest(env, pathname, init = {}) {
  const response = await fetch("https://api.brevo.com/v3" + pathname, {
    ...init,
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": env.BREVO_API_KEY,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error("brevo_http_" + response.status + (text ? ":" + text.slice(0, 240) : ""));
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function syncBrevoContact(env, profile) {
  const listId = Number(env.BREVO_LIST_ID);
  if (!Number.isInteger(listId) || listId < 1) throw new Error("brevo_list_id_invalid");

  await brevoRequest(env, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email: profile.email,
      listIds: [listId],
      updateEnabled: true,
    }),
  });
}

async function sendBrevoWelcome(env, profile) {
  const templateId = Number(env.BREVO_WELCOME_TEMPLATE_ID);
  if (!Number.isInteger(templateId) || templateId < 1) throw new Error("brevo_welcome_template_invalid");

  const sender = {
    name: env.BREVO_SENDER_NAME || "Zugrio",
    email: env.BREVO_SENDER_EMAIL,
  };

  const payload = {
    sender,
    to: [{ email: profile.email }],
    templateId,
    params: {
      MARKET: profile.market,
      HORIZON: profile.horizon,
      MODE: profile.mode,
    },
  };

  if (env.BREVO_REPLY_TO) payload.replyTo = { email: env.BREVO_REPLY_TO };

  return brevoRequest(env, "/smtp/email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function startEmailLifecycle(env, profile, waitlistId, nowIso) {
  if (!brevoReady(env)) return;

  try {
    await syncBrevoContact(env, profile);
    await env.DB.prepare(
      "UPDATE waitlist SET brevo_synced_at = ?, email_last_error = NULL WHERE id = ?"
    ).bind(nowIso, waitlistId).run();
  } catch (error) {
    console.error("brevo_contact_sync_failed", error?.message || String(error));
    await env.DB.prepare(
      "UPDATE waitlist SET email_last_error = ? WHERE id = ?"
    ).bind(("contact_sync:" + (error?.message || String(error))).slice(0, 500), waitlistId).run();
    return;
  }

  try {
    const result = await sendBrevoWelcome(env, profile);
    const messageId = result?.messageId ? String(result.messageId).slice(0, 200) : "";
    const nextAt = new Date(new Date(nowIso).getTime() + 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      `UPDATE waitlist
       SET welcome_sent_at = ?,
           email_sequence_step = 1,
           email_next_at = ?,
           email_last_error = NULL
       WHERE id = ?`
    ).bind(nowIso, nextAt, waitlistId).run();

    await env.DB.prepare(
      `INSERT INTO email_send_log
       (waitlist_id, email, template_key, provider_message_id, status, sent_at)
       VALUES (?, ?, 'EA00', ?, 'sent', ?)`
    ).bind(waitlistId, profile.email, messageId, nowIso).run();
  } catch (error) {
    console.error("brevo_welcome_failed", error?.message || String(error));
    await env.DB.prepare(
      "UPDATE waitlist SET email_last_error = ? WHERE id = ?"
    ).bind(("welcome:" + (error?.message || String(error))).slice(0, 500), waitlistId).run();
  }
}

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

  const source = optionalText(body.source, 80) || "landing-v4";
  const referrer = optionalText(body.referrer, 500);
  const utmSource = optionalText(body.utm_source, 100);
  const utmMedium = optionalText(body.utm_medium, 100);
  const utmCampaign = optionalText(body.utm_campaign, 160);

  try {
    const inserted = await env.DB
      .prepare(
        `INSERT OR IGNORE INTO waitlist (
          email, role, market, style, mode, strategy, platform,
          country, discovery,
          consent, consent_version, consent_at, source, referrer,
          utm_source, utm_medium, utm_campaign,
          created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        email, role, market, horizon, mode, strategy, platform,
        country, discovery,
        "waitlist-v1", now.toISOString(), source, referrer,
        utmSource, utmMedium, utmCampaign,
        now.toISOString(), now.toISOString(), expires.toISOString()
      )
      .run();

    if ((inserted?.meta?.changes || 0) > 0 && brevoReady(env)) {
      const row = await env.DB
        .prepare("SELECT id FROM waitlist WHERE email = ? COLLATE NOCASE")
        .bind(email)
        .first();

      if (row?.id) {
        // Email delivery is deliberately best-effort. D1 acceptance remains authoritative.
        await startEmailLifecycle(
          env,
          { email, market, horizon, mode },
          row.id,
          now.toISOString()
        );
      }
    }
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
