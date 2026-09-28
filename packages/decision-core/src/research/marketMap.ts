export type CanonicalRegime =
  | "TRENDING"
  | "MEAN_REVERTING"
  | "EXPANSION"
  | "BREAKOUT"
  | "NOISE"
  | "EXHAUSTION"
  | "COMPRESSION";

export type StructureScale = "INTERNAL" | "INTERMEDIATE" | "EXTERNAL";

export const MARKET_STRUCTURE_CONCEPTS = [
  "SWING_HIGH",
  "SWING_LOW",
  "EQUAL_HIGHS",
  "EQUAL_LOWS",
  "BOS",
  "CHOCH",
  "MSS",
  "TRENDLINE_SUPPORT",
  "TRENDLINE_RESISTANCE",
  "TRENDLINE_TOUCH",
  "TRENDLINE_PENETRATION",
  "TRENDLINE_BREAK",
  "CHANNEL_SUPPORT",
  "CHANNEL_RESISTANCE",
  "LIQUIDITY_SWEEP",
  "FAKEOUT",
  "INDUCEMENT",
  "DISPLACEMENT",
  "FVG",
  "FVG_TOUCH",
  "FVG_PARTIAL_FILL",
  "FVG_FULL_FILL",
  "ORDER_BLOCK",
  "BREAKER_BLOCK",
  "MITIGATION_BLOCK",
  "MITIGATION",
  "RANGE_HIGH",
  "RANGE_LOW",
  "BREAKOUT",
  "RETEST",
  "CONTINUATION",
  "DOUBLE_TOP",
  "DOUBLE_BOTTOM",
  "HEAD_AND_SHOULDERS",
  "INVERSE_HEAD_AND_SHOULDERS",
  "RISING_WEDGE",
  "FALLING_WEDGE",
  "ASCENDING_TRIANGLE",
  "DESCENDING_TRIANGLE",
  "SYMMETRICAL_TRIANGLE",
  "FLAG",
  "PENNANT",
  "DOJI",
  "HAMMER",
  "SHOOTING_STAR",
  "BULLISH_ENGULFING",
  "BEARISH_ENGULFING",
  "INSIDE_BAR",
  "OUTSIDE_BAR",
  "MORNING_STAR",
  "EVENING_STAR",
  "THREE_WHITE_SOLDIERS",
  "THREE_BLACK_CROWS",
  "ELLIOTT_WAVE",
] as const;

export type MarketStructureConcept = (typeof MARKET_STRUCTURE_CONCEPTS)[number];

export const RESEARCH_CONCEPT_MATURITIES = [
  "DETERMINISTIC_FACT",
  "MORPHOLOGY_ONLY",
  "RESEARCH_DERIVED",
  "ADVISORY_ONLY",
] as const;

export type ResearchConceptMaturity = (typeof RESEARCH_CONCEPT_MATURITIES)[number];

/**
 * Concepts whose maturity is capped at RESEARCH_DERIVED. A trendline is fitted
 * from confirmed pivots under a profile-owned tolerance, and every interaction
 * with it inherits that research status: deterministic arithmetic on a research
 * line does not make the result a deterministic market fact.
 */
export const RESEARCH_DERIVED_CEILING_CONCEPTS = [
  "TRENDLINE_SUPPORT",
  "TRENDLINE_RESISTANCE",
  "TRENDLINE_TOUCH",
  "TRENDLINE_PENETRATION",
  "TRENDLINE_BREAK",
] as const satisfies readonly MarketStructureConcept[];

export function exceedsConceptMaturityCeiling(concept: string, maturity: string): boolean {
  return (RESEARCH_DERIVED_CEILING_CONCEPTS as readonly string[]).includes(concept) &&
    maturity === "DETERMINISTIC_FACT";
}

/**
 * Slack for binary floating-point noise when comparing prices against a
 * profile-owned tolerance or buffer. It is a representation guard (about
 * 1e-12 relative), orders of magnitude below any instrument tick; it is not a
 * tuning parameter and never widens a tolerance in any economically meaningful way.
 */
export function priceComparisonSlack(...values: readonly number[]): number {
  return 1e-12 * Math.max(1, ...values.map(value => Math.abs(value)));
}

