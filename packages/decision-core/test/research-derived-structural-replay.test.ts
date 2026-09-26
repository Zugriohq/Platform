import { describe, expect, it } from "vitest";
import {
  DERIVED_STRUCTURAL_SCENARIO_ID,
  alphaScenarios,
  buildDecisionCase,
  buildDerivedStructuralReplayFrame,
  buildReplayChartScene,
} from "../src/index.js";

describe("derived structural alpha replay", () => {
  it("is exposed as a normal alpha scenario without changing its no-capital authority", () => {
    const scenario = alphaScenarios.find(item => item.id === DERIVED_STRUCTURAL_SCENARIO_ID);
    expect(scenario).toBeDefined();
    expect(scenario?.bundle.identity.scope.liveData).toBe(false);
    expect(scenario?.bundle.identity.scope.liveCapital).toBe(false);
    expect(scenario?.bundle.evidenceStatus).toBe("VALIDATION_ONLY");
  });

  it("keeps canonical regime unavailable until the bounded window is causal, then resolves strategy routes", () => {
    const early = buildDerivedStructuralReplayFrame(1);
    expect(early.regime.status).toBe("UNAVAILABLE");
    expect(early.regime.regime).toBeNull();
    expect(early.resolvedRoutes).toBeNull();
    expect(early.scene.regimeLabel).toBeNull();
    expect(early.scene.routeContext.status).toBe("UNAVAILABLE");

    const classified = buildDerivedStructuralReplayFrame(2);
    expect(classified.regime.status).toBe("CLASSIFIED");
    expect(classified.regime.regime).toBe("TRENDING");
    expect(classified.scene.regimeLabel).toBe("TRENDING");
    expect(classified.scene.regimeEvidenceId).toBe(classified.regime.classificationId);
    expect(classified.scene.regimeDefinitionId).toBe("derived-alpha:canonical-regime:v2");
    expect(classified.scene.strategyVersion).toBe("0.1.0");
    expect(classified.scene.routeContext).toEqual({
      status: "ROUTES_AVAILABLE",
      families: ["BOS_RETEST"],
      calibrationStatus: "UNVALIDATED_CANDIDATE_SET",
    });
  });

  it("does not hindsight-fill BOS before the causal break is knowable", () => {
    const before = buildDerivedStructuralReplayFrame(1);
    expect(before.breakEvent).toBeNull();
    expect(before.marketFacts.some(fact => fact.concept === "BOS")).toBe(false);
    expect(before.scene.primitives.some(primitive => primitive.concept === "BOS")).toBe(false);

    const after = buildDerivedStructuralReplayFrame(2);
    expect(after.breakEvent).not.toBeNull();
    expect(after.classificationFact?.concept).toBe("BOS");
    expect(after.scene.primitives.some(primitive => primitive.concept === "BOS")).toBe(true);
  });

  it("derives retest touch and hold only from later OHLC evidence", () => {
    const breakFrame = buildDerivedStructuralReplayFrame(2);
    expect(breakFrame.marketFacts.some(fact => fact.concept === "RETEST")).toBe(false);

    const touched = buildDerivedStructuralReplayFrame(3);
    expect(touched.lifecycle?.lifecycle).toBe("RETEST_TOUCHED");
    expect(touched.marketFacts.some(fact => fact.label === "RETEST TOUCHED")).toBe(true);

    const held = buildDerivedStructuralReplayFrame(4);
    expect(held.lifecycle?.lifecycle).toBe("RETEST_HELD");
    expect(held.marketFacts.some(fact => fact.label === "RETEST HELD")).toBe(true);
  });

  it("feeds the existing DecisionCase lifecycle from generated engine evidence", () => {
    const scenario = alphaScenarios.find(item => item.id === DERIVED_STRUCTURAL_SCENARIO_ID)!;

    expect(buildDecisionCase(scenario, 0).current.lifecycle).toBe("CANDIDATE_IDENTIFIED");
    expect(buildDecisionCase(scenario, 2).current.lifecycle).toBe("BREAK_CONFIRMED");
    expect(buildDecisionCase(scenario, 3).current.lifecycle).toBe("RETEST_TOUCHED");
    expect(buildDecisionCase(scenario, 4).current.lifecycle).toBe("RETEST_HELD");
  });

  it("uses the market-map scene, not the legacy text-annotation bridge", () => {
    const scenario = alphaScenarios.find(item => item.id === DERIVED_STRUCTURAL_SCENARIO_ID)!;
    const scene = buildReplayChartScene(scenario, 4);

    expect(scene.timeframe).toBe("M5");
    expect(scene.regimeLabel).toBe("TRENDING");
    expect(scene.routeContext.families).toEqual(["BOS_RETEST"]);
    expect(scene.primitives.some(primitive => primitive.concept === "BOS")).toBe(true);
    expect(scene.primitives.some(primitive =>
      primitive.concept === "RETEST" && primitive.label === "RETEST HELD"
    )).toBe(true);
    expect(scene.authority).toBe("RESEARCH_ONLY");
    expect(scene.liveCapitalAuthority).toBe(false);
  });
});
