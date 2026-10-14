// Resolves the signals recorded by replay.mjs on the 1-minute bars that follow them.
// node evaluate.mjs <bars.m1> <signals.json> [more pairs: <bars.m1> <signals.json> ...]
//
// Entry: the signal price (the M5 open the app fired at). R: distance from that price to the app's stop.
// Cost: TTI's own spread for the instrument (SPECS.defSpread), once per trade.
// Bars are resolved conservatively: in each bar the stop is checked before the target; a stop moved by a bar's
// favourable extreme (break-even, trail) only fills in that bar if the bar closed beyond it. Horizon 2 hours.
import fs from "fs";

// Jump indices (jump_prereg.json): TTI's own SPECS.defSpread for JD10-JD100.
const SPREAD = { EURUSD: 0.00015, GBPUSD: 0.0002, USDJPY: 0.015, XAUUSD: 0.3, J10: 0.001, J25: 0.003, J50: 0.006, J75: 0.009, J100: 0.012 };
// SPLIT=<epoch seconds>: report the two halves of the period instead of the calendar years 2025 and 2026.
const SPLIT = process.env.SPLIT ? +process.env.SPLIT : null;
const PLANS = [
  ["A", "as now: app target", { }],
  ["B", "fixed target 0.8R", { tp: 0.8 }],
  ["C", "target 15% in front of the level", { front: 0.85 }],
  ["D", "break-even at 0.7R", { be: 0.7 }],
  ["E", "half at 0.8R, rest break-even", { half: 0.8 }],
  ["F", "trail 0.5R from 0.8R", { trail: [0.8, 0.5] }],
  ["G", "fixed target 1.5R", { tp: 1.5 }],
];

function loadBars(p) {
  const b = fs.readFileSync(p), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = f.length / 5;
  const t = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), o = new Float64Array(n);
  for (let i = 0; i < n; i++) { t[i] = f[5 * i]; o[i] = f[5 * i + 1]; h[i] = f[5 * i + 2]; l[i] = f[5 * i + 3]; c[i] = f[5 * i + 4]; }
  return { t, o, h, l, c, n };
}
function firstAt(B, ts) { let lo = 0, hi = B.n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (B.t[m] < ts) lo = m + 1; else hi = m; } return lo; }

function plan(B, i0, d, E, risk, tA, p) {
  const tp = p.tp ?? (p.front ? p.front * tA : tA);
  let stop = -1, w = 1, got = 0, best = 0, half = false;
  const tEnd = B.t[i0] + 7200;
  for (let i = i0; i < B.n && B.t[i] < tEnd; i++) {
    const fav = d > 0 ? (B.h[i] - E) / risk : (E - B.l[i]) / risk, adv = d > 0 ? (B.l[i] - E) / risk : (E - B.h[i]) / risk, cl = d * (B.c[i] - E) / risk;
    const op = d * (B.o[i] - E) / risk;
    if (adv <= stop) return got + w * Math.min(stop, i > i0 ? op : stop);   // gap through: filled at the open
    if (fav >= tp) return got + w * tp;
    best = Math.max(best, fav);
    if (p.half && !half && fav >= p.half) { got += 0.5 * p.half; w = 0.5; half = true; stop = Math.max(stop, 0.05); }
    if (p.be && fav >= p.be) stop = Math.max(stop, 0.05);
    if (p.trail && best >= p.trail[0]) stop = Math.max(stop, best - p.trail[1]);
    if (cl <= stop && stop > -1) return got + w * stop;
    if (i + 1 >= B.n || B.t[i + 1] >= tEnd) return got + w * cl;
  }
  return got;
}

function stats(v) { const n = v.length; if (!n) return { n, avg: 0, t: 0 }; const m = v.reduce((a, x) => a + x, 0) / n; const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1)); return { n, avg: m, t: sd > 0 ? m / (sd / Math.sqrt(n)) : 0 }; }
const f2 = (x) => (x >= 0 ? "+" : "") + x.toFixed(3);

