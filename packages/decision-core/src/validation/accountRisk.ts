import type { EntryCandidate } from './entryGrammar.js';
import { canonical, causal, finite, immutable, instant, nonempty, RESEARCH_AUTHORITY, type VersionRef, version } from './invariants.js';

export interface AccountField { readonly value: number | null; readonly sourceAt: string; readonly knownAt: string }
export interface BrokerMarginSemantics extends VersionRef {
  readonly freeMarginBasis: 'EQUITY_MINUS_MARGIN' | 'BALANCE_MINUS_MARGIN' | 'BROKER_DEFINED';
  readonly marginLevelBasis: 'EQUITY_PERCENT' | 'BALANCE_PERCENT' | 'BROKER_DEFINED';
  readonly pendingIncludedInMargin: boolean;
  readonly verificationRef: string;
}
export interface ParentThesis {
  readonly id: string; readonly strategy: VersionRef; readonly instrument: string; readonly side: 'BUY' | 'SELL'; readonly state: 'ACTIVE' | 'INVALIDATED' | 'COMPLETED';
  readonly timeframe: string; readonly invalidation: number; readonly knownAt: string;
  readonly sourceFactIds: readonly string[];
}
export interface ChildExposure {
  readonly id: string; readonly intentId: string; readonly trancheId: string; readonly thesisId: string;
  readonly instrument: string; readonly side: 'BUY' | 'SELL'; readonly role: 'CORE' | 'ADD_ON';
  readonly status: 'OPEN' | 'PENDING' | 'CLOSED'; readonly closeReason: 'STOP' | 'OBJECTIVE' | 'MANUAL' | null;
  readonly units: number; readonly originalUnits: number; readonly entry: number; readonly originalStop: number;
  readonly currentStop: number | null; readonly stopState: 'BROKER_CONFIRMED' | 'UNCONFIRMED';
  readonly valuePerPriceUnit: number; readonly valueCurrency: string; readonly contractVersion: string;
  readonly lossBufferPerUnit: number; readonly reservedMargin: number;
  readonly openedAt: string; readonly updatedAt: string; readonly knownAt: string; readonly closedAt: string | null;
}
export interface ResearchIntentRecord {
  readonly intentId: string; readonly thesisId: string; readonly trancheId: string;
  readonly requestedUnits: number; readonly knownAt: string;
}
export interface AccountState {
  readonly snapshotId: string; readonly workspaceId: string; readonly accountId: string; readonly currency: string;
  readonly capturedAt: string; readonly knownAt: string;
  readonly balance: AccountField; readonly equity: AccountField;
  readonly brokerMargin: AccountField; readonly brokerFreeMargin: AccountField; readonly brokerMarginLevel: AccountField;
  readonly semantics: BrokerMarginSemantics;
  readonly reconciliation: { readonly status: 'RECONCILED' | 'INCOMPLETE' | 'CONTRADICTORY' | 'UNRECONCILED'; readonly evidenceRef: string; readonly accountComplete: boolean };
  readonly theses: readonly ParentThesis[]; readonly children: readonly ChildExposure[]; readonly intents: readonly ResearchIntentRecord[];
}
export interface RiskPolicy extends VersionRef {
  readonly capitalBasis: 'BALANCE' | 'EQUITY' | 'DECLARED_CAPITAL'; readonly declaredCapital: number | null;
  readonly accountMaxAgeMs: number; readonly maxFieldSkewMs: number; readonly reconciliationTolerance: number;
  readonly maxEntryRiskPct: number; readonly maxThesisRiskPct: number; readonly maxInstrumentRiskPct: number; readonly maxAccountRiskPct: number;
  readonly maxAddOnRiskPct: number; readonly maxCumulativeAddOnRiskPct: number; readonly maxAddOnCount: number;
  readonly requireProtectedCore: boolean; readonly maxAddOnUnitsToCoreRatio: number; readonly allowCampaignReentry: boolean;
  readonly minFreeMargin: number; readonly minMarginLevelPct: number; readonly maxMarginToCapitalPct: number;
}
export interface ResearchRiskProposal {
  readonly workspaceId: string; readonly accountId: string; readonly intentId: string; readonly trancheId: string; readonly thesisId: string;
  readonly instrument: string; readonly side: 'BUY' | 'SELL'; readonly role: 'CORE' | 'ADD_ON'; readonly units: number;
  readonly entry: number; readonly stop: number; readonly valuePerPriceUnit: number; readonly valueCurrency: string;
  readonly contractVersion: string; readonly lossBufferPerUnit: number;
  readonly incrementalMargin: number; readonly marginEstimateAt: string; readonly marginEstimateKnownAt: string; readonly marginEstimateRef: string;
}
export interface RiskExposureTotals {
  readonly child: readonly { readonly id: string; readonly currentRisk: number; readonly originalRisk: number }[];
  readonly existingAccountRisk: number; readonly pendingRisk: number; readonly existingThesisRisk: number;
  readonly existingInstrumentRisk: number; readonly incrementalRisk: number; readonly projectedThesisRisk: number;
  readonly projectedInstrumentRisk: number; readonly projectedAccountRisk: number; readonly cumulativeAddOnRisk: number;
}
export interface AccountRiskAssessment {
  readonly accountId: string; readonly snapshotId: string; readonly policy: VersionRef; readonly evaluatedAt: string;
  readonly researchAdmission: 'PASS' | 'BLOCK'; readonly reasons: readonly string[];
  readonly capitalBasis: RiskPolicy['capitalBasis']; readonly capital: number | null;
  readonly brokerReported: { readonly balance: number | null; readonly equity: number | null; readonly margin: number | null; readonly freeMargin: number | null; readonly marginLevel: number | null };
  readonly normalized: { readonly basisFreeMargin: number | null; readonly projectedFreeMargin: number; readonly projectedMargin: number; readonly projectedMarginLevel: number | null } | null;
  readonly exposure: RiskExposureTotals | null;
  readonly authority: 'RESEARCH_ONLY'; readonly liveCapitalAuthority: false;
}
const risk=(side:'BUY'|'SELL',entry:number,stop:number,units:number,value:number,buffer:number)=>Math.max(0,(side==='BUY'?entry-stop:stop-entry)*value+buffer)*units;

