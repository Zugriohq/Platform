// Research round 6: minute-level day-trade and scalp rules, exactly as registered in minute_prereg.json.
// node minute.mjs <dir with SYM.m1 files from hdfetch.py>
import fs from "fs";

const DIR = process.argv[2];
const MAP = { EURUSD: "EURUSD", GBPUSD: "GBPUSD", XAUUSD: "XAUUSD", US500: "SPXUSD" };
const COST = { EURUSD: 0.00010, GBPUSD: 0.00015, XAUUSD: 0.35, US500: 0.6 };
const SPLIT = Date.UTC(2025, 9, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000, START = Date.UTC(2024, 9, 1) / 1000;

export function load(sym) {
  const b = fs.readFileSync(`${DIR}/${sym}.m1`), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = f.length / 5;
  const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
  for (let i = 0; i < n; i++) { t[i] = f[5 * i]; o[i] = f[5 * i + 1]; h[i] = f[5 * i + 2]; l[i] = f[5 * i + 3]; c[i] = f[5 * i + 4]; }
  const at = new Map(); for (let i = 0; i < n; i++) at.set(t[i], i);
  return { t, o, h, l, c, n, at };
}

// Wall clocks. UK: last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC. US: second Sunday of March to first Sunday of November, 02:00 local.
const lastSun = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay()); };
const nthSun = (y, m, k) => { const d = new Date(Date.UTC(y, m, 1)); return Date.UTC(y, m, 1 + ((7 - d.getUTCDay()) % 7) + 7 * (k - 1)); };
export const ukOffset = (ts) => { const y = new Date(ts * 1000).getUTCFullYear(), s = lastSun(y, 2) / 1000 + 3600, e = lastSun(y, 9) / 1000 + 3600; return ts >= s && ts < e ? 3600 : 0; };
export const nyOffset = (ts) => { const y = new Date(ts * 1000).getUTCFullYear(), s = nthSun(y, 2, 2) / 1000 + 7 * 3600, e = nthSun(y, 10, 1) / 1000 + 6 * 3600; return ts >= s && ts < e ? -4 * 3600 : -5 * 3600; };
// UTC epoch of a London / New York wall time (date "YYYY-MM-DD", minutes after midnight).
export const ukUtc = (day, mins) => { const w = Date.parse(day + "T00:00:00Z") / 1000 + mins * 60; let u = w - 3600; return ukOffset(u) === 3600 ? u : w; };
export const nyUtc = (day, mins) => { const w = Date.parse(day + "T00:00:00Z") / 1000 + mins * 60; let u = w + 4 * 3600; return nyOffset(u) === -4 * 3600 ? u : w + 5 * 3600; };
const dayStr = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
function days() { const o = []; for (let d = START; d < END; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w >= 1 && w <= 5) o.push(dayStr(d)); } return o; }

// ---- statistics: date-clustered mean ----
function clustered(trades, key = "r") {
  const n = trades.length; if (!n) return { n: 0, mean: 0, t: 0, win: 0 };
  const m = trades.reduce((a, x) => a + x[key], 0) / n, by = new Map();
  for (const x of trades) by.set(x.day, (by.get(x.day) || 0) + (x[key] - m));
  let q = 0; for (const v of by.values()) q += v * v;
  const se = Math.sqrt(q) / n;
  return { n, mean: m, t: se > 0 ? m / se : 0, win: trades.filter((x) => x[key] > 0).length / n };
}

