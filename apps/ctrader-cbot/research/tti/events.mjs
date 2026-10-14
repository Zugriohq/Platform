// TTI information study (events_prereg.json): does the information TTI's entry model uses change what price does next?
// node events.mjs <dir with SYM.m1 files from hdfetch.py>
import fs from "fs";

const DIR = process.argv[2];
// Bar size in seconds (300 = M5, the registered run; 3600 = H1, amendment 1). The trend filter uses EMA50 of H1 on
// M5 and EMA200 of H1 on H1, so it is always a higher timeframe than the bars.
const TF = +(process.argv[3] || 300);
const MARKETS = { EURUSD: 0.0001, GBPUSD: 0.00015, USDJPY: 0.012, XAUUSD: 0.35, SPXUSD: 0.6 };
const SPLIT = Date.UTC(2026, 0, 1) / 1000, START = Date.UTC(2024, 9, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000;
const STOP = 1.0, TARGET = 1.5, HOLD = 48;

function bars(sym, sec) {
  const b = fs.readFileSync(`${DIR}/${sym}.m1`), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8);
  const t = [], o = [], h = [], l = [], c = [];
  for (let i = 0; i < f.length; i += 5) {
    const k = Math.floor(f[i] / sec) * sec;
    if (t.length && t[t.length - 1] === k) { const j = t.length - 1; h[j] = Math.max(h[j], f[i + 2]); l[j] = Math.min(l[j], f[i + 3]); c[j] = f[i + 4]; }
    else { t.push(k); o.push(f[i + 1]); h.push(f[i + 2]); l.push(f[i + 3]); c.push(f[i + 4]); }
  }
  return { t, o, h, l, c, n: t.length };
}

function prepare(sym) {
  const B = bars(sym, TF), H1 = bars(sym, 3600), n = B.n, EMA = TF >= 3600 ? 200 : 50;
  // ATR14 (Wilder) on M5
  const atr = new Float64Array(n); let a = 0;
  for (let i = 1; i < n; i++) { const tr = Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - B.c[i - 1]), Math.abs(B.l[i] - B.c[i - 1])); a = i <= 14 ? (a * (i - 1) + tr) / i : (a * 13 + tr) / 14; atr[i] = a; }
  // H1 EMA50 trend, as of the last H1 bar closed by each M5 bar's close
  const ema = new Float64Array(H1.n); let e = H1.c[0];
  for (let i = 0; i < H1.n; i++) { e = i === 0 ? H1.c[0] : e + (2 / (EMA + 1)) * (H1.c[i] - e); ema[i] = e; }
  const htf = new Int8Array(n); let p = -1;
  for (let i = 0; i < n; i++) { const closeT = B.t[i] + TF; while (p + 1 < H1.n && H1.t[p + 1] + 3600 <= closeT) p++; htf[i] = p >= EMA ? Math.sign(H1.c[p] - ema[p]) : 0; }
  // directional efficiency over 48 bars
  const er = new Float64Array(n); let path = 0;
  for (let i = 1; i < n; i++) { path += Math.abs(B.c[i] - B.c[i - 1]); if (i > 48) path -= Math.abs(B.c[i - 48] - B.c[i - 49]); er[i] = i >= 48 && path > 0 ? Math.abs(B.c[i] - B.c[i - 48]) / path : NaN; }
  return { B, atr, htf, er, cost: MARKETS[sym] };
}

// Trade from bar j0: market entry at its open (fill = undefined) or a limit fill inside it (fill price given; then
// only the stop counts in that bar, since the bar's other extreme may have come before the fill).
function walk(M, dir, j0, a, fill) {
  const { B } = M, e = fill ?? B.o[j0], sl = e - dir * STOP * a, tp = e + dir * TARGET * a;
  for (let j = j0; j < B.n && j < j0 + HOLD; j++) {
    const stopHit = dir > 0 ? B.l[j] <= sl : B.h[j] >= sl, tpHit = dir > 0 ? B.h[j] >= tp : B.l[j] <= tp;
    if (stopHit) { const px = j > j0 && (dir > 0 ? B.o[j] < sl : B.o[j] > sl) ? B.o[j] : sl; return { g: dir * (px - e) / a, exit: j }; }
    if (tpHit && !(fill !== undefined && j === j0)) { const px = j > j0 && (dir > 0 ? B.o[j] > tp : B.o[j] < tp) ? B.o[j] : tp; return { g: dir * (px - e) / a, exit: j }; }
  }
  const j = Math.min(B.n - 1, j0 + HOLD - 1); return { g: dir * (B.c[j] - e) / a, exit: j };
}

