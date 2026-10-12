import { createRequire } from "module"; const C = createRequire(import.meta.url)("./study.js");
let fails = 0; const eq = (a, b, m) => { if (Math.abs(a - b) > 1e-9) { fails++; console.log("FAIL", m, a, b); } else console.log("ok  ", m); };
const T0 = 1_700_000_000; // seconds
const sig = { dir: "BUY", price: 100, stop: 99, target: 101.2, firedAt: T0 * 1000 }; // risk 1, app target 1.2R
const path = (xs) => xs.map((p, i) => ({ t: T0 + 1 + i, p }));
// Round trip: up to +0.95R then down through the stop with a gap to -1.3R.
const walk = (a, b, step) => { const o = []; for (let p = a; step > 0 ? p <= b + 1e-9 : p >= b - 1e-9; p += step) o.push(+p.toFixed(4)); return o; };
// Round trip in 0.05R steps: up to +0.95R, back down, then a gap from -0.95R to -1.3R.
let r = C.evaluate(sig, path([...walk(100.05, 100.95, 0.05), ...walk(100.9, 99.05, -0.05), 98.7]));
eq(r.tA, 1.2, "app target in R"); eq(r.mfe, 0.95, "best excursion"); eq(r.plans.A.r, -1.3, "A: stop gapped to -1.3R");
eq(r.plans.B.r, 0.8, "B: fixed 0.8R banks"); eq(r.plans.C.r, -1.3, "C: 1.02R target not reached");
eq(r.plans.D.r, 0.05, "D: break-even lock after 0.7R"); eq(r.plans.E.r, 0.5 * 0.8 + 0.5 * 0.05, "E: half at 0.8R + half at lock");
eq(r.plans.F.r, 0.45, "F: trail 0.5R behind 0.95R best");
// Clean winner through the target.
r = C.evaluate(sig, path([100.4, 100.9, 101.3]));
eq(r.plans.A.r, 1.2, "A winner at target"); eq(r.plans.B.r, 0.8, "B capped"); eq(r.plans.C.r, 1.02, "C front-run target");
eq(r.plans.E.r, 0.4 + 0.6, "E half 0.8 + half 1.2"); if (!r.touchedTargetBeforeStop) { fails++; console.log("FAIL touched"); }
// Sell mirror and timeout mark-to-market.
r = C.evaluate({ dir: "SELL", price: 100, stop: 102, target: 97, firedAt: T0 * 1000 }, path([99.5, 99.0, 99.8]));
eq(r.tA, 1.5, "sell target R"); eq(r.plans.A.r, 0.1, "timeout marks to market"); eq(r.mfe, 0.5, "sell excursion");
// Ticks before the signal or after 2h are ignored.
r = C.evaluate(sig, [{ t: T0 - 5, p: 90 }, { t: T0 + 3, p: 100.2 }, { t: T0 + 7300, p: 90 }, { t: T0 + 8000, p: 90 }].concat([]));
if (!r.skip) { fails++; console.log("FAIL expected skip with one tick"); } else console.log("ok   too few ticks skipped");
r = C.evaluate(sig, [{ t: T0 - 5, p: 90 }, { t: T0 + 3, p: 100.2 }, { t: T0 + 4, p: 100.1 }, { t: T0 + 7300, p: 90 }]);
eq(r.plans.A.r, 0.1, "out-of-window ticks ignored");
// Bad levels.
console.log(C.evaluate({ ...sig, stop: 101 }, path([100, 101])).skip ? "ok   wrong-side stop skipped" : (fails++, "FAIL"));
console.log(C.evaluate({ ...sig, target: 100 }, path([100, 101])).skip ? "ok   passed target skipped" : (fails++, "FAIL"));
// Summary arithmetic: paired diff.
const rows = [{ firedAt: 1, res: C.evaluate(sig, path([100.95, 98.7])) }, { firedAt: 2, res: C.evaluate(sig, path([100.6, 101.3])) }];
const S = C.summarise(rows, 2);
eq(S.all.plans.A.avg, (-1.3 + 1.2) / 2, "summary avg A"); eq(S.all.plans.B.vsA.avg, ((0.8 + 1.3) + (0.8 - 1.2)) / 2, "paired B-A");
eq(S.all.losersAfter08, 1, "loser that reached 0.8R"); eq(S.design.n, 1, "design split"); eq(S.test.n, 1, "test split");
console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
