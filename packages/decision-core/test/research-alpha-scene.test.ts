import { describe, expect, it } from "vitest";
import {
  alphaScenarios,
  buildReplayChartScene,
  staleEntryScenario,
} from "../src/index.js";

describe("alpha engine-owned chart scene", () => {
  it("projects typed lifecycle annotations without inventing a regime or timeframe", () => {
    const scene = buildReplayChartScene(staleEntryScenario, 3);

    expect(scene.timeframe).toBe("FIXTURE_UNSPECIFIED");
    expect(scene.regimeLabel).toBeNull();
    expect(scene.regimeEvidenceId).toBeNull();
    expect(scene.regimeDefinitionId).toBeNull();
    expect(scene.regimeKnownAt).toBeNull();
    expect(scene.routeContext).toEqual({
      status: "UNAVAILABLE",
      families: [],
      calibrationStatus: null,
    });
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
  it("keeps an already-known primitive's geometry stable in every later frame where it appears", () => {
    for (const scenario of alphaScenarios) {
      const firstSeen = new Map<string, {
        readonly geometry: unknown;
        readonly sourceEvidenceIds: readonly string[];
      }>();

      scenario.frames.forEach((_, frameIndex) => {
        const scene = buildReplayChartScene(scenario, frameIndex);
        for (const primitive of scene.primitives) {
          const earlier = firstSeen.get(primitive.primitiveId);
          if (earlier) {
            expect(primitive.geometry, `${scenario.id} / ${primitive.primitiveId} geometry drifted at frame ${frameIndex}`)
              .toEqual(earlier.geometry);
            expect(
              primitive.sourceEvidenceIds,
              `${scenario.id} / ${primitive.primitiveId} provenance drifted at frame ${frameIndex}`,
            ).toEqual(earlier.sourceEvidenceIds);
          } else {
            firstSeen.set(primitive.primitiveId, {
              geometry: primitive.geometry,
              sourceEvidenceIds: primitive.sourceEvidenceIds,
            });
          }
        }
      });
    }
  });

  it("pins legacy lifecycle and entry annotations to the price evidence known when each fact became known", () => {
    const lifecycleEarly = buildReplayChartScene(staleEntryScenario, 4)
      .primitives.find((primitive) => primitive.primitiveId === "alpha-primitive:lifecycle-0815");
    const lifecycleLater = buildReplayChartScene(staleEntryScenario, 7)
      .primitives.find((primitive) => primitive.primitiveId === "alpha-primitive:lifecycle-0815");

    expect(lifecycleEarly?.geometry).toEqual({
      type: "POINT",
      time: "2026-09-24T08:15:00Z",
      price: 1.1771,
    });
    expect(lifecycleLater?.geometry).toEqual(lifecycleEarly?.geometry);
    expect(lifecycleLater?.sourceEvidenceIds).toEqual(["lifecycle-0815", "price-0815"]);

    const entryEarly = buildReplayChartScene(staleEntryScenario, 5)
      .primitives.find((primitive) => primitive.primitiveId === "alpha-primitive:entry-status-0817");
    const entryLater = buildReplayChartScene(staleEntryScenario, 7)
      .primitives.find((primitive) => primitive.primitiveId === "alpha-primitive:entry-status-0817");

    expect(entryEarly?.geometry).toEqual({
      type: "POINT",
      time: "2026-09-24T08:17:00Z",
      price: 1.1772,
    });
    expect(entryLater?.geometry).toEqual(entryEarly?.geometry);
    expect(entryLater?.sourceEvidenceIds).toEqual(["entry-status-0817", "price-0817"]);
  });
});