import { describe, expect, it } from "vitest";
import {
  assessPatternContext,
  buildTrendlineFromPivots,
  detectCandlestickMorphology,
  type CandlestickMorphologyDefinition,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
} from "../src/index.js";

const candleDef: CandlestickMorphologyDefinition = {
  definitionId: "candle-morphology:v1",
  dojiMaxBodyToRangeRatio: 0.1,
  pinBarMinDominantWickToRangeRatio: 0.55,
  pinBarMaxOppositeWickToRangeRatio: 0.15,
  pinBarMaxBodyToRangeRatio: 0.3,
  threeCandleMinBodyToRangeRatio: 0.55,
};

function bar(
  id: string,
  open: number,
  high: number,
  low: number,
  close: number,
  index: number,
): ResearchStructureBar {
  const closedAt = new Date(Date.parse("2026-09-24T08:00:00Z") + index * 300_000).toISOString();
  return {
    evidenceId: `evidence:${id}`,
    sourceBarId: id,
    open,
    high,
    low,
    close,
    sourceClosedAt: closedAt,
    knownAt: new Date(Date.parse(closedAt) + 1_000).toISOString(),
    dataStatus: "FRESH_COMPLETE",
  };
}

function contextFact(
  factId: string,
  concept: ResearchMarketStructureFact["concept"],
  knownAt: string,
  scale: ResearchMarketStructureFact["scale"] = "EXTERNAL",
): ResearchMarketStructureFact {
  return {
    factId,
    concept,
    maturity: "DETERMINISTIC_FACT",
    scale,
    timeframe: "M5",
    side: "NEUTRAL",
    knownAt,
    definitionId: "context:v1",
    sourceEvidenceIds: [factId + ":evidence"],
    geometry: { type: "LEVEL", price: 1.1 },
    label: concept.replaceAll("_", " "),
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };
}

