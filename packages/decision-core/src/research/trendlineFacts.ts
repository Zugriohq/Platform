import {
  buildTrendlineCandidateFromPivots,
  confirmTrendlineWithPivot,
  validateResearchStructureBar,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
  type StructureScale,
} from "./marketMap.js";

export interface ResearchTrendlineDerivationDefinition {
  readonly definitionId: string;
  readonly pairing: "ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS";
  readonly minimumAnchorSeparationMs: number;
  readonly anchorTolerance: number;
  readonly allowedScales: readonly StructureScale[];
}

export interface ResearchTrendlineInteractionDefinition {
  readonly definitionId: string;
  readonly touchTolerance: number;
  readonly penetrationBuffer: number;
  readonly closeBreakBuffer: number;
  readonly breakRule: "CLOSE_BEYOND";
}

export interface ResearchTrendlineInteractionAssessment {
  readonly status: "NO_INTERACTION" | "TOUCH" | "PENETRATION" | "CLOSE_BREAK";
  readonly linePrice: number;
  readonly fact: ResearchMarketStructureFact | null;
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value:string,label:string):number{
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function validateNonNegative(value:number,label:string):void{
  if(!Number.isFinite(value)||value<0) throw new Error(`${label} must be finite and >= 0`);
}

function pointTime(fact:ResearchMarketStructureFact):number{
  if(fact.geometry.type!=="POINT") throw new Error(`trendline anchor must use POINT geometry: ${fact.factId}`);
  return epoch(fact.geometry.time,"pivot.geometry.time");
}

function validateDerivationDefinition(definition:ResearchTrendlineDerivationDefinition):void{
  if(!definition.definitionId) throw new Error("trendline derivation definitionId must be non-empty");
  if(definition.pairing!=="ADJACENT_SAME_SIDE_CONFIRMED_PIVOTS"){
    throw new Error("unsupported trendline pairing policy");
  }
  validateNonNegative(definition.minimumAnchorSeparationMs,"minimumAnchorSeparationMs");
  validateNonNegative(definition.anchorTolerance,"anchorTolerance");
  if(definition.allowedScales.length===0) throw new Error("trendline allowedScales must not be empty");
}

function validateInteractionDefinition(definition:ResearchTrendlineInteractionDefinition):void{
  if(!definition.definitionId) throw new Error("trendline interaction definitionId must be non-empty");
  validateNonNegative(definition.touchTolerance,"touchTolerance");
  validateNonNegative(definition.penetrationBuffer,"penetrationBuffer");
  validateNonNegative(definition.closeBreakBuffer,"closeBreakBuffer");
  if(definition.breakRule!=="CLOSE_BEYOND") throw new Error("unsupported trendline breakRule");
}

/**
 * Derives three-anchor trendlines from adjacent, already-confirmed deterministic
 * same-side pivots. Future pivots cannot improve an earlier evaluated frame.
 */
export function deriveConfirmedTrendlines(input:{
  readonly evaluatedAt:string;
  readonly pivots:readonly ResearchMarketStructureFact[];
  readonly definition:ResearchTrendlineDerivationDefinition;
}):readonly ResearchMarketStructureFact[]{
  validateDerivationDefinition(input.definition);
  const evaluatedAt=epoch(input.evaluatedAt,"evaluatedAt");

  const usable=input.pivots
    .filter(fact =>
      (fact.concept==="SWING_LOW"||fact.concept==="SWING_HIGH") &&
      fact.maturity==="DETERMINISTIC_FACT" &&
      fact.geometry.type==="POINT" &&
      fact.scale!==null &&
      input.definition.allowedScales.includes(fact.scale) &&
      epoch(fact.knownAt,"fact.knownAt")<=evaluatedAt
    )
    .sort((a,b)=>{
      const keyA=[a.timeframe,a.scale??"NONE",a.concept].join("|");
      const keyB=[b.timeframe,b.scale??"NONE",b.concept].join("|");
      if(keyA!==keyB) return keyA.localeCompare(keyB);
      const byTime=pointTime(a)-pointTime(b);
      return byTime!==0?byTime:a.factId.localeCompare(b.factId);
    });

  const groups=new Map<string,ResearchMarketStructureFact[]>();
  for(const fact of usable){
    const key=[fact.timeframe,fact.scale??"NONE",fact.concept].join("|");
    const group=groups.get(key)??[];
    group.push(fact);
    groups.set(key,group);
  }

  const facts:ResearchMarketStructureFact[]=[];
  const ids=new Set<string>();
  for(const group of groups.values()){
    for(let index=2;index<group.length;index+=1){
      const first=group[index-2];
      const second=group[index-1];
      const third=group[index];
      if(!first||!second||!third) continue;

      const candidate=buildTrendlineCandidateFromPivots(first,second,{
        definitionId:input.definition.definitionId,
        minimumAnchorSeparationMs:input.definition.minimumAnchorSeparationMs,
      });
      if(!candidate) continue;

      const confirmed=confirmTrendlineWithPivot(candidate,third,{
        definitionId:input.definition.definitionId,
        anchorTolerance:input.definition.anchorTolerance,
      });
      if(!confirmed||ids.has(confirmed.factId)) continue;
      ids.add(confirmed.factId);
      facts.push(confirmed);
    }
  }

  return facts.sort((a,b)=>{
    const byKnown=epoch(a.knownAt,"knownAt")-epoch(b.knownAt,"knownAt");
    return byKnown!==0?byKnown:a.factId.localeCompare(b.factId);
  });
}

export function trendlinePriceAt(
  trendline:ResearchMarketStructureFact,
  time:string,
):number{
  if(
    (trendline.concept!=="TRENDLINE_SUPPORT"&&trendline.concept!=="TRENDLINE_RESISTANCE") ||
    trendline.geometry.type!=="PATH" ||
    trendline.geometry.points.length<2
  ){
    throw new Error("trendlinePriceAt requires a trendline PATH fact with at least two points");
  }

  const first=trendline.geometry.points[0]!;
  const second=trendline.geometry.points[1]!;
  const firstTime=epoch(first.time,"trendline first point");
  const secondTime=epoch(second.time,"trendline second point");
  const target=epoch(time,"trendline target time");
  if(secondTime<=firstTime) throw new Error("trendline points must be strictly chronological");

  const slope=(second.price-first.price)/(secondTime-firstTime);
  return first.price+slope*(target-firstTime);
}

/**
 * Evaluates one later closed bar against an already-known trendline.
 *
 * PENETRATION is wick geometry only. CLOSE_BREAK requires a fresh completed
 * close beyond the profile-owned break buffer. Neither status is a trade signal.
 */
export function assessTrendlineInteraction(
  trendline:ResearchMarketStructureFact,
  bar:ResearchStructureBar,
  definition:ResearchTrendlineInteractionDefinition,
):ResearchTrendlineInteractionAssessment{
  validateInteractionDefinition(definition);
  validateResearchStructureBar(bar);

  if(
    trendline.concept!=="TRENDLINE_SUPPORT" &&
    trendline.concept!=="TRENDLINE_RESISTANCE"
  ) throw new Error("trendline interaction requires support/resistance trendline fact");
  if(trendline.geometry.type!=="PATH") throw new Error("trendline interaction requires PATH geometry");

  const linePrice=trendlinePriceAt(trendline,bar.sourceClosedAt);
  const none=():ResearchTrendlineInteractionAssessment=>({
    status:"NO_INTERACTION",
    linePrice,
    fact:null,
    authority:"RESEARCH_ONLY",
    liveCapitalAuthority:false,
  });

  if(bar.dataStatus!=="FRESH_COMPLETE") return none();

  const lineKnownAt=epoch(trendline.knownAt,"trendline.knownAt");
  const barClosedAt=epoch(bar.sourceClosedAt,"bar.sourceClosedAt");
  if(barClosedAt<=lineKnownAt||trendline.sourceEvidenceIds.includes(bar.evidenceId)) return none();

  const support=trendline.concept==="TRENDLINE_SUPPORT";
  const closeBreak=support
    ? bar.close<linePrice-definition.closeBreakBuffer
    : bar.close>linePrice+definition.closeBreakBuffer;
  const penetration=support
    ? bar.low<linePrice-definition.penetrationBuffer
    : bar.high>linePrice+definition.penetrationBuffer;
  const touch=support
    ? bar.low<=linePrice+definition.touchTolerance && bar.high>=linePrice-definition.touchTolerance
    : bar.high>=linePrice-definition.touchTolerance && bar.low<=linePrice+definition.touchTolerance;

  const status:ResearchTrendlineInteractionAssessment["status"]=
    closeBreak?"CLOSE_BREAK":penetration?"PENETRATION":touch?"TOUCH":"NO_INTERACTION";
  if(status==="NO_INTERACTION") return none();

  const concept=
    status==="CLOSE_BREAK"
      ?"TRENDLINE_BREAK"
      :status==="PENETRATION"
        ?"TRENDLINE_PENETRATION"
        :"TRENDLINE_TOUCH";
  const side=support?"BUY":"SELL";
  const label=`${support?"SUPPORT":"RESISTANCE"} ${status.replaceAll("_"," ")}`;

  return {
    status,
    linePrice,
    fact:{
      factId:`trendline-interaction:${definition.definitionId}:${trendline.factId}:${bar.sourceBarId}:${status}`,
      concept,
      maturity:"DETERMINISTIC_FACT",
      scale:trendline.scale,
      timeframe:trendline.timeframe,
      side,
      knownAt:bar.knownAt,
      definitionId:definition.definitionId,
      sourceEvidenceIds:[...new Set([...trendline.sourceEvidenceIds,bar.evidenceId])],
      geometry:{type:"POINT",time:bar.sourceClosedAt,price:linePrice},
      label,
      authority:"RESEARCH_ONLY",
      authorityEffect:"NONE",
    },
    authority:"RESEARCH_ONLY",
    liveCapitalAuthority:false,
  };
}

/**
 * Emits chronological interaction events and terminates the line lifecycle after
 * the first close-break. Repeated touches/penetrations remain historical facts.
 */
export function deriveTrendlineInteractions(input:{
  readonly evaluatedAt:string;
  readonly trendline:ResearchMarketStructureFact;
  readonly bars:readonly ResearchStructureBar[];
  readonly definition:ResearchTrendlineInteractionDefinition;
}):readonly ResearchMarketStructureFact[]{
  const evaluatedAt=epoch(input.evaluatedAt,"evaluatedAt");
  const bars=input.bars
    .filter(bar=>epoch(bar.knownAt,"bar.knownAt")<=evaluatedAt)
    .sort((a,b)=>{
      const byClose=epoch(a.sourceClosedAt,"sourceClosedAt")-epoch(b.sourceClosedAt,"sourceClosedAt");
      return byClose!==0?byClose:a.sourceBarId.localeCompare(b.sourceBarId);
    });

  const facts:ResearchMarketStructureFact[]=[];
  for(const bar of bars){
    const assessment=assessTrendlineInteraction(input.trendline,bar,input.definition);
    if(assessment.fact) facts.push(assessment.fact);
    if(assessment.status==="CLOSE_BREAK") break;
  }
  return facts;
}
