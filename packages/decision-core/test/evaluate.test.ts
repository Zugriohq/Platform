import { describe, expect, it } from "vitest";
import { alphaScenarios, buildDecisionCase, currentEntryScenario, staleEntryScenario } from "../src/index.js";

describe("buildDecisionCase", () => {
  it("follows the frozen structural lifecycle without creating conviction states", () => {
    expect(buildDecisionCase(staleEntryScenario, 0).state).toBe("STRUCTURAL_CANDIDATE");
    expect(buildDecisionCase(staleEntryScenario, 1).state).toBe("STRUCTURAL_WATCH");
    expect(buildDecisionCase(staleEntryScenario, 3).state).toBe("STRUCTURAL_WATCH");

    const ready = buildDecisionCase(staleEntryScenario, 4);
    expect(ready.state).toBe("STRUCTURAL_READY");
    expect(ready.modelScored).toBe(false);
    expect(ready.authorityClass).toBe("STRUCTURAL_ONLY");
    expect(ready.authority).toBe("NO_LIVE_CAPITAL");
  });

  it("preserves the retest lifecycle as material evidence before structural readiness", () => {
    const touched = buildDecisionCase(staleEntryScenario, 2);
    const held = buildDecisionCase(staleEntryScenario, 3);

    expect(touched.current.lifecycle).toBe("RETEST_TOUCHED");
    expect(held.current.lifecycle).toBe("RETEST_HELD");
    expect(held.history.some(event =>
      event.changes.some(change => change.field === "lifecycle" && change.to === "RETEST_HELD")
    )).toBe(true);
  });

  it("records a fixture entry event without promoting structural state to FIRE or model READY", () => {
    const observed = buildDecisionCase(staleEntryScenario, 5);
    expect(observed.state).toBe("STRUCTURAL_READY");
    expect(observed.current.entryEventObserved).toBe(true);
    expect(observed.current.currentEntryStatus).toBe("CURRENT");
    expect(observed.modelScored).toBe(false);
  });

  it("preserves the structural case when current entry conditions become stale", () => {
    const stale = buildDecisionCase(staleEntryScenario, 6);
    expect(stale.state).toBe("STRUCTURAL_READY");
    expect(stale.current.currentEntryStatus).toBe("STALE");
    expect(stale.entryReason).toContain("structural state is preserved");
    expect(stale.history.some(event =>
      event.changes.some(change => change.field === "currentEntryStatus" && change.to === "STALE")
    )).toBe(true);
  });

  it("never emits legacy alpha READY/TRIGGERED/FIRE labels", () => {
    const states = alphaScenarios.flatMap(scenario =>
      scenario.frames.map((_, index) => buildDecisionCase(scenario, index).state)
    );
    expect(states).not.toContain("READY");
    expect(states).not.toContain("TRIGGERED");
    expect(states).not.toContain("FIRE");
  });

  it("is deterministic for the same scenario and replay frame", () => {
    expect(buildDecisionCase(currentEntryScenario, 5)).toEqual(buildDecisionCase(currentEntryScenario, 5));
  });

  it("fails closed for invalid replay indexes", () => {
    expect(() => buildDecisionCase(staleEntryScenario, 99)).toThrow(RangeError);
  });
});
