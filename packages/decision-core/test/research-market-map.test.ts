import { describe, expect, it } from "vitest";
import {
  buildResearchMarketMap,
  detectConfirmedPivots,
  detectLiquiditySweep,
  identifyEqualLevelPair,
  projectMarketMapToChartScene,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
  type ResearchStrategyLens,
} from "../src/index.js";

function bar(
  id: string,
  high: number,
  low: number,
  index: number,
  status: ResearchStructureBar["dataStatus"] = "FRESH_COMPLETE",
): ResearchStructureBar {
  const closedAt = new Date(Date.parse("2026-09-24T08:00:00Z") + index * 300_000).toISOString();
  return {
    evidenceId: `evidence:${id}`,
    sourceBarId: id,
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
    sourceClosedAt: closedAt,
    knownAt: new Date(Date.parse(closedAt) + 1_000).toISOString(),
    dataStatus: status,
  };
}

const lens: ResearchStrategyLens = {
  strategyId: "zugrio-core-research",
  version: "0.1.0",
  compatibleRegimes: ["TRENDING", "EXPANSION", "BREAKOUT", "MEAN_REVERTING", "COMPRESSION"],
  requiredConcepts: ["SWING_HIGH", "SWING_LOW"],
  optionalConcepts: ["EQUAL_HIGHS", "EQUAL_LOWS", "LIQUIDITY_SWEEP", "FVG", "MITIGATION"],
  entryRouteFamilies: ["BREAKOUT_CONTINUATION", "BREAKOUT_RETEST", "LIQUIDITY_SWEEP_REVERSAL", "FVG_MITIGATION"],
  objectiveFamilies: ["NEAREST_CREDIBLE_STRUCTURE", "OPPOSING_LIQUIDITY", "RANGE_BOUNDARY"],
  invalidationPolicyRef: "research:invalidation:v1",
  authority: "RESEARCH_ONLY",
};

