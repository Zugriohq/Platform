// Trade-by-trade scalp simulation on a random-walk M1 path (how Deriv generates Volatility indices).
// EA rules: scanRoutes(readyOnly), trend filter (continuation) + no counter-trend reclaims, min stop 0.3 ATR,
// TP = nearer of engine objective and targetR x R, time stop, one position at a time, spread cost.
// Usage: node replay3.mjs bundle hours seed runwayAtr targetR maxMin spreadAtr
import { readFileSync } from "node:fs"; import vm from "node:vm";
const [, , bundle, hours = "24", seed0 = "1", runwayAtr = "1.0", targetR = "1.0", maxMin = "30", spreadAtr = "0.03"] = process.argv;
const ctx = { JSON, Date, Math }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(readFileSync(bundle, "utf8"), ctx);
let s = (+seed0 * 2654435761) >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const min = { M1: 1, M5: 5, M15: 15, H1: 60 };
const warm = 300 * 60 + 10; const N = warm + (+hours) * 60 + 200; const start = Date.parse("2026-09-01T00:00:00Z");
const m1 = []; let p = 1000;
// Bars built from a tick path (30 ticks a minute), so highs and lows are prices the path actually visited.
for (let i = 0; i < N; i++) { const o = p; let h = p, l = p; for (let k = 0; k < 30; k++) { p += (rnd() - 0.5) * 0.11; if (p > h) h = p; if (p < l) l = p; } m1.push({ t: start + (i + 1) * 60000, o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +p.toFixed(2) }); }
const agg = (upto, n, keep) => { const out = []; const last = upto - ((upto + 1) % n); for (let i = Math.max(n - 1, last - (keep - 1) * n); i <= last; i += n) { const g = m1.slice(i - n + 1, i + 1); out.push({ closedAt: new Date(g.at(-1).t).toISOString(), o: g[0].o, h: Math.max(...g.map(x => x.h)), l: Math.min(...g.map(x => x.l)), c: g.at(-1).c }); } return out; };
const atrOf = (bars, n = 14) => { let sum = 0; for (let i = bars.length - n; i < bars.length; i++) { const b = bars[i], pc = bars[i - 1].c; sum += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); } return sum / n; };
const res = { setups: 0, trades: 0, wins: 0, rs: [], holds: [], skip: {} }; const seen = new Set(); let busyUntil = -1;
const skip = (k) => res.skip[k] = (res.skip[k] || 0) + 1;
for (let i = warm; i < N - 200; i++) {
  if (i <= busyUntil) continue;
  const loc = agg(i, 5, 200), ent = agg(i, 1, 300); const a = atrOf(loc); const t = a / 0.01;
  let routes = ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"], taken = false;
  for (const cx of ["M15", "H1"]) {
    if (!routes.length || taken) break;
    const req = { schema: "zugrio.ea-scan-request/v1", configVersion: "replay", evaluatedAt: ent.at(-1).closedAt, instrument: { symbol: "WALK", source: "t", tickSize: 0.01 }, family: { family: "SYNTHETIC", priceOrigin: "SYNTHETIC_GENERATOR" },
      horizon: { horizon: cx === "M15" ? "SCALP" : "SCALP_" + cx, setupExpiryMs: 6 * 3600e3, entryExpiryMs: 180e3 },
      timeframes: { context: cx, location: "M5", entry: "M1", management: cx, maxAgeMs: { context: 2 * min[cx] * 60e3, location: 600e3, entry: 120e3, management: 2 * min[cx] * 60e3 } },
      model: { route: routes[0], breakTicks: 0.1 * t, touchTicks: 0.25 * t, stopTicks: 0.3 * t, maxChaseTicks: 0.5 * t, minimumRunwayTicks: +runwayAtr * t }, routes,
      pivots: [{ definitionId: "p1", scale: "INTERMEDIATE", leftBars: 2, rightBars: 2 }], enumeration: { recentFactsPerRole: 3, readyOnly: true },
      markets: [{ timeframe: cx, bars: agg(i, min[cx], 120) }, { timeframe: "M5", bars: loc }, { timeframe: "M1", bars: ent }] };
    const multi = JSON.parse(ctx.ZugrioEngineBridge.scanRoutes(JSON.stringify(req)));
    const next = [];
    for (const r of multi.results) {
      if (r.openSky) next.push(r.route);
      const b = r.best; if (!b || taken) continue;
      const key = b.opportunityId + b.geometry.frozenAt; if (seen.has(key)) continue; seen.add(key); res.setups++;
      const buy = b.side === "BUY", sg = buy ? 1 : -1, g = b.geometry, px = m1[i].c;
      if (r.route === "CONTINUATION_RETEST" && r.trend !== (buy ? "UP" : "DOWN")) { skip("trend"); continue; }
      if (r.route === "REVERSAL_RECLAIM" && r.trend === (buy ? "DOWN" : "UP")) { skip("counterTrend"); continue; }
      if (!(sg * (px - g.childInvalidation) > 0 && sg * (g.objective - px) > 0)) { skip("price"); continue; }
      const R = Math.abs(px - g.childInvalidation); if (R < 0.3 * a * (1 - 1e-9)) { skip("stopTooClose"); continue; }
      if (+targetR > 0 && Math.abs(g.objective - px) < +targetR * R) { skip("targetTooClose"); continue; }
      const tp = +targetR > 0 ? px + sg * Math.min(Math.abs(g.objective - px), +targetR * R) : g.objective, sl = g.childInvalidation;
      const spread = +spreadAtr * a; let exit = null, j = i + 1;
      for (; j < N && j <= i + (+maxMin > 0 ? +maxMin : 1e9); j++) {
        const bar = m1[j]; const hitSl = buy ? bar.l <= sl : bar.h >= sl, hitTp = buy ? bar.h >= tp : bar.l <= tp;
        if (hitSl) { exit = sl; break; } if (hitTp) { exit = tp; break; }      // both in one bar: stop first (conservative)
      }
      if (exit === null) { j = Math.min(j, N - 1); exit = m1[j].c; }
      const rr = (sg * (exit - px) - spread) / R; res.trades++; if (rr > 0) res.wins++; res.rs.push(rr); res.holds.push(j - i); busyUntil = j; taken = true;
    }
    routes = next;
  }
}
const avg = (x) => x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
console.log(JSON.stringify({ seed: +seed0, hours: +hours, runwayAtr: +runwayAtr, targetR: +targetR, setups: res.setups, trades: res.trades, perHour: +(res.trades / +hours).toFixed(2), winPct: res.trades ? Math.round(100 * res.wins / res.trades) : 0, avgR: +avg(res.rs).toFixed(3), sumR: +res.rs.reduce((a, b) => a + b, 0).toFixed(2), avgHoldMin: Math.round(avg(res.holds)), skip: res.skip }));
