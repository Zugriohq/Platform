import type {
  CanonicalRegime,
  ResearchRegimeFact,
  ResearchStructureBar,
} from "./marketMap.js";
import { validateResearchStructureBar } from "./marketMap.js";

export type ResearchRegimeMeasurementName =
  | "CLOSE_EFFICIENCY"
  | "SIGNED_CLOSE_MOVE"
  | "MEAN_BAR_RANGE"
  | "RANGE_EXPANSION_RATIO"
  | "ADJACENT_OVERLAP_RATIO";

export interface ResearchRegimeMeasurementDefinition {
  readonly definitionId: string;
  /** Number of most-recent completed bars used for current measurements. */
  readonly lookbackBars: number;
  /** Number of immediately preceding completed bars used as the range baseline. */
  readonly baselineBars: number;
}

export interface ResearchRegimeMeasurements {
  readonly measurementId: string;
  readonly definitionId: string;
  readonly timeframe: string;
  readonly evaluatedAt: string;
  readonly knownAt: string;
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceBarIds: readonly string[];
  readonly values: Readonly<Record<ResearchRegimeMeasurementName, number>>;
  readonly authority: "RESEARCH_ONLY";
}

export type ResearchRegimeMeasurementStatus =
  | "AVAILABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "DATA_UNAVAILABLE";

export interface ResearchRegimeMeasurementAssessment {
  readonly status: ResearchRegimeMeasurementStatus;
  readonly measurements: ResearchRegimeMeasurements | null;
  readonly reasons: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

export type ResearchRegimeOperator = "GT" | "GTE" | "LT" | "LTE";

export interface ResearchRegimePredicate {
  readonly measurement: ResearchRegimeMeasurementName;
  readonly operator: ResearchRegimeOperator;
  readonly threshold: number;
  readonly thresholdProvenanceId: string;
}

export interface ResearchRegimeRule {
  readonly ruleId: string;
  readonly regime: CanonicalRegime;
  readonly predicates: readonly ResearchRegimePredicate[];
}

export interface ResearchRegimeClassificationDefinition {
  readonly definitionId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  /**
   * All rules are evaluated. Multiple matches fail closed as UNCERTAIN rather
   * than relying on hidden ordering or precedence.
   */
  readonly rules: readonly ResearchRegimeRule[];
}

export type ResearchCanonicalRegimeStatus =
  | "CLASSIFIED"
  | "UNCERTAIN"
  | "UNAVAILABLE";

export interface ResearchCanonicalRegimeResult {
  readonly classificationId: string;
  readonly status: ResearchCanonicalRegimeStatus;
  readonly regime: CanonicalRegime | null;
  readonly fact: ResearchRegimeFact | null;
  readonly matchingRuleIds: readonly string[];
  readonly reasons: readonly string[];
  readonly measurementId: string | null;
  readonly definitionId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  }
  return parsed;
}

