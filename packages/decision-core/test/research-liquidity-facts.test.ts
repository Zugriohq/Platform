import { describe, expect, it } from "vitest";
import {
  deriveEqualLiquidityLevels,
  deriveLiquiditySweeps,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
} from "../src/index.js";

function pivot(
  id:string,
  concept:"SWING_HIGH"|"SWING_LOW",
  price:number,
  sourceTime:string,
  knownAt:string,
): ResearchMarketStructureFact {
  return {
    factId:id,
    concept,
    maturity:"DETERMINISTIC_FACT",
    scale:"EXTERNAL",
    timeframe:"M5",
    side:concept==="SWING_HIGH"?"SELL":"BUY",
    knownAt,
    definitionId:"pivot:fixture:v1",
    sourceEvidenceIds:[`evidence:${id}`],
    geometry:{type:"POINT",time:sourceTime,price},
    label:concept.replaceAll("_"," "),
    authority:"RESEARCH_ONLY",
    authorityEffect:"NONE",
  };
}

function bar(
  id:string,
  sourceClosedAt:string,
  knownAt:string,
  high:number,
  low:number,
  close:number,
  dataStatus:ResearchStructureBar["dataStatus"]="FRESH_COMPLETE",
):ResearchStructureBar{
  return {
    evidenceId:`evidence:${id}`,
    sourceBarId:id,
    open:(high+low)/2,
    high,low,close,
    sourceClosedAt,knownAt,dataStatus,
  };
}

const equalDefinition={
  definitionId:"equal-liquidity:fixture:v1",
  tolerance:0.0002,
  pairing:"ADJACENT_CONFIRMED_PIVOTS",
} as const;

describe("research equal-liquidity and sweep derivation",()=>{
  it("does not emit equal highs until the second confirmed pivot is knowable",()=>{
    const first=pivot("h1","SWING_HIGH",1.1000,"2026-09-24T08:00:00Z","2026-09-24T08:05:01Z");
    const second=pivot("h2","SWING_HIGH",1.1001,"2026-09-24T08:15:00Z","2026-09-24T08:20:01Z");

    expect(deriveEqualLiquidityLevels({
      evaluatedAt:"2026-09-24T08:10:00Z",
      pivots:[first,second],
      definition:equalDefinition,
    })).toEqual([]);

    const levels=deriveEqualLiquidityLevels({
      evaluatedAt:"2026-09-24T08:20:01Z",
      pivots:[first,second],
      definition:equalDefinition,
    });
    expect(levels).toHaveLength(1);
    expect(levels[0]?.concept).toBe("EQUAL_HIGHS");
    expect(levels[0]?.knownAt).toBe(second.knownAt);
  });

  it("keeps tolerance profile-owned instead of hard-coding equal levels",()=>{
    const first=pivot("h1","SWING_HIGH",1.1000,"2026-09-24T08:00:00Z","2026-09-24T08:05:01Z");
    const second=pivot("h2","SWING_HIGH",1.1003,"2026-09-24T08:15:00Z","2026-09-24T08:20:01Z");

    expect(deriveEqualLiquidityLevels({
      evaluatedAt:"2026-09-24T08:20:01Z",
      pivots:[first,second],
      definition:{...equalDefinition,tolerance:0.0001},
    })).toEqual([]);

    expect(deriveEqualLiquidityLevels({
      evaluatedAt:"2026-09-24T08:20:01Z",
      pivots:[first,second],
      definition:{...equalDefinition,definitionId:"equal-liquidity:wider:v2",tolerance:0.0004},
    })).toHaveLength(1);
  });

  it("derives equal lows independently from equal highs",()=>{
    const levels=deriveEqualLiquidityLevels({
      evaluatedAt:"2026-09-24T08:20:01Z",
      pivots:[
        pivot("l1","SWING_LOW",1.0900,"2026-09-24T08:00:00Z","2026-09-24T08:05:01Z"),
        pivot("l2","SWING_LOW",1.0901,"2026-09-24T08:15:00Z","2026-09-24T08:20:01Z"),
      ],
      definition:equalDefinition,
    });
    expect(levels[0]?.concept).toBe("EQUAL_LOWS");
  });

  it("does not emit a sweep before the later closed reclaim bar is knowable",()=>{
    const levels=deriveEqualLiquidityLevels({
      evaluatedAt:"2026-09-24T08:20:01Z",
      pivots:[
        pivot("h1","SWING_HIGH",1.1000,"2026-09-24T08:00:00Z","2026-09-24T08:05:01Z"),
        pivot("h2","SWING_HIGH",1.1001,"2026-09-24T08:15:00Z","2026-09-24T08:20:01Z"),
      ],
      definition:equalDefinition,
    });

    const sweepBar=bar(
      "sweep",
      "2026-09-24T08:25:00Z",
      "2026-09-24T08:25:01Z",
      1.1005,1.0994,1.1000,
    );

    expect(deriveLiquiditySweeps({
      evaluatedAt:"2026-09-24T08:24:59Z",
      levels,
      bars:[sweepBar],
      definition:{definitionId:"sweep:v1",penetrationTolerance:0.0001},
    })).toEqual([]);

    const sweeps=deriveLiquiditySweeps({
      evaluatedAt:"2026-09-24T08:25:01Z",
      levels,
      bars:[sweepBar],
      definition:{definitionId:"sweep:v1",penetrationTolerance:0.0001},
    });
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]?.concept).toBe("LIQUIDITY_SWEEP");
    expect(sweeps[0]?.label).toBe("HIGH SWEEP / RECLAIM");
  });

  it("fails closed on non-fresh sweep bars",()=>{
    const level:ResearchMarketStructureFact={
      factId:"eqh",
      concept:"EQUAL_HIGHS",
      maturity:"DETERMINISTIC_FACT",
      scale:"EXTERNAL",
      timeframe:"M5",
      side:"SELL",
      knownAt:"2026-09-24T08:20:01Z",
      definitionId:"eqh:v1",
      sourceEvidenceIds:["a","b"],
      geometry:{type:"ZONE",low:1.1000,high:1.1001},
      label:"EQUAL HIGHS",
      authority:"RESEARCH_ONLY",
      authorityEffect:"NONE",
    };

    for(const status of ["INCOMPLETE","STALE","GAP"] as const){
      expect(deriveLiquiditySweeps({
        evaluatedAt:"2026-09-24T08:25:01Z",
        levels:[level],
        bars:[bar("sweep","2026-09-24T08:25:00Z","2026-09-24T08:25:01Z",1.1005,1.0994,1.1000,status)],
        definition:{definitionId:"sweep:v1",penetrationTolerance:0.0001},
      })).toEqual([]);
    }
  });
});
