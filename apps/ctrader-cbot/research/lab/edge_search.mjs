// edge_search_prereg.json: four published effects, registered together (E1 crypto trend breadth, E2 index overnight
// drift, E3 index 10-month trend filter, E4 FX cross-sectional momentum).
// node edge_search.mjs <coin daily dir (bnfetch 1d)> <merged M1 dir: SPXUSD NSXUSD + 10 FX pairs> <ibars dir (Yahoo daily)>
import fs from "fs";
const [COINS, M1DIR, IBARS] = process.argv.slice(2);
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)), sd }; };
const f = (s, u = "R", d = 3) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(d)}${u} (t ${s.t.toFixed(2)}, n ${s.n})` : `n ${s.n}`);
const readM1 = (p) => { const b = fs.readFileSync(p), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), r = []; for (let i = 0; i < f.length; i += 5) r.push([f[i], f[i + 1], f[i + 2], f[i + 3], f[i + 4]]); return r; };
const verdict = (h0, h1, all) => (h0.m > 0 && h1.m > 0 && all.t >= 2.5 ? "PASS" : "fail");
const out = [];

// ---- E1: the 4-week trend on 11 more coins ----
{
  const SPLIT = Date.UTC(2022, 0, 1) / 1000, byWeek = new Map(), perCoin = [];
  for (const file of fs.readdirSync(COINS).filter((x) => x.endsWith(".m1"))) {
    const rows = readM1(`${COINS}/${file}`).map((r) => [r[0], r[4]]), ends = [], rs = [];
    for (let i = 0; i + 1 < rows.length; i++) if (new Date(rows[i][0] * 1000).getUTCDay() === 0) ends.push(i);   // Sunday closes
    let prev = 0;
    for (let k = 4; k + 1 < ends.length; k++) {
      const i = ends[k], j = ends[k + 1]; if (i < 61) continue;
      const pos = Math.sign(rows[i][1] - rows[ends[k - 4]][1]);
      let s = 0; for (let q = i - 59; q <= i; q++) { const r = Math.log(rows[q][1] / rows[q - 1][1]); s += r * r; }
      const days = (rows[j][0] - rows[i][0]) / 86400, v = Math.sqrt(s / 60) * Math.sqrt(days); if (!(v > 0)) continue;
      const r = (pos * (rows[j][1] / rows[i][1] - 1) - 0.002 * Math.abs(pos - prev) - 0.10 * Math.abs(pos) * days / 365) / v; prev = pos;
      rs.push(r); const w = rows[j][0]; if (!byWeek.has(w)) byWeek.set(w, []); byWeek.get(w).push(r);
    }
    perCoin.push(`${file.replace(".m1", "")} ${f(st(rs))}`);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, r: v.reduce((a, x) => a + x, 0) / v.length }));
  const h0 = st(weeks.filter((w) => w.t < SPLIT).map((w) => w.r)), h1 = st(weeks.filter((w) => w.t >= SPLIT).map((w) => w.r)), all = st(weeks.map((w) => w.r));
  out.push(`E1 crypto 4-week trend, 11 more coins (equal weight per week): before 2022 ${f(h0)}, from 2022 ${f(h1)}, pooled ${f(all)} -> ${verdict(h0, h1, all)}`);
  out.push(`   per coin: ${perCoin.join("; ")}`);
}

// ---- E2: index overnight drift ----
function nyToUtc(y, m, d, hh, mm) {
  const nthSun = (mo, n) => { const fd = new Date(Date.UTC(y, mo, 1)).getUTCDay(); return 1 + ((7 - fd) % 7) + 7 * (n - 1); };
  const t = Date.UTC(y, m, d, hh, mm) / 1000, s = Date.UTC(y, 2, nthSun(2, 2), 2) / 1000, e = Date.UTC(y, 10, nthSun(10, 1), 2) / 1000;
  return t + (t >= s && t < e ? 4 : 5) * 3600;
}
{
  const SPLIT = Date.UTC(2018, 0, 1) / 1000, byNight = new Map(), per = [];
  for (const sym of ["SPXUSD", "NSXUSD"]) {
    const rows = readM1(`${M1DIR}/${sym}.m1`), at = new Map(rows.map((r) => [r[0], r])), nights = [];
    const start = new Date(rows[0][0] * 1000), end = new Date(rows.at(-1)[0] * 1000);
    let prevClose = null, prevT = 0;
    for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); d <= end; d = new Date(d.getTime() + 86400000)) {
      const wd = d.getUTCDay(); if (wd === 0 || wd === 6) continue;
      const y = d.getUTCFullYear(), m = d.getUTCMonth(), dd = d.getUTCDate();
      const open = at.get(nyToUtc(y, m, dd, 9, 30)), close = at.get(nyToUtc(y, m, dd, 15, 59));
      if (open && prevClose) {
        const n = Math.round((nyToUtc(y, m, dd, 9, 30) - prevT) / 86400);
        if (n >= 1 && n <= 4) { const r = open[1] / prevClose - 1, net = r - 0.0002 - 0.05 / 365 * n; nights.push({ t: prevT, gross: r, net }); }
      }
      if (close) { prevClose = close[4]; prevT = nyToUtc(y, m, dd, 16, 0); } else prevClose = null;
    }
    for (const x of nights) { if (!byNight.has(x.t)) byNight.set(x.t, []); byNight.get(x.t).push(x); }
    per.push(`${sym} gross ${f(st(nights.map((x) => 100 * x.gross)), "%", 4)}, net ${f(st(nights.map((x) => 100 * x.net)), "%", 4)}`);
  }
  const n = [...byNight.entries()].map(([t, v]) => ({ t, net: 100 * v.reduce((a, x) => a + x.net, 0) / v.length, gross: 100 * v.reduce((a, x) => a + x.gross, 0) / v.length }));
  const h0 = st(n.filter((x) => x.t < SPLIT).map((x) => x.net)), h1 = st(n.filter((x) => x.t >= SPLIT).map((x) => x.net)), all = st(n.map((x) => x.net));
  out.push(`E2 index overnight drift (mean of SPX, NDX per night): gross ${f(st(n.map((x) => x.gross)), "%", 4)}; net 2010-17 ${f(h0, "%", 4)}, 2018-26 ${f(h1, "%", 4)}, pooled ${f(all, "%", 4)} -> ${verdict(h0, h1, all)}`);
  out.push(`   ${per.join("; ")}`);
}

// ---- E3: 10-month trend filter on 10 indices ----
{
  const SPLIT = Date.UTC(2008, 0, 1), byMonth = new Map(), per = [];
  for (const sym of ["SPX", "NDX", "DJI", "RUT", "DAX", "FTSE", "N225", "CAC", "HSI", "ASX200"]) {
    const b = JSON.parse(fs.readFileSync(`${IBARS}/${sym}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, c })).filter((x) => x.c > 0);
    const ends = []; for (let i = 1; i < b.length; i++) if (new Date(b[i].t).getUTCMonth() !== new Date(b[i - 1].t).getUTCMonth()) ends.push(i - 1);
    let prev = 0; const rs = [], bh = [];
    for (let k = 10; k + 1 < ends.length; k++) {
      const i = ends[k], j = ends[k + 1]; if (i < 61) continue;
      let s = 0; for (let q = k - 9; q <= k; q++) s += b[ends[q]].c; const pos = b[i].c > s / 10 ? 1 : 0;
      const lr = []; for (let q = i - 59; q <= i; q++) lr.push(Math.log(b[q].c / b[q - 1].c));
      const mu = lr.reduce((a, x) => a + x, 0) / 60, sig = Math.sqrt(lr.reduce((a, x) => a + (x - mu) ** 2, 0) / 59) * Math.sqrt(21); if (!(sig > 0)) continue;
      const ret = b[j].c / b[i].c - 1, days = (b[j].t - b[i].t) / 86400000;
      const r = (pos * ret - 0.0002 * Math.abs(pos - prev) - pos * 0.05 * days / 365) / sig, rb = (ret - 0.05 * days / 365) / sig; prev = pos;
      rs.push(r); bh.push(rb);
      const key = new Date(b[j].t).toISOString().slice(0, 7); if (!byMonth.has(key)) byMonth.set(key, { t: b[j].t, r: [], bh: [] }); byMonth.get(key).r.push(r); byMonth.get(key).bh.push(rb);
    }
    per.push(`${sym} ${f(st(rs))} (hold ${f(st(bh))})`);
  }
  const ms = [...byMonth.values()].sort((a, b) => a.t - b.t).map((x) => ({ t: x.t, r: x.r.reduce((a, y) => a + y, 0) / x.r.length, bh: x.bh.reduce((a, y) => a + y, 0) / x.bh.length }));
  const h0 = st(ms.filter((x) => x.t < SPLIT).map((x) => x.r)), h1 = st(ms.filter((x) => x.t >= SPLIT).map((x) => x.r)), all = st(ms.map((x) => x.r));
  const dd = (v) => { let c = 0, p = 0, d = 0; for (const x of v) { c += x; p = Math.max(p, c); d = Math.max(d, p - c); } return d; };
  out.push(`E3 index 10-month trend filter (10 indices, equal weight per month, R = month / monthly sigma): 1990-2007 ${f(h0)}, 2008-2026 ${f(h1)}, pooled ${f(all)} -> ${verdict(h0, h1, all)}`);
  out.push(`   buy-and-hold with the same financing: pooled ${f(st(ms.map((x) => x.bh)))}; max drawdown (sum of monthly R) filter ${dd(ms.map((x) => x.r)).toFixed(1)}R vs hold ${dd(ms.map((x) => x.bh)).toFixed(1)}R; ` +
    `Sharpe (annual) filter ${(all.m / all.sd * Math.sqrt(12)).toFixed(2)} vs hold ${(st(ms.map((x) => x.bh)).m / st(ms.map((x) => x.bh)).sd * Math.sqrt(12)).toFixed(2)}`);
  out.push(`   per index: ${per.join("; ")}`);
}

