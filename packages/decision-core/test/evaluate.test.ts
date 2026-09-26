import { describe, expect, it } from "vitest";
import { buildDecisionCase, staleEntryScenario, validEntryScenario } from "../src/index.js";

describe("buildDecisionCase", () => {
  it("preserves a retest evidence change even when the headline state stays READY", () => {
    const beforeRetest = buildDecisionCase(staleEntryScenario, 2);
    const afterRetest = buildDecisionCase(staleEntryScenario, 3);

    expect(beforeRetest.state).toBe("READY");
    expect(beforeRetest.current.retestObserved).toBe(false);
    expect(afterRetest.state).toBe("READY");
    expect(afterRetest.current.retestObserved).toBe(true);
    expect(afterRetest.current.triggerQualified).toBe(false);

    const retestEvent = afterRetest.history.find(event =>
      event.changes.some(change => change.field === "retestObserved" && change.from === false && change.to === true)
    );

    expect(retestEvent?.state).toBe("READY");
    expect(afterRetest.authority).toBe("NO_LIVE_CAPITAL");
  });

  it("separates the later trigger from the earlier retest observation", () => {
    const triggered = buildDecisionCase(staleEntryScenario, 4);
    expect(triggered.current.retestObserved).toBe(true);
    expect(triggered.current.triggerQualified).toBe(true);
    expect(triggered.state).toBe("TRIGGERED");

    const triggerEvent = triggered.history.find(event =>
      event.changes.some(change => change.field === "triggerQualified" && change.to === true)
    );

    expect(triggerEvent).toBeDefined();
  });

  it("treats PASS as a first-class outcome when current conditions go stale", () => {
    const passed = buildDecisionCase(staleEntryScenario, 5);
    expect(passed.state).toBe("PASS");
    expect(passed.reason).toContain("current conditions");
    expect(passed.current.retestObserved).toBe(true);
    expect(passed.authority).toBe("NO_LIVE_CAPITAL");
  });

  it("is deterministic for the same scenario and replay frame", () => {
    expect(buildDecisionCase(validEntryScenario, 4)).toEqual(buildDecisionCase(validEntryScenario, 4));
  });

  it("fails closed for invalid replay indexes", () => {
    expect(() => buildDecisionCase(staleEntryScenario, 99)).toThrow(RangeError);
  });
});
