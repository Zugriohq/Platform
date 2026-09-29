import { describe, expect, it } from "vitest";
import {
  buildResearchMarketMap,
  deriveConfirmedTrendlines,
  deriveTrendlineInteractions,
  detectConfirmedPivots,
  projectMarketMapToChartScene,
  type ResearchStructureBar,
} from "../src/index.js";

// Round 4: an in-progress (INCOMPLETE) observation followed by its final
// FRESH_COMPLETE bar under the same sourceBarId, through the complete research chain.

const t=(m:number)=>new Date(Date.UTC(2026,8,24,8,0,0)+m*60000).toISOString();
const k=(m:number)=>new Date(Date.UTC(2026,8,24,8,0,1)+m*60000).toISOString();
function bar(id:string,m:number,km:number,o:number,h:number,l:number,c:number,
  dataStatus:ResearchStructureBar["dataStatus"]="FRESH_COMPLETE",evidenceId=`ev:${id}`):ResearchStructureBar{
  return {evidenceId,sourceBarId:id,open:o,high:h,low:l,close:c,sourceClosedAt:t(m),knownAt:k(km),dataStatus};
}
const pivotDefs=[{definitionId:"r4:pivot:1x1:v1",scale:"EXTERNAL" as const,leftBars:1,rightBars:1}];
const derivation={definitionId:"r4:tl:v1",pairing:"ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS",
  minimumAnchorSeparationMs:0,anchorTolerance:0.0001,allowedScales:["EXTERNAL"]} as const;
const interaction={definitionId:"r4:tli:v1",touchTolerance:0.00005,penetrationBuffer:0.0001,
  closeBreakBuffer:0.0001,breakRule:"CLOSE_BEYOND"} as const;

/** Alternating lows every 5 minutes on a rising support line; one bar closes every 5 minutes. */
function feed():ResearchStructureBar[]{
  const out:ResearchStructureBar[]=[];
  for(let i=0;i<12;i+=1){
    const m=5*(i+1);
    const base=1.1+0.0001*m;
    const low=i%2===1?base:base+0.0005;
    out.push(bar(`b${i}`,m,m,low+0.0003,low+0.0008,low,low+0.0004));
  }
  return out;
}

function frame(bars:readonly ResearchStructureBar[],atMinute:number){
  const at=k(atMinute);
  const known=bars.filter(b=>Date.parse(b.knownAt)<=Date.parse(at));
  const pivots=detectConfirmedPivots("M5",known,pivotDefs);
  const lines=deriveConfirmedTrendlines({evaluatedAt:at,pivots,definition:derivation});
  const interactions=lines.flatMap(line=>deriveTrendlineInteractions({evaluatedAt:at,trendline:line,bars:known,definition:interaction}));
  const map=buildResearchMarketMap({mapId:"r4",instrument:"EURUSD",timeframe:"M5",evaluatedAt:at,regime:null,
    facts:[...lines,...interactions],strategyLens:{strategyId:"s",version:"1"} as never});
  return {pivots,lines,interactions,scene:projectMarketMapToChartScene(map)};
}