// ---- FX and gold fix reversals (basis points) ----
function fixRule(mk, { sigFrom, sigTo, entry, exit }, monthEndOnly = false) {
  const B = load(MAP[mk]), out = [], ds = days();
  for (let k = 0; k < ds.length; k++) {
    const day = ds[k];
    if (monthEndOnly) { const nx = ds[k + 1]; if (nx && nx.slice(0, 7) === day.slice(0, 7)) continue; }
    const i0 = B.at.get(ukUtc(day, sigFrom - 1)), i1 = B.at.get(ukUtc(day, sigTo - 1)), ie = B.at.get(ukUtc(day, entry)), ix = B.at.get(ukUtc(day, exit));
    if ([i0, i1, ie, ix].some((v) => v === undefined)) continue;
    const sig = B.c[i1] - B.c[i0]; if (sig === 0) continue;
    const pos = -Math.sign(sig), px = B.o[ie], g = (pos * (B.c[ix] - px)) / px * 1e4;
    out.push({ day, ts: B.t[ie], g, cost: (COST[mk] / px) * 1e4 });
  }
  return out;
}

// ---- generic bar walk with TP/SL (stop first when both in one bar; gap-through fills at the open) ----
// dir +1/-1, entry price, sl/tp prices, from bar index j0 (entry bar), last bar index jEnd. skipFirst: in the entry bar only
// count levels on the far side of the move that triggered the entry ("above" for an upward touch).
function walk(B, dir, entry, sl, tp, j0, jEnd, firstBar = "both") {
  for (let j = j0; j <= jEnd && j < B.n; j++) {
    const hiHit = B.h[j], loHit = B.l[j];
    const stopHit = dir > 0 ? loHit <= sl : hiHit >= sl, tpHit = dir > 0 ? hiHit >= tp : loHit <= tp;
    if (j === j0) {
      // In the entry bar only the part of the bar after the entry is known: "up" = the high came after it, "down" = the low.
      const sOk = firstBar === "both" || (firstBar === "up" ? sl > entry : sl < entry), tOk = firstBar === "both" || (firstBar === "up" ? tp > entry : tp < entry);
      if (stopHit && sOk) return { px: sl, j, how: "SL" };
      if (tpHit && tOk) return { px: tp, j, how: "TP" };
      continue;
    }
    if (stopHit) { const gap = dir > 0 ? B.o[j] < sl : B.o[j] > sl; return { px: gap ? B.o[j] : sl, j, how: "SL" }; }
    if (tpHit) { const gap = dir > 0 ? B.o[j] > tp : B.o[j] < tp; return { px: gap ? B.o[j] : tp, j, how: "TP" }; }
  }
  const j = Math.min(jEnd, B.n - 1); return { px: B.c[j], j, how: "TIME" };
}

// ---- one-minute shock fade / follow ----
function shock(mk, follow) {
  const B = load(MAP[mk]), cost = COST[mk], out = [];
  const contiguous = (j) => j > 0 && B.t[j] - B.t[j - 1] === 60;
  let run = 0, sum = 0, sum2 = 0, win = [], blockUntil = 0;
  for (let i = 1; i < B.n - 31; i++) {
    if (B.t[i] < START || B.t[i] >= END) continue;
    if (B.t[i] - B.t[i - 1] > 6 * 3600) blockUntil = B.t[i] + 1800;
    if (!contiguous(i)) { win = []; sum = sum2 = 0; continue; }
    const dc = B.c[i] - B.c[i - 1];
    if (win.length === 60 && B.t[i] >= blockUntil && contiguous(i + 1)) {
      const mean = sum / 60, sd = Math.sqrt(Math.max(0, sum2 / 60 - mean * mean) * 60 / 59);
      if (Math.abs(dc) > 4 * sd && Math.abs(dc) > 3 * cost) {
        const S = Math.abs(dc), dir = (follow ? 1 : -1) * Math.sign(dc), e = B.o[i + 1];
        const sl = e - dir * 0.75 * S, tp = e + dir * 0.5 * S;
        const x = walk(B, dir, e, sl, tp, i + 1, i + 30);
        out.push({ day: dayStr(B.t[i]), ts: B.t[i], r: (dir * (x.px - e) - cost) / (0.75 * S), g: (dir * (x.px - e)) / (0.75 * S), costR: cost / (0.75 * S) });
        // one trade at a time: restart after the exit, with a fresh window
        i = x.j; win = []; sum = sum2 = 0; continue;
      }
    }
    win.push(dc); sum += dc; sum2 += dc * dc;
    if (win.length > 60) { const z = win.shift(); sum -= z; sum2 -= z * z; }
  }
  return out;
}

