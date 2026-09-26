import type { AlphaTradeBundle, EvidenceEvent, ReplayFrame, ReplayScenario, StructuralLifecycle } from "../types.js";
import {
  buildResearchMarketMap,
  detectConfirmedPivots,
  type ResearchMarketStructureFact,
  type ResearchStrategyLens,
  type ResearchStructureBar,
} from "./marketMap.js";
import {
  deriveEqualLiquidityLevels,
  deriveLiquiditySweeps,
  type ResearchEqualLiquidityDefinition,
} from "./liquidityFacts.js";
import {
  assessFvgRevisit,
  detectThreeBarFvg,
  type ResearchFvgDefinition,
  type ResearchFvgRevisitDefinition,
} from "./imbalanceFacts.js";
import {
  projectMarketMapToChartScene,
  type EngineChartRegimeContext,
  type EngineChartRouteContext,
  type EngineChartScene,
} from "./chartScene.js";
import {
  classifyCanonicalRegime,
  computeRegimeMeasurements,
  type ResearchCanonicalRegimeResult,
  type ResearchRegimeClassificationDefinition,
  type ResearchRegimeMeasurementDefinition,
} from "./regimeEvidence.js";
import {
  resolveResearchRoutes,
  type ResolvedResearchRouteSet,
  type ResearchStrategyRegimePlaybook,
} from "./strategyRegimePlaybook.js";
import {
  classifyStructuralBreak,
  detectStructuralBreak,
  type ResearchBreakClassificationDefinition,
  type ResearchBreakLevelState,
  type ResearchStructuralBiasEvidence,
  type ResearchStructuralBreakDefinition,
  type ResearchStructuralBreakEvent,
} from "./structuralBreaks.js";
import {
  derivePostBreakRetest,
  retestAssessmentToLifecycleObservation,
  type ResearchRetestDefinition,
  type ResearchRetestEvidence,
} from "./retestDerivation.js";
import {
  observeStructuralLifecycle,
  type ResearchBreakSeed,
  type ResearchLifecycleObservation,
  type ResearchLifecycleResult,
} from "./lifecycleObserver.js";

export const DERIVED_STRUCTURAL_SCENARIO_ID = "replay-eurusd-derived-structure";

const TIMEFRAME = "M5";

