// Top-down liquidity model v2: same setup detection as topdown.mjs (sweep -> reclaim -> shift), plus
//  - higher-timeframe POI features: was the sweep extreme inside an open H4 / D1 fair value gap of the trade's direction;
//  - entry permutations: market at the shift close (MKT), limit at the shift-leg FVG's near edge (FVG),
//    limit at the FVG midpoint (CE); limits must fill within `fillBars` bars, before the target or the stop trades;
//  - exit permutations: fixed 1.5R / 2R / 3R and the nearest opposite liquidity (>= 1.5R).
// Conservative fills: a stop and target touched in the same bar count as the stop; a limit filled in a bar that also
// trades the stop counts as a loss; buys fill/exit on bid + spread for the ask side.
// Usage: node topdown2.mjs STYLE SYMBOL [triggerK] [reclaimBars] [shiftBars]   (reads ybars/ hbars/, writes td2/)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { aggregate, lastClosed, atrAt, swings, structure, biasAt, dealingRange, fvgAt, candles, liquidityLevels } from "./ta.mjs";
const [, , STYLE, SYM, kArg, rcArg, shArg] = process.argv;
const MK = JSON.parse(readFileSync(new URL("./markets.json", import.meta.url), "utf8"))[SYM];
const spread = MK.spread;
const load = (f) => { const d = JSON.parse(readFileSync(f, "utf8")); const m = d.baseMinutes || 1;
  return d.bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c, closedAt: t + m * 60000 })); };
const h1 = load(`hbars/${SYM}.json`), h4 = aggregate(h1, "H4"), d1 = aggregate(h1, "D1"), w1 = aggregate(h1, "W1"), mn = aggregate(h1, "MN");
const base = {
  SWING: { entry: () => h1, triggerK: 2, bias: { MN: [mn, 2], W1: [w1, 2], D1: [d1, 3], H4: [h4, 3] }, liq: () => [d1, 3], loc: ["W1", "D1"], poi: ["D1", "H4"], reclaimBars: 3, shiftBars: 24, fillBars: 12 },
  INTRA: { entry: () => h1, triggerK: 1, bias: { W1: [w1, 2], D1: [d1, 3], H4: [h4, 3] }, liq: () => [h4, 2], loc: ["D1", "H4"], poi: ["D1", "H4"], reclaimBars: 2, shiftBars: 8, fillBars: 6 },
  DAY: { entry: () => load(`ybars/${SYM}.json`), triggerK: 2, bias: { W1: [w1, 2], D1: [d1, 3], H4: [h4, 3], H1: [h1, 3] }, liq: () => [h1, 3], loc: ["D1", "H4"], poi: ["H4", "H1"], reclaimBars: 3, shiftBars: 12, fillBars: 12 },
  SCALP: { entry: () => load(`ybars/${SYM}.json`), triggerK: 1, bias: { D1: [d1, 3], H4: [h4, 3], H1: [h1, 3] }, liq: (E) => [aggregate(E, "M15"), 2], loc: ["H4", "H1"], poi: ["H1", "H4"], reclaimBars: 2, shiftBars: 6, fillBars: 6 },
}[STYLE];
const CFG = { ...base, triggerK: kArg ? +kArg : base.triggerK, reclaimBars: rcArg ? +rcArg : base.reclaimBars, shiftBars: shArg ? +shArg : base.shiftBars };
const E = CFG.entry(); const [liqBars, liqK] = CFG.liq(E);
const ST = Object.fromEntries(Object.entries(CFG.bias).map(([k, [bars, sk]]) => [k, structure(bars, sk)]));
const TFB = { MN: mn, W1: w1, D1: d1, H4: h4, H1: h1 };
const liqSwings = swings(liqBars, liqK), entrySw = swings(E, CFG.triggerK);
const start = E[0].t + (STYLE === "SWING" || STYLE === "INTRA" ? 120 : 21) * 86400000;

