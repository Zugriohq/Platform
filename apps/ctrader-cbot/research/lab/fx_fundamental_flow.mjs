// fx_fundamental_flow_prereg.json: G1 currency value (BIS real effective exchange rates), G2a positioning extremes and
// G2b positioning flow (CFTC Traders in Financial Futures, leveraged funds).
// node fx_fundamental_flow.mjs <merged PAIR.m1 dir> <BIS dir: eer_XX.csv, XX.csv> <tff.json>
import fs from "fs";
const [M1, BIS, TFF] = process.argv.slice(2);
const SPLIT = Date.UTC(2018, 0, 1) / 1000, START = Date.UTC(2010, 0, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000;
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s, u = "%", d = 3) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(d)}${u} (t ${s.t.toFixed(2)}, n ${s.n})` : `n ${s.n}`);
const verdict = (h0, h1, all) => (h0.m > 0 && h1.m > 0 && all.t >= 2.5 ? "PASS" : "fail");
const CCY = { EUR: ["EURUSD", false, 0.0001, "XM", "099741"], GBP: ["GBPUSD", false, 0.00015, "GB", "096742"], JPY: ["USDJPY", true, 0.012, "JP", "097741"],
  AUD: ["AUDUSD", false, 0.0001, "AU", "232741"], CAD: ["USDCAD", true, 0.0001, "CA", "090741"], CHF: ["USDCHF", true, 0.0001, "CH", "092741"], NZD: ["NZDUSD", false, 0.0001, "NZ", "112741"] };

// daily closes at the 21:00 UTC cut: day key (days since epoch) -> close
const closes = {};
for (const [c, [pair]] of Object.entries(CCY)) {
  const b = fs.readFileSync(`${M1}/${pair}.m1`), a = new Float64Array(b.buffer, b.byteOffset, b.length / 8), m = new Map();
  for (let i = 0; i < a.length; i += 5) m.set(Math.floor((a[i] + 3 * 3600) / 86400), a[i + 4]);
  closes[c] = m;
}
const closeOn = (c, key) => { for (let k = 0; k < 5; k++) { const v = closes[c].get(key - k); if (v !== undefined) return v; } return null; };   // last close on or before
const ccyRet = (c, k0, k1) => { const x = closeOn(c, k0), y = closeOn(c, k1); if (x == null || y == null) return null; return CCY[c][1] ? x / y - 1 : y / x - 1; };
const spreadRet = (c, k) => { const x = closeOn(c, k); return x == null ? null : CCY[c][2] / x; };

// BIS CSV (quoted fields may contain commas)
const csv = (p) => { const split = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; };
  const L = fs.readFileSync(p, "utf8").trim().split("\n"), h = split(L[0]), it = h.indexOf("TIME_PERIOD"), iv = h.indexOf("OBS_VALUE"), m = new Map();
  for (const l of L.slice(1)) { const x = split(l); if (x[iv]) m.set(x[it], +x[iv]); } return m; };
const lagMonth = (ym, k) => { let [y, m] = ym.split("-").map(Number); m -= k; while (m <= 0) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };
const out = [];

// ---- G1: value ----
{
  const area = { USD: "US", ...Object.fromEntries(Object.entries(CCY).map(([c, v]) => [c, v[3]])) };
  const eer = Object.fromEntries(Object.entries(area).map(([c, a]) => [c, csv(`${BIS}/eer_${a}.csv`)])), pol = Object.fromEntries(Object.entries(area).map(([c, a]) => [c, csv(`${BIS}/${a}.csv`)]));
  const rateAt = (c, ym) => { for (let k = 0; k < 24; k++) { const v = pol[c].get(lagMonth(ym, k)); if (v !== undefined) return v; } return null; };
  const value = (c, ym) => { const last = lagMonth(ym, 1), now = eer[c].get(last); if (!now) return null; let s = 0, n = 0; for (let k = 2; k <= 61; k++) { const v = eer[c].get(lagMonth(ym, k)); if (v) { s += Math.log(v); n++; } } return n >= 48 ? -(Math.log(now) - s / n) : null; };
  // month-end day keys
  const ends = []; for (let t = START; t < END; t += 86400) { const d = new Date(t * 1000), nx = new Date((t + 86400) * 1000); if (d.getUTCMonth() !== nx.getUTCMonth()) ends.push({ ym: d.toISOString().slice(0, 7), key: Math.floor(t / 86400) }); }
  const rows = []; let held = new Map();
  for (let k = 0; k + 1 < ends.length; k++) {
    const a = ends[k], b = ends[k + 1], ranked = Object.keys(area).map((c) => ({ c, v: value(c, a.ym) })).filter((x) => x.v != null).sort((x, y) => y.v - x.v);
    if (ranked.length < 8) continue;
    const pos = new Map([...ranked.slice(0, 3).map((x) => [x.c, 1]), ...ranked.slice(-3).map((x) => [x.c, -1])]), us = rateAt("USD", a.ym);
    let sum = 0, n = 0, ok = true;
    for (const [c, d] of pos) { const s = c === "USD" ? 0 : ccyRet(c, a.key, b.key); if (s == null) { ok = false; break; } sum += d * s + d * (rateAt(c, a.ym) - us) / 1200 - (held.get(c) === d ? 0 : 0.0001) - 0.01 / 12; n++; }
    if (!ok) continue; rows.push({ t: a.key * 86400, r: 100 * sum / n }); held = pos;
  }
  const h0 = st(rows.filter((r) => r.t < SPLIT).map((r) => r.r)), h1 = st(rows.filter((r) => r.t >= SPLIT).map((r) => r.r)), all = st(rows.map((r) => r.r));
  out.push(`G1 currency value (BIS real EER vs its 5-year mean; long 3 cheapest, short 3 dearest of 8; % per month per position, net): 2010-17 ${f(h0)}, 2018-26 ${f(h1)}, pooled ${f(all)} -> ${verdict(h0, h1, all)}`);
}

// ---- G2: positioning (CFTC TFF, leveraged funds) ----
{
  const tff = JSON.parse(fs.readFileSync(TFF, "utf8")), byC = {};
  for (const [c, v] of Object.entries(CCY)) byC[c] = tff.filter((r) => r.cftc_contract_market_code === v[4]).map((r) => ({ release: Math.floor(Date.parse(r.report_date_as_yyyy_mm_dd.slice(0, 10) + "T00:00:00Z") / 86400000) + 3,
    net: (+r.lev_money_positions_long - +r.lev_money_positions_short) / +r.open_interest_all })).filter((x) => Number.isFinite(x.net)).sort((a, b) => a.release - b.release);
  // G2a: extremes, contrarian, 4-week holds
  const trades = [];
  for (const [c, w] of Object.entries(byC)) {
    let busy = -1;
    for (let i = 156; i < w.length; i++) {
      const k = w[i].release; if (k * 86400 < START || k * 86400 > END - 28 * 86400 || k < busy) continue;
      const hist = w.slice(i - 156, i).map((x) => x.net), mu = hist.reduce((a, x) => a + x, 0) / 156, sd = Math.sqrt(hist.reduce((a, x) => a + (x - mu) ** 2, 0) / 155), z = (w[i].net - mu) / sd;
      if (!(Math.abs(z) > 2)) continue;
      const d = z > 2 ? -1 : 1, r = ccyRet(c, k, k + 28), sp = spreadRet(c, k); if (r == null || sp == null) continue;
      trades.push({ c, t: k * 86400, r: 100 * (d * r - sp - 0.015 * 28 / 365) }); busy = k + 28;
    }
  }
  const a0 = st(trades.filter((x) => x.t < SPLIT).map((x) => x.r)), a1 = st(trades.filter((x) => x.t >= SPLIT).map((x) => x.r)), aa = st(trades.map((x) => x.r));
  out.push(`G2a positioning extremes (leveraged funds net/OI z > 2 over 3 years, contrarian, 4 weeks; % per trade, net): 2010-17 ${f(a0)}, 2018-26 ${f(a1)}, pooled ${f(aa)} -> ${verdict(a0, a1, aa)}; ` +
    Object.keys(CCY).map((c) => `${c} ${f(st(trades.filter((x) => x.c === c).map((x) => x.r)), "%", 2)}`).join(", "));
  // G2b: flow, weekly cross-section
  const releases = [...new Set(Object.values(byC).flatMap((w) => w.map((x) => x.release)))].sort((a, b) => a - b), rows = []; let held = new Map();
  for (const k of releases) {
    if (k * 86400 < START || k * 86400 > END - 7 * 86400) continue;
    const ch = Object.entries(byC).map(([c, w]) => { const i = w.findIndex((x) => x.release === k); return i > 0 ? { c, d: w[i].net - w[i - 1].net } : null; }).filter(Boolean).sort((x, y) => y.d - x.d);
    if (ch.length < 6) continue;
    const pos = new Map([...ch.slice(0, 2).map((x) => [x.c, 1]), ...ch.slice(-2).map((x) => [x.c, -1])]);
    let sum = 0, n = 0, ok = true;
    for (const [c, d] of pos) { const r = ccyRet(c, k, k + 7); if (r == null) { ok = false; break; } sum += d * r - (held.get(c) === d ? 0 : 0.0001) - 0.015 * 7 / 365; n++; }
    if (!ok) continue; rows.push({ t: k * 86400, r: 100 * sum / n }); held = pos;
  }
  const b0 = st(rows.filter((x) => x.t < SPLIT).map((x) => x.r)), b1 = st(rows.filter((x) => x.t >= SPLIT).map((x) => x.r)), bb = st(rows.map((x) => x.r));
  out.push(`G2b positioning flow (long the 2 currencies leveraged funds bought most last week, short the 2 sold most; % per week per position, net): 2010-17 ${f(b0)}, 2018-26 ${f(b1)}, pooled ${f(bb)} -> ${verdict(b0, b1, bb)}`);
}
console.log(out.join("\n"));
