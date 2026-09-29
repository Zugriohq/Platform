import { describe, expect, it } from 'vitest';
import { SharedEntryEngine, SharedMarketStore, createEntryValidationInput, createAccountValidationInput, evaluateAccountRisk, projectCampaign, validationTime, buildLaneBValidationFrame, laneBScenarios, type ChildExposure, type EntryEvaluationInput } from '../src/validation/index.js';
// Mutable fixture clones keep adversarial changes explicit; engine contracts remain readonly.
const input=()=>structuredClone(createEntryValidationInput()) as any;
const ready=()=>new SharedEntryEngine().evaluate(createEntryValidationInput());
const account=()=>structuredClone(createAccountValidationInput()) as any;
function fill(overrides:Partial<ChildExposure>={}):ChildExposure {
 return {id:'fill-1',intentId:'old-intent',trancheId:'old-tranche',thesisId:'parent-1',instrument:'fixture:GOLD',side:'BUY',role:'CORE',status:'OPEN',closeReason:null,units:10,originalUnits:10,entry:100,originalStop:95,currentStop:102,stopState:'BROKER_CONFIRMED',valuePerPriceUnit:10,valueCurrency:'USD',contractVersion:'fabricated-linear-v1',lossBufferPerUnit:1,reservedMargin:20,openedAt:validationTime(3),updatedAt:validationTime(7),knownAt:validationTime(7),closedAt:null,...overrides};
}
function withFills(children:ChildExposure[]) {
 const x=account();x.account.children=children;
 x.account.intents=[...new Set(children.map(c=>c.intentId))].map(id=>{const cs=children.filter(c=>c.intentId===id);return {intentId:id,thesisId:cs[0]!.thesisId,trancheId:cs[0]!.trancheId,requestedUnits:cs.reduce((s,c)=>s+c.originalUnits,0),knownAt:validationTime(3)};});return x;
}
const assess=(x:ReturnType<typeof account>,entry=ready())=>evaluateAccountRisk(x.account,x.policy,x.proposal,entry);