export type MarketMapGeometry =
  | {
      readonly type: "POINT";
      readonly time: string;
      readonly price: number;
    }
  | {
      readonly type: "LEVEL";
      readonly price: number;
      readonly startAt?: string;
      readonly endAt?: string;
    }
  | {
      readonly type: "ZONE";
      readonly low: number;
      readonly high: number;
      readonly startAt?: string;
      readonly endAt?: string;
    }
  | {
      readonly type: "PATH";
      readonly points: readonly {
        readonly time: string;
        readonly price: number;
      }[];
    };

export interface ResearchMarketStructureFact {
  readonly factId: string;
  readonly concept: MarketStructureConcept;
  readonly maturity: ResearchConceptMaturity;
  readonly scale: StructureScale | null;
  readonly timeframe: string;
  readonly side: "BUY" | "SELL" | "NEUTRAL";
  readonly knownAt: string;
  readonly definitionId: string;
  /**
   * Upstream market-fact lineage when this fact is derived from already-known
   * facts. Raw OHLC-derived facts may omit it and rely on sourceEvidenceIds.
   */
  readonly sourceFactIds?: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly geometry: MarketMapGeometry;
  readonly label: string;
  readonly authority: "RESEARCH_ONLY";
  readonly authorityEffect: "NONE";
}

export interface ResearchRegimeFact {
  readonly regime: CanonicalRegime;
  readonly knownAt: string;
  readonly evidenceId: string;
  readonly definitionId: string;
}

export type ResearchEntryRouteFamily =
  | "BREAKOUT_CONTINUATION"
  | "BREAKOUT_RETEST"
  | "BOS_RETEST"
  | "CHOCH_RETEST"
  | "MSS_RETEST"
  | "LIQUIDITY_SWEEP_REVERSAL"
  | "FAKEOUT_REVERSAL"
  | "FVG_MITIGATION"
  | "TREND_CONTINUATION"
  | "RANGE_MEAN_REVERSION"
  | "COMPRESSION_BREAKOUT_WATCH";

export type ResearchObjectiveFamily =
  | "NEAREST_CREDIBLE_STRUCTURE"
  | "OPPOSING_LIQUIDITY"
  | "RANGE_BOUNDARY"
  | "IMBALANCE_BOUNDARY"
  | "PREVIOUS_PERIOD_LEVEL"
  | "SESSION_EXTREME"
  | "FIBONACCI_EXTENSION"
  | "TRAILING_STRUCTURE"
  | "TIME_EXIT";

export interface ResearchStrategyLens {
  readonly strategyId: string;
  readonly version: string;
  readonly compatibleRegimes: readonly CanonicalRegime[];
  readonly requiredConcepts: readonly MarketStructureConcept[];
  readonly optionalConcepts: readonly MarketStructureConcept[];
  /**
   * These are routes to observe/compare, not a declaration that one is profitable.
   * Evidence/admission later determines which route, if any, can be authoritative.
   */
  readonly entryRouteFamilies: readonly ResearchEntryRouteFamily[];
  readonly objectiveFamilies: readonly ResearchObjectiveFamily[];
  readonly invalidationPolicyRef: string;
  readonly authority: "RESEARCH_ONLY";
}

