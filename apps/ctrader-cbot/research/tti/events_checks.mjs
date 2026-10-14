// Owner's checks A-D on the TTI information study (REVIEW.md, "Checks on the event study").
// node events_checks.mjs <dir with SYM.m1 files> [300|3600]
// The registered events.mjs is not edited: its source is loaded as is, with two in-memory changes that do not touch
// its logic (each trade also records its ATR and fill price, and the table is exported instead of printed), and the
// script first proves the copy reproduces the registered results file byte for byte.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TF = +(process.argv[3] || 300);
let src = fs.readFileSync(path.join(HERE, "events.mjs"), "utf8");
const patch = (from, to) => { if (!src.includes(from)) throw new Error(`events.mjs changed: ${from}`); src = src.replace(from, to); };
patch("exit: r.exit, start: j0,", "exit: r.exit, start: j0, a, fill,");
patch('console.log(lines.join("\\n"));', 'export const TABLE = lines.join("\\n");\nexport { all, walk, MARKETS, SPLIT, VARIANTS, nonOverlap, clustered };');
const S = await import("data:text/javascript," + encodeURIComponent(src));

const registered = fs.readFileSync(path.join(HERE, TF >= 3600 ? "events_results_h1.txt" : "events_results.txt"), "utf8").trim();
const same = S.TABLE.trim() === registered;
const out = [`Reproduces the registered ${TF >= 3600 ? "H1" : "M5"} results file exactly: ${same ? "yes" : "NO"}`];
if (!same) { console.log(out.join("\n")); process.exit(1); }

const { all, MARKETS, SPLIT } = S, SYMS = Object.keys(MARKETS);
const trades = (k, keep = () => true) => SYMS.flatMap((s) => S.nonOverlap(all[s][k].filter(keep)).map((x) => ({ ...x, sym: s })));
const design = (v) => v.filter((x) => x.ts < SPLIT), test = (v) => v.filter((x) => x.ts >= SPLIT);

