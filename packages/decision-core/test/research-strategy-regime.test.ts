import { describe, expect, it } from "vitest";
import {
  matchRouteContext,
  resolveResearchRoutes,
  type ResearchStrategyRegimePlaybook,
} from "../src/index.js";

const playbook: ResearchStrategyRegimePlaybook = {
  playbookId: "zugrio-core:research-playbook:v1",
  strategyId: "zugrio-core",
  strategyVersion: "0.1.0-research",
  authority: "RESEARCH_ONLY",
  routes: [
    {
      routeId: "breakout-go",
      family: "BREAKOUT_CONTINUATION",
      compatibleRegimes: ["BREAKOUT", "EXPANSION"],
      requiredConceptGroups: [["BREAKOUT"], ["DISPLACEMENT", "CONTINUATION"]],
      optionalContextConcepts: ["EQUAL_HIGHS", "EQUAL_LOWS", "FVG"],
      objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
      invalidationPolicyRef: "invalidation:breakout-go:v1",
      managementPolicyRef: null,
      authority: "RESEARCH_ONLY",
    },
    {
      routeId: "sweep-reversal",
      family: "LIQUIDITY_SWEEP_REVERSAL",
      compatibleRegimes: ["MEAN_REVERTING", "EXHAUSTION"],
      requiredConceptGroups: [["LIQUIDITY_SWEEP"], ["CHOCH", "MSS", "FAKEOUT"]],
      optionalContextConcepts: ["DOJI", "BULLISH_ENGULFING", "BEARISH_ENGULFING"],
      objectiveFamilies: ["OPPOSING_LIQUIDITY", "RANGE_BOUNDARY"],
      invalidationPolicyRef: "invalidation:sweep-reversal:v1",
      managementPolicyRef: null,
      authority: "RESEARCH_ONLY",
    },
  ],
};

describe("research strategy × regime playbook", () => {
  it("resolves only routes declared for the active regime", () => {
    const breakout = resolveResearchRoutes(playbook, "BREAKOUT");
    expect(breakout.status).toBe("ROUTES_AVAILABLE");
    expect(breakout.routes.map(route => route.routeId)).toEqual(["breakout-go"]);
    expect(breakout.calibrationStatus).toBe("UNVALIDATED_CANDIDATE_SET");

    const meanReversion = resolveResearchRoutes(playbook, "MEAN_REVERTING");
    expect(meanReversion.routes.map(route => route.routeId)).toEqual(["sweep-reversal"]);
  });

  it("returns no route rather than inventing one for an undeclared regime", () => {
    const result = resolveResearchRoutes(playbook, "NOISE");
    expect(result.status).toBe("NO_DECLARED_ROUTE");
    expect(result.routes).toEqual([]);
    expect(result.liveCapitalAuthority).toBe(false);
  });

  it("matches structural context without turning it into an edge score", () => {
    const route = playbook.routes[1]!;
    const matched = matchRouteContext(route, ["LIQUIDITY_SWEEP", "MSS", "DOJI"]);
    expect(matched.status).toBe("CONTEXT_SATISFIED");
    expect(matched.authority).toBe("RESEARCH_ONLY");

    const missing = matchRouteContext(route, ["DOJI"]);
    expect(missing.status).toBe("CONTEXT_MISSING");
    expect(missing.missingGroups).toHaveLength(2);
  });

  it("refuses duplicate route identities", () => {
    expect(() => resolveResearchRoutes({
      ...playbook,
      routes: [playbook.routes[0]!, { ...playbook.routes[0]! }],
    }, "BREAKOUT")).toThrow(/duplicate routeId/);
  });
});