describe('Lane B canonical state and shared grammar',()=>{
 it('reuses lower-level state and strategy interpretation for 1000 downstream callers',()=>{
  const engine=new SharedEntryEngine();const i=input(); const first=engine.evaluate(i);
  for(let n=0;n<1000;n++) {expect(engine.evaluate(structuredClone(i))).toBe(first);const x=account();x.account.accountId=x.proposal.accountId=`a-${n}`;expect(assess(x,first).researchAdmission).toBe('PASS');}
  expect(engine.markets.computationCount).toBe(3);expect(engine.computationCount).toBe(1);
 });
 it('recognises both routes only after a later closed bar, never from reaction alone',()=>{
  for(const route of ['CONTINUATION_RETEST','REVERSAL_RECLAIM'] as const){
   const e=new SharedEntryEngine();expect(e.evaluate(createEntryValidationInput(route,'GOLD','INTRADAY',5)).state).toBe('STRUCTURAL_WATCH');
   const r=e.evaluate(createEntryValidationInput(route,'GOLD','INTRADAY',6));expect(r.state).toBe('STRUCTURAL_READY');expect(r.geometry?.frozenAt).toBe(validationTime(6));
  }
 });
 it('rejects future-known bars instead of using hindsight',()=>{const i=input();i.markets[2].bars[6].knownAt=validationTime(8);expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/Future/);});
 it('canonicalises array arrival order without changing facts or identity',()=>{const e=new SharedEntryEngine();const i=input();const a=e.evaluate(i);i.markets.reverse();i.markets.forEach((m:any)=>m.bars.reverse());expect(e.evaluate(i)).toBe(a);});
 it('rejects source/knownAt reordering',()=>{const i=input();i.markets[2].bars[4].knownAt=validationTime(7);expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/Reordered/);});
 it('rejects stale market evidence and any incomplete source',()=>{for(const type of ['age','status']){const i=input();if(type==='age')i.markets.forEach((m:any)=>m.evaluatedAt=validationTime(10));else i.markets[2].bars[6].dataStatus='STALE';expect(new SharedEntryEngine().evaluate(i).state).not.toBe('STRUCTURAL_READY');}});
 it('same shape under different families uses separate calibration',()=>{
  const e=new SharedEntryEngine();expect(e.evaluate(createEntryValidationInput()).state).toBe('STRUCTURAL_READY');expect(e.evaluate(createEntryValidationInput('CONTINUATION_RETEST','SYNTHETIC')).state).not.toBe('STRUCTURAL_READY');
 });
 it('same instrument across horizons reuses market truth, not interpretation',()=>{const e=new SharedEntryEngine();const a=e.evaluate(createEntryValidationInput());const b=e.evaluate(createEntryValidationInput('CONTINUATION_RETEST','GOLD','SWING'));expect(a.key).not.toBe(b.key);expect(a.marketKeys).toEqual(b.marketKeys);expect(e.markets.computationCount).toBe(3);expect(e.computationCount).toBe(2);});
 it('missing or incorrect timeframe roles fail closed',()=>{const i=input();i.timeframes.entry='M15';expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/timeframe/);});
 it('refuses family/profile substitution',()=>{const i=input();i.model.familyProfile.version='forged';expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/scope/);});
 it('failed reclaim cannot become READY',()=>{const i=structuredClone(createEntryValidationInput('REVERSAL_RECLAIM')) as any;i.markets[2].bars[6]={...i.markets[2].bars[6],low:108,close:109};expect(new SharedEntryEngine().evaluate(i).reasons).toContain('FAILED_RECLAIM');});
 it('late/chased entry rejects while preserving historical confirmation',()=>{const i=input();i.markets[2].bars[6]={...i.markets[2].bars[6],high:120,close:119};const result=new SharedEntryEngine().evaluate(i);expect(result.state).toBe('STRUCTURAL_WATCH');expect(result.geometry?.frozenAt).toBe(validationTime(6));expect(result.currentEntry?.reasons).toContain('GEOMETRY_NO_LONGER_CURRENT');});
 it('profile rollover produces a new interpretation without rewriting old state',()=>{const e=new SharedEntryEngine();const i=input();const a=e.evaluate(i);i.model.version='2';i.model.tradeBundle.version='2';i.model.calibration.version='2';i.model.maxChaseTicks=0.5;const b=e.evaluate(i);expect(b.key).not.toBe(a.key);expect(b.state).toBe('STRUCTURAL_WATCH');expect(a.state).toBe('STRUCTURAL_READY');expect(e.markets.computationCount).toBe(3);});
 it('same-version data and profile mutations are rejected',()=>{const e=new SharedEntryEngine();const i=input();e.evaluate(i);i.model.maxChaseTicks=20;expect(()=>e.evaluate(i)).toThrow(/version mutation/);const j=input();j.markets[2].bars[6].close=111.5;expect(()=>e.evaluate(j)).toThrow(/version mutation/);});
 it('caller/account keys cannot enter canonical market/strategy boundaries',()=>{const i=input();i.markets[0].accountId='victim';expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/Unexpected/);delete i.markets[0].accountId;i.accountId='victim';expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/Unexpected/);});
 it('returns deeply frozen historical snapshots unaffected by caller mutation',()=>{const i=input();const e=new SharedEntryEngine();const r=e.evaluate(i);i.markets[0].bars[0].close=1;expect(Object.isFrozen(r.geometry)).toBe(true);expect(()=>{(r as any).geometry.childInvalidation=1;}).toThrow();});
 it('rejects duplicate evidence even on a cache hit',()=>{const store=new SharedMarketStore();const i=input().markets[0];store.materialize(i);i.bars.push(i.bars[0]);expect(()=>store.materialize(i)).toThrow(/Duplicate/);});
 it('research capacity failure is explicit',()=>{const e=new SharedEntryEngine(1);expect(()=>e.evaluate(input())).toThrow(/capacity/);});
 it('supports all registered frames with one shared engine and fixed authority',()=>{const e=new SharedEntryEngine();for(const s of laneBScenarios)for(let n=0;n<s.frameCount;n++){const r=buildLaneBValidationFrame(e,s.id,n)!;expect(r.authority).toBe('NO_LIVE_CAPITAL');expect(r.entry.modelScored).toBe(false);expect(r.accountRisk.liveCapitalAuthority).toBe(false);}});
});

