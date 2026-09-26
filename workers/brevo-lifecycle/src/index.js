const DAY = 24 * 60 * 60 * 1000;

const STEPS = {
  1: { key: "EA01", envKey: "BREVO_TEMPLATE_EA01", nextStep: 2, delayDays: 2 },
  2: { key: "EA02", envKey: "BREVO_TEMPLATE_EA02", nextStep: 3, delayDays: 3 },
  3: { key: "EA03", envKey: "BREVO_TEMPLATE_EA03", nextStep: 4, delayDays: 4 },
  4: { key: "EA04", envKey: "BREVO_TEMPLATE_EA04", nextStep: 5, delayDays: 4 },
  5: { key: "EA05", envKey: "BREVO_TEMPLATE_EA05", nextStep: 6, delayDays: null },
};

function brevoHeaders(env) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": env.BREVO_API_KEY,
  };
}

async function brevo(env, path, init = {}) {
  const response = await fetch("https://api.brevo.com/v3" + path, {
    ...init,
    headers: { ...brevoHeaders(env), ...(init.headers || {}) },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error("brevo_http_" + response.status + (body ? ":" + body.slice(0, 240) : ""));
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function syncContact(env, email) {
  const listId = Number(env.BREVO_LIST_ID);
  if (!Number.isInteger(listId) || listId < 1) throw new Error("brevo_list_id_invalid");

  await brevo(env, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
    }),
  });
}

async function isBlacklisted(env, email) {
  const encoded = encodeURIComponent(email);
  const contact = await brevo(env, "/contacts/" + encoded + "?identifierType=email_id");
  return Boolean(contact?.emailBlacklisted);
}