function validateMeasurementDefinition(
  definition: ResearchRegimeMeasurementDefinition,
): void {
  if (!definition.definitionId) {
    throw new Error("regime measurement definitionId must be non-empty");
  }
  if (!Number.isInteger(definition.lookbackBars) || definition.lookbackBars < 2) {
    throw new Error("regime lookbackBars must be an integer >= 2");
  }
  if (!Number.isInteger(definition.baselineBars) || definition.baselineBars < 1) {
    throw new Error("regime baselineBars must be an integer >= 1");
  }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function adjacentOverlapRatio(bars: readonly ResearchStructureBar[]): number {
  const ratios: number[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    if (!previous || !current) continue;

    const overlap = Math.max(
      0,
      Math.min(previous.high, current.high) - Math.max(previous.low, current.low),
    );
    const smallerRange = Math.min(
      previous.high - previous.low,
      current.high - current.low,
    );
    ratios.push(smallerRange > 0 ? overlap / smallerRange : 0);
  }
  return ratios.length > 0 ? mean(ratios) : 0;
}

/**
 * Computes neutral, deterministic bounded-window measurements.
 *
 * No regime interpretation or threshold lives here. Request time cannot renew
 * source evidence because only immutable bar status/knownAt participate.
 */
export function computeRegimeMeasurements(input: {
  readonly timeframe: string;
  readonly evaluatedAt: string;
  readonly bars: readonly ResearchStructureBar[];
  readonly definition: ResearchRegimeMeasurementDefinition;
}): ResearchRegimeMeasurementAssessment {
  validateMeasurementDefinition(input.definition);
  if (!input.timeframe.trim()) throw new Error("regime timeframe must be non-empty");

  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");
  const seenEvidence = new Set<string>();
  const seenBars = new Set<string>();

  for (const bar of input.bars) {
    validateResearchStructureBar(bar);
    if (!bar.evidenceId || !bar.sourceBarId) {
      throw new Error("regime bars require evidenceId and sourceBarId");
    }
    if (seenEvidence.has(bar.evidenceId)) {
      throw new Error(`duplicate regime evidenceId: ${bar.evidenceId}`);
    }
    if (seenBars.has(bar.sourceBarId)) {
      throw new Error(`duplicate regime sourceBarId: ${bar.sourceBarId}`);
    }
    seenEvidence.add(bar.evidenceId);
    seenBars.add(bar.sourceBarId);
  }

  const knowable = input.bars
    .filter(bar => epoch(bar.knownAt, "bar.knownAt") <= evaluatedAt)
    .sort((a, b) => {
      const byClose =
        epoch(a.sourceClosedAt, "sourceClosedAt") -
        epoch(b.sourceClosedAt, "sourceClosedAt");
      if (byClose !== 0) return byClose;
      return a.sourceBarId.localeCompare(b.sourceBarId);
    });

  const required = input.definition.lookbackBars + input.definition.baselineBars;
  if (knowable.length < required) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      measurements: null,
      reasons: ["INSUFFICIENT_BOUNDED_WINDOW"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const bounded = knowable.slice(-required);
  const unavailable = bounded.filter(bar => bar.dataStatus !== "FRESH_COMPLETE");
  if (unavailable.length > 0) {
    return {
      status: "DATA_UNAVAILABLE",
      measurements: null,
      reasons: unavailable.map(bar => `${bar.sourceBarId}:${bar.dataStatus}`),
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const baseline = bounded.slice(0, input.definition.baselineBars);
  const current = bounded.slice(input.definition.baselineBars);
  const first = current[0];
  const last = current.at(-1);
  if (!first || !last) throw new Error("regime bounded window unexpectedly empty");

  const closePath = current.slice(1).reduce((sum, bar, index) => {
    const prior = current[index];
    if (!prior) return sum;
    return sum + Math.abs(bar.close - prior.close);
  }, 0);

  const signedCloseMove = last.close - first.close;
  const closeEfficiency =
    closePath > 0 ? Math.abs(signedCloseMove) / closePath : 0;

  const currentRanges = current.map(bar => bar.high - bar.low);
  const baselineRanges = baseline.map(bar => bar.high - bar.low);
  const meanBarRange = mean(currentRanges);
  const baselineMeanRange = mean(baselineRanges);
  const rangeExpansionRatio =
    baselineMeanRange > 0 ? meanBarRange / baselineMeanRange : 0;

  const values: Readonly<Record<ResearchRegimeMeasurementName, number>> = {
    CLOSE_EFFICIENCY: closeEfficiency,
    SIGNED_CLOSE_MOVE: signedCloseMove,
    MEAN_BAR_RANGE: meanBarRange,
    RANGE_EXPANSION_RATIO: rangeExpansionRatio,
    ADJACENT_OVERLAP_RATIO: adjacentOverlapRatio(current),
  };

  const knownAt = bounded.reduce((latest, bar) =>
    epoch(bar.knownAt, "bar.knownAt") > epoch(latest, "knownAt")
      ? bar.knownAt
      : latest,
  bounded[0]!.knownAt);

  const sourceEvidenceIds = bounded.map(bar => bar.evidenceId);
  const sourceBarIds = bounded.map(bar => bar.sourceBarId);
  const measurementId = [
    "regime-measurement",
    input.definition.definitionId,
    input.timeframe,
    ...sourceEvidenceIds,
  ].join(":");

  return {
    status: "AVAILABLE",
    measurements: {
      measurementId,
      definitionId: input.definition.definitionId,
      timeframe: input.timeframe,
      evaluatedAt: input.evaluatedAt,
      knownAt,
      sourceEvidenceIds,
      sourceBarIds,
      values,
      authority: "RESEARCH_ONLY",
    },
    reasons: [],
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}

function predicateMatches(
  value: number,
  predicate: ResearchRegimePredicate,
): boolean {
  switch (predicate.operator) {
    case "GT": return value > predicate.threshold;
    case "GTE": return value >= predicate.threshold;
    case "LT": return value < predicate.threshold;
    case "LTE": return value <= predicate.threshold;
  }
}

function validateClassificationDefinition(
  definition: ResearchRegimeClassificationDefinition,
): void {
  if (!definition.definitionId || !definition.profileId || !definition.profileVersion) {
    throw new Error("regime classification identity fields must be non-empty");
  }
  const ruleIds = new Set<string>();
  for (const rule of definition.rules) {
    if (!rule.ruleId) throw new Error("regime ruleId must be non-empty");
    if (ruleIds.has(rule.ruleId)) throw new Error(`duplicate regime ruleId: ${rule.ruleId}`);
    ruleIds.add(rule.ruleId);
    if (rule.predicates.length === 0) {
      throw new Error(`regime rule ${rule.ruleId} requires at least one predicate`);
    }
    for (const predicate of rule.predicates) {
      if (!Number.isFinite(predicate.threshold)) {
        throw new Error(`regime threshold must be finite: ${rule.ruleId}`);
      }
      if (!predicate.thresholdProvenanceId) {
        throw new Error(`regime predicate requires threshold provenance: ${rule.ruleId}`);
      }
    }
  }
}

/**
 * Applies a versioned profile to neutral measurements.
 *
 * Multiple matching rules are deliberately UNCERTAIN; the classifier never
 * relies on hidden rule order. No probabilistic confidence is produced here.
 */
export function classifyCanonicalRegime(input: {
  readonly assessment: ResearchRegimeMeasurementAssessment;
  readonly definition: ResearchRegimeClassificationDefinition;
}): ResearchCanonicalRegimeResult {
  validateClassificationDefinition(input.definition);

  const identityPrefix = [
    "canonical-regime",
    input.definition.definitionId,
    input.definition.profileId,
    input.definition.profileVersion,
  ].join(":");

  if (input.assessment.status !== "AVAILABLE" || !input.assessment.measurements) {
    return {
      classificationId: `${identityPrefix}:unavailable`,
      status: "UNAVAILABLE",
      regime: null,
      fact: null,
      matchingRuleIds: [],
      reasons: [...input.assessment.reasons],
      measurementId: null,
      definitionId: input.definition.definitionId,
      profileId: input.definition.profileId,
      profileVersion: input.definition.profileVersion,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const measurements = input.assessment.measurements;
  const matches = input.definition.rules.filter(rule =>
    rule.predicates.every(predicate =>
      predicateMatches(measurements.values[predicate.measurement], predicate),
    ),
  );

  const classificationId = [
    identityPrefix,
    measurements.measurementId,
    matches.map(rule => rule.ruleId).sort().join("+") || "none",
  ].join(":");

  if (matches.length !== 1) {
    return {
      classificationId,
      status: "UNCERTAIN",
      regime: null,
      fact: null,
      matchingRuleIds: matches.map(rule => rule.ruleId).sort(),
      reasons: [
        matches.length === 0
          ? "NO_REGIME_RULE_MATCHED"
          : "AMBIGUOUS_REGIME_RULE_MATCH",
      ],
      measurementId: measurements.measurementId,
      definitionId: input.definition.definitionId,
      profileId: input.definition.profileId,
      profileVersion: input.definition.profileVersion,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const match = matches[0]!;
  const fact: ResearchRegimeFact = {
    regime: match.regime,
    knownAt: measurements.knownAt,
    evidenceId: classificationId,
    definitionId: input.definition.definitionId,
  };

  return {
    classificationId,
    status: "CLASSIFIED",
    regime: match.regime,
    fact,
    matchingRuleIds: [match.ruleId],
    reasons: ["CLASSIFIED"],
    measurementId: measurements.measurementId,
    definitionId: input.definition.definitionId,
    profileId: input.definition.profileId,
    profileVersion: input.definition.profileVersion,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
