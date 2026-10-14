// The engines that passed their registered tests, combined as the EA sizes them: every trade risks 1 unit (R) to its
// protective stop, so a month's portfolio result is the sum of the R of the trades and periods closed in it.
//   INDEX  idxfut.mjs: V4 "3 lower closes" above SMA200, exit above SMA5, 3-ATR stop; ES and NQ daily futures closes.
//   GOLD   tsmom.mjs rule A: 12-month sign, monthly; R per month = return / (3 monthly sigma), the EA's 3-sigma stop.
//   CRYPTO crypto_trend.mjs C2: 4-week sign, weekly, BTC and ETH; R per week = return / (3 weekly sigma), the EA's stop.
// Costs as registered for each engine (financing: index 5%/yr, gold FIN_GOLD default 1.5%/yr = the EA's swap limit,
// crypto 10%/yr). Descriptive: no new rule and no new threshold; the combination is equal risk per engine trade.
// node portfolio.mjs <lab dir with fbars/ cbars/> <dir with BTCUSDT.json ETHUSDT.json>
import fs from "fs";
const [LAB, CRY] = process.argv.slice(2), FIN_GOLD = +(process.env.FIN_GOLD ?? 0.015);
const ym = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

function index(sym) {
  const b = JSON.parse(fs.readFileSync(`${LAB}/fbars/${sym}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
  const sma = (i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
  const atr = (i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].h - b[k].l, Math.abs(b[k].h - b[k - 1].c), Math.abs(b[k].l - b[k - 1].c)); return s / n; };
  const out = []; let p = null;
  for (let i = 201; i < b.length; i++) { const x = b[i];
    if (p) { p.n++; const hit = x.l <= p.stop; if (hit || x.c > sma(i, 5)) { const px = hit ? Math.min(p.stop, x.o) : x.c; out.push({ t: x.t, r: (px - p.e - p.e * (0.0002 + 0.05 / 252 * p.n)) / p.R }); p = null; } continue; }
    if (x.c > sma(i, 200) && b[i].c < b[i - 1].c && b[i - 1].c < b[i - 2].c && b[i - 2].c < b[i - 3].c) { const a = atr(i, 14); p = { e: x.c, stop: x.c - 3 * a, R: 3 * a, n: 0 }; } }
  return out;
}
function gold() {
  const b = JSON.parse(fs.readFileSync(`${LAB}/cbars/GOLD.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, c })), ends = [], out = [];
  for (let i = 1; i < b.length; i++) if (new Date(b[i].t).getUTCMonth() !== new Date(b[i - 1].t).getUTCMonth()) ends.push(i - 1);
  let prev = 0;
  for (let m = 12; m < ends.length - 1; m++) {
    const i = ends[m], j = ends[m + 1], pos = Math.sign(b[i].c / b[ends[m - 12]].c - 1), rs = [];
    for (let q = i - 59; q <= i; q++) rs.push(Math.log(b[q].c / b[q - 1].c));
    const mu = rs.reduce((a, x) => a + x, 0) / 60, sd = Math.sqrt(rs.reduce((a, x) => a + (x - mu) ** 2, 0) / 59) * Math.sqrt(21);
    if (!(sd > 0) || pos === 0) { prev = pos; continue; }
    const r = pos * (b[j].c / b[i].c - 1) - Math.abs(pos - prev) * 0.0003 - FIN_GOLD / 12; prev = pos;
    out.push({ t: b[j].t, r: r / (3 * sd) });
  }
  return out;
}
function crypto(sym) {
  const rows = JSON.parse(fs.readFileSync(`${CRY}/${sym}.json`, "utf8")), ends = [], out = [];   // [epoch s, close]
  for (let i = 1; i < rows.length; i++) if (new Date(rows[i][0] * 1000).getUTCDay() === 1) ends.push(i - 1);
  let prev = 0;
  for (let k = 4; k + 1 < ends.length; k++) {
    const i = ends[k], j = ends[k + 1], pos = Math.sign(rows[i][1] - rows[ends[k - 4]][1]);
    let s = 0, n = 0; for (let q = Math.max(1, i - 59); q <= i; q++) { const r = Math.log(rows[q][1] / rows[q - 1][1]); s += r * r; n++; }
    const days = (rows[j][0] - rows[i][0]) / 86400, v = Math.sqrt(s / n) * Math.sqrt(days); if (!(v > 0)) continue;
    const r = pos * (rows[j][1] / rows[i][1] - 1) - 0.002 * Math.abs(pos - prev) - 0.10 * Math.abs(pos) * days / 365; prev = pos;
    out.push({ t: rows[j][0] * 1000, r: r / (3 * v) });
  }
  return out;
}