describe("ADV round 4: in-progress snapshot → final bar through the full chain",()=>{
  // b5 is the pivot bar (low) of the third trendline anchor; b6 confirms it.
  // A progress snapshot of b6 is observed at minute 32, and the final b6 only at minute 45.
  const base=feed();
  const final=base.find(b=>b.sourceBarId==="b6")!;
  const delayedFinal={...final,knownAt:k(45)};
  const snapshot=bar("b6",35,32,final.open,final.open+0.0002,final.open-0.0001,final.open+0.0001,"INCOMPLETE","ev:b6:partial");
  const withTransition=[...base.filter(b=>b.sourceBarId!=="b6"),snapshot,delayedFinal];
  const withoutSnapshot=[...base.filter(b=>b.sourceBarId!=="b6"),delayedFinal];
  const onlySnapshotEver=[...base.filter(b=>b.sourceBarId!=="b6"),snapshot];

  it("R4-1 a later valid frame does not crash when both lifecycle snapshots are known, and equals the final-only frame",()=>{
    const later=frame(withTransition,200);
    expect(later.lines.length).toBeGreaterThan(0);
    expect(later.scene.primitives.some(p=>p.concept==="TRENDLINE_SUPPORT")).toBe(true);
    expect(later).toEqual(frame(withoutSnapshot,200));
  });

  it("R4-2 no pivot that depends on b6 is visible before the final b6 is known",()=>{
    for(let m=0;m<=200;m+=1){
      const f=frame(withTransition,m);
      for(const p of f.pivots){
        expect(Date.parse(p.knownAt)).toBeLessThanOrEqual(Date.parse(k(m)));
        if(p.sourceEvidenceIds.includes("ev:b6")) expect(Date.parse(p.knownAt)).toBeGreaterThanOrEqual(Date.parse(k(45)));
        expect(p.sourceEvidenceIds).not.toContain("ev:b6:partial");
      }
      for(const primitive of f.scene.primitives){
        expect(Date.parse(primitive.knownAt)).toBeLessThanOrEqual(Date.parse(k(m)));
        expect(primitive.sourceEvidenceIds).not.toContain("ev:b6:partial");
      }
    }
  });

  it("R4-3 the transition never alters an already-rendered earlier frame",()=>{
    // Every fact and chart primitive rendered at any minute survives, identically, in every later minute.
    let previous=frame(withTransition,0);
    for(let m=1;m<=200;m+=1){
      const current=frame(withTransition,m);
      for(const p of previous.pivots) expect(current.pivots).toContainEqual(p);
      for(const l of previous.lines) expect(current.lines).toContainEqual(l);
      for(const i of previous.interactions) expect(current.interactions).toContainEqual(i);
      for(const p of previous.scene.primitives) expect(current.scene.primitives).toContainEqual(p);
      previous=current;
    }
    // While only the snapshot is known, the snapshot blocks the windows it sits in exactly
    // as an unfinished bar always has; the frame is the one this pipeline already rendered.
    for(const m of [32,40,44]) expect(frame(withTransition,m)).toEqual(frame(onlySnapshotEver,m));
    // and the snapshot alone never confirms the pivot it would complete
    expect(frame(onlySnapshotEver,200).pivots.some(p=>p.sourceEvidenceIds.includes("ev:b6:partial"))).toBe(false);
  });

  it("R4-4 several progress snapshots of one bar are observations, not conflicting completed bars",()=>{
    const second={...snapshot,knownAt:k(38),high:snapshot.high+0.0001,evidenceId:"ev:b6:partial-2"};
    expect(frame([...withTransition,second],200)).toEqual(frame(withoutSnapshot,200));
    expect(frame([...onlySnapshotEver,second],40)).toEqual(frame(onlySnapshotEver,40));
  });

  it("R4-5 malformed non-final input known in the frame still fails closed; it is not discarded before validation",()=>{
    const malformedSnapshot={...snapshot,low:snapshot.high+0.001};
    expect(()=>detectConfirmedPivots("M5",[...base.filter(b=>b.sourceBarId!=="b6"),malformedSnapshot,final],pivotDefs)).toThrow();
    expect(()=>frame([...withTransition.filter(b=>b!==snapshot),malformedSnapshot],200)).toThrow();
    const malformedStale=bar("s1",200,200,1.2,1.19,1.21,1.2,"STALE");
    expect(()=>detectConfirmedPivots("M5",[...base,malformedStale],pivotDefs)).toThrow();
    // Known only in the future, it cannot affect an earlier frame.
    expect(frame([...withTransition.filter(b=>b!==snapshot),{...malformedSnapshot,knownAt:k(300)}],200))
      .toEqual(frame(withoutSnapshot,200));
  });

  it("R4-6 completed-bar integrity is unchanged: identical redelivery collapses, conflicting final versions fail closed",()=>{
    expect(detectConfirmedPivots("M5",[...base,final],pivotDefs)).toEqual(detectConfirmedPivots("M5",base,pivotDefs));
    expect(()=>detectConfirmedPivots("M5",[...base,{...final,low:final.low-0.001}],pivotDefs)).toThrow(/conflicting/);
    // same content, different knownAt is still a conflict (redelivery identity is out of scope here)
    expect(()=>detectConfirmedPivots("M5",[...base,{...final,knownAt:k(90)}],pivotDefs)).toThrow(/conflicting/);
    // a snapshot whose close time disagrees with its final bar is an identity conflict
    expect(()=>detectConfirmedPivots("M5",[...base,{...snapshot,sourceClosedAt:t(36)}],pivotDefs)).toThrow();
    // only INCOMPLETE is treated as a progress observation; STALE/GAP beside a final bar still fail closed
    expect(()=>detectConfirmedPivots("M5",[...base,{...snapshot,dataStatus:"STALE" as const,knownAt:k(50)}],pivotDefs)).toThrow();
    expect(()=>detectConfirmedPivots("M5",[...base,{...snapshot,dataStatus:"GAP" as const,knownAt:k(50)}],pivotDefs)).toThrow();
  });

  it("R4-7 a non-final bar with no final version still blocks every window it sits in",()=>{
    const stale={...base.find(b=>b.sourceBarId==="b5")!,dataStatus:"STALE" as const};
    const pivots=detectConfirmedPivots("M5",[...base.filter(b=>b.sourceBarId!=="b5"),stale],pivotDefs);
    for(const id of ["b4","b5","b6"]) expect(pivots.some(p=>p.factId.includes(`:${id}:`))).toBe(false);
  });
});
