// Timing value of RSI(2) dip-buying vs simply being long: mean daily close-to-close return on the days the strategy
// is in a trade, against the mean daily return on all days (above SMA200 too, to compare like with like).
import { readFileSync } from "node:fs";
const load = (s) => JSON.parse(readFileSync(`ibars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, c }));
const sma = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
const rsi2 = (b, i) => { let up = 0, dn = 0; for (let k = i - 1; k <= i; k++) { const d = b[k].c - b[k - 1].c; if (d > 0) up += d; else dn -= d; } return dn === 0 ? 100 : 100 - 100 / (1 + up / dn); };
for (const s of ["SPX", "NDX", "DJI", "RUT", "DAX", "FTSE", "N225", "SX5E", "CAC", "HSI", "ASX200"]) {
  const b = load(s); let inT = false; const inR = [], allR = [], upR = [];
  for (let i = 201; i < b.length - 1; i++) {
    const r = b[i + 1].c / b[i].c - 1; allR.push(r); if (b[i].c > sma(b, i, 200)) upR.push(r);
    if (!inT && b[i].c > sma(b, i, 200) && rsi2(b, i) < 10) inT = true;
    if (inT) { inR.push(r); if (b[i + 1].c > sma(b, i + 1, 5)) inT = false; }
  }
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length, se = (a) => { const mu = m(a); return Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / (a.length - 1) / a.length); };
  const ex = m(inR) - m(upR);
  console.log(`${s.padEnd(7)} in-trade ${(100 * m(inR)).toFixed(3)}%/day (n=${inR.length}) | all days ${(100 * m(allR)).toFixed(3)}% | above-SMA200 days ${(100 * m(upR)).toFixed(3)}% | timing value ${(100 * ex).toFixed(3)}%/day ±${(100 * se(inR)).toFixed(3)}  t=${(ex / se(inR)).toFixed(1)}`);
}
