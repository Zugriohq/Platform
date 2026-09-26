import { describe, expect, it } from "vitest";
import {
  evaluateResearchObjectives,
  type ResearchObjectiveCandidate,
} from "../src/index.js";

function objective(
  id: string,
  price: number,
  family: ResearchObjectiveCandidate["family"] = "NEAREST_CREDIBLE_STRUCTURE",
  knownAt = "2026-09-24T08:20:00Z",
): ResearchObjectiveCandidate {
  return {
    objectiveId:id,
    family,
    price,
    knownAt,
    sourceFactIds:[`fact:${id}`],
    sourceEvidenceIds:[`evidence:${id}`],
    label:id,
  };
}

describe("research objective engine", () => {
  it("keeps the nearest credible objective first even when a farther target has a prettier R", () => {
    const result = evaluateResearchObjectives({
      side:"BUY",
      entryPrice:100,
      structuralInvalidationPrice:98,
      evaluatedAt:"2026-09-24T08:30:00Z",
      candidates:[
        objective("near-resistance",100.6),
        objective("far-liquidity",104,"OPPOSING_LIQUIDITY"),
      ],
      policy:{
        policyId:"truth-first:v1",
        allowedFamilies:["NEAREST_CREDIBLE_STRUCTURE","OPPOSING_LIQUIDITY"],
        minimumFirstObjectiveR:1,
        maxObjectives:3,
      },
    });

    expect(result.firstObjective?.objectiveId).toBe("near-resistance");
    expect(result.firstObjective?.rMultiple).toBeCloseTo(0.3);
    expect(result.runwayStatus).toBe("BLOCKED");
    expect(result.blockers).toContain("NEAREST_CREDIBLE_OBJECTIVE_TOO_CLOSE");
    expect(result.objectives[1]?.objectiveId).toBe("far-liquidity");
  });

  it("does not use future objectives", () => {
    const result = evaluateResearchObjectives({
      side:"SELL",
      entryPrice:100,
      structuralInvalidationPrice:102,
      evaluatedAt:"2026-09-24T08:30:00Z",
      candidates:[
        objective("future-low",96,"OPPOSING_LIQUIDITY","2026-09-24T09:00:00Z"),
        objective("known-low",98,"OPPOSING_LIQUIDITY","2026-09-24T08:20:00Z"),
      ],
      policy:{
        policyId:"point-in-time:v1",
        allowedFamilies:["OPPOSING_LIQUIDITY"],
        minimumFirstObjectiveR:0,
        maxObjectives:3,
      },
    });

    expect(result.objectives.map(item => item.objectiveId)).toEqual(["known-low"]);
  });

  it("respects the structural invalidation distance rather than inventing a cosmetic stop", () => {
    const result = evaluateResearchObjectives({
      side:"BUY",
      entryPrice:100,
      structuralInvalidationPrice:95,
      evaluatedAt:"2026-09-24T08:30:00Z",
      candidates:[objective("target",105)],
      policy:{
        policyId:"structural-risk:v1",
        allowedFamilies:["NEAREST_CREDIBLE_STRUCTURE"],
        minimumFirstObjectiveR:1,
        maxObjectives:1,
      },
    });

    expect(result.riskDistance).toBe(5);
    expect(result.firstObjective?.rMultiple).toBe(1);
    expect(result.runwayStatus).toBe("AVAILABLE");
  });

  it("reports no credible objective instead of fabricating a projection", () => {
    const result = evaluateResearchObjectives({
      side:"BUY",
      entryPrice:100,
      structuralInvalidationPrice:98,
      evaluatedAt:"2026-09-24T08:30:00Z",
      candidates:[objective("behind-entry",99)],
      policy:{
        policyId:"no-fallback:v1",
        allowedFamilies:["NEAREST_CREDIBLE_STRUCTURE"],
        minimumFirstObjectiveR:0.5,
        maxObjectives:3,
      },
    });

    expect(result.firstObjective).toBeNull();
    expect(result.runwayStatus).toBe("NO_CREDIBLE_OBJECTIVE");
    expect(result.blockers).toContain("NO_CREDIBLE_OBJECTIVE");
  });
  it("rejects structural invalidation on the wrong side of entry", () => {
    expect(() => evaluateResearchObjectives({
      side:"BUY",
      entryPrice:100,
      structuralInvalidationPrice:101,
      evaluatedAt:"2026-09-24T08:30:00Z",
      candidates:[objective("target",105)],
      policy:{
        policyId:"structural-side:v1",
        allowedFamilies:["NEAREST_CREDIBLE_STRUCTURE"],
        minimumFirstObjectiveR:0,
        maxObjectives:1,
      },
    })).toThrow(/below entry for BUY/);

    expect(() => evaluateResearchObjectives({
      side:"SELL",
      entryPrice:100,
      structuralInvalidationPrice:99,
      evaluatedAt:"2026-09-24T08:30:00Z",
      candidates:[objective("target",95)],
      policy:{
        policyId:"structural-side:v1",
        allowedFamilies:["NEAREST_CREDIBLE_STRUCTURE"],
        minimumFirstObjectiveR:0,
        maxObjectives:1,
      },
    })).toThrow(/above entry for SELL/);
  });
});
