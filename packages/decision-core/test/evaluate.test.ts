import { describe, expect, it } from "vitest";
import { buildDecisionCase, staleEntryScenario, validEntryScenario } from "../src/index.js";

describe("buildDecisionCase", () => {
  it("treats PASS as a first-class outcome when current conditions go stale", () => {
    expect(buildDecisionCase(staleEntryScenario, 2).state).toBe("READY");
    expect(buildDecisionCase(staleEntryScenario, 3).state).toBe("TRIGGERED");
    const passed = buildDecisionCase(staleEntryScenario, 4);
    expect(passed.state).toBe("PASS");
    expect(passed.reason).toContain("current conditions");
    expect(passed.authority).toBe("NO_LIVE_CAPITAL");
  });

  it("is deterministic for the same scenario and replay frame", () => {
    expect(buildDecisionCase(validEntryScenario, 3)).toEqual(buildDecisionCase(validEntryScenario, 3));
  });

  it("fails closed for invalid replay indexes", () => {
    expect(() => buildDecisionCase(staleEntryScenario, 99)).toThrow(RangeError);
  });
});