describe('Lane B account risk and campaigns',()=>{
 it('preserves broker balance-based free margin separately from equity margin level',()=>{const r=assess(account());expect(r.researchAdmission).toBe('PASS');expect(r.brokerReported.freeMargin).toBe(9900);expect(r.normalized?.projectedFreeMargin).toBe(9880);expect(r.capital).toBe(10000);});
 it('fails closed on conflicting broker semantics',()=>{const x=account();x.account.semantics.freeMarginBasis='EQUITY_MINUS_MARGIN';expect(assess(x).reasons).toContain('FREE_MARGIN_RECONCILIATION_FAILED');});
 it('fails closed on unprojectable broker semantics instead of inventing arithmetic',()=>{const x=account();x.account.semantics.freeMarginBasis='BROKER_DEFINED';expect(assess(x).reasons).toContain('MARGIN_PROJECTION_UNSUPPORTED');});
 it.each(['INCOMPLETE','CONTRADICTORY','UNRECONCILED'])('blocks %s reconciliation',status=>{const x=account();x.account.reconciliation.status=status;expect(assess(x).researchAdmission).toBe('BLOCK');});
 it('rejects stale/incomplete/skewed/future account state',()=>{for(const mutate of [(x:any)=>x.account.capturedAt=validationTime(1),(x:any)=>x.account.balance.value=null,(x:any)=>x.account.balance.sourceAt=validationTime(6),(x:any)=>x.account.knownAt=validationTime(8)]){const x=account();mutate(x);expect(assess(x).researchAdmission).toBe('BLOCK');}});
 it('explicit equity capital basis is required to use floating equity',()=>{const x=account();expect(assess(x).capital).toBe(10000);x.policy.capitalBasis='EQUITY';expect(assess(x).capital).toBe(10200);delete x.policy.capitalBasis;expect(assess(x).researchAdmission).toBe('BLOCK');});
 it('aggregates multiple partial child fills under one declared intent/thesis',()=>{const x=withFills([fill({id:'f1',units:1,originalUnits:1,currentStop:95}),fill({id:'f2',units:1,originalUnits:1,currentStop:95})]);const r=assess(x);expect(r.exposure?.existingThesisRisk).toBe(102);expect(r.exposure?.projectedThesisRisk).toBe(163);});
 it('blocks duplicate/replayed intents and duplicate fills',()=>{const x=withFills([fill()]);x.proposal.intentId='old-intent';expect(assess(x).reasons).toContain('DUPLICATE_OR_REPLAYED_INTENT');x.proposal.intentId='new-intent';x.account.children.push(x.account.children[0]);expect(assess(x).reasons).toContain('DUPLICATE_CHILD_FILL');});
 it('blocks fill quantity contradictions',()=>{const x=withFills([fill()]);x.account.intents[0].requestedUnits=1;expect(assess(x).reasons).toContain('INTENT_FILL_RECONCILIATION');});
 it('permits smaller add-on after core protection, with independently current entry',()=>{const x=withFills([fill()]);x.proposal.role='ADD_ON';x.proposal.units=0.5;const r=assess(x);expect(r.researchAdmission).toBe('PASS');expect(r.exposure?.existingThesisRisk).toBe(0);expect(r.exposure?.incrementalRisk).toBe(30.5);expect(r.exposure?.child[0]?.originalRisk).toBe(510);});
 it('blocks add-on when core is unprotected or the new entry is stale',()=>{const x=withFills([fill({currentStop:95})]);x.proposal.role='ADD_ON';x.proposal.units=0.5;expect(assess(x).reasons).toContain('CORE_NOT_PROTECTED');const y=withFills([fill()]);y.proposal.role='ADD_ON';const r=ready();expect(assess(y,{...r,state:'STRUCTURAL_WATCH'}).reasons).toContain('CURRENT_ENTRY_REQUIRED');});
 it('includes pending exposure and margin reservation',()=>{const x=withFills([fill({status:'PENDING',units:1,originalUnits:1,currentStop:95,reservedMargin:40})]);const r=assess(x);expect(r.exposure?.pendingRisk).toBe(51);expect(r.normalized?.projectedFreeMargin).toBe(9840);x.account.semantics.pendingIncludedInMargin=true;expect(assess(x).normalized?.projectedFreeMargin).toBe(9880);});
 it('concentration and aggregate risk include other theses on the same instrument',()=>{const x=withFills([fill({currentStop:90})]);x.policy.maxInstrumentRiskPct=0.1;x.policy.maxAccountRiskPct=0.1;const r=assess(x);expect(r.reasons).toContain('INSTRUMENT_RISK');expect(r.reasons).toContain('ACCOUNT_RISK');});
 it('child stop completion leaves parent active; re-entry needs fresh independent qualification',()=>{const x=withFills([fill({status:'CLOSED',units:0,closedAt:validationTime(5),updatedAt:validationTime(5),knownAt:validationTime(5),closeReason:'STOP'})]);const before=structuredClone(x.account.theses[0]);expect(assess(x).researchAdmission).toBe('PASS');expect(x.account.theses[0]).toEqual(before);x.account.children[0].closedAt=validationTime(7);x.account.children[0].updatedAt=validationTime(7);x.account.children[0].knownAt=validationTime(7);expect(assess(x).reasons).toContain('FRESH_CAMPAIGN_ENTRY_REQUIRED');});
 it('campaign target completion is not parent termination and LTF cannot terminate parent',()=>{const t=account().account.theses[0];const r=projectCampaign(t,[{id:'closed',type:'CHILD_COMPLETED',childId:'child1',knownAt:validationTime(5)}],validationTime(7));expect(r.thesis.state).toBe('ACTIVE');expect(()=>projectCampaign(t,[{id:'lt',type:'PARENT_INVALIDATED',timeframe:'M1',sourceFactIds:['f'],knownAt:validationTime(5)}],validationTime(7))).toThrow(/timeframe/);});
 it('rejects duplicate, future and reordered campaign events',()=>{const t=account().account.theses[0];const e={id:'x',type:'CHILD_COMPLETED' as const,childId:'x',knownAt:validationTime(5)};for(const events of [[e,e],[{...e,knownAt:validationTime(8)}],[e,{...e,id:'y',knownAt:validationTime(4)}]])expect(()=>projectCampaign(t,events,validationTime(7))).toThrow();});
 it('unconfirmed managed stops fail closed',()=>{const x=withFills([fill({stopState:'UNCONFIRMED'})]);expect(assess(x).reasons).toContain('UNCONFIRMED_CHILD_PROTECTION');});
 it('account identity cannot be swapped',()=>{const x=account();x.proposal.accountId='another-account';expect(assess(x).reasons).toContain('ACCOUNT_SCOPE_MISMATCH');});
 it('non-finite and missing policy fields fail closed',()=>{for(const n of [NaN,Infinity,undefined]){const x=account();x.policy.maxEntryRiskPct=n;expect(assess(x).researchAdmission).toBe('BLOCK');}});
});