const args = process.argv.slice(2), all = [];
for (let a = 0; a < args.length; a += 2) {
  // SPREAD_<KEY>=<price>: the broker's measured spread instead of TTI's (e.g. SPREAD_J25 from Market Lab's LAB MEASURED line).
  const B = loadBars(args[a]), J = JSON.parse(fs.readFileSync(args[a + 1], "utf8")), sp = process.env["SPREAD_" + J.key] ? +process.env["SPREAD_" + J.key] : SPREAD[J.key];
  if (!(sp > 0)) throw new Error("no spread for " + J.key);
  for (const s of J.signals) {
    const d = s.dir === "BUY" ? 1 : -1, i0 = firstAt(B, s.firedAt / 1000); if (i0 >= B.n) continue;
    const E = s.price, risk = d * (E - s.stop), tA = d * (s.target - E) / risk;
    const row = { key: J.key, walk: J.walk, year: SPLIT !== null ? (s.firedAt / 1000 < SPLIT ? "first half" : "second half") : new Date(s.firedAt).getUTCFullYear(), hour: new Date(s.firedAt).getUTCHours(), dir: s.dir, setup: s.setup, regime: s.regime, pWin: s.pWin, appOutcome: s.appOutcome, tA, risk, costR: sp / risk };
    if (!(risk > 0)) { row.bad = "stop on the wrong side"; all.push(row); continue; }
    if (!(tA > 0)) { row.bad = "target already passed at the signal"; all.push(row); continue; }
    // best excursion before the stop, within 2 hours
    let mfe = 0; for (let i = i0; i < B.n && B.t[i] < B.t[i0] + 7200; i++) { const adv = d > 0 ? (B.l[i] - E) / risk : (E - B.h[i]) / risk; if (adv <= -1) break; mfe = Math.max(mfe, d > 0 ? (B.h[i] - E) / risk : (E - B.l[i]) / risk); }
    row.mfe = mfe; row.r = {};
    for (const [id, , p] of PLANS) row.r[id] = plan(B, i0, d, E, risk, tA, p) - row.costR;
    all.push(row);
  }
}

function block(title, rows) {
  const ok = rows.filter((r) => !r.bad), out = [];
  out.push(`\n## ${title}: ${rows.length} signals (${rows.length - ok.length} unusable: ${rows.filter((r) => r.bad === "target already passed at the signal").length} with the target already passed, ${rows.filter((r) => r.bad === "stop on the wrong side").length} with the stop on the wrong side)`);
  if (!ok.length) return out;
  const app = rows.filter((r) => r.appOutcome === "WIN" || r.appOutcome === "LOSS");
  out.push(`App's own record: ${app.filter((r) => r.appOutcome === "WIN").length} WIN / ${app.filter((r) => r.appOutcome === "LOSS").length} LOSS (${(100 * app.filter((r) => r.appOutcome === "WIN").length / Math.max(1, app.length)).toFixed(0)}% wins), ${rows.filter((r) => r.appOutcome === "TIMEOUT").length} timeouts`);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  out.push(`Median app target ${med(ok.map((r) => r.tA)).toFixed(2)}R from the signal price; median cost ${med(ok.map((r) => r.costR)).toFixed(2)}R; reached before the stop: 0.5R ${(100 * ok.filter((r) => r.mfe >= 0.5).length / ok.length).toFixed(0)}%, 0.8R ${(100 * ok.filter((r) => r.mfe >= 0.8).length / ok.length).toFixed(0)}%, 1R ${(100 * ok.filter((r) => r.mfe >= 1).length / ok.length).toFixed(0)}%`);
  for (const [id, name] of PLANS) { const s = stats(ok.map((r) => r.r[id])); out.push(`  ${id} ${name.padEnd(34)} avg ${f2(s.avg)}R  t ${s.t.toFixed(1)}  win ${(100 * ok.filter((r) => r.r[id] > 0).length / ok.length).toFixed(0)}%`); }
  return out;
}
function calibration(rows) {
  const ok = rows.filter((r) => !r.bad), out = ["\n## Is P(win) a probability? (plan A after cost, by TTI's P(win))"];
  for (const [lo, hi] of [[0, 0.65], [0.65, 0.7], [0.7, 0.75], [0.75, 1.01]]) {
    const g = ok.filter((r) => r.pWin >= lo && r.pWin < hi); if (!g.length) continue;
    out.push(`  P(win) ${lo.toFixed(2)}-${Math.min(hi, 1).toFixed(2)}: n ${g.length}, stated ${(100 * g.reduce((a, r) => a + r.pWin, 0) / g.length).toFixed(0)}%, actual wins ${(100 * g.filter((r) => r.r.A > 0).length / g.length).toFixed(0)}%, avg ${f2(stats(g.map((r) => r.r.A)).avg)}R`);
  }
  return out;
}

const real = all.filter((r) => r.walk === null), walk = all.filter((r) => r.walk !== null);
const lines = [];
lines.push(...block("REAL DATA, all markets", real));
for (const k of [...new Set(real.map((r) => r.key))]) lines.push(...block(`REAL ${k}`, real.filter((r) => r.key === k)));
for (const y of SPLIT !== null ? ["first half", "second half"] : [2025, 2026]) lines.push(...block(`REAL, ${y}`, real.filter((r) => r.year === y)));
for (const s of [...new Set(real.map((r) => r.setup))]) lines.push(...block(`REAL, setup ${s}`, real.filter((r) => r.setup === s)));
lines.push(...calibration(real));
if (walk.length) lines.push(...block("RANDOM WALK CONTROL (no edge by construction)", walk));
console.log(lines.join("\n"));
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(all));