// Clustered mean, standard error and t by any grouping key.
function stat(v, val, group) {
  const n = v.length; if (n < 2) return { n, mean: NaN, se: NaN, t: NaN, groups: 0 };
  const m = v.reduce((s, x) => s + val(x), 0) / n, by = new Map();
  for (const x of v) { const g = group(x); by.set(g, (by.get(g) || 0) + (val(x) - m)); }
  let q = 0; for (const s of by.values()) q += s * s; const se = Math.sqrt(q) / n;
  return { n, mean: m, se, t: m / se, groups: by.size };
}
const DAY = (x) => x.day, WEEK = (x) => Math.floor((x.day + 3) / 7), MONTH = (x) => { const d = new Date(x.day * 86400000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const G = (x) => x.g, NET = (x) => x.net;
const sg = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
const ci = (s) => `${sg(s.mean)} [${sg(s.mean - 1.96 * s.se)}, ${sg(s.mean + 1.96 * s.se)}] t ${s.t.toFixed(1)}`;

// A1. Same-time random-direction control: each event's own entry bar, ATR, fill rule and exit rules, direction from a
// seeded coin. Any difference from the event is then the information in the event's direction only.
let seed = 777;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
// Limit fills (E4) need care: the registered walk counts the fill bar's stop, which is sound for the event direction
// (its stop lies beyond the fill, so it is reached after it) but not for the opposite direction, whose stop side of
// the bar was usually printed before the price came to the fill. For limit fills both the event and its control are
// therefore walked from the bar after the fill, at the same fill price, so neither sees the fill bar.
function walkAfterFill(m, dir, j0, a, fill) {
  const { B } = m, e = fill, sl = e - dir * a, tp = e + dir * 1.5 * a;
  for (let j = j0 + 1; j < B.n && j < j0 + 48; j++) {
    const stopHit = dir > 0 ? B.l[j] <= sl : B.h[j] >= sl, tpHit = dir > 0 ? B.h[j] >= tp : B.l[j] <= tp;
    if (stopHit) { const px = dir > 0 ? Math.min(B.o[j], sl) : Math.max(B.o[j], sl); return dir * (px - e) / a; }
    if (tpHit) { const px = dir > 0 ? Math.max(B.o[j], tp) : Math.min(B.o[j], tp); return dir * (px - e) / a; }
  }
  return dir * (B.c[Math.min(B.n - 1, j0 + 47)] - e) / a;
}
function sameTime(v) {
  return v.map((x) => {
    const dir = rnd() < 0.5 ? 1 : -1;
    if (x.fill !== undefined) return { ...x, g: walkAfterFill(x.M, x.dir, x.start, x.a, x.fill), g0: walkAfterFill(x.M, dir, x.start, x.a, x.fill) };
    return { ...x, g0: S.walk(x.M, dir, x.start, x.a, x.fill).g };
  });
}
// The module keeps each market's bars inside prepare(); walk() needs them, so they are rebuilt with the same code.
const P = await import("data:text/javascript," + encodeURIComponent(src.replace(/export const TABLE[\s\S]*$/, "export { prepare, walk };").replace(/const all = \{\};[\s\S]*?(?=export)/, "")));
const M = {}; for (const s of SYMS) M[s] = P.prepare(s);
const withM = (v) => v.map((x) => ({ ...x, M: M[x.sym] }));

out.push("", "A1. Same-time random-direction control (gross R; event minus control, paired, day-clustered; E4 rows both walked from the bar after the fill)");
out.push("variant | DESIGN event | DESIGN same-time random | DESIGN difference | TEST event | TEST same-time random | TEST difference");
const rows = [["R0 periodic control", "R0", () => true], ...S.VARIANTS];
for (const [name, k, keep] of rows) {
  const v = sameTime(withM(trades(k, keep)));
  const cell = (p) => `${sg(stat(p, G, DAY).mean)} | ${sg(stat(p, (x) => x.g0, DAY).mean)} | ${ci(stat(p, (x) => x.g - x.g0, DAY))}`;
  out.push(`${name} | ${cell(design(v))} | ${cell(test(v))}`);
}

// A2. Price side. The bars are bid. The study charges one round-trip spread on every trade. Here the spread is
// applied where it acts: a long buys at the ask and exits at the bid; a short sells at the bid, and its stop, target
// and exit are on the ask (bid + spread), so a short's stop is touched earlier than on the bid chart.
function walkBA(m, dir, j0, a, fill, s) {
  const { B } = m, HOLD = 48, base = fill ?? B.o[j0], e = dir > 0 ? base + s : base, sl = e - dir * a, tp = e + dir * 1.5 * a;
  const adj = dir > 0 ? 0 : s; // the side the position closes on
  for (let j = j0; j < B.n && j < j0 + HOLD; j++) {
    const hi = B.h[j] + adj, lo = B.l[j] + adj, op = B.o[j] + adj;
    const stopHit = dir > 0 ? lo <= sl : hi >= sl, tpHit = dir > 0 ? hi >= tp : lo <= tp;
    if (stopHit) { const px = j > j0 && (dir > 0 ? op < sl : op > sl) ? op : sl; return dir * (px - e) / a; }
    if (tpHit && !(fill !== undefined && j === j0)) { const px = j > j0 && (dir > 0 ? op > tp : op < tp) ? op : tp; return dir * (px - e) / a; }
  }
  const j = Math.min(B.n - 1, j0 + HOLD - 1); return dir * (B.c[j] + adj - e) / a;
}
out.push("", "A2. Net R: registered (bid chart, spread subtracted) vs bid/ask path (spread where it acts); E4 limit fills approximate");
out.push("variant | DESIGN registered net | DESIGN bid/ask net | TEST registered net | TEST bid/ask net");
for (const [name, k, keep] of rows) {
  const v = withM(trades(k, keep)).map((x) => ({ ...x, ba: walkBA(x.M, x.dir, x.start, x.a, x.fill, MARKETS[x.sym]) }));
  const c = (p) => `${sg(stat(p, NET, DAY).mean)} | ${sg(stat(p, (x) => x.ba, DAY).mean)} (t ${stat(p, (x) => x.ba, DAY).t.toFixed(1)})`;
  out.push(`${name} | ${c(design(v))} | ${c(test(v))}`);
}

// B. Dependence: the same means with standard errors clustered by day (registered), ISO week and calendar month.
out.push("", "B. Clustering sensitivity, gross R: mean [95% CI] t, and number of clusters");
out.push("variant | period | by day | by week | by month");
for (const [name, k, keep] of [["R0 periodic control", "R0", () => true], ...S.VARIANTS.filter(([nm]) => /E5|E1 BOS: all|E3 sweep-reclaim: all/.test(nm))]) {
  for (const [per, f] of [["design", design], ["test", test]]) {
    const p = f(trades(k, keep));
    out.push(`${name} | ${per} n ${p.length} | ${[DAY, WEEK, MONTH].map((g) => { const s = stat(p, G, g); return `${ci(s)} (${s.groups})`; }).join(" | ")}`);
  }
}
// Serial dependence of the fade's daily results (lag-1 correlation of daily sums, pooled over markets).
for (const [name, k] of [["E5 FADE", "E5F"], ["R0", "R0"]]) {
  const by = new Map(); for (const x of trades(k)) by.set(x.day, (by.get(x.day) || 0) + x.g);
  const days = [...by.keys()].sort((p, q) => p - q), y = days.map((d) => by.get(d)), m = y.reduce((s, q) => s + q, 0) / y.length;
  let num = 0, den = 0; for (let i = 0; i < y.length; i++) { den += (y[i] - m) ** 2; if (i) num += (y[i] - m) * (y[i - 1] - m); }
  out.push(`${name}: lag-1 correlation of daily gross sums ${(num / den).toFixed(3)} over ${y.length} trading days`);
}

// The fade, market by market.
out.push("", "Fade (E5 FADE: all) by market: n, gross [95% CI, day-clustered], net");
for (const s of SYMS) for (const [per, f] of [["design", design], ["test", test]]) {
  const p = f(trades("E5F").filter((x) => x.sym === s)); if (p.length < 2) { out.push(`${s} ${per}: n ${p.length}`); continue; }
  out.push(`${s} ${per}: n ${p.length} | gross ${ci(stat(p, G, DAY))} | net ${sg(stat(p, NET, DAY).mean)}`);
}

// D. Costs: the fade's net at multiples of the assumed spread, the cost it would break even at, and cost by session.
out.push("", "D. Fade net R at multiples of the assumed spread (design | test)");
const fade = trades("E5F"), costR = (x) => x.g - x.net;
out.push([0, 0.5, 1, 1.5, 2].map((k) => `x${k}: ${sg(stat(design(fade), (x) => x.g - k * costR(x), DAY).mean)} | ${sg(stat(test(fade), (x) => x.g - k * costR(x), DAY).mean)}`).join("; "));
for (const [per, f] of [["design", design], ["test", test]]) {
  const p = f(fade), c = p.reduce((s, x) => s + costR(x), 0) / p.length, g = stat(p, G, DAY).mean;
  out.push(`${per}: average cost ${c.toFixed(3)}R; break-even at ${(g / c).toFixed(2)} x the assumed spread`);
}
const SESS = [["Asia 22-07", (h) => h >= 22 || h < 7], ["London 07-12", (h) => h >= 7 && h < 12], ["London/NY 12-17", (h) => h >= 12 && h < 17], ["NY late 17-22", (h) => h >= 17 && h < 22]];
out.push("Fade by UTC session (both periods): n | gross | cost in R | net");
for (const [nm, f] of SESS) {
  const p = fade.filter((x) => f(x.hour)); if (p.length < 2) continue;
  out.push(`${nm}: n ${p.length} | ${sg(stat(p, G, DAY).mean)} | ${(p.reduce((s, x) => s + costR(x), 0) / p.length).toFixed(3)} | ${sg(stat(p, NET, DAY).mean)}`);
}

console.log(out.join("\n"));
