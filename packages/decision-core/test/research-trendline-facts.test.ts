import { describe, expect, it } from "vitest";
import {
  assessTrendlineInteraction,
  buildResearchMarketMap,
  buildTrendlineCandidateFromPivots,
  confirmTrendlineWithPivot,
  deriveConfirmedTrendlines,
  deriveTrendlineInteractions,
  projectMarketMapToChartScene,
  trendlinePriceAt,
  type ResearchMarketStructureFact,
  type ResearchStrategyLens,
  type ResearchStructureBar,
} from "../src/index.js";

function pivot(
  id:string,
  concept:"SWING_LOW"|"SWING_HIGH",
  price:number,
  sourceClosedAt:string,
  knownAt:string,
  maturity:ResearchMarketStructureFact["maturity"]="DETERMINISTIC_FACT",
):ResearchMarketStructureFact{
  return {
    factId:id,
    concept,
    maturity,
    scale:"EXTERNAL",
    timeframe:"M5",
    side:concept==="SWING_LOW"?"BUY":"SELL",
    knownAt,
    definitionId:"pivot:fixture:v1",
    sourceEvidenceIds:[`evidence:${id}`],
    geometry:{type:"POINT",time:sourceClosedAt,price},
    label:concept.replaceAll("_"," "),
    authority:"RESEARCH_ONLY",
    authorityEffect:"NONE",
  };
}

function bar(
  id:string,
  sourceClosedAt:string,
  knownAt:string,
  open:number,
  high:number,
  low:number,
  close:number,
  dataStatus:ResearchStructureBar["dataStatus"]="FRESH_COMPLETE",
):ResearchStructureBar{
  return {
    evidenceId:`evidence:${id}`,
    sourceBarId:id,
    open,high,low,close,
    sourceClosedAt,knownAt,dataStatus,
  };
}

const derivation={
  definitionId:"trendline:fixture:v1",
  pairing:"ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS",
  minimumAnchorSeparationMs:5*60*1000,
  anchorTolerance:0.00005,
  allowedScales:["EXTERNAL"],
} as const;

const interaction={
  definitionId:"trendline-interaction:fixture:v1",
  touchTolerance:0.00005,
  penetrationBuffer:0.0001,
  closeBreakBuffer:0.0001,
  breakRule:"CLOSE_BEYOND",
} as const;

const supportPivots=[
  pivot("low-1","SWING_LOW",1.1000,"2026-09-24T08:00:00Z","2026-09-24T08:05:01Z"),
  pivot("low-2","SWING_LOW",1.1010,"2026-09-24T08:10:00Z","2026-09-24T08:15:01Z"),
  pivot("low-3","SWING_LOW",1.10202,"2026-09-24T08:20:00Z","2026-09-24T08:25:01Z"),
] as const;

