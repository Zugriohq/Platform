import { describe, expect, it } from "vitest";
import {
  deriveConfirmedTrendlines,
  deriveTrendlineInteractions,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
} from "../src/index.js";

function pivot(id:string,concept:"SWING_LOW"|"SWING_HIGH",price:number,time:string,knownAt:string):ResearchMarketStructureFact{
  return {factId:id,concept,maturity:"DETERMINISTIC_FACT",scale:"EXTERNAL",timeframe:"M5",
    side:concept==="SWING_LOW"?"BUY":"SELL",knownAt,definitionId:"pivot:fixture:v1",
    sourceEvidenceIds:[`evidence:${id}`],geometry:{type:"POINT",time,price},label:concept,
    authority:"RESEARCH_ONLY",authorityEffect:"NONE"};
}
function bar(id:string,closedAt:string,knownAt:string,o:number,h:number,l:number,c:number,
  dataStatus:ResearchStructureBar["dataStatus"]="FRESH_COMPLETE",evidenceId=`evidence:${id}`):ResearchStructureBar{
  return {evidenceId,sourceBarId:id,open:o,high:h,low:l,close:c,sourceClosedAt:closedAt,knownAt,dataStatus};
}
const derivation={definitionId:"tl:r2:v1",pairing:"ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS",
  minimumAnchorSeparationMs:0,anchorTolerance:0.00005,allowedScales:["EXTERNAL"]} as const;
const interaction={definitionId:"tli:r2:v1",touchTolerance:0.00005,penetrationBuffer:0.0001,
  closeBreakBuffer:0.0001,breakRule:"CLOSE_BEYOND"} as const;
const t=(m:number)=>new Date(Date.UTC(2026,8,24,8,0,0)+m*60000).toISOString();
const k=(m:number)=>new Date(Date.UTC(2026,8,24,8,0,1)+m*60000).toISOString();

describe("ADV round 2",()=>{
  it("R2-1 a conflicting pivot revision known only in the future cannot affect an earlier frame",()=>{
    const A=pivot("A","SWING_LOW",1.1,t(0),k(5)),B=pivot("B","SWING_LOW",1.101,t(10),k(15)),C=pivot("C","SWING_LOW",1.102,t(20),k(25));
    const futureRevision={...B,knownAt:k(90),geometry:{type:"POINT" as const,time:t(10),price:1.2}};
    const early=deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,C,futureRevision],definition:derivation});
    expect(early).toEqual(deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,C],definition:derivation}));
    expect(early).toHaveLength(1);
  });

  it("R2-2 an INCOMPLETE in-progress snapshot sharing sourceBarId with its final bar is not a conflict",()=>{
    const [L]=deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
      pivot("A","SWING_LOW",1.1,t(0),k(5)),pivot("B","SWING_LOW",1.1,t(10),k(15)),pivot("C","SWING_LOW",1.1,t(20),k(25))]});
    const facts=deriveTrendlineInteractions({evaluatedAt:k(60),trendline:L!,definition:interaction,bars:[
      bar("b1",t(50),k(48),1.1010,1.1012,1.1008,1.1010,"INCOMPLETE","evidence:b1-partial"),
      bar("b1",t(50),k(50),1.1010,1.1020,1.0980,1.0985),
    ]});
    expect(facts.map(f=>f.concept)).toEqual(["TRENDLINE_BREAK"]);
  });

  it("R2-3 resistance close-break terminates lifecycle; later bars emit nothing",()=>{
    const [R]=deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
      pivot("A","SWING_HIGH",1.2,t(0),k(5)),pivot("B","SWING_HIGH",1.2,t(10),k(15)),pivot("C","SWING_HIGH",1.2,t(20),k(25))]});
    const facts=deriveTrendlineInteractions({evaluatedAt:k(90),trendline:R!,definition:interaction,bars:[
      bar("r1",t(50),k(50),1.1990,1.2000,1.1985,1.1995),   // touch
      bar("r2",t(55),k(55),1.1995,1.20008,1.1990,1.1998),  // wick above but not beyond penetration buffer -> touch
      bar("r3",t(60),k(60),1.1995,1.2015,1.1990,1.2012),   // close break up
      bar("r4",t(65),k(65),1.2012,1.2030,1.2010,1.2025),   // repeated break
      bar("r5",t(70),k(70),1.2005,1.2010,1.1995,1.2000),   // touch after termination
    ]});
    expect(facts.map(f=>f.concept)).toEqual(["TRENDLINE_TOUCH","TRENDLINE_TOUCH","TRENDLINE_BREAK"]);
    expect(facts.every(f=>f.side==="SELL"&&f.maturity==="RESEARCH_DERIVED"&&f.authorityEffect==="NONE")).toBe(true);
  });

  it("R2-4 interactions never carry knownAt later than evaluatedAt or earlier than the line",()=>{
    const [L]=deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
      pivot("A","SWING_LOW",1.1,t(0),k(5)),pivot("B","SWING_LOW",1.1,t(10),k(15)),pivot("C","SWING_LOW",1.1,t(20),k(25))]});
    const bars=[25,26,30,40].map(m=>bar(`x${m}`,t(m),k(m),1.1010,1.1020,1.1000,1.1015));
    const facts=deriveTrendlineInteractions({evaluatedAt:k(35),trendline:L!,definition:interaction,bars});
    for(const f of facts){
      expect(Date.parse(f.knownAt)).toBeLessThanOrEqual(Date.parse(k(35)));
      expect(Date.parse(f.knownAt)).toBeGreaterThan(Date.parse(L!.knownAt));
    }
    expect(facts.map(f=>f.factId.includes("x25"))).not.toContain(true); // bar closed before line knownAt
  });
});

