import type { AlphaTradeBundle, EvidenceEvent, ReplayFrame, ReplayScenario, StructuralLifecycle } from "../types.js";
import {
  buildResearchMarketMap,
  detectConfirmedPivots,
  type ResearchMarketStructureFact,
  type ResearchStrategyLens,
  type ResearchStructureBar,
} from "./marketMap.js";
import {
  projectMarketMapToChartScene,
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
] as const;

const frames: readonly ReplayFrame[] = [
  { evaluatedAt: "2026-09-24T08:00:01Z" },
  { evaluatedAt: "2026-09-24T08:05:01Z" },
  { evaluatedAt: "2026-09-24T08:10:01Z" },
  { evaluatedAt: "2026-09-24T08:15:01Z" },
  { evaluatedAt: "2026-09-24T08:20:01Z" },
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

const regimeMeasurementDefinition: ResearchRegimeMeasurementDefinition = {
  definitionId: "derived-alpha:regime-measurements:v1",
  lookbackBars: 3,
  baselineBars: 2,
};

const regimeClassificationDefinition: ResearchRegimeClassificationDefinition = {
  definitionId: "derived-alpha:canonical-regime:v1",
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
          threshold: 0.8,
          thresholdProvenanceId: "derived-alpha:fixture-threshold:close-efficiency:v1",
        },
        {
          measurement: "SIGNED_CLOSE_MOVE",
          operator: "GT",
          threshold: 0.0008,
          thresholdProvenanceId: "derived-alpha:fixture-threshold:signed-move:v1",
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
  const pivots = detectConfirmedPivots(TIMEFRAME, barsKnownBy(evaluatedAt), [
    {
      definitionId: "derived-alpha:external-pivot:1x1:v1",
      scale: "EXTERNAL",
      leftBars: 1,
      rightBars: 1,
    },
  ]);

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
  const level = confirmedLevelAt(evaluatedAt);
  const facts: ResearchMarketStructureFact[] = [];
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
    marketFacts: map.facts,
    scene: projectMarketMapToChartScene(map, routeContext.scene),
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
    version: "0.1.0-alpha.4",
    caseId: "case-alpha-eurusd-derived-001",
    title: "Derived BOS → retest lifecycle from OHLC",
    description:
      "A fabricated point-in-time validation replay whose structure, BOS classification and retest lifecycle are derived by the research engine from immutable OHLC evidence.",
    bundle,
    evidence: buildGeneratedEvidence(),
    frames,
  };
}

export function buildDerivedStructuralChartScene(frameIndex: number): EngineChartScene {
  return buildDerivedStructuralReplayFrame(frameIndex).scene;
}