// Base events with the features their variants filter on.
function events(M) {
  const { B, atr, htf, er } = M, n = B.n, ev = { E1: [], E2: [], E3: [], E4: [], E5: [], R0: [] };
  let sh = NaN, sl = NaN, seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const add = (k, i, dir, j0, fill, extra) => {
    const a = atr[i]; if (!(a > 0) || j0 >= n || B.t[i] < START || B.t[i] >= END) return;
    const r = walk(M, dir, j0, a, fill);
    ev[k].push({ ts: B.t[i], day: Math.floor(B.t[i] / 86400), dir, g: r.g, net: r.g - M.cost / a, exit: r.exit, start: j0,
      htfAgree: htf[i] === dir, er: er[i], hour: new Date(B.t[i] * 1000).getUTCHours(), ...extra });
  };
  for (let i = 25; i < n - 2; i++) {
    // swing points confirmed at i (fractal 3 at i-3)
    const j = i - 3;
    if (B.h[j] > Math.max(B.h[j - 1], B.h[j - 2], B.h[j - 3], B.h[j + 1], B.h[j + 2], B.h[j + 3])) sh = B.h[j];
    if (B.l[j] < Math.min(B.l[j - 1], B.l[j - 2], B.l[j - 3], B.l[j + 1], B.l[j + 2], B.l[j + 3])) sl = B.l[j];
    const a = atr[i], body = Math.abs(B.c[i] - B.o[i]), rng = B.h[i] - B.l[i];
    // E1 / E2: break of structure on the close
    for (const [dir, lvl] of [[1, sh], [-1, sl]]) {
      if (!(lvl > 0) || !(dir > 0 ? B.c[i] > lvl && B.c[i - 1] <= lvl : B.c[i] < lvl && B.c[i - 1] >= lvl)) continue;
      const loc = rng > 0 ? (dir > 0 ? (B.c[i] - B.l[i]) / rng : (B.h[i] - B.c[i]) / rng) : 0;
      add("E1", i, dir, i + 1, undefined, { disp: body >= a, closeLoc: loc >= 0.75 });
      const k = i + 3;
      if (k < n - 1 && (dir > 0 ? B.c[k] > lvl : B.c[k] < lvl)) add("E2", k, dir, k + 1, undefined, {});
    }
    // E3: sweep of the prior 20-bar extreme, closed back inside: reverse
    let hi = -Infinity, lo = Infinity; for (let q = i - 20; q < i; q++) { hi = Math.max(hi, B.h[q]); lo = Math.min(lo, B.l[q]); }
    if (B.h[i] > hi && B.c[i] < hi) add("E3", i, -1, i + 1, undefined, { shallow: B.h[i] - hi <= 0.5 * a });
    if (B.l[i] < lo && B.c[i] > lo) add("E3", i, 1, i + 1, undefined, { shallow: lo - B.l[i] <= 0.5 * a });
    // E4: fair-value gap after a displacement bar; first return to the gap midpoint within 24 bars
    for (const dir of [1, -1]) {
      const gap = dir > 0 ? B.l[i] > B.h[i - 2] : B.h[i] < B.l[i - 2];
      if (!gap || Math.abs(B.c[i - 1] - B.o[i - 1]) < atr[i - 1]) continue;
      const mid = dir > 0 ? (B.l[i] + B.h[i - 2]) / 2 : (B.h[i] + B.l[i - 2]) / 2;
      for (let k = i + 1; k <= i + 24 && k < n - 1; k++) {
        const touched = dir > 0 ? B.l[k] <= mid : B.h[k] >= mid;
        if (!touched) continue;
        const fill = dir > 0 ? Math.min(B.o[k], mid) : Math.max(B.o[k], mid);
        // the event is known when the gap formed; features at the fill bar's open are those of the previous close
        add("E4", k - 1, dir, k, fill, {});
        break;
      }
    }
    // E5: 12-bar momentum burst
    if (i >= 12 && a > 0) { const r12 = B.c[i] - B.c[i - 12]; if (Math.abs(r12) >= 2 * a * Math.sqrt(12)) add("E5", i, Math.sign(r12), i + 1, undefined, {}); }
    // R0: control, every 12th bar in a random direction
    if (i % 12 === 0) add("R0", i, rnd() < 0.5 ? 1 : -1, i + 1, undefined, {});
  }
  return ev;
}

