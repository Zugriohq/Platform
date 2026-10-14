// flow_reversal_prereg.json: fade leveraged funds' weekly positioning change (CFTC TFF), 2006-06..2009-12 out of sample.
// node flow_reversal.mjs <dir with PAIR.m1 for 2006-2009> <tff.json>
import fs from "fs";
const [M1, TFF] = process.argv.slice(2);
const START = Date.UTC(2006, 5, 1) / 1000, END = Date.UTC(2010, 0, 1) / 1000;
const CCY = { EUR: ["EURUSD", false, "099741"], GBP: ["GBPUSD", false, "096742"], JPY: ["USDJPY", true, "097741"], AUD: ["AUDUSD", false, "232741"],
  CAD: ["USDCAD", true, "090741"], CHF: ["USDCHF", true, "092741"], NZD: ["NZDUSD", false, "112741"] };
const closes = {};
for (const [c, [pair]] of Object.entries(CCY)) { const b = fs.readFileSync(`${M1}/${pair}.m1`), a = new Float64Array(b.buffer, b.byteOffset, b.length / 8), m = new Map(); for (let i = 0; i < a.length; i += 5) m.set(Math.floor((a[i] + 3 * 3600) / 86400), a[i + 4]); closes[c] = m; }
const closeOn = (c, key) => { for (let k = 0; k < 5; k++) { const v = closes[c].get(key - k); if (v !== undefined) return v; } return null; };
const ccyRet = (c, k0, k1) => { const x = closeOn(c, k0), y = closeOn(c, k1); if (x == null || y == null) return null; return CCY[c][1] ? x / y - 1 : y / x - 1; };
const tff = JSON.parse(fs.readFileSync(TFF, "utf8")), byC = {};
for (const [c, v] of Object.entries(CCY)) byC[c] = tff.filter((r) => r.cftc_contract_market_code === v[2]).map((r) => ({ release: Math.floor(Date.parse(r.report_date_as_yyyy_mm_dd.slice(0, 10) + "T00:00:00Z") / 86400000) + 3,
  net: (+r.lev_money_positions_long - +r.lev_money_positions_short) / +r.open_interest_all })).filter((x) => Number.isFinite(x.net)).sort((a, b) => a.release - b.release);
const releases = [...new Set(Object.values(byC).flatMap((w) => w.map((x) => x.release)))].sort((a, b) => a - b), rows = []; let held = new Map();
for (const k of releases) {
  if (k * 86400 < START || k * 86400 > END - 7 * 86400) continue;
  const ch = Object.entries(byC).map(([c, w]) => { const i = w.findIndex((x) => x.release === k); return i > 0 ? { c, d: w[i].net - w[i - 1].net } : null; }).filter(Boolean).sort((x, y) => y.d - x.d);
  if (ch.length < 6) continue;
  const pos = new Map([...ch.slice(0, 2).map((x) => [x.c, -1]), ...ch.slice(-2).map((x) => [x.c, 1])]);   // fade: short the most bought, long the most sold
  let sum = 0, gross = 0, n = 0, ok = true;
  for (const [c, d] of pos) { const r = ccyRet(c, k, k + 7); if (r == null) { ok = false; break; } gross += d * r; sum += d * r - (held.get(c) === d ? 0 : 0.0001) - 0.015 * 7 / 365; n++; }
  if (!ok) continue; rows.push({ t: k * 86400, r: 100 * sum / n, g: 100 * gross / n }); held = pos;
}
const st = (v) => { const n = v.length, m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const net = st(rows.map((x) => x.r)), g = st(rows.map((x) => x.g)), f = (s) => `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}% (t ${s.t.toFixed(2)}, n ${s.n})`;
console.log(`Fade leveraged funds' weekly positioning change, 2006-06..2009-12 (% per week per position): gross ${f(g)}, net ${f(net)}`);
console.log("  by year (net): " + [2006, 2007, 2008, 2009].map((y) => { const v = rows.filter((x) => new Date(x.t * 1000).getUTCFullYear() === y).map((x) => x.r); const s = st(v); return `${y} ${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)} (n ${s.n})`; }).join(", "));
console.log(`VERDICT: ${net.m > 0 && net.t >= 2 ? "PASS" : "FAIL"} (registered: net > 0 with t >= 2.0)`);