describe('Lane B adversarial second pass regression cases',()=>{
 it('fresh evaluation time reuses immutable common derivation while freshness is rechecked',()=>{const e=new SharedEntryEngine();const i=input();const a=e.evaluate(i);i.markets.forEach((m:any)=>m.evaluatedAt=validationTime(10));const b=e.evaluate(i);expect(e.markets.computationCount).toBe(3);expect(b.key).not.toBe(a.key);expect(b.state).not.toBe('STRUCTURAL_READY');});
 it('binds downstream risk to current research price, never the frozen entry reference',()=>{const i=input();i.markets[2].bars[6].high=114;i.markets[2].bars[6].close=113;const r=new SharedEntryEngine().evaluate(i);expect(r.state).toBe('STRUCTURAL_READY');expect(r.geometry?.entryReference).toBe(111);const x=account();expect(assess(x,r).reasons).toContain('CURRENT_ENTRY_REQUIRED');x.proposal.entry=113;expect(assess(x,r).exposure?.incrementalRisk).toBe(81);});
 it('stop-touch followed by recovery cannot resurrect the same child entry',()=>{const i=input();i.markets[2].bars[6].low=100;expect(new SharedEntryEngine().evaluate(i).reasons).toContain('CHILD_INVALIDATED');});
 it('parent context invalidation and provenance must match the candidate',()=>{for(const change of [(x:any)=>x.account.theses[0].invalidation=9999,(x:any)=>x.account.theses[0].sourceFactIds=['unrelated'],(x:any)=>x.account.theses[0].strategy.version='other']){const x=account();change(x);expect(assess(x).researchAdmission).toBe('BLOCK');}});
 it('additional core label cannot bypass pyramiding policy',()=>{const x=withFills([fill()]);expect(assess(x).reasons).toContain('EXISTING_THESIS_REQUIRES_ADD_ON');});
 it('future parent state is rejected even without campaign events',()=>{const t=account().account.theses[0];t.knownAt=validationTime(9);expect(()=>projectCampaign(t,[],validationTime(7))).toThrow(/Future/);});
 it('snapshot cannot contain later child observations or inconsistent field skew',()=>{const x=withFills([fill({updatedAt:validationTime(6)})]);expect(assess(x).reasons).toContain('ACCOUNT_EXPOSURE_SKEW');x.account.children[0].updatedAt=validationTime(8);expect(assess(x).researchAdmission).toBe('BLOCK');});
 it('profit-side original stops cannot erase cumulative add-on risk history',()=>{const x=withFills([fill({originalStop:110})]);expect(assess(x).reasons).toContain('ORIGINAL_CHILD_GEOMETRY');});
});

