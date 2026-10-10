// The index rule (idx2.mjs V4 + idx3.mjs 3-ATR stop) on daily FUTURES closes: Yahoo continuous front month (ES, NQ, YM;
// not back-adjusted, so each quarterly roll adds one small artificial move). Futures and index CFDs settle on the futures
// session, not the cash closing auction: this asks whether the edge depends on the exact cash close. Halves 2000-2012 / 2013+.
// Usage: node idxfut.mjs   (reads fbars/, from: python3 -I ifetch.py ibars fbars)
import { readFileSync } from "node:fs";
const load = (s) => JSON.parse(readFileSync(`fbars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const sma = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
const atr = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].h - b[k].l, Math.abs(b[k].h - b[k - 1].c), Math.abs(b[k].l - b[k - 1].c)); return s / n; };
const down3 = (b, i) => b[i].c < b[i - 1].c && b[i - 1].c < b[i - 2].c && b[i - 2].c < b[i - 3].c;
function dip(b, from, to, stopAtr = 3) { const out = []; let p = null;
  for (let i = 201; i < b.length; i++) { const x = b[i];
    if (p) { p.n++; const hit = x.l <= p.stop; if (hit || x.c > sma(b, i, 5)) { const px = hit ? Math.min(p.stop, x.o) : x.c; const pnl = px - p.e - p.e * (0.0002 + 0.05 / 252 * p.n); out.push({ t: x.t, r: pnl / p.R, stopped: hit }); p = null; } continue; }
    if (x.t >= from && x.t < to && x.c > sma(b, i, 200) && down3(b, i)) { const a = atr(b, i, 14); p = { e: x.c, stop: x.c - stopAtr * a, R: stopAtr * a, n: 0 }; } }
  return out; }
const S = (xs) => { const rs = xs.map((x) => x.r), n = rs.length; const m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / (n - 1));
  const gw = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0), gl = -rs.filter((r) => r < 0).reduce((s, r) => s + r, 0);
  return `n=${String(n).padStart(3)} avg ${(m >= 0 ? "+" : "") + m.toFixed(3)}R ±${(sd / Math.sqrt(n)).toFixed(3)} t=${(m / (sd / Math.sqrt(n))).toFixed(1)} PF ${(gw / gl).toFixed(2)} win ${Math.round(100 * rs.filter((r) => r > 0).length / n)}% stopped ${xs.filter((x) => x.stopped).length}`; };
const Y = (y) => Date.UTC(y, 0, 1);
for (const s of ["ES", "NQ", "YM"]) { const b = load(s); console.log(`${s}  2000-2012 ${S(dip(b, 0, Y(2013)))}\n    2013-2026 ${S(dip(b, Y(2013), 1e15))}`); }
const all = ["ES", "NQ"].flatMap((s) => dip(load(s), 0, 1e15)); console.log(`ES+NQ all years ${S(all)}`);
