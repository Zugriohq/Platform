// pro_trader_prereg.json: one frozen "model pro trader" playbook (top-down context, regime, trend pullback, range fade,
// London breakout, partial at 1R + breakeven, time stops, session and news filters) run unchanged on every market,
// against a random-direction trader with the same entries' timing, stops and management.
// node pro_trader.mjs <SYN|FX|GOLD> <out.json> <fomc.json> <EURUSD.m1 for NFP/CPI days or -> SYMBOL=file=cost[=costPct] ...
//   cost: round-trip cost in price (spread + slippage); costPct: % of price, the larger of the two is used
import fs from "fs";
const [GROUP, OUT, FOMC_PATH, EUR_PATH, ...specs] = process.argv.slice(2);
const SYN = GROUP === "SYN", TREND_SEC = SYN ? 4 * 3600 : 86400, CUT = SYN ? 0 : 21, HOLD = (SYN ? 24 : 72) * 3600;

function loadM1(p) { const b = fs.readFileSync(p), a = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = a.length / 5;
  const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
  for (let i = 0; i < n; i++) { t[i] = a[5 * i]; o[i] = a[5 * i + 1]; h[i] = a[5 * i + 2]; l[i] = a[5 * i + 3]; c[i] = a[5 * i + 4]; } return { t, o, h, l, c, n }; }
function agg(M, sec, cutHour) {
  const off = sec >= 86400 ? ((24 - cutHour) % 24) * 3600 : 0, B = [];
  for (let i = 0; i < M.n; i++) { const s = Math.floor((M.t[i] + off) / sec) * sec - off, x = B.at(-1);
    if (x && x.s === s) { x.h = Math.max(x.h, M.h[i]); x.l = Math.min(x.l, M.l[i]); x.c = M.c[i]; } else B.push({ s, e: s + sec, o: M.o[i], h: M.h[i], l: M.l[i], c: M.c[i] }); }
  return B;
}
const ema = (B, n) => { const k = 2 / (n + 1), v = new Float64Array(B.length); let e = B[0]?.c ?? 0; B.forEach((b, i) => { e = i ? e + k * (b.c - e) : b.c; v[i] = e; }); return v; };
function wilder(B) {   // ATR14, ADX14, RSI14
  const n = B.length, atr = new Float64Array(n), adx = new Float64Array(n), rsi = new Float64Array(n);
  let a = 0, pdm = 0, ndm = 0, dx = 0, up = 0, dn = 0;
  for (let i = 1; i < n; i++) {
    const tr = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
    const u = B[i].h - B[i - 1].h, d = B[i - 1].l - B[i].l, pd = u > d && u > 0 ? u : 0, nd = d > u && d > 0 ? d : 0;
    const ch = B[i].c - B[i - 1].c, g = Math.max(0, ch), lo = Math.max(0, -ch), w = i < 14 ? 1 / i : 1 / 14;
    a += w * (tr - a); pdm += w * (pd - pdm); ndm += w * (nd - ndm); up += w * (g - up); dn += w * (lo - dn);
    const pdi = a > 0 ? 100 * pdm / a : 0, ndi = a > 0 ? 100 * ndm / a : 0, x = pdi + ndi > 0 ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
    dx += w * (x - dx); atr[i] = a; adx[i] = dx; rsi[i] = dn > 0 ? 100 - 100 / (1 + up / dn) : 100;
  }
  return { atr, adx, rsi };
}
function boll(B, n = 20) { const mid = new Float64Array(B.length), sd = new Float64Array(B.length);
  for (let i = n - 1; i < B.length; i++) { let s = 0, q = 0; for (let k = i - n + 1; k <= i; k++) { s += B[k].c; q += B[k].c * B[k].c; } const m = s / n; mid[i] = m; sd[i] = Math.sqrt(Math.max(0, q / n - m * m)); } return { mid, sd }; }
// index of the last bar of B closed at or before T (B sorted by e)
const lastClosed = (B, T, hint) => { let i = hint.i; while (i + 1 < B.length && B[i + 1].e <= T) i++; hint.i = i; return B[i] && B[i].e <= T ? i : -1; };