const bars: readonly ResearchStructureBar[] = [
  {
    evidenceId: "ohlc-0735",
    sourceBarId: "EURUSD:M5:0735",
    open: 1.1738,
    high: 1.1744,
    low: 1.1736,
    close: 1.1741,
    sourceClosedAt: "2026-09-24T07:40:00Z",
    knownAt: "2026-09-24T07:40:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0740",
    sourceBarId: "EURUSD:M5:0740",
    open: 1.1741,
    high: 1.1749,
    low: 1.1739,
    close: 1.1747,
    sourceClosedAt: "2026-09-24T07:45:00Z",
    knownAt: "2026-09-24T07:45:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0745",
    sourceBarId: "EURUSD:M5:0745",
    open: 1.1747,
    high: 1.1754,
    low: 1.1744,
    close: 1.1750,
    sourceClosedAt: "2026-09-24T07:50:00Z",
    knownAt: "2026-09-24T07:50:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0750",
    sourceBarId: "EURUSD:M5:0750",
    open: 1.1750,
    high: 1.1760,
    low: 1.1748,
    close: 1.1756,
    sourceClosedAt: "2026-09-24T07:55:00Z",
    knownAt: "2026-09-24T07:55:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0755",
    sourceBarId: "EURUSD:M5:0755",
    open: 1.1754,
    high: 1.1755,
    low: 1.1749,
    close: 1.1752,
    sourceClosedAt: "2026-09-24T08:00:00Z",
    knownAt: "2026-09-24T08:00:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0800",
    sourceBarId: "EURUSD:M5:0800",
    open: 1.1752,
    high: 1.1758,
    low: 1.1750,
    close: 1.1757,
    sourceClosedAt: "2026-09-24T08:05:00Z",
    knownAt: "2026-09-24T08:05:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0805",
    sourceBarId: "EURUSD:M5:0805",
    open: 1.1757,
    high: 1.1766,
    low: 1.1756,
    close: 1.1764,
    sourceClosedAt: "2026-09-24T08:10:00Z",
    knownAt: "2026-09-24T08:10:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0810",
    sourceBarId: "EURUSD:M5:0810",
    open: 1.1764,
    high: 1.1765,
    low: 1.17595,
    close: 1.17618,
    sourceClosedAt: "2026-09-24T08:15:00Z",
    knownAt: "2026-09-24T08:15:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0815",
    sourceBarId: "EURUSD:M5:0815",
    open: 1.17618,
    high: 1.17655,
    low: 1.17615,
    close: 1.17630,
    sourceClosedAt: "2026-09-24T08:20:00Z",
    knownAt: "2026-09-24T08:20:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0820",
    sourceBarId: "EURUSD:M5:0820",
    open: 1.17630,
    high: 1.17662,
    low: 1.17610,
    close: 1.17650,
    sourceClosedAt: "2026-09-24T08:25:00Z",
    knownAt: "2026-09-24T08:25:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0825",
    sourceBarId: "EURUSD:M5:0825",
    open: 1.17650,
    high: 1.17655,
    low: 1.17555,
    close: 1.17610,
    sourceClosedAt: "2026-09-24T08:30:00Z",
    knownAt: "2026-09-24T08:30:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0830",
    sourceBarId: "EURUSD:M5:0830",
    open: 1.17610,
    high: 1.17690,
    low: 1.17580,
    close: 1.17650,
    sourceClosedAt: "2026-09-24T08:35:00Z",
    knownAt: "2026-09-24T08:35:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
  {
    evidenceId: "ohlc-0835",
    sourceBarId: "EURUSD:M5:0835",
    open: 1.17650,
    high: 1.17655,
    low: 1.17555,
    close: 1.17558,
    sourceClosedAt: "2026-09-24T08:40:00Z",
    knownAt: "2026-09-24T08:40:01Z",
    dataStatus: "FRESH_COMPLETE",
  },
] as const;

const frames: readonly ReplayFrame[] = [
  { evaluatedAt: "2026-09-24T08:00:01Z" },
  { evaluatedAt: "2026-09-24T08:05:01Z" },
  { evaluatedAt: "2026-09-24T08:10:01Z" },
  { evaluatedAt: "2026-09-24T08:15:01Z" },
  { evaluatedAt: "2026-09-24T08:20:01Z" },
  { evaluatedAt: "2026-09-24T08:25:01Z" },
  { evaluatedAt: "2026-09-24T08:30:01Z" },
  { evaluatedAt: "2026-09-24T08:35:01Z" },
  { evaluatedAt: "2026-09-24T08:40:01Z" },
] as const;

const breakDefinition: ResearchStructuralBreakDefinition = {
  definitionId: "derived-alpha:break-close:v1",
  mode: "CLOSE_BEYOND",
  tolerance: 0.0001,
  eligibleLevels: [
    {
      concept: "SWING_HIGH",
      allowedDirections: ["UP"],
      allowedScales: ["EXTERNAL"],
    },
  ],
};

const classificationDefinition: ResearchBreakClassificationDefinition = {
  definitionId: "derived-alpha:classification:v1",
  rules: [
    {
      relation: "CONTINUATION",
      classification: "BOS",
      eligibleScales: ["EXTERNAL"],
      requireDisplacement: false,
    },
  ],
};

const retestDefinition: ResearchRetestDefinition = {
  definitionId: "derived-alpha:retest:v1",
  eligibleBreakModes: ["CLOSE_BEYOND"],
  touchTolerance: 0.0001,
  holdTolerance: 0.00005,
  maximumPenetration: 0.0002,
  holdRule: "CLOSE_VALID_SIDE",
  holdTiming: "LATER_BAR_REQUIRED",
};

const equalLiquidityDefinition: ResearchEqualLiquidityDefinition = {
  definitionId: "derived-alpha:equal-liquidity:v1",
  tolerance: 0.00005,
  pairing: "ADJACENT_CONFIRMED_PIVOTS",
};

const liquiditySweepDefinition = {
  definitionId: "derived-alpha:liquidity-sweep:v1",
  penetrationTolerance: 0.0001,
} as const;

const fvgDefinition: ResearchFvgDefinition = {
  definitionId: "derived-alpha:fvg:wick-gap:v1",
  minimumGap: 0.00005,
};

const fvgRevisitDefinition: ResearchFvgRevisitDefinition = {
  definitionId: "derived-alpha:fvg-revisit:v1",
  partialFillRule: "CLOSE_INSIDE_ZONE",
  fullFillRule: "WICK_REACH_FAR_BOUNDARY",
};

const regimeMeasurementDefinition: ResearchRegimeMeasurementDefinition = {
  definitionId: "derived-alpha:regime-measurements:v2",
  lookbackBars: 5,
  baselineBars: 2,
  maxLatestBarAgeMs: 60_000,
};

const regimeClassificationDefinition: ResearchRegimeClassificationDefinition = {
  definitionId: "derived-alpha:canonical-regime:v2",
  profileId: "zugrio-core-derived-alpha",
  profileVersion: "0.1.0",
  rules: [
    {
      ruleId: "directional-trending-fixture",
      regime: "TRENDING",
      predicates: [
        {
          measurement: "CLOSE_EFFICIENCY",
          operator: "GTE",
          threshold: 0.3,
          thresholdProvenanceId: "derived-alpha:fixture-threshold:close-efficiency:v2",
        },
        {
          measurement: "SIGNED_CLOSE_MOVE",
          operator: "GT",
          threshold: 0.0004,
          thresholdProvenanceId: "derived-alpha:fixture-threshold:signed-move:v2",
        },
      ],
    },
  ],
};

const lens: ResearchStrategyLens = {
  strategyId: "zugrio-core-derived-alpha",
  version: "0.1.0",
  compatibleRegimes: ["TRENDING", "EXPANSION", "BREAKOUT"],
  requiredConcepts: ["SWING_HIGH", "BOS", "RETEST"],
  optionalConcepts: ["FVG", "EQUAL_HIGHS", "LIQUIDITY_SWEEP"],
  entryRouteFamilies: ["BOS_RETEST", "BREAKOUT_RETEST"],
  objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
  invalidationPolicyRef: "derived-alpha:structural-invalidation:v1",
  authority: "RESEARCH_ONLY",
};

const playbook: ResearchStrategyRegimePlaybook = {
  playbookId: "zugrio-core-derived-alpha:playbook:v1",
  strategyId: lens.strategyId,
  strategyVersion: lens.version,
  authority: "RESEARCH_ONLY",
  routes: [
    {
      routeId: "derived-alpha:bos-retest",
      family: "BOS_RETEST",
      compatibleRegimes: ["TRENDING"],
      requiredConceptGroups: [["BOS"], ["RETEST"]],
      optionalContextConcepts: ["FVG", "EQUAL_HIGHS", "LIQUIDITY_SWEEP"],
      objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
      invalidationPolicyRef: lens.invalidationPolicyRef,
      managementPolicyRef: null,
      authority: "RESEARCH_ONLY",
    },
    {
      routeId: "derived-alpha:breakout-retest",
      family: "BREAKOUT_RETEST",
      compatibleRegimes: ["BREAKOUT", "EXPANSION"],
      requiredConceptGroups: [["BREAKOUT"], ["RETEST"]],
      optionalContextConcepts: ["FVG"],
      objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY"],
      invalidationPolicyRef: lens.invalidationPolicyRef,
      managementPolicyRef: null,
      authority: "RESEARCH_ONLY",
    },
  ],
};

const priorBias: ResearchStructuralBiasEvidence = {
  bias: "BULLISH",
  evidenceId: "bias-0805",
  knownAt: "2026-09-24T08:05:01Z",
  definitionId: "derived-alpha:bias:v1",
};

function event(
  id: string,
  kind: EvidenceEvent["kind"],
  knownAt: string,
  value: EvidenceEvent["value"],
): EvidenceEvent {
  return { id, kind, knownAt, value, source: "REPLAY_FIXTURE" };
}

function epoch(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid fixture timestamp: ${value}`);
  return parsed;
}

function barsKnownBy(evaluatedAt: string): ResearchStructureBar[] {
  const cutoff = epoch(evaluatedAt);
  return bars.filter(bar => epoch(bar.knownAt) <= cutoff);
}

function confirmedPivotsAt(evaluatedAt: string): readonly ResearchMarketStructureFact[] {
  return detectConfirmedPivots(TIMEFRAME, barsKnownBy(evaluatedAt), [
    {
      definitionId: "derived-alpha:external-pivot:1x1:v1",
      scale: "EXTERNAL",
      leftBars: 1,
      rightBars: 1,
    },
  ]);
}

function deriveLiquidityContextAt(
  evaluatedAt: string,
  pivots: readonly ResearchMarketStructureFact[],
): {
  equalLevels: readonly ResearchMarketStructureFact[];
  sweeps: readonly ResearchMarketStructureFact[];
} {
  const equalLevels = deriveEqualLiquidityLevels({
    evaluatedAt,
    pivots,
    definition: equalLiquidityDefinition,
  });
  const sweeps = deriveLiquiditySweeps({
    evaluatedAt,
    levels: equalLevels,
    bars: barsKnownBy(evaluatedAt),
    definition: liquiditySweepDefinition,
  });
  return { equalLevels, sweeps };
}

function deriveImbalanceContextAt(
  evaluatedAt: string,
): readonly ResearchMarketStructureFact[] {
  const knownBars = barsKnownBy(evaluatedAt);
  const facts: ResearchMarketStructureFact[] = [];
  const factIds = new Set<string>();

  const add = (fact: ResearchMarketStructureFact | null) => {
    if (!fact || factIds.has(fact.factId)) return;
    factIds.add(fact.factId);
    facts.push(fact);
  };

  for (let index = 2; index < knownBars.length; index += 1) {
    const first = knownBars[index - 2];
    const middle = knownBars[index - 1];
    const third = knownBars[index];
    if (!first || !middle || !third) continue;

    const fvg = detectThreeBarFvg(TIMEFRAME, first, middle, third, fvgDefinition);
    if (!fvg) continue;
    add(fvg);

    for (let revisitIndex = index + 1; revisitIndex < knownBars.length; revisitIndex += 1) {
      const revisitBar = knownBars[revisitIndex];
      if (!revisitBar) continue;
      add(assessFvgRevisit(fvg, revisitBar, fvgRevisitDefinition).fact);
    }
  }

  return facts.sort((a, b) => {
    const byKnownAt = epoch(a.knownAt) - epoch(b.knownAt);
    if (byKnownAt !== 0) return byKnownAt;
    return a.factId.localeCompare(b.factId);
  });
}

function regimeAt(evaluatedAt: string): ResearchCanonicalRegimeResult {
  return classifyCanonicalRegime({
    assessment: computeRegimeMeasurements({
      timeframe: TIMEFRAME,
      evaluatedAt,
      bars,
      definition: regimeMeasurementDefinition,
    }),
    definition: regimeClassificationDefinition,
  });
}

function chartRegimeContext(
  regime: ResearchCanonicalRegimeResult,
): EngineChartRegimeContext {
  return {
    status: regime.status,
    measurementId: regime.measurementId,
    profileId: regime.profileId,
    profileVersion: regime.profileVersion,
    matchingRuleIds: regime.matchingRuleIds,
    reasons: regime.reasons,
  };
}

function routeContextFor(
  regime: ResearchCanonicalRegimeResult,
): {
  resolved: ResolvedResearchRouteSet | null;
  scene: EngineChartRouteContext;
} {
  if (regime.status !== "CLASSIFIED" || regime.regime === null) {
    return {
      resolved: null,
      scene: {
        status: "UNAVAILABLE",
        families: [],
        calibrationStatus: null,
      },
    };
  }

  const resolved = resolveResearchRoutes(playbook, regime.regime);
  return {
    resolved,
    scene: {
      status: resolved.status,
      families: resolved.routes.map(route => route.family),
      calibrationStatus: resolved.calibrationStatus,
    },
  };
}

function confirmedLevelAt(evaluatedAt: string): ResearchMarketStructureFact | null {
  const pivots = confirmedPivotsAt(evaluatedAt);

  return pivots.find(fact =>
    fact.concept === "SWING_HIGH" &&
    fact.geometry.type === "POINT" &&
    Math.abs(fact.geometry.price - 1.1760) < 1e-10
  ) ?? null;
}

function levelState(level: ResearchMarketStructureFact): ResearchBreakLevelState {
  return {
    levelFactId: level.factId,
    status: "ACTIVE",
    evidenceId: "level-state-active-0805",
    knownAt: "2026-09-24T08:05:02Z",
    policyRef: "derived-alpha:level-consumption:v1",
  };
}

function firstBreakAt(
  evaluatedAt: string,
  level: ResearchMarketStructureFact,
): ResearchStructuralBreakEvent | null {
  const state = levelState(level);
  const candidates = barsKnownBy(evaluatedAt).filter(bar =>
    epoch(bar.sourceClosedAt) > epoch(state.knownAt),
  );

  for (const bar of candidates) {
    const assessment = detectStructuralBreak(level, bar, breakDefinition, state);
    const first = assessment.events[0];
    if (first) return first;
  }
  return null;
}

function deriveRetestsAt(
  evaluatedAt: string,
  breakEvent: ResearchStructuralBreakEvent,
): {
  observations: ResearchLifecycleObservation[];
  facts: ResearchMarketStructureFact[];
} {
  const observations: ResearchLifecycleObservation[] = [];
  const facts: ResearchMarketStructureFact[] = [];
  let priorTouch: ResearchRetestEvidence | null = null;

  for (const bar of barsKnownBy(evaluatedAt)) {
    if (epoch(bar.sourceClosedAt) <= epoch(breakEvent.sourceClosedAt)) continue;

    const assessment = derivePostBreakRetest({
      breakEvent,
      bar,
      definition: retestDefinition,
      priorTouch,
    });

    const observation = retestAssessmentToLifecycleObservation(assessment);
    if (observation) observations.push(observation);
    if (assessment.fact) facts.push(assessment.fact);

    if (
      assessment.retest &&
      !assessment.retest.held &&
      assessment.retest.penetrationWithinLimit
    ) {
      priorTouch = assessment.retest;
    }
    if (assessment.retest?.held) break;
  }

  return { observations, facts };
}

export interface DerivedStructuralReplayFrame {
  readonly evaluatedAt: string;
  readonly regime: ResearchCanonicalRegimeResult;
  readonly resolvedRoutes: ResolvedResearchRouteSet | null;
  readonly level: ResearchMarketStructureFact | null;
  readonly breakEvent: ResearchStructuralBreakEvent | null;
  readonly classificationFact: ResearchMarketStructureFact | null;
  readonly lifecycle: ResearchLifecycleResult | null;
  readonly equalLiquidityFacts: readonly ResearchMarketStructureFact[];
  readonly liquiditySweepFacts: readonly ResearchMarketStructureFact[];
  readonly imbalanceFacts: readonly ResearchMarketStructureFact[];
  readonly marketFacts: readonly ResearchMarketStructureFact[];
  readonly scene: EngineChartScene;
}

export function buildDerivedStructuralReplayFrame(
  frameIndex: number,
): DerivedStructuralReplayFrame {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frames.length) {
    throw new RangeError("frameIndex is outside the derived structural replay");
  }

  const frame = frames[frameIndex]!;
  const evaluatedAt = frame.evaluatedAt;
  const regime = regimeAt(evaluatedAt);
  const routeContext = routeContextFor(regime);
  const pivots = confirmedPivotsAt(evaluatedAt);
  const level = confirmedLevelAt(evaluatedAt);
  const liquidityContext = deriveLiquidityContextAt(evaluatedAt, pivots);
  const imbalanceFacts = deriveImbalanceContextAt(evaluatedAt);
  const facts: ResearchMarketStructureFact[] = [
    ...liquidityContext.equalLevels,
    ...liquidityContext.sweeps,
    ...imbalanceFacts,
  ];
  if (level) facts.push(level);

  let breakEvent: ResearchStructuralBreakEvent | null = null;
  let classificationFact: ResearchMarketStructureFact | null = null;
  let lifecycle: ResearchLifecycleResult | null = null;

  if (level) {
    breakEvent = firstBreakAt(evaluatedAt, level);
  }

  if (breakEvent) {
    const classified = classifyStructuralBreak({
      breakEvent,
      priorBias,
      evaluatedAt,
      definition: classificationDefinition,
    });

    if (classified.fact) {
      classificationFact = classified.fact;
      facts.push(classified.fact);
    }

    const retest = deriveRetestsAt(evaluatedAt, breakEvent);
    facts.push(...retest.facts);

    const seed: ResearchBreakSeed = {
      candidateId: `derived-alpha:${breakEvent.breakId}`,
      setupIdentity: `derived-alpha:BOS_RETEST:${breakEvent.levelFactId}`,
      setupType: "BOS_RETEST",
      side: breakEvent.direction === "UP" ? "BUY" : "SELL",
      breakEvidenceId: breakEvent.sourceBarEvidenceId,
      breakSourceBarId: breakEvent.sourceBarId,
      breakSourceClosedAt: breakEvent.sourceClosedAt,
      breakKnownAt: breakEvent.knownAt,
      continuationReferenceEnabled: false,
    };

    lifecycle = observeStructuralLifecycle(seed, retest.observations);
  }

  const map = buildResearchMarketMap({
    mapId: `derived-alpha:${frameIndex}`,
    instrument: "EURUSD",
    timeframe: TIMEFRAME,
    evaluatedAt,
    regime: regime.fact,
    facts,
    strategyLens: lens,
  });

  return {
    evaluatedAt,
    regime,
    resolvedRoutes: routeContext.resolved,
    level,
    breakEvent,
    classificationFact,
    lifecycle,
    equalLiquidityFacts: liquidityContext.equalLevels,
    liquiditySweepFacts: liquidityContext.sweeps,
    imbalanceFacts,
    marketFacts: map.facts,
    scene: projectMarketMapToChartScene(
      map,
      routeContext.scene,
      chartRegimeContext(regime),
    ),
  };
}

function lifecycleAt(frameIndex: number): StructuralLifecycle {
  const derived = buildDerivedStructuralReplayFrame(frameIndex);
  if (!derived.level) return "CANDIDATE_IDENTIFIED";
  if (!derived.breakEvent) return "CANDIDATE_IDENTIFIED";
  if (!derived.lifecycle) return "BREAK_CONFIRMED";
  if (derived.lifecycle.lifecycle === "INVALIDATED" || derived.lifecycle.lifecycle === "EXPIRED") {
    return "BREAK_CONFIRMED";
  }
  return derived.lifecycle.lifecycle;
}

function buildGeneratedEvidence(): readonly EvidenceEvent[] {
  const result: EvidenceEvent[] = [
    event("derived-eligibility", "ELIGIBILITY", frames[0]!.evaluatedAt, "ELIGIBLE"),
  ];

  let previousLifecycle: StructuralLifecycle | null = null;
  let previousRegimeStatus: "AVAILABLE" | "UNAVAILABLE" | "UNCERTAIN" | null = null;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    const knownBars = barsKnownBy(frame.evaluatedAt);
    const latestBar = knownBars.at(-1);
    if (latestBar) {
      result.push(event(
        `derived-price-${index}`,
        "PRICE",
        frame.evaluatedAt,
        latestBar.close,
      ));
    }

    const derivedForRegime = buildDerivedStructuralReplayFrame(index);
    const regimeStatus =
      derivedForRegime.regime.status === "CLASSIFIED"
        ? "AVAILABLE"
        : derivedForRegime.regime.status === "UNCERTAIN"
          ? "UNCERTAIN"
          : "UNAVAILABLE";
    if (regimeStatus !== previousRegimeStatus) {
      result.push(event(
        `derived-regime-${regimeStatus.toLowerCase()}`,
        "REGIME_STATUS",
        frame.evaluatedAt,
        regimeStatus,
      ));
      previousRegimeStatus = regimeStatus;
    }

    const lifecycle = lifecycleAt(index);
    if (lifecycle !== previousLifecycle) {
      result.push(event(
        `derived-lifecycle-${lifecycle.toLowerCase()}`,
        "LIFECYCLE",
        frame.evaluatedAt,
        lifecycle,
      ));
      previousLifecycle = lifecycle;
    }

    const derived = derivedForRegime;
    const note =
      derived.lifecycle?.lifecycle === "RETEST_HELD"
        ? "Engine-derived BOS retest is held from immutable post-break OHLC evidence."
        : derived.lifecycle?.lifecycle === "RETEST_TOUCHED"
          ? "Engine-derived post-break retest has touched; hold remains pending."
          : derived.breakEvent
            ? `Engine-derived structural break is classified under the research profile. Canonical regime: ${derived.regime.regime ?? derived.regime.status}.`
            : derived.regime.status === "CLASSIFIED"
              ? `Canonical regime ${derived.regime.regime} is causally available; no structural break is yet confirmed.`
              : "Canonical regime evidence is not yet available from the bounded window.";

    result.push(event(`derived-note-${index}`, "NOTE", frame.evaluatedAt, note));
  }

  return result;
}

export function createDerivedStructuralReplayScenario(
  bundle: AlphaTradeBundle,
): ReplayScenario {
  return {
    id: DERIVED_STRUCTURAL_SCENARIO_ID,
    version: "0.1.0-alpha.5",
    caseId: "case-alpha-eurusd-derived-001",
    title: "Derived structure → liquidity → imbalance context from OHLC",
    description:
      "A fabricated point-in-time validation replay whose structure, BOS/retest lifecycle, canonical regime, equal-liquidity, sweep/reclaim and FVG context are derived by the research engine from immutable OHLC evidence.",
    bundle,
    evidence: buildGeneratedEvidence(),
    frames,
  };
}

export function buildDerivedStructuralChartScene(frameIndex: number): EngineChartScene {
  return buildDerivedStructuralReplayFrame(frameIndex).scene;
}
