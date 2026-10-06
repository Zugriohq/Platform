'use strict';
/**
 * Gate 3A consolidated mutation battery.
 *
 *   node tools/gate3-mutation-battery.js [path/to/scanner.js] [--json out.json]
 *
 * Every mutation that broke an earlier scanner generation, in one place, so the
 * same battery can be run against any scanner version. Non-vacuity is shown by
 * running it against the previous scanner (cases it misses) and the current one
 * (all caught), with the clean artifact at zero defects under both.
 *
 * Every mutation is applied inside a named function and asserts where it
 * landed: an early version of these probes used a plain replace(), which hit
 * the first occurrence anywhere and reported misses that were not real.
 */
const fs = require('node:fs');
const path = require('node:path');

const scannerPath = path.resolve(process.argv[2] || path.join(__dirname, 'gate3-authority-inventory.js'));
const S = require(scannerPath);
const ART = path.join(__dirname, '..', 'artifacts', 'Zugrio-1.0.0-gate2.2.html');
const BASE = S.inlineScripts(fs.readFileSync(ART, 'utf8')).join('\n');

function inOwner(src, owner, anchor, replacement) {
  const ix = S.functionIndex(src);
  let p = -1;
  while ((p = src.indexOf(anchor, p + 1)) >= 0) {
    if (S.ownerOf(ix, p) === owner) return src.slice(0, p) + replacement + src.slice(p + anchor.length);
  }
  throw new Error(`anchor not inside ${owner}: ${anchor.slice(0, 50)}`);
}
const SF = 'if(type===ENGINE_EVENTS.SIGNAL_FIRED&&p&&p.item)void enqueueBrokerAction(()=>route(p.item));';
const CB = 'if(type===ENGINE_EVENTS.CLOSED_BAR&&p&&p.k)void enqueueBrokerAction(()=>routeConfirmedReversal(p.k));';
function BUS(anchor, replacement) {
  if (BASE.split(anchor).length !== 2) throw new Error('listener anchor not unique');
  return BASE.replace(anchor, replacement);
}
const helpers = (body) => `\nfunction zgC(q){return ${body};}\nfunction zgB(p){return zgC(p);}\n`;