// news days (forex, gold): FOMC from the Fed's list; NFP / CPI reconstructed from EURUSD's 08:30 New York minute (news.mjs)
const ny = (y, m, d, hh, mm) => { const ns = (M, k) => { const f = new Date(Date.UTC(y, M, 1)).getUTCDay(); return 1 + ((7 - f) % 7) + 7 * (k - 1); }; const t = Date.UTC(y, m, d, hh, mm) / 1000; return t + (t >= Date.UTC(y, 2, ns(2, 2), 2) / 1000 && t < Date.UTC(y, 10, ns(10, 1), 2) / 1000 ? 4 : 5) * 3600; };
const fomcDays = new Set(JSON.parse(fs.readFileSync(FOMC_PATH, "utf8"))), dataDays = new Set();
if (!SYN && EUR_PATH !== "-") {
  const E = loadM1(EUR_PATH), rng = new Map(); for (let i = 0; i < E.n; i++) rng.set(E.t[i], E.h[i] - E.l[i]);
  const pad = (x) => String(x).padStart(2, "0");
  for (let y = 2010; y <= 2026; y++) for (let m = 0; m < 12; m++) {
    const pick = (lo, hi, fri, not) => { let best = null; for (let d = lo; d <= hi; d++) { const wd = new Date(Date.UTC(y, m, d)).getUTCDay(); if ((fri ? wd === 5 : wd >= 1 && wd <= 5) && d !== not) { const r = rng.get(ny(y, m, d, 8, 30)); if (r != null && (!best || r > best.r)) best = { d, r }; } } return best; };
    const f = pick(1, 10, true, -1); if (f) dataDays.add(`${y}-${pad(m + 1)}-${pad(f.d)}`);
    const c = pick(9, 16, false, f ? f.d : -1); if (c) dataDays.add(`${y}-${pad(m + 1)}-${pad(c.d)}`);
  }
}
const isoDay = (T) => new Date(T * 1000).toISOString().slice(0, 10);
function newsBlocked(T) {
  if (SYN) return false;
  const h = new Date(T * 1000).getUTCHours(), d = isoDay(T);
  return (fomcDays.has(d) && h >= 17) || (dataDays.has(d) && h >= 12 && h < 15);
}

// a trade walked on M1 from index k0 (entry at M[k0].o). setup: A (partial at 1R, rest 3R, BE), B (one target), C (2R, exit at a time)
function walk(M, k0, dir, stop, target1, target2, exitT, partial) {
  const e = M.o[k0], risk = Math.abs(e - stop); let sl = stop, half = false, got = 0;
  for (let k = k0; k < M.n && M.t[k] < exitT; k++) {
    const hitS = dir > 0 ? M.l[k] <= sl : M.h[k] >= sl;
    if (hitS) { const px = k > k0 && (dir > 0 ? M.o[k] < sl : M.o[k] > sl) ? M.o[k] : sl; const r = dir * (px - e) / risk; return { r: half ? got + 0.5 * r : r, exitT: M.t[k] + 60, how: "stop" }; }
    if (partial && !half && (dir > 0 ? M.h[k] >= target1 : M.l[k] <= target1)) { half = true; got = 0.5 * dir * (target1 - e) / risk; sl = e; }
    const tg = partial ? target2 : target1;
    if ((!partial || half) && (dir > 0 ? M.h[k] >= tg : M.l[k] <= tg)) { const px = k > k0 && (dir > 0 ? M.o[k] > tg : M.o[k] < tg) ? M.o[k] : tg; const r = dir * (px - e) / risk; return { r: half ? got + 0.5 * r : r, exitT: M.t[k] + 60, how: "target" }; }
  }
  let k = k0; while (k + 1 < M.n && M.t[k + 1] < exitT) k++;
  const r = dir * (M.c[k] - e) / risk; return { r: half ? got + 0.5 * r : r, exitT: M.t[k] + 60, how: "time" };
}