describe("contextual pattern ontology", () => {
  it("detects a doji as morphology only, not as reversal authority", () => {
    const facts = detectCandlestickMorphology("M5", [
      bar("doji", 1.1000, 1.1010, 1.0990, 1.1001, 0),
    ], candleDef);

    const doji = facts.find(item => item.concept === "DOJI");
    expect(doji?.maturity).toBe("DETERMINISTIC_FACT");
    expect(doji?.authorityEffect).toBe("NONE");
    expect(doji?.side).toBe("NEUTRAL");
  });

  it("makes the same doji strategy-relevant only when declared structural context is present", () => {
    const doji = detectCandlestickMorphology("M5", [
      bar("doji", 1.1000, 1.1010, 1.0990, 1.1001, 4),
    ], candleDef).find(item => item.concept === "DOJI");
    expect(doji).toBeDefined();

    const rule = {
      ruleId: "doji-at-external-liquidity:v1",
      patternConcepts: ["DOJI"] as const,
      allowedRegimes: ["EXHAUSTION", "MEAN_REVERTING"] as const,
      requiredContextGroups: [
        ["SWING_HIGH", "SWING_LOW", "RANGE_HIGH", "RANGE_LOW"],
        ["LIQUIDITY_SWEEP", "FAKEOUT"],
      ] as const,
      allowedScales: ["EXTERNAL"] as const,
      maxContextAgeMs: 60 * 60 * 1000,
    };

    const outOfContext = assessPatternContext({
      pattern: doji!,
      contextFacts: [],
      regime: "EXHAUSTION",
      evaluatedAt: doji!.knownAt,
      rule,
    });
    expect(outOfContext.status).toBe("OUT_OF_CONTEXT");
    expect(outOfContext.reasons).toContain("REQUIRED_CONTEXT_MISSING");

    const relevant = assessPatternContext({
      pattern: doji!,
      contextFacts: [
        contextFact("external-high", "SWING_HIGH", "2026-09-24T08:10:00Z"),
        contextFact("sweep", "LIQUIDITY_SWEEP", "2026-09-24T08:15:00Z"),
      ],
      regime: "EXHAUSTION",
      evaluatedAt: doji!.knownAt,
      rule,
    });
    expect(relevant.status).toBe("STRATEGY_RELEVANT");
    expect(relevant.authorityEffect).toBe("NONE");
  });

  it("does not let a textbook candle pattern override an incompatible regime", () => {
    const doji = detectCandlestickMorphology("M5", [
      bar("doji", 1.1000, 1.1010, 1.0990, 1.1001, 4),
    ], candleDef).find(item => item.concept === "DOJI")!;

    const assessment = assessPatternContext({
      pattern: doji,
      contextFacts: [contextFact("external-high", "SWING_HIGH", "2026-09-24T08:10:00Z")],
      regime: "BREAKOUT",
      evaluatedAt: doji.knownAt,
      rule: {
        ruleId: "doji-mean-reversion-only:v1",
        patternConcepts: ["DOJI"],
        allowedRegimes: ["MEAN_REVERTING", "EXHAUSTION"],
        requiredContextGroups: [["SWING_HIGH", "SWING_LOW"]],
        allowedScales: ["EXTERNAL"],
        maxContextAgeMs: 60 * 60 * 1000,
      },
    });

    expect(assessment.status).toBe("OUT_OF_CONTEXT");
    expect(assessment.reasons).toContain("REGIME_NOT_ALLOWED");
  });

  it("detects bullish engulfing and three-white-soldiers morphology without assigning outcome probability", () => {
    const facts = detectCandlestickMorphology("M5", [
      bar("a", 1.1006, 1.1008, 1.0998, 1.1000, 0),
      bar("b", 1.0998, 1.1012, 1.0996, 1.1010, 1),
      bar("c", 1.1005, 1.1020, 1.1004, 1.1018, 2),
      bar("d", 1.1012, 1.1030, 1.1011, 1.1028, 3),
    ], candleDef);

    expect(facts.some(item => item.concept === "BULLISH_ENGULFING")).toBe(true);
    expect(facts.some(item => item.concept === "THREE_WHITE_SOLDIERS")).toBe(true);
    expect(facts.every(item => item.authorityEffect === "NONE")).toBe(true);
  });

  it("builds trendline geometry only from two confirmed same-scale pivots", () => {
    const first = contextFact("low-1", "SWING_LOW", "2026-09-24T08:05:01Z");
    const second = {
      ...contextFact("low-2", "SWING_LOW", "2026-09-24T08:20:01Z"),
      geometry: { type: "POINT", time: "2026-09-24T08:20:00Z", price: 1.1010 } as const,
    };
    const anchoredFirst = {
      ...first,
      geometry: { type: "POINT", time: "2026-09-24T08:05:00Z", price: 1.1000 } as const,
    };

    const line = buildTrendlineFromPivots(anchoredFirst, second, {
      definitionId: "trendline:two-pivot:v1",
      minimumAnchorSeparationMs: 10 * 60 * 1000,
    });

    expect(line?.concept).toBe("TRENDLINE_SUPPORT");
    expect(line?.geometry.type).toBe("PATH");
    expect(line?.authorityEffect).toBe("NONE");
  });

  it("refuses arbitrary cross-type anchors for a trendline", () => {
    const high = {
      ...contextFact("high", "SWING_HIGH", "2026-09-24T08:05:01Z"),
      geometry: { type: "POINT", time: "2026-09-24T08:05:00Z", price: 1.1050 } as const,
    };
    const low = {
      ...contextFact("low", "SWING_LOW", "2026-09-24T08:20:01Z"),
      geometry: { type: "POINT", time: "2026-09-24T08:20:00Z", price: 1.1000 } as const,
    };

    expect(buildTrendlineFromPivots(high, low, {
      definitionId: "trendline:v1",
      minimumAnchorSeparationMs: 0,
    })).toBeNull();
  });
});
