// Classic, literature-parameter strategies on 10 years of daily bars, all 17 markets, no tuning:
//  T1 Donchian breakout (Turtle System 2): close beyond the 55-day high/low enters, the opposite 20-day channel
//     exits, initial stop 2 x ATR(20). R = result / initial risk.
//  T2 Time-series momentum (Moskowitz-Ooi-Pedersen 2012): each month, position = sign of the 12-month return,
//     held one month. R = monthly return / trailing 1-month volatility (60-day daily vol x sqrt 21).
//  T3 RSI(2) mean reversion (Connors): long when close > SMA200 and RSI(2) < 10, exit when close > SMA5;
//     short mirrored below SMA200 with RSI(2) > 90. R = result / 2 x ATR(14) at entry.
// Costs: the market's spread floor on every entry. Swaps/financing are not modelled (they matter for multi-week holds).
import { readFileSync, readdirSync } from "node:fs";
const MK = JSON.parse(readFileSync("markets.json", "utf8"));
const load = (s) => JSON.parse(readFileSync(`dbars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const atr = (b, i, n) => { if (i < n) return NaN; let s = 0; for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].h - b[k].l, Math.abs(b[k].h - b[k - 1].c), Math.abs(b[k].l - b[k - 1].c)); return s / n; };
const sma = (b, i, n) => { if (i < n - 1) return NaN; let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
function rsi2(b, i) { if (i < 3) return NaN; let up = 0, dn = 0; for (let k = i - 1; k <= i; k++) { const d = b[k].c - b[k - 1].c; if (d > 0) up += d; else dn -= d; } return dn === 0 ? 100 : 100 - 100 / (1 + up / dn); }
const hh = (b, i, n) => Math.max(...b.slice(i - n + 1, i + 1).map((x) => x.h)), ll = (b, i, n) => Math.min(...b.slice(i - n + 1, i + 1).map((x) => x.l));

function T1(b, sp) {
  const out = []; let pos = null;
  for (let i = 60; i < b.length; i++) {
    const x = b[i];
    if (pos) {
      const exitCh = pos.dir > 0 ? ll(b, i - 1, 20) : hh(b, i - 1, 20);
      const hitStop = pos.dir > 0 ? x.l <= pos.stop : x.h >= pos.stop, hitCh = pos.dir > 0 ? x.c < exitCh : x.c > exitCh;
      if (hitStop || hitCh) { const px = hitStop ? (pos.dir > 0 ? Math.min(pos.stop, x.o) : Math.max(pos.stop, x.o)) : x.c;
        out.push({ t: x.t, r: (pos.dir * (px - pos.e) - sp) / pos.R }); pos = null; }
      continue;
    }
    const up = x.c > hh(b, i - 1, 55), dn = x.c < ll(b, i - 1, 55), a = atr(b, i, 20);
    if ((up || dn) && a > 0) { const dir = up ? 1 : -1; pos = { dir, e: x.c, stop: x.c - dir * 2 * a, R: 2 * a }; }
  }
  return out;
}
function T2(b, sp) {
  const out = []; const ends = [];
  for (let i = 1; i < b.length; i++) if (new Date(b[i].t).getUTCMonth() !== new Date(b[i - 1].t).getUTCMonth()) ends.push(i - 1);
  for (let m = 12; m < ends.length - 1; m++) {
    const i = ends[m], j = ends[m + 1], k = ends[m - 12];
    const dir = Math.sign(b[i].c - b[k].c); if (!dir) continue;
    const rets = []; for (let q = i - 59; q <= i; q++) rets.push(Math.log(b[q].c / b[q - 1].c));
    const mu = rets.reduce((s, r) => s + r, 0) / rets.length, sd = Math.sqrt(rets.reduce((s, r) => s + (r - mu) ** 2, 0) / (rets.length - 1));
    const vol = sd * Math.sqrt(21) * b[i].c; if (!(vol > 0)) continue;
    out.push({ t: b[j].t, r: (dir * (b[j].c - b[i].c) - sp) / vol });
  }
  return out;
}
function T3(b, sp) {
  const out = []; let pos = null;
  for (let i = 201; i < b.length; i++) {
    const x = b[i], s200 = sma(b, i, 200), s5 = sma(b, i, 5);
    if (pos) { if (pos.dir > 0 ? x.c > s5 : x.c < s5) { out.push({ t: x.t, r: (pos.dir * (x.c - pos.e) - sp) / pos.R }); pos = null; } continue; }
    const r2 = rsi2(b, i), a = atr(b, i, 14); if (!(a > 0)) continue;
    if (x.c > s200 && r2 < 10) pos = { dir: 1, e: x.c, R: 2 * a };
    else if (x.c < s200 && r2 > 90) pos = { dir: -1, e: x.c, R: 2 * a };
  }
  return out;
}
const STRATS = { "T1 Donchian 55/20 trend": T1, "T2 12-month momentum": T2, "T3 RSI(2) mean reversion": T3 };
const stat = (rs) => { const n = rs.length; if (!n) return null; const m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / Math.max(1, n - 1));
  const gw = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0), gl = -rs.filter((r) => r < 0).reduce((s, r) => s + r, 0); return { n, m, se: sd / Math.sqrt(n), pf: gl ? gw / gl : Infinity, win: rs.filter((r) => r > 0).length / n, sum: m * n }; };
for (const [name, fn] of Object.entries(STRATS)) {
  console.log(`\n== ${name}`);
  const all = { dev: [], holdout: [] }, years = {};
  for (const s of Object.keys(MK)) {
    const tr = fn(load(s), MK[s].spread); all[MK[s].set].push(...tr);
    for (const x of tr) { const y = new Date(x.t).getUTCFullYear(); years[y] = (years[y] || 0) + x.r; }
    const k = stat(tr.map((x) => x.r)); if (k) console.log(`  ${s.padEnd(7)} ${MK[s].set.padEnd(8)} n=${String(k.n).padStart(3)} win ${Math.round(100 * k.win)}% avg ${(k.m >= 0 ? "+" : "") + k.m.toFixed(2)}±${k.se.toFixed(2)}R PF ${k.pf.toFixed(2)} sum ${k.sum.toFixed(0)}R`);
  }
  for (const set of ["dev", "holdout"]) { const k = stat(all[set].map((x) => x.r)); const mkts = Object.keys(MK).filter((s) => MK[s].set === set);
    console.log(`  ${set.toUpperCase().padEnd(16)} n=${k.n} win ${Math.round(100 * k.win)}% avg ${(k.m >= 0 ? "+" : "") + k.m.toFixed(3)}±${k.se.toFixed(3)}R PF ${k.pf.toFixed(2)} sum ${k.sum.toFixed(0)}R`); }
  const ys = Object.entries(years).sort(); console.log(`  by year (all 17 markets, sum R): ${ys.map(([y, v]) => `${y} ${v >= 0 ? "+" : ""}${v.toFixed(0)}`).join(", ")}  -> ${ys.filter(([, v]) => v > 0).length}/${ys.length} years positive`);
}
