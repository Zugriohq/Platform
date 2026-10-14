// Can an edge be extracted from TTI's signals? Search slices on 2025 (design), confirm the best on 2026 (test).
// node refine.mjs rows.json   (rows from DUMP=rows.json node evaluate.mjs ...)
import fs from "fs";
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).filter((r) => r.walk === null && !r.bad);
const plans = ["A", "B", "C", "D", "E", "F", "G"];
const sess = (h) => (h < 7 ? "Asia" : h < 12 ? "London" : h < 17 ? "London+NY" : "NY late");
const pw = (p) => (p < 0.65 ? "<0.65" : p < 0.7 ? "0.65-0.70" : ">=0.70");
const dims = { market: (r) => r.key, setup: (r) => r.setup, regime: (r) => r.regime, dir: (r) => r.dir, session: (r) => sess(r.hour), pWin: (r) => pw(r.pWin) };
const stat = (v) => { const n = v.length; if (n < 2) return { n, avg: 0, t: 0 }; const m = v.reduce((a, x) => a + x, 0) / n; const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, avg: m, t: m / (sd / Math.sqrt(n)) }; };
const cands = [];
// every single-dimension slice and every pair of dimensions, under every exit plan
const keys = Object.keys(dims);
const combos = [...keys.map((k) => [k]), ...keys.flatMap((a, i) => keys.slice(i + 1).map((b) => [a, b]))];
for (const combo of combos) {
  const groups = new Map();
  for (const r of rows) { const g = combo.map((k) => dims[k](r)).join(" & "); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
  for (const [g, list] of groups) for (const p of plans) {
    const d = stat(list.filter((r) => r.year === 2025).map((r) => r.r[p])), t = stat(list.filter((r) => r.year === 2026).map((r) => r.r[p]));
    if (d.n >= 30) cands.push({ slice: `${combo.join("+")}: ${g}`, plan: p, d, t });
  }
}
console.log(`Slices x exit plans searched on 2025: ${cands.length}. Positive in 2025: ${cands.filter((c) => c.d.avg > 0).length}.`);
const best = [...cands].sort((a, b) => b.d.t - a.d.t).slice(0, 10);
console.log("Ten best on 2025 (design), and the same slice on 2026 (test):");
for (const c of best) console.log(`  ${c.slice.padEnd(48)} plan ${c.plan}: 2025 n ${c.d.n} ${c.d.avg >= 0 ? "+" : ""}${c.d.avg.toFixed(3)}R t ${c.d.t.toFixed(1)}  ->  2026 n ${c.t.n} ${c.t.avg >= 0 ? "+" : ""}${c.t.avg.toFixed(3)}R t ${c.t.t.toFixed(1)}`);
const passD = cands.filter((c) => c.d.t >= 2);
console.log(`Slices with t >= 2 in 2025: ${passD.length}; of those, positive in 2026: ${passD.filter((c) => c.t.avg > 0).length}; with t >= 2 in 2026 too: ${passD.filter((c) => c.t.t >= 2).length}.`);
// Reversed signals: the mirror of plan A (TTI on real data was worse than the random walk)
const rev = rows.map((r) => ({ year: r.year, x: -(r.r.A + r.costR) - r.costR }));
for (const y of [2025, 2026]) { const s = stat(rev.filter((r) => r.year === y).map((r) => r.x)); console.log(`Reversed signals (approx., same stop/target mirrored) ${y}: n ${s.n} ${s.avg >= 0 ? "+" : ""}${s.avg.toFixed(3)}R t ${s.t.toFixed(1)}`); }
