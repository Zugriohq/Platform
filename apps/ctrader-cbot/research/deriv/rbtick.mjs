// Range Break at tick level (cycle1_rangebreak_prereg.json): boundary statistics (A1) and the frozen
// floor-buy / ceiling-sell rule (A2), from Deriv feed ticks (derivticks.mjs format: float64 time, price pairs).
// node rbtick.mjs <SYMBOL.ticks> <spread>
import fs from "fs";

const [path, spreadArg] = process.argv.slice(2);
const SPREAD = +spreadArg;
const b = fs.readFileSync(path), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8);
const T = [], P = []; for (let i = 0; i < f.length; i += 2) { T.push(f[i]); P.push(f[i + 1]); }
const N = P.length, isJump = (i) => i > 0 && Math.abs(P[i] - P[i - 1]) > 1 + 1e-9;

// Walk the ticks once: segments, established boundaries, touches and jumps.
const touches = [], jumps = [], controls = [];
let seg = 0, lo = Infinity, hi = -Infinity, loVisits = 0, hiVisits = 0, kLo = 0, kHi = 0, segStart = 0;
const widths = [];
for (let i = 0; i < N; i++) {
  if (isJump(i)) {
    const prev = P[i - 1], side = loVisits >= 3 && prev === lo ? "floor" : hiVisits >= 3 && prev === hi ? "ceiling" : "inside";
    jumps.push({ i, size: P[i] - prev, side });
    if (hi > lo && isFinite(hi)) widths.push(hi - lo);
    seg++; lo = Infinity; hi = -Infinity; loVisits = hiVisits = kLo = kHi = 0; segStart = i;
  }
  const p = P[i];
  if (p < lo) { lo = p; loVisits = 0; kLo = 0; }
  if (p > hi) { hi = p; hiVisits = 0; kHi = 0; }
  if (p === lo) { loVisits++; if (loVisits >= 3) touches.push({ i, dir: 1, k: ++kLo, seg, width: hi - lo }); }
  if (p === hi) { hiVisits++; if (hiVisits >= 3) touches.push({ i, dir: -1, k: ++kHi, seg, width: hi - lo }); }
  // control: two points inside an established boundary, same segment
  if (loVisits >= 3 && p === lo + 2) controls.push({ i, dir: 1, seg });
  if (hiVisits >= 3 && p === hi - 2) controls.push({ i, dir: -1, seg });
}
if (hi > lo && isFinite(hi)) widths.push(hi - lo);

const hours = (T[N - 1] - T[0]) / 3600;
const bucket = (k) => (k === 1 ? "1" : k <= 3 ? "2-3" : k <= 7 ? "4-7" : k <= 15 ? "8-15" : "16+");
const out = [`${path}: ${N} ticks over ${hours.toFixed(1)} h; ${jumps.length} jumps (${(jumps.length / hours).toFixed(2)}/h); ${seg + 1} segments; ` +
  `range width median ${widths.length ? widths.slice().sort((a, b) => a - b)[widths.length >> 1] : "-"} (n ${widths.length}); ${touches.length} boundary touches`];

// A1: breaks by side and direction; hazard at a touch by k
const bySide = {}; for (const j of jumps) { const s = (bySide[j.side] ??= { n: 0, up: 0, size: 0 }); s.n++; if (j.size > 0) s.up++; s.size += Math.abs(j.size); }
out.push("A1 breaks by the side price was on: " + Object.entries(bySide).map(([s, v]) => `${s} ${v.n} (${v.up} up, ${v.n - v.up} down, avg size ${(v.size / v.n).toFixed(0)})`).join("; "));
const away = (j) => (j.side === "floor" ? j.size < 0 : j.side === "ceiling" ? j.size > 0 : null);
const sided = jumps.filter((j) => j.side !== "inside");
out.push(`A1 breaks at a boundary that go THROUGH it (floor -> down, ceiling -> up): ${sided.filter(away).length} of ${sided.length}`);
const hz = {}; for (const t of touches) { const h = (hz[bucket(t.k)] ??= { n: 0, br: 0 }); h.n++; if (t.i + 1 < N && isJump(t.i + 1)) h.br++; }
out.push("A1 P(break on the next tick | touch), by touch number k: " + ["1", "2-3", "4-7", "8-15", "16+"].filter((x) => hz[x]).map((x) => `k ${x}: ${hz[x].br}/${hz[x].n} = ${(100 * hz[x].br / hz[x].n).toFixed(2)}%`).join("; "));