const CASES = [
  // round 1-2: conditionals, verdict writes, laundering
  ['R1', 'readyOk initializer', () => inOwner(BASE, 'updateLegacySignalState', 'const readyOk=evaln.score>=(primary?0.46:V5_THRESH.ready)', 'const readyOk=evaln.score>=(primary?0.46:V5_THRESH.ready)&&secretEdgeFilter(k)'), /secretEdgeFilter/],
  ['R1', 'p.executionEligible write', () => inOwner(BASE, 'planTradeLevels', 'p.executionEligible=runwayOk&&stopGeometryOk;', 'p.executionEligible=runwayOk&&stopGeometryOk&&undeclaredProfitFilter(runwayOk);'), /undeclaredProfitFilter/],
  ['R2', 'split declare-then-assign', () => inOwner(BASE, 'planTradeLevels', 'const runwayOk=rr1>=(TTI_GEOMETRY.readyMinTP1R||1.0)-1e-12', 'let lateVerdict;lateVerdict=sneakyEdge(rr1);const runwayOk=(rr1>=(TTI_GEOMETRY.readyMinTP1R||1.0)-1e-12)&&lateVerdict'), /sneakyEdge|lateVerdict/],
  ['R2', 'ternary form', () => inOwner(BASE, 'planTradeLevels', 'const stopGeometryOk=isFinite(stopATR)&&stopATR<=maxStopATR+1e-12', 'const stopGeometryOk=ternaryEdgeFilter(stopATR)?isFinite(stopATR)&&stopATR<=maxStopATR+1e-12:false'), /ternaryEdgeFilter/],
  ['R2', 'one-hop laundering', () => inOwner(BASE, 'updateLegacySignalState', 'const readyOk=evaln.score>=(primary?0.46:V5_THRESH.ready)', 'const launderedEdge=mysteryPolicy(k);const readyOk=launderedEdge&&evaln.score>=(primary?0.46:V5_THRESH.ready)'), /launderedEdge|mysteryPolicy/],
  ['R2', 'feedGate executionOk property', () => inOwner(BASE, 'feedGate', 'executionOk:!unique.length', 'executionOk:!unique.length&&mysteryPolicy(unique)'), /mysteryPolicy/],
  // round 3: returned records
  ['R3', 'feedGate coreOk property', () => inOwner(BASE, 'feedGate', 'coreOk:ZUGRIO_ATR_OK(atr(executionBars))', 'coreOk:ZUGRIO_ATR_OK(atr(executionBars))&&mysteryPolicy(executionBars)'), /mysteryPolicy/],
  ['R3', 'new field on feedGate return', () => inOwner(BASE, 'feedGate', 'required,atrRequired', 'required,atrRequired,hiddenGate:mysteryPolicy(map)'), /hiddenGate/],
  ['R3', 'runwayOk reassignment', () => inOwner(BASE, 'computeTargets', 'const runwayOk=t1RR!=null&&t1RR>=readyMinTP1R-1e-12', 'let runwayOk=t1RR!=null&&t1RR>=readyMinTP1R-1e-12;runwayOk=runwayOk&&postHocFilter(t1RR)'), /postHocFilter/],
  ['R3', 'forceExecute:true on broker intent', () => inOwner(BASE, 'makeIntent', 'riskFraction:', 'forceExecute:true,riskFraction:'), /forceExecute/],
  ['R3', 'new field on familyGate', () => inOwner(BASE, 'familyGate', 'return{ok:', 'return{hint:mysteryPolicy(k),ok:'), /'hint'|mysteryPolicy/],
  ['R3', 'lifecycle alias field', () => inOwner(BASE, 'lifecycle', 'return c;', 'c.forceFire=mysteryPolicy(c);return c;'), /forceFire|mysteryPolicy/],
  ['R3', 'lifecycle c.stage conjunct', () => inOwner(BASE, 'lifecycle', "c.stage='RETEST_TOUCHED'", "c.stage=mysteryPolicy(c)?'RETEST_TOUCHED':'EXPIRED'"), /mysteryPolicy/],
  ['R3', 'field via Object.assign', () => inOwner(BASE, 'planTradeLevels', 'Object.assign(p,{', 'Object.assign(p,{forceExecute:true,'), /forceExecute/],
  ['R3', 'seed record field (spread)', () => inOwner(BASE, 'seeds', 'sourceTf:tf,', 'forceFire:true,sourceTf:tf,'), /forceFire/],
  ['R3', 'analyze base field (spread)', () => inOwner(BASE, 'analyze', 'const base={profileId:profile.id,', 'const base={forceFire:true,profileId:profile.id,'), /forceFire/],
  // round 4: producers
  ['R4', 'lifecycle.rejectionExtreme', () => inOwner(BASE, 'lifecycle', "c.rejectionExtreme=seed.dir==='BUY'?b.l:b.h", "c.rejectionExtreme=mysteryGeometryFilter(seed.dir==='BUY'?b.l:b.h)"), /mysteryGeometryFilter/],
  ['R4', 'familyGate.scale -> riskFraction', () => inOwner(BASE, 'familyGate', "case'VOLATILITY':scale=.75;", "case'VOLATILITY':scale=mysteryScaleFilter(input);"), /mysteryScaleFilter/],
  ['R4', 'plan.costR', () => inOwner(BASE, 'plan', 'const costR=risk>0?(Math.max(0,spread)+tick*6)/risk:Infinity', 'const costR=risk>0?mysteryCostFilter(spread,tick)/risk:Infinity'), /mysteryCostFilter/],
  ['R4', 'analyze.same', () => inOwner(BASE, 'analyze', 'same=votes.filter(v=>v===candidate.dir).length', 'same=mysteryContextFilter(votes,candidate)'), /mysteryContextFilter/],
  // round 5: the parameter boundary
  ['R5', 'call site -> familyGate', () => inOwner(BASE, 'analyze', 'familyGate(input,candidate,map,profile)', 'familyGate(mysteryCallerAuthority(input),candidate,map,profile)'), /mysteryCallerAuthority/],
  ['R5', 'call site -> plan spread', () => inOwner(BASE, 'analyze', 'Number(input.spread)||0)', 'mysteryCallerAuthority(Number(input.spread))||0)'), /mysteryCallerAuthority/],
  ['R5', 'shared-state write: s.ewmaVar', () => inOwner(BASE, 'updateGARCH', 's.ewmaVar=Math.max(', 's.ewmaVar=mysteryVolFilter(varianceReturn)+Math.max('), /mysteryVolFilter/],
  ['R5', 'shared-state write: s.garchVar', () => inOwner(BASE, 'updateGARCH', 's.garchVar=s.ewmaVar', 's.garchVar=mysteryVolFilter(s.ewmaVar)'), /mysteryVolFilter/],
  ['R5', 'taint inside helper (1-hop)', () => inOwner(helpers('mysteryInsideHelper(q)') + BASE, 'familyGate', "case'VOLATILITY':scale=.75;", "case'VOLATILITY':scale=zgC(input);"), /mysteryInsideHelper/],
  ['R5', 'taint inside helper (2-hop)', () => inOwner(helpers('mysteryInsideHelper(q)') + BASE, 'familyGate', "case'VOLATILITY':scale=.75;", "case'VOLATILITY':scale=zgB(input);"), /mysteryInsideHelper/],
  // round 6: entry points, global writes, scanner assumptions
  ['R6', 'operator handler writes a global', () => inOwner(BASE, 'chooseTradeProfile', "if(id==='ALL')selectedTradeProfiles=Object.keys(TTI_PROFILE_ENGINE.PROFILES);", "if(id==='ALL')selectedTradeProfiles=mysteryProfilePick(Object.keys(TTI_PROFILE_ENGINE.PROFILES));"), /mysteryProfilePick/],
  ['R6', 'renamed shared-state read (A1)', () => {
    const fx = '\nfunction zgWriter(k){const s=S[k];s.zgRenamedOnly=mysteryRenamedState(k);}\nzgWriter("EURUSD");\n' + BASE;
    return inOwner(fx, 'portfolioCorrelation', 'proposedSide=proposed&&proposed.signal', 'proposedSide=proposed&&proposed.zgRenamedOnly');
  }, /VIOLATED A1|mysteryRenamedState/],
  ['R6', 'masquerading .join on capital path (A2)', () => inOwner('\nconst zgHelper={join(){return mysteryMasquerade();}};\n' + BASE, 'familyGate', "case'VOLATILITY':scale=.75;", "case'VOLATILITY':scale=zgHelper.join();"), /VIOLATED A2|mysteryMasquerade/],
  // round 6b: the engine event bus — the point where signals become orders
  ['R6', 'bus: SIGNAL_FIRED listener condition', () => BUS(SF, 'if(type===ENGINE_EVENTS.SIGNAL_FIRED&&p&&p.item&&mysteryListenerGate(p))void enqueueBrokerAction(()=>route(p.item));'), /mysteryListenerGate/],
  ['R6', 'bus: SIGNAL_FIRED payload at emitter', () => inOwner(BASE, 'checkSig', 'emitEngine(ENGINE_EVENTS.SIGNAL_FIRED,{k,item})', 'emitEngine(ENGINE_EVENTS.SIGNAL_FIRED,{k,item:mysteryPayload(item)})'), /mysteryPayload/],
  ['R6', 'bus: CLOSED_BAR reversal condition', () => BUS(CB, 'if(type===ENGINE_EVENTS.CLOSED_BAR&&p&&p.k&&mysteryReversalGate(p))void enqueueBrokerAction(()=>routeConfirmedReversal(p.k));'), /mysteryReversalGate/],
  ['R6', 'bus: new broker call in a listener', () => BUS(SF, SF + 'if(type===ENGINE_EVENTS.TILE&&mysteryTileTrade(p))void enqueueBrokerAction(()=>route(p.item));'), /mysteryTileTrade/],
  ['R6', 'bus: named listener by reference', () => '\nfunction zgHandler(type,p){if(type===ENGINE_EVENTS.SIGNAL_FIRED&&mysteryNamedGate(p))void enqueueBrokerAction(()=>route(p.item));}\nonEngineEvent(zgHandler);\n' + BASE, /mysteryNamedGate/],
];

const rows = [];
let missed = 0;
for (const [round, label, make, expect] of CASES) {
  let src;
  try { src = make(); } catch (e) { rows.push({ round, label, result: 'ANCHOR', detail: e.message }); continue; }
  let caught = false;
  try { caught = S.scanSource(src, 'battery').inventoryDefects.some((d) => expect.test(d)); }
  catch (e) { rows.push({ round, label, result: 'ERROR', detail: e.message }); continue; }
  if (!caught) missed++;
  rows.push({ round, label, result: caught ? 'caught' : 'MISSED' });
}
const clean = S.scanSource(BASE, 'clean').inventoryDefects.length;
for (const r of rows) console.log(`${r.round.padEnd(3)} ${r.label.padEnd(42)} ${r.result}${r.detail ? '  ' + r.detail : ''}`);
console.log(`--- ${rows.length} cases, missed ${missed}, clean-artifact defects ${clean}`);
const j = process.argv.indexOf('--json');
if (j > 0 && process.argv[j + 1]) fs.writeFileSync(process.argv[j + 1], JSON.stringify({ scanner: path.basename(scannerPath), rows, missed, cleanDefects: clean }, null, 2));
