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

function activeState(levelFactId: string, knownAt = "2026-09-24T08:00:01Z") {
  return {
    levelFactId,
    status:"ACTIVE" as const,
    evidenceId:`level-state:${levelFactId}`,
    knownAt,
    policyRef:"level-state:v1",
  };
}

function detect(
  levelFact: ResearchMarketStructureFact,
  sourceBar: ResearchStructureBar,
  definition: ResearchStructuralBreakDefinition = closeBreak,
) {
  return detectStructuralBreak(levelFact, sourceBar, definition, activeState(levelFact.factId));
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
  it("rejects malformed source/level identities instead of emitting unstable break IDs", () => {
    const source = {
      ...bar("m5:bad-id",1.0995,1.1010,1.0990,1.1005),
      evidenceId:"",
    };
    expect(() => detect(
      level("high-bad-source","SWING_HIGH",1.1000),
      source,
      closeBreak,
    )).toThrow(/immutable evidenceId/);

    const malformedLevel = {
      ...level("high-bad-level","SWING_HIGH",1.1000),
      sourceEvidenceIds:[],
    };
    expect(() => detect(
      malformedLevel,
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    )).toThrow(/level identity\/provenance/);
  });

  it("rejects overlapping profile rules instead of letting array order decide break semantics", () => {
    const ambiguous: ResearchStructuralBreakDefinition = {
      ...closeBreak,
      eligibleLevels:[
        {concept:"SWING_HIGH",allowedDirections:["UP"],allowedScales:["EXTERNAL"]},
        {concept:"SWING_HIGH",allowedDirections:["DOWN"],allowedScales:["EXTERNAL"]},
      ],
    };
    expect(() => detect(
      level("high-ambiguous","SWING_HIGH",1.1000),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      ambiguous,
    )).toThrow(/ambiguous overlapping level rule/);
  });

  it("emits a stable neutral UP break against a known swing high", () => {
    const swingHigh = level("high-1","SWING_HIGH",1.1000);
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);

    const first = detect(swingHigh, source, closeBreak);
    const second = detect(swingHigh, source, closeBreak);

    expect(first.status).toBe("BREAK_OBSERVED");
    expect(first.events).toEqual(second.events);
    expect(first.events[0]?.direction).toBe("UP");
    expect(first.events[0]?.breakId).toContain("high-1:m5:0810:evidence:m5:0810:UP:CLOSE_BEYOND");
    expect(first.events[0]?.authorityEffect).toBe("NONE");
    expect(first.events[0]?.sourceBarEvidenceId).toBe(source.evidenceId);
    expect(first.events[0]?.levelStateEvidenceId).toBe(activeState(swingHigh.factId).evidenceId);
  });

  it("emits a stable neutral DOWN break against a known swing low", () => {
    const result = detect(
      level("low-1","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    );
    expect(result.events[0]?.direction).toBe("DOWN");
  });

  it("does not let an incomplete bar confirm a close-based break", () => {
    const result = detect(
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

  it("gives distinct immutable identities to evolving intrabar touch evidence", () => {
    const swingHigh = level("high-intrabar-identity","SWING_HIGH",1.1000);
    const early = bar(
      "m5:forming",
      1.0995,1.1005,1.0990,1.0997,
      "2026-09-24T08:06:00Z",
      "2026-09-24T08:10:00Z",
      "INCOMPLETE",
    );
    const later = {
      ...early,
      evidenceId:"evidence:m5:forming:update-2",
      high:1.1010,
      knownAt:"2026-09-24T08:07:00Z",
    };

    const first = detect(swingHigh, early, touchBreak).events[0]!;
    const second = detect(swingHigh, later, touchBreak).events[0]!;

    expect(first.sourceBarId).toBe(second.sourceBarId);
    expect(first.breakId).not.toBe(second.breakId);
    expect(first.observedPrice).not.toBe(second.observedPrice);
  });

  it("allows an explicit touch-based profile to observe a causal intrabar touch", () => {
    const result = detect(
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
    const result = detect(
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
    const result = detect(contaminated, source, closeBreak);
    expect(result.reasons).toContain("LEVEL_USES_BREAK_BAR_EVIDENCE");
  });

  it("does not re-break a consumed or invalidated level without a new active level identity", () => {
    const swingHigh = level("high-consumed","SWING_HIGH",1.1000);
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);

    for (const status of ["CONSUMED","INVALIDATED"] as const) {
      const result = detectStructuralBreak(
        swingHigh,
        source,
        closeBreak,
        {
          ...activeState(swingHigh.factId),
          status,
        },
      );
      expect(result.status).toBe("NO_BREAK");
      expect(result.reasons).toContain("LEVEL_NOT_ACTIVE");
    }

    const replacementLevel = level("high-new-identity","SWING_HIGH",1.1000);
    expect(detect(replacementLevel, source, closeBreak).status).toBe("BREAK_OBSERVED");
  });

  it("rejects a level-state fact that predates the level it describes", () => {
    const swingHigh = level("high-state-predates","SWING_HIGH",1.1000,"EXTERNAL","2026-09-24T08:02:00Z");
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);
    const result = detectStructuralBreak(
      swingHigh,
      source,
      closeBreak,
      activeState(swingHigh.factId, "2026-09-24T08:01:00Z"),
    );
    expect(result.reasons).toContain("LEVEL_STATE_PREDATES_LEVEL");
  });

  it("does not let the break bar also manufacture the level's active-state evidence", () => {
    const swingHigh = level("high-state-self","SWING_HIGH",1.1000);
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);
    const result = detectStructuralBreak(
      swingHigh,
      source,
      closeBreak,
      {
        ...activeState(swingHigh.factId),
        evidenceId:source.evidenceId,
      },
    );
    expect(result.reasons).toContain("LEVEL_USES_BREAK_BAR_EVIDENCE");
  });

  it("rejects level-state evidence that was not knowable before the break", () => {
    const swingHigh = level("high-state-future","SWING_HIGH",1.1000);
    const source = bar("m5:0810",1.0995,1.1010,1.0990,1.1005);
    const result = detectStructuralBreak(
      swingHigh,
      source,
      closeBreak,
      activeState(swingHigh.factId, "2026-09-24T08:10:00Z"),
    );
    expect(result.reasons).toContain("LEVEL_STATE_NOT_KNOWABLE_YET");
  });

  it("rejects level geometry that occurs after the level claims to be known", () => {
    const impossible = {
      ...level("future-geometry","SWING_HIGH",1.1000),
      geometry:{type:"POINT" as const,time:"2026-09-24T08:01:00Z",price:1.1000},
    };
    const result = detect(impossible, bar("m5:0810",1.0995,1.1010,1.0990,1.1005), closeBreak);
    expect(result.reasons).toContain("LEVEL_GEOMETRY_NOT_CAUSAL");
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
    const result = detect(trendline, bar("m5:0810",1.1,1.102,1.099,1.101), {
      ...closeBreak,
      eligibleLevels:[
        {concept:"TRENDLINE_RESISTANCE",allowedDirections:["UP"],allowedScales:["EXTERNAL"]},
      ],
    });
    expect(result.reasons).toContain("LEVEL_GEOMETRY_UNSUPPORTED");
  });

  it("allows prior bias to share legitimate level evidence without treating it as circular", () => {
    const swingHigh = level("high-shared-prior","SWING_HIGH",1.1000);
    const raw = detect(
      swingHigh,
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    ).events[0]!;

    const classified = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:swingHigh.sourceEvidenceIds[0]!,
        knownAt:"2026-09-24T07:59:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });

    expect(classified.status).toBe("CLASSIFIED");
    expect(classified.classification).toBe("BOS");
  });

  it("rejects prior bias that is manufactured from the break bar itself", () => {
    const raw = detect(
      level("high-circular-bias","SWING_HIGH",1.1000),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    ).events[0]!;

    const classified = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:raw.sourceBarEvidenceId,
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });

    expect(classified.status).toBe("UNCLASSIFIED_STRUCTURAL_BREAK");
    expect(classified.reasons).toContain("BIAS_USES_BREAK_BAR_EVIDENCE");
  });

  it("classifies continuation as BOS under an explicit vocabulary profile", () => {
    const raw = detect(
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

  it("classifies bearish continuation as BOS under the same explicit profile", () => {
    const raw = detect(
      level("low-1","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    ).events[0]!;

    const classified = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BEARISH",
        evidenceId:"bias-bear",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:bosProfile,
    });

    expect(classified.relation).toBe("CONTINUATION");
    expect(classified.classification).toBe("BOS");
    expect(classified.fact?.side).toBe("SELL");
  });

  it("classifies the same opposing raw break as CHoCH under one profile", () => {
    const raw = detect(
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
    const raw = detect(
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

  it("refuses classification before the raw break itself is knowable", () => {
    const raw = detect(
      level("high-future-classification","SWING_HIGH",1.1000),
      bar("m5:0810",1.0995,1.1010,1.0990,1.1005),
      closeBreak,
    ).events[0]!;

    const result = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      evaluatedAt:"2026-09-24T08:09:00Z",
      definition:bosProfile,
    });
    expect(result.reasons).toContain("BREAK_FROM_FUTURE");
  });

  it("rejects incomplete displacement provenance when a profile requires displacement", () => {
    const raw = detect(
      level("low-mss-provenance","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    ).events[0]!;

    expect(() => classifyStructuralBreak({
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
        evidenceId:"",
        knownAt:"2026-09-24T08:10:01Z",
        definitionId:"displacement:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:mssProfile,
    })).toThrow(/displacement evidence requires/);
  });

  it("requires directional displacement when the selected MSS profile requires displacement", () => {
    const raw = detect(
      level("low-mss-direction","SWING_LOW",1.1000),
      bar("m5:0810",1.1005,1.1010,1.0988,1.0995),
      closeBreak,
    ).events[0]!;

    const result = classifyStructuralBreak({
      breakEvent:raw,
      priorBias:{
        bias:"BULLISH",
        evidenceId:"bias-1",
        knownAt:"2026-09-24T08:05:00Z",
        definitionId:"bias:v1",
      },
      displacement:{
        present:true,
        direction:null,
        evidenceId:"displacement-undirected",
        knownAt:"2026-09-24T08:10:01Z",
        definitionId:"displacement:v1",
      },
      evaluatedAt:"2026-09-24T08:11:00Z",
      definition:mssProfile,
    });
    expect(result.reasons).toContain("DISPLACEMENT_DIRECTION_MISSING");
  });

  it("leaves a valid raw break unclassified when the profile has no rule for it", () => {
    const raw = detect(
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
    const internal = detect(
      level("internal-high","SWING_HIGH",1.1000,"INTERNAL"),
      source,
      closeBreak,
    ).events[0]!;
    const external = detect(
      level("external-high","SWING_HIGH",1.1010,"EXTERNAL"),
      source,
      closeBreak,
    ).events[0]!;

    expect(internal.scale).toBe("INTERNAL");
    expect(external.scale).toBe("EXTERNAL");
    expect(internal.breakId).not.toBe(external.breakId);
  });

  it("projects a classified structural break into the engine-owned chart scene", () => {
    const raw = detect(
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
