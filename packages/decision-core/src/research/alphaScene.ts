import type { ChartAnnotation, ReplayScenario } from "../types.js";
import { buildDecisionCase } from "../evaluate.js";
import type {
  ChartSemanticLayer,
  EngineChartPrimitive,
  EngineChartScene,
} from "./chartScene.js";

function primitiveFor(
  annotation: ChartAnnotation,
  price: number | null,
): EngineChartPrimitive | null {
  if (price === null) return null;

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
    sourceEvidenceIds: [annotation.evidenceId],
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
  const decision = buildDecisionCase(scenario, frameIndex);
  const primitives = decision.annotations
    .map(annotation => primitiveFor(annotation, decision.current.price))
    .filter((item): item is EngineChartPrimitive => item !== null);

  return {
    sceneId: `alpha-scene:${decision.evaluationId}`,
    instrument: scenario.bundle.identity.scope.instrument,
    timeframe: "FIXTURE_UNSPECIFIED",
    evaluatedAt: decision.current.evaluatedAt,
    strategyId: scenario.bundle.strategy,
    regimeLabel: null,
    primitives,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
