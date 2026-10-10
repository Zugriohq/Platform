// Exactness and causality tests for ta.mjs. Hand-built bars with known answers, plus a no-look-ahead property test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, swings, structure, biasAt, dealingRange, fvgAt, candles, liquidityLevels, lastClosed, atrAt } from "./ta.mjs";

const H = 3600000;
const mk = (rows, start = Date.UTC(2026, 0, 5), step = H) => rows.map(([o, h, l, c], i) => ({ t: start + i * step, o, h, l, c, closedAt: start + (i + 1) * step }));

test("swings: strict left, non-strict right, confirmed k bars later", () => {
  const b = mk([[1, 2, 0, 1], [1, 3, 0, 1], [1, 5, 0, 1], [1, 4, 0, 1], [1, 5, 0, 1], [1, 2, 0, 1], [1, 1, 0, 1]]);
  const s = swings(b, 2).filter((x) => x.type === "H");
  // bar 2 (5) is above bars 0,1 and >= bars 3,4 (4,5): a swing high. Bar 4 (5) is not strictly above bar 2 (5).
  assert.deepEqual(s.map((x) => [x.i, x.price]), [[2, 5]]);
  assert.equal(s[0].knownAt, b[4].closedAt);   // known once bar i+k has closed
});

test("structure: BOS continues, CHoCH opposes, MSS needs same-direction displacement, levels are consumed", () => {
  // Up-leg with swing high 10 at bar 2, pullback, break above 10 (initial/UP), then a swing low 7, then a strong down close below 7.
  const rows = [[5, 6, 4, 5.5], [5.5, 8, 5, 7.5], [7.5, 10, 7, 9], [9, 9.5, 8, 8.5], [8.5, 9, 7.5, 8], [8, 11, 8, 10.8],
    [10.8, 11.5, 10, 11], [11, 11.2, 9, 9.5], [9.5, 9.8, 7, 7.2], [7.2, 9, 7.1, 8.8], [8.8, 9.5, 8.5, 9.2], [9.2, 9.4, 6, 6.1]];
  const b = mk(rows);
  const st = structure(b, 2, { dispAtr: 0.7, atrN: 3 });   // ATR(3) at bar 11 = (1.9 + 1.0 + 3.4) / 3 = 2.1
  const kinds = st.breaks.map((x) => `${x.kind}:${x.dir}`);
  assert.equal(kinds[0], "INITIAL:UP");                    // first break with no prior bias
  const down = st.breaks.find((x) => x.dir === "DOWN");
  assert.equal(down.kind, "CHoCH");                         // against the bullish bias
  assert.equal(down.level, 7);                              // the swing low at bar 8
  assert.equal(down.mss, true);                             // body 3.1 >= 0.7 x 2.1, close in the outer 97% of the bar
  assert.equal(biasAt(st, b[11].closedAt), "BEAR");
  assert.equal(biasAt(st, b[4].closedAt), "NEUTRAL");
  // Consumed: the same swing never breaks twice.
  assert.equal(new Set(st.breaks.map((x) => x.swing.i + x.swing.type)).size, st.breaks.length);
});

test("no look-ahead: facts known at t are identical when later bars are appended", () => {
  let p = 100, s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rows = []; for (let i = 0; i < 600; i++) { const o = p; p += (rnd() - 0.5) * 2; rows.push([o, Math.max(o, p) + rnd(), Math.min(o, p) - rnd(), p]); }
  const full = mk(rows), part = full.slice(0, 400), t = part.at(-1).closedAt;
  const a = structure(full, 2), b = structure(part, 2);
  const known = (st) => JSON.stringify(st.breaks.filter((x) => x.t <= t).map((x) => [x.t, x.dir, x.kind, x.mss, x.level]));
  assert.equal(known(a), known(b));
  assert.equal(biasAt(a, t), biasAt(b, t));
  assert.deepEqual(dealingRange(a, t, part.at(-1).c), dealingRange(b, t, part.at(-1).c));
  assert.deepEqual(swings(full, 3).filter((x) => x.knownAt <= t), swings(part, 3).filter((x) => x.knownAt <= t));
});