// ---- opening-range breakout ----
function orb(mk) {
  const B = load(MAP[mk]), cost = COST[mk], out = [], ny = mk === "US500";
  const toUtc = ny ? nyUtc : ukUtc, r0 = ny ? 570 : 480;
  for (const day of days()) {
    let rh = -Infinity, rl = Infinity, cnt = 0;
    for (let m = r0; m < r0 + 30; m++) { const i = B.at.get(toUtc(day, m)); if (i === undefined) continue; cnt++; rh = Math.max(rh, B.h[i]); rl = Math.min(rl, B.l[i]); }
    if (cnt < 25 || !(rh > rl)) continue;
    let jEnd = -1;
    for (let m = 719; m >= r0 + 30; m--) { const i = B.at.get(toUtc(day, m)); if (i !== undefined) { jEnd = i; break; } }
    if (jEnd < 0) continue;
    let iStart; for (let m = r0 + 30; m <= 719 && iStart === undefined; m++) iStart = B.at.get(toUtc(day, m));
    for (let j = iStart; j <= jEnd; j++) {
      const up = B.h[j] > rh, dn = B.l[j] < rl;
      if (!up && !dn) continue;
      if (up && dn) break;                                   // both sides in one bar: no trade
      const dir = up ? 1 : -1, e = up ? Math.max(rh, B.o[j]) : Math.min(rl, B.o[j]), sl = up ? rl : rh, R = Math.abs(e - sl), tp = e + dir * (rh - rl);
      const x = walk(B, dir, e, sl, tp, j, jEnd, up ? "up" : "down");
      out.push({ day, ts: B.t[j], r: (dir * (x.px - e) - cost) / R, g: (dir * (x.px - e)) / R, costR: cost / R });
      break;
    }
  }
  return out;
}

// ---- first touch of the previous day's high / low ----
function priorDay(mk, mode) {
  const B = load(MAP[mk]), cost = COST[mk], out = [], cash = mk === "US500";
  // Trading days: FX/gold = New York 17:00 to 17:00 (labelled by the closing date); US500 = 09:30-16:00 New York.
  const sess = [];
  for (const day of days()) {
    const a = cash ? nyUtc(day, 570) : nyUtc(day, 17 * 60) - 86400, b = cash ? nyUtc(day, 960) : nyUtc(day, 17 * 60);
    let i = B.at.get(a); if (i === undefined) { for (let tt = a; tt <= a + 7200 && i === undefined; tt += 60) i = B.at.get(tt); /* gold and FX reopen after the 17:00-18:00 break */ } if (i === undefined) continue;
    let j = i, hi = -Infinity, lo = Infinity; while (j < B.n && B.t[j] < b) { hi = Math.max(hi, B.h[j]); lo = Math.min(lo, B.l[j]); j++; }
    if (j - i < (cash ? 300 : 1000)) continue;
    sess.push({ day, i, j: j - 1, hi, lo, from: cash ? a : nyUtc(day, 120) });
  }
  for (let k = 15; k < sess.length; k++) {
    const p = sess[k - 1], s = sess[k], atr = sess.slice(k - 14, k).reduce((a, x) => a + (x.hi - x.lo), 0) / 14, d = 0.25 * atr;
    for (const side of ["H", "L"]) {
      const lvl = side === "H" ? p.hi : p.lo;
      let touched = false;
      for (let j = s.i; j <= s.j; j++) {
        const hit = side === "H" ? B.h[j] >= lvl : B.l[j] <= lvl;
        if (!hit) continue;
        const gapped = side === "H" ? B.o[j] > lvl : B.o[j] < lvl;
        if (touched || B.t[j] < s.from || gapped) break;     // first touch was earlier, before 02:00, or a gap through
        touched = true;
        const towards = side === "H" ? 1 : -1, dir = mode === "FADE" ? -towards : towards, e = lvl;
        const x = walk(B, dir, e, e - dir * d, e + dir * d, j, j + 240, side === "H" ? "up" : "down");
        out.push({ day: s.day, ts: B.t[j], r: (dir * (x.px - e) - cost) / d, g: (dir * (x.px - e)) / d, costR: cost / d });
        break;
      }
    }
  }
  return out;
}

