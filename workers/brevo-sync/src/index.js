const API = 'https://api.brevo.com/v3';
const ELIGIBLE = `w.consent = 1 AND w.consent_at IS NOT NULL
  AND w.consent_version IS NOT NULL AND w.consent_version <> 'legacy'
  AND datetime(w.expires_at) > datetime(?)`;

function settings(env) {
  const listId = Number(env.BREVO_LIST_ID);
  return env.DB && env.BREVO_API_KEY && Number.isSafeInteger(listId) && listId > 0
    ? { listId } : null;
}

class ProviderError extends Error {
  constructor(status) { super(`brevo_http_${status}`); this.status = status; }
}

async function request(env, path, init = {}) {
  let response;
  try {
    response = await fetch(API + path, {
      ...init,
      headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new Error('brevo_network_error'); }
  return response;
}

export async function syncContact(env, email, listId) {
  const lookup = await request(env, '/contacts/' + encodeURIComponent(email) + '?identifierType=email_id');
  if (lookup.ok) {
    const contact = await lookup.json();
    if (contact.emailBlacklisted || contact.listUnsubscribed?.includes(listId)) return 'suppressed';
    if (contact.listIds?.includes(listId)) return 'synced';
  } else if (lookup.status !== 404) {
    await lookup.body?.cancel();
    throw new ProviderError(lookup.status);
  } else { await lookup.body?.cancel(); }

  // Never clear suppression, replace other lists, or send a message.
  const result = await request(env, '/contacts', {
    method: 'POST',
    body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
  });
  await result.body?.cancel();
  if (!result.ok) throw new ProviderError(result.status);
  return 'synced';
}

export async function runSync(env, now = Date.now()) {
  const config = settings(env);
  if (!config) return { configured: false };
  const { listId } = config;
  const iso = new Date(now).toISOString();
  const rows = await env.DB.prepare(`
    SELECT w.id, w.email FROM waitlist w
    LEFT JOIN brevo_contact_sync s ON s.waitlist_id = w.id AND s.list_id = ?
    WHERE ${ELIGIBLE} AND (s.status IS NULL OR s.status = 'pending')
      AND COALESCE(s.next_attempt_at, 0) <= ? AND COALESCE(s.lease_until, 0) <= ?
    ORDER BY w.id LIMIT 10
  `).bind(listId, iso, now, now).all();
  const counts = { configured: true, synced: 0, suppressed: 0, failed: 0 };
  for (const row of rows.results || []) {
    const token = crypto.randomUUID();
    const claimNow = Math.max(now, Date.now());
    const claimed = await env.DB.prepare(`
      INSERT INTO brevo_contact_sync (waitlist_id, list_id, attempts, lease_token, lease_until)
      SELECT w.id, ?, 1, ?, ? FROM waitlist w WHERE w.id = ? AND ${ELIGIBLE}
      ON CONFLICT(waitlist_id, list_id) DO UPDATE SET
        attempts = attempts + 1, lease_token = excluded.lease_token, lease_until = excluded.lease_until
      WHERE brevo_contact_sync.status = 'pending'
        AND brevo_contact_sync.lease_until <= ? AND brevo_contact_sync.next_attempt_at <= ?
      RETURNING attempts
    `).bind(listId, token, claimNow + 90000, row.id, new Date(claimNow).toISOString(), claimNow, claimNow).first();
    if (!claimed) continue;
    try {
      const status = await syncContact(env, row.email, listId);
      await env.DB.prepare(`UPDATE brevo_contact_sync
        SET status = ?, synced_at = ?, last_error = NULL, lease_token = NULL, lease_until = 0
        WHERE waitlist_id = ? AND list_id = ? AND lease_token = ?
      `).bind(status, status === 'synced' ? new Date().toISOString() : null, row.id, listId, token).run();
      counts[status]++;
    } catch (error) {
      // Persist only fixed error codes; provider bodies can contain personal data.
      const code = error instanceof ProviderError ? error.message : 'sync_failed';
      const delay = Math.min(86400000, 300000 * (2 ** Math.min(claimed.attempts - 1, 9)));
      await env.DB.prepare(`UPDATE brevo_contact_sync
        SET next_attempt_at = ?, last_error = ?, lease_token = NULL, lease_until = 0
        WHERE waitlist_id = ? AND list_id = ? AND lease_token = ?
      `).bind(claimNow + delay, code, row.id, listId, token).run();
      counts.failed++;
      if ([401, 403, 429].includes(error.status)) break;
    }
  }
  console.log(JSON.stringify({ event: 'brevo_contact_sync', ...counts }));
  return counts;
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(runSync(env)); },
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/health') return new Response('Not found', { status: 404 });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    return Response.json({ service: 'zugrio-brevo-sync', configured: Boolean(settings(env)) },
      { headers: { 'cache-control': 'no-store' } });
  },
};
