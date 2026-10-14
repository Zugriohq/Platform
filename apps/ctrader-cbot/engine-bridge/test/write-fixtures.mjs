// Writes the scan request/expected-result pair the .NET tests use to prove Jint gives Node's answer.
import { writeFileSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { createEntryValidationInput } from "@zugrio/decision-core";
const code = readFileSync(new URL("../dist/zugrio-engine.js", import.meta.url), "utf8");
const ctx = { JSON, Date, Math }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const f = createEntryValidationInput("CONTINUATION_RETEST", "GOLD", "INTRADAY", 7);
const req = {
  schema: "zugrio.ea-scan-request/v1", configVersion: "test-config", evaluatedAt: f.markets[0].evaluatedAt,
  instrument: { symbol: f.instrument.instrument, source: f.instrument.source, tickSize: f.instrument.tickSize },
  family: { family: f.family.family, priceOrigin: f.family.priceOrigin },
  horizon: { horizon: f.horizon.horizon, setupExpiryMs: f.horizon.setupExpiryMs, entryExpiryMs: f.horizon.entryExpiryMs },
  timeframes: { context: f.timeframes.context, location: f.timeframes.location, entry: f.timeframes.entry, management: f.timeframes.management, maxAgeMs: f.timeframes.maxAgeMs },
  model: { route: f.model.route, breakTicks: f.model.breakTicks, touchTicks: f.model.touchTicks, stopTicks: f.model.stopTicks, maxChaseTicks: f.model.maxChaseTicks, minimumRunwayTicks: f.model.minimumRunwayTicks },
  pivots: f.markets[0].pivots, enumeration: { recentFactsPerRole: 3 },
  markets: f.markets.map((m) => ({ timeframe: m.timeframe, bars: m.bars.map((b) => ({ closedAt: b.sourceClosedAt, o: b.open, h: b.high, l: b.low, c: b.close })) })),
};
writeFileSync(new URL("./fixtures/scan-request-gold-continuation.json", import.meta.url), JSON.stringify(req, null, 1) + "\n");
writeFileSync(new URL("./fixtures/scan-result-gold-continuation.json", import.meta.url), ctx.ZugrioEngineBridge.scan(JSON.stringify(req)) + "\n");
console.log("fixtures written");
