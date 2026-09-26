import type {
  ResearchMarketStructureFact,
  ResearchStructureBar,
} from "./marketMap.js";
import { validateResearchStructureBar } from "./marketMap.js";

export interface ResearchFvgDefinition {
  readonly definitionId: string;
  /**
   * Absolute minimum wick-to-wick gap owned by the selected profile/scope.
   * Zero allows any strictly positive gap.
   */
  readonly minimumGap: number;
}

export interface ResearchFvgRevisitDefinition {
  readonly definitionId: string;
  readonly partialFillRule: "CLOSE_INSIDE_ZONE";
  readonly fullFillRule: "WICK_REACH_FAR_BOUNDARY";
}

export interface ResearchFvgRevisitAssessment {
  readonly status: "UNTOUCHED" | "TOUCHED" | "PARTIAL_FILL" | "FULL_FILL";
  readonly fillFraction: number;
  readonly fact: ResearchMarketStructureFact | null;
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function validateFvgDefinition(definition: ResearchFvgDefinition): void {
  if (!definition.definitionId) throw new Error("FVG definitionId must be non-empty");
  if (!Number.isFinite(definition.minimumGap) || definition.minimumGap < 0) {
    throw new Error("FVG minimumGap must be finite and >= 0");
  }
}

/**
 * Three-closed-bar wick imbalance.
 *
 * Bullish: third.low > first.high + minimumGap.
 * Bearish: third.high < first.low - minimumGap.
 *
 * The fact is knowable only when the third bar is closed/known. The middle bar is
 * preserved as source evidence but no displacement/entry meaning is inferred.
 */
export function detectThreeBarFvg(
  timeframe: string,
  first: ResearchStructureBar,
  middle: ResearchStructureBar,
  third: ResearchStructureBar,
  definition: ResearchFvgDefinition,
): ResearchMarketStructureFact | null {
  validateFvgDefinition(definition);
  if (!timeframe.trim()) throw new Error("FVG timeframe must be non-empty");

  for (const bar of [first, middle, third]) validateResearchStructureBar(bar);
  if ([first, middle, third].some(bar => bar.dataStatus !== "FRESH_COMPLETE")) return null;

  const firstClose = epoch(first.sourceClosedAt, "first.sourceClosedAt");
  const middleClose = epoch(middle.sourceClosedAt, "middle.sourceClosedAt");
  const thirdClose = epoch(third.sourceClosedAt, "third.sourceClosedAt");
  if (!(firstClose < middleClose && middleClose < thirdClose)) {
    throw new Error("FVG bars must be strictly chronological");
  }

  const bullishGap = third.low - first.high;
  const bearishGap = first.low - third.high;

  const bullish = bullishGap > 0 && bullishGap >= definition.minimumGap;
  const bearish = bearishGap > 0 && bearishGap >= definition.minimumGap;

  if (bullish === bearish) return null;

  const low = bullish ? first.high : third.high;
  const high = bullish ? third.low : first.low;

  return {
    factId: `fvg:${definition.definitionId}:${first.sourceBarId}:${middle.sourceBarId}:${third.sourceBarId}`,
    concept: "FVG",
    maturity: "DETERMINISTIC_FACT",
    scale: null,
    timeframe,
    side: bullish ? "BUY" : "SELL",
    knownAt: third.knownAt,
    definitionId: definition.definitionId,
    sourceEvidenceIds: [first.evidenceId, middle.evidenceId, third.evidenceId],
    geometry: {
      type: "ZONE",
      low,
      high,
      startAt: third.sourceClosedAt,
    },
    label: bullish ? "BULLISH FVG" : "BEARISH FVG",
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Classifies a later closed bar's interaction with an already-known FVG.
 *
 * TOUCH: wick enters but close returns to the origin side.
 * PARTIAL_FILL: close finishes inside the zone without reaching the far boundary.
 * FULL_FILL: wick reaches/passes the far boundary.
 *
 * These are geometry states only; none imply mitigation success or trade permission.
 */
export function assessFvgRevisit(
  fvg: ResearchMarketStructureFact,
  bar: ResearchStructureBar,
  definition: ResearchFvgRevisitDefinition,
): ResearchFvgRevisitAssessment {
  if (!definition.definitionId) throw new Error("FVG revisit definitionId must be non-empty");
  if (definition.partialFillRule !== "CLOSE_INSIDE_ZONE") {
    throw new Error("unsupported FVG partialFillRule");
  }
  if (definition.fullFillRule !== "WICK_REACH_FAR_BOUNDARY") {
    throw new Error("unsupported FVG fullFillRule");
  }
  validateResearchStructureBar(bar);
  if (fvg.concept !== "FVG" || fvg.geometry.type !== "ZONE") {
    throw new Error("FVG revisit requires a FVG zone fact");
  }
  if (bar.dataStatus !== "FRESH_COMPLETE") {
    return {
      status: "UNTOUCHED",
      fillFraction: 0,
      fact: null,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const barClosedAt = epoch(bar.sourceClosedAt, "bar.sourceClosedAt");
  const fvgKnownAt = epoch(fvg.knownAt, "fvg.knownAt");
  if (barClosedAt <= fvgKnownAt || fvg.sourceEvidenceIds.includes(bar.evidenceId)) {
    return {
      status: "UNTOUCHED",
      fillFraction: 0,
      fact: null,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const { low, high } = fvg.geometry;
  const height = high - low;
  if (!(height > 0)) throw new Error("FVG zone must have positive height");

  const bullish = fvg.side === "BUY";
  const touched = bullish ? bar.low <= high : bar.high >= low;
  if (!touched) {
    return {
      status: "UNTOUCHED",
      fillFraction: 0,
      fact: null,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const fullFill = bullish ? bar.low <= low : bar.high >= high;
  const closeInside = bar.close > low && bar.close < high;

  const rawFraction = bullish
    ? (high - Math.min(high, bar.low)) / height
    : (Math.max(low, bar.high) - low) / height;
  const fillFraction = clamp01(rawFraction);

  const status: ResearchFvgRevisitAssessment["status"] =
    fullFill
      ? "FULL_FILL"
      : closeInside
        ? "PARTIAL_FILL"
        : "TOUCHED";

  const concept =
    status === "FULL_FILL"
      ? "FVG_FULL_FILL"
      : status === "PARTIAL_FILL"
        ? "FVG_PARTIAL_FILL"
        : "FVG_TOUCH";

  const label =
    status === "FULL_FILL"
      ? "FVG FULL FILL"
      : status === "PARTIAL_FILL"
        ? "FVG PARTIAL FILL"
        : "FVG TOUCH";

  return {
    status,
    fillFraction,
    fact: {
      factId: `fvg-revisit:${definition.definitionId}:${fvg.factId}:${bar.sourceBarId}`,
      concept,
      maturity: "DETERMINISTIC_FACT",
      scale: fvg.scale,
      timeframe: fvg.timeframe,
      side: fvg.side,
      knownAt: bar.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds: [...new Set([...fvg.sourceEvidenceIds, bar.evidenceId])],
      geometry: {
        type: "POINT",
        time: bar.sourceClosedAt,
        price: bullish ? bar.low : bar.high,
      },
      label,
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE",
    },
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
