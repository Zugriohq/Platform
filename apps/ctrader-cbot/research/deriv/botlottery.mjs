// 1,000 different simple bots on a real Deriv index (M1 bars), each: a rule for direction (always buy, always sell,
// follow the last N minutes, fade them), a target and a stop in points, entered whenever flat. Spread paid every trade.
// How many look profitable in a given week, and how many over the whole period?
import fs from "fs";
const [file, spread0, scale] = [process.argv[2], +process.argv[3], +(process.argv[4] || 0)]; const spread = spread0;
const b = fs.readFileSync(`m1/${file}.m1`), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = f.length / 5;
const T = [], H = [], L = [], C = []; for (let i = 0; i < n; i++) { T.push(f[5*i]); H.push(f[5*i+2]); L.push(f[5*i+3]); C.push(f[5*i+4]); }
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const atr = (() => { let s = 0; for (let i = 1; i < 2000; i++) s += H[i] - L[i]; return s / 2000; })();
const week = (i) => Math.floor((T[i] - T[0]) / (7 * 86400));
const weeks = week(n - 1);
let profitableWeeks = 0, totalWeeks = 0, profitableAll = 0, bestStreak = 0; const finals = []; const halves = [];
for (let s = 0; s < 1000; s++) {
  const kind = Math.floor(rnd() * 4), look = 1 + Math.floor(rnd() * 30), tp = Math.max(spread, 1e-9) * (3 + rnd() * 37) * (spread > 0 ? 1 : 0) + (spread > 0 ? 0 : atr * (3 + rnd() * 37) / 4), sl = Math.max(spread, 1e-9) * (3 + rnd() * 37) * (spread > 0 ? 1 : 0) + (spread > 0 ? 0 : atr * (3 + rnd() * 37) / 4);
  const pnl = new Array(weeks + 1).fill(0);
  for (let i = 31; i < n - 1;) {
    const d = kind === 0 ? 1 : kind === 1 ? -1 : Math.sign(C[i] - C[i - look]) * (kind === 2 ? 1 : -1) || 1;
    const e = C[i], up = e + d * tp, dn = e - d * sl; let j = i + 1, x = C[Math.min(n - 1, i + 240)];
    for (; j < n && j <= i + 240; j++) {
      const hitS = d > 0 ? L[j] <= dn : H[j] >= dn, hitT = d > 0 ? H[j] >= up : L[j] <= up;
      // a stop that a jump passes fills where the minute closed (beyond the stop), as a broker fills a gapped stop
      const stopFill = d > 0 ? Math.min(dn, C[j]) : Math.max(dn, C[j]);
      if (hitS && hitT) { x = rnd() < 0.5 ? stopFill : up; break; }   // both inside one minute: a coin
      if (hitS) { x = stopFill; break; }
      if (hitT) { x = up; break; }
    }
    pnl[week(i)] += d * (x - e) - (scale ? 0 : spread); i = Math.min(j, i + 240) + 1;
  }
  let streak = 0, cur = 0; for (const w of pnl.slice(0, weeks)) { totalWeeks++; if (w > 0) { profitableWeeks++; cur++; streak = Math.max(streak, cur); } else cur = 0; }
  bestStreak = Math.max(bestStreak, streak); const tot = pnl.reduce((a, x) => a + x, 0); finals.push(tot); if (tot > 0) profitableAll++;
  const h = Math.floor(weeks / 2), first = pnl.slice(0, h).reduce((a, x) => a + x, 0), second = pnl.slice(h, weeks).reduce((a, x) => a + x, 0);
  halves.push([first, second, kind, look, tp, sl]);
}
finals.sort((a, b) => a - b);
const won1 = halves.filter(([a]) => a > 0), keep = won1.filter(([, b]) => b > 0).length, lost1 = halves.filter(([a]) => a <= 0), keepL = lost1.filter(([, b]) => b > 0).length;
const top = [...halves].sort((x, y) => y[0] - x[0]).slice(0, 50), topKeep = top.filter(([, b]) => b > 0).length;
console.log(`${file} (spread ${spread}), 1,000 bots over ${weeks} full weeks:`);
console.log(`  bot-weeks in profit: ${(100 * profitableWeeks / totalWeeks).toFixed(0)}%  (any one week, some bots always look good)`);
console.log(`  bots in profit over all ${weeks} weeks: ${profitableAll} of 1,000`);
console.log(`  longest run of profitable weeks by any bot: ${bestStreak}`);
console.log(`  of the ${won1.length} bots in profit in weeks 1-6, ${keep} (${(100 * keep / Math.max(1, won1.length)).toFixed(0)}%) were in profit in weeks 7-12; of the ${lost1.length} that lost in weeks 1-6, ${keepL} (${(100 * keepL / Math.max(1, lost1.length)).toFixed(0)}%) were`);
console.log(`  the 50 best bots of weeks 1-6: ${topKeep} of 50 in profit in weeks 7-12`);
const kinds=["always buy","always sell","follow","fade"]; const tk={}; for (const h of top) tk[kinds[h[2]]]=(tk[kinds[h[2]]]||0)+1; console.log("  the 50 best of weeks 1-6 by rule: "+JSON.stringify(tk)+"; median target/stop "+(top.map(h=>h[4]).sort((a,b)=>a-b)[25]).toFixed(1)+" / "+(top.map(h=>h[5]).sort((a,b)=>a-b)[25]).toFixed(1));
console.log(`  median bot over the whole period: ${finals[500].toFixed(1)} points; best ${finals[999].toFixed(1)}; worst ${finals[0].toFixed(1)}`);
