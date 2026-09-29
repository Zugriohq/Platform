import { describe, it, expect } from "vitest";
import {
  detectConfirmedPivots, deriveConfirmedTrendlines, deriveTrendlineInteractions,
  buildResearchMarketMap, projectMarketMapToChartScene,
  type ResearchStructureBar, type ResearchMarketStructureFact,
} from "../src/index.js";

const T0=Date.UTC(2026,8,24,8,0,0), M=60000;
const iso=(ms:number)=>new Date(ms).toISOString();
const deriv={definitionId:"e2e:tl:v1",pairing:"ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS",minimumAnchorSeparationMs:10*M,anchorTolerance:0.0004,allowedScales:["EXTERNAL"]} as const;
const inter={definitionId:"e2e:tli:v1",touchTolerance:0.00005,penetrationBuffer:0.0001,closeBreakBuffer:0.0001,breakRule:"CLOSE_BEYOND"} as const;
const pdef=[{definitionId:"e2e:pivot:1x1:v1",scale:"EXTERNAL" as const,leftBars:1,rightBars:1}];

function frame(bars:ResearchStructureBar[],at:number){
  const known=bars.filter(b=>Date.parse(b.knownAt)<=at);
  const pivots=detectConfirmedPivots("M5",known,pdef);
  const lines=deriveConfirmedTrendlines({evaluatedAt:iso(at),pivots,definition:deriv});
  const inters=lines.flatMap(l=>deriveTrendlineInteractions({evaluatedAt:iso(at),trendline:l,bars:known,definition:inter}));
  const map=buildResearchMarketMap({mapId:"e2e",instrument:"EURUSD",timeframe:"M5",evaluatedAt:iso(at),regime:null,facts:[...lines,...inters],strategyLens:{strategyId:"s",version:"1"} as never});
  const scene=projectMarketMapToChartScene(map);
  return {pivots,lines,inters,scene};
}

function gen(seed:number,mode:"inorder"|"late"|"gap"|"incomplete"){
  let s=seed; const r=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};
  const bars:ResearchStructureBar[]=[]; let p=1.1;
  const trendSlope=(r()-0.5)*0.0002;
  for(let i=0;i<60;i+=1){
    const close=T0+(i+1)*5*M;
    const o=p; const c=Math.round((p+trendSlope+(r()-0.5)*0.0008)*1e5)/1e5;
    const h=Math.round((Math.max(o,c)+r()*0.0003)*1e5)/1e5; const l=Math.round((Math.min(o,c)-r()*0.0003)*1e5)/1e5;
    p=c;
    let knownAt=close+1000; let status:ResearchStructureBar["dataStatus"]="FRESH_COMPLETE";
    if(mode==="late"&&r()<0.12) knownAt=close+Math.floor(5+r()*40)*5*M;
    if(mode==="incomplete"&&r()<0.1) status="INCOMPLETE";
    if(mode==="gap"&&r()<0.08) continue;
    bars.push({evidenceId:`ev${i}`,sourceBarId:`b${i}`,open:o,high:h,low:l,close:c,sourceClosedAt:iso(close),knownAt:iso(knownAt),dataStatus:status});
  }
  return bars;
}

