// Clean test of index dip-buying (canonical Connors RSI(2), long only) and 12-month momentum on 11 world indices,
// 1990-2026. Costs per trade: 0.02% of price spread + 5%/year overnight financing per night held (long index CFD).
// R unit = 2 x ATR(14) at entry. Split: before 2016 (never examined) vs 2016+.
import { readFileSync } from "node:fs";
const IDX = ["SPX", "NDX", "DJI", "RUT", "DAX", "FTSE", "N225", "SX5E", "CAC", "HSI", "ASX200"];
const load = (s) => JSON.parse(readFileSync(`ibars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const atr = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].h - b[k].l, Math.abs(b[k].h - b[k - 1].c), Math.abs(b[k].l - b[k - 1].c)); return s / n; };
const sma = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
const rsi2 = (b, i) => { let up = 0, dn = 0; for (let k = i - 1; k <= i; k++) { const d = b[k].c - b[k - 1].c; if (d > 0) up += d; else dn -= d; } return dn === 0 ? 100 : 100 - 100 / (1 + up / dn); };
function rsi2Long(b) {
  const out = []; let pos = null;
  for (let i = 201; i < b.length; i++) {
    const x = b[i];
    if (pos) { if (x.c > sma(b, i, 5)) { const nights = Math.round((x.t - pos.t) / 86400000); const cost = pos.e * (0.0002 + 0.05 / 365 * nights);
      out.push({ t: x.t, r: (x.c - pos.e - cost) / pos.R, pct: (x.c - pos.e - cost) / pos.e, days: nights }); pos = null; } continue; }
    if (x.c > sma(b, i, 200) && rsi2(b, i) < 10) pos = { e: x.c, R: 2 * atr(b, i, 14), t: x.t };
  }
  return out;
}
const stat = (xs) => { const rs = xs.map((x) => x.r), n = rs.length; if (!n) return "n=0"; const m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / Math.max(1, n - 1));
  const gw = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0), gl = -rs.filter((r) => r < 0).reduce((s, r) => s + r, 0);
  const pct = xs.reduce((s, x) => s + x.pct, 0) / n;
  return `n=${String(n).padStart(4)} win ${Math.round(100 * rs.filter((r) => r > 0).length / n)}% avg ${(m >= 0 ? "+" : "") + m.toFixed(3)}±${(sd / Math.sqrt(n)).toFixed(3)}R PF ${(gw / gl).toFixed(2)} avg ${(100 * pct).toFixed(2)}%/trade`; };
const cut = Date.UTC(2016, 0, 1); const pre = [], post = [], decades = {};
console.log("RSI(2) long-only dip-buying, canonical rules");
for (const s of IDX) {
  const tr = rsi2Long(load(s)); const a = tr.filter((x) => x.t < cut), z = tr.filter((x) => x.t >= cut); pre.push(...a); post.push(...z);
  for (const x of tr) { const d = Math.floor(new Date(x.t).getUTCFullYear() / 5) * 5; (decades[d] ??= []).push(x); }
  console.log(`  ${s.padEnd(7)} before 2016: ${stat(a).padEnd(62)} | 2016+: ${stat(z)}`);
}
console.log(`  ALL     before 2016: ${stat(pre).padEnd(62)} | 2016+: ${stat(post)}`);
console.log("  by 5-year period: " + Object.entries(decades).sort().map(([d, xs]) => `${d}-${+d + 4}: ${(xs.reduce((s, x) => s + x.r, 0) / xs.length).toFixed(3)}R (n=${xs.length})`).join(", "));
const yrs = {}; for (const x of [...pre, ...post]) { const y = new Date(x.t).getUTCFullYear(); yrs[y] = (yrs[y] || 0) + x.r; }
const yv = Object.values(yrs); console.log(`  years positive (all indices summed): ${yv.filter((v) => v > 0).length}/${yv.length}; worst year ${Math.min(...yv).toFixed(1)}R, best ${Math.max(...yv).toFixed(1)}R`);
const holding = [...pre, ...post].reduce((s, x) => s + x.days, 0) / (pre.length + post.length); console.log(`  average holding ${holding.toFixed(1)} days`);
