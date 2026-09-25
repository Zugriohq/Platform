import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { runSync, syncContact } from '../src/index.js';

class D1 {
  constructor() {
    this.sql = new DatabaseSync(':memory:');
    this.sql.exec(`PRAGMA foreign_keys=ON; CREATE TABLE waitlist (
      id INTEGER PRIMARY KEY, email TEXT, consent INTEGER DEFAULT 1,
      consent_at TEXT DEFAULT '2026-09-24', consent_version TEXT DEFAULT 'waitlist-v1',
      expires_at TEXT DEFAULT '2099-01-01');`);
    this.sql.exec(readFileSync(new URL('../migration.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const db = this.sql; let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { return { success: true, meta: db.prepare(sql).run(...args) }; } };
  }
}
function fixture() { return { DB: new D1(), BREVO_API_KEY: 'test-only', BREVO_LIST_ID: '2' }; }
function add(env, id = 1) { env.DB.sql.prepare('INSERT INTO waitlist (id,email) VALUES (?,?)').run(id, `person${id}@example.com`); }
async function mock(fetcher, fn) {
  const original = globalThis.fetch; globalThis.fetch = fetcher;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test('unconfigured sync makes no database or network request', async () => {
  assert.deepEqual(await runSync({}), { configured: false });
  for (const value of ['0', '-1', 'bad', '1.5']) assert.deepEqual(await runSync({ ...fixture(), BREVO_LIST_ID: value }), { configured: false });
});
test('new consented records sync once, without sending or clearing suppression', async () => {
  const env = fixture(); add(env); const calls = [];
  await mock(async (url, init) => {
    calls.push([url, init]);
    return init.method === 'POST' ? Response.json({ id: 3 }, { status: 201 }) : new Response(null, { status: 404 });
  }, async () => {
    assert.equal((await runSync(env)).synced, 1);
    assert.equal((await runSync(env)).synced, 0);
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1][1].body), { email: 'person1@example.com', listIds: [2], updateEnabled: true });
  assert.equal(env.DB.sql.prepare('SELECT status FROM brevo_contact_sync').get().status, 'synced');
});
test('legacy, expired and revoked-consent records never leave D1', async () => {
  const env = fixture(); for (let i = 1; i <= 4; i++) add(env, i);
  env.DB.sql.exec("UPDATE waitlist SET consent=0 WHERE id=1; UPDATE waitlist SET consent_at=NULL WHERE id=2; UPDATE waitlist SET consent_version='legacy' WHERE id=3; UPDATE waitlist SET expires_at='2000-01-01' WHERE id=4;");
  await mock(async () => { throw Error('must not fetch'); }, async () => assert.equal((await runSync(env)).synced, 0));
  assert.equal(env.DB.sql.prepare('SELECT count(*) n FROM brevo_contact_sync').get().n, 0);
});
test('global and list-level unsubscribe are preserved', async () => {
  for (const contact of [{ emailBlacklisted: true }, { emailBlacklisted: false, listUnsubscribed: [2] }]) {
    const env = fixture(); add(env); let calls = 0;
    await mock(async () => { calls++; return Response.json(contact); }, async () => {
      assert.equal((await runSync(env)).suppressed, 1);
      assert.equal((await runSync(env)).suppressed, 0);
    });
    assert.equal(calls, 1);
  }
});
test('existing list membership needs no write', async () => {
  await mock(async (_url, init) => {
    assert.equal(init.method, undefined); return Response.json({ listIds: [2], emailBlacklisted: false });
  }, async () => assert.equal(await syncContact(fixture(), 'existing@example.com', 2), 'synced'));
});
test('provider failure is retried after backoff, without leaking response data', async () => {
  const env = fixture(); add(env); const now = Date.now();
  await mock(async () => new Response('sensitive address and key', { status: 500 }), async () => {
    assert.equal((await runSync(env, now)).failed, 1);
    assert.equal((await runSync(env, now + 1)).failed, 0);
  });
  const state = env.DB.sql.prepare('SELECT * FROM brevo_contact_sync').get();
  assert.equal(state.last_error, 'brevo_http_500'); assert.equal(state.status, 'pending');
  await mock(async () => Response.json({ listIds: [2] }), async () => assert.equal((await runSync(env, state.next_attempt_at + 1)).synced, 1));
});
test('rate limit stops the batch and leaves later rows available', async () => {
  const env = fixture(); add(env, 1); add(env, 2); let calls = 0;
  await mock(async () => { calls++; return new Response(null, { status: 429 }); }, async () => assert.equal((await runSync(env)).failed, 1));
  assert.equal(calls, 1); assert.equal(env.DB.sql.prepare('SELECT count(*) n FROM brevo_contact_sync').get().n, 1);
});
test('concurrent invocations cannot claim the same contact', async () => {
  const env = fixture(); add(env); let calls = 0;
  await mock(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ listIds: [2] }); }, async () => {
    const results = await Promise.all([runSync(env), runSync(env)]);
    assert.equal(results.reduce((sum, result) => sum + result.synced, 0), 1);
  });
  assert.equal(calls, 1);
});
test('expired lease is recovered after an interrupted invocation', async () => {
  const env = fixture(); add(env);
  env.DB.sql.exec("INSERT INTO brevo_contact_sync (waitlist_id,list_id,attempts,lease_token,lease_until) VALUES (1,2,1,'old',1)");
  await mock(async () => Response.json({ listIds: [2] }), async () => assert.equal((await runSync(env)).synced, 1));
});
test('health reveals no credentials and exposes no public sync action', async () => {
  const env = fixture();
  const health = await worker.fetch(new Request('https://example.test/health'), env);
  assert.deepEqual(await health.json(), { service: 'zugrio-brevo-sync', configured: true });
  assert.equal((await worker.fetch(new Request('https://example.test/sync'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://example.test/health', { method: 'POST' }), env)).status, 405);
});

test('authentication diagnosis records only a safe category', async () => {
  for (const [message, expected] of [
    ['We have detected an unrecognised IP address 192.0.2.1', 'ip_blocked'],
    ['Key not found secret-value', 'invalid_key'],
  ]) {
    const env = fixture(); add(env);
    await mock(async () => Response.json({ message }, { status: 401 }), async () => {
      assert.equal((await runSync(env)).failed, 1);
    });
    assert.equal(env.DB.sql.prepare('SELECT last_error FROM brevo_contact_sync').get().last_error, 'brevo_http_401:' + expected);
  }
});

test('interrupted auth response body still stops the batch on HTTP 401', async () => {
  const env = fixture(); add(env, 1); add(env, 2); let calls = 0;
  await mock(async () => {
    calls++;
    return new Response(new ReadableStream({ start(controller) { controller.error(new Error('interrupted')); } }), { status: 401 });
  }, async () => assert.equal((await runSync(env)).failed, 1));
  assert.equal(calls, 1);
  assert.equal(env.DB.sql.prepare('SELECT last_error FROM brevo_contact_sync').get().last_error, 'brevo_http_401');
});