// ---- report ----
function report(name, unit, byMk, groups) {
  const lines = [], verdicts = [];
  for (const [g, mks] of groups) {
    const all = mks.flatMap((m) => byMk[m] || []);
    const rows = [];
    for (const mult of [1, 0.5, 2]) {
      const net = all.map((x) => ({ ...x, r: unit === "bp" ? x.g - mult * x.cost : x.g - mult * x.costR }));
      rows.push({ mult, d: clustered(net.filter((x) => x.ts < SPLIT)), t: clustered(net.filter((x) => x.ts >= SPLIT)) });
    }
    const gross = clustered(all.map((x) => ({ ...x, r: x.g })));
    const base = rows[0], pass = base.d.mean > 0 && base.d.t >= 2 && base.t.mean > 0 && base.t.t >= 2;
    verdicts.push(pass);
    const f = (s) => `n ${s.n} ${unit === "bp" ? "" : "win " + (100 * s.win).toFixed(0) + "% "}net ${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(3)}${unit} t ${s.t.toFixed(1)}`;
    lines.push(`${name} ${g}: gross ${gross.mean >= 0 ? "+" : ""}${gross.mean.toFixed(3)}${unit} (t ${gross.t.toFixed(1)}) | DESIGN ${f(base.d)} | TEST ${f(base.t)} | cost x0.5 test ${rows[1].t.mean.toFixed(3)} / x2 test ${rows[2].t.mean.toFixed(3)} | ${pass ? "PASS" : "fail"}`);
  }
  return lines;
}

if (process.argv[1] && process.argv[1].endsWith("minute.mjs")) {
  const fx = [["FX", ["EURUSD", "GBPUSD"]]], allG = [["FX", ["EURUSD", "GBPUSD"]], ["gold", ["XAUUSD"]], ["US500", ["US500"]]];
  const out = [];
  const fixW = { sigFrom: 930, sigTo: 960, entry: 963, exit: 1019 };
  out.push(...report("FIX_REVERSAL", "bp", { EURUSD: fixRule("EURUSD", fixW), GBPUSD: fixRule("GBPUSD", fixW) }, fx));
  out.push(...report("FIX_REVERSAL month-end (secondary)", "bp", { EURUSD: fixRule("EURUSD", fixW, true), GBPUSD: fixRule("GBPUSD", fixW, true) }, fx));
  out.push(...report("GOLD_FIX_REVERSAL", "bp", { XAUUSD: fixRule("XAUUSD", { sigFrom: 870, sigTo: 900, entry: 905, exit: 959 }) }, [["gold", ["XAUUSD"]]]));
  const mk4 = ["EURUSD", "GBPUSD", "XAUUSD", "US500"];
  const sf = {}, sfo = {}, ob = {}, pf = {}, pb = {};
  for (const m of mk4) { sf[m] = shock(m, false); sfo[m] = shock(m, true); ob[m] = orb(m); pf[m] = priorDay(m, "FADE"); pb[m] = priorDay(m, "BREAK"); }
  out.push(...report("SHOCK_FADE", "R", sf, allG));
  out.push(...report("SHOCK_FOLLOW (secondary)", "R", sfo, allG));
  out.push(...report("OPENING_RANGE_BREAKOUT", "R", ob, allG));
  out.push(...report("PRIOR_DAY_LEVEL FADE", "R", pf, allG));
  out.push(...report("PRIOR_DAY_LEVEL BREAK", "R", pb, allG));
  console.log(out.join("\n"));
}