let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const trades = [];
for (const spec of specs) {
  const [sym, file, costAbs, costPct] = spec.split("=");
  const M = loadM1(file); if (M.n < 20000) { console.error(`${sym}: too little data`); continue; }
  const B15 = agg(M, 900, 0), H1 = agg(M, 3600, 0), TT = agg(M, TREND_SEC, CUT);
  const tE20 = ema(TT, 20), tE50 = ema(TT, 50), hE20 = ema(H1, 20), W = wilder(H1), BB = boll(H1);
  const firstM1AtOrAfter = (T) => { let lo = 0, hi = M.n; while (lo < hi) { const m = (lo + hi) >> 1; if (M.t[m] < T) lo = m + 1; else hi = m; } return lo; };
  const hH = { i: 0 }, hT = { i: 0 }; let busyUntil = 0, cDay = "", cDone = false, asia = null;
  for (let j = 1; j + 1 < B15.length; j++) {
    const b = B15[j], T = b.e;   // decide at this M15 bar's close
    const day = isoDay(b.s), hour = new Date(b.s * 1000).getUTCHours();
    if (day !== cDay) { cDay = day; cDone = false; asia = null; }
    if (!SYN && hour >= 7 && asia === null) {   // the Asian range of this UTC day, once 07:00 is reached
      const a0 = firstM1AtOrAfter(Date.parse(day + "T00:00:00Z") / 1000), a1 = firstM1AtOrAfter(Date.parse(day + "T07:00:00Z") / 1000);
      let hi = -Infinity, lo = Infinity; for (let k = a0; k < a1; k++) { hi = Math.max(hi, M.h[k]); lo = Math.min(lo, M.l[k]); }
      asia = a1 - a0 >= 200 ? { hi, lo } : false;
    }
    const ih = lastClosed(H1, T, hH), it = lastClosed(TT, T, hT); if (ih < 60 || it < 60) continue;
    if (T < busyUntil) continue;
    if (!SYN && (hour < 7 || hour >= 17 || newsBlocked(T))) continue;
    const trend = tE20[it] > tE50[it] && TT[it].c > tE50[it] ? 1 : tE20[it] < tE50[it] && TT[it].c < tE50[it] ? -1 : 0;
    const adx = W.adx[ih], atr = W.atr[ih]; if (!(atr > 0)) continue;
    const prev = B15[j - 1]; let setup = null, dir = 0;
    if (!SYN && !cDone && asia && hour >= 7 && hour < 10 && trend !== 0) {
      if (trend > 0 && b.c > asia.hi) setup = "C", dir = 1; else if (trend < 0 && b.c < asia.lo) setup = "C", dir = -1;
      if (setup) cDone = true;
    }
    if (!setup && trend !== 0 && adx > 22) {
      if (trend > 0 && b.l <= hE20[ih] && b.c > prev.h) setup = "A", dir = 1;
      if (trend < 0 && b.h >= hE20[ih] && b.c < prev.l) setup = "A", dir = -1;
    }
    if (!setup && trend === 0 && adx < 18 && BB.sd[ih] > 0) {
      const hc = H1[ih].c, up = BB.mid[ih] + 2 * BB.sd[ih], lo = BB.mid[ih] - 2 * BB.sd[ih];
      if (hc < lo && W.rsi[ih] < 30 && b.c > b.o) setup = "B", dir = 1;
      if (hc > up && W.rsi[ih] > 70 && b.c < b.o) setup = "B", dir = -1;
    }
    if (!setup) continue;
    const k0 = firstM1AtOrAfter(T); if (k0 >= M.n || M.t[k0] - T > 3600) continue;
    const e = M.o[k0], cost = Math.max(+costAbs, costPct ? (+costPct / 100) * e : 0);
    const plan = (d) => {   // stop and targets for direction d
      if (setup === "A") { const s = e - d * 1.5 * atr, R = Math.abs(e - s); return { s, t1: e + d * R, t2: e + d * 3 * R, exitT: T + HOLD, partial: true }; }
      if (setup === "B") { const s = e - d * 1 * atr, dist = Math.abs(BB.mid[ih] - e); return { s, t1: e + d * dist, t2: 0, exitT: T + HOLD, partial: false, ok: d * (BB.mid[ih] - e) > 0 || d !== dir }; }
      // the far side of the Asian range or 1.5 ATR, whichever is nearer (the control mirrors the same distance)
      const R = Math.min(Math.abs(e - (dir > 0 ? asia.lo : asia.hi)), 1.5 * atr), s = e - d * R;
      return { s, t1: e + d * 2 * R, t2: 0, exitT: Math.min(Date.parse(day + "T16:00:00Z") / 1000, T + HOLD), partial: false };
    };
    const p = plan(dir); if (p.ok === false || Math.abs(e - p.s) <= 0) continue;
    if (dir > 0 ? e <= p.s : e >= p.s) continue;
    const w = walk(M, k0, dir, p.s, p.t1, p.t2, p.exitT, p.partial), risk = Math.abs(e - p.s);
    const cd = rnd() < 0.5 ? 1 : -1, pc = plan(cd), wc = walk(M, k0, cd, pc.s, pc.t1, pc.t2, pc.exitT, pc.partial), riskC = Math.abs(e - pc.s);
    trades.push({ sym, setup, t: T, dir, r: w.r - cost / risk, gross: w.r, ctrl: wc.r - cost / riskC, costR: cost / risk, how: w.how, hold: (w.exitT - T) / 3600 });
    busyUntil = w.exitT;
  }
  console.error(`${GROUP} ${sym}: ${trades.filter((x) => x.sym === sym).length} trades`);
}
fs.writeFileSync(OUT, JSON.stringify(trades));

