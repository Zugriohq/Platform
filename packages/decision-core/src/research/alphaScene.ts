import type { ChartAnnotation, ReplayScenario } from "../types.js";
import { buildDecisionCase, snapshotAt } from "../evaluate.js";
import type {
  ChartSemanticLayer,
  EngineChartPrimitive,
  EngineChartScene,
} from "./chartScene.js";
import {
  buildDerivedStructuralChartScene,
  DERIVED_STRUCTURAL_SCENARIO_ID,
} from "./derivedStructuralReplay.js";

function primitiveFor(
  annotation: ChartAnnotation,
  scenario: ReplayScenario,
): EngineChartPrimitive | null {
  // A primitive's geometry must be anchored to what was knowable when the
  // annotation itself became known, never to the price of a later replay frame.
  // This keeps already-known chart geometry immutable while scrubbing forward.
  const evidenceAtFact = snapshotAt(scenario, annotation.knownAt);
  const price = evidenceAtFact.price;
  const priceEvidence = evidenceAtFact.evidenceRefs.PRICE;
  if (price === null || !priceEvidence) return null;

  const concept =
    annotation.kind === "ENTRY_STATUS"
      ? "ENTRY_STATUS"
      : "STRUCTURAL_LIFECYCLE";
  const layer: ChartSemanticLayer =
    annotation.kind === "ENTRY_STATUS"
      ? "ENTRY"
      : "SETUP";

  return {
    primitiveId: `alpha-primitive:${annotation.evidenceId}`,
    layer,
    concept,
    maturity: "DETERMINISTIC_FACT",
    scale: null,
    label: annotation.label,
    knownAt: annotation.knownAt,
    geometry: {
      type: "POINT",
      time: annotation.knownAt,
      price,
    },
    sourceFactIds: [],
    sourceEvidenceIds: [annotation.evidenceId, priceEvidence.evidenceId],
    visibility: "PRIMARY",
    styleToken: annotation.kind === "ENTRY_STATUS" ? "ENTRY" : "SETUP",
    authorityEffect: "NONE",
  };
}

/**
 * Validation-only bridge proving the engine → API → interface chart-scene contract.
 *
 * The fixture does not have full OHLC market-map evidence yet, so this scene only
 * projects engine-owned lifecycle/current-entry annotations. No renderer-side
 * pattern interpretation is allowed.
 */
export function buildReplayChartScene(
  scenario: ReplayScenario,
  frameIndex: number,
): EngineChartScene {
  if (scenario.id === DERIVED_STRUCTURAL_SCENARIO_ID) {
    return buildDerivedStructuralChartScene(frameIndex);
  }

  const decision = buildDecisionCase(scenario, frameIndex);
  const primitives = decision.annotations
    .map(annotation => primitiveFor(annotation, scenario))
    .filter((item): item is EngineChartPrimitive => item !== null);

  return {
    sceneId: `alpha-scene:${decision.evaluationId}`,
    instrument: scenario.bundle.identity.scope.instrument,
    timeframe: "FIXTURE_UNSPECIFIED",
    evaluatedAt: decision.current.evaluatedAt,
    strategyId: scenario.bundle.strategy,
    strategyVersion: scenario.bundle.identity.methodProfile.version,
    regimeLabel: null,
    regimeEvidenceId: null,
    regimeDefinitionId: null,
    regimeKnownAt: null,
    regimeContext: {
      status: "UNAVAILABLE",
      measurementId: null,
      profileId: null,
      profileVersion: null,
      matchingRuleIds: [],
      reasons: ["LEGACY_FIXTURE_HAS_NO_CANONICAL_REGIME"],
    },
    routeContext: {
      status: "UNAVAILABLE",
      families: [],
      calibrationStatus: null,
    },
    primitives,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}