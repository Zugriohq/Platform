/** Fabricated mechanical replays only. Values are test calibrations, never validated market thresholds. */
import type { ResearchStructureBar } from '../research/marketMap.js';
import type { EntryEvaluationInput, EntryRoute } from './entryGrammar.js';
import { SharedEntryEngine } from './entryGrammar.js';
import type { AccountState, RiskPolicy, ResearchRiskProposal, ChildExposure } from './accountRisk.js';
import { evaluateAccountRisk } from './accountRisk.js';
import { immutable } from './invariants.js';
export const validationTime=(minute:number)=>new Date(Date.UTC(2026,0,1,0,minute)).toISOString();
function bars(tf:string,values:readonly (readonly [number,number,number,number])[],frame:number):ResearchStructureBar[] {
  return values.slice(0,frame).map(([open,high,low,close],index)=>({evidenceId:`${tf}:e${index+1}`,sourceBarId:`${tf}:b${index+1}`,open,high,low,close,sourceClosedAt:validationTime(index+1),knownAt:validationTime(index+1),dataStatus:'FRESH_COMPLETE'}));
}
export function createEntryValidationInput(route:EntryRoute='CONTINUATION_RETEST',family='GOLD',horizon='INTRADAY',frame=7):EntryEvaluationInput {
  const ver=(id:string)=>({id,version:'fixture-v1'});
  const familyProfile={...ver(`family:${family}`),family,priceOrigin:family==='SYNTHETIC'?'SYNTHETIC_GENERATOR' as const:'EXTERNAL_MARKET' as const};
  const instrument={...ver(`instrument:${family}`),instrument:`fixture:${family}`,source:'fabricated-ohlc-v1',familyProfile:ver(familyProfile.id),tickSize:1};
  const map={...ver(`map:${horizon}`),context:'H1',location:'M5',entry:'M1',management:'H1',maxAgeMs:{context:600000,location:600000,entry:60000,management:600000}};
  const hp={...ver(`horizon:${horizon}`),horizon,timeframeMap:ver(map.id),setupExpiryMs:3600000,entryExpiryMs:horizon==='SWING'?600000:120000};
  const featureDefinition=ver('confirmed-pivot');
  const context=bars('H1',[[100,105,95,100],[100,105,90,100],[100,130,95,115],[115,120,100,110],[110,119,100,110],[110,118,100,112],[112,119,101,112]],frame);
  const location=bars('M5',route==='CONTINUATION_RETEST'?[[100,105,95,100],[100,110,96,105],[105,108,97,104],[104,107,98,104],[104,108,98,105],[105,109,99,106],[106,109,100,107]]:[[115,119,114,116],[116,118,110,114],[114,120,113,116],[116,121,114,117],[117,122,115,118],[118,123,116,119],[119,124,117,120]],frame);
  const entries=bars('M1',route==='CONTINUATION_RETEST'?[[106,108,104,106],[106,109,105,108],[108,110,107,109],[109,110,108,109],[109,113,109,112],[112,113,109.5,111],[111,112,110,111]]:[[113,115,112,114],[114,116,112,115],[115,117,113,114],[114,115,111,113],[113,114,108,109],[109,113,109,111],[111,112,110,111]],frame);
  return {markets:[['H1',context],['M5',location],['M1',entries]].map(([timeframe,series])=>({instrument:instrument.instrument,source:instrument.source,timeframe:timeframe as string,evaluatedAt:validationTime(frame),dataVersion:`frame:${frame}:${timeframe==='H1'?'context':route}`,featureDefinition,pivots:[{definitionId:'p1',scale:'INTERMEDIATE',leftBars:1,rightBars:1}],bars:series as ResearchStructureBar[]})),family:familyProfile,instrument,horizon:hp,timeframes:map,
    model:{...ver(`model:${route}:${family}:${horizon}`),route,familyProfile:ver(familyProfile.id),instrumentProfile:ver(instrument.id),horizonProfile:ver(hp.id),strategy:ver('zugrio-core-research'),tradeBundle:ver(`bundle:${route}:${family}:${horizon}`),regimeModel:ver('context-pivot-hold'),calibration:ver(`calibration:${family}:${horizon}`),calibrationStatus:'UNVALIDATED_RESEARCH',breakTicks:family==='SYNTHETIC'?3:1,touchTicks:1,stopTicks:5,maxChaseTicks:4,minimumRunwayTicks:2},
    binding:{side:'BUY',contextFactId:'pivot:p1:H1:b2:low',locationFactId:`pivot:p1:M5:b2:${route==='CONTINUATION_RETEST'?'high':'low'}`,objectiveFactId:'pivot:p1:H1:b3:high'}};
}
export function createAccountValidationInput(input:EntryEvaluationInput=createEntryValidationInput()):{account:AccountState;policy:RiskPolicy;proposal:ResearchRiskProposal} {
  const now=input.markets[0]!.evaluatedAt;
  const field=(value:number)=>({value,sourceAt:now,knownAt:now});
  return {
    account:{snapshotId:`account:${now}`,workspaceId:'fixture-workspace',accountId:'fixture-account',currency:'USD',capturedAt:now,knownAt:now,
      balance:field(10000),equity:field(10200),brokerMargin:field(100),brokerFreeMargin:field(9900),brokerMarginLevel:field(10200),
      semantics:{id:'fixture-broker',version:'1',freeMarginBasis:'BALANCE_MINUS_MARGIN',marginLevelBasis:'EQUITY_PERCENT',pendingIncludedInMargin:false,verificationRef:'fabricated-semantics'},
      reconciliation:{status:'RECONCILED',evidenceRef:'fabricated-reconciliation',accountComplete:true},
      theses:[{id:'parent-1',strategy:input.model.strategy,instrument:input.instrument.instrument,side:'BUY',state:'ACTIVE',timeframe:'H1',invalidation:90,knownAt:validationTime(3),sourceFactIds:['pivot:p1:H1:b2:low']}],children:[],intents:[]},
    policy:{id:'fixture-policy',version:'1',capitalBasis:'BALANCE',declaredCapital:null,accountMaxAgeMs:60000,maxFieldSkewMs:1000,reconciliationTolerance:0.01,
      maxEntryRiskPct:1,maxThesisRiskPct:2,maxInstrumentRiskPct:3,maxAccountRiskPct:5,maxAddOnRiskPct:0.5,maxCumulativeAddOnRiskPct:1,maxAddOnCount:3,requireProtectedCore:true,maxAddOnUnitsToCoreRatio:0.2,allowCampaignReentry:true,minFreeMargin:100,minMarginLevelPct:200,maxMarginToCapitalPct:20},
    proposal:{workspaceId:'fixture-workspace',accountId:'fixture-account',intentId:'new-research-intent',trancheId:'new-tranche',thesisId:'parent-1',instrument:input.instrument.instrument,side:'BUY',role:'CORE',units:1,entry:111,stop:105,valuePerPriceUnit:10,valueCurrency:'USD',contractVersion:'fabricated-linear-v1',lossBufferPerUnit:1,incrementalMargin:20,marginEstimateAt:now,marginEstimateKnownAt:now,marginEstimateRef:'fabricated-margin-estimate'},
  };
}
export const laneBScenarios=immutable([
  {id:'gold-continuation',route:'CONTINUATION_RETEST',family:'GOLD',horizon:'INTRADAY',frameCount:3},
  {id:'gold-reclaim',route:'REVERSAL_RECLAIM',family:'GOLD',horizon:'INTRADAY',frameCount:3},
  {id:'fx-continuation',route:'CONTINUATION_RETEST',family:'FX',horizon:'INTRADAY',frameCount:3},
  {id:'synthetic-continuation',route:'CONTINUATION_RETEST',family:'SYNTHETIC',horizon:'INTRADAY',frameCount:3},
  {id:'gold-swing',route:'CONTINUATION_RETEST',family:'GOLD',horizon:'SWING',frameCount:3},
  {id:'gold-protected-addon',route:'CONTINUATION_RETEST',family:'GOLD',horizon:'INTRADAY',frameCount:3},
  {id:'gold-campaign-reentry',route:'CONTINUATION_RETEST',family:'GOLD',horizon:'INTRADAY',frameCount:3},
  {id:'gold-margin-conflict',route:'CONTINUATION_RETEST',family:'GOLD',horizon:'INTRADAY',frameCount:3},
  {id:'gold-stale-account',route:'CONTINUATION_RETEST',family:'GOLD',horizon:'INTRADAY',frameCount:3},
] as const);
export function buildLaneBValidationFrame(engine:SharedEntryEngine,scenarioId:string,frameIndex:number) {
  const scenario=laneBScenarios.find(s=>s.id===scenarioId);
  if(!scenario||!Number.isSafeInteger(frameIndex)||frameIndex<0||frameIndex>=scenario.frameCount) return undefined;
  const input=createEntryValidationInput(scenario.route,scenario.family,scenario.horizon,frameIndex+5);
  const entry=engine.evaluate(input);
  let {account,policy,proposal}=createAccountValidationInput(input);
  if(scenarioId==='gold-protected-addon'||scenarioId==='gold-campaign-reentry') {
    const completed=scenarioId==='gold-campaign-reentry';
    const children:ChildExposure[]=[1,2].map(n=>({id:`core-fill-${n}`,intentId:'prior-core-intent',trancheId:'prior-core',thesisId:'parent-1',instrument:input.instrument.instrument,side:'BUY',role:'CORE',
      status:completed?'CLOSED':'OPEN',closeReason:completed?'OBJECTIVE':null,units:completed?0:5,originalUnits:5,entry:100,originalStop:95,currentStop:102,stopState:'BROKER_CONFIRMED',valuePerPriceUnit:10,valueCurrency:'USD',contractVersion:'fabricated-linear-v1',lossBufferPerUnit:1,reservedMargin:50,
      openedAt:validationTime(3),updatedAt:input.markets[0]!.evaluatedAt,knownAt:input.markets[0]!.evaluatedAt,closedAt:completed?validationTime(5):null}));
    account={...account,children,intents:[{intentId:'prior-core-intent',trancheId:'prior-core',thesisId:'parent-1',requestedUnits:10,knownAt:validationTime(3)}]};
    if(!completed) proposal={...proposal,role:'ADD_ON',units:0.5};
  }
  if(scenarioId==='gold-margin-conflict') account={...account,semantics:{...account.semantics,freeMarginBasis:'EQUITY_MINUS_MARGIN'}};
  if(scenarioId==='gold-stale-account') account={...account,capturedAt:validationTime(1)};
  return immutable({scenarioId,frameIndex,evidenceStatus:'FABRICATED_MECHANICAL_VALIDATION' as const,entry,accountRisk:evaluateAccountRisk(account,policy,proposal,entry),authority:'NO_LIVE_CAPITAL' as const,liveCapitalAuthority:false as const});
}
export type LaneBValidationFrame=NonNullable<ReturnType<typeof buildLaneBValidationFrame>>;