describe('Independent reviewer reproductions',()=>{
 it('objective touch is terminal even when the candle closes back below it',()=>{const i=input();i.markets[2].bars[6].high=140;expect(new SharedEntryEngine().evaluate(i).reasons).toContain('OBJECTIVE_ALREADY_REACHED');});
 it('rejects relabelling an old current-entry result with a new evaluatedAt',()=>{const x=account(),c=structuredClone(ready()) as any;c.evaluatedAt=validationTime(10);x.account.capturedAt=x.account.knownAt=validationTime(10);for(const name of ['balance','equity','brokerMargin','brokerFreeMargin','brokerMarginLevel'])x.account[name].sourceAt=x.account[name].knownAt=validationTime(10);x.proposal.marginEstimateAt=x.proposal.marginEstimateKnownAt=validationTime(10);expect(assess(x,c).reasons).toContain('CONTRADICTORY_ENTRY_SNAPSHOT');});
 it('rejects overflowing tick calibration before publishing geometry',()=>{const i=input();i.instrument.tickSize=1e308;i.model.stopTicks=1e308;expect(()=>new SharedEntryEngine().evaluate(i)).toThrow(/Invalid/);});
 it('rejects overflow in historical closed-fill quantity reconciliation',()=>{const x=withFills([fill({id:'a',status:'CLOSED',units:0,originalUnits:1e308,closedAt:validationTime(5),updatedAt:validationTime(5),knownAt:validationTime(5),closeReason:'OBJECTIVE'}),fill({id:'b',status:'CLOSED',units:0,originalUnits:1e308,closedAt:validationTime(5),updatedAt:validationTime(5),knownAt:validationTime(5),closeReason:'OBJECTIVE'})]);x.account.intents[0].requestedUnits=1e308;expect(assess(x).reasons).toContain('INTENT_QUANTITY_OVERFLOW');});
 it('mirror symmetry preserves both route semantics for SELL',()=>{for(const route of ['CONTINUATION_RETEST','REVERSAL_RECLAIM'] as const){const i=structuredClone(createEntryValidationInput(route)) as any;i.binding.side='SELL';i.binding.contextFactId=i.binding.contextFactId.replace(':low',':high');i.binding.objectiveFactId=i.binding.objectiveFactId.replace(':high',':low');i.binding.locationFactId=i.binding.locationFactId.replace(route==='CONTINUATION_RETEST'?':high':':low',route==='CONTINUATION_RETEST'?':low':':high');for(const m of i.markets)for(const b of m.bars){const {open,high,low,close}=b;b.open=250-open;b.high=250-low;b.low=250-high;b.close=250-close;}const r=new SharedEntryEngine().evaluate(i);expect(r.state).toBe('STRUCTURAL_READY');expect(r.geometry?.childInvalidation).toBe(145);}});
 it('fresh synthetic confirmation can satisfy its own stronger calibration',()=>{const i=structuredClone(createEntryValidationInput('CONTINUATION_RETEST','SYNTHETIC')) as any;for(const k of [4,5,6]){i.markets[2].bars[k].high=115;i.markets[2].bars[k].close=114;}expect(new SharedEntryEngine().evaluate(i).state).toBe('STRUCTURAL_READY');});
});