describe("ADV round 2 integrity",()=>{
  it("R2-5 malformed known bars still fail closed even when not FRESH_COMPLETE",()=>{
    const [L]=deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
      pivot("A","SWING_LOW",1.1,t(0),k(5)),pivot("B","SWING_LOW",1.1,t(10),k(15)),pivot("C","SWING_LOW",1.1,t(20),k(25))]});
    expect(()=>deriveTrendlineInteractions({evaluatedAt:k(60),trendline:L!,definition:interaction,bars:[
      bar("bad",t(50),k(50),1.1010,1.1000,1.1020,1.1010,"STALE")]})).toThrow();
  });
});

describe("ADV round 2 line validation",()=>{
  it("R2-6 a forged or promoted line is rejected even when no bars are supplied",()=>{
    const [L]=deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
      pivot("A","SWING_LOW",1.1,t(0),k(5)),pivot("B","SWING_LOW",1.1,t(10),k(15)),pivot("C","SWING_LOW",1.1,t(20),k(25))]});
    expect(()=>deriveTrendlineInteractions({evaluatedAt:k(60),trendline:{...L!,maturity:"DETERMINISTIC_FACT"},bars:[],definition:interaction})).toThrow();
    expect(()=>deriveTrendlineInteractions({evaluatedAt:k(60),trendline:{...L!,knownAt:k(12)},bars:[],definition:interaction})).toThrow();
  });
});

describe("ADV round 3 pivot knowledge",()=>{
  it("R3-1 a pivot is never known before every bar in its window is known",async()=>{
    const { detectConfirmedPivots } = await import("../src/index.js");
    const bars=[
      bar("p0",t(5),k(200),1.1010,1.1015,1.1005,1.1010),  // left bar delivered late
      bar("p1",t(10),k(10),1.1005,1.1008,1.0990,1.1000),  // pivot low
      bar("p2",t(15),k(15),1.1000,1.1012,1.0998,1.1010),  // confirming bar
    ];
    const pivots=detectConfirmedPivots("M5",bars,[{definitionId:"piv:v1",scale:"EXTERNAL",leftBars:1,rightBars:1}]);
    const low=pivots.find(p=>p.concept==="SWING_LOW");
    expect(low?.knownAt).toBe(k(200));
  });
});
