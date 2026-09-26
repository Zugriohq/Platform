import { describe, expect, it } from "vitest";
import {
  extractRetestGeometryFacts,
  observeStructuralLifecycle,
  type ResearchBreakSeed,
  type ResearchRetestGeometry,
} from "../src/index.js";

const seed: ResearchBreakSeed = {
  candidateId: "candidate-geometry",
  setupIdentity: "EURUSD:M5:BOS_RETEST:1",
  setupType: "BOS_RETEST",
  side: "BUY",
  breakEvidenceId: "break-evidence",
  breakSourceBarId: "m5:0800",
  breakSourceClosedAt: "2026-09-24T08:05:00Z",
  breakKnownAt: "2026-09-24T08:05:01Z",
  continuationReferenceEnabled: false,
};

const buyGeometry: ResearchRetestGeometry = {
  geometryId: "geometry-buy-1",
  side: "BUY",
  breakLevel: 1.1000,
  retestZone: { low: 1.0995, high: 1.1005 },
  invalidationLevel: 1.0970,
  invalidationMode: "CLOSE_BEYOND",
  provenanceId: "trade-bundle:fixture:v1",
};

describe("research retest geometry extraction", () => {
  it("extracts a BUY retest touch/hold from deterministic OHLC geometry", () => {
    const facts = extractRetestGeometryFacts(buyGeometry, {
      sourceBarId: "m5:0805",
      open: 1.1008,
      high: 1.1010,
      low: 1.0998,
      close: 1.1004,
      sourceClosedAt: "2026-09-24T08:10:00Z",
      knownAt: "2026-09-24T08:10:01Z",
      dataStatus: "FRESH_COMPLETE",
    });

    expect(facts.touchedZone).toBe(true);
    expect(facts.closedOnValidSideOfBreak).toBe(true);
    expect(facts.invalidated).toBe(false);
    expect(facts.observation.retestTouched).toBe(true);
    expect(facts.observation.retestHeld).toBe(true);
  });

  it("mirrors the geometry correctly for SELL", () => {
    const facts = extractRetestGeometryFacts({
      ...buyGeometry,
      geometryId: "geometry-sell-1",
      side: "SELL",
      breakLevel: 1.1000,
      invalidationLevel: 1.1030,
    }, {
      sourceBarId: "m5:0805",
      open: 1.0992,
      high: 1.1002,
      low: 1.0987,
      close: 1.0996,
      sourceClosedAt: "2026-09-24T08:10:00Z",
      knownAt: "2026-09-24T08:10:01Z",
      dataStatus: "FRESH_COMPLETE",
    });

    expect(facts.touchedZone).toBe(true);
    expect(facts.closedOnValidSideOfBreak).toBe(true);
    expect(facts.invalidated).toBe(false);
    expect(facts.observation.retestHeld).toBe(true);
  });

  it("keeps invalidation semantics explicit instead of hiding a rule in the detector", () => {
    const closeMode = extractRetestGeometryFacts(buyGeometry, {
      sourceBarId: "wick-through",
      open: 1.0990,
      high: 1.1002,
      low: 1.0965,
      close: 1.0998,
      sourceClosedAt: "2026-09-24T08:10:00Z",
      knownAt: "2026-09-24T08:10:01Z",
      dataStatus: "FRESH_COMPLETE",
    });
    expect(closeMode.invalidated).toBe(false);

    const touchMode = extractRetestGeometryFacts({
      ...buyGeometry,
      invalidationMode: "TOUCH_BEYOND",
    }, {
      sourceBarId: "wick-through",
      open: 1.0990,
      high: 1.1002,
      low: 1.0965,
      close: 1.0998,
      sourceClosedAt: "2026-09-24T08:10:00Z",
      knownAt: "2026-09-24T08:10:01Z",
      dataStatus: "FRESH_COMPLETE",
    });
    expect(touchMode.invalidated).toBe(true);
  });

  it("still cannot turn the original break bar into a retest after OHLC extraction", () => {
    const facts = extractRetestGeometryFacts(buyGeometry, {
      sourceBarId: "m5:0800",
      open: 1.1000,
      high: 1.1010,
      low: 1.0996,
      close: 1.1006,
      sourceClosedAt: "2026-09-24T08:05:00Z",
      knownAt: "2026-09-24T08:05:10Z",
      dataStatus: "FRESH_COMPLETE",
    });

    const result = observeStructuralLifecycle(seed, [facts.observation]);
    expect(result.lifecycle).toBe("BREAK_CONFIRMED");
    expect(result.trace.some(event => event.reasonCode === "BREAK_BAR_CANNOT_CONFIRM")).toBe(true);
  });

  it("rejects internally impossible OHLC rather than fabricating geometry facts", () => {
    expect(() => extractRetestGeometryFacts(buyGeometry, {
      sourceBarId: "bad-bar",
      open: 1.1000,
      high: 1.0990,
      low: 1.1010,
      close: 1.1000,
      sourceClosedAt: "2026-09-24T08:10:00Z",
      knownAt: "2026-09-24T08:10:01Z",
      dataStatus: "FRESH_COMPLETE",
    })).toThrow();
  });
});