// ---- E4: FX cross-sectional 12-month momentum ----
{
  const SPLIT = Date.UTC(2018, 0, 1) / 1000, pairs = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "EURJPY", "GBPJPY", "EURGBP"];
  const monthly = {};   // pair -> Map(YYYY-MM -> {c, sig})
  for (const p of pairs) {
    const days = new Map(); for (const r of readM1(`${M1DIR}/${p}.m1`)) { const k = Math.floor((r[0] + 3 * 3600) / 86400), x = days.get(k); if (!x) days.set(k, { k, c: r[4], n: 1 }); else { x.c = r[4]; x.n++; } }
    const D = [...days.values()].filter((d) => d.n >= 60).sort((a, b) => a.k - b.k), m = new Map();
    for (let i = 61; i < D.length; i++) {
      const ym = new Date(D[i].k * 86400000).toISOString().slice(0, 7), nx = i + 1 < D.length ? new Date(D[i + 1].k * 86400000).toISOString().slice(0, 7) : null;
      if (nx === ym) continue;
      const lr = []; for (let q = i - 59; q <= i; q++) lr.push(Math.log(D[q].c / D[q - 1].c));
      const mu = lr.reduce((a, x) => a + x, 0) / 60; m.set(ym, { c: D[i].c, sig: Math.sqrt(lr.reduce((a, x) => a + (x - mu) ** 2, 0) / 59) * Math.sqrt(21), t: D[i].k * 86400 });
    }
    monthly[p] = m;
  }
  const months = [...new Set(pairs.flatMap((p) => [...monthly[p].keys()]))].sort(), res = []; let held = new Map();
  for (let k = 12; k + 1 < months.length; k++) {
    const now = months[k], back = months[k - 12], next = months[k + 1];
    const ranked = pairs.filter((p) => monthly[p].get(now) && monthly[p].get(back) && monthly[p].get(next)).map((p) => ({ p, mom: monthly[p].get(now).c / monthly[p].get(back).c - 1 })).sort((a, b) => b.mom - a.mom);
    if (ranked.length < 8) continue;
    const pos = new Map([...ranked.slice(0, 3).map((x) => [x.p, 1]), ...ranked.slice(-3).map((x) => [x.p, -1])]);
    let s = 0; for (const [p, d] of pos) { const a = monthly[p].get(now), b = monthly[p].get(next); s += (d * (b.c / a.c - 1) - 0.0001 * (held.get(p) === d ? 0 : 1) - 0.015 / 12) / a.sig; }
    res.push({ t: monthly[ranked[0].p].get(now).t, r: s / pos.size }); held = pos;
  }
  const h0 = st(res.filter((x) => x.t < SPLIT).map((x) => x.r)), h1 = st(res.filter((x) => x.t >= SPLIT).map((x) => x.r)), all = st(res.map((x) => x.r));
  out.push(`E4 FX cross-sectional 12-month momentum (long top 3, short bottom 3 of 10, monthly): 2010-17 ${f(h0)}, 2018-26 ${f(h1)}, pooled ${f(all)} -> ${verdict(h0, h1, all)}`);
}
console.log(out.join("\n"));
