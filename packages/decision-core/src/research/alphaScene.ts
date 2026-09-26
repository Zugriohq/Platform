import type { ReplayScenario } from "../types.js";
import { buildDecisionCase } from "../evaluate.js";
import type {
  ChartSemanticLayer,
  EngineChartPrimitive,
  EngineChartScene,
} from "./chartScene.js";

function lifecycleConcept(label: string): "STRUCTURAL_LIFECYCLE" | "ENTRY_STATUS" {
  return label.startsWith("ENTRY ") ? "ENTRY_STATUS" : "STRUCTURAL_LIFECYCLE";
}

function layerFor(label: string): ChartSemanticLayer {
  return label.startsWith("ENTRY ") ? "ENTRY" : "SETUP";
}

function primitiveFor(
  label: string,
  evidenceId: string,
  knownAt: string,
  price: number | null,
): EngineChartPrimitive | null {
  if (price === null) return null;

  const concept = lifecycleConcept(label);
  return {
    primitiveId: `alpha-primitive:${evidenceId}`,
    layer: layerFor(label),
    concept,
    maturity: "DETERMINISTIC_FACT",
    scale: null,
    label,
    knownAt,
    geometry: {
      type: "POINT",
      time: knownAt,
      price,
    },
    sourceFactIds: [],
    sourceEvidenceIds: [evidenceId],
    visibility:
      label.includes("RETEST") ||
      label.includes("BREAK") ||
      label.includes("LIFECYCLE CONFIRMED") ||
      label.includes("ENTRY STALE") ||
      label.includes("ENTRY CURRENT")
        ? "PRIMARY"
        : "SECONDARY",
    styleToken: concept === "ENTRY_STATUS" ? "ENTRY" : "SETUP",
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
    .map(annotation =>
      primitiveFor(
        annotation.label,
        annotation.evidenceId,
        annotation.knownAt,
        decision.current.price,
      ),
    )
    .filter((item): item is EngineChartPrimitive => item !== null);

  return {
    sceneId: `alpha-scene:${decision.evaluationId}`,
    instrument: scenario.bundle.identity.scope.instrument,
    timeframe: scenario.bundle.identity.scope.horizon,
    evaluatedAt: decision.current.evaluatedAt,
    strategyId: scenario.bundle.strategy,
    regimeLabel: null,
    primitives,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