describe('Lane D integration seam negative controls',()=>{
 it('rejects a parent context that was already invalidated by the time its delayed pivot became knowable',()=>{
  const i=input();
  const context=i.markets.find((m:any)=>m.timeframe==='H1');
  // b2 is the parent SWING_LOW. Its right-side confirmer b3 closes at minute 3
  // but is only learned at minute 4, so the pivot becomes knowable at minute 4.
  context.bars[2].knownAt=validationTime(4);
  // b4 also closes/is known at minute 4 and has already closed through the
  // parent invalidation. At the instant the pivot becomes knowable, it is invalid.
  context.bars[3]={...context.bars[3],open:100,high:105,low:80,close:85};
  const result=new SharedEntryEngine().evaluate(i);
  expect(result.reasons).toContain('PARENT_CONTEXT_INVALID');
  expect(result.state).not.toBe('STRUCTURAL_READY');
 });
});

describe('Version and numeric boundary guards',()=>{
 it('material model rollover requires a new complete TradeBundle version',()=>{const e=new SharedEntryEngine(),i=input();e.evaluate(i);i.model.version='2';i.model.stopTicks=6;expect(()=>e.evaluate(i)).toThrow(/TradeBundle/);});
 it('feature version rollover isolates facts and preserves old snapshots',()=>{const store=new SharedMarketStore(),i=input().markets[0];const a=store.materialize(i);i.featureDefinition.version='2';i.pivots[0].leftBars=2;const b=store.materialize(i);expect(b.key).not.toBe(a.key);expect(store.computationCount).toBe(2);expect(a.pivots[0]?.leftBars).toBe(1);});
});


describe('Pending-risk contradiction regression',()=>{
 it.each(['BUY','SELL'] as const)('pending %s cannot claim protected profit before filling',side=>{const x=withFills([fill({status:'PENDING',side,entry:100,originalStop:side==='BUY'?95:105,currentStop:side==='BUY'?102:98})]);x.account.theses[0].side=side;if(side==='SELL'){x.account.theses.push({...x.account.theses[0],id:'parent-other',side:'BUY'});x.proposal.thesisId='parent-other';}expect(assess(x).reasons).toContain('PENDING_STOP_GEOMETRY');});
});


it('overflow diagnostics never publish non-finite numeric wire values',()=>{const x=account();x.proposal.units=1e308;x.proposal.valuePerPriceUnit=1e308;const r=assess(x);expect(r.researchAdmission).toBe('BLOCK');expect(r.reasons).toContain('EXPOSURE_OVERFLOW');expect(r.exposure).toBeNull();expect(r.normalized).toBeNull();});