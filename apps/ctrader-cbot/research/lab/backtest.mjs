// Zugrio research lab: replays real M1 history (Dukascopy bid + mean spread) through the exact engine bundle
// and the EA's DAY-style rules, trade by trade, and records each trade with the features a discretionary
// trader would look at. Usage: node backtest.mjs bundle.js bars.json tickSize spreadFloor out.json [mode]
// mode "all": also records setups the EA filters would skip (shadow trades), so filters can be judged.
import { readFileSync, writeFileSync } from "node:fs"; import vm from "node:vm";
const [, , bundle, barsFile, tickArg, floorArg, outFile, mode = "all"] = process.argv;
const tick = +tickArg, spreadFloor = +floorArg;
const ctx = { JSON, Date, Math }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(readFileSync(bundle, "utf8"), ctx);
const E = ctx.ZugrioEngineBridge;
const { symbol, bars: raw, baseMinutes = 1 } = JSON.parse(readFileSync(barsFile, "utf8"));
// Base bars (M1 from Dukascopy, or M5 from Yahoo): entries and exits are simulated on them.
const M1 = raw.map(([t, o, h, l, c, s]) => ({ t, o, h, l, c, s: Math.max(s, spreadFloor), closedAt: t + baseMinutes * 60000 }));   // t = open time ms

// Timeframe bars aggregated on UTC boundaries; closedAt = open + length.
const LEN = { M1: 1, M5: 5, M15: 15, H1: 60, H4: 240, D1: 1440 };
function aggregate(min) {
  const out = []; let cur = null;
  for (const b of M1) {
    const k = Math.floor(b.t / (min * 60000)) * min * 60000;
    if (!cur || cur.t !== k) { if (cur) out.push(cur); cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, closedAt: k + min * 60000 }; }
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; }
  }
  if (cur) out.push(cur); return out;
}
const TF = Object.fromEntries(Object.keys(LEN).map((k) => [k, k === "M1" ? M1 : aggregate(LEN[k])]));
// Index of the last bar closed at or before time t (binary search).
function lastClosed(arr, t) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].closedAt <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
const iso = (ms) => new Date(ms).toISOString();
const slice = (tf, t, n) => { const i = lastClosed(TF[tf], t); return i < 0 ? [] : TF[tf].slice(Math.max(0, i - n + 1), i + 1); };
function atr(bars, n = 14) { if (bars.length < n + 1) return NaN; let s = 0; for (let i = bars.length - n; i < bars.length; i++) { const b = bars[i], pc = bars[i - 1].c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); } return s / n; }
// Swing structure on any timeframe, same rule as the bridge's trendOf (2/2 pivots, last two highs and lows).
function structure(bars) {
  const hs = [], ls = [];
  for (let i = 2; i < bars.length - 2; i++) {
    if (bars[i].h > bars[i - 1].h && bars[i].h > bars[i - 2].h && bars[i].h >= bars[i + 1].h && bars[i].h >= bars[i + 2].h) hs.push(bars[i].h);
    if (bars[i].l < bars[i - 1].l && bars[i].l < bars[i - 2].l && bars[i].l <= bars[i + 1].l && bars[i].l <= bars[i + 2].l) ls.push(bars[i].l);
  }
  if (hs.length < 2 || ls.length < 2) return "UNKNOWN";
  const hh = hs.at(-1) > hs.at(-2), hl = ls.at(-1) > ls.at(-2);
  return hh && hl ? "UP" : !hh && !hl ? "DOWN" : "MIXED";
}

const STYLE = { ctx: "H1", loc: "M15", ent: "M5", fallbacks: ["H4", "D1"], horizon: "INTRADAY", setupMs: 24 * 3600e3, entryMs: 15 * 60e3 };
const P = { breakAtr: 0.1, touchAtr: 0.25, stopAtr: 0.3, chaseAtr: 0.5, runwayAtr: 1.0, minStopAtr: 0.3, maxSpreadShare: 0.25,
  beAtR: 1.0, beLockAtr: 0.05, trailStartR: 1.5, trailAtr: 1.0, keep: 0.5, minStepAtr: 0.1, minGapAtr: 0.2 };

