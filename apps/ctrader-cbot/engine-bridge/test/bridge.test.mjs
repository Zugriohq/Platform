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
