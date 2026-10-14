// Downloads Deriv M1 candles for synthetic indices into hdfetch.py's .m1 format (float64 rows: epoch, o, h, l, c),
// one file per symbol, named by TTI key where TTI has one (JD25 -> J25.m1), else by Deriv symbol.
// node derivfetch.mjs <out dir> <days> <SYMBOL> [SYMBOL ...]      e.g. node derivfetch.mjs hd 90 JD10 JD25 JD50 JD75 JD100
// Endpoints in TTI's own order (WS_EPS): the current public API first, the legacy one as fallback. Read only, no login.
import fs from "fs";

const EPS = ["wss://api.derivws.com/trading/v1/options/ws/public", "wss://ws.derivws.com/websockets/v3?app_id=1089"];
const KEY = { JD10: "J10", JD25: "J25", JD50: "J50", JD75: "J75", JD100: "J100" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function open(url) {
  return new Promise((ok, fail) => {
    const ws = new WebSocket(url); let id = 0; const wait = new Map();
    const t = setTimeout(() => { try { ws.close(); } catch {} fail(new Error("timeout " + url)); }, 15000);
    ws.onopen = () => { clearTimeout(t); ok({ url, ask: (q) => new Promise((res) => { const r = ++id; wait.set(r, res); ws.send(JSON.stringify({ ...q, req_id: r })); }), close: () => ws.close() }); };
    ws.onerror = () => { clearTimeout(t); fail(new Error("cannot connect " + url)); };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); const f = wait.get(m.req_id); if (f) { wait.delete(m.req_id); f(m); } };
  });
}
export async function connect() { let last; for (const u of EPS) { try { return await open(u); } catch (e) { last = e; } } throw last; }

export async function candles(api, sym, fromEpoch, log = () => {}) {
  const rows = new Map(); let end = "latest";
  for (let page = 0; page < 1000; page++) {
    let m;
    for (let a = 0; a < 5; a++) { m = await api.ask({ ticks_history: sym, style: "candles", granularity: 60, count: 5000, end }); if (!m.error) break; log(`${sym}: ${m.error.code} ${m.error.message}; retry`); await sleep(2000 * (a + 1)); }
    if (m.error) throw new Error(`${sym}: ${m.error.message}`);
    const c = m.candles || []; if (!c.length) break;
    for (const x of c) rows.set(+x.epoch, [+x.epoch, +x.open, +x.high, +x.low, +x.close]);
    if (c[0].epoch <= fromEpoch || c.length < 2) break;
    end = String(c[0].epoch - 1);
    await sleep(350);
  }
  return [...rows.values()].filter((r) => r[0] >= fromEpoch).sort((a, b) => a[0] - b[0]);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [dir, days, ...syms] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });
  const api = await connect(); console.log("connected", api.url);
  const from = Math.floor(Date.now() / 1000) - +days * 86400;
  for (const s of syms) {
    const rows = await candles(api, s, from, console.log);
    const f = new Float64Array(rows.length * 5); rows.forEach((r, i) => f.set(r, 5 * i));
    const name = `${dir}/${KEY[s] ?? s}.m1`; fs.writeFileSync(name, Buffer.from(f.buffer));
    console.log(`${s} -> ${name}: ${rows.length} M1 bars, ${new Date(rows[0][0] * 1000).toISOString().slice(0, 16)} to ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 16)} UTC`);
  }
  api.close(); process.exit(0);
}
