// Runs the committed bundle exactly as the EA will, then checks it against decision-core.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createEntryValidationInput } from "@zugrio/decision-core";

const code = readFileSync(new URL("../dist/zugrio-engine.js", import.meta.url), "utf8");
function load() { const ctx = { JSON, Date, Math }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx.ZugrioEngineBridge; }

function requestFromFixture(route, family, horizon, frame) {
  const f = createEntryValidationInput(route, family, horizon, frame);
  return {
    schema: "zugrio.ea-scan-request/v1", configVersion: "test-config", evaluatedAt: f.markets[0].evaluatedAt,
    instrument: { symbol: f.instrument.instrument, source: f.instrument.source, tickSize: f.instrument.tickSize },
    family: { family: f.family.family, priceOrigin: f.family.priceOrigin },
    horizon: { horizon: f.horizon.horizon, setupExpiryMs: f.horizon.setupExpiryMs, entryExpiryMs: f.horizon.entryExpiryMs },
    timeframes: { context: f.timeframes.context, location: f.timeframes.location, entry: f.timeframes.entry, management: f.timeframes.management, maxAgeMs: f.timeframes.maxAgeMs },
    model: { route: f.model.route, breakTicks: f.model.breakTicks, touchTicks: f.model.touchTicks, stopTicks: f.model.stopTicks, maxChaseTicks: f.model.maxChaseTicks, minimumRunwayTicks: f.model.minimumRunwayTicks },
    pivots: f.markets[0].pivots, enumeration: { recentFactsPerRole: 3 },
    markets: f.markets.map((m) => ({ timeframe: m.timeframe, bars: m.bars.map((b) => ({ closedAt: b.sourceClosedAt, o: b.open, h: b.high, l: b.low, c: b.close })) })),
  };
}

test("self-test reproduces decision-core's fixture answer", () => {
  const r = JSON.parse(load().selfTest());
  assert.equal(r.ok, true, r.detail);
});

test("scan finds the fixture's READY setup without being told the binding", () => {
  for (const route of ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"]) {
    const r = JSON.parse(load().scan(JSON.stringify(requestFromFixture(route, "GOLD", "INTRADAY", 7))));
    assert.ok(r.best, route + ": no READY candidate; errors " + r.errors.join("; "));
    assert.equal(r.best.side, "BUY");
    assert.deepEqual([r.best.geometry.entryReference, r.best.geometry.childInvalidation, r.best.geometry.objective], [111, 105, 130]);
  }
});

test("an earlier frame with no confirmation yields no READY candidate", () => {
  const r = JSON.parse(load().scan(JSON.stringify(requestFromFixture("CONTINUATION_RETEST", "FX", "INTRADAY", 5))));
  assert.equal(r.best, null);
  assert.ok(r.candidates.length > 0);
});

test("unknown schema fails closed", () => {
  assert.throws(() => load().scan(JSON.stringify({ schema: "other" })));
});

// --- readyOnly prefilter: must never change which setups are READY -------------------------

