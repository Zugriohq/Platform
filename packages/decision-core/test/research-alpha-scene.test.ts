import { describe, expect, it } from "vitest";
import {
  buildReplayChartScene,
  staleEntryScenario,
} from "../src/index.js";

describe("alpha engine-owned chart scene", () => {
  it("projects typed lifecycle annotations without inventing a regime or timeframe", () => {
    const scene = buildReplayChartScene(staleEntryScenario, 3);

    expect(scene.timeframe).toBe("FIXTURE_UNSPECIFIED");
    expect(scene.regimeLabel).toBeNull();
    expect(scene.authority).toBe("RESEARCH_ONLY");
    expect(scene.liveCapitalAuthority).toBe(false);

    expect(scene.primitives.some(primitive =>
      primitive.concept === "STRUCTURAL_LIFECYCLE" &&
      primitive.layer === "SETUP" &&
      primitive.label === "RETEST HELD"
    )).toBe(true);
  });

  it("projects entry status as a typed ENTRY primitive", () => {
    const scene = buildReplayChartScene(staleEntryScenario, 5);
    const entry = scene.primitives.find(primitive => primitive.concept === "ENTRY_STATUS");

    expect(entry?.layer).toBe("ENTRY");
    expect(entry?.label).toBe("ENTRY CURRENT");
    expect(entry?.styleToken).toBe("ENTRY");
    expect(entry?.authorityEffect).toBe("NONE");
  });
});
