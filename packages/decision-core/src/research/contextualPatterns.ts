import type {
  CanonicalRegime,
  MarketStructureConcept,
  ResearchMarketStructureFact,
  ResearchStructureBar,
  StructureScale,
} from "./marketMap.js";

export interface CandlestickMorphologyDefinition {
  readonly definitionId: string;
  readonly dojiMaxBodyToRangeRatio: number;
  readonly pinBarMinDominantWickToRangeRatio: number;
  readonly pinBarMaxOppositeWickToRangeRatio: number;
  readonly pinBarMaxBodyToRangeRatio: number;
  readonly threeCandleMinBodyToRangeRatio: number;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

function fact(
  concept: MarketStructureConcept,
  timeframe: string,
  bar: ResearchStructureBar,
  definitionId: string,
  side: "BUY" | "SELL" | "NEUTRAL",
  sourceEvidenceIds: readonly string[],
  label = concept.replaceAll("_", " "),
): ResearchMarketStructureFact {
  return {
    factId: `candle:${definitionId}:${concept}:${bar.sourceBarId}`,
    concept,
    maturity: "MORPHOLOGY_ONLY",
    scale: null,
    timeframe,
    side,
    knownAt: bar.knownAt,
    definitionId,
    sourceEvidenceIds,
    geometry: {
      type: "POINT",
      time: bar.sourceClosedAt,
      price: bar.close,
    },
    label,
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}

function validateDefinition(definition: CandlestickMorphologyDefinition): void {
  if (!definition.definitionId) throw new Error("candlestick definitionId must be non-empty");
  const ratios = [
    definition.dojiMaxBodyToRangeRatio,
    definition.pinBarMinDominantWickToRangeRatio,
    definition.pinBarMaxOppositeWickToRangeRatio,
    definition.pinBarMaxBodyToRangeRatio,
    definition.threeCandleMinBodyToRangeRatio,
  ];
  if (ratios.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error("candlestick morphology ratios must be finite values between 0 and 1");
  }
}

/**
 * Detects morphology only. A doji/engulfing/pin bar found here has zero directional
 * authority until a strategy-specific contextual rule references it.
 */
export function detectCandlestickMorphology(
  timeframe: string,
  bars: readonly ResearchStructureBar[],
  definition: CandlestickMorphologyDefinition,
): readonly ResearchMarketStructureFact[] {
  validateDefinition(definition);
  if (!timeframe.trim()) throw new Error("timeframe must be non-empty");

  const ordered = [...bars].sort((a, b) => {
    const byClose = epoch(a.sourceClosedAt, "sourceClosedAt") - epoch(b.sourceClosedAt, "sourceClosedAt");
    if (byClose !== 0) return byClose;
    return a.sourceBarId.localeCompare(b.sourceBarId);
  });
  const facts: ResearchMarketStructureFact[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (!current || current.dataStatus !== "FRESH_COMPLETE") continue;

    const range = current.high - current.low;
    if (!(range > 0)) continue;
    const body = Math.abs(current.close - current.open);
    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;

    if (ratio(body, range) <= definition.dojiMaxBodyToRangeRatio) {
      facts.push(fact("DOJI", timeframe, current, definition.definitionId, "NEUTRAL", [current.evidenceId]));
    }

    if (
      ratio(lowerWick, range) >= definition.pinBarMinDominantWickToRangeRatio &&
      ratio(upperWick, range) <= definition.pinBarMaxOppositeWickToRangeRatio &&
      ratio(body, range) <= definition.pinBarMaxBodyToRangeRatio
    ) {
      facts.push(fact("HAMMER", timeframe, current, definition.definitionId, "BUY", [current.evidenceId]));
    }

    if (
      ratio(upperWick, range) >= definition.pinBarMinDominantWickToRangeRatio &&
      ratio(lowerWick, range) <= definition.pinBarMaxOppositeWickToRangeRatio &&
      ratio(body, range) <= definition.pinBarMaxBodyToRangeRatio
    ) {
      facts.push(fact("SHOOTING_STAR", timeframe, current, definition.definitionId, "SELL", [current.evidenceId]));
    }

    const previous = ordered[index - 1];
    if (previous && previous.dataStatus === "FRESH_COMPLETE") {
      const currentBodyLow = Math.min(current.open, current.close);
      const currentBodyHigh = Math.max(current.open, current.close);
      const previousBodyLow = Math.min(previous.open, previous.close);
      const previousBodyHigh = Math.max(previous.open, previous.close);

      if (
        current.close > current.open &&
        previous.close < previous.open &&
        currentBodyLow <= previousBodyLow &&
        currentBodyHigh >= previousBodyHigh
      ) {
        facts.push(fact(
          "BULLISH_ENGULFING",
          timeframe,
          current,
          definition.definitionId,
          "BUY",
          [previous.evidenceId, current.evidenceId],
        ));
      }

      if (
        current.close < current.open &&
        previous.close > previous.open &&
        currentBodyLow <= previousBodyLow &&
        currentBodyHigh >= previousBodyHigh
      ) {
        facts.push(fact(
          "BEARISH_ENGULFING",
          timeframe,
          current,
          definition.definitionId,
          "SELL",
          [previous.evidenceId, current.evidenceId],
        ));
      }

      if (current.high < previous.high && current.low > previous.low) {
        facts.push(fact(
          "INSIDE_BAR",
          timeframe,
          current,
          definition.definitionId,
          "NEUTRAL",
          [previous.evidenceId, current.evidenceId],
        ));
      }

      if (current.high > previous.high && current.low < previous.low) {
        facts.push(fact(
          "OUTSIDE_BAR",
          timeframe,
          current,
          definition.definitionId,
          "NEUTRAL",
          [previous.evidenceId, current.evidenceId],
        ));
      }
    }

    const three = ordered.slice(index - 2, index + 1);
    if (three.length === 3 && three.every(bar => bar.dataStatus === "FRESH_COMPLETE")) {
      const bodyStrong = three.every(bar => {
        const candleRange = bar.high - bar.low;
        return candleRange > 0 &&
          ratio(Math.abs(bar.close - bar.open), candleRange) >= definition.threeCandleMinBodyToRangeRatio;
      });

      const bullish =
        bodyStrong &&
        three.every(bar => bar.close > bar.open) &&
        (three[1]?.close ?? -Infinity) > (three[0]?.close ?? Infinity) &&
        (three[2]?.close ?? -Infinity) > (three[1]?.close ?? Infinity);

      const bearish =
        bodyStrong &&
        three.every(bar => bar.close < bar.open) &&
        (three[1]?.close ?? Infinity) < (three[0]?.close ?? -Infinity) &&
        (three[2]?.close ?? Infinity) < (three[1]?.close ?? -Infinity);

      if (bullish) {
        facts.push(fact(
          "THREE_WHITE_SOLDIERS",
          timeframe,
          current,
          definition.definitionId,
          "BUY",
          three.map(bar => bar.evidenceId),
        ));
      }
      if (bearish) {
        facts.push(fact(
          "THREE_BLACK_CROWS",
          timeframe,
          current,
          definition.definitionId,
          "SELL",
          three.map(bar => bar.evidenceId),
        ));
      }
    }
  }

  return facts.sort((a, b) => {
    const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
    if (byKnownAt !== 0) return byKnownAt;
    return a.factId.localeCompare(b.factId);
  });
}

export interface PatternContextRule {
  readonly ruleId: string;
  readonly patternConcepts: readonly MarketStructureConcept[];
  readonly allowedRegimes: readonly CanonicalRegime[];
  /**
   * Every group is required; at least one concept in each group must be present.
   * Example: [[EXTERNAL swing/range boundary], [sweep/fakeout]].
   */
  readonly requiredContextGroups: readonly (readonly MarketStructureConcept[])[];
  readonly allowedScales: readonly (StructureScale | null)[];
  readonly maxContextAgeMs: number;
}

export interface ContextualPatternAssessment {
  readonly patternFactId: string;
  readonly ruleId: string;
  readonly status: "OUT_OF_CONTEXT" | "CONTEXT_PRESENT" | "STRATEGY_RELEVANT";
  readonly regime: CanonicalRegime | null;
  readonly contextFactIds: readonly string[];
  readonly missingGroups: readonly (readonly MarketStructureConcept[])[];
  readonly reasons: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly authorityEffect: "NONE";
}

/**
 * Contextualizes a pattern without converting it into a trade signal.
 *
 * The caller supplies already-established context facts; this function does not
 * discover proximity, trend, regime or sequence by itself.
 */
export function assessPatternContext(input: {
  readonly pattern: ResearchMarketStructureFact;
  readonly contextFacts: readonly ResearchMarketStructureFact[];
  readonly regime: CanonicalRegime | null;
  readonly evaluatedAt: string;
  readonly rule: PatternContextRule;
}): ContextualPatternAssessment {
  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");
  if (!input.rule.ruleId) throw new Error("pattern context ruleId must be non-empty");
  if (!Number.isFinite(input.rule.maxContextAgeMs) || input.rule.maxContextAgeMs < 0) {
    throw new Error("maxContextAgeMs must be finite and >= 0");
  }

  if (!input.rule.patternConcepts.includes(input.pattern.concept)) {
    return {
      patternFactId: input.pattern.factId,
      ruleId: input.rule.ruleId,
      status: "OUT_OF_CONTEXT",
      regime: input.regime,
      contextFactIds: [],
      missingGroups: input.rule.requiredContextGroups,
      reasons: ["PATTERN_NOT_DECLARED_BY_RULE"],
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE",
    };
  }

  if (epoch(input.pattern.knownAt, "pattern.knownAt") > evaluatedAt) {
    throw new Error("future pattern fact is not knowable yet");
  }

  const usableContext = input.contextFacts.filter(context => {
    const knownAt = epoch(context.knownAt, "context.knownAt");
    return (
      knownAt <= evaluatedAt &&
      knownAt <= epoch(input.pattern.knownAt, "pattern.knownAt") &&
      epoch(input.pattern.knownAt, "pattern.knownAt") - knownAt <= input.rule.maxContextAgeMs &&
      input.rule.allowedScales.includes(context.scale)
    );
  });

  const missingGroups = input.rule.requiredContextGroups.filter(
    group => !group.some(concept => usableContext.some(context => context.concept === concept)),
  );

  const regimeAllowed =
    input.rule.allowedRegimes.length === 0 ||
    (input.regime !== null && input.rule.allowedRegimes.includes(input.regime));

  const contextFactIds = usableContext.map(context => context.factId);
  const reasons: string[] = [];
  if (!regimeAllowed) reasons.push("REGIME_NOT_ALLOWED");
  if (missingGroups.length > 0) reasons.push("REQUIRED_CONTEXT_MISSING");

  const status =
    reasons.length > 0
      ? "OUT_OF_CONTEXT"
      : contextFactIds.length > 0 || input.rule.requiredContextGroups.length === 0
        ? "STRATEGY_RELEVANT"
        : "CONTEXT_PRESENT";

  return {
    patternFactId: input.pattern.factId,
    ruleId: input.rule.ruleId,
    status,
    regime: input.regime,
    contextFactIds,
    missingGroups,
    reasons,
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}