test("dealing range position", () => {
  const st = { swings: [{ type: "H", price: 110, knownAt: 1 }, { type: "L", price: 100, knownAt: 2 }] };
  assert.equal(dealingRange(st, 5, 102.5).pos, 0.25);
  assert.ok(Number.isNaN(dealingRange(st, 1, 105).pos));    // the low is not known yet
});

test("FVG: three-bar imbalance", () => {
  const b = mk([[1, 2, 0.5, 1.8], [1.8, 4, 1.7, 3.9], [3.9, 5, 2.5, 4.8]]);
  assert.deepEqual(fvgAt(b, 2), { dir: "UP", top: 2.5, bottom: 2 });
  assert.equal(fvgAt(mk([[1, 2, 0.5, 1.8], [1.8, 4, 1.7, 3.9], [3.9, 5, 1.9, 4.8]]), 2), null);
});

test("candles: exact morphology definitions", () => {
  assert.ok(candles(mk([[5, 6, 4, 5], [5, 5.05, 3, 5]]), 1).includes("HAMMER"));
  assert.ok(candles(mk([[5, 6, 4, 5], [5, 7, 4.97, 5]]), 1).includes("SHOOTING_STAR"));
  assert.ok(candles(mk([[5, 5.5, 3.9, 4], [3.9, 5.6, 3.8, 5.5]]), 1).includes("BULLISH_ENGULFING"));
  assert.ok(candles(mk([[4, 5.2, 3.9, 5], [5.1, 5.2, 3.8, 3.85]]), 1).includes("BEARISH_ENGULFING"));
  assert.ok(candles(mk([[5, 6, 4, 5.5], [5.5, 6.5, 4.5, 5.52]]), 1).includes("DOJI"));
  assert.ok(candles(mk([[6, 6.1, 4, 4.1], [4.1, 4.3, 3.9, 4.0], [4.0, 5.6, 3.95, 5.5]]), 2).includes("MORNING_STAR"));
  assert.deepEqual(candles(mk([[5, 6, 4, 5.5], [5.5, 5.8, 5.2, 5.6]]), 1), ["INSIDE_BAR"]);
});

test("aggregate: H4, D1, W1 on UTC boundaries, closedAt at the period end", () => {
  const mon = Date.UTC(2026, 9, 5); // a Monday
  const h1 = mk(Array.from({ length: 24 * 8 }, (_, i) => [i, i + 1, i - 1, i + 0.5]), mon);
  const d1 = aggregate(h1, "D1"), w1 = aggregate(h1, "W1"), h4 = aggregate(h1, "H4");
  assert.equal(d1.length, 8); assert.equal(d1[0].h, 24); assert.equal(d1[0].closedAt, mon + 86400000);
  assert.equal(w1.length, 2); assert.equal(w1[0].t, mon); assert.equal(w1[0].closedAt, mon + 7 * 86400000);
  assert.equal(h4[1].o, 4); assert.equal(h4[1].c, 7.5);
  assert.equal(lastClosed(d1, mon + 86400000 + 1), 0);
  assert.equal(atrAt(h1, 3, 3), 2);   // each bar's true range is 2
});

test("liquidity levels: PDH/PDL, Asia range only after 07:00, unswept swings", () => {
  const mon = Date.UTC(2026, 9, 5);
  const rows = [];
  for (let i = 0; i < 48; i++) rows.push(i < 24 ? [10, 12, 8, 10] : i < 31 ? [10, 11, 9.5, 10] : [10, 10.5, 9.8, 10]);
  rows[5] = [10, 13, 8, 10];   // Monday high 13
  const h1 = mk(rows, mon);
  const tue10 = mon + 86400000 + 10 * H;
  const lv = liquidityLevels(h1, [], tue10, { tol: 0.01 });
  const get = (k) => lv.find((x) => x.kind === k)?.price;
  assert.equal(get("PDH"), 13); assert.equal(get("PDL"), 8);
  assert.equal(get("ASIA_H"), 11); assert.equal(get("ASIA_L"), 9.5);
  assert.equal(liquidityLevels(h1, [], mon + 86400000 + 5 * H, { tol: 0.01 }).find((x) => x.kind === "ASIA_H"), undefined);
});
