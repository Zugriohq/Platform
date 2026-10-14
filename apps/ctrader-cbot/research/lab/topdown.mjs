// Zugrio top-down liquidity model (research prototype), one engine for SWING / DAY / SCALP.
// For a buy (sells mirrored):
//   1. Top-down: bias of each higher timeframe (BOS/CHoCH structure) and where price sits in its dealing range.
//   2. Point of interest: sell-side liquidity below price (PDL, PWL, Asia low, unswept external swing lows, equal lows).
//   3. Sweep: a bar trades through the level and a close back above it follows within `reclaimBars` bars.
//   4. Shift: a close above the latest internal swing high formed before the sweep low (a CHoCH on the entry
//      timeframe), within `shiftBars` bars of the sweep low, before price trades below that low.
//   5. Entry at the shift close; stop beyond the sweep low by a buffer; target the nearest buy-side liquidity
//      at least minRR away, and a fixed 2R alternative.
// Every setup is recorded with its features so each part of the model can be judged. Usage:
//   node topdown.mjs STYLE entryBars.json h1Bars.json tickSize spreadFloor out.json
import { readFileSync, writeFileSync } from "node:fs";
import { aggregate, lastClosed, atrAt, swings, structure, biasAt, dealingRange, fvgAt, candles, liquidityLevels } from "./ta.mjs";
const [, , STYLE, entryFile, h1File, tickArg, floorArg, outFile] = process.argv;
const spreadFloor = +floorArg;
const load = (f) => { const d = JSON.parse(readFileSync(f, "utf8")); const m = d.baseMinutes || 1;
  return { symbol: d.symbol, bars: d.bars.map(([t, o, h, l, c]) => ({ t, o, h, l, c, closedAt: t + m * 60000 })) }; };
const H1src = load(h1File); const symbol = H1src.symbol;
const h1 = H1src.bars, h4 = aggregate(h1, "H4"), d1 = aggregate(h1, "D1"), w1 = aggregate(h1, "W1"), mn = aggregate(h1, "MN");

const CFG = {
  SWING: { entry: h1, triggerK: 2, bias: { MN: [mn, 2], W1: [w1, 2], D1: [d1, 3], H4: [h4, 3] }, liqTF: [d1, 3], loc: ["W1", "D1"], reclaimBars: 3, shiftBars: 24, minRR: 1.5, levelKinds: null },
  DAY: { entryFile, triggerK: 2, bias: { W1: [w1, 2], D1: [d1, 3], H4: [h4, 3], H1: [h1, 3] }, liqTF: [h1, 3], loc: ["D1", "H4"], reclaimBars: 3, shiftBars: 12, minRR: 1.5, levelKinds: null },
  SCALP: { entryFile, triggerK: 1, bias: { D1: [d1, 3], H4: [h4, 3], H1: [h1, 3] }, liqTF: [null, 2], loc: ["H4", "H1"], reclaimBars: 2, shiftBars: 6, minRR: 1.0, levelKinds: null },
}[STYLE];
const E = CFG.entry ?? load(CFG.entryFile).bars;
if (CFG.liqTF[0] === null) CFG.liqTF[0] = aggregate(E, "M15");   // scalps: M15 internal liquidity
const ST = Object.fromEntries(Object.entries(CFG.bias).map(([k, [bars, sk]]) => [k, structure(bars, sk)]));
const liqSwings = swings(CFG.liqTF[0], CFG.liqTF[1]);
const entrySw = swings(E, CFG.triggerK);
const entryMin = (E[1].t - E[0].t) / 60000;
// History before the entry feed starts gives the higher timeframes their context; trade only inside the entry feed
// and after 3 weeks of it.
const start = E[0].t + (STYLE === "SWING" ? 120 : 21) * 86400000;