const engines = { INDEX: [...index("ES"), ...index("NQ")], GOLD: gold(), CRYPTO: [...crypto("BTCUSDT"), ...crypto("ETHUSDT")] };
const monthly = {}; for (const [e, xs] of Object.entries(engines)) { monthly[e] = new Map(); for (const x of xs) monthly[e].set(ym(x.t), (monthly[e].get(ym(x.t)) || 0) + x.r); }
const first = (e) => [...monthly[e].keys()].sort()[0], last = (e) => [...monthly[e].keys()].sort().at(-1);
const months = (a, b) => { const out = []; let [y, m] = a.split("-").map(Number); const [yb, mb] = b.split("-").map(Number); while (y < yb || (y === yb && m <= mb)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const start = Object.keys(engines).map(first).sort().at(-1), end = Object.keys(engines).map(last).sort()[0];
const M = months(start, end), series = Object.fromEntries(Object.keys(engines).map((e) => [e, M.map((k) => monthly[e].get(k) || 0)]));
series.ALL = M.map((_, i) => Object.keys(engines).reduce((a, e) => a + series[e][i], 0));

const mean = (v) => v.reduce((a, x) => a + x, 0) / v.length, sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1)); };
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / ((a.length - 1) * sd(a) * sd(b)); };
const maxDD = (v) => { let peak = 0, cum = 0, dd = 0; for (const x of v) { cum += x; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); } return dd; };
const out = [`Common period ${start} to ${end} (${M.length} months). Units: R, the risk of one trade to its stop.`, ""];
out.push("engine | trades/periods | R per year | monthly t | annual Sharpe | max drawdown | worst month | months positive | years positive");
for (const e of [...Object.keys(engines), "ALL"]) {
  const v = series[e], n = e === "ALL" ? Object.values(engines).reduce((a, xs) => a + xs.filter((x) => ym(x.t) >= start && ym(x.t) <= end).length, 0) : engines[e].filter((x) => ym(x.t) >= start && ym(x.t) <= end).length;
  const years = {}; M.forEach((k, i) => { years[k.slice(0, 4)] = (years[k.slice(0, 4)] || 0) + v[i]; });
  const yv = Object.values(years);
  out.push(`${e} | ${n} | ${(12 * mean(v)).toFixed(2)} | ${(mean(v) / (sd(v) / Math.sqrt(v.length))).toFixed(2)} | ${(mean(v) / sd(v) * Math.sqrt(12)).toFixed(2)} | ${maxDD(v).toFixed(1)}R | ${Math.min(...v).toFixed(2)}R | ` +
    `${Math.round(100 * v.filter((x) => x > 0).length / v.filter((x) => x !== 0).length)}% | ${yv.filter((x) => x > 0).length}/${yv.length}`);
}
out.push("", "monthly correlations: " + [["INDEX", "GOLD"], ["INDEX", "CRYPTO"], ["GOLD", "CRYPTO"]].map(([a, b]) => `${a}-${b} ${corr(series[a], series[b]).toFixed(2)}`).join(", "));
const yearsAll = {}; M.forEach((k, i) => { yearsAll[k.slice(0, 4)] = (yearsAll[k.slice(0, 4)] || 0) + series.ALL[i]; });
out.push("ALL by year (R): " + Object.entries(yearsAll).map(([y, r]) => `${y} ${r >= 0 ? "+" : ""}${r.toFixed(1)}`).join(", "));
const per = 12 * mean(series.ALL), dd = maxDD(series.ALL);
out.push("", `At a risk of r% of equity per trade, the expected year is about ${per.toFixed(1)} x r% with a worst historical drawdown of about ${dd.toFixed(1)} x r% (simple, not compounded):`);
for (const r of [0.25, 0.5, 1]) out.push(`  r = ${r}%: about ${(per * r).toFixed(1)}% a year, worst drawdown about ${(dd * r).toFixed(1)}%`);
console.log(out.join("\n"));
