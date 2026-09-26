import type { ResearchObjectiveFamily } from "./marketMap.js";

export interface ResearchObjectiveCandidate {
  readonly objectiveId: string;
  readonly family: ResearchObjectiveFamily;
  readonly price: number;
  readonly knownAt: string;
  readonly sourceFactIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly label: string;
}

export interface ResearchObjectivePolicy {
  readonly policyId: string;
  readonly allowedFamilies: readonly ResearchObjectiveFamily[];
  readonly minimumFirstObjectiveR: number;
  readonly maxObjectives: number;
}

export interface EvaluatedResearchObjective extends ResearchObjectiveCandidate {
  readonly distance: number;
  readonly rMultiple: number;
}

export interface ResearchObjectivePlan {
  readonly policyId: string;
  readonly side: "BUY" | "SELL";
  readonly entryPrice: number;
  readonly structuralInvalidationPrice: number;
  readonly riskDistance: number;
  readonly objectives: readonly EvaluatedResearchObjective[];
  readonly firstObjective: EvaluatedResearchObjective | null;
  readonly runwayStatus: "AVAILABLE" | "BLOCKED" | "NO_CREDIBLE_OBJECTIVE";
  readonly blockers: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

export function evaluateResearchObjectives(input: {
  readonly side: "BUY" | "SELL";
  readonly entryPrice: number;
  readonly structuralInvalidationPrice: number;
  readonly evaluatedAt: string;
  readonly candidates: readonly ResearchObjectiveCandidate[];
  readonly policy: ResearchObjectivePolicy;
}): ResearchObjectivePlan {
  if (!input.policy.policyId) throw new Error("objective policyId must be non-empty");
  if (!Number.isFinite(input.policy.minimumFirstObjectiveR) || input.policy.minimumFirstObjectiveR < 0) {
    throw new Error("minimumFirstObjectiveR must be finite and >= 0");
  }
  if (!Number.isInteger(input.policy.maxObjectives) || input.policy.maxObjectives < 1) {
    throw new Error("maxObjectives must be an integer >= 1");
  }
  if (!Number.isFinite(input.entryPrice) || !Number.isFinite(input.structuralInvalidationPrice)) {
    throw new Error("entry and invalidation prices must be finite");
  }

  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");
  const invalidationOnCorrectSide =
    input.side === "BUY"
      ? input.structuralInvalidationPrice < input.entryPrice
      : input.structuralInvalidationPrice > input.entryPrice;
  if (!invalidationOnCorrectSide) {
    throw new Error(
      `structural invalidation must be ${input.side === "BUY" ? "below" : "above"} entry for ${input.side}`,
    );
  }
  const riskDistance = Math.abs(input.entryPrice - input.structuralInvalidationPrice);

  const directional = input.candidates
    .filter(candidate => {
      if (!Number.isFinite(candidate.price)) throw new Error(`objective ${candidate.objectiveId} price must be finite`);
      if (epoch(candidate.knownAt, "candidate.knownAt") > evaluatedAt) return false;
      if (!input.policy.allowedFamilies.includes(candidate.family)) return false;
      return input.side === "BUY" ? candidate.price > input.entryPrice : candidate.price < input.entryPrice;
    })
    .map(candidate => {
      const distance = Math.abs(candidate.price - input.entryPrice);
      return {
        ...candidate,
        distance,
        rMultiple: distance / riskDistance,
      };
    })
    .sort((a, b) => {
      const byDistance = a.distance - b.distance;
      if (byDistance !== 0) return byDistance;
      return a.objectiveId.localeCompare(b.objectiveId);
    });

  const selected = directional.slice(0, input.policy.maxObjectives);
  const firstObjective = selected[0] ?? null;
  const blockers: string[] = [];

  let runwayStatus: ResearchObjectivePlan["runwayStatus"];
  if (!firstObjective) {
    runwayStatus = "NO_CREDIBLE_OBJECTIVE";
    blockers.push("NO_CREDIBLE_OBJECTIVE");
  } else if (firstObjective.rMultiple < input.policy.minimumFirstObjectiveR) {
    runwayStatus = "BLOCKED";
    blockers.push("NEAREST_CREDIBLE_OBJECTIVE_TOO_CLOSE");
  } else {
    runwayStatus = "AVAILABLE";
  }

  return {
    policyId: input.policy.policyId,
    side: input.side,
    entryPrice: input.entryPrice,
    structuralInvalidationPrice: input.structuralInvalidationPrice,
    riskDistance,
    objectives: selected,
    firstObjective,
    runwayStatus,
    blockers,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
