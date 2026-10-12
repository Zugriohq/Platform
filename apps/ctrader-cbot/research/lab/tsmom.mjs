// Pre-registered trend test (tsmom_prereg.json) on 25 years of daily gold, commodities and FX (Yahoo; fetch as in ifetch.py
// with the symbols listed in the registration). FIN=<annual financing> overrides the registered 5%/yr, e.g. FIN=0 or FIN=0.015.
import { readFileSync } from "node:fs";
const pre = JSON.parse(readFileSync("tsmom_prereg.json", "utf8"));
const COST = { GOLD: 0.0003, SILVER: 0.0006, PLATINUM: 0.001, COPPER: 0.0006, OIL: 0.0006, NATGAS: 0.002 }; const FXC = 0.0001;
const load = (s) => JSON.parse(readFileSync(`cbars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, c }));
function run(s, rule) {
  const b = load(s), ends = [], out = [];
  for (let i = 1; i < b.length; i++) if (new Date(b[i].t).getUTCMonth() !== new Date(b[i - 1].t).getUTCMonth()) ends.push(i - 1);
  let prev = 0; const cost = COST[s] ?? FXC;
  for (let m = 12; m < ends.length - 1; m++) {
    const i = ends[m], j = ends[m + 1], ret = (k) => b[i].c / b[ends[m - k]].c - 1;
    const sg = (x) => Math.sign(x);
    const pos = rule === "A" ? sg(ret(12)) : (sg(ret(1)) + sg(ret(3)) + sg(ret(12))) / 3;
    const rs = []; for (let q = i - 59; q <= i; q++) rs.push(Math.log(b[q].c / b[q - 1].c));
    const mu = rs.reduce((a, x) => a + x, 0) / rs.length, sd = Math.sqrt(rs.reduce((a, x) => a + (x - mu) ** 2, 0) / (rs.length - 1)) * Math.sqrt(21);
    if (!(sd > 0)) { prev = pos; continue; }
    const r = pos * (b[j].c / b[i].c - 1) - Math.abs(pos - prev) * cost - Math.abs(pos) * (process.env.FIN ? +process.env.FIN : 0.05) / 12;
    out.push({ t: b[j].t, r: r / sd, gross: pos * (b[j].c / b[i].c - 1) / sd }); prev = pos;
  }
  return out;
}
const st = (xs) => { const n = xs.length, m = xs.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const Y = Date.UTC(2013, 0, 1);
for (const rule of ["A", "B"]) for (const [g, syms] of Object.entries(pre.groups)) {
  const all = syms.flatMap((s) => run(s, rule));
  // group-month portfolio: average R across the group's markets each month (correlated markets are not independent)
  const byT = new Map(); for (const x of all) { const k = new Date(x.t).toISOString().slice(0, 7); const e = byT.get(k) || []; e.push(x.r); byT.set(k, e); }
  const port = [...byT.entries()].sort().map(([k, v]) => ({ t: Date.parse(k + "-15"), r: v.reduce((a, x) => a + x, 0) / v.length }));
  const a = st(port.filter((x) => x.t < Y).map((x) => x.r)), b2 = st(port.filter((x) => x.t >= Y).map((x) => x.r)), p = st(port.map((x) => x.r));
  const pass = a.m > 0 && b2.m > 0 && p.t >= 2;
  console.log(`${rule} ${g.padEnd(6)} months=${p.n} avg ${p.m.toFixed(3)}R/month t=${p.t.toFixed(2)} | 2000-12 ${a.m.toFixed(3)} (t ${a.t.toFixed(1)}) | 2013-26 ${b2.m.toFixed(3)} (t ${b2.t.toFixed(1)}) | ${pass ? "PASS" : "fail"}`);
}
for (const s of [...pre.groups.metals, ...pre.groups.energy, ...pre.groups.fx]) { const x = run(s, "A"), y = run(s, "B"); const a = st(x.map((v) => v.r)), b = st(y.map((v) => v.r));
  console.log(`  ${s.padEnd(8)} A ${a.m.toFixed(3)} t=${a.t.toFixed(1)}   B ${b.m.toFixed(3)} t=${b.t.toFixed(1)}`); }
