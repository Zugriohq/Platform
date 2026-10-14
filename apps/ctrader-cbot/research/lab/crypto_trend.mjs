// realmarkets_prereg.json, C_crypto_trend: three registered rules on BTC and ETH daily closes.
import fs from "fs";
const data = Object.fromEntries(["BTCUSDT", "ETHUSDT"].map((s) => [s, JSON.parse(fs.readFileSync(`${s}.json`, "utf8"))]));
const SPLIT = Date.UTC(2022, 0, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000;
function periods(rows, kind) {   // indices of period-end bars
  const ends = [];
  for (let i = 1; i < rows.length; i++) {
    const a = new Date(rows[i - 1][0] * 1000), b = new Date(rows[i][0] * 1000);
    if (kind === "month" ? a.getUTCMonth() !== b.getUTCMonth() : b.getUTCDay() === 1) ends.push(i - 1);   // last bar of month / Sunday bar
  }
  return ends;
}
function vol60(rows, i) { let s = 0, n = 0; for (let k = Math.max(1, i - 59); k <= i; k++) { const r = Math.log(rows[k][1] / rows[k - 1][1]); s += r * r; n++; } return Math.sqrt(s / n); }
function run(rule, fin) {
  const out = [];
  for (const [sym, rows] of Object.entries(data)) {
    const ends = periods(rows, rule === "C1" ? "month" : "week"); let prev = 0;
    for (let k = 0; k + 1 < ends.length; k++) {
      const i = ends[k], j = ends[k + 1]; if (rows[j][0] > END) break;
      let pos;
      if (rule === "C1") { const back = ends[k - 12]; if (back === undefined) continue; pos = Math.sign(rows[i][1] - rows[back][1]); }
      else if (rule === "C2") { const back = ends[k - 4]; if (back === undefined) continue; pos = Math.sign(rows[i][1] - rows[back][1]); }
      else { if (k < 20) continue; let s = 0; for (let m = k - 19; m <= k; m++) s += rows[ends[m]][1]; pos = rows[i][1] > s / 20 ? 1 : 0; }
      const days = (rows[j][0] - rows[i][0]) / 86400, ret = rows[j][1] / rows[i][1] - 1, v = vol60(rows, i) * Math.sqrt(days);
      if (!(v > 0)) continue;
      const cost = 0.002 * Math.abs(pos - prev) + fin * Math.abs(pos) * days / 365; prev = pos;
      out.push({ t: rows[i][0], r: (pos * ret - cost) / v, gross: pos * ret / v, sym });
    }
  }
  return out;
}
const st = (v) => { const n = v.length, m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s) => `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}R t ${s.t.toFixed(1)} (n ${s.n})`;
const names = { C1: "12-month trend, monthly, long/short", C2: "4-week trend, weekly, long/short", C3: "above 20-week average, weekly, long only" };
console.log("rule | gross | net at 0% fin | net at 10%/yr (registered) | net at 20%/yr | first half (10%) | second half (10%) | verdict");
for (const rule of ["C1", "C2", "C3"]) {
  const g = run(rule, 0), n10 = run(rule, 0.10), n20 = run(rule, 0.20);
  const a = st(n10.filter((x) => x.t < SPLIT).map((x) => x.r)), b = st(n10.filter((x) => x.t >= SPLIT).map((x) => x.r)), all = st(n10.map((x) => x.r));
  const pass = a.m > 0 && b.m > 0 && all.t >= 2;
  console.log(`${names[rule]} | ${f(st(g.map((x) => x.gross)))} | ${f(st(g.map((x) => x.r)))} | ${f(all)} | ${f(st(n20.map((x) => x.r)))} | ${f(a)} | ${f(b)} | ${pass ? "PASS" : "fail"}`);
  for (const s of ["BTCUSDT", "ETHUSDT"]) { const v = n10.filter((x) => x.sym === s); console.log(`   ${s} at 10%: ${f(st(v.map((x) => x.r)))}, first ${f(st(v.filter((x) => x.t < SPLIT).map((x) => x.r)))}, second ${f(st(v.filter((x) => x.t >= SPLIT).map((x) => x.r)))}`); }
}
// buy and hold for reference, per week
const bh = run("C3", 0.10).map((x) => x); 