/** Pure diagnostic admission of a supplied quantity. Never constructs, sizes, reserves or submits an order. */
export function evaluateAccountRisk(account: AccountState, policy: RiskPolicy, proposal: ResearchRiskProposal, candidate: EntryCandidate): AccountRiskAssessment {
  const reasons:string[]=[];
  const base:AccountRiskAssessment={accountId:account.accountId,snapshotId:account.snapshotId,policy:{id:policy.id,version:policy.version},evaluatedAt:candidate.evaluatedAt,
    researchAdmission:'BLOCK',reasons,capitalBasis:policy.capitalBasis,capital:null,brokerReported:{balance:account.balance?.value??null,equity:account.equity?.value??null,margin:account.brokerMargin?.value??null,freeMargin:account.brokerFreeMargin?.value??null,marginLevel:account.brokerMarginLevel?.value??null},normalized:null,exposure:null,...RESEARCH_AUTHORITY};
  try {
    validateAccount(account,policy,proposal,candidate);
  } catch(error) {
    return immutable({...base,reasons:[error instanceof Error?error.message:'INVALID_ACCOUNT_STATE']});
  }
  const now=instant(candidate.evaluatedAt);
  const balance=account.balance.value!,equity=account.equity.value!,margin=account.brokerMargin.value!,free=account.brokerFreeMargin.value!;
  const capital=policy.capitalBasis==='BALANCE'?balance:policy.capitalBasis==='EQUITY'?equity:policy.declaredCapital!;
  if(capital<=0) return immutable({...base,reasons:['CAPITAL_UNAVAILABLE']});
  const expectedFree=account.semantics.freeMarginBasis==='EQUITY_MINUS_MARGIN'?equity-margin:account.semantics.freeMarginBasis==='BALANCE_MINUS_MARGIN'?balance-margin:null;
  const levelBase=account.semantics.marginLevelBasis==='EQUITY_PERCENT'?equity:account.semantics.marginLevelBasis==='BALANCE_PERCENT'?balance:null;
  const expectedLevel=margin>0&&levelBase!==null?levelBase/margin*100:null;
  if(expectedFree!==null&&Math.abs(free-expectedFree)>policy.reconciliationTolerance) reasons.push('FREE_MARGIN_RECONCILIATION_FAILED');
  if(expectedLevel!==null&& (account.brokerMarginLevel.value===null||Math.abs(account.brokerMarginLevel.value-expectedLevel)>policy.reconciliationTolerance)) reasons.push('MARGIN_LEVEL_RECONCILIATION_FAILED');
  // Unknown broker projection semantics cannot be guessed even when current fields reconcile externally.
  if(expectedFree===null||levelBase===null) reasons.push('MARGIN_PROJECTION_UNSUPPORTED');
  const active=account.children.filter(c=>c.status!=='CLOSED');
  const child=active.map(c=>({id:c.id,currentRisk:risk(c.side,c.entry,c.currentStop!,c.units,c.valuePerPriceUnit,c.lossBufferPerUnit),originalRisk:risk(c.side,c.entry,c.originalStop,c.originalUnits,c.valuePerPriceUnit,c.lossBufferPerUnit)}));
  const total=(predicate:(c:ChildExposure)=>boolean)=>active.reduce((sum,c,index)=>sum+(predicate(c)?child[index]!.currentRisk:0),0);
  const incremental=risk(proposal.side,proposal.entry,proposal.stop,proposal.units,proposal.valuePerPriceUnit,proposal.lossBufferPerUnit);
  const thesisChildren=account.children.filter(c=>c.thesisId===proposal.thesisId);
  const addOns=thesisChildren.filter(c=>c.role==='ADD_ON');
  const cumulativeAddOnRisk=addOns.reduce((sum,c)=>sum+risk(c.side,c.entry,c.originalStop,c.originalUnits,c.valuePerPriceUnit,c.lossBufferPerUnit),0)+(proposal.role==='ADD_ON'?incremental:0);
  const exposure:RiskExposureTotals={child,existingAccountRisk:total(()=>true),pendingRisk:total(c=>c.status==='PENDING'),existingThesisRisk:total(c=>c.thesisId===proposal.thesisId),existingInstrumentRisk:total(c=>c.instrument===proposal.instrument),incrementalRisk:incremental,projectedThesisRisk:total(c=>c.thesisId===proposal.thesisId)+incremental,projectedInstrumentRisk:total(c=>c.instrument===proposal.instrument)+incremental,projectedAccountRisk:total(()=>true)+incremental,cumulativeAddOnRisk};
  const pendingMargin=account.semantics.pendingIncludedInMargin?0:active.filter(c=>c.status==='PENDING').reduce((s,c)=>s+c.reservedMargin,0);
  const projectedMargin=margin+pendingMargin+proposal.incrementalMargin;
  const normalized={basisFreeMargin:expectedFree,projectedFreeMargin:Math.min(free,expectedFree??free)-pendingMargin-proposal.incrementalMargin,projectedMargin,projectedMarginLevel:levelBase!==null&&projectedMargin>0?levelBase/projectedMargin*100:null};
  if(normalized.projectedFreeMargin<policy.minFreeMargin) reasons.push('FREE_MARGIN_BUFFER');
  if(normalized.projectedMarginLevel===null||normalized.projectedMarginLevel<policy.minMarginLevelPct) reasons.push('MARGIN_LEVEL_BUFFER');
  if(projectedMargin/capital*100>policy.maxMarginToCapitalPct) reasons.push('MARGIN_UTILIZATION');
  for(const [amount,limit,reason] of [[incremental,policy.maxEntryRiskPct,'ENTRY_RISK'],[exposure.projectedThesisRisk,policy.maxThesisRiskPct,'THESIS_RISK'],[exposure.projectedInstrumentRisk,policy.maxInstrumentRiskPct,'INSTRUMENT_RISK'],[exposure.projectedAccountRisk,policy.maxAccountRiskPct,'ACCOUNT_RISK']] as const) if(amount/capital*100>limit) reasons.push(reason);
  if(proposal.role==='ADD_ON') {
    const core=thesisChildren.filter(c=>c.role==='CORE'&&c.status==='OPEN');
    if(!core.length) reasons.push('ACTIVE_CORE_REQUIRED');
    if(policy.requireProtectedCore&&core.some(c=>risk(c.side,c.entry,c.currentStop!,c.units,c.valuePerPriceUnit,c.lossBufferPerUnit)>0)) reasons.push('CORE_NOT_PROTECTED');
    if(proposal.units>core.reduce((s,c)=>s+c.units,0)*policy.maxAddOnUnitsToCoreRatio) reasons.push('ADD_ON_SIZE');
    if(incremental/capital*100>policy.maxAddOnRiskPct) reasons.push('ADD_ON_RISK');
    if(cumulativeAddOnRisk/capital*100>policy.maxCumulativeAddOnRiskPct) reasons.push('CUMULATIVE_ADD_ON_RISK');
    if(new Set(addOns.map(c=>c.trancheId)).size+1>policy.maxAddOnCount) reasons.push('ADD_ON_COUNT');
  }
  if(proposal.role==='CORE' && thesisChildren.some(c=>c.status!=='CLOSED')) reasons.push('EXISTING_THESIS_REQUIRES_ADD_ON');
  const lastClosed=thesisChildren.filter(c=>c.closedAt!==null).sort((a,b)=>instant(a.closedAt!)-instant(b.closedAt!)).at(-1);
  if(lastClosed && (!policy.allowCampaignReentry || candidate.geometry===null || instant(candidate.geometry.frozenAt)<=instant(lastClosed.closedAt!))) reasons.push('FRESH_CAMPAIGN_ENTRY_REQUIRED');
  if(now-instant(proposal.marginEstimateAt)>policy.accountMaxAgeMs) reasons.push('STALE_MARGIN_ESTIMATE');
  // Reject non-finite derived arithmetic as well as malformed input numbers.
  if([...Object.values(exposure).filter((v):v is number=>typeof v==='number'),...child.flatMap(c=>[c.currentRisk,c.originalRisk]),...Object.values(normalized).filter((v):v is number=>v!==null)].some(v=>!Number.isFinite(v))) return immutable({...base,reasons:[...reasons,'EXPOSURE_OVERFLOW']});
  return immutable({...base,capital,exposure,normalized,researchAdmission:reasons.length?'BLOCK':'PASS',reasons:reasons.length?reasons:['RESEARCH_RISK_CHECKS_PASSED']});
}
function validateAccount(a:AccountState,p:RiskPolicy,q:ResearchRiskProposal,c:EntryCandidate):void {
  version(p);version(a.semantics);
  [a.snapshotId,a.workspaceId,a.accountId,a.currency,a.semantics.verificationRef,a.reconciliation.evidenceRef,q.intentId,q.trancheId,q.contractVersion,q.marginEstimateRef].forEach(nonempty);
  for(const key of ['accountMaxAgeMs','maxFieldSkewMs','reconciliationTolerance','maxEntryRiskPct','maxThesisRiskPct','maxInstrumentRiskPct','maxAccountRiskPct','maxAddOnRiskPct','maxCumulativeAddOnRiskPct','maxAddOnCount','maxAddOnUnitsToCoreRatio','minFreeMargin','minMarginLevelPct','maxMarginToCapitalPct'] as const) finite(p[key],key);
  if(!Number.isSafeInteger(p.maxAddOnCount)||typeof p.requireProtectedCore!=='boolean'||typeof p.allowCampaignReentry!=='boolean'||p.accountMaxAgeMs<=0) throw new Error('INVALID_RISK_POLICY');
  if(!['BALANCE','EQUITY','DECLARED_CAPITAL'].includes(p.capitalBasis)) throw new Error('CAPITAL_BASIS_REQUIRED');
  if(p.capitalBasis==='DECLARED_CAPITAL') finite(p.declaredCapital!,'declared capital',Number.MIN_VALUE);
  if(a.workspaceId!==q.workspaceId||a.accountId!==q.accountId) throw new Error('ACCOUNT_SCOPE_MISMATCH');
  if(a.reconciliation.status!=='RECONCILED'||a.reconciliation.accountComplete!==true) throw new Error('ACCOUNT_UNRECONCILED');
  if(!['EQUITY_MINUS_MARGIN','BALANCE_MINUS_MARGIN','BROKER_DEFINED'].includes(a.semantics.freeMarginBasis)||!['EQUITY_PERCENT','BALANCE_PERCENT','BROKER_DEFINED'].includes(a.semantics.marginLevelBasis)||typeof a.semantics.pendingIncludedInMargin!=='boolean') throw new Error('MARGIN_SEMANTICS_REQUIRED');
  causal(a.capturedAt,a.knownAt,c.evaluatedAt);
  if(instant(c.evaluatedAt)-instant(a.capturedAt)>p.accountMaxAgeMs) throw new Error('STALE_ACCOUNT');
  const fields=[a.balance,a.equity,a.brokerMargin,a.brokerFreeMargin,a.brokerMarginLevel];
  for(const [i,f] of fields.entries()) {
    causal(f.sourceAt,f.knownAt,a.knownAt);
    if(instant(f.sourceAt)>instant(a.capturedAt)||instant(c.evaluatedAt)-instant(f.sourceAt)>p.accountMaxAgeMs) throw new Error('STALE_ACCOUNT_FIELD');
    if(i!==4||a.brokerMargin.value!==0||f.value!==null) { if(f.value===null) throw new Error('ACCOUNT_FIELD_MISSING'); finite(f.value,'account field',i===3?-Number.MAX_VALUE:0); }
  }
  const stamps=fields.map(f=>instant(f.sourceAt));
  if(Math.max(...stamps)-Math.min(...stamps)>p.maxFieldSkewMs) throw new Error('ACCOUNT_FIELD_SKEW');
  if(c.authority!=='RESEARCH_ONLY'||c.liveCapitalAuthority!==false||c.state!=='STRUCTURAL_READY'||c.currentEntry?.status!=='CURRENT'||!c.geometry||c.instrument!==q.instrument||c.side!==q.side||c.geometry.childInvalidation!==q.stop||c.currentPrice.price!==q.entry) throw new Error('CURRENT_ENTRY_REQUIRED');
  if(c.currentEntry.evaluatedAt!==c.evaluatedAt || c.currentEntry.originalConfirmedAt!==c.geometry.frozenAt || c.economics!=='CLOSED_BAR_ONLY_NOT_EXECUTABLE') throw new Error('CONTRADICTORY_ENTRY_SNAPSHOT');
  causal(c.geometry.frozenAt,c.currentPrice.knownAt,c.evaluatedAt);
  causal(c.currentPrice.sourceAt,c.currentPrice.knownAt,c.evaluatedAt);
  if(instant(c.currentPrice.sourceAt)<instant(c.geometry.frozenAt) || instant(c.evaluatedAt)-instant(c.currentPrice.sourceAt)>c.timeframes.maxAgeMs.entry) throw new Error('STALE_ENTRY_PRICE');
  if(!['CORE','ADD_ON'].includes(q.role)||!['BUY','SELL'].includes(q.side)) throw new Error('INVALID_PROPOSAL');
  for(const k of ['units','valuePerPriceUnit','incrementalMargin'] as const) finite(q[k],k,Number.MIN_VALUE);
  for(const k of ['entry','stop','lossBufferPerUnit'] as const) finite(q[k],k);
  if(q.valueCurrency!==a.currency || (q.side==='BUY'?q.entry-q.stop:q.stop-q.entry)<=0) throw new Error('PROPOSAL_GEOMETRY_OR_CURRENCY');
  causal(q.marginEstimateAt,q.marginEstimateKnownAt,c.evaluatedAt);
  if(instant(q.marginEstimateAt)<instant(c.geometry.frozenAt)) throw new Error('MARGIN_ESTIMATE_PREDATES_ENTRY');
  if(new Set(a.theses.map(t=>t.id)).size!==a.theses.length) throw new Error('DUPLICATE_THESIS');
  for(const t of a.theses) {
    nonempty(t.id);version(t.strategy);nonempty(t.instrument);nonempty(t.timeframe);finite(t.invalidation,'parent invalidation');
    causal(t.knownAt,t.knownAt,a.knownAt);
    if(!t.sourceFactIds.length||!['ACTIVE','INVALIDATED','COMPLETED'].includes(t.state)||!['BUY','SELL'].includes(t.side)) throw new Error('INVALID_THESIS');
  }
  const thesis=a.theses.find(t=>t.id===q.thesisId);
  if(!thesis||thesis.state!=='ACTIVE'||thesis.instrument!==q.instrument||thesis.side!==q.side||thesis.timeframe!==c.timeframes.context||canonical(thesis.strategy)!==canonical(c.strategy)) throw new Error('PARENT_THESIS_REQUIRED');
  if(!c.parentContext || thesis.invalidation!==c.parentContext.invalidation || !thesis.sourceFactIds.includes(c.parentContext.factId) || instant(thesis.knownAt)<instant(c.parentContext.knownAt)) throw new Error('PARENT_CONTEXT_MISMATCH');
  const intentIds=new Set<string>(),trancheIds=new Set<string>();
  for(const intent of a.intents) {
    nonempty(intent.intentId);nonempty(intent.trancheId);finite(intent.requestedUnits,'requested units',Number.MIN_VALUE);causal(intent.knownAt,intent.knownAt,a.knownAt);
    if(intentIds.has(intent.intentId)||trancheIds.has(intent.trancheId)) throw new Error('DUPLICATE_INTENT_LEDGER');
    intentIds.add(intent.intentId);trancheIds.add(intent.trancheId);
  }
  if(intentIds.has(q.intentId)||trancheIds.has(q.trancheId)) throw new Error('DUPLICATE_OR_REPLAYED_INTENT');
  if(new Set(a.children.map(x=>x.id)).size!==a.children.length) throw new Error('DUPLICATE_CHILD_FILL');
  for(const child of a.children) {
    nonempty(child.id);nonempty(child.contractVersion);finite(child.originalUnits,'original units',Number.MIN_VALUE);finite(child.units,'remaining units');
    if(!['OPEN','PENDING','CLOSED'].includes(child.status)||!['CORE','ADD_ON'].includes(child.role)||!['BUY','SELL'].includes(child.side)) throw new Error('INVALID_CHILD');
    if(child.units>child.originalUnits||child.status==='CLOSED'&&child.units!==0||child.status!=='CLOSED'&&child.units<=0) throw new Error('CHILD_QUANTITY_RECONCILIATION');
    for(const k of ['entry','originalStop','lossBufferPerUnit','reservedMargin'] as const) finite(child[k],k);
    finite(child.valuePerPriceUnit,'contract value',Number.MIN_VALUE);
    if((child.side==='BUY'?child.entry-child.originalStop:child.originalStop-child.entry)<=0) throw new Error('ORIGINAL_CHILD_GEOMETRY');
    if(child.valueCurrency!==a.currency) throw new Error('VALUE_CONVERSION_UNRECONCILED');
    causal(child.openedAt,child.knownAt,a.knownAt);causal(child.updatedAt,child.knownAt,a.knownAt);
    if(instant(child.updatedAt)>instant(a.capturedAt)) throw new Error('CHILD_AFTER_ACCOUNT_SNAPSHOT');
    if(instant(child.updatedAt)<instant(child.openedAt)) throw new Error('CHILD_TIME_REORDERED');
    if(child.status==='CLOSED') {
      if(!child.closedAt||!['STOP','OBJECTIVE','MANUAL'].includes(child.closeReason!)) throw new Error('CHILD_CLOSE_INCOMPLETE');
      causal(child.openedAt,child.closedAt,child.updatedAt);
    } else {
      if(child.closedAt!==null||child.closeReason!==null||child.currentStop===null||child.stopState!=='BROKER_CONFIRMED') throw new Error('UNCONFIRMED_CHILD_PROTECTION');
      finite(child.currentStop,'managed stop');
      if(child.status==='PENDING' && (child.side==='BUY'?child.entry-child.currentStop:child.currentStop-child.entry)<=0) throw new Error('PENDING_STOP_GEOMETRY');
      if(instant(c.evaluatedAt)-instant(child.updatedAt)>p.accountMaxAgeMs) throw new Error('STALE_CHILD_STATE');
    }
    const parent=a.theses.find(t=>t.id===child.thesisId), intent=a.intents.find(x=>x.intentId===child.intentId);
    if(!parent||parent.instrument!==child.instrument||parent.side!==child.side||!intent||intent.thesisId!==child.thesisId||intent.trancheId!==child.trancheId||instant(intent.knownAt)>instant(child.knownAt)) throw new Error('CHILD_LINEAGE_RECONCILIATION');
  }
  const coherentTimes=[...stamps,...a.children.filter(x=>x.status!=='CLOSED').map(x=>instant(x.updatedAt))];
  if(Math.max(...coherentTimes)-Math.min(...coherentTimes)>p.maxFieldSkewMs) throw new Error('ACCOUNT_EXPOSURE_SKEW');
  for(const intent of a.intents) {
    const children=a.children.filter(x=>x.intentId===intent.intentId);
    // Snapshot must account for filled, closed and remaining pending quantities without double counting.
    const total=children.reduce((s,x)=>s+x.originalUnits,0);
    if(children.some(x=>x.role!==children[0]!.role)) throw new Error('MIXED_TRANCHE_ROLE');
    if(!Number.isFinite(total)) throw new Error('INTENT_QUANTITY_OVERFLOW');
    if(!children.length||Math.abs(total-intent.requestedUnits)>Number.EPSILON*Math.max(1,total)*8) throw new Error('INTENT_FILL_RECONCILIATION');
  }
}