describe("research market map", () => {
  it("confirms pivots causally only after the right-side bars are known", () => {
    const bars = [
      bar("0", 1.0, 0.8, 0),
      bar("1", 1.2, 0.9, 1),
      bar("2", 1.5, 1.0, 2),
      bar("3", 1.2, 0.9, 3),
      bar("4", 1.1, 0.8, 4),
    ];
    const facts = detectConfirmedPivots("M5", bars, [{
      definitionId: "external:2x2",
      scale: "EXTERNAL",
      leftBars: 2,
      rightBars: 2,
    }]);
    const high = facts.find(fact => fact.concept === "SWING_HIGH");
    expect(high?.geometry).toEqual({
      type: "POINT",
      time: bars[2]?.sourceClosedAt,
      price: 1.5,
    });
    expect(high?.knownAt).toBe(bars[4]?.knownAt);
  });

  it("uses rightmost-plateau semantics so equal highs do not erase the pivot", () => {
    const bars = [
      bar("0", 1.0, 0.8, 0),
      bar("1", 1.4, 0.9, 1),
      bar("2", 1.5, 1.0, 2),
      bar("3", 1.5, 1.0, 3),
      bar("4", 1.2, 0.9, 4),
      bar("5", 1.1, 0.8, 5),
    ];
    const facts = detectConfirmedPivots("M5", bars, [{
      definitionId: "internal:2x2",
      scale: "INTERNAL",
      leftBars: 2,
      rightBars: 2,
    }]);
    const highs = facts.filter(fact => fact.concept === "SWING_HIGH");
    expect(highs).toHaveLength(1);
    expect(highs[0]?.geometry).toMatchObject({
      type: "POINT",
      price: 1.5,
      time: bars[3]?.sourceClosedAt,
    });
  });

  it("does not confirm a pivot through incomplete data", () => {
    const bars = [
      bar("0", 1.0, 0.8, 0),
      bar("1", 1.2, 0.9, 1),
      bar("2", 1.5, 1.0, 2),
      bar("3", 1.2, 0.9, 3, "INCOMPLETE"),
      bar("4", 1.1, 0.8, 4),
    ];
    const facts = detectConfirmedPivots("M5", bars, [{
      definitionId: "external:2x2",
      scale: "EXTERNAL",
      leftBars: 2,
      rightBars: 2,
    }]);
    expect(facts).toHaveLength(0);
  });

  it("supports internal/intermediate/external structure as separate explicit definitions", () => {
    const bars = [
      bar("0", 1.0, 0.8, 0),
      bar("1", 1.2, 0.9, 1),
      bar("2", 1.5, 1.0, 2),
      bar("3", 1.2, 0.9, 3),
      bar("4", 1.1, 0.8, 4),
      bar("5", 1.0, 0.7, 5),
      bar("6", 1.1, 0.8, 6),
    ];
    const facts = detectConfirmedPivots("M5", bars, [
      { definitionId:"internal:1x1", scale:"INTERNAL", leftBars:1, rightBars:1 },
      { definitionId:"intermediate:2x2", scale:"INTERMEDIATE", leftBars:2, rightBars:2 },
      { definitionId:"external:2x2", scale:"EXTERNAL", leftBars:2, rightBars:2 },
    ]);
    expect(new Set(facts.map(fact => fact.scale))).toEqual(
      new Set(["INTERNAL", "INTERMEDIATE", "EXTERNAL"]),
    );
  });

  it("identifies equal highs only under an explicit tolerance definition", () => {
    const first: ResearchMarketStructureFact = {
      factId:"h1", concept:"SWING_HIGH", maturity:"DETERMINISTIC_FACT", scale:"EXTERNAL",
      timeframe:"M15", side:"SELL", knownAt:"2026-09-24T08:00:00Z",
      definitionId:"pivot:v1", sourceEvidenceIds:["a"],
      geometry:{type:"POINT",time:"2026-09-24T07:00:00Z",price:1.1000},
      label:"EXTERNAL SWING HIGH", authority:"RESEARCH_ONLY", authorityEffect:"NONE",
    };
    const second: ResearchMarketStructureFact = {
      ...first, factId:"h2", knownAt:"2026-09-24T09:00:00Z",
      sourceEvidenceIds:["b"], geometry:{type:"POINT",time:"2026-09-24T08:45:00Z",price:1.1003},
    };

    expect(identifyEqualLevelPair(first, second, {
      definitionId:"eqh:strict",
      tolerance:0.0001,
    })).toBeNull();

    const equal = identifyEqualLevelPair(first, second, {
      definitionId:"eqh:wider",
      tolerance:0.0004,
    });
    expect(equal?.concept).toBe("EQUAL_HIGHS");
    expect(equal?.geometry).toEqual({type:"ZONE",low:1.1,high:1.1003});

    expect(identifyEqualLevelPair(first, first, {
      definitionId:"eqh:no-self-pair",
      tolerance:0.0004,
    })).toBeNull();

    expect(identifyEqualLevelPair(first, {
      ...second,
      geometry:{...second.geometry, time:first.geometry.type === "POINT" ? first.geometry.time : "2026-09-24T07:00:00Z"},
    }, {
      definitionId:"eqh:no-same-pivot-time",
      tolerance:0.0004,
    })).toBeNull();
  });

  it("detects a sweep as wick penetration plus close reclaim, without claiming motive", () => {
    const level: ResearchMarketStructureFact = {
      factId:"eqh", concept:"EQUAL_HIGHS", maturity:"DETERMINISTIC_FACT", scale:"EXTERNAL",
      timeframe:"M5", side:"SELL", knownAt:"2026-09-24T08:00:00Z",
      definitionId:"eqh:v1", sourceEvidenceIds:["a","b"],
      geometry:{type:"ZONE",low:1.1,high:1.1002},
      label:"EQUAL HIGHS", authority:"RESEARCH_ONLY", authorityEffect:"NONE",
    };
    const sweep = detectLiquiditySweep(level, {
      ...bar("sweep",1.1010,1.0990,20),
      close:1.1001,
    }, {
      definitionId:"sweep:reclaim:v1",
      penetrationTolerance:0.0001,
    });
    expect(sweep?.concept).toBe("LIQUIDITY_SWEEP");
    expect(sweep?.label).toContain("SWEEP");
    expect(sweep?.authorityEffect).toBe("NONE");

    const hindsightLevel = { ...level, knownAt:"2026-09-24T10:00:00Z" };
    expect(detectLiquiditySweep(hindsightLevel, {
      ...bar("too-early-sweep",1.1010,1.0990,20),
      close:1.1001,
    }, {
      definitionId:"sweep:no-hindsight:v1",
      penetrationTolerance:0.0001,
    })).toBeNull();

    expect(detectLiquiditySweep({
      ...level,
      sourceEvidenceIds:["evidence:sweep"],
    }, {
      ...bar("sweep",1.1010,1.0990,20),
      close:1.1001,
    }, {
      definitionId:"sweep:no-self-evidence:v1",
      penetrationTolerance:0.0001,
    })).toBeNull();
  });

  it("projects engine facts into semantic chart primitives without letting the UI own analysis", () => {
    const elliott: ResearchMarketStructureFact = {
      factId:"wave-advisory", concept:"ELLIOTT_WAVE", maturity:"ADVISORY_ONLY", scale:"EXTERNAL",
      timeframe:"H1", side:"NEUTRAL", knownAt:"2026-09-24T08:00:00Z",
      definitionId:"elliott:research-only:v0", sourceEvidenceIds:["wave-source"],
      geometry:{type:"PATH",points:[
        {time:"2026-09-24T06:00:00Z",price:1.1},
        {time:"2026-09-24T07:00:00Z",price:1.11},
      ]},
      label:"ELLIOTT WAVE RESEARCH OVERLAY", authority:"RESEARCH_ONLY", authorityEffect:"NONE",
    };

    const map = buildResearchMarketMap({
      mapId:"map-1",
      instrument:"EURUSD",
      timeframe:"H1",
      evaluatedAt:"2026-09-24T09:00:00Z",
      regime:{
        regime:"TRENDING",
        knownAt:"2026-09-24T08:30:00Z",
        evidenceId:"regime-1",
        definitionId:"canonical-regime:v1",
      },
      facts:[elliott],
      strategyLens:lens,
    });

    const scene = projectMarketMapToChartScene(map);
    const wave = scene.primitives.find(primitive => primitive.concept === "ELLIOTT_WAVE");
    expect(wave?.layer).toBe("ADVISORY");
    expect(wave?.visibility).toBe("DETAIL");
    expect(wave?.authorityEffect).toBe("NONE");
    expect(scene.liveCapitalAuthority).toBe(false);
  });

  it("rejects future market-map facts instead of drawing hindsight", () => {
    const future: ResearchMarketStructureFact = {
      factId:"future", concept:"SWING_HIGH", maturity:"DETERMINISTIC_FACT", scale:"EXTERNAL",
      timeframe:"M5", side:"SELL", knownAt:"2026-09-24T10:00:00Z",
      definitionId:"pivot:v1", sourceEvidenceIds:["x"],
      geometry:{type:"POINT",time:"2026-09-24T09:55:00Z",price:1.2},
      label:"FUTURE", authority:"RESEARCH_ONLY", authorityEffect:"NONE",
    };

    expect(() => buildResearchMarketMap({
      mapId:"map-future",
      instrument:"EURUSD",
      timeframe:"M5",
      evaluatedAt:"2026-09-24T09:00:00Z",
      regime:null,
      facts:[future],
      strategyLens:lens,
    })).toThrow(/future market-map fact/);
  });
  it("rejects market-map point/path geometry that occurs after its claimed knownAt", () => {
    const futureGeometry: ResearchMarketStructureFact = {
      factId:"future-geometry", concept:"SWING_HIGH", maturity:"DETERMINISTIC_FACT", scale:"EXTERNAL",
      timeframe:"M5", side:"SELL", knownAt:"2026-09-24T09:00:00Z",
      definitionId:"pivot:v1", sourceEvidenceIds:["x"],
      geometry:{type:"POINT",time:"2026-09-24T09:05:00Z",price:1.2},
      label:"IMPOSSIBLE", authority:"RESEARCH_ONLY", authorityEffect:"NONE",
    };

    expect(() => buildResearchMarketMap({
      mapId:"map-impossible-geometry",
      instrument:"EURUSD",
      timeframe:"M5",
      evaluatedAt:"2026-09-24T09:10:00Z",
      regime:null,
      facts:[futureGeometry],
      strategyLens:lens,
    })).toThrow(/geometry cannot occur after fact knownAt/);
  });
});
