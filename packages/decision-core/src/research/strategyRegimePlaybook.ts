import type {
  CanonicalRegime,
  MarketStructureConcept,
  ResearchEntryRouteFamily,
  ResearchObjectiveFamily,
} from "./marketMap.js";

export interface ResearchRouteDefinition {
  readonly routeId: string;
  readonly family: ResearchEntryRouteFamily;
  readonly compatibleRegimes: readonly CanonicalRegime[];
  /**
   * Every group is required; at least one concept from each group must be present.
   * This supports alternatives such as [BOS | MSS] without hard-coding one method.
   */
  readonly requiredConceptGroups: readonly (readonly MarketStructureConcept[])[];
  readonly optionalContextConcepts: readonly MarketStructureConcept[];
  readonly objectiveFamilies: readonly ResearchObjectiveFamily[];
  readonly invalidationPolicyRef: string;
  readonly managementPolicyRef: string | null;
  readonly authority: "RESEARCH_ONLY";
}

export interface ResearchStrategyRegimePlaybook {
  readonly playbookId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly routes: readonly ResearchRouteDefinition[];
  readonly authority: "RESEARCH_ONLY";
}

export interface ResolvedResearchRouteSet {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly regime: CanonicalRegime;
  readonly status: "ROUTES_AVAILABLE" | "NO_DECLARED_ROUTE";
  readonly routes: readonly ResearchRouteDefinition[];
  readonly calibrationStatus: "UNVALIDATED_CANDIDATE_SET";
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

/**
 * Resolves declared route families for a strategy/regime. It does not rank routes,
 * estimate win probability, or call one "optimal".
 */
export function resolveResearchRoutes(
  playbook: ResearchStrategyRegimePlaybook,
  regime: CanonicalRegime,
): ResolvedResearchRouteSet {
  if (!playbook.playbookId || !playbook.strategyId || !playbook.strategyVersion) {
    throw new Error("playbook identity fields must be non-empty");
  }

  const seen = new Set<string>();
  for (const route of playbook.routes) {
    if (!route.routeId) throw new Error("routeId must be non-empty");
    if (seen.has(route.routeId)) throw new Error(`duplicate routeId: ${route.routeId}`);
    seen.add(route.routeId);
    if (!route.invalidationPolicyRef) throw new Error(`route ${route.routeId} requires invalidationPolicyRef`);
  }

  const routes = playbook.routes.filter(route => route.compatibleRegimes.includes(regime));

  return {
    strategyId: playbook.strategyId,
    strategyVersion: playbook.strategyVersion,
    regime,
    status: routes.length > 0 ? "ROUTES_AVAILABLE" : "NO_DECLARED_ROUTE",
    routes,
    calibrationStatus: "UNVALIDATED_CANDIDATE_SET",
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}

export interface RouteContextMatch {
  readonly routeId: string;
  readonly status: "CONTEXT_SATISFIED" | "CONTEXT_MISSING";
  readonly satisfiedConcepts: readonly MarketStructureConcept[];
  readonly missingGroups: readonly (readonly MarketStructureConcept[])[];
  readonly authority: "RESEARCH_ONLY";
}

/**
 * Checks whether a route's declared structural/context vocabulary is present.
 * This is a context match, not an edge score.
 */
export function matchRouteContext(
  route: ResearchRouteDefinition,
  presentConcepts: readonly MarketStructureConcept[],
): RouteContextMatch {
  const present = new Set(presentConcepts);
  const missingGroups = route.requiredConceptGroups.filter(
    group => !group.some(concept => present.has(concept)),
  );

  return {
    routeId: route.routeId,
    status: missingGroups.length === 0 ? "CONTEXT_SATISFIED" : "CONTEXT_MISSING",
    satisfiedConcepts: [...present],
    missingGroups,
    authority: "RESEARCH_ONLY",
  };
}
