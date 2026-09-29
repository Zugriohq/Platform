import { describe, expect, it } from "vitest";
import {
  assessTrendlineInteraction,
  deriveConfirmedTrendlines,
  deriveTrendlineInteractions,
  trendlinePriceAt,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
} from "../src/index.js";

function pivot(id:string,concept:"SWING_LOW"|"SWING_HIGH",price:number,time:string,knownAt:string,
  extra:Partial<ResearchMarketStructureFact>={}):ResearchMarketStructureFact{
  return {factId:id,concept,maturity:"DETERMINISTIC_FACT",scale:"EXTERNAL",timeframe:"M5",
    side:concept==="SWING_LOW"?"BUY":"SELL",knownAt,definitionId:"pivot:fixture:v1",
    sourceEvidenceIds:[`evidence:${id}`],geometry:{type:"POINT",time,price},label:concept,
    authority:"RESEARCH_ONLY",authorityEffect:"NONE",...extra};
}
function bar(id:string,closedAt:string,knownAt:string,o:number,h:number,l:number,c:number,
  dataStatus:ResearchStructureBar["dataStatus"]="FRESH_COMPLETE"):ResearchStructureBar{
  return {evidenceId:`evidence:${id}`,sourceBarId:id,open:o,high:h,low:l,close:c,sourceClosedAt:closedAt,knownAt,dataStatus};
}
const derivation={definitionId:"tl:adv:v1",pairing:"ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS",
  minimumAnchorSeparationMs:0,anchorTolerance:0.00005,allowedScales:["EXTERNAL"]} as const;
const interaction={definitionId:"tli:adv:v1",touchTolerance:0.00005,penetrationBuffer:0.0001,
  closeBreakBuffer:0.0001,breakRule:"CLOSE_BEYOND"} as const;
const t=(m:number)=>new Date(Date.UTC(2026,8,24,8,0,0)+m*60000).toISOString();
const k=(m:number)=>new Date(Date.UTC(2026,8,24,8,0,1)+m*60000).toISOString();