const setups = [];
let levelsAt = -1, levels = [];
const swept = new Set();
let swi = 0; const known = { H: [], L: [] };   // entry-TF internal swings known so far
for (let j = 20; j < E.length - 1; j++) {
  const b = E[j], t = b.closedAt;
  while (swi < entrySw.length && entrySw[swi].knownAt <= t) { const s = entrySw[swi++]; known[s.type].push(s); }
  if (t < start) continue;
  const hi = lastClosed(h1, t);
  if (hi !== levelsAt) { levelsAt = hi; const a1 = atrAt(h1, hi); levels = a1 > 0 ? liquidityLevels(h1, liqSwings, t, { tol: 0.1 * a1, swingBars: CFG.liqTF[0] }) : []; }
  const aE = atrAt(E, j); if (!(aE > 0)) continue;
  for (const L of levels) {
    const buy = L.side === "L", sg = buy ? 1 : -1, key = L.kind + ":" + L.price.toFixed(6);
    if (swept.has(key)) continue;
    const pierced = buy ? b.l < L.price : b.h > L.price;
    if (!pierced) continue;
    swept.add(key);   // a level is consumed by its first sweep (contract: no resurrection)
    // Reclaim: a close back on the original side within reclaimBars bars (the sweep bar itself counts).
    let rj = -1, ext = buy ? b.l : b.h, extJ = j;
    for (let k = j; k < Math.min(E.length, j + CFG.reclaimBars); k++) {
      if (buy ? E[k].l < ext : E[k].h > ext) { ext = buy ? E[k].l : E[k].h; extJ = k; }
      if (buy ? E[k].c > L.price : E[k].c < L.price) { rj = k; break; }
    }
    if (rj < 0) { setups.push({ t: new Date(t).toISOString(), symbol, style: STYLE, side: buy ? "BUY" : "SELL", level: L.kind, outcome: "NO_RECLAIM" }); continue; }
    // Shift level: the latest internal swing on the opposite side, confirmed by the sweep bar and formed before the extreme.
    const opp = known[buy ? "H" : "L"].filter((s) => s.i < extJ && s.knownAt <= E[j].closedAt);
    const shift = opp.at(-1);
    if (!shift || !(sg * (shift.price - L.price) > 0)) { setups.push({ t: new Date(t).toISOString(), symbol, style: STYLE, side: buy ? "BUY" : "SELL", level: L.kind, outcome: "NO_SHIFT_LEVEL" }); continue; }
    let tj = -1;
    for (let k = rj; k < Math.min(E.length - 1, extJ + CFG.shiftBars); k++) {
      if (k > rj && (buy ? E[k].l < ext : E[k].h > ext)) break;                  // swept again: this setup is over
      if (buy ? E[k].c > shift.price : E[k].c < shift.price) { tj = k; break; }
    }
    if (tj < 0) { setups.push({ t: new Date(t).toISOString(), symbol, style: STYLE, side: buy ? "BUY" : "SELL", level: L.kind, outcome: "NO_SHIFT" }); continue; }
    const tb = E[tj], tt = tb.closedAt, spread = spreadFloor;
    // Features at the trigger, all knowable at its close.
    const bias = Object.fromEntries(Object.keys(ST).map((k) => [k, biasAt(ST[k], tt)]));
    const pos = Object.fromEntries(CFG.loc.map((k) => [k, +dealingRange(ST[k], tt, tb.c).pos.toFixed(2)]));
    const body = Math.abs(tb.c - tb.o), range = tb.h - tb.l;
    const displacement = body >= 0.7 * aE && range > 0 && (buy ? (tb.c - tb.l) / range >= 0.75 : (tb.h - tb.c) / range >= 0.75) && sg * (tb.c - tb.o) > 0;
    let fvg = false; for (let k = extJ + 2; k <= tj; k++) { const g = fvgAt(E, k); if (g && g.dir === (buy ? "UP" : "DOWN")) fvg = true; }
    // Inducement: an internal swing on the swept side that formed after the shift swing and above (below) the level,
    // and was taken out on the way into the sweep.
    const ind = known[buy ? "L" : "H"].some((s) => s.i > shift.i && s.i < j && sg * (s.price - L.price) > 0 && s.knownAt <= E[j].closedAt);
    const candleSweep = candles(E, extJ), candleTrig = candles(E, tj);
    const entry = buy ? tb.c + spread : tb.c, stop = buy ? ext - 0.1 * aE : ext + 0.1 * aE + spread, R = Math.abs(entry - stop);
    // Target: nearest opposite liquidity at least minRR away (levels as of the trigger).
    const lv = liquidityLevels(h1, liqSwings, tt, { tol: 0.1 * atrAt(h1, lastClosed(h1, tt)), swingBars: CFG.liqTF[0] });
    const tgts = lv.filter((x) => x.side === (buy ? "H" : "L") && sg * (x.price - entry) >= CFG.minRR * R).sort((a, c) => sg * (a.price - c.price));
    const liqT = tgts[0];
    const sim = (tp, lim = null) => {
      // Optional limit entry at `lim` (filled within 6 bars, before the target is reached), else market at the shift close.
      let e = entry, j0 = tj;
      if (lim !== null) { let f = -1; for (let k = tj + 1; k < Math.min(E.length, tj + 7); k++) { if (buy ? E[k].h >= tp : E[k].l <= tp) break; if (buy ? E[k].l <= lim : E[k].h + spread >= lim) { f = k; break; } } if (f < 0) return null; e = lim; j0 = f; }
      const r = Math.abs(e - stop);
      for (let k = j0 + (lim === null ? 1 : 0); k < E.length; k++) {
        const x = E[k], lo = buy ? x.l : x.l + spread, hiP = buy ? x.h : x.h + spread;
        if (k > j0 || lim === null) { if (buy ? lo <= stop : hiP >= stop) return { r: (buy ? Math.min(stop, x.o) - e : e - Math.max(stop, x.o + spread)) / r, bars: k - tj }; }
        else if (buy ? lo <= stop : hiP >= stop) return { r: -1, bars: k - tj };
        if (buy ? hiP >= tp : lo <= tp) return { r: (buy ? tp - e : e - tp) / r, bars: k - tj };
      }
      const last = E.at(-1); return { r: (buy ? last.c - e : e - (last.c + spread)) / r, bars: E.length - 1 - tj, open: true };
    };
    const tp2 = entry + sg * 2 * R, mid = (ext + tb.c) / 2;
    const out = { t: new Date(tt).toISOString(), symbol, style: STYLE, side: buy ? "BUY" : "SELL", level: L.kind, outcome: "TRIGGER", hour: new Date(tt).getUTCHours(),
      bias, pos, displacement, fvg, inducement: ind, candleSweep, candleTrig, stopAtr: +(R / aE).toFixed(2), spreadShare: +(spread / R).toFixed(3),
      liqRR: liqT ? +(Math.abs(liqT.price - entry) / R).toFixed(2) : null, liqKind: liqT?.kind ?? null,
      r_2R: sim(tp2), r_liq: liqT ? sim(liqT.price) : null, r_2R_lim50: sim(entry + sg * 2 * Math.abs(mid - stop), mid) };
    setups.push(out);
  }
}
writeFileSync(outFile, JSON.stringify({ symbol, style: STYLE, entryMinutes: entryMin, setups }));
const trig = setups.filter((x) => x.outcome === "TRIGGER");
const avg = (xs) => xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3) : "n/a";
console.log(`${STYLE} ${symbol}: ${setups.length} sweeps, ${trig.length} with shift; 2R avg ${avg(trig.map((x) => x.r_2R.r))}R`);