// ---- summary ----
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}R (t ${s.t.toFixed(1)}, n ${s.n})` : `n ${s.n}`);
const pf = (v) => { const g = v.filter((x) => x > 0).reduce((a, x) => a + x, 0), l = -v.filter((x) => x < 0).reduce((a, x) => a + x, 0); return l > 0 ? (g / l).toFixed(2) : "inf"; };
const dd = (v) => { let c = 0, p = 0, d = 0; for (const x of v) { c += x; p = Math.max(p, c); d = Math.max(d, p - c); } return d; };
const syms = [...new Set(trades.map((x) => x.sym))];
const mid = {}; for (const s of syms) { const ts = trades.filter((x) => x.sym === s).map((x) => x.t); mid[s] = SYN ? (Math.min(...ts) + Math.max(...ts)) / 2 : Date.UTC(2018, 0, 1) / 1000; }
const half = (x) => (x.t < mid[x.sym] ? 0 : 1);
const years = trades.length ? (Math.max(...trades.map((x) => x.t)) - Math.min(...trades.map((x) => x.t))) / (365.25 * 86400) : 1;
const out = [];
for (const setup of ["ALL", "A", "B", "C"]) {
  const v = trades.filter((x) => setup === "ALL" || x.setup === setup).sort((a, b) => a.t - b.t); if (v.length < 3) continue;
  const h = [0, 1].map((k) => st(v.filter((x) => half(x) === k).map((x) => x.r))), ch = [0, 1].map((k) => st(v.filter((x) => half(x) === k).map((x) => x.ctrl)));
  const pass = h.every((s) => s.m > 0 && s.t >= 2) && [0, 1].every((k) => h[k].m > ch[k].m);
  out.push(`${GROUP} ${setup === "ALL" ? "ALL SETUPS" : "setup " + setup}: net ${f(st(v.map((x) => x.r)))} | halves ${f(h[0])} / ${f(h[1])} | random-direction control ${f(st(v.map((x) => x.ctrl)))} | ` +
    `before costs ${f(st(v.map((x) => x.gross)))}, cost ${st(v.map((x) => x.costR)).m.toFixed(3)}R/trade | win ${(100 * v.filter((x) => x.r > 0).length / v.length).toFixed(0)}%, PF ${pf(v.map((x) => x.r))}, ` +
    `${(v.reduce((a, x) => a + x.r, 0) / (SYN ? syms.length * 90 / 365 : years * syms.length)).toFixed(1)}R/yr per market, max drawdown ${dd(v.map((x) => x.r)).toFixed(1)}R` + (setup === "ALL" ? ` -> ${pass ? "PASS" : "fail"}` : ""));
}
out.push("per market (all setups, net): " + syms.map((s) => `${s} ${f(st(trades.filter((x) => x.sym === s).map((x) => x.r)))}`).join("; "));
console.log(out.join("\n"));
