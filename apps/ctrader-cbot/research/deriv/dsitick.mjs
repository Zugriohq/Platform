// Tick-level check of the Drift Switch momentum rules (behaviour_prereg.json; Behaviour.Rules for DriftSwitch):
// the same signal on M1 bars built from the ticks (|L-bar move| >= 1.0 x sigma x sqrt(L), follow it, hold H bars, no
// overlap), but filled the way a bot would be: at the first tick after the signal minute closes (plus a delay), buying
// at mid + spread/2 and selling at mid - spread/2, and closed at the first tick after the exit minute closes.
// R = 2 x ATR14 of the M1 bars at the signal, as in MarketLab.Momentum.
// node dsitick.mjs <SYMBOL.ticks> <spread> <regime minutes>
import fs from "fs";

const [path, spreadArg, regimeArg] = process.argv.slice(2);
const SPREAD = +spreadArg, REG = +regimeArg;
const b = fs.readFileSync(path), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8);
const T = [], P = []; for (let i = 0; i < f.length; i += 2) { T.push(f[i]); P.push(f[i + 1]); }

// M1 bars from ticks (minute buckets by time).
const bars = []; let cur = null;
for (let i = 0; i < T.length; i++) {
  const m = Math.floor(T[i] / 60) * 60;
  if (!cur || cur.t !== m) { if (cur) bars.push(cur); cur = { t: m, o: P[i], h: P[i], l: P[i], c: P[i], last: i }; }
  else { cur.h = Math.max(cur.h, P[i]); cur.l = Math.min(cur.l, P[i]); cur.c = P[i]; cur.last = i; }
}
if (cur) bars.push(cur);
const r = []; for (let i = 1; i < bars.length; i++) r.push(bars[i].c / bars[i - 1].c - 1);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const m0 = med(r), mad = med(r.map((x) => Math.abs(x - m0)));
const sigma = Math.max(1.4826 * mad, Math.sqrt(Math.PI / 2) * r.reduce((s, x) => s + Math.abs(x - m0), 0) / r.length);
const atr = (i) => { if (i < 14) return NaN; let s = 0; for (let k = i - 13; k <= i; k++) s += Math.max(bars[k].h - bars[k].l, Math.abs(bars[k].h - bars[k - 1].c), Math.abs(bars[k].l - bars[k - 1].c)); return s / 14; };
// first tick at or after time x
const tickAt = (x) => { let lo = 0, hi = T.length - 1; if (T[hi] < x) return -1; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < x) lo = m + 1; else hi = m; } return lo; };

function run(L, H, spreadMult, delay, onBars) {
  const out = []; const sp = SPREAD * spreadMult;
  for (let i = Math.max(L, 15); i + H < bars.length;) {
    const move = bars[i].c / bars[i - L].c - 1, a = atr(i);
    if (!(a > 0) || Math.abs(move) < 1.0 * sigma * Math.sqrt(L)) { i++; continue; }
    const dir = Math.sign(move);
    let e, x;
    if (onBars) { e = bars[i].c; x = bars[i + H].c; }
    else {
      const ei = tickAt(bars[i].t + 60 + delay), xi = tickAt(bars[i + H].t + 60 + delay);
      if (ei < 0 || xi < 0) break;
      e = P[ei] + dir * sp / 2; x = P[xi] - dir * sp / 2;
    }
    out.push(onBars ? (dir * (x - e) - sp) / (2 * a) : dir * (x - e) / (2 * a));
    i += H;
  }
  const n = out.length, m = out.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(out.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
  return `${n} trades, avg ${(m >= 0 ? "+" : "") + m.toFixed(3)}R t ${(m / (sd / Math.sqrt(n))).toFixed(1)}`;
}

const span = (T.at(-1) - T[0]) / 3600;
console.log(`${path}: ${T.length} ticks, ${(T.length / (T.at(-1) - T[0])).toFixed(2)}/s over ${span.toFixed(1)} h; ${bars.length} M1 bars; spread ${SPREAD}`);
const q = Math.max(2, Math.round(REG / 4)), h2 = Math.max(3, Math.round(REG / 2));
for (const L of [q, h2]) for (const H of [q, h2]) {
  const cells = [`bars as in the study ${run(L, H, 1, 0, true)}`];
  for (const [mult, delay] of [[1, 0], [1, 2], [1, 5], [2, 2], [3, 5]]) cells.push(`ticks, spread x${mult}, +${delay}s: ${run(L, H, mult, delay, false)}`);
  console.log(`  momentum lb${L} hold${H}\n    ` + cells.join("\n    "));
}