export interface ResearchMarketMap {
  readonly mapId: string;
  readonly instrument: string;
  readonly timeframe: string;
  readonly evaluatedAt: string;
  readonly regime: ResearchRegimeFact | null;
  readonly facts: readonly ResearchMarketStructureFact[];
  readonly strategyLens: ResearchStrategyLens;
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

export interface ResearchStructureBar {
  readonly evidenceId: string;
  readonly sourceBarId: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly dataStatus: "FRESH_COMPLETE" | "INCOMPLETE" | "STALE" | "GAP";
}

export interface PivotDefinition {
  readonly definitionId: string;
  readonly scale: StructureScale;
  readonly leftBars: number;
  readonly rightBars: number;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

export function validateResearchStructureBar(bar: ResearchStructureBar): void {
  for (const [label, value] of Object.entries({
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  }
  if (bar.low > bar.high) throw new Error("bar.low cannot exceed bar.high");
  if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) {
    throw new Error("OHLC bar is internally inconsistent");
  }
  const sourceClosedAt = epoch(bar.sourceClosedAt, "sourceClosedAt");
  const knownAt = epoch(bar.knownAt, "knownAt");
  if (bar.dataStatus !== "INCOMPLETE" && knownAt < sourceClosedAt) {
    throw new Error(`closed bar evidence cannot be known before source close: ${bar.sourceBarId}`);
  }
}

function validateDefinition(definition: PivotDefinition): void {
  if (!definition.definitionId) throw new Error("pivot definitionId must be non-empty");
  if (!Number.isInteger(definition.leftBars) || definition.leftBars < 1) {
    throw new Error("leftBars must be an integer >= 1");
  }
  if (!Number.isInteger(definition.rightBars) || definition.rightBars < 1) {
    throw new Error("rightBars must be an integer >= 1");
  }
}

/**
 * Confirmed, non-repainting pivots using rightmost-plateau semantics:
 * ties are allowed on the left and must be strictly cleared on the right.
 *
 * Window sizes are supplied by a versioned definition; this detector does not
 * decide what INTERNAL / INTERMEDIATE / EXTERNAL "should" mean.
 */
export function detectConfirmedPivots(
  timeframe: string,
  bars: readonly ResearchStructureBar[],
  definitions: readonly PivotDefinition[],
): readonly ResearchMarketStructureFact[] {
  if (!timeframe.trim()) throw new Error("timeframe must be non-empty");

  const ids = new Set<string>();
  for (const bar of bars) {
    validateResearchStructureBar(bar);
    if (ids.has(bar.sourceBarId)) throw new Error(`duplicate sourceBarId: ${bar.sourceBarId}`);
    ids.add(bar.sourceBarId);
  }
  for (const definition of definitions) validateDefinition(definition);

  const ordered = [...bars].sort((a, b) => {
    const byClose = epoch(a.sourceClosedAt, "sourceClosedAt") - epoch(b.sourceClosedAt, "sourceClosedAt");
    if (byClose !== 0) return byClose;
    return a.sourceBarId.localeCompare(b.sourceBarId);
  });

  const facts: ResearchMarketStructureFact[] = [];

  for (const definition of definitions) {
    const { leftBars, rightBars } = definition;

    for (let index = leftBars; index < ordered.length - rightBars; index += 1) {
      const source = ordered[index];
      if (!source) continue;

      const window = ordered.slice(index - leftBars, index + rightBars + 1);
      if (window.length !== leftBars + rightBars + 1) continue;
      if (window.some(bar => bar.dataStatus !== "FRESH_COMPLETE")) continue;

      const left = ordered.slice(index - leftBars, index);
      const right = ordered.slice(index + 1, index + rightBars + 1);
      const confirmingBar = ordered[index + rightBars];
      if (!confirmingBar) continue;

      const highConfirmed =
        left.every(bar => source.high >= bar.high) &&
        right.every(bar => source.high > bar.high);

      const lowConfirmed =
        left.every(bar => source.low <= bar.low) &&
        right.every(bar => source.low < bar.low);

      const sourceEvidenceIds = window.map(bar => bar.evidenceId);
      const knownAt = confirmingBar.knownAt;

      if (highConfirmed) {
        facts.push({
          factId: `pivot:${definition.definitionId}:${source.sourceBarId}:high`,
          concept: "SWING_HIGH",
          maturity: "DETERMINISTIC_FACT",
          scale: definition.scale,
          timeframe,
          side: "SELL",
          knownAt,
          definitionId: definition.definitionId,
          sourceEvidenceIds,
          geometry: {
            type: "POINT",
            time: source.sourceClosedAt,
            price: source.high,
          },
          label: `${definition.scale} SWING HIGH`,
          authority: "RESEARCH_ONLY",
          authorityEffect: "NONE",
        });
      }

      if (lowConfirmed) {
        facts.push({
          factId: `pivot:${definition.definitionId}:${source.sourceBarId}:low`,
          concept: "SWING_LOW",
          maturity: "DETERMINISTIC_FACT",
          scale: definition.scale,
          timeframe,
          side: "BUY",
          knownAt,
          definitionId: definition.definitionId,
          sourceEvidenceIds,
          geometry: {
            type: "POINT",
            time: source.sourceClosedAt,
            price: source.low,
          },
          label: `${definition.scale} SWING LOW`,
          authority: "RESEARCH_ONLY",
          authorityEffect: "NONE",
        });
      }
    }
  }

  return facts.sort((a, b) => {
    const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
    if (byKnownAt !== 0) return byKnownAt;
    return a.factId.localeCompare(b.factId);
  });
}


export interface TrendlineDefinition {
  readonly definitionId: string;
  readonly minimumAnchorSeparationMs: number;
}

export interface ResearchTrendlineCandidate {
  readonly candidateId: string;
  readonly side: "SUPPORT" | "RESISTANCE";
  readonly scale: StructureScale | null;
  readonly timeframe: string;
  readonly definitionId: string;
  readonly anchorFactIds: readonly [string, string];
  readonly anchorEvidenceIds: readonly string[];
  readonly knownAt: string;
  readonly geometry: Extract<MarketMapGeometry, { type: "PATH" }>;
  readonly authority: "RESEARCH_ONLY";
}

export interface TrendlineConfirmationDefinition {
  readonly definitionId: string;
  /**
   * Absolute price tolerance supplied by a versioned strategy/profile rule.
   * The engine does not choose or tune this number.
   */
  readonly anchorTolerance: number;
}

/**
 * Two confirmed same-side pivots define candidate geometry only.
 * The candidate is not yet a confirmed trendline fact.
 */
export function buildTrendlineCandidateFromPivots(
  first: ResearchMarketStructureFact,
  second: ResearchMarketStructureFact,
  definition: TrendlineDefinition,
): ResearchTrendlineCandidate | null {
  if (!definition.definitionId) throw new Error("trendline definitionId must be non-empty");
  if (!Number.isFinite(definition.minimumAnchorSeparationMs) || definition.minimumAnchorSeparationMs < 0) {
    throw new Error("minimumAnchorSeparationMs must be finite and >= 0");
  }
  if (first.concept !== second.concept) return null;
  if (first.concept !== "SWING_HIGH" && first.concept !== "SWING_LOW") return null;
  if (first.maturity !== "DETERMINISTIC_FACT" || second.maturity !== "DETERMINISTIC_FACT") return null;
  if (first.scale !== second.scale || first.timeframe !== second.timeframe) return null;
  if (first.geometry.type !== "POINT" || second.geometry.type !== "POINT") return null;

  const firstTime = epoch(first.geometry.time, "first.geometry.time");
  const secondTime = epoch(second.geometry.time, "second.geometry.time");
  if (secondTime <= firstTime) return null;
  if (secondTime - firstTime < definition.minimumAnchorSeparationMs) return null;
  // An anchor whose geometry is later than the moment it claims to be known is non-causal.
  if (firstTime > epoch(first.knownAt, "first.knownAt") || secondTime > epoch(second.knownAt, "second.knownAt")) {
    return null;
  }

  const side = first.concept === "SWING_LOW" ? "SUPPORT" : "RESISTANCE";

  return {
    candidateId: `trendline-candidate:${definition.definitionId}:${first.factId}:${second.factId}`,
    side,
    scale: first.scale,
    timeframe: first.timeframe,
    definitionId: definition.definitionId,
    anchorFactIds: [first.factId, second.factId],
    anchorEvidenceIds: [...new Set([...first.sourceEvidenceIds, ...second.sourceEvidenceIds])],
    knownAt: epoch(first.knownAt, "first.knownAt") >= epoch(second.knownAt, "second.knownAt")
      ? first.knownAt
      : second.knownAt,
    geometry: {
      type: "PATH",
      points: [
        { time: first.geometry.time, price: first.geometry.price },
        { time: second.geometry.time, price: second.geometry.price },
      ],
    },
    authority: "RESEARCH_ONLY",
  };
}

/**
 * A third confirmed same-side pivot must agree with the candidate line inside an
 * explicit profile-owned tolerance before the engine emits a trendline fact.
 */
export function confirmTrendlineWithPivot(
  candidate: ResearchTrendlineCandidate,
  confirmingPivot: ResearchMarketStructureFact,
  definition: TrendlineConfirmationDefinition,
): ResearchMarketStructureFact | null {
  if (!definition.definitionId) throw new Error("trendline confirmation definitionId must be non-empty");
  if (!Number.isFinite(definition.anchorTolerance) || definition.anchorTolerance < 0) {
    throw new Error("anchorTolerance must be finite and >= 0");
  }
  if (confirmingPivot.geometry.type !== "POINT") return null;
  if (confirmingPivot.maturity !== "DETERMINISTIC_FACT") return null;
  if (confirmingPivot.scale !== candidate.scale || confirmingPivot.timeframe !== candidate.timeframe) return null;

  const requiredConcept = candidate.side === "SUPPORT" ? "SWING_LOW" : "SWING_HIGH";
  if (confirmingPivot.concept !== requiredConcept) return null;

  const first = candidate.geometry.points[0];
  const second = candidate.geometry.points[1];
  if (!first || !second) return null;

  const firstTime = epoch(first.time, "trendline first anchor time");
  const secondTime = epoch(second.time, "trendline second anchor time");
  const thirdTime = epoch(confirmingPivot.geometry.time, "confirming pivot time");
  if (thirdTime <= secondTime) return null;
  if (thirdTime > epoch(confirmingPivot.knownAt, "confirmingPivot.knownAt")) return null;

  const slope = (second.price - first.price) / (secondTime - firstTime);
  const expected = first.price + slope * (thirdTime - firstTime);
  const slack = priceComparisonSlack(confirmingPivot.geometry.price, expected, first.price, second.price);
  if (Math.abs(confirmingPivot.geometry.price - expected) > definition.anchorTolerance + slack) return null;

  const concept = candidate.side === "SUPPORT" ? "TRENDLINE_SUPPORT" : "TRENDLINE_RESISTANCE";

  return {
    factId: `trendline:${definition.definitionId}:${candidate.candidateId}:${confirmingPivot.factId}`,
    concept,
    maturity: "RESEARCH_DERIVED",
    scale: candidate.scale,
    timeframe: candidate.timeframe,
    side: candidate.side === "SUPPORT" ? "BUY" : "SELL",
    knownAt: epoch(candidate.knownAt, "candidate.knownAt") >= epoch(confirmingPivot.knownAt, "confirmingPivot.knownAt")
      ? candidate.knownAt
      : confirmingPivot.knownAt,
    definitionId: definition.definitionId,
    sourceFactIds: [...candidate.anchorFactIds, confirmingPivot.factId],
    sourceEvidenceIds: [...new Set([...candidate.anchorEvidenceIds, ...confirmingPivot.sourceEvidenceIds])],
    geometry: {
      type: "PATH",
      points: [
        ...candidate.geometry.points,
        {
          time: confirmingPivot.geometry.time,
          price: expected,
        },
      ],
    },
    label: concept.replaceAll("_", " "),
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}

export interface EqualLevelPairDefinition {
  readonly definitionId: string;
  readonly tolerance: number;
}

export function identifyEqualLevelPair(
  first: ResearchMarketStructureFact,
  second: ResearchMarketStructureFact,
  definition: EqualLevelPairDefinition,
): ResearchMarketStructureFact | null {
  if (!definition.definitionId) throw new Error("equal-level definitionId must be non-empty");
  if (!Number.isFinite(definition.tolerance) || definition.tolerance < 0) {
    throw new Error("equal-level tolerance must be finite and >= 0");
  }
  if (first.concept !== second.concept) return null;
  if (first.scale !== second.scale || first.timeframe !== second.timeframe) return null;
  if (first.concept !== "SWING_HIGH" && first.concept !== "SWING_LOW") return null;
  if (first.geometry.type !== "POINT" || second.geometry.type !== "POINT") return null;
  if (first.factId === second.factId) return null;

  const firstTime = epoch(first.geometry.time, "first.geometry.time");
  const secondTime = epoch(second.geometry.time, "second.geometry.time");
  if (firstTime === secondTime) return null;

  const distance = Math.abs(first.geometry.price - second.geometry.price);
  if (distance > definition.tolerance) return null;

  const low = Math.min(first.geometry.price, second.geometry.price);
  const high = Math.max(first.geometry.price, second.geometry.price);
  const concept = first.concept === "SWING_HIGH" ? "EQUAL_HIGHS" : "EQUAL_LOWS";
  const side = first.concept === "SWING_HIGH" ? "SELL" : "BUY";

  return {
    factId: `equal-level:${definition.definitionId}:${first.factId}:${second.factId}`,
    concept,
    maturity: "DETERMINISTIC_FACT",
    scale: first.scale,
    timeframe: first.timeframe,
    side,
    knownAt: epoch(first.knownAt, "knownAt") >= epoch(second.knownAt, "knownAt") ? first.knownAt : second.knownAt,
    definitionId: definition.definitionId,
    sourceEvidenceIds: [...new Set([...first.sourceEvidenceIds, ...second.sourceEvidenceIds])],
    geometry: {
      type: "ZONE",
      low,
      high,
    },
    label: concept.replaceAll("_", " "),
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}

export interface SweepDefinition {
  readonly definitionId: string;
  readonly penetrationTolerance: number;
}

export function detectLiquiditySweep(
  level: ResearchMarketStructureFact,
  bar: ResearchStructureBar,
  definition: SweepDefinition,
): ResearchMarketStructureFact | null {
  if (!definition.definitionId) throw new Error("sweep definitionId must be non-empty");
  if (!Number.isFinite(definition.penetrationTolerance) || definition.penetrationTolerance < 0) {
    throw new Error("penetrationTolerance must be finite and >= 0");
  }
  validateResearchStructureBar(bar);
  if (bar.dataStatus !== "FRESH_COMPLETE") return null;
  if (level.geometry.type !== "POINT" && level.geometry.type !== "ZONE") return null;

  const levelKnownAt = epoch(level.knownAt, "level.knownAt");
  const barClosedAt = epoch(bar.sourceClosedAt, "bar.sourceClosedAt");
  if (barClosedAt <= levelKnownAt) return null;
  if (level.sourceEvidenceIds.includes(bar.evidenceId)) return null;

  const levelHigh = level.geometry.type === "POINT" ? level.geometry.price : level.geometry.high;
  const levelLow = level.geometry.type === "POINT" ? level.geometry.price : level.geometry.low;

  const sweepsHigh =
    (level.concept === "SWING_HIGH" || level.concept === "EQUAL_HIGHS") &&
    bar.high > levelHigh + definition.penetrationTolerance &&
    bar.close <= levelHigh;

  const sweepsLow =
    (level.concept === "SWING_LOW" || level.concept === "EQUAL_LOWS") &&
    bar.low < levelLow - definition.penetrationTolerance &&
    bar.close >= levelLow;

  if (!sweepsHigh && !sweepsLow) return null;

  return {
    factId: `sweep:${definition.definitionId}:${level.factId}:${bar.sourceBarId}`,
    concept: "LIQUIDITY_SWEEP",
    maturity: "DETERMINISTIC_FACT",
    scale: level.scale,
    timeframe: level.timeframe,
    side: sweepsHigh ? "SELL" : "BUY",
    knownAt: bar.knownAt,
    definitionId: definition.definitionId,
    sourceEvidenceIds: [...new Set([...level.sourceEvidenceIds, bar.evidenceId])],
    geometry: {
      type: "POINT",
      time: bar.sourceClosedAt,
      price: sweepsHigh ? bar.high : bar.low,
    },
    label: sweepsHigh ? "HIGH SWEEP / RECLAIM" : "LOW SWEEP / RECLAIM",
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}

export function buildResearchMarketMap(input: {
  readonly mapId: string;
  readonly instrument: string;
  readonly timeframe: string;
  readonly evaluatedAt: string;
  readonly regime: ResearchRegimeFact | null;
  readonly facts: readonly ResearchMarketStructureFact[];
  readonly strategyLens: ResearchStrategyLens;
}): ResearchMarketMap {
  epoch(input.evaluatedAt, "evaluatedAt");
  for (const fact of input.facts) {
    const factKnownAt = epoch(fact.knownAt, "fact.knownAt");
    if (factKnownAt > epoch(input.evaluatedAt, "evaluatedAt")) {
      throw new Error(`future market-map fact is not knowable yet: ${fact.factId}`);
    }
    if (fact.geometry.type === "POINT" && epoch(fact.geometry.time, "fact.geometry.time") > factKnownAt) {
      throw new Error(`market-map point geometry cannot occur after fact knownAt: ${fact.factId}`);
    }
    if (
      fact.geometry.type === "PATH" &&
      fact.geometry.points.some(point => epoch(point.time, "fact.geometry.points.time") > factKnownAt)
    ) {
      throw new Error(`market-map path geometry cannot occur after fact knownAt: ${fact.factId}`);
    }
  }
  if (input.regime && epoch(input.regime.knownAt, "regime.knownAt") > epoch(input.evaluatedAt, "evaluatedAt")) {
    throw new Error("future regime fact is not knowable yet");
  }

  return {
    ...input,
    facts: [...input.facts].sort((a, b) => {
      const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
      if (byKnownAt !== 0) return byKnownAt;
      return a.factId.localeCompare(b.factId);
    }),
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
