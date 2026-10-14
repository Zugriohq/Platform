// fx_structure_prereg.json: four effects specific to the currency market (F1 home-hours depreciation, F2 month-end
// equity-hedge rebalancing, F3 relative-value reversion, F4 carry).
// node fx_structure.mjs <dir with merged PAIR.m1 files> <ibars dir> <BIS dir with US.csv XM.csv ...>
import fs from "fs";
const [M1, IBARS, BIS] = process.argv.slice(2);
const SPLIT = Date.UTC(2018, 0, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000;
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)), sd }; };
const f = (s, u, d = 4) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(d)}${u} (t ${s.t.toFixed(2)}, n ${s.n})` : `n ${s.n}`);
const verdict = (h0, h1, all) => (h0.m > 0 && h1.m > 0 && all.t >= 2.5 ? "PASS" : "fail");
const out = [];

// Currency against USD: the pair, whether USD is the base (invert), and the spread in price.
const CCY = { EUR: ["EURUSD", false, 0.0001], GBP: ["GBPUSD", false, 0.00015], JPY: ["USDJPY", true, 0.012], AUD: ["AUDUSD", false, 0.0001],
  CAD: ["USDCAD", true, 0.0001], CHF: ["USDCHF", true, 0.0001], NZD: ["NZDUSD", false, 0.0001] };
const series = {};   // pair -> { t: Float64Array, c: Float64Array } of M1 closes
function load(pair) {
  if (series[pair]) return series[pair];
  const b = fs.readFileSync(`${M1}/${pair}.m1`), a = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = a.length / 5;
  const t = new Float64Array(n), c = new Float64Array(n); for (let i = 0; i < n; i++) { t[i] = a[5 * i]; c[i] = a[5 * i + 4]; }
  return (series[pair] = { t, c });
}
// the last close at or before time T, if within 10 minutes
function px(pair, T) { const s = load(pair); let lo = 0, hi = s.t.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (s.t[m] <= T) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 && T - s.t[k] <= 600 ? s.c[k] : null; }
const ccyRet = (c, a, b) => { const [p, inv] = CCY[c], x = px(p, a), y = px(p, b); if (x == null || y == null) return null; return inv ? x / y - 1 : y / x - 1; };
const costRet = (c, T) => { const [p, , sp] = CCY[c], x = px(p, T); return x == null ? null : sp / x; };
const days = []; for (let t = Date.UTC(2010, 0, 4) / 1000; t < END; t += 86400) { const wd = new Date(t * 1000).getUTCDay(); if (wd >= 1 && wd <= 5) days.push(t); }

// ---- F1 ----
{
  const home = { EUR: [7, 12], GBP: [7, 12], CHF: [7, 12], JPY: [0, 6], AUD: [0, 6], NZD: [0, 6] }, us = [13, 20], rows = [];
  for (const d of days) {
    const v = [];
    for (const [c, [h0, h1]] of Object.entries(home)) {
      const rh = ccyRet(c, d + h0 * 3600, d + h1 * 3600), ru = ccyRet(c, d + us[0] * 3600, d + us[1] * 3600), k = costRet(c, d + h0 * 3600);
      if (rh == null || ru == null || k == null) continue;
      v.push({ c, gross: -rh + ru, net: -rh + ru - 2 * k, rh, ru });
    }
    if (v.length >= 4) rows.push({ t: d, net: 1e4 * v.reduce((a, x) => a + x.net, 0) / v.length, gross: 1e4 * v.reduce((a, x) => a + x.gross, 0) / v.length, v });
  }
  const h0 = st(rows.filter((r) => r.t < SPLIT).map((r) => r.net)), h1 = st(rows.filter((r) => r.t >= SPLIT).map((r) => r.net)), all = st(rows.map((r) => r.net));
  out.push(`F1 home-hours depreciation (6 currencies, bp per day): gross ${f(st(rows.map((r) => r.gross)), "bp", 3)}; net 2010-17 ${f(h0, "bp", 3)}, 2018-26 ${f(h1, "bp", 3)}, pooled ${f(all, "bp", 3)} -> ${verdict(h0, h1, all)}`);
  out.push("   per currency, bp per day: home-hours return / US-hours return / net strategy: " + Object.keys(home).map((c) => {
    const x = rows.flatMap((r) => r.v.filter((y) => y.c === c));
    return `${c} ${(1e4 * st(x.map((y) => y.rh)).m).toFixed(2)} (t ${st(x.map((y) => y.rh)).t.toFixed(1)}) / ${(1e4 * st(x.map((y) => y.ru)).m).toFixed(2)} (t ${st(x.map((y) => y.ru)).t.toFixed(1)}) / ${(1e4 * st(x.map((y) => y.net)).m).toFixed(2)}`;
  }).join("; "));
}

// ---- F2 ----
const londonOffset = (t) => { const y = new Date(t * 1000).getUTCFullYear(), ls = (m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay(), 1) / 1000; }; return t >= ls(2) && t < ls(9) ? 3600 : 0; };
const at1600London = (d) => d + 16 * 3600 - londonOffset(d + 16 * 3600);
{
  const idx = (s) => JSON.parse(fs.readFileSync(`${IBARS}/${s}.json`, "utf8")).bars.map(([t, , , , c]) => ({ t: t / 1000, c })).filter((x) => x.c > 0);
  const EQ = { SPX: idx("SPX"), EUR: idx("DAX"), GBP: idx("FTSE"), JPY: idx("N225"), AUD: idx("ASX200") };
  const lastClose = (b, T) => { let k = -1; for (let lo = 0, hi = b.length - 1; lo <= hi;) { const m = (lo + hi) >> 1; if (b[m].t < T) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? b[k].c : null; };
  const byMonth = new Map(); for (const d of days) { const k = new Date(d * 1000).toISOString().slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(d); }
  const rows = [];
  for (const [k, ds] of byMonth) {
    if (ds.length < 15) continue;
    const entryDay = ds[ds.length - 3], exitDay = ds[ds.length - 1], monthStart = ds[0];
    const eqRet = (b) => { const a = lastClose(b, monthStart), z = lastClose(b, entryDay); return a && z ? z / a - 1 : null; };
    const us = eqRet(EQ.SPX); if (us == null) continue;
    const v = [];
    for (const c of ["EUR", "GBP", "JPY", "AUD"]) {
      const e = eqRet(EQ[c]), r = ccyRet(c, at1600London(entryDay), at1600London(exitDay)), cost = costRet(c, at1600London(entryDay));
      if (e == null || r == null || cost == null || e === us) continue;
      const pos = e > us ? -1 : 1; v.push({ c, net: pos * r - cost, gross: pos * r });
    }
    if (v.length >= 3) rows.push({ t: entryDay, net: 1e4 * v.reduce((a, x) => a + x.net, 0) / v.length, gross: 1e4 * v.reduce((a, x) => a + x.gross, 0) / v.length });
  }
  const h0 = st(rows.filter((r) => r.t < SPLIT).map((r) => r.net)), h1 = st(rows.filter((r) => r.t >= SPLIT).map((r) => r.net)), all = st(rows.map((r) => r.net));
  out.push(`F2 month-end equity-hedge rebalancing (4 currencies, bp per month-end trade): gross ${f(st(rows.map((r) => r.gross)), "bp", 2)}; net 2010-17 ${f(h0, "bp", 2)}, 2018-26 ${f(h1, "bp", 2)}, pooled ${f(all, "bp", 2)} -> ${verdict(h0, h1, all)}`);
}

// ---- F3 ----
{
  const daily = (pair) => { const s = load(pair), m = new Map(); for (let i = 0; i < s.t.length; i++) { const k = Math.floor((s.t[i] + 3 * 3600) / 86400); m.set(k, s.c[i]); } return m; };
  const au = daily("AUDUSD"), nz = daily("NZDUSD"), eg = daily("EURGBP");
  const mk = (name, keys, val, cost) => ({ name, cost, D: keys.filter((k) => { const wd = new Date(k * 86400000).getUTCDay(); return wd >= 1 && wd <= 5; }).sort((a, b) => a - b).map((k) => ({ k, c: val(k) })).filter((x) => x.c > 0) });
  const sets = [mk("AUDNZD", [...au.keys()].filter((k) => nz.has(k)), (k) => au.get(k) / nz.get(k), 0.0003), mk("EURGBP", [...eg.keys()], (k) => eg.get(k), 0.00015)];
  const trades = [];
  for (const { name, D, cost } of sets) {
    for (let i = 20; i < D.length - 1; i++) {
      const w = D.slice(i - 19, i + 1).map((x) => x.c), mu = w.reduce((a, x) => a + x, 0) / 20, sd = Math.sqrt(w.reduce((a, x) => a + (x - mu) ** 2, 0) / 19); if (!(sd > 0)) continue;
      const z = (D[i].c - mu) / sd; if (Math.abs(z) <= 2) continue;
      const dir = -Math.sign(z), e = D[i].c; let j = i + 1;
      for (; j < D.length && j <= i + 20; j++) { const w2 = D.slice(j - 19, j + 1).map((x) => x.c), m2 = w2.reduce((a, x) => a + x, 0) / 20; if (Math.sign(D[j].c - m2) !== Math.sign(z)) break; }
      j = Math.min(j, D.length - 1);
      const held = D[j].k - D[i].k, pl = dir * (D[j].c - e) - e * (cost + 0.015 * held / 365);
      trades.push({ name, t: D[i].k * 86400, r: pl / (2 * sd) }); i = j;
    }
  }
  const h0 = st(trades.filter((r) => r.t < SPLIT).map((r) => r.r)), h1 = st(trades.filter((r) => r.t >= SPLIT).map((r) => r.r)), all = st(trades.map((r) => r.r));
  out.push(`F3 relative-value reversion (AUDNZD, EURGBP; |z| > 2 fade to the mean): 2010-17 ${f(h0, "R", 3)}, 2018-26 ${f(h1, "R", 3)}, pooled ${f(all, "R", 3)} -> ${verdict(h0, h1, all)}; ` +
    sets.map((s) => `${s.name} ${f(st(trades.filter((x) => x.name === s.name).map((x) => x.r)), "R", 3)}`).join(", "));
}

// ---- F4 ----
{
  const rate = {}; for (const [c, area] of Object.entries({ USD: "US", EUR: "XM", GBP: "GB", JPY: "JP", AUD: "AU", CAD: "CA", CHF: "CH", NZD: "NZ" })) {
    // CSV with quoted fields that contain commas
    const split = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; };
    const lines = fs.readFileSync(`${BIS}/${area}.csv`, "utf8").trim().split("\n"), hdr = split(lines[0]), it = hdr.indexOf("TIME_PERIOD"), iv = hdr.indexOf("OBS_VALUE");
    const m = new Map(); for (const l of lines.slice(1)) { const p = split(l); if (p[iv] !== "" && p[iv] !== undefined) m.set(p[it], +p[iv]); } rate[c] = m;
  }
  const rateAt = (c, ym) => { const m = rate[c]; let [y, mo] = ym.split("-").map(Number); for (let k = 0; k < 24; k++) { const key = `${y}-${String(mo).padStart(2, "0")}`; if (m.has(key)) return m.get(key); mo--; if (mo === 0) { mo = 12; y--; } } return null; };
  const monthEnds = []; const seen = new Map(); for (const d of days) seen.set(new Date(d * 1000).toISOString().slice(0, 7), d);
  for (const [ym, d] of seen) monthEnds.push({ ym, T: d + 20 * 3600 });
  const rows = []; let held = new Map();
  for (let k = 0; k + 1 < monthEnds.length; k++) {
    const a = monthEnds[k], b = monthEnds[k + 1];
    const ranked = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"].map((c) => ({ c, r: rateAt(c, a.ym) })).filter((x) => x.r != null).sort((x, y) => y.r - x.r);
    if (ranked.length < 8) continue;
    const us = rateAt("USD", a.ym), pos = new Map([...ranked.slice(0, 3).map((x) => [x.c, 1]), ...ranked.slice(-3).map((x) => [x.c, -1])]);
    let spot = 0, carry = 0, cost = 0, n = 0, ok = true;
    for (const [c, d] of pos) {
      const s = c === "USD" ? 0 : ccyRet(c, a.T, b.T); if (s == null) { ok = false; break; }
      spot += d * s; carry += d * (rateAt(c, a.ym) - us) / 100 / 12; cost += (held.get(c) === d ? 0 : 0.0001) + 0.01 / 12; n++;
    }
    if (!ok) continue;
    rows.push({ t: a.T, spot: 100 * spot / n, carry: 100 * carry / n, net: 100 * (spot + carry - cost) / n, top: ranked.slice(0, 3).map((x) => x.c).join("") }); held = pos;
  }
  const h0 = st(rows.filter((r) => r.t < SPLIT).map((r) => r.net)), h1 = st(rows.filter((r) => r.t >= SPLIT).map((r) => r.net)), all = st(rows.map((r) => r.net));
  out.push(`F4 carry (long top-3, short bottom-3 policy rates of 8, monthly, % per month per position): spot ${f(st(rows.map((r) => r.spot)), "%", 3)}, interest ${f(st(rows.map((r) => r.carry)), "%", 3)}; net 2010-17 ${f(h0, "%", 3)}, 2018-26 ${f(h1, "%", 3)}, pooled ${f(all, "%", 3)} -> ${verdict(h0, h1, all)}`);
}
console.log(out.join("\n"));