function request(t, cx, a, routes) {
  const ticks = a / tick;
  const markets = [[cx, 120], [STYLE.loc, 200], [STYLE.ent, 300]].map(([tf, n]) => ({ timeframe: tf, bars: slice(tf, t, n).map((b) => ({ closedAt: iso(b.closedAt), o: b.o, h: b.h, l: b.l, c: b.c })) }));
  const ctxAge = cx === "D1" ? 4 * 86400e3 : 2 * LEN[cx] * 60e3;
  return { schema: "zugrio.ea-scan-request/v1", configVersion: "lab", evaluatedAt: iso(t), instrument: { symbol, source: "dukascopy", tickSize: tick },
    family: { family: symbol === "XAUUSD" ? "GOLD" : "FX", priceOrigin: "EXTERNAL_MARKET" },
    horizon: { horizon: cx === STYLE.ctx ? STYLE.horizon : STYLE.horizon + "_" + cx, setupExpiryMs: STYLE.setupMs, entryExpiryMs: STYLE.entryMs },
    timeframes: { context: cx, location: STYLE.loc, entry: STYLE.ent, management: cx, maxAgeMs: { context: ctxAge, location: 2 * LEN[STYLE.loc] * 60e3, entry: 2 * LEN[STYLE.ent] * 60e3, management: ctxAge } },
    model: { route: routes[0], breakTicks: P.breakAtr * ticks, touchTicks: P.touchAtr * ticks, stopTicks: P.stopAtr * ticks, maxChaseTicks: P.chaseAtr * ticks, minimumRunwayTicks: P.runwayAtr * ticks },
    routes, pivots: [{ definitionId: "p1", scale: "INTERMEDIATE", leftBars: 2, rightBars: 2 }], enumeration: { recentFactsPerRole: 3, readyOnly: true }, markets };
}

// Forward simulation on M1 bars with the EA's stop management (BE at 1R, keep half, trail from 1.5R).
function simulate(i0, buy, entry, stop0, target, a, manage = true) {
  const sg = buy ? 1 : -1, R = Math.abs(entry - stop0); let stop = stop0, best = entry;
  for (let j = i0 + 1; j < M1.length; j++) {
    const b = M1[j], lo = buy ? b.l : b.l + b.s, hi = buy ? b.h : b.h + b.s;   // buys exit at bid, sells at ask
    const hitStop = buy ? lo <= stop : hi >= stop, hitTp = buy ? hi >= target : lo <= target;
    if (hitStop) return { exit: buy ? Math.min(stop, b.o) : Math.max(stop, b.o + b.s), j, how: stop === stop0 ? "SL" : "TRAIL" };   // a gap opens past the stop: filled at the open
    if (hitTp) return { exit: target, j, how: "TP" };
    best = buy ? Math.max(best, hi) : Math.min(best, lo);
    const fav = sg * (best - entry); let cand = null;
    if (fav >= P.beAtR * R) cand = entry + sg * Math.max(P.beLockAtr * a, P.keep * fav);
    if (fav >= P.trailStartR * R) { const tr = best - sg * P.trailAtr * a; cand = cand === null ? tr : (buy ? Math.max(cand, tr) : Math.min(cand, tr)); }
    if (cand !== null && manage) {
      const exitPx = buy ? b.c : b.c + b.s, nearest = exitPx - sg * P.minGapAtr * a;
      const ns = buy ? Math.min(cand, nearest) : Math.max(cand, nearest);
      if (sg * (ns - stop) >= P.minStepAtr * a) stop = ns;
    }
  }
  const last = M1.at(-1); return { exit: buy ? last.c : last.c + last.s, j: M1.length - 1, how: "END" };
}

