import { describe, expect, it } from "vitest";
import {
  buildResearchMarketMap,
  classifyStructuralBreak,
  detectStructuralBreak,
  projectMarketMapToChartScene,
  type ResearchBreakClassificationDefinition,
  type ResearchMarketStructureFact,
  type ResearchStructuralBreakDefinition,
  type ResearchStructureBar,
  type ResearchStrategyLens,
} from "../src/index.js";

const closeBreak: ResearchStructuralBreakDefinition = {
  definitionId: "core-break:close:v1",
  mode: "CLOSE_BEYOND",
  tolerance: 0.0001,
  eligibleLevels: [
    { concept:"SWING_HIGH", allowedDirections:["UP"], allowedScales:["INTERNAL","INTERMEDIATE","EXTERNAL"] },
    { concept:"SWING_LOW", allowedDirections:["DOWN"], allowedScales:["INTERNAL","INTERMEDIATE","EXTERNAL"] },
    { concept:"RANGE_HIGH", allowedDirections:["UP"], allowedScales:[null,"EXTERNAL"] },
    { concept:"RANGE_LOW", allowedDirections:["DOWN"], allowedScales:[null,"EXTERNAL"] },
  ],
};

const touchBreak: ResearchStructuralBreakDefinition = {
  ...closeBreak,
  definitionId:"core-break:touch:v1",
  mode:"TOUCH_BEYOND",
};

const bosProfile: ResearchBreakClassificationDefinition = {
  definitionId:"structure-vocabulary:bos:v1",
  rules:[
    { relation:"CONTINUATION", classification:"BOS", eligibleScales:["INTERNAL","INTERMEDIATE","EXTERNAL"], requireDisplacement:false },
    { relation:"OPPOSITION", classification:"CHOCH", eligibleScales:["INTERNAL","INTERMEDIATE","EXTERNAL"], requireDisplacement:false },
  ],
};

const mssProfile: ResearchBreakClassificationDefinition = {
  definitionId:"structure-vocabulary:mss:v1",
  rules:[
    { relation:"CONTINUATION", classification:"BOS", eligibleScales:["INTERNAL","INTERMEDIATE","EXTERNAL"], requireDisplacement:false },
    { relation:"OPPOSITION", classification:"MSS", eligibleScales:["INTERNAL","INTERMEDIATE","EXTERNAL"], requireDisplacement:true },
  ],
};

const lens: ResearchStrategyLens = {
  strategyId:"zugrio-core-research",
  version:"0.1.0",
  compatibleRegimes:["TRENDING","BREAKOUT","EXPANSION"],
  requiredConcepts:["SWING_HIGH","SWING_LOW"],
  optionalConcepts:["BOS","CHOCH","MSS"],
  entryRouteFamilies:["BOS_RETEST","CHOCH_RETEST","MSS_RETEST"],
  objectiveFamilies:["NEAREST_CREDIBLE_STRUCTURE"],
  invalidationPolicyRef:"research:structure:v1",
  authority:"RESEARCH_ONLY",
};

function level(
  id: string,
  concept: "SWING_HIGH" | "SWING_LOW",
  price: number,
  scale: "INTERNAL" | "INTERMEDIATE" | "EXTERNAL" = "EXTERNAL",
  knownAt = "2026-09-24T08:00:00Z",
): ResearchMarketStructureFact {
  return {
    factId:id,
    concept,
    maturity:"DETERMINISTIC_FACT",
    scale,
    timeframe:"M5",
    side:concept === "SWING_HIGH" ? "SELL" : "BUY",
    knownAt,
    definitionId:"pivot:v1",
    sourceEvidenceIds:[`evidence:${id}`],
    geometry:{type:"POINT",time:"2026-09-24T07:55:00Z",price},
    label:id,
    authority:"RESEARCH_ONLY",
    authorityEffect:"NONE",
  };
}

