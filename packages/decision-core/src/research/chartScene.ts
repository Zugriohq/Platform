import type {
  MarketMapGeometry,
  MarketStructureConcept,
  ResearchConceptMaturity,
  ResearchMarketMap,
  ResearchMarketStructureFact,
  ResearchEntryRouteFamily,
  StructureScale,
} from "./marketMap.js";

export type ChartSemanticLayer =
  | "REGIME"
  | "STRUCTURE"
  | "LIQUIDITY"
  | "IMBALANCE"
  | "SETUP"
  | "PATTERN"
  | "ENTRY"
  | "INVALIDATION"
  | "OBJECTIVE"
  | "DIAGNOSTIC"
  | "ADVISORY";

export interface EngineChartPrimitive {
  readonly primitiveId: string;
  readonly layer: ChartSemanticLayer;
  readonly concept:
    | MarketStructureConcept
    | "REGIME"
    | "STRUCTURAL_LIFECYCLE"
    | "ENTRY_STATUS";
  readonly maturity: ResearchConceptMaturity | "DETERMINISTIC_FACT";
  readonly scale: StructureScale | null;
  readonly label: string;
  readonly knownAt: string;
  readonly geometry: MarketMapGeometry;
  readonly sourceFactIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly visibility: "PRIMARY" | "SECONDARY" | "DETAIL";
  /**
   * Semantic style token only. The engine never owns actual CSS/color values.
   */
  readonly styleToken:
    | "STRUCTURE_PRIMARY"
    | "STRUCTURE_SECONDARY"
    | "LIQUIDITY"
    | "IMBALANCE"
    | "SETUP"
    | "PATTERN"
    | "ENTRY"
    | "ADVISORY";
  readonly authorityEffect: "NONE";
}

export interface EngineChartRouteContext {
  readonly status: "UNAVAILABLE" | "ROUTES_AVAILABLE" | "NO_DECLARED_ROUTE";
  readonly families: readonly ResearchEntryRouteFamily[];
  readonly calibrationStatus: "UNVALIDATED_CANDIDATE_SET" | null;
}