const key=(f:ResearchMarketStructureFact)=>f.factId;
function check(mode:"inorder"|"late"|"gap"|"incomplete",trials:number){
  const v={pivotRetract:0,pivotBackdate:0,lineRetract:0,lineChanged:0,lineBackdate:0,interRetract:0,interBackdate:0,lineRetractPivotsStable:0,sceneFuture:0,maturity:0,multiBreak:0,trialsWithLines:0,lines:0,inters:0};
  let trendViolNoPivotRetract=0;
  for(let t=0;t<trials;t+=1){
    const before={...v};
    const bars=gen(1000+t,mode);
    const times=[...new Set(bars.map(b=>Date.parse(b.knownAt)))].sort((a,b)=>a-b);
    const frames=times.map(at=>({at,...frame(bars,at)}));
    const fAt=new Map(frames.map(f=>[f.at,f]));
    let anyLines=false;
    for(let i=0;i<frames.length;i+=1){
      const f=frames[i]!;
      if(f.lines.length) anyLines=true;
      for(const p of f.scene.primitives){ if(Date.parse(p.knownAt)>f.at) v.sceneFuture++; if(p.concept.startsWith("TRENDLINE")&&p.maturity!=="RESEARCH_DERIVED") v.maturity++; }
      const breaksPerLine=new Map<string,number>(); for(const x of f.inters) if(x.concept==="TRENDLINE_BREAK"){const id=x.sourceFactIds![0]!;breaksPerLine.set(id,(breaksPerLine.get(id)??0)+1);} for(const n of breaksPerLine.values()) if(n>1) v.multiBreak++;
      // backdating: a fact claiming knownAt K must be present identically in the frame at K (or the latest frame <= K)
      const at=(K:number)=>{let best=frames[0]!; for(const g of frames) if(g.at<=K) best=g; return best;};
      for(const pv of f.pivots){ const g=at(Date.parse(pv.knownAt)); if(!g.pivots.some(x=>JSON.stringify(x)===JSON.stringify(pv))) v.pivotBackdate++; }
      for(const l of f.lines){ const g=at(Date.parse(l.knownAt)); if(!g.lines.some(x=>JSON.stringify(x)===JSON.stringify(l))) v.lineBackdate++; }
      for(const x of f.inters){ const g=at(Date.parse(x.knownAt)); if(!g.inters.some(y=>JSON.stringify(y)===JSON.stringify(x))) v.interBackdate++; }
      if(i===0) continue;
      const prev=frames[i-1]!;
      const pivotsStable=prev.pivots.every(pp=>f.pivots.some(x=>JSON.stringify(x)===JSON.stringify(pp)));
      for(const pp of prev.pivots) if(!f.pivots.some(x=>JSON.stringify(x)===JSON.stringify(pp))) v.pivotRetract++;
      for(const l of prev.lines){ const now=f.lines.find(x=>key(x)===key(l)); if(!now){v.lineRetract++; if(pivotsStable) v.lineRetractPivotsStable++;} else if(JSON.stringify(now)!==JSON.stringify(l)) v.lineChanged++; }
      for(const x of prev.inters) if(!f.inters.some(y=>JSON.stringify(y)===JSON.stringify(x))) v.interRetract++;
      void fAt;
    }
    const d=(k:keyof typeof v)=>v[k]-before[k];
    if(d('pivotRetract')===0&&(d('lineRetract')+d('lineChanged')+d('lineBackdate')+d('interRetract')+d('interBackdate'))>0) trendViolNoPivotRetract++;
    if(anyLines) v.trialsWithLines++;
    v.lines+=frames.at(-1)!.lines.length; v.inters+=frames.at(-1)!.inters.length;
  }
  return {...v,trendViolNoPivotRetract};
}

describe("E2E causal chain: bars -> pivots -> trendlines -> interactions -> chart scene",()=>{
  it("in-order, gapped and incomplete feeds: zero retraction, backdating, future facts, maturity promotion or double breaks",{timeout:120000},()=>{
    for(const mode of ["inorder","gap","incomplete"] as const){
      const v=check(mode,15);
      expect(v.trialsWithLines).toBeGreaterThan(10);
      for(const [name,count] of Object.entries(v)){
        if(["trialsWithLines","lines","inters"].includes(name)) continue;
        expect({mode,name,count}).toEqual({mode,name,count:0});
      }
    }
  });

  it("late-arriving bars: pivots are never backdated, and trendline-layer drift only follows upstream pivot retraction",{timeout:120000},()=>{
    const v=check("late",15);
    expect(v.pivotBackdate).toBe(0);
    expect(v.lineRetractPivotsStable).toBe(0);
    expect(v.trendViolNoPivotRetract).toBe(0);
    expect(v.sceneFuture).toBe(0);
    expect(v.maturity).toBe(0);
    expect(v.multiBreak).toBe(0);
  });
});