/** Immutable event reduction; a child completion never changes parent thesis state. */
export type CampaignEvent =
 | {readonly id:string;readonly knownAt:string;readonly type:'CHILD_COMPLETED';readonly childId:string}
 | {readonly id:string;readonly knownAt:string;readonly type:'PARENT_INVALIDATED';readonly timeframe:string;readonly sourceFactIds:readonly string[]};
export function projectCampaign(thesis:ParentThesis,events:readonly CampaignEvent[],evaluatedAt:string): {readonly thesis:ParentThesis;readonly completedChildren:readonly string[];readonly eventIds:readonly string[]} {
  causal(thesis.knownAt,thesis.knownAt,evaluatedAt);
  const ids=new Set<string>(), completed=new Set<string>();let previous=instant(thesis.knownAt);let current=thesis;
  for(const e of events) {
    nonempty(e.id);causal(e.knownAt,e.knownAt,evaluatedAt);
    if(ids.has(e.id)||instant(e.knownAt)<previous) throw new Error('Duplicate/reordered campaign event');
    ids.add(e.id);previous=instant(e.knownAt);
    if(e.type==='CHILD_COMPLETED') {nonempty(e.childId);if(completed.has(e.childId))throw new Error('Duplicate child completion');completed.add(e.childId);}
    else if(e.type==='PARENT_INVALIDATED') {
      if(e.timeframe!==thesis.timeframe||!e.sourceFactIds.length) throw new Error('Parent timeframe authority mismatch');
      current={...current,state:'INVALIDATED',knownAt:e.knownAt,sourceFactIds:e.sourceFactIds};
    } else throw new Error('Unknown campaign event');
  }
  return immutable({thesis:current,completedChildren:[...completed],eventIds:[...ids]});
}
