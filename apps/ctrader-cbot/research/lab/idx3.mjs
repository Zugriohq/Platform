// (a) Index dip engine with a protective stop, in R units for EA sizing; (b) turn-of-month as a second sub-edge,
// (c) the same "3 lower closes" logic on hourly bars (US500/US100 dev halves, US30 test).
import { readFileSync } from "node:fs";
const loadD = (s) => JSON.parse(readFileSync(`ibars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const loadH = (s) => JSON.parse(readFileSync(`hbars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const sma = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
const atr = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].h - b[k].l, Math.abs(b[k].h - b[k - 1].c), Math.abs(b[k].l - b[k - 1].c)); return s / n; };
const down3 = (b, i) => b[i].c < b[i - 1].c && b[i - 1].c < b[i - 2].c && b[i - 2].c < b[i - 3].c;
function dip(b, { stopAtr, spreadPct, finPerBar, from = 0, to = 1e15, maxBars = 1e9 }) {
  const out = []; let p = null;
  for (let i = 201; i < b.length; i++) {
    const x = b[i];
    if (p) {
      p.n++;
      const hit = stopAtr > 0 && x.l <= p.stop;
      if (hit || x.c > sma(b, i, 5) || p.n >= maxBars) { const px = hit ? Math.min(p.stop, x.o) : x.c;
        const pnl = px - p.e - p.e * (spreadPct + finPerBar * p.n); out.push({ t: x.t, r: pnl / p.R, pct: pnl / p.e, stopped: hit, bars: p.n }); p = null; }
      continue;
    }
    if (x.t >= from && x.t < to && x.c > sma(b, i, 200) && down3(b, i)) { const a = atr(b, i, 14); p = { e: x.c, stop: stopAtr > 0 ? x.c - stopAtr * a : -Infinity, R: (stopAtr > 0 ? stopAtr : 2.5) * a, n: 0 }; }
  }
  return out;
}
const S = (xs) => { const rs = xs.map((x) => x.r), n = rs.length; if (!n) return "n=0"; const m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / (n - 1));
  const gw = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0), gl = -rs.filter((r) => r < 0).reduce((s, r) => s + r, 0);
  let eq = 0, pk = 0, dd = 0; for (const r of rs) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return `n=${String(n).padStart(4)} win ${Math.round(100 * rs.filter((r) => r > 0).length / n)}% avg ${(m >= 0 ? "+" : "") + m.toFixed(3)}R ±${(sd / Math.sqrt(n)).toFixed(3)} PF ${(gw / gl).toFixed(2)} maxDD ${dd.toFixed(1)}R stopped ${Math.round(100 * xs.filter((x) => x.stopped).length / n)}% avg hold ${(xs.reduce((s, x) => s + x.bars, 0) / n).toFixed(1)} bars`; };
const Y = (y) => Date.UTC(y, 0, 1);
console.log("(a) daily '3 lower closes' with a protective stop, R = stop distance (no stop: R = 2.5 ATR for comparison)");
for (const st of [0, 2, 2.5, 3, 4]) {
  const dev = [], tt = [], tm = [];
  for (const s of ["SPX", "NDX"]) { const b = loadD(s); dev.push(...dip(b, { stopAtr: st, spreadPct: 0.0002, finPerBar: 0.05 / 252, to: Y(2010) })); tt.push(...dip(b, { stopAtr: st, spreadPct: 0.0002, finPerBar: 0.05 / 252, from: Y(2010) })); }
  for (const s of ["DJI", "RUT", "DAX", "FTSE", "N225", "SX5E", "CAC", "HSI", "ASX200"]) tm.push(...dip(loadD(s), { stopAtr: st, spreadPct: 0.0002, finPerBar: 0.05 / 252 }));
  console.log(`  stop ${st || "none"} ATR`.padEnd(16) + ` DEV ${S(dev)}\n${" ".repeat(16)} T-TIME ${S(tt)}\n${" ".repeat(16)} T-MKT ${S(tm)}`);
}
console.log("\n(c) the same logic on HOURLY bars (SMA200/SMA5 in hours), 3 x ATR stop, max 24 bars");
for (const s of ["US500", "US100", "US30"]) {
  const b = loadH(s); const mid = b[Math.floor(b.length / 2)].t;
  const a = dip(b, { stopAtr: 3, spreadPct: 0.0001, finPerBar: 0.05 / 365 / 24, to: mid, maxBars: 24 }), z = dip(b, { stopAtr: 3, spreadPct: 0.0001, finPerBar: 0.05 / 365 / 24, from: mid, maxBars: 24 });
  console.log(`  ${s.padEnd(6)} first half ${S(a)}\n         second half ${S(z)}`);
}