describe("ADV trendline",()=>{
  it("ADV-1 late-arriving earlier pivot must not retract an already-known line",()=>{
    const A=pivot("A","SWING_LOW",1.1000,t(0),k(5));
    const B=pivot("B","SWING_LOW",1.1010,t(10),k(15));
    const C=pivot("C","SWING_LOW",1.1030,t(30),k(35));
    const D=pivot("D","SWING_LOW",1.1500,t(20),k(60)); // geometry between B and C, known late
    const early=deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,C,D],definition:derivation});
    const late=deriveConfirmedTrendlines({evaluatedAt:k(70),pivots:[A,B,C,D],definition:derivation});
    expect(early.map(f=>f.factId)).toHaveLength(1);
    for(const line of early) expect(late).toContainEqual(line);
  });

  it("ADV-2 randomized monotonic knowledge: earlier frames are subsets with identical geometry",()=>{
    let seed=7; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
    for(let trial=0;trial<200;trial+=1){
      const ps:ResearchMarketStructureFact[]=[];
      for(let i=0;i<7;i+=1){
        const time=i*14+Math.floor(rnd()*10);
        const lag=5+Math.floor(rnd()*40);
        ps.push(pivot(`p${trial}-${i}`,"SWING_LOW",1.1+Math.round(rnd()*4)*0.0005+time*0.00001,t(time),k(time+lag)));
      }
      const frames=[20,40,60,80,100,160].map(m=>deriveConfirmedTrendlines({evaluatedAt:k(m),pivots:ps,definition:{...derivation,anchorTolerance:0.01}}));
      for(let i=1;i<frames.length;i+=1) for(const line of frames[i-1]!) expect(frames[i]).toContainEqual(line);
    }
  });

  it("ADV-3 anchors 1 and 2 are exact; third anchor never alters earlier slope",()=>{
    const [line]=deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
      pivot("A","SWING_LOW",1.1000,t(0),k(5)),pivot("B","SWING_LOW",1.1010,t(10),k(15)),pivot("C","SWING_LOW",1.10204,t(20),k(25))]});
    if(!line||line.geometry.type!=="PATH") throw new Error("no line");
    expect(line.geometry.points.slice(0,2)).toEqual([{time:t(0),price:1.1},{time:t(10),price:1.101}]);
    expect(trendlinePriceAt(line,t(20))).toBeCloseTo(1.102,12);
    expect(line.geometry.points[2]!.price).toBeCloseTo(1.102,12);
  });

  it("ADV-4 tolerance edge is inclusive and immune to binary float noise",()=>{
    const mk=(third:number,tol:number)=>deriveConfirmedTrendlines({evaluatedAt:k(40),definition:{...derivation,anchorTolerance:tol},pivots:[
      pivot("A","SWING_LOW",1.1,t(0),k(5)),pivot("B","SWING_LOW",1.2,t(10),k(15)),pivot("C","SWING_LOW",third,t(20),k(25))]});
    expect(mk(1.3,0)).toHaveLength(1);              // exactly collinear, zero tolerance
    expect(mk(1.3005,0.0005)).toHaveLength(1);      // exactly on +tol
    expect(mk(1.2995,0.0005)).toHaveLength(1);      // exactly on -tol
    expect(mk(1.30051,0.0005)).toHaveLength(0);     // outside
  });

  it("ADV-5 duplicate anchor facts do not suppress or duplicate a line",()=>{
    const A=pivot("A","SWING_LOW",1.1000,t(0),k(5));const B=pivot("B","SWING_LOW",1.1010,t(10),k(15));const C=pivot("C","SWING_LOW",1.1020,t(20),k(25));
    const base=deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,C],definition:derivation});
    const reordered=Object.fromEntries(Object.entries(B).reverse()) as unknown as ResearchMarketStructureFact;
    const dup=deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,reordered,C,C],definition:derivation});
    expect(dup).toEqual(base);
  });

  it("ADV-6 conflicting duplicate pivot ids fail closed",()=>{
    const A=pivot("A","SWING_LOW",1.1000,t(0),k(5));const B=pivot("B","SWING_LOW",1.1010,t(10),k(15));const C=pivot("C","SWING_LOW",1.1020,t(20),k(25));
    expect(()=>deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,{...B,geometry:{type:"POINT",time:t(10),price:1.2}},C],definition:derivation})).toThrow();
  });

  it("ADV-7 non-causal pivot (geometry after knownAt) is never an anchor",()=>{
    const A=pivot("A","SWING_LOW",1.1000,t(0),k(5));const B=pivot("B","SWING_LOW",1.1010,t(10),k(15));
    const forged=pivot("C","SWING_LOW",1.1030,t(30),k(25));
    expect(deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,forged],definition:derivation})).toEqual([]);
  });

  it("ADV-8 mixed pivot definition versions are not paired",()=>{
    const A=pivot("A","SWING_LOW",1.1000,t(0),k(5));const B=pivot("B","SWING_LOW",1.1010,t(10),k(15),{definitionId:"pivot:fixture:v2"});const C=pivot("C","SWING_LOW",1.1020,t(20),k(25));
    expect(deriveConfirmedTrendlines({evaluatedAt:k(40),pivots:[A,B,C],definition:derivation})).toEqual([]);
  });

  const line=()=>deriveConfirmedTrendlines({evaluatedAt:k(40),definition:derivation,pivots:[
    pivot("A","SWING_LOW",1.1,t(0),k(5)),pivot("B","SWING_LOW",1.1,t(10),k(15)),pivot("C","SWING_LOW",1.1,t(20),k(25))]})[0]!;

  it("ADV-9 touch/penetration/break boundaries are exact at quantized prices",()=>{
    const L=line();
    const at=(l:number,c:number)=>assessTrendlineInteraction(L,bar("x",t(50),k(50),1.1010,1.1020,l,c),interaction).status;
    expect(at(1.0999,1.1005)).toBe("TOUCH");          // low exactly at line - penetrationBuffer → not beyond
    expect(at(1.09989,1.1005)).toBe("PENETRATION");
    expect(at(1.1000+0.00005,1.1005)).toBe("TOUCH");   // low exactly at +touchTolerance
    expect(at(1.10006,1.1005)).toBe("NO_INTERACTION");
    const brk=(c:number)=>assessTrendlineInteraction(L,bar("y",t(50),k(50),1.1005,1.1010,1.0980,c),interaction).status;
    expect(brk(1.0999)).toBe("PENETRATION");           // close exactly at line - closeBreakBuffer → not a break
    expect(brk(1.09989)).toBe("CLOSE_BREAK");
    expect(brk(1.1002)).toBe("PENETRATION");           // wick beyond, close back above: wick only
  });

  it("ADV-9b sloped-line boundaries are not flipped by float projection noise (support and resistance)",()=>{
    const mk=(concept:"SWING_LOW"|"SWING_HIGH")=>deriveConfirmedTrendlines({evaluatedAt:k(40),definition:{...derivation,anchorTolerance:0},pivots:[
      pivot("A",concept,1.1,t(0),k(5)),pivot("B",concept,1.2,t(10),k(15)),pivot("C",concept,1.3,t(20),k(25))]})[0]!;
    const S=mk("SWING_LOW"); const R=mk("SWING_HIGH");
    const cases:[number,number][]=[];
    for(let m=26;m<=39;m+=1) cases.push([m,Math.round((1.1+0.01*m)*1e5)/1e5]);
    for(const [m,line] of cases){
      const lowAtBuffer=Math.round((line-0.0001)*1e5)/1e5;
      const highAtBuffer=Math.round((line+0.0001)*1e5)/1e5;
      expect(assessTrendlineInteraction(S,bar(`s${m}`,t(m),k(m),line+0.0005,line+0.001,lowAtBuffer,line+0.0003),interaction).status).toBe("TOUCH");
      expect(assessTrendlineInteraction(S,bar(`sc${m}`,t(m),k(m),line+0.0005,line+0.001,lowAtBuffer-0.0001,lowAtBuffer),interaction).status).toBe("PENETRATION");
      expect(assessTrendlineInteraction(R,bar(`r${m}`,t(m),k(m),line-0.0005,highAtBuffer,line-0.001,line-0.0003),interaction).status).toBe("TOUCH");
      expect(assessTrendlineInteraction(R,bar(`rc${m}`,t(m),k(m),line-0.0005,highAtBuffer+0.0001,line-0.001,highAtBuffer),interaction).status).toBe("PENETRATION");
    }
  });

  it("ADV-10 out-of-order and duplicate bars: sorted, deduplicated, single break, nothing after termination",()=>{
    const L=line();
    const bars=[
      bar("b3",t(60),k(60),1.1005,1.1010,1.0980,1.0985),  // break
      bar("b1",t(50),k(50),1.1010,1.1020,1.1000,1.1015),  // touch
      bar("b4",t(65),k(65),1.0985,1.0990,1.0970,1.0975),  // repeated break
      bar("b2",t(55),k(55),1.1010,1.1020,1.0995,1.1012),  // penetration
      bar("b1",t(50),k(50),1.1010,1.1020,1.1000,1.1015),  // duplicate
      bar("b5",t(70),k(70),1.0990,1.1002,1.0990,1.1001),  // touch after termination
    ];
    const facts=deriveTrendlineInteractions({evaluatedAt:k(90),trendline:L,bars,definition:interaction});
    expect(facts.map(f=>f.concept)).toEqual(["TRENDLINE_TOUCH","TRENDLINE_PENETRATION","TRENDLINE_BREAK"]);
    expect(new Set(facts.map(f=>f.factId)).size).toBe(facts.length);
    for(const f of facts) expect(f.maturity).toBe("RESEARCH_DERIVED");
  });

  it("ADV-10b a late-arriving earlier bar cannot retract an already-known interaction or break",()=>{
    const L=line();
    const bars=[
      bar("b1",t(50),k(50),1.1010,1.1020,1.1000,1.1015),   // touch, known on time
      bar("b3",t(60),k(60),1.1005,1.1010,1.0980,1.0985),   // break, known on time
      bar("b2",t(55),k(80),1.1005,1.1010,1.0970,1.0975),   // break-shaped bar closed earlier but only known at k(80)
    ];
    const early=deriveTrendlineInteractions({evaluatedAt:k(70),trendline:L,bars,definition:interaction});
    const late=deriveTrendlineInteractions({evaluatedAt:k(90),trendline:L,bars,definition:interaction});
    expect(early.map(f=>f.concept)).toEqual(["TRENDLINE_TOUCH","TRENDLINE_BREAK"]);
    expect(late.slice(0,early.length)).toEqual(early);
    expect(late).toHaveLength(early.length); // line already terminated when b2 became known
  });

  it("ADV-10c randomized: interaction facts at an earlier frame are always a prefix of later frames",()=>{
    const L=line();
    let seed=11; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
    for(let trial=0;trial<200;trial+=1){
      const bars:ResearchStructureBar[]=[];
      for(let i=0;i<10;i+=1){
        const m=30+i*3; const lag=Math.floor(rnd()*20);
        const lo=1.0985+Math.round(rnd()*30)*0.0001; const hi=lo+0.0010; const c=lo+Math.round(rnd()*10)*0.0001;
        bars.push(bar(`t${trial}b${i}`,t(m),k(m+lag),Math.min(hi,lo+0.0005),hi,lo,c));
      }
      const frames=[40,50,60,70,80,120].map(m=>deriveTrendlineInteractions({evaluatedAt:k(m),trendline:L,bars,definition:interaction}));
      for(let i=1;i<frames.length;i+=1) expect(frames[i]!.slice(0,frames[i-1]!.length)).toEqual(frames[i-1]);
      for(const f of frames.at(-1)!) expect(f.maturity).toBe("RESEARCH_DERIVED");
      expect(frames.at(-1)!.filter(f=>f.concept==="TRENDLINE_BREAK").length).toBeLessThanOrEqual(1);
    }
  });

  it("ADV-15 a pivot not yet known at evaluatedAt is never used, even with earlier geometry",()=>{
    const A=pivot("A","SWING_LOW",1.1000,t(0),k(5));const B=pivot("B","SWING_LOW",1.1010,t(10),k(15));
    const C=pivot("C","SWING_LOW",1.1020,t(20),k(45)); // confirmed late
    expect(deriveConfirmedTrendlines({evaluatedAt:k(44),pivots:[A,B,C],definition:derivation})).toEqual([]);
    expect(deriveConfirmedTrendlines({evaluatedAt:k(45),pivots:[A,B,C],definition:derivation})[0]?.knownAt).toBe(k(45));
  });

  it("ADV-11 conflicting revision of the same source bar fails closed",()=>{
    const L=line();
    expect(()=>deriveTrendlineInteractions({evaluatedAt:k(90),trendline:L,definition:interaction,bars:[
      bar("b1",t(50),k(50),1.1010,1.1020,1.1000,1.1015),{...bar("b1",t(50),k(51),1.1010,1.1020,1.0900,1.0950),evidenceId:"evidence:b1-rev"}]})).toThrow();
  });

  it("ADV-12 stale/incomplete/gap bars never create or terminate lifecycle",()=>{
    const L=line();
    const facts=deriveTrendlineInteractions({evaluatedAt:k(90),trendline:L,definition:interaction,bars:[
      bar("s",t(50),k(50),1.1005,1.1010,1.0980,1.0985,"STALE"),bar("g",t(55),k(55),1.1005,1.1010,1.0980,1.0985,"GAP"),
      bar("i",t(60),k(59),1.1005,1.1010,1.0980,1.0985,"INCOMPLETE"),bar("f",t(65),k(65),1.1010,1.1020,1.1000,1.1015)]});
    expect(facts.map(f=>f.concept)).toEqual(["TRENDLINE_TOUCH"]);
  });

  it("ADV-13 forged trendline with geometry after its knownAt is rejected",()=>{
    const L=line();
    const forged={...L,knownAt:k(12)};
    expect(()=>assessTrendlineInteraction(forged,bar("x",t(50),k(50),1.1010,1.1020,1.1,1.1015),interaction)).toThrow();
  });

  it("ADV-14 promoted maturity on a trendline interaction is refused at projection",async()=>{
    const { projectMarketMapToChartScene, buildResearchMarketMap } = await import("../src/index.js");
    void buildResearchMarketMap;
    const L=line();
    const [fact]=deriveTrendlineInteractions({evaluatedAt:k(90),trendline:L,definition:interaction,bars:[bar("b1",t(50),k(50),1.1010,1.1020,1.1000,1.1015)]});
    const promoted={...fact!,maturity:"DETERMINISTIC_FACT" as const};
    const map={mapId:"m",instrument:"EURUSD",timeframe:"M5",evaluatedAt:k(90),strategyLens:{strategyId:"s",version:"1"},regime:null,facts:[promoted]} as never;
    expect(()=>projectMarketMapToChartScene(map)).toThrow();
  });
});
