import { describe, expect, it } from "vitest";
import {
  assessRequiredTimeframes,
  diagnoseResearchFunnel,
  observeStructuralLifecycle,
  recheckCurrentEntry,
  type CurrentEntryRecheckInput,
  type ResearchBreakSeed,
} from "../src/index.js";

const seed: ResearchBreakSeed = {
  candidateId: "candidate-funnel",
  setupIdentity: "EURUSD:M5:BOS_RETEST:funnel",
  setupType: "BOS_RETEST",
  side: "BUY",
  breakEvidenceId: "break",
  breakSourceBarId: "m5:0800",
  breakSourceClosedAt: "2026-09-24T08:05:00Z",
  breakKnownAt: "2026-09-24T08:05:01Z",
  continuationReferenceEnabled: false,
};

const availableTimeframes = assessRequiredTimeframes(
  "2026-09-24T08:30:00Z",
  ["M5", "M15"],
  [
    { timeframe:"M5", evidenceId:"m5", sourceClosedAt:"2026-09-24T08:25:00Z", knownAt:"2026-09-24T08:25:01Z", status:"FRESH_COMPLETE" },
    { timeframe:"M15", evidenceId:"m15", sourceClosedAt:"2026-09-24T08:15:00Z", knownAt:"2026-09-24T08:15:01Z", status:"FRESH_COMPLETE" },
  ],
);

function currentInput(): CurrentEntryRecheckInput {
  const predicate = (id: string, ok = true) => ({
    ok,
    evidenceId: id,
    knownAt: "2026-09-24T08:30:00Z",
    provenanceId: `policy:${id}`,
  });
  return {
    evaluatedAt:"2026-09-24T08:30:00Z",
    quote:{status:"FRESH",quoteAt:"2026-09-24T08:29:59Z",evidenceId:"quote",knownAt:"2026-09-24T08:30:00Z"},
    entryFreshness:predicate("fresh"),
    geometryCurrent:predicate("geometry"),
    costsWithinBudget:predicate("costs"),
    targetRunwayAvailable:predicate("runway"),
    continuityOk:predicate("continuity"),
  };
}

describe("research funnel diagnostics", () => {
  it("shows data attrition before structural logic", () => {
    const blocked = assessRequiredTimeframes(
      "2026-09-24T08:30:00Z",
      ["M5","M15"],
      [{ timeframe:"M5", evidenceId:"m5", sourceClosedAt:"2026-09-24T08:25:00Z", knownAt:"2026-09-24T08:25:01Z", status:"FRESH_COMPLETE" }],
    );
    const diagnostic = diagnoseResearchFunnel({ timeframes: blocked, lifecycle: null });
    expect(diagnostic.stage).toBe("DATA_BLOCKED");
    expect(diagnostic.blockers).toContain("M15:REQUIRED_TIMEFRAME_MISSING");
  });

  it("shows exactly where a structural candidate currently stops", () => {
    const lifecycle = observeStructuralLifecycle(seed, [{
      evidenceId:"touch",
      sourceBarId:"m5:0805",
      sourceClosedAt:"2026-09-24T08:10:00Z",
      knownAt:"2026-09-24T08:10:01Z",
      dataStatus:"FRESH_COMPLETE",
      retestTouched:true,
    }]);
    const diagnostic = diagnoseResearchFunnel({ timeframes: availableTimeframes, lifecycle });
    expect(diagnostic.stage).toBe("RETEST_TOUCHED");
    expect(diagnostic.summary).toContain("RETEST_TOUCHED");
  });

  it("distinguishes a confirmed lifecycle from a stale current entry", () => {
    const lifecycle = observeStructuralLifecycle(seed, [
      { evidenceId:"touch", sourceBarId:"m5:0805", sourceClosedAt:"2026-09-24T08:10:00Z", knownAt:"2026-09-24T08:10:01Z", dataStatus:"FRESH_COMPLETE", retestTouched:true, retestHeld:true },
      { evidenceId:"confirm", sourceBarId:"m5:0810", sourceClosedAt:"2026-09-24T08:15:00Z", knownAt:"2026-09-24T08:15:01Z", dataStatus:"FRESH_COMPLETE", confirmRoute:"RETEST" },
    ]);
    const stale = recheckCurrentEntry({
      eventId:"entry",
      confirmedAt:"2026-09-24T08:20:00Z",
      sourceBarClosedAt:"2026-09-24T08:20:00Z",
    }, {
      ...currentInput(),
      targetRunwayAvailable:{
        ok:false,
        evidenceId:"runway-failed",
        knownAt:"2026-09-24T08:30:00Z",
        provenanceId:"policy:runway",
      },
    });

    const diagnostic = diagnoseResearchFunnel({
      timeframes: availableTimeframes,
      lifecycle,
      currentEntry: stale,
    });

    expect(diagnostic.stage).toBe("ENTRY_STALE");
    expect(diagnostic.blockers).toContain("TARGET_RUNWAY_FAILED");
  });

  it("never labels a research-current entry as FIRE or permission", () => {
    const lifecycle = observeStructuralLifecycle(seed, [
      { evidenceId:"touch", sourceBarId:"m5:0805", sourceClosedAt:"2026-09-24T08:10:00Z", knownAt:"2026-09-24T08:10:01Z", dataStatus:"FRESH_COMPLETE", retestTouched:true, retestHeld:true },
      { evidenceId:"confirm", sourceBarId:"m5:0810", sourceClosedAt:"2026-09-24T08:15:00Z", knownAt:"2026-09-24T08:15:01Z", dataStatus:"FRESH_COMPLETE", confirmRoute:"RETEST" },
    ]);
    const current = recheckCurrentEntry({
      eventId:"entry",
      confirmedAt:"2026-09-24T08:20:00Z",
      sourceBarClosedAt:"2026-09-24T08:20:00Z",
    }, currentInput());

    const diagnostic = diagnoseResearchFunnel({
      timeframes: availableTimeframes,
      lifecycle,
      currentEntry: current,
    });

    expect(diagnostic.stage).toBe("ENTRY_CURRENT");
    expect(JSON.stringify(diagnostic)).not.toContain("FIRE");
    expect(diagnostic.liveCapitalAuthority).toBe(false);
  });
});