// Open fair value gaps of a timeframe as of t, in direction dir, not yet closed through their far side.
function openFvgs(bars, t, dir, lookback = 80) {
  const i = lastClosed(bars, t), out = [];
  for (let k = Math.max(2, i - lookback); k <= i; k++) {
    const g = fvgAt(bars, k); if (!g || g.dir !== dir) continue;
    let alive = true;
    for (let m = k + 1; m <= i; m++) if (dir === "UP" ? bars[m].c < g.bottom : bars[m].c > g.top) { alive = false; break; }
    if (alive) out.push(g);
  }
  return out;
}

const setups = []; let levelsAt = -1, levels = []; const swept = new Set();
let swi = 0; const known = { H: [], L: [] };
for (let j = 20; j < E.length - 1; j++) {
  const b = E[j], t = b.closedAt;
  while (swi < entrySw.length && entrySw[swi].knownAt <= t) { const s = entrySw[swi++]; known[s.type].push(s); }
  if (t < start) continue;
  const hi = lastClosed(h1, t);
  if (hi !== levelsAt) { levelsAt = hi; const a1 = atrAt(h1, hi); levels = a1 > 0 ? liquidityLevels(h1, liqSwings, t, { tol: 0.1 * a1, swingBars: liqBars }) : []; }
  const aE = atrAt(E, j); if (!(aE > 0)) continue;
  for (const L of levels) {
    const buy = L.side === "L", sg = buy ? 1 : -1, key = L.kind + ":" + L.price.toFixed(6);
    if (swept.has(key) || !(buy ? b.l < L.price : b.h > L.price)) continue;
    swept.add(key);
    let rj = -1, ext = buy ? b.l : b.h, extJ = j;
    for (let k = j; k < Math.min(E.length, j + CFG.reclaimBars); k++) {
      if (buy ? E[k].l < ext : E[k].h > ext) { ext = buy ? E[k].l : E[k].h; extJ = k; }
      if (buy ? E[k].c > L.price : E[k].c < L.price) { rj = k; break; }
    }
    if (rj < 0) continue;
    const shift = known[buy ? "H" : "L"].filter((s) => s.i < extJ && s.knownAt <= E[j].closedAt).at(-1);
    if (!shift || !(sg * (shift.price - L.price) > 0)) continue;
    let tj = -1;
    for (let k = rj; k < Math.min(E.length - 1, extJ + CFG.shiftBars); k++) {
      if (k > rj && (buy ? E[k].l < ext : E[k].h > ext)) break;
      if (buy ? E[k].c > shift.price : E[k].c < shift.price) { tj = k; break; }
    }
    if (tj < 0) continue;
    const tb = E[tj], tt = tb.closedAt;
    const bias = Object.fromEntries(Object.keys(ST).map((k) => [k, biasAt(ST[k], tt)]));
    const pos = Object.fromEntries(CFG.loc.map((k) => [k, +dealingRange(ST[k], tt, tb.c).pos.toFixed(2)]));
    // The shift leg's most recent FVG in the trade direction (entry zone for the FVG / CE variants).
    let legFvg = null; for (let k = extJ + 2; k <= tj; k++) { const g = fvgAt(E, k); if (g && g.dir === (buy ? "UP" : "DOWN")) legFvg = g; }
    const ind = known[buy ? "L" : "H"].some((s) => s.i > shift.i && s.i < j && sg * (s.price - L.price) > 0 && s.knownAt <= E[j].closedAt);
    const cs = candles(E, extJ);
    const revCandle = cs.some((c) => (buy ? ["HAMMER", "BULLISH_ENGULFING", "MORNING_STAR"] : ["SHOOTING_STAR", "BEARISH_ENGULFING", "EVENING_STAR"]).includes(c));
    const body = Math.abs(tb.c - tb.o), range = tb.h - tb.l;
    const displacement = body >= 0.7 * aE && range > 0 && (buy ? (tb.c - tb.l) / range >= 0.75 : (tb.h - tb.c) / range >= 0.75) && sg * (tb.c - tb.o) > 0;
    // Higher-timeframe POI: sweep extreme inside an open FVG of the trade direction, as of the sweep bar.
    const inPoi = Object.fromEntries(CFG.poi.map((tf) => [tf, openFvgs(TFB[tf], E[j].closedAt, buy ? "UP" : "DOWN").some((g) => ext >= g.bottom - 0.1 * aE && ext <= g.top + 0.1 * aE)]));
    const stop = buy ? ext - 0.1 * aE : ext + 0.1 * aE + spread;
    const lv = liquidityLevels(h1, liqSwings, tt, { tol: 0.1 * atrAt(h1, lastClosed(h1, tt)), swingBars: liqBars });
    // Simulate one entry/exit permutation. tpR: fixed multiple, or "liq" for the nearest opposite liquidity >= 1.5R.
    const sim = (mode, tpR) => {
      let e, j0, filled = true;
      if (mode === "MKT") { e = buy ? tb.c + spread : tb.c; j0 = tj; }
      else {
        if (!legFvg) return null;
        e = mode === "FVG" ? (buy ? legFvg.top : legFvg.bottom) : (legFvg.top + legFvg.bottom) / 2;
        if (!(sg * (e - stop) > 0)) return null;
        filled = false; j0 = -1;
        for (let k = tj + 1; k < Math.min(E.length, tj + 1 + CFG.fillBars); k++) {
          const x = E[k];
          if (buy ? x.l <= stop : x.h + spread >= stop) return null;            // invalidated before fill
          if (buy ? x.l + spread <= e : x.h >= e) { filled = true; j0 = k; break; }
        }
        if (!filled) return null;
      }
      const R = Math.abs(e - stop); if (!(R > 0)) return null;
      let tp;
      if (tpR === "liq") { const c = lv.filter((x) => x.side === (buy ? "H" : "L") && sg * (x.price - e) >= 1.5 * R).sort((a, z) => sg * (a.price - z.price))[0]; if (!c) return null; tp = c.price; }
      else tp = e + sg * tpR * R;
      // Fill bar (limit): stop also traded in that bar = loss; target not credited in the fill bar.
      if (mode !== "MKT") { const x = E[j0]; if (buy ? x.l <= stop : x.h + spread >= stop) return { r: -1, bars: j0 - tj, R }; }
      for (let k = j0 + 1; k < E.length; k++) {
        const x = E[k], lo = buy ? x.l : x.l + spread, hiP = buy ? x.h : x.h + spread;
        if (buy ? lo <= stop : hiP >= stop) return { r: (buy ? Math.min(stop, x.o) - e : e - Math.max(stop, x.o + spread)) / R, bars: k - tj, R };
        if (buy ? hiP >= tp : lo <= tp) return { r: (buy ? tp - e : e - tp) / R, bars: k - tj, R };
      }
      return null;   // still open at the end of the data: not counted
    };
    const res = {};
    for (const m of ["MKT", "FVG", "CE"]) for (const r of [1.5, 2, 3, "liq"]) { const s = sim(m, r); res[`${m}_${r}`] = s ? +s.r.toFixed(3) : null; }
    setups.push({ t: new Date(tt).toISOString(), symbol: SYM, style: STYLE, side: buy ? "BUY" : "SELL", level: L.kind, hour: new Date(tt).getUTCHours(),
      bias, pos, inPoi, fvg: !!legFvg, inducement: ind, revCandle, displacement, stopAtr: +(Math.abs((buy ? tb.c + spread : tb.c) - stop) / aE).toFixed(2), res });
  }
}
mkdirSync("td2", { recursive: true });
const tag = [STYLE, SYM, kArg, rcArg, shArg].filter(Boolean).join("-");
writeFileSync(`td2/${tag}.json`, JSON.stringify({ symbol: SYM, style: STYLE, cfg: { triggerK: CFG.triggerK, reclaimBars: CFG.reclaimBars, shiftBars: CFG.shiftBars }, setups }));
console.log(`${tag}: ${setups.length} triggered setups`);
