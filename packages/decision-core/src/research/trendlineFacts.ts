import {
  buildTrendlineCandidateFromPivots,
  confirmTrendlineWithPivot,
  priceComparisonSlack,
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

function canonicalJson(value:unknown):string{
  if(Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if(value!==null&&typeof value==="object"){
    const record=value as Record<string,unknown>;
    return `{${Object.keys(record).filter(key=>record[key]!==undefined).sort()
      .map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameJson(a:unknown,b:unknown):boolean{
  return canonicalJson(a)===canonicalJson(b);
}

/**
 * Identical re-deliveries of the same fact collapse to one; two different
 * payloads under one id are an evidence-integrity failure and fail closed.
 */
function dedupeById<T>(items:readonly T[],idOf:(item:T)=>string,label:string):readonly T[]{
  const byId=new Map<string,T>();
  for(const item of items){
    const id=idOf(item);
    const existing=byId.get(id);
    if(existing===undefined){ byId.set(id,item); continue; }
    if(!sameJson(existing,item)) throw new Error(`conflicting ${label} payloads share id: ${id}`);
  }
  return [...byId.values()];
}

function groupKey(fact:ResearchMarketStructureFact):string{
  // Pivot definition version is part of the key: anchors from different pivot
  // definitions (or versions) are never mixed into one line.
  return [fact.timeframe,fact.scale??"NONE",fact.concept,fact.definitionId].join("|");
}

/**
 * Derives three-anchor trendlines from already-confirmed deterministic same-side
 * pivots, point-in-time.
 *
 * Each confirming (third) pivot is paired with the two latest same-group pivots
 * whose geometry precedes it AND that were already known when the third pivot
 * became known. "Adjacent" therefore means adjacent in the knowledge state at the
 * moment of confirmation. This makes derivation monotonic in evaluatedAt: a pivot
 * that arrives late can create new lines, but can never retract or reshape a line
 * that an earlier frame already knew. The line is straight through anchors 1 and
 * 2; the third anchor only confirms it (its stored point is the projection).
 */
export function deriveConfirmedTrendlines(input:{
  readonly evaluatedAt:string;
  readonly pivots:readonly ResearchMarketStructureFact[];
  readonly definition:ResearchTrendlineDerivationDefinition;
}):readonly ResearchMarketStructureFact[]{
  validateDerivationDefinition(input.definition);
  const evaluatedAt=epoch(input.evaluatedAt,"evaluatedAt");

  const usable=dedupeById(input.pivots,fact=>fact.factId,"pivot fact")
    .filter(fact =>
      (fact.concept==="SWING_LOW"||fact.concept==="SWING_HIGH") &&
      fact.maturity==="DETERMINISTIC_FACT" &&
      fact.geometry.type==="POINT" &&
      fact.scale!==null &&
      input.definition.allowedScales.includes(fact.scale) &&
      epoch(fact.knownAt,"fact.knownAt")<=evaluatedAt &&
      // geometry later than knowledge is non-causal and never an anchor
      pointTime(fact)<=epoch(fact.knownAt,"fact.knownAt")
    );

  const groups=new Map<string,ResearchMarketStructureFact[]>();
  for(const fact of usable){
    const key=groupKey(fact);
    const group=groups.get(key)??[];
    group.push(fact);
    groups.set(key,group);
  }

  const facts:ResearchMarketStructureFact[]=[];
  const ids=new Set<string>();
  for(const group of groups.values()){
    const seenTimes=new Map<number,string>();
    for(const fact of group){
      const time=pointTime(fact);
      const other=seenTimes.get(time);
      if(other!==undefined){
        throw new Error(`ambiguous same-side pivots at one time in one group: ${other}, ${fact.factId}`);
      }
      seenTimes.set(time,fact.factId);
    }

    for(const third of group){
      const thirdTime=pointTime(third);
      const thirdKnownAt=epoch(third.knownAt,"third.knownAt");
      const predecessors=group
        .filter(fact=>
          fact.factId!==third.factId &&
          pointTime(fact)<thirdTime &&
          epoch(fact.knownAt,"fact.knownAt")<=thirdKnownAt
        )
        .sort((a,b)=>pointTime(a)-pointTime(b));
      if(predecessors.length<2) continue;
      const first=predecessors[predecessors.length-2]!;
      const second=predecessors[predecessors.length-1]!;

      const candidate=buildTrendlineCandidateFromPivots(first,second,{
        definitionId:input.definition.definitionId,
        minimumAnchorSeparationMs:input.definition.minimumAnchorSeparationMs,
      });
      if(!candidate) continue;
      if(thirdTime-pointTime(second)<input.definition.minimumAnchorSeparationMs) continue;

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
  if(trendline.maturity!=="RESEARCH_DERIVED"){
    throw new Error(`trendline interaction requires a RESEARCH_DERIVED line, got ${trendline.maturity}`);
  }
  const lineKnownAt=epoch(trendline.knownAt,"trendline.knownAt");
  if(trendline.geometry.points.some(point=>epoch(point.time,"trendline point")>lineKnownAt)){
    throw new Error(`trendline geometry is later than its knownAt: ${trendline.factId}`);
  }

  const linePrice=trendlinePriceAt(trendline,bar.sourceClosedAt);
  const none=():ResearchTrendlineInteractionAssessment=>({
    status:"NO_INTERACTION",
    linePrice,
    fact:null,
    authority:"RESEARCH_ONLY",
    liveCapitalAuthority:false,
  });

  if(bar.dataStatus!=="FRESH_COMPLETE") return none();

  const barClosedAt=epoch(bar.sourceClosedAt,"bar.sourceClosedAt");
  if(barClosedAt<=lineKnownAt||trendline.sourceEvidenceIds.includes(bar.evidenceId)) return none();

  // Boundaries are exact at the declared buffer; slack only absorbs binary
  // float noise from projecting the line, never a meaningful price distance.
  const slack=priceComparisonSlack(linePrice,bar.high,bar.low,bar.close);
  const support=trendline.concept==="TRENDLINE_SUPPORT";
  const closeBreak=support
    ? bar.close<linePrice-definition.closeBreakBuffer-slack
    : bar.close>linePrice+definition.closeBreakBuffer+slack;
  const penetration=support
    ? bar.low<linePrice-definition.penetrationBuffer-slack
    : bar.high>linePrice+definition.penetrationBuffer+slack;
  const touch=
    bar.low<=linePrice+definition.touchTolerance+slack &&
    bar.high>=linePrice-definition.touchTolerance-slack;

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
      maturity:"RESEARCH_DERIVED",
      scale:trendline.scale,
      timeframe:trendline.timeframe,
      side,
      knownAt:bar.knownAt,
      definitionId:definition.definitionId,
      sourceFactIds:[trendline.factId],
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
 * Emits interaction events in knowledge order and terminates the line lifecycle
 * after the first known close-break. Repeated touches/penetrations remain historical facts.
 * Nothing after the terminating break (including further breaks) is emitted.
 * Only bars known by evaluatedAt participate; identical re-deliveries of a bar
 * collapse, conflicting revisions of one sourceBarId fail closed.
 */
export function deriveTrendlineInteractions(input:{
  readonly evaluatedAt:string;
  readonly trendline:ResearchMarketStructureFact;
  readonly bars:readonly ResearchStructureBar[];
  readonly definition:ResearchTrendlineInteractionDefinition;
}):readonly ResearchMarketStructureFact[]{
  const evaluatedAt=epoch(input.evaluatedAt,"evaluatedAt");
  if(epoch(input.trendline.knownAt,"trendline.knownAt")>evaluatedAt) return [];
  const known=input.bars.filter(bar=>epoch(bar.knownAt,"bar.knownAt")<=evaluatedAt);
  const bars=[...dedupeById(known,bar=>bar.sourceBarId,"source bar")]
    .sort((a,b)=>{
      // Knowledge order first: the lifecycle advances as evidence becomes known,
      // so a late-delivered bar can never retract an interaction or break that an
      // earlier frame already knew. For in-order feeds this equals close order.
      const byKnown=epoch(a.knownAt,"bar.knownAt")-epoch(b.knownAt,"bar.knownAt");
      if(byKnown!==0) return byKnown;
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
