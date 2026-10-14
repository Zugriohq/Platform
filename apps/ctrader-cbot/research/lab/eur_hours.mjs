// eur_hours_prereg.json: short EURUSD 07:00-12:00 UTC each weekday, on history the pattern was not found in.
// node eur_hours.mjs <EURUSD.m1 2001-2009> [<EURJPY.m1> for the secondary check]
import fs from "fs";
const [main, secondary] = process.argv.slice(2);
const st = (v) => { const n = v.length, m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s) => `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}bp (t ${s.t.toFixed(2)}, n ${s.n})`;
function windows(path, pip, fromY, toY) {
  const b = fs.readFileSync(path), a = new Float64Array(b.buffer, b.byteOffset, b.length / 8), m = new Map();
  for (let i = 0; i < a.length; i += 5) m.set(a[i], a[i + 4]);
  const px = (T) => { for (let k = 0; k <= 10; k++) { const v = m.get(T - 60 * k); if (v !== undefined) return v; } return null; };
  const rows = [];
  for (let t = Date.UTC(fromY, 0, 1) / 1000; t < Date.UTC(toY + 1, 0, 1) / 1000; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd < 1 || wd > 5) continue;
    const a0 = px(t + 7 * 3600), a1 = px(t + 12 * 3600); if (a0 == null || a1 == null) continue;
    const gross = -(a1 / a0 - 1) * 1e4; rows.push({ t, year: new Date(t * 1000).getUTCFullYear(), gross, net1: gross - (pip / a0) * 1e4, net2: gross - (2 * pip / a0) * 1e4 });
  }
  return rows;
}
const r = windows(main, 0.0001, 2001, 2009), out = [];
const g = st(r.map((x) => x.gross)), n1 = st(r.map((x) => x.net1)), n2 = st(r.map((x) => x.net2));
out.push(`EURUSD 2001-2009, short 07:00-12:00 UTC: gross ${f(g)}; net at 1 pip ${f(n1)}; at 2 pips ${f(n2)}`);
out.push("  by year (gross): " + [...new Set(r.map((x) => x.year))].map((y) => { const s = st(r.filter((x) => x.year === y).map((x) => x.gross)); return `${y} ${s.m >= 0 ? "+" : ""}${s.m.toFixed(2)}`; }).join(", "));
out.push(`VERDICT: ${n1.m > 0 && n1.t >= 2 && g.m > 0 ? "PASS" : "FAIL"} (registered: net at 1 pip > 0 with t >= 2 and gross > 0, the 2010-2026 sign)`);
if (secondary) { const s = windows(secondary, 0.012, 2010, 2026); out.push(`secondary, EURJPY 2010-2026 same window: gross ${f(st(s.map((x) => x.gross)))}; net at 1.2 pips ${f(st(s.map((x) => x.net1)))}`); }
console.log(out.join("\n"));