const trades = []; const seen = new Set(); let busyUntil = -1, scans = 0; const t0 = Date.now();
const m5 = TF.M5; const startIdx = m5.findIndex((b) => b.closedAt >= M1[0].t + 21 * 86400e3);   // 3 weeks of warm-up for H4/D1 context
for (let k = startIdx; k < m5.length; k++) {
  const t = m5[k].closedAt; const i = lastClosed(M1, t); if (i < 0) continue;
  const a = atr(slice("M15", t, 20)); if (!(a > 0)) continue;
  let routes = ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"];
  for (const cx of [STYLE.ctx, ...STYLE.fallbacks]) {
    if (!routes.length) break;
    let multi; try { multi = JSON.parse(E.scanRoutes(JSON.stringify(request(t, cx, a, routes)))); } catch { break; } scans++;
    const next = [];
    for (const r of multi.results) {
      if (r.openSky) next.push(r.route);
      const b = r.best; if (!b) continue;
      const key = b.opportunityId + b.geometry.frozenAt; if (seen.has(key)) continue; seen.add(key);
      const buy = b.side === "BUY", g = b.geometry, bar = M1[i];
      const entry = buy ? bar.c + bar.s : bar.c, stop = g.childInvalidation, target = g.objective, R = Math.abs(entry - stop);
      const h4 = slice("H4", t, 60), d1 = slice("D1", t, 60), h4hi = Math.max(...h4.slice(-30).map((x) => x.h)), h4lo = Math.min(...h4.slice(-30).map((x) => x.l));
      const f = { t: iso(t), symbol, route: r.route, side: b.side, ctx: cx, trend: r.trend, h4Trend: structure(h4), d1Trend: structure(d1), hour: new Date(t).getUTCHours(),
        stopAtr: +(R / a).toFixed(3), rr: +(Math.abs(target - entry) / R).toFixed(2), spreadShare: +(bar.s / R).toFixed(3),
        h4Loc: +((bar.c - h4lo) / Math.max(1e-12, h4hi - h4lo)).toFixed(2), atrRegime: +(a / atr(slice("M15", t, 401), 400)).toFixed(2) };
      // EA filters, in the EA's order. "skip" keeps the reason; shadow trades are still simulated so each filter can be judged.
      let skip = null;
      if (r.route === "CONTINUATION_RETEST" && r.trend !== (buy ? "UP" : "DOWN")) skip = "TREND_NOT_ALIGNED";
      else if (r.route === "REVERSAL_RECLAIM" && r.trend === (buy ? "DOWN" : "UP")) skip = "COUNTER_TREND_RECLAIM";
      else if (!((buy ? entry > stop : entry < stop) && (buy ? entry < target : entry > target))) skip = "PRICE_NOT_BETWEEN";
      else if (R < P.minStopAtr * a * (1 - 1e-9)) skip = "STOP_TOO_CLOSE";
      else if (bar.s > P.maxSpreadShare * R) skip = "SPREAD_TOO_WIDE";
      else if (i <= busyUntil) skip = "POSITION_OPEN";
      if (skip === "PRICE_NOT_BETWEEN") { trades.push({ ...f, skip, r: null }); continue; }
      if (skip && mode !== "all") continue;
      const sim = simulate(i, buy, entry, stop, target, a);
      const rr = (buy ? sim.exit - entry : entry - sim.exit) / R;
      // Exit variants on the same setup: fixed take-profit at k x R (never beyond the engine objective), with or without stop management.
      const rv = { engine_managed: +rr.toFixed(3) };
      const toR = (x) => +((buy ? x.exit - entry : entry - x.exit) / R).toFixed(3);
      rv.engine_plain = toR(simulate(i, buy, entry, stop, target, a, false));
      for (const k of [1, 1.5, 2, 3]) {
        const tp = buy ? Math.min(target, entry + k * R) : Math.max(target, entry - k * R);
        rv[`tp${k}_plain`] = toR(simulate(i, buy, entry, stop, tp, a, false));
        rv[`tp${k}_managed`] = toR(simulate(i, buy, entry, stop, tp, a, true));
      }
      trades.push({ ...f, skip, r: +rr.toFixed(3), rv, how: sim.how, minutes: (sim.j - i) * baseMinutes });
      if (!skip) busyUntil = sim.j;
    }
    routes = next;
  }
}
writeFileSync(outFile, JSON.stringify({ symbol, scans, seconds: Math.round((Date.now() - t0) / 1000), trades }));
const taken = trades.filter((x) => !x.skip && x.r !== null);
const avg = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
console.log(`${symbol}: ${scans} scans in ${Math.round((Date.now() - t0) / 1000)} s, ${trades.length} READY setups, ${taken.length} taken, win ${Math.round(100 * taken.filter((x) => x.r > 0).length / Math.max(1, taken.length))}%, avg ${avg(taken.map((x) => x.r)).toFixed(3)}R, sum ${taken.reduce((s, x) => s + x.r, 0).toFixed(1)}R`);
