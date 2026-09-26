import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { bundleIdentityKey } from "@zugrio/domain";
import {
  alphaScenarios,
  buildDecisionCase,
  currentEntryScenario,
  evaluateAt,
  noSetupScenario,
  regimeUnavailableScenario,
  staleEntryScenario,
  type ReplayScenario,
} from "../src/index.js";

describe("Slice 1 deterministic Decision Case", () => {
  it("uses frozen structural states while PASS remains a separate outcome", () => {
    expect(buildDecisionCase(staleEntryScenario, 0).structuralState).toBe("STRUCTURAL_CANDIDATE");
    expect(buildDecisionCase(staleEntryScenario, 1).structuralState).toBe("STRUCTURAL_WATCH");
    const ready = buildDecisionCase(staleEntryScenario, 4);
    expect(ready.structuralState).toBe("STRUCTURAL_READY");
    expect(ready.outcome).toBe("WAIT");
    expect(ready.modelScored).toBe(false);
    expect(ready.authority).toBe("NO_LIVE_CAPITAL");
  });

  it("preserves retest touched and held as point-in-time lifecycle evidence", () => {
    expect(buildDecisionCase(staleEntryScenario, 2).current.lifecycle).toBe("RETEST_TOUCHED");
    const held = buildDecisionCase(staleEntryScenario, 3);
    expect(held.current.lifecycle).toBe("RETEST_HELD");
    expect(held.history.some(event =>
      event.changes.some(change => change.field === "lifecycle" && change.to === "RETEST_HELD")
    )).toBe(true);
  });

  it("records a current fixture entry without inventing FIRE or model-scored READY", () => {
    const observed = buildDecisionCase(staleEntryScenario, 5);
    expect(observed.structuralState).toBe("STRUCTURAL_READY");
    expect(observed.outcome).toBe("CURRENT_FIXTURE_ENTRY");
    expect(observed.current.entryEventObserved).toBe(true);
    expect(observed.modelScored).toBe(false);
    expect(observed.outcomeReason).toContain("grants no trading permission");
  });

  it("returns PASS for a stale current entry while preserving structural readiness", () => {
    const stale = buildDecisionCase(staleEntryScenario, 6);
    expect(stale.structuralState).toBe("STRUCTURAL_READY");
    expect(stale.outcome).toBe("PASS");
    expect(stale.current.currentEntryStatus).toBe("STALE");
    expect(stale.outcomeReason).toContain("Structural state is preserved");
  });

  it("returns PASS when no qualifying structural setup exists", () => {
    const result = buildDecisionCase(noSetupScenario, 0);
    expect(result.structuralState).toBeNull();
    expect(result.outcome).toBe("PASS");
    expect(result.current.eligibility).toBe("INELIGIBLE");
  });

  it("fails closed to PASS when regime is unavailable point-in-time", () => {
    const result = buildDecisionCase(regimeUnavailableScenario, 0);
    expect(result.structuralState).toBeNull();
    expect(result.outcome).toBe("PASS");
    expect(result.current.regimeStatus).toBe("UNAVAILABLE");
  });

  it("does not leak future evidence backward", () => {
    const beforeEntry = evaluateAt(staleEntryScenario, "2026-09-24T08:15:00Z");
    expect(beforeEntry.current.entryEventObserved).toBe(false);
    expect(beforeEntry.current.currentEntryStatus).toBe("NOT_AVAILABLE");
    expect(beforeEntry.outcome).toBe("WAIT");
    expect(beforeEntry.annotations.every(annotation => Date.parse(annotation.knownAt) <= Date.parse("2026-09-24T08:15:00Z"))).toBe(true);
  });

  it("annotations bind to the actual evidence timestamp, not the later evaluation time", () => {
    const later = evaluateAt(staleEntryScenario, "2026-09-24T08:20:00Z");
    const lifecycleAnnotation = later.annotations.find(annotation => annotation.kind === "STRUCTURAL_LIFECYCLE");
    const entryAnnotation = later.annotations.find(annotation => annotation.kind === "ENTRY_STATUS");

    expect(lifecycleAnnotation?.evidenceId).toBe("lifecycle-0815");
    expect(lifecycleAnnotation?.knownAt).toBe("2026-09-24T08:15:00Z");
    expect(entryAnnotation?.evidenceId).toBe("entry-status-0820");
    expect(entryAnnotation?.knownAt).toBe("2026-09-24T08:20:00Z");
    expect(Date.parse(lifecycleAnnotation?.knownAt ?? "")).toBeLessThanOrEqual(Date.parse(later.current.evaluatedAt));
    expect(Date.parse(entryAnnotation?.knownAt ?? "")).toBeLessThanOrEqual(Date.parse(later.current.evaluatedAt));
  });

  it("replays the same fixture deterministically", () => {
    expect(buildDecisionCase(currentEntryScenario, 5)).toEqual(buildDecisionCase(currentEntryScenario, 5));
  });

  it("changes evaluation identity when a material bundle version changes", () => {
    const baseline = evaluateAt(currentEntryScenario, "2026-09-24T09:17:00Z");
    const changed: ReplayScenario = {
      ...currentEntryScenario,
      bundle: {
        ...currentEntryScenario.bundle,
        identity: {
          ...currentEntryScenario.bundle.identity,
          tradeBundle: {
            ...currentEntryScenario.bundle.identity.tradeBundle,
            version: "0.1.0-alpha.999",
          },
        },
      },
    };
    const revised = evaluateAt(changed, "2026-09-24T09:17:00Z");
    expect(bundleIdentityKey(changed.bundle.identity)).not.toBe(bundleIdentityKey(currentEntryScenario.bundle.identity));
    expect(revised.evaluationId).not.toBe(baseline.evaluationId);
  });

  it("property: identical fixture/frame input always yields identical output", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: staleEntryScenario.frames.length - 1 }),
      (frameIndex) => {
        expect(buildDecisionCase(staleEntryScenario, frameIndex)).toEqual(
          buildDecisionCase(staleEntryScenario, frameIndex),
        );
      },
    ));
  });

  it("fails closed for invalid replay indexes", () => {
    expect(() => buildDecisionCase(staleEntryScenario, 99)).toThrow(RangeError);
  });

  it("all alpha scopes are machine-readable as non-admitted/non-capital", () => {
    for (const scenario of alphaScenarios) {
      expect(scenario.bundle.identity.scope.admission).toBe("NON_ADMITTED_FIXTURE");
      expect(scenario.bundle.identity.scope.liveData).toBe(false);
      expect(scenario.bundle.identity.scope.liveCapital).toBe(false);
    }
  });
});
