import type { ResearchMarketStructureFact, ResearchStructureBar } from '../research/marketMap.js';
import { recheckCurrentEntry, type CurrentEntryRecheckResult } from '../research/currentEntryRecheck.js';
import type { MarketStateInput, SharedMarketState, StrategyStateKey } from './sharedState.js';
import { SharedMarketStore } from './sharedState.js';
import { canonical, exact, finite, immutable, instant, nonempty, RESEARCH_AUTHORITY, type VersionRef, version } from './invariants.js';

export type EntryRoute = 'CONTINUATION_RETEST' | 'REVERSAL_RECLAIM';
export interface MarketFamilyProfile extends VersionRef { readonly family: string; readonly priceOrigin: 'EXTERNAL_MARKET' | 'SYNTHETIC_GENERATOR' }
export interface InstrumentProfile extends VersionRef {
  readonly instrument: string; readonly source: string; readonly familyProfile: VersionRef; readonly tickSize: number;
}
export interface TimeframeMap extends VersionRef {
  readonly context: string; readonly location: string; readonly entry: string; readonly management: string;
  /** Explicit role ages. There is no universal timeframe-to-horizon conversion. */
  readonly maxAgeMs: Readonly<Record<'context' | 'location' | 'entry' | 'management', number>>;
}
export interface HorizonProfile extends VersionRef {
  readonly horizon: string; readonly timeframeMap: VersionRef; readonly setupExpiryMs: number; readonly entryExpiryMs: number;
}
export interface EntryModel extends VersionRef {
  readonly route: EntryRoute;
  readonly familyProfile: VersionRef; readonly instrumentProfile: VersionRef; readonly horizonProfile: VersionRef;
  readonly strategy: VersionRef; readonly tradeBundle: VersionRef; readonly regimeModel: VersionRef;
  readonly calibration: VersionRef;
  readonly calibrationStatus: 'UNVALIDATED_RESEARCH';
  readonly breakTicks: number; readonly touchTicks: number; readonly stopTicks: number;
  readonly maxChaseTicks: number; readonly minimumRunwayTicks: number;
}
export interface EntryBinding {
  readonly side: 'BUY' | 'SELL';
  readonly contextFactId: string; readonly locationFactId: string; readonly objectiveFactId: string;
}
export interface EntryEvaluationInput {
  readonly markets: readonly MarketStateInput[];
  readonly family: MarketFamilyProfile; readonly instrument: InstrumentProfile;
  readonly horizon: HorizonProfile; readonly timeframes: TimeframeMap; readonly model: EntryModel;
  readonly binding: EntryBinding;
}
export interface EntryCandidate {
  readonly key: StrategyStateKey;
  readonly opportunityId: string; readonly instrument: string; readonly side: 'BUY' | 'SELL';
  readonly strategy: VersionRef; readonly tradeBundle: VersionRef; readonly entryModel: VersionRef;
  readonly familyProfile: VersionRef; readonly horizonProfile: VersionRef; readonly timeframes: TimeframeMap;
  readonly calibration: VersionRef; readonly calibrationStatus: 'UNVALIDATED_RESEARCH';
  readonly marketKeys: readonly string[]; readonly evaluatedAt: string; readonly knownAt: string;
  readonly state: 'STRUCTURAL_CANDIDATE' | 'STRUCTURAL_WATCH' | 'STRUCTURAL_READY';
  readonly currentEntry: CurrentEntryRecheckResult | null;
  readonly currentPrice: { readonly price: number; readonly sourceAt: string; readonly knownAt: string; readonly evidenceId: string };
  readonly economics: 'CLOSED_BAR_ONLY_NOT_EXECUTABLE';
  readonly parentContext: { readonly factId: string; readonly invalidation: number; readonly timeframe: string; readonly knownAt: string } | null;
  readonly reasons: readonly string[];
  readonly geometry: { readonly entryReference: number; readonly childInvalidation: number; readonly objective: number; readonly frozenAt: string } | null;
  readonly stages: readonly { readonly stage: 'Context' | 'Location' | 'Reaction / Confirmation' | 'Current Entry' | 'Invalidation' | 'Objective' | 'Management'; readonly factIds: readonly string[] }[];
  readonly management: { readonly timeframe: string; readonly policy: 'OBSERVE_CHILD_SEPARATELY_FROM_PARENT' };
  readonly authority: 'RESEARCH_ONLY'; readonly liveCapitalAuthority: false; readonly modelScored: false;
}
function same(a: VersionRef,b: VersionRef): boolean { return a.id === b.id && a.version === b.version; }
function ref(p: VersionRef): VersionRef { return { id:p.id,version:p.version }; }
function point(f: ResearchMarketStructureFact): number {
  if (f.geometry.type !== 'POINT') throw new Error('Entry route requires confirmed point geometry');
  return f.geometry.price;
}
function validateProfiles(i: EntryEvaluationInput): void {
  exact(i, ['markets','family','instrument','horizon','timeframes','model','binding']);
  exact(i.family,['id','version','family','priceOrigin']);
  exact(i.instrument,['id','version','instrument','source','familyProfile','tickSize']);
  exact(i.horizon,['id','version','horizon','timeframeMap','setupExpiryMs','entryExpiryMs']);
  exact(i.timeframes,['id','version','context','location','entry','management','maxAgeMs']);
  exact(i.timeframes.maxAgeMs,['context','location','entry','management']);
  exact(i.binding,['side','contextFactId','locationFactId','objectiveFactId']);
  exact(i.model,['id','version','route','familyProfile','instrumentProfile','horizonProfile','strategy','tradeBundle','regimeModel','calibration','calibrationStatus','breakTicks','touchTicks','stopTicks','maxChaseTicks','minimumRunwayTicks']);
  for (const p of [i.family,i.instrument,i.horizon,i.timeframes,i.model]) version(p);
  for(const p of [i.instrument.familyProfile,i.horizon.timeframeMap,i.model.familyProfile,i.model.instrumentProfile,i.model.horizonProfile,i.model.strategy,i.model.tradeBundle,i.model.regimeModel,i.model.calibration]) {version(p);exact(p,['id','version']);}
  if (!same(i.instrument.familyProfile,i.family) || !same(i.model.familyProfile,i.family) || !same(i.model.instrumentProfile,i.instrument) || !same(i.model.horizonProfile,i.horizon) || !same(i.horizon.timeframeMap,i.timeframes)) throw new Error('Profile scope mismatch');
  if (!['CONTINUATION_RETEST','REVERSAL_RECLAIM'].includes(i.model.route) || !['BUY','SELL'].includes(i.binding.side) || i.model.calibrationStatus !== 'UNVALIDATED_RESEARCH') throw new Error('Unsupported research entry model');
  if (!['EXTERNAL_MARKET','SYNTHETIC_GENERATOR'].includes(i.family.priceOrigin)) throw new Error('Unknown price origin');
  [i.family.family,i.instrument.instrument,i.instrument.source,i.horizon.horizon,...Object.values(i.binding),i.timeframes.context,i.timeframes.location,i.timeframes.entry,i.timeframes.management].forEach(nonempty);
  finite(i.instrument.tickSize,'tickSize',Number.MIN_VALUE);
  for (const n of ['breakTicks','touchTicks','stopTicks','maxChaseTicks','minimumRunwayTicks'] as const) { finite(i.model[n],n,Number.MIN_VALUE); finite(i.model[n]*i.instrument.tickSize,`${n} price distance`,Number.MIN_VALUE); }
  finite(i.horizon.entryExpiryMs,'entry expiry',1); finite(i.horizon.setupExpiryMs,'setup expiry',1);
  for (const role of ['context','location','entry','management'] as const) finite(i.timeframes.maxAgeMs[role],role,1);
}