function bar(
  id: string,
  open: number,
  high: number,
  low: number,
  close: number,
  knownAt = "2026-09-24T08:10:01Z",
  sourceClosedAt = "2026-09-24T08:10:00Z",
  dataStatus: ResearchStructureBar["dataStatus"] = "FRESH_COMPLETE",
): ResearchStructureBar {
  return {
    evidenceId:`evidence:${id}`,
    sourceBarId:id,
    open,high,low,close,
    sourceClosedAt,
    knownAt,
    dataStatus,
  };
}

describe("research structural-break derivation", () => {
  it("emits a stable neutral UP break against a known swing high", () => {
    const swingHigh = level("high-1","SWING_HIGH",1.1000);
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);

    const first = detectStructuralBreak(swingHigh, source, closeBreak);
    const second = detectStructuralBreak(swingHigh, source, closeBreak);

    expect(first.status).toBe("BREAK_OBSERVED");
    expect(first.events).toEqual(second.events);
    expect(first.events[0]?.direction).toBe("UP");
    expect(first.events[0]?.breakId).toContain("high-1:m5:0810:UP:CLOSE_BEYOND");
    expect(first.events[0]?.authorityEffect).toBe("NONE");
  });

  it("emits a stable neutral DOWN break against a known swing low", () => {
    const result = detectStructuralBreak(
      level("low-1","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    );
    expect(result.events[0]?.direction).toBe("DOWN");
  });

  it("does not let an incomplete bar confirm a close-based break", () => {
    const result = detectStructuralBreak(
      level("high-1","SWING_HIGH",1.1000),
      bar(
        "m5:forming",
        1.0995,1.1010,1.0990,1.1005,
        "2026-09-24T08:07:00Z",
        "2026-09-24T08:10:00Z",
        "INCOMPLETE",
      ),
      closeBreak,
    );
    expect(result.status).toBe("NO_BREAK");
    expect(result.reasons).toContain("BAR_NOT_CLOSED_FOR_CLOSE_BREAK");
  });

  it("allows an explicit touch-based profile to observe a causal intrabar touch", () => {
    const result = detectStructuralBreak(
      level("high-1","SWING_HIGH",1.1000),
      bar(
        "m5:forming",
        1.0995,1.1005,1.0990,1.0997,
        "2026-09-24T08:07:00Z",
        "2026-09-24T08:10:00Z",
        "INCOMPLETE",
      ),
      touchBreak,
    );
    expect(result.status).toBe("BREAK_OBSERVED");
    expect(result.events[0]?.mode).toBe("TOUCH_BEYOND");
    expect(result.events[0]?.knownAt).toBe("2026-09-24T08:07:00Z");
  });

  it("cannot break a level that was not knowable before the break observation", () => {
    const result = detectStructuralBreak(
      level("future-high","SWING_HIGH",1.1000,"EXTERNAL","2026-09-24T08:10:00Z"),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    );
    expect(result.status).toBe("NO_BREAK");
    expect(result.reasons).toContain("LEVEL_NOT_KNOWABLE_YET");
  });

  it("cannot use the break bar as evidence that created the level", () => {
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);
    const contaminated = {
      ...level("high-1","SWING_HIGH",1.1000),
      sourceEvidenceIds:[source.evidenceId],
    };
    const result = detectStructuralBreak(contaminated, source, closeBreak);
    expect(result.reasons).toContain("LEVEL_USES_BREAK_BAR_EVIDENCE");
  });

  it("does not invent projected trendline break geometry", () => {
    const trendline: ResearchMarketStructureFact = {
      ...level("trendline","SWING_HIGH",1.1000),
      concept:"TRENDLINE_RESISTANCE",
      geometry:{
        type:"PATH",
        points:[
          {time:"2026-09-24T07:30:00Z",price:1.0990},
          {time:"2026-09-24T08:00:00Z",price:1.1000},
        ],
      },
    };
    const result = detectStructuralBreak(trendline, bar("m5:0810",1.1,1.102,1.099,1.101), {
      ...closeBreak,
      eligibleLevels:[
        {concept:"TRENDLINE_RESISTANCE",allowedDirections:["UP"],allowedScales:["EXTERNAL"]},
      ],
    });
    expect(result.reasons).toContain("LEVEL_GEOMETRY_UNSUPPORTED");
  });

  it("classifies continuation as BOS under an explicit vocabulary profile", () => {
    const raw = detectStructuralBreak(
      level("high-1","SWING_HIGH",1.1000),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    ).events[0]!;

    const classified = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });

    expect(classified.status).toBe("CLASSIFIED");
    expect(classified.relation).toBe("CONTINUATION");
    expect(classified.classification).toBe("BOS");
    expect(classified.fact?.concept).toBe("BOS");
  });

  it("classifies the same opposing raw break as CHoCH under one profile", () => {
    const raw = detectStructuralBreak(
      level("low-1","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    ).events[0]!;

    const classified = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });

    expect(classified.relation).toBe("OPPOSITION");
    expect(classified.classification).toBe("CHOCH");
  });

  it("does not call the same opposing break MSS until that profile's displacement requirement is satisfied", () => {
    const raw = detectStructuralBreak(
      level("low-1","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    ).events[0]!;

    const withoutDisplacement = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:mssProfile,
    });
    expect(withoutDisplacement.status).toBe("UNCLASSIFIED_STRUCTURAL_BREAK");
    expect(withoutDisplacement.reasons).toContain("DISPLACEMENT_REQUIRED");

    const withDisplacement = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      displacement:{
        present:true,
        direction:"DOWN",
        evidenceId:"displacement-1",
        knownAt:"2026-09-24T08:10:01Z",
        definitionId:"displacement:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:mssProfile,
    });
    expect(withDisplacement.status).toBe("CLASSIFIED");
    expect(withDisplacement.classification).toBe("MSS");
  });

  it("leaves a valid raw break unclassified when the profile has no rule for it", () => {
    const raw = detectStructuralBreak(
      level("high-1","SWING_HIGH",1.1000),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    ).events[0]!;

    const result = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"NEUTRAL",
        evidenceId:"bias-neutral",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });

    expect(result.status).toBe("UNCLASSIFIED_STRUCTURAL_BREAK");
    expect(result.reasons).toContain("NO_PROFILE_RULE");
  });

  it("preserves internal/external structure as separate facts", () => {
    const source = bar("m5:0810",1.0995,1.1020,1.0990,1.1015);
    const internal = detectStructuralBreak(
      level("internal-high","SWING_HIGH",1.1000,"INTERNAL"),
      source,
      closeBreak,
    ).events[0]!;
    const external = detectStructuralBreak(
      level("external-high","SWING_HIGH",1.1010,"EXTERNAL"),
      source,
      closeBreak,
    ).events[0]!;

    expect(internal.scale).toBe("INTERNAL");
    expect(external.scale).toBe("EXTERNAL");
    expect(internal.breakId).not.toBe(external.breakId);
  });

  it("projects a classified structural break into the engine-owned chart scene", () => {
    const raw = detectStructuralBreak(
      level("high-1","SWING_HIGH",1.1000),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    ).events[0]!;
    const classified = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });
    const map = buildResearchMarketMap({
      mapId:"map-break",
      instrument:"EURUSD",
      timeframe:"M5",
      evaluatedAt:"2026-09-24T08:11:00Z",
      regime:null,
      facts:[classified.fact!],
      strategyLens:lens,
    });
    const scene = projectMarketMapToChartScene(map);
    const primitive = scene.primitives.find(item => item.concept === "BOS");

    expect(primitive?.layer).toBe("STRUCTURE");
    expect(primitive?.visibility).toBe("PRIMARY");
    expect(primitive?.sourceFactIds).toEqual([classified.fact?.factId]);
    expect(primitive?.authorityEffect).toBe("NONE");
  });
});
