// Index engine research: sharpening equity-index dip-buying with literature-based variants.
// Pre-declared split: DEV = SPX, NDX 1990-2009. TEST-TIME = SPX, NDX 2010+. TEST-MARKET = 9 other world indices, all years.
// Costs: 0.02% of price per round trip + 5%/year financing per night held (long index CFD). Returns are % of price
// per trade (1x notional). Metrics: trades/yr, avg %/trade, win %, PF, timing value (mean daily return in trade minus
// mean daily return on all days), exposure, CAGR at 1x notional, max drawdown, Sharpe, years positive.
import { readFileSync } from "node:fs";
const load = (s) => JSON.parse(readFileSync(`ibars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const sma = (b, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += b[k].c; return s / n; };
const rsi = (b, i, n) => { let up = 0, dn = 0; for (let k = i - n + 1; k <= i; k++) { const d = b[k].c - b[k - 1].c; if (d > 0) up += d; else dn -= d; } return dn === 0 ? 100 : 100 - 100 / (1 + up / dn); };
const ibs = (x) => (x.h > x.l ? (x.c - x.l) / (x.h - x.l) : 0.5);
const SPREAD = 0.0002, FIN = 0.05 / 365;
const isLastDay = (b, i) => i + 1 < b.length && new Date(b[i + 1].t).getUTCMonth() !== new Date(b[i].t).getUTCMonth();
const tdom = (b, i) => { let n = 1; for (let k = i - 1; k >= 0 && new Date(b[k].t).getUTCMonth() === new Date(b[i].t).getUTCMonth(); k--) n++; return n; };

// Each variant: entry(b,i) at close i; exit(b,i,pos) at close i. Positions never overlap within a variant.
const up200 = (b, i) => b[i].c > sma(b, i, 200);
const V = {
  "V0 RSI2<10, >SMA200, exit >SMA5": { en: (b, i) => up200(b, i) && rsi(b, i, 2) < 10, ex: (b, i) => b[i].c > sma(b, i, 5) },
  "V1 RSI2<5": { en: (b, i) => up200(b, i) && rsi(b, i, 2) < 5, ex: (b, i) => b[i].c > sma(b, i, 5) },
  "V2 IBS<0.2, exit close>prior high": { en: (b, i) => up200(b, i) && ibs(b[i]) < 0.2, ex: (b, i) => b[i].c > b[i - 1].h },
  "V3 cumulative RSI2 (2d) < 35": { en: (b, i) => up200(b, i) && rsi(b, i, 2) + rsi(b, i - 1, 2) < 35, ex: (b, i) => rsi(b, i, 2) > 65 },
  "V4 3 lower closes": { en: (b, i) => up200(b, i) && b[i].c < b[i - 1].c && b[i - 1].c < b[i - 2].c && b[i - 2].c < b[i - 3].c, ex: (b, i) => b[i].c > sma(b, i, 5) },
  "V5 RSI2<10 + IBS<0.25": { en: (b, i) => up200(b, i) && rsi(b, i, 2) < 10 && ibs(b[i]) < 0.25, ex: (b, i) => b[i].c > sma(b, i, 5) },
  "V6 RSI2<10, exit close>prior high": { en: (b, i) => up200(b, i) && rsi(b, i, 2) < 10, ex: (b, i) => b[i].c > b[i - 1].h },
  "V7 RSI2<10, no SMA200 filter": { en: (b, i) => rsi(b, i, 2) < 10, ex: (b, i) => b[i].c > sma(b, i, 5) },
  "V8 turn of month (last day -> 3rd day)": { en: (b, i) => isLastDay(b, i), ex: (b, i) => tdom(b, i) >= 3 },
  "V9 V0 or turn-of-month (combined)": { en: (b, i) => (up200(b, i) && rsi(b, i, 2) < 10) || isLastDay(b, i), ex: (b, i, p) => p.kind === "tom" ? tdom(b, i) >= 3 && b[i].c > sma(b, i, 5) || tdom(b, i) >= 5 : b[i].c > sma(b, i, 5), kind: (b, i) => (up200(b, i) && rsi(b, i, 2) < 10) ? "dip" : "tom" },
};
function run(b, v, from, to) {
  const tr = []; let pos = null; const daily = [];   // daily strategy returns (0 when flat) for Sharpe / DD / timing value
  for (let i = 201; i < b.length; i++) {
    const inRange = b[i].t >= from && b[i].t < to;
    if (pos) {
      const r = b[i].c / b[i - 1].c - 1 - FIN; daily.push({ t: b[i].t, r, in: true, mkt: b[i].c / b[i - 1].c - 1 });
      if (v.ex(b, i, pos)) { const nights = Math.max(1, Math.round((b[i].t - pos.t) / 86400000));
        tr.push({ t: b[i].t, pct: (b[i].c - pos.e) / pos.e - SPREAD - FIN * nights }); daily[daily.length - 1].r -= SPREAD; pos = null; }
      continue;
    }
    if (inRange) daily.push({ t: b[i].t, r: 0, in: false, mkt: b[i].c / b[i - 1].c - 1 });
    if (inRange && v.en(b, i)) pos = { e: b[i].c, t: b[i].t, kind: v.kind ? v.kind(b, i) : null };
  }
  return { tr, daily: daily.filter((d) => d.t >= from && d.t < to) };
}
// `daily` is the portfolio's day series (equity, drawdown, Sharpe); `raw` is per market-day (timing value).
function metrics(res) {
  const { tr, daily, raw = res.daily } = res; const n = tr.length; if (!n) return null;
  const ps = tr.map((x) => x.pct), m = ps.reduce((s, p) => s + p, 0) / n;
  const gw = ps.filter((p) => p > 0).reduce((s, p) => s + p, 0), gl = -ps.filter((p) => p < 0).reduce((s, p) => s + p, 0);
  let eq = 1, peak = 1, dd = 0; for (const d of daily) { eq *= 1 + d.r; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const yrs = (daily.at(-1).t - daily[0].t) / (365.25 * 86400000), cagr = eq ** (1 / yrs) - 1;
  const dr = daily.map((d) => d.r), dm = dr.reduce((s, r) => s + r, 0) / dr.length, dsd = Math.sqrt(dr.reduce((s, r) => s + (r - dm) ** 2, 0) / dr.length);
  // Timing value: mean market return on days in a trade minus that market's mean return on all days (random long
  // exposure in the same market). Standard error clustered by date: indices move together, so market-days on the
  // same date are not independent observations.
  const mu = new Map(); for (const d of raw) { const e = mu.get(d.s) || { s: 0, n: 0 }; e.s += d.mkt; e.n++; mu.set(d.s, e); }
  const ex = (d) => d.mkt - mu.get(d.s).s / mu.get(d.s).n;
  const inD = raw.filter((d) => d.in), nIn = Math.max(1, inD.length);
  const tv = inD.reduce((s, d) => s + ex(d), 0) / nIn;
  const cl = new Map(); for (const d of inD) cl.set(d.k, (cl.get(d.k) || 0) + ex(d) - tv);
  const tvSe = Math.sqrt([...cl.values()].reduce((s, v) => s + v * v, 0)) / nIn;
  const byY = {}; for (const x of tr) { const y = new Date(x.t).getUTCFullYear(); byY[y] = (byY[y] || 0) + x.pct; }
  const yv = Object.values(byY);
  return { n, perYr: n / yrs, m, win: ps.filter((p) => p > 0).length / n, pf: gl ? gw / gl : Infinity, tv, tvT: tv / tvSe, expo: inD.length / raw.length, cagr, dd, sharpe: dsd ? dm / dsd * Math.sqrt(252) : 0, yPos: yv.filter((v) => v > 0).length, yN: yv.length };
}
const fmt = (k) => !k ? "n/a" : `n=${String(k.n).padStart(4)} ${k.perYr.toFixed(0).padStart(2)}/yr avg ${(100 * k.m).toFixed(2).padStart(5)}% win ${Math.round(100 * k.win)}% PF ${k.pf.toFixed(2)} timing ${(100 * k.tv).toFixed(3)}%/d t=${k.tvT.toFixed(1)} expo ${Math.round(100 * k.expo)}% CAGR ${(100 * k.cagr).toFixed(1)}% maxDD ${Math.round(100 * k.dd)}% Sharpe ${k.sharpe.toFixed(2)} yrs+ ${k.yPos}/${k.yN}`;
const Y = (y) => Date.UTC(y, 0, 1), END = Date.UTC(2100, 0, 1);
const OTHER = ["DJI", "RUT", "DAX", "FTSE", "N225", "SX5E", "CAC", "HSI", "ASX200"];
// Yahoo stamps each daily bar at the exchange's session open in UTC, so markets must be grouped by local date
// (grouping by raw timestamp put every market on its own key and compounded them one after another).
const UTC_OFFSET_H = { N225: 9, HSI: 8, ASX200: 10 };
const dayKey = (s, t) => Math.floor((t + (UTC_OFFSET_H[s] || 0) * 3600000) / 86400000);
const pool = (list, from, to, v) => { const tr = [], raw = []; for (const s of list) { const r = run(load(s), v, from, to); tr.push(...r.tr); raw.push(...r.daily.map((d) => ({ ...d, s, k: dayKey(s, d.t) }))); }
  // Pooled metrics: trades pooled; timing value per market-day; the portfolio is the equal-weight average of the
  // markets trading that day (each market 1/n of capital at 1x notional).
  const byK = new Map(); for (const d of raw) { const e = byK.get(d.k) || { t: d.t, r: 0, n: 0 }; e.r += d.r; e.n++; byK.set(d.k, e); }
  const dd = [...byK.values()].sort((a, b) => a.t - b.t).map((e) => ({ t: e.t, r: e.r / e.n }));
  return metrics({ tr: tr.sort((a, b) => a.t - b.t), daily: dd, raw }); };
const which = process.argv[2];
for (const [name, v] of Object.entries(V)) {
  if (which && !name.startsWith(which)) continue;
  console.log(`\n${name}`);
  console.log(`  DEV   SPX+NDX 1990-2009   ${fmt(pool(["SPX", "NDX"], Y(1990), Y(2010), v))}`);
  console.log(`  TEST  SPX+NDX 2010-2026   ${fmt(pool(["SPX", "NDX"], Y(2010), END, v))}`);
  console.log(`  TEST  9 other indices     ${fmt(pool(OTHER, Y(1990), END, v))}`);
}