async function sendTemplate(env, row, templateId, templateKey) {
  const payload = {
    sender: {
      name: env.BREVO_SENDER_NAME || "Zugrio",
      email: env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: row.email }],
    templateId,
    params: {
      MARKET: row.market,
      HORIZON: row.style,
      MODE: row.mode,
      COUNTRY: row.country,
    },
    tags: ["zugrio-early-access", templateKey.toLowerCase()],
  };

  if (env.BREVO_REPLY_TO) payload.replyTo = { email: env.BREVO_REPLY_TO };

  return brevo(env, "/smtp/email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function recoverMissingWelcomes(env, now, limit) {
  if (String(env.BREVO_EA00_RECOVERY_ENABLED || "").toLowerCase() !== "true") return 0;
  if (limit < 1) return 0;

  const templateId = Number(env.BREVO_WELCOME_TEMPLATE_ID);
  if (!Number.isInteger(templateId) || templateId < 1) {
    console.log("ea00_recovery_missing_template");
    return 0;
  }

  const rows = await env.DB.prepare(
    `SELECT id, email, market, style, mode, country
     FROM waitlist
     WHERE consent = 1
       AND email_unsubscribed_at IS NULL
       AND welcome_sent_at IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM email_send_log
         WHERE email_send_log.waitlist_id = waitlist.id
           AND email_send_log.template_key = 'EA00'
           AND email_send_log.status = 'sent'
       )
     ORDER BY created_at ASC
     LIMIT ?`
  ).bind(Math.min(limit, 50)).all();

  let sent = 0;

  for (const row of rows.results || []) {
    try {
      await syncContact(env, row.email);
      await env.DB.prepare(
        "UPDATE waitlist SET brevo_synced_at = ?, email_last_error = NULL WHERE id = ?"
      ).bind(now.toISOString(), row.id).run();

      if (await isBlacklisted(env, row.email)) {
        await env.DB.prepare(
          `UPDATE waitlist
           SET email_unsubscribed_at = ?, email_next_at = NULL, email_last_error = NULL
           WHERE id = ?`
        ).bind(now.toISOString(), row.id).run();
        continue;
      }

      const result = await sendTemplate(env, row, templateId, "EA00");
      const messageId = result?.messageId ? String(result.messageId).slice(0, 200) : "";
      const nextAt = new Date(now.getTime() + DAY).toISOString();

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE waitlist
           SET welcome_sent_at = ?,
               email_sequence_step = 1,
               email_next_at = ?,
               email_last_error = NULL
           WHERE id = ?`
        ).bind(now.toISOString(), nextAt, row.id),
        env.DB.prepare(
          `INSERT INTO email_send_log
           (waitlist_id, email, template_key, provider_message_id, status, sent_at)
           VALUES (?, ?, 'EA00', ?, 'sent', ?)`
        ).bind(row.id, row.email, messageId, now.toISOString()),
      ]);

      sent += 1;
    } catch (error) {
      const message = (error?.message || String(error)).slice(0, 500);
      console.error("ea00_recovery_failed", row.id, message);

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE waitlist SET email_last_error = ? WHERE id = ?"
        ).bind(("EA00:" + message).slice(0, 500), row.id),
        env.DB.prepare(
          `INSERT INTO email_send_log
           (waitlist_id, email, template_key, status, error)
           VALUES (?, ?, 'EA00', 'failed', ?)`
        ).bind(row.id, row.email, message),
      ]);
    }
  }

  return sent;
}

function utcDayStartIso(now = new Date()) {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  )).toISOString();
}

async function runLifecycle(env) {
  if (!env.DB || !env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.log("email_lifecycle_not_configured");
    return;
  }

  const capRaw = Number(env.BREVO_DAILY_SEND_CAP || "250");
  const dailyCap = Number.isFinite(capRaw) ? Math.max(1, Math.min(290, Math.floor(capRaw))) : 250;
  const start = utcDayStartIso();

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM email_send_log WHERE status = 'sent' AND sent_at >= ?"
  ).bind(start).first();

  const sentToday = Number(countRow?.count || 0);
  let remaining = Math.max(0, dailyCap - sentToday);
  if (!remaining) {
    console.log("email_daily_cap_reached", { sentToday, dailyCap });
    return;
  }

  const now = new Date();

  const recovered = await recoverMissingWelcomes(env, now, remaining);
  remaining = Math.max(0, remaining - recovered);
  if (!remaining) return;

  const batchSize = Math.min(remaining, 50);

  const due = await env.DB.prepare(
    `SELECT id, email, market, style, mode, country, email_sequence_step, email_next_at
     FROM waitlist
     WHERE consent = 1
       AND email_unsubscribed_at IS NULL
       AND welcome_sent_at IS NOT NULL
       AND email_sequence_step BETWEEN 1 AND 5
       AND email_next_at IS NOT NULL
       AND email_next_at <= ?
     ORDER BY email_next_at ASC
     LIMIT ?`
  ).bind(now.toISOString(), batchSize).all();

  for (const row of due.results || []) {
    const step = STEPS[row.email_sequence_step];
    if (!step) continue;

    const templateId = Number(env[step.envKey]);
    if (!Number.isInteger(templateId) || templateId < 1) {
      await env.DB.prepare(
        "UPDATE waitlist SET email_last_error = ? WHERE id = ?"
      ).bind(("missing_template:" + step.envKey).slice(0, 500), row.id).run();
      continue;
    }

    try {
      if (await isBlacklisted(env, row.email)) {
        await env.DB.prepare(
          `UPDATE waitlist
           SET email_unsubscribed_at = ?, email_next_at = NULL, email_last_error = NULL
           WHERE id = ?`
        ).bind(now.toISOString(), row.id).run();
        continue;
      }

      const result = await sendTemplate(env, row, templateId, step.key);
      const messageId = result?.messageId ? String(result.messageId).slice(0, 200) : "";
      const nextAt = step.delayDays == null
        ? null
        : new Date(now.getTime() + step.delayDays * DAY).toISOString();

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE waitlist
           SET email_sequence_step = ?,
               email_next_at = ?,
               email_last_error = NULL
           WHERE id = ?`
        ).bind(step.nextStep, nextAt, row.id),
        env.DB.prepare(
          `INSERT INTO email_send_log
           (waitlist_id, email, template_key, provider_message_id, status, sent_at)
           VALUES (?, ?, ?, ?, 'sent', ?)`
        ).bind(row.id, row.email, step.key, messageId, now.toISOString()),
      ]);
    } catch (error) {
      const message = (error?.message || String(error)).slice(0, 500);
      console.error("email_lifecycle_send_failed", row.id, step.key, message);

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE waitlist SET email_last_error = ? WHERE id = ?"
        ).bind(step.key + ":" + message, row.id),
        env.DB.prepare(
          `INSERT INTO email_send_log
           (waitlist_id, email, template_key, status, error)
           VALUES (?, ?, ?, 'failed', ?)`
        ).bind(row.id, row.email, step.key, message),
      ]);
    }
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runLifecycle(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/health") return new Response("Not found", { status: 404 });

    const configured = Boolean(
      env.DB &&
      env.BREVO_API_KEY &&
      env.BREVO_LIST_ID &&
      env.BREVO_SENDER_EMAIL &&
      env.BREVO_WELCOME_TEMPLATE_ID &&
      env.BREVO_TEMPLATE_EA01 &&
      env.BREVO_TEMPLATE_EA02 &&
      env.BREVO_TEMPLATE_EA03 &&
      env.BREVO_TEMPLATE_EA04 &&
      env.BREVO_TEMPLATE_EA05
    );

    return Response.json({
      ok: true,
      configured,
      service: "zugrio-brevo-lifecycle",
      ea00RecoveryEnabled: String(env.BREVO_EA00_RECOVERY_ENABLED || "").toLowerCase() === "true",
    }, {
      headers: { "cache-control": "no-store" },
    });
  },
};