// Excursions and trades. Trade: enter at the touch at price + dir*spread/2, exit after H ticks or at the first jump.
function trade(e, H, cost) {
  const dir = e.dir, entry = P[e.i] + dir * cost / 2; let x = Math.min(N - 1, e.i + H), jumped = false;
  for (let m = e.i + 1; m <= Math.min(N - 1, e.i + H); m++) if (isJump(m)) { x = m; jumped = true; break; }
  return { pts: dir * (P[x] - cost / 2 * dir - entry), exit: x, jumped, seg: e.seg };
}
function excursion(e, H) {
  let mfe = 0, mae = 0; for (let m = e.i + 1; m <= Math.min(N - 1, e.i + H); m++) { const v = e.dir * (P[m] - P[e.i]); mfe = Math.max(mfe, v); mae = Math.min(mae, v); }
  return { mfe, mae };
}
const clustered = (rows) => {
  const n = rows.length; if (n < 2) return { n, mean: NaN, t: NaN, clusters: 0 };
  const m = rows.reduce((s, r) => s + r.pts, 0) / n, by = new Map();
  for (const r of rows) by.set(r.seg, (by.get(r.seg) || 0) + (r.pts - m));
  let q = 0; for (const v of by.values()) q += v * v;
  // with few ranges the clustered error is meaningless: report no t below 5 clusters
  return { n, mean: m, t: by.size >= 5 ? m / (Math.sqrt(q) / n) : NaN, clusters: by.size };
};
for (const H of [60, 300, 900]) {
  const ex = touches.map((t) => excursion(t, H)), exc = controls.map((t) => excursion(t, H));
  const avg = (a, k) => a.reduce((s, x) => s + x[k], 0) / Math.max(1, a.length);
  out.push(`A1 H ${H}: touch MFE ${avg(ex, "mfe").toFixed(1)} / MAE ${avg(ex, "mae").toFixed(1)} points (n ${ex.length}); control (2 inside) MFE ${avg(exc, "mfe").toFixed(1)} / MAE ${avg(exc, "mae").toFixed(1)} (n ${exc.length})`);
  for (const mult of [1, 2]) {
    const cost = SPREAD * mult, rows = []; let busy = -1;
    for (const t of touches) { if (t.i <= busy) continue; const r = trade(t, H, cost); rows.push(r); busy = r.exit; }
    const crow = []; busy = -1;
    for (const t of controls) { if (t.i <= busy) continue; const r = trade(t, H, cost); crow.push(r); busy = r.exit; }
    const s = clustered(rows), c = clustered(crow), j = rows.filter((r) => r.jumped);
    out.push(`A2 H ${H} spread x${mult} (${cost}): ${s.n} trades, avg ${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(2)} points (t ${Number.isFinite(s.t) ? s.t.toFixed(1) : "n/a, too few ranges"}, ${s.clusters} ranges); ` +
      `${j.length} ended by a jump, avg ${j.length ? (j.reduce((a, r) => a + r.pts, 0) / j.length).toFixed(1) : "-"}; control ${c.mean >= 0 ? "+" : ""}${(c.mean ?? 0).toFixed(2)} (t ${Number.isFinite(c.t) ? c.t.toFixed(1) : "n/a"}, n ${c.n})`);
  }
}
console.log(out.join("\n"));