export interface EngineChartScene {
  readonly sceneId: string;
  readonly instrument: string;
  readonly timeframe: string;
  readonly evaluatedAt: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly regimeLabel: string | null;
  readonly regimeEvidenceId: string | null;
  readonly regimeDefinitionId: string | null;
  readonly regimeKnownAt: string | null;
  readonly routeContext: EngineChartRouteContext;
  readonly primitives: readonly EngineChartPrimitive[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function layerForFact(fact: ResearchMarketStructureFact): ChartSemanticLayer {
  switch (fact.concept) {
    case "SWING_HIGH":
    case "SWING_LOW":
    case "BOS":
    case "CHOCH":
    case "MSS":
    case "TRENDLINE_SUPPORT":
    case "TRENDLINE_RESISTANCE":
    case "CHANNEL_SUPPORT":
    case "CHANNEL_RESISTANCE":
    case "RANGE_HIGH":
    case "RANGE_LOW":
    case "BREAKOUT":
      return "STRUCTURE";
    case "EQUAL_HIGHS":
    case "EQUAL_LOWS":
    case "LIQUIDITY_SWEEP":
    case "FAKEOUT":
    case "INDUCEMENT":
      return "LIQUIDITY";
    case "FVG":
    case "ORDER_BLOCK":
    case "BREAKER_BLOCK":
    case "MITIGATION_BLOCK":
    case "MITIGATION":
      return "IMBALANCE";
    case "DISPLACEMENT":
    case "RETEST":
    case "CONTINUATION":
      return "SETUP";
    case "DOUBLE_TOP":
    case "DOUBLE_BOTTOM":
    case "HEAD_AND_SHOULDERS":
    case "INVERSE_HEAD_AND_SHOULDERS":
    case "RISING_WEDGE":
    case "FALLING_WEDGE":
    case "ASCENDING_TRIANGLE":
    case "DESCENDING_TRIANGLE":
    case "SYMMETRICAL_TRIANGLE":
    case "FLAG":
    case "PENNANT":
    case "DOJI":
    case "HAMMER":
    case "SHOOTING_STAR":
    case "BULLISH_ENGULFING":
    case "BEARISH_ENGULFING":
    case "INSIDE_BAR":
    case "OUTSIDE_BAR":
    case "MORNING_STAR":
    case "EVENING_STAR":
    case "THREE_WHITE_SOLDIERS":
    case "THREE_BLACK_CROWS":
      return "PATTERN";
    case "ELLIOTT_WAVE":
      return "ADVISORY";
  }
}

function styleForFact(fact: ResearchMarketStructureFact): EngineChartPrimitive["styleToken"] {
  const layer = layerForFact(fact);
  if (layer === "LIQUIDITY") return "LIQUIDITY";
  if (layer === "IMBALANCE") return "IMBALANCE";
  if (layer === "SETUP") return "SETUP";
  if (layer === "PATTERN") return "PATTERN";
  if (layer === "ADVISORY") return "ADVISORY";
  return fact.scale === "EXTERNAL" ? "STRUCTURE_PRIMARY" : "STRUCTURE_SECONDARY";
}

function visibilityForFact(
  fact: ResearchMarketStructureFact,
): EngineChartPrimitive["visibility"] {
  if (fact.maturity === "ADVISORY_ONLY" || fact.maturity === "MORPHOLOGY_ONLY") return "DETAIL";
  if (
    fact.scale === "EXTERNAL" ||
    fact.concept === "LIQUIDITY_SWEEP" ||
    fact.concept === "BOS" ||
    fact.concept === "CHOCH" ||
    fact.concept === "MSS" ||
    fact.concept === "BREAKOUT"
  ) {
    return "PRIMARY";
  }
  return "SECONDARY";
}

/**
 * Engine → interface boundary.
 *
 * The UI receives semantic chart primitives; it may style, hide/show layers and
 * lay out labels, but it may not recalculate structure or invent new market facts.
 */
export function projectMarketMapToChartScene(
  marketMap: ResearchMarketMap,
  routeContext: EngineChartRouteContext = {
    status: "UNAVAILABLE",
    families: [],
    calibrationStatus: null,
  },
): EngineChartScene {
  const primitives: EngineChartPrimitive[] = marketMap.facts.map((fact) => ({
    primitiveId: `primitive:${fact.factId}`,
    layer: layerForFact(fact),
    concept: fact.concept,
    maturity: fact.maturity,
    scale: fact.scale,
    label: fact.label,
    knownAt: fact.knownAt,
    geometry: fact.geometry,
    sourceFactIds: [fact.factId],
    sourceEvidenceIds: fact.sourceEvidenceIds,
    visibility: visibilityForFact(fact),
    styleToken: styleForFact(fact),
    authorityEffect: "NONE",
  }));

  if (marketMap.regime) {
    primitives.unshift({
      primitiveId: `primitive:regime:${marketMap.regime.evidenceId}`,
      layer: "REGIME",
      concept: "REGIME",
      maturity: "DETERMINISTIC_FACT",
      scale: null,
      label: marketMap.regime.regime,
      knownAt: marketMap.regime.knownAt,
      geometry: {
        type: "LEVEL",
        price: 0,
      },
      sourceFactIds: [],
      sourceEvidenceIds: [marketMap.regime.evidenceId],
      visibility: "PRIMARY",
      styleToken: "STRUCTURE_PRIMARY",
      authorityEffect: "NONE",
    });
  }

  return {
    sceneId: `scene:${marketMap.mapId}`,
    instrument: marketMap.instrument,
    timeframe: marketMap.timeframe,
    evaluatedAt: marketMap.evaluatedAt,
    strategyId: marketMap.strategyLens.strategyId,
    strategyVersion: marketMap.strategyLens.version,
    regimeLabel: marketMap.regime?.regime ?? null,
    regimeEvidenceId: marketMap.regime?.evidenceId ?? null,
    regimeDefinitionId: marketMap.regime?.definitionId ?? null,
    regimeKnownAt: marketMap.regime?.knownAt ?? null,
    routeContext,
    primitives,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