// One open trade at a time per variant and market.
function nonOverlap(list) { const out = []; let busyTo = -1; for (const x of list.sort((p, q) => p.ts - q.ts)) { if (x.start <= busyTo) continue; out.push(x); busyTo = x.exit; } return out; }
function clustered(v, key) {
  const n = v.length; if (n < 2) return { n, mean: 0, t: 0 };
  const m = v.reduce((s, x) => s + x[key], 0) / n, by = new Map();
  for (const x of v) by.set(x.day, (by.get(x.day) || 0) + (x[key] - m));
  let q = 0; for (const s of by.values()) q += s * s; const se = Math.sqrt(q) / n;
  return { n, mean: m, t: se > 0 ? m / se : 0 };
}

const VARIANTS = [
  ["E1 BOS: all", "E1", () => true],
  ["E1 BOS +displacement", "E1", (x) => x.disp],
  ["E1 BOS +close location", "E1", (x) => x.closeLoc],
  ["E1 BOS +HTF agrees", "E1", (x) => x.htfAgree],
  ["E1 BOS +trend regime", "E1", (x) => x.er >= 0.3],
  ["E1 BOS +range regime", "E1", (x) => x.er < 0.15],
  ["E2 BOS accepted: all", "E2", () => true],
  ["E2 BOS accepted +HTF agrees", "E2", (x) => x.htfAgree],
  ["E3 sweep-reclaim: all", "E3", () => true],
  ["E3 sweep-reclaim +shallow", "E3", (x) => x.shallow],
  ["E3 sweep-reclaim +HTF agrees", "E3", (x) => x.htfAgree],
  ["E3 sweep-reclaim +range regime", "E3", (x) => x.er < 0.15],
  ["E4 FVG retrace: all", "E4", () => true],
  ["E4 FVG retrace +HTF agrees", "E4", (x) => x.htfAgree],
  ["E4 FVG retrace +trend regime", "E4", (x) => x.er >= 0.3],
  ["E5 momentum FOLLOW: all", "E5", () => true],
  ["E5 momentum FOLLOW +London/NY", "E5", (x) => x.hour >= 7 && x.hour < 17],
  ["E5 momentum FADE: all", "E5F", () => true],
  ["E5 momentum FADE +London/NY", "E5F", (x) => x.hour >= 7 && x.hour < 17],
];

const all = {};
for (const sym of Object.keys(MARKETS)) {
  const M = prepare(sym), ev = events(M);
  // FADE: the same momentum events in the other direction, traded with the same geometry
  ev.E5F = []; for (const x of ev.E5) { const r = walk(M, -x.dir, x.start, M.atr[x.start - 1]); ev.E5F.push({ ...x, dir: -x.dir, g: r.g, net: r.g - M.cost / M.atr[x.start - 1], exit: r.exit }); }
  all[sym] = ev;
  process.stderr.write(`${sym}: ${M.B.n} ${TF}-second bars, events E1 ${ev.E1.length} E2 ${ev.E2.length} E3 ${ev.E3.length} E4 ${ev.E4.length} E5 ${ev.E5.length}\n`);
}
const f = (s) => `${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(3)} (t ${s.t.toFixed(1)}, n ${s.n})`;
const lines = ["variant | DESIGN gross | DESIGN net | TEST gross | TEST net | verdict"];
const ctl = Object.keys(MARKETS).flatMap((s) => nonOverlap(all[s].R0));
lines.push(`R0 control, random direction | ${f(clustered(ctl.filter((x) => x.ts < SPLIT), "g"))} | ${f(clustered(ctl.filter((x) => x.ts < SPLIT), "net"))} | ${f(clustered(ctl.filter((x) => x.ts >= SPLIT), "g"))} | ${f(clustered(ctl.filter((x) => x.ts >= SPLIT), "net"))} | control`);
for (const [name, k, keep] of VARIANTS) {
  const v = Object.keys(MARKETS).flatMap((s) => nonOverlap(all[s][k].filter(keep)));
  const d = v.filter((x) => x.ts < SPLIT), t = v.filter((x) => x.ts >= SPLIT);
  const dg = clustered(d, "g"), dn = clustered(d, "net"), tg = clustered(t, "g"), tn = clustered(t, "net");
  const pred = dg.mean > 0 && dg.t >= 2 && tg.mean > 0 && tg.t >= 2, trade = dn.mean > 0 && dn.t >= 2 && tn.mean > 0 && tn.t >= 2;
  lines.push(`${name} | ${f(dg)} | ${f(dn)} | ${f(tg)} | ${f(tn)} | ${trade ? "TRADABLE" : pred ? "PREDICTIVE (not after cost)" : "no"}`);
}
console.log(lines.join("\n"));