describe("research trendline facts",()=>{
  it("does not emit a line before the third confirmed pivot is knowable",()=>{
    expect(deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:24:59Z",
      pivots:supportPivots,
      definition:derivation,
    })).toEqual([]);

    const lines=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      concept:"TRENDLINE_SUPPORT",
      maturity:"RESEARCH_DERIVED",
      knownAt:"2026-09-24T08:25:01Z",
      definitionId:"trendline:fixture:v1",
      sourceFactIds:["low-1","low-2","low-3"],
      authorityEffect:"NONE",
    });
  });

  it("keeps confirmed line geometry straight while third-pivot tolerance remains profile-owned",()=>{
    const [line]=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    expect(line?.geometry.type).toBe("PATH");
    if(!line||line.geometry.type!=="PATH") throw new Error("expected trendline path");

    expect(line.geometry.points[2]?.price).toBeCloseTo(1.1020,8);
    expect(line.geometry.points[2]?.price).not.toBe(supportPivots[2].geometry.type==="POINT"
      ? supportPivots[2].geometry.price
      : NaN);
    expect(trendlinePriceAt(line,"2026-09-24T08:30:00Z")).toBeCloseTo(1.1030,8);
  });

  it("enforces minimum separation across both gaps in the three-anchor sequence",()=>{
    const tooClose=[
      supportPivots[0],
      supportPivots[1],
      pivot("low-too-close","SWING_LOW",1.1012,"2026-09-24T08:11:00Z","2026-09-24T08:16:01Z"),
    ];
    expect(deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:20:01Z",
      pivots:tooClose,
      definition:derivation,
    })).toEqual([]);
  });

  it("rejects morphology/advisory swing facts as trendline anchors",()=>{
    const morphology=pivot(
      "low-morphology",
      "SWING_LOW",
      1.1010,
      "2026-09-24T08:10:00Z",
      "2026-09-24T08:15:01Z",
      "MORPHOLOGY_ONLY",
    );
    expect(buildTrendlineCandidateFromPivots(supportPivots[0],morphology,{
      definitionId:"candidate:v1",
      minimumAnchorSeparationMs:0,
    })).toBeNull();

    const candidate=buildTrendlineCandidateFromPivots(supportPivots[0],supportPivots[1],{
      definitionId:"candidate:v1",
      minimumAnchorSeparationMs:0,
    });
    expect(confirmTrendlineWithPivot(candidate!,morphology,{
      definitionId:"confirm:v1",
      anchorTolerance:1,
    })).toBeNull();
  });

  it("derives mirrored resistance geometry from confirmed highs",()=>{
    const highs=[
      pivot("high-1","SWING_HIGH",1.1100,"2026-09-24T08:00:00Z","2026-09-24T08:05:01Z"),
      pivot("high-2","SWING_HIGH",1.1090,"2026-09-24T08:10:00Z","2026-09-24T08:15:01Z"),
      pivot("high-3","SWING_HIGH",1.1080,"2026-09-24T08:20:00Z","2026-09-24T08:25:01Z"),
    ];
    const lines=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:highs,
      definition:derivation,
    });
    expect(lines[0]?.concept).toBe("TRENDLINE_RESISTANCE");
    expect(lines[0]?.side).toBe("SELL");
  });

  it("distinguishes touch, wick penetration and close-break without signal semantics",()=>{
    const [line]=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    expect(line).toBeDefined();

    const touch=assessTrendlineInteraction(line!,bar(
      "touch","2026-09-24T08:30:00Z","2026-09-24T08:30:01Z",
      1.1034,1.1040,1.10298,1.1035,
    ),interaction);
    expect(touch.status).toBe("TOUCH");
    expect(touch.fact?.concept).toBe("TRENDLINE_TOUCH");

    const penetration=assessTrendlineInteraction(line!,bar(
      "penetration","2026-09-24T08:35:00Z","2026-09-24T08:35:01Z",
      1.1038,1.1042,1.1032,1.10355,
    ),interaction);
    expect(penetration.status).toBe("PENETRATION");
    expect(penetration.fact?.concept).toBe("TRENDLINE_PENETRATION");

    const broken=assessTrendlineInteraction(line!,bar(
      "break","2026-09-24T08:40:00Z","2026-09-24T08:40:01Z",
      1.1040,1.1041,1.1034,1.1037,
    ),interaction);
    expect(broken.status).toBe("CLOSE_BREAK");
    expect(broken.fact).toMatchObject({
      concept:"TRENDLINE_BREAK",
      maturity:"RESEARCH_DERIVED",
      sourceFactIds:[line!.factId],
      authority:"RESEARCH_ONLY",
      authorityEffect:"NONE",
    });
  });

  it("fails closed on non-fresh interaction evidence and on bars that predate line knowledge",()=>{
    const [line]=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    for(const status of ["INCOMPLETE","STALE","GAP"] as const){
      expect(assessTrendlineInteraction(line!,bar(
        `bad-${status}`,
        "2026-09-24T08:30:00Z",
        "2026-09-24T08:30:01Z",
        1.1034,1.1040,1.1020,1.1022,status,
      ),interaction).status).toBe("NO_INTERACTION");
    }

    expect(assessTrendlineInteraction(line!,bar(
      "historical",
      "2026-09-24T08:22:00Z",
      "2026-09-24T08:30:01Z",
      1.1024,1.1030,1.1018,1.1020,
    ),interaction).status).toBe("NO_INTERACTION");
  });

  it("fails closed when interaction derivation is evaluated before the line itself is knowable",()=>{
    const [line]=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    expect(deriveTrendlineInteractions({
      evaluatedAt:"2026-09-24T08:20:01Z",
      trendline:line!,
      bars:[],
      definition:interaction,
    })).toEqual([]);
  });

  it("terminates chronological interaction derivation after the first close-break",()=>{
    const [line]=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    const facts=deriveTrendlineInteractions({
      evaluatedAt:"2026-09-24T08:45:01Z",
      trendline:line!,
      bars:[
        bar("touch","2026-09-24T08:30:00Z","2026-09-24T08:30:01Z",1.1034,1.1040,1.10298,1.1035),
        bar("break","2026-09-24T08:40:00Z","2026-09-24T08:40:01Z",1.1040,1.1041,1.1034,1.1037),
        bar("after","2026-09-24T08:45:00Z","2026-09-24T08:45:01Z",1.1041,1.1042,1.1030,1.1032),
      ],
      definition:interaction,
    });
    expect(facts.map(fact=>fact.concept)).toEqual(["TRENDLINE_TOUCH","TRENDLINE_BREAK"]);
  });

  it("projects engine-owned trendline geometry into the chart scene",()=>{
    const [line]=deriveConfirmedTrendlines({
      evaluatedAt:"2026-09-24T08:25:01Z",
      pivots:supportPivots,
      definition:derivation,
    });
    const touch=assessTrendlineInteraction(line!,bar(
      "touch","2026-09-24T08:30:00Z","2026-09-24T08:30:01Z",
      1.1034,1.1040,1.10298,1.1035,
    ),interaction).fact!;

    const lens:ResearchStrategyLens={
      strategyId:"trendline-fixture",
      version:"0.1.0",
      compatibleRegimes:["TRENDING"],
      requiredConcepts:[],
      optionalConcepts:["TRENDLINE_SUPPORT","TRENDLINE_TOUCH"],
      entryRouteFamilies:[],
      objectiveFamilies:[],
      invalidationPolicyRef:"fixture:none",
      authority:"RESEARCH_ONLY",
    };
    const map=buildResearchMarketMap({
      mapId:"map:trendline-fixture",
      instrument:"EURUSD",
      timeframe:"M5",
      evaluatedAt:"2026-09-24T08:30:01Z",
      regime:null,
      facts:[line!,touch],
      strategyLens:lens,
    });
    const scene=projectMarketMapToChartScene(map);
    expect(scene.primitives.find(item=>item.concept==="TRENDLINE_SUPPORT")).toMatchObject({
      layer:"STRUCTURE",
      sourceFactIds:[line!.factId,"low-1","low-2","low-3"],
      authorityEffect:"NONE",
    });
    expect(scene.primitives.find(item=>item.concept==="TRENDLINE_TOUCH")).toMatchObject({
      layer:"STRUCTURE",
      authorityEffect:"NONE",
    });
    expect(scene.liveCapitalAuthority).toBe(false);
  });
});