/** One strategy interpretation per exact market/profile/bundle/evidence binding. No caller identities. */
export class SharedEntryEngine {
  readonly markets: SharedMarketStore;
  private readonly states = new Map<StrategyStateKey, EntryCandidate>();
  private readonly profiles = new Map<string,string>();
  private readonly bundles = new Map<string,string>();
  private computations = 0;
  constructor(private readonly capacity = 4096) { this.markets = new SharedMarketStore(capacity); }
  get computationCount(): number { return this.computations; }
  evaluate(input: EntryEvaluationInput): EntryCandidate {
    validateProfiles(input);
    for (const [kind,p] of Object.entries({family:input.family,instrument:input.instrument,horizon:input.horizon,timeframes:input.timeframes,model:input.model})) {
      const key=canonical([kind,p.id,p.version]); const bytes=canonical(p);
      if (this.profiles.has(key) && this.profiles.get(key)!==bytes) throw new Error('Profile version mutation');
    }
    const bundleKey=canonical(input.model.tradeBundle);
    const bundleDefinition=canonical({model:input.model,family:input.family,instrument:input.instrument,horizon:input.horizon,timeframes:input.timeframes});
    if(this.bundles.has(bundleKey)&&this.bundles.get(bundleKey)!==bundleDefinition) throw new Error('TradeBundle version mutation');
    const markets = input.markets.map(m=>this.markets.materialize(m));
    const roles = ['context','location','entry','management'] as const;
    const required = [...new Set(roles.map(r=>input.timeframes[r]))].sort();
    if(markets.length!==required.length || new Set(markets.map(m=>m.timeframe)).size!==markets.length || required.some(tf=>!markets.some(m=>m.timeframe===tf))) throw new Error('Exact timeframe map required');
    const evaluatedAt = markets[0]!.evaluatedAt;
    if(markets.some(m=>m.instrument!==input.instrument.instrument||m.source!==input.instrument.source||m.evaluatedAt!==evaluatedAt)) throw new Error('Market scope/observation mismatch');
    const key = canonical({markets:markets.map(m=>m.key).sort(),family:input.family,instrument:input.instrument,horizon:input.horizon,timeframes:input.timeframes,model:input.model,binding:input.binding}) as StrategyStateKey;
    const cached = this.states.get(key); if(cached) return cached;
    if(this.states.size>=this.capacity) throw new Error('Research strategy capacity exceeded');
    const result=immutable(interpret(input,markets,key));
    this.states.set(key,result); this.bundles.set(bundleKey,bundleDefinition); this.computations++;
    for (const [kind,p] of Object.entries({family:input.family,instrument:input.instrument,horizon:input.horizon,timeframes:input.timeframes,model:input.model})) this.profiles.set(canonical([kind,p.id,p.version]),canonical(p));
    return result;
  }
}
function interpret(i: EntryEvaluationInput, markets: readonly SharedMarketState[],key: StrategyStateKey): EntryCandidate {
  const byTf=(tf:string)=>markets.find(m=>m.timeframe===tf)!;
  const context=byTf(i.timeframes.context), location=byTf(i.timeframes.location), entry=byTf(i.timeframes.entry);
  const evaluatedAt=entry.evaluatedAt, now=instant(evaluatedAt), sign=i.binding.side==='BUY'?1:-1;
  const fact=(m:SharedMarketState,id:string)=>m.facts.find(f=>f.factId===id);
  const contextFact=fact(context,i.binding.contextFactId), locationFact=fact(location,i.binding.locationFactId), objectiveFact=fact(context,i.binding.objectiveFactId);
  const stages: EntryCandidate['stages'] = [
    {stage:'Context',factIds:contextFact?[contextFact.factId]:[]},
    {stage:'Location',factIds:locationFact?[locationFact.factId]:[]},
    {stage:'Reaction / Confirmation',factIds:[]}, {stage:'Current Entry',factIds:[]},
    {stage:'Invalidation',factIds:locationFact?[locationFact.factId]:[]},
    {stage:'Objective',factIds:objectiveFact?[objectiveFact.factId]:[]}, {stage:'Management',factIds:[]}];
  const base:EntryCandidate={key,opportunityId:canonical([i.model.strategy,i.model.tradeBundle,i.binding]),instrument:i.instrument.instrument,side:i.binding.side,
    strategy:ref(i.model.strategy),tradeBundle:ref(i.model.tradeBundle),entryModel:ref(i.model),familyProfile:ref(i.family),horizonProfile:ref(i.horizon),timeframes:i.timeframes,
    calibration:ref(i.model.calibration),calibrationStatus:'UNVALIDATED_RESEARCH',marketKeys:markets.map(m=>m.key).sort(),evaluatedAt,
    knownAt:markets.map(m=>m.knownAt).sort().at(-1)!,state:'STRUCTURAL_CANDIDATE',currentEntry:null,currentPrice:{price:entry.bars.at(-1)!.close,sourceAt:entry.bars.at(-1)!.sourceClosedAt,knownAt:entry.bars.at(-1)!.knownAt,evidenceId:entry.bars.at(-1)!.evidenceId},economics:'CLOSED_BAR_ONLY_NOT_EXECUTABLE',parentContext:contextFact?{factId:contextFact.factId,invalidation:point(contextFact),timeframe:contextFact.timeframe,knownAt:contextFact.knownAt}:null,reasons:[],geometry:null,stages,
    management:{timeframe:i.timeframes.management,policy:'OBSERVE_CHILD_SEPARATELY_FROM_PARENT'},...RESEARCH_AUTHORITY,modelScored:false};
  const reasons:string[]=[];
  for(const role of ['context','location','entry','management'] as const) {
    const m=byTf(i.timeframes[role]);
    if(m.bars.some(b=>b.dataStatus!=='FRESH_COMPLETE') || now-instant(m.bars.at(-1)!.sourceClosedAt)>i.timeframes.maxAgeMs[role]) reasons.push(`MARKET_UNAVAILABLE:${role}`);
  }
  if(reasons.length) return {...base,reasons};
  if(!contextFact||!locationFact||!objectiveFact) return {...base,reasons:['REQUIRED_FACT_UNAVAILABLE']};
  const support = i.binding.side==='BUY'?'SWING_LOW':'SWING_HIGH';
  const resistance = i.binding.side==='BUY'?'SWING_HIGH':'SWING_LOW';
  if(contextFact.concept!==support || objectiveFact.concept!==resistance || locationFact.concept!==(i.model.route==='CONTINUATION_RETEST'?resistance:support)) return {...base,reasons:['FACT_ROLE_MISMATCH']};
  const level=point(locationFact), objective=point(objectiveFact);
  const stop=level-sign*i.model.stopTicks*i.instrument.tickSize;
  finite(stop,'child invalidation');
  const contextLevel=point(contextFact);
  // Current higher-timeframe closure owns context invalidation; child bars cannot rewrite it.
  if(context.bars.some(b=>instant(b.sourceClosedAt)>instant(contextFact.knownAt) && sign*(b.close-contextLevel)<=0)) return {...base,reasons:['PARENT_CONTEXT_INVALID']};
  if(sign*(objective-level)<=0) return {...base,reasons:['OBJECTIVE_GEOMETRY_INVALID']};
  const nearest = context.facts.filter(f=>f.concept===resistance && f.geometry.type==='POINT' && sign*(point(f)-level)>0 && instant(f.knownAt)<=instant(objectiveFact.knownAt)).sort((a,b)=>sign*(point(a)-point(b)))[0];
  if(nearest && point(nearest)!==objective) return {...base,reasons:['NEARER_OBJECTIVE_EXISTS']};
  const start=Math.max(instant(contextFact.knownAt),instant(locationFact.knownAt),instant(objectiveFact.knownAt));
  if(now-start>i.horizon.setupExpiryMs) return {...base,reasons:['SETUP_EXPIRED']};
  const bars=entry.bars.filter(b=>instant(b.sourceClosedAt)>start);
  const threshold=i.model.breakTicks*i.instrument.tickSize, tolerance=i.model.touchTicks*i.instrument.tickSize;
  let reaction:ResearchStructureBar|undefined, confirmation:ResearchStructureBar|undefined;
  for(const b of bars) {
    if(!reaction) {
      const prior=entry.bars[entry.bars.indexOf(b)-1];
      if(prior && (i.model.route==='CONTINUATION_RETEST' ? sign*(prior.close-level)<=0 && sign*(b.close-level)>=threshold : sign*(prior.close-level)>=0 && sign*((sign===1?b.low:b.high)-level)<=-threshold)) reaction=b;
      continue;
    }
    // Terminal failure is sticky for this binding; a later rally cannot resurrect it.
    if(sign*(b.close-stop)<=0 || confirmation && sign*((sign===1?b.low:b.high)-stop)<=0) return {...base,state:'STRUCTURAL_WATCH',reasons:['CHILD_INVALIDATED']};
    const extreme=sign===1?b.low:b.high;
    if(!confirmation && sign*(b.close-level)>=threshold && (i.model.route==='REVERSAL_RECLAIM'|| Math.abs(extreme-level)<=tolerance)) confirmation=b;
    if(confirmation && sign*(b.close-level)<0) return {...base,state:'STRUCTURAL_WATCH',reasons:[i.model.route==='REVERSAL_RECLAIM'?'FAILED_RECLAIM':'FAILED_RETEST']};
    if(confirmation && sign*((sign===1?b.high:b.low)-objective)>=0) return {...base,state:'STRUCTURAL_WATCH',reasons:['OBJECTIVE_ALREADY_REACHED']};
  }
  if(!reaction||!confirmation) return {...base,state:reaction?'STRUCTURAL_WATCH':'STRUCTURAL_CANDIDATE',reasons:[reaction?'CONFIRMATION_REQUIRED':'REACTION_REQUIRED']};
  const current=entry.bars.at(-1)!;
  const geometry={entryReference:confirmation.close,childInvalidation:stop,objective,frozenAt:confirmation.knownAt};
  const predicate=(ok:boolean)=>({ok,evidenceId:current.evidenceId,knownAt:current.knownAt,provenanceId:canonical([i.model.calibration,i.horizon])});
  const currentEntry=recheckCurrentEntry({eventId:confirmation.evidenceId,confirmedAt:confirmation.knownAt,sourceBarClosedAt:confirmation.sourceClosedAt},{
    evaluatedAt,quote:{status:'FRESH',quoteAt:current.sourceClosedAt,evidenceId:current.evidenceId,knownAt:current.knownAt},
    entryFreshness:predicate(now-instant(confirmation.knownAt)<=i.horizon.entryExpiryMs),
    geometryCurrent:predicate(sign*(current.close-stop)>0 && Math.abs(current.close-level)<=i.model.maxChaseTicks*i.instrument.tickSize),
    // This is closed-bar structural research, not executable bid/ask economics.
    costsWithinBudget:predicate(true),targetRunwayAvailable:predicate(sign*(objective-current.close)>=i.model.minimumRunwayTicks*i.instrument.tickSize),continuityOk:predicate(true)});
  return {...base,state:currentEntry.status==='CURRENT'?'STRUCTURAL_READY':'STRUCTURAL_WATCH',geometry,currentEntry,
    reasons:currentEntry.status==='CURRENT'?['STRUCTURAL_READY_NOT_MODEL_SCORED']:currentEntry.reasons,
    stages:stages.map(s=>s.stage==='Reaction / Confirmation'?{...s,factIds:[reaction!.evidenceId,confirmation!.evidenceId]}:s.stage==='Current Entry'?{...s,factIds:[current.evidenceId]}:s)};
}