function walkRequest(seed, route, { bars = 160, chaseAtr = 0.5, runwayAtr = 1, k = 3 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const end = Date.parse("2026-10-08T12:50:00.000Z");
  // One M5 price path, aggregated to M15 and H1, so the timeframes describe the same market.
  const m5 = []; let p = 100;
  for (let i = bars * 12 - 1; i >= 0; i--) {
    const o = p, c = +(o + (rnd() - 0.5) * 0.4).toFixed(2);
    m5.push({ t: end - i * 300000, o, h: +(Math.max(o, c) + rnd() * 0.15).toFixed(2), l: +(Math.min(o, c) - rnd() * 0.15).toFixed(2), c }); p = c;
  }
  const agg = (n) => {
    const out = [];
    for (let i = m5.length % n; i + n <= m5.length; i += n) {
      const g = m5.slice(i, i + n);
      out.push({ closedAt: new Date(g.at(-1).t).toISOString(), o: g[0].o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g.at(-1).c });
    }
    return out.slice(-bars);
  };
  const atrTicks = 0.5 / 0.01;
  return { schema: "zugrio.ea-scan-request/v1", configVersion: "eq", evaluatedAt: new Date(end).toISOString(),
    instrument: { symbol: "WALK", source: "test", tickSize: 0.01 }, family: { family: "SYNTHETIC", priceOrigin: "SYNTHETIC_GENERATOR" },
    horizon: { horizon: "INTRADAY", setupExpiryMs: 86400000, entryExpiryMs: 3600000 },
    timeframes: { context: "H1", location: "M15", entry: "M5", management: "H1", maxAgeMs: { context: 7200000, location: 1800000, entry: 600000, management: 7200000 } },
    model: { route, breakTicks: 0.1 * atrTicks, touchTicks: 0.25 * atrTicks, stopTicks: 0.3 * atrTicks, maxChaseTicks: chaseAtr * atrTicks, minimumRunwayTicks: runwayAtr * atrTicks },
    pivots: [{ definitionId: "p1", scale: "INTERMEDIATE", leftBars: 2, rightBars: 2 }], enumeration: { recentFactsPerRole: k },
    markets: [{ timeframe: "H1", bars: agg(12) }, { timeframe: "M15", bars: agg(3) }, { timeframe: "M5", bars: agg(1) }] };
}

const readyIds = (res) => res.candidates.filter((c) => c.state === "STRUCTURAL_READY").map((c) => c.opportunityId).sort();
function compare(req) {
  const bridge = load();
  const full = JSON.parse(bridge.scan(JSON.stringify(req)));
  const fast = JSON.parse(bridge.scan(JSON.stringify({ ...req, enumeration: { ...req.enumeration, readyOnly: true } })));
  assert.deepEqual(readyIds(fast), readyIds(full));
  assert.deepEqual(fast.best, full.best);
  assert.equal(fast.candidates.length + fast.skippedNotReadyable, full.candidates.length);
  return readyIds(full).length;
}

test("readyOnly gives the same READY setups on every decision-core fixture frame", () => {
  let ready = 0;
  for (const route of ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"])
    for (const family of ["GOLD", "FX", "SYNTHETIC"])
      for (const horizon of ["INTRADAY", "SWING"])
        for (let frame = 3; frame <= 7; frame++) ready += compare(requestFromFixture(route, family, horizon, frame));
  assert.ok(ready > 0, "fixtures should contain READY frames");
});

test("readyOnly gives the same READY setups on random-walk markets", () => {
  let ready = 0, cases = 0;
  for (let seed = 1; seed <= 20; seed++)
    for (const route of ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"])
      for (const opts of [{}, { chaseAtr: 3, runwayAtr: 0.2, k: 6 }]) { ready += compare(walkRequest(seed, route, opts)); cases++; }
  console.log(`random-walk equivalence: ${cases} cases, ${ready} READY setups compared`);
  assert.ok(cases === 80);
  assert.ok(ready > 0, "random walks with a wide chase should produce some READY setups to compare");
});

test("scanRoutes gives each route exactly what scan() gives for it", () => {
  const bridge = load();
  let ready = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const base = walkRequest(seed, "CONTINUATION_RETEST", { chaseAtr: 3, runwayAtr: 0.2, k: 6 });
    for (const readyOnly of [false, true]) {
      const req = { ...base, enumeration: { ...base.enumeration, readyOnly } };
      const multi = JSON.parse(bridge.scanRoutes(JSON.stringify({ ...req, routes: ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"] })));
      for (const res of multi.results) {
        const single = JSON.parse(bridge.scan(JSON.stringify({ ...req, model: { ...req.model, route: res.route } })));
        assert.deepEqual(res, single);
        ready += readyIds(single).length;
      }
    }
  }
  assert.ok(ready > 0);
});

test("nearestLevel reports the closest binding level to the latest close", () => {
  const r = JSON.parse(load().scan(JSON.stringify(walkRequest(3, "CONTINUATION_RETEST"))));
  assert.ok(r.nearestLevel && r.nearestLevel.distance >= 0);
  assert.equal(r.nearestLevel.distance, Math.abs(r.lastClose - r.nearestLevel.level));
});

// --- trend and open-sky signals -------------------------------------------------------------

function driftRequest(seed, drift, route = "CONTINUATION_RETEST", context = "H1", earlierDrift = drift) {
  const req = walkRequest(seed, route, {});
  // Re-generate with a steady drift so price keeps making new highs (or lows).
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const end = Date.parse("2026-10-08T12:50:00.000Z"), bars = 160, m5 = []; let p = 100;
  for (let i = bars * 48 - 1; i >= 0; i--) { const d = i < 1900 ? drift : earlierDrift; const o = p, c = +(o + (rnd() - 0.5) * 0.4 + d).toFixed(2); m5.push({ t: end - i * 300000, o, h: +(Math.max(o, c) + rnd() * 0.15).toFixed(2), l: +(Math.min(o, c) - rnd() * 0.15).toFixed(2), c }); p = c; }
  const agg = (n) => { const out = []; for (let i = m5.length % n; i + n <= m5.length; i += n) { const g = m5.slice(i, i + n); out.push({ closedAt: new Date(g.at(-1).t).toISOString(), o: g[0].o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g.at(-1).c }); } return out.slice(-bars); };
  const ctxN = context === "H4" ? 48 : 12;
  return { ...req, timeframes: { ...req.timeframes, context, management: context, maxAgeMs: { ...req.timeframes.maxAgeMs, context: ctxN * 600000, management: ctxN * 600000 } },
    markets: [{ timeframe: context, bars: agg(ctxN) }, { timeframe: "M15", bars: agg(3) }, { timeframe: "M5", bars: agg(1) }] };
}

test("trendOf reads higher highs and higher lows from confirmed pivots", () => {
  const f = (concept, price, time) => ({ concept, geometry: { type: "POINT", price, time } });
  const bridge = load();
  // exercised through the bundle: an UP-drifting market should read UP, a DOWN-drifting one DOWN
  const up = JSON.parse(bridge.scan(JSON.stringify(driftRequest(5, 0.03))));
  const down = JSON.parse(bridge.scan(JSON.stringify(driftRequest(5, -0.03))));
  assert.equal(up.trend, "UP");
  assert.equal(down.trend, "DOWN");
  assert.ok(f); // helper kept for readability
});

test("a rally into old highs: open sky on H1, targets from an H4 rescan", () => {
  // ~20 days falling, then ~6.6 days rising: the H1 window sees only new highs, H4 still sees the old ones above.
  const bridge = load();
  let openSky = 0, h4WithTargets = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const h1 = JSON.parse(bridge.scan(JSON.stringify(driftRequest(seed, 0.012, "CONTINUATION_RETEST", "H1", -0.004))));
    if (!h1.openSky) continue;
    openSky++;
    const h4 = JSON.parse(bridge.scan(JSON.stringify(driftRequest(seed, 0.012, "CONTINUATION_RETEST", "H4", -0.004))));
    if (h4.candidates.length + h4.skippedNotReadyable > 0) h4WithTargets++;
  }
  console.log(`rally into old highs: open sky on H1 in ${openSky}/12; H4 rescan had targets in ${h4WithTargets}`);
  assert.ok(openSky > 0 && h4WithTargets > 0);
});

test("scalping is a horizon profile, not new logic: an M15/M5/M1 SCALP map finds the same setup under its own ids", () => {
  const day = requestFromFixture("CONTINUATION_RETEST", "GOLD", "INTRADAY", 7);
  const rename = { H1: "M15", M5: "M5", M1: "M1" };
  const scalp = {
    ...day,
    horizon: { ...day.horizon, horizon: "SCALP" },
    timeframes: { ...day.timeframes, context: "M15", management: "M15" },
    markets: day.markets.map((m) => ({ ...m, timeframe: rename[m.timeframe] })),
  };
  const e = load();
  const d = JSON.parse(e.scan(JSON.stringify(day))), s = JSON.parse(e.scan(JSON.stringify(scalp)));
  assert.ok(s.best, "SCALP: no READY candidate; errors " + s.errors.join("; "));
  assert.deepEqual([s.best.side, s.best.geometry.entryReference, s.best.geometry.childInvalidation, s.best.geometry.objective],
    [d.best.side, d.best.geometry.entryReference, d.best.geometry.childInvalidation, d.best.geometry.objective]);
  assert.notEqual(s.best.opportunityId, d.best.opportunityId);   // distinct profile => distinct setup ids, so DAY and SCALP never dedupe each other
});
