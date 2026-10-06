'use strict';
/**
 * Gate 3A round-8 battery: accepted-dependency substitution, deletion,
 * rerouting and threshold changes.
 *
 *   node tools/gate3-substitution-battery.js [path/to/scanner.js] [--json out.json]
 *
 * Every case rewrites live authority code using ONLY dependencies the frozen
 * vocabulary already accepts for that owner, so the novelty check cannot see
 * it. Class membership is proven per case, not assumed: with the authority
 * baseline disabled the mutated source must scan with zero defects. A case
 * that the vocabulary alone already flags is reported VOCAB; unless the case
 * declares VOCAB as its expected detector it is an invalid substitution case and
 * fails — that is the non-vacuity guard on the battery.
 *
 * Outcomes, with the baseline enabled:
 *   SINK      a baseline-drift defect names the mutated owner (localised)
 *   OWNER     only the owner fingerprint changed: the edit is in authority code
 *             that no inventoried sink covers — a coverage gap, counted
 *   MISSED    no defect at all, counted
 * Precision controls (comment/whitespace edits, renderer edits) must scan clean.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const scannerArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
const scannerPath = path.resolve(scannerArg || path.join(__dirname, 'gate3-authority-inventory.js'));
const S = require(scannerPath);
const ART = path.join(__dirname, '..', 'artifacts', 'Zugrio-1.0.0-gate2.2.html');
const BASE = S.inlineScripts(fs.readFileSync(ART, 'utf8')).join('\n');

function inOwner(src, owner, anchor, replacement) {
  const ix = S.functionIndex(src);
  let p = -1, hit = -1;
  while ((p = src.indexOf(anchor, p + 1)) >= 0) {
    if (S.ownerOf(ix, p) !== owner) continue;
    if (hit >= 0) throw new Error(`anchor not unique inside ${owner}: ${anchor.slice(0, 60)}`);
    hit = p;
  }
  if (hit < 0) throw new Error(`anchor not inside ${owner}: ${anchor.slice(0, 60)}`);
  return src.slice(0, hit) + replacement + src.slice(hit + anchor.length);
}

const READY = "if(!result.blockers.length){result.state='READY'";
// [category, name, owner, anchor, replacement]
const CASES = [
  // 1 hard-predicate input substitution
  ['predicate-input', 'plan STOP_TOO_WIDE uses tick instead of ATR', 'plan', "if(risk>av*3)reasons.push('STOP_TOO_WIDE')", "if(risk>tick*3)reasons.push('STOP_TOO_WIDE')"],
  // (round-8 note: 'PRICE_INVALID checks tick' was dropped as NOT_IN_CLASS — the vocabulary
  // already rejects tick in a PRICE_VALID sink because its disposition changes)
  ['predicate-input', 'STOP_TOO_TIGHT floor uses risk instead of ATR', 'plan', 'if(risk<Math.max(tick*5,av*0.2))', 'if(risk<Math.max(tick*5,risk*0.2))'],
  // 2 threshold substitution
  ['threshold', 'runway threshold -> stop threshold (both accepted)', 'planTradeLevels', 'TTI_GEOMETRY.readyMinTP1R||1.0', 'TTI_GEOMETRY.maxStopATR||1.0'],
  ['threshold', 'tick staleness 15s -> 150s (literal only)', 'feedGate', 'now-tickAt>15000', 'now-tickAt>150000'],
  ['threshold', 'insufficient-bars 24 -> 2 (literal only)', 'feedGate', 'if(a.length<24)', 'if(a.length<2)'],
  // 3 profile-field substitution
  ['profile-field', 'execution timeframe from profile.id', 'analyze', ':profile.execution,bars=', ':profile.id,bars='],
  ['profile-field', 'familyGate given the DAY profile', 'analyze', 'familyGate(input,candidate,map,profile)', 'familyGate(input,candidate,map,PROFILES.DAY)'],
  // 4 strategy-state substitution
  ['strategy-state', 'initial state WATCH -> READY', 'analyze', "result.state='WATCH';", "result.state='READY';"],
  ['strategy-state', 'state rank READY/WATCH swapped', 'analyze', 'READY:3,WATCH:2', 'READY:2,WATCH:3'],
  // 5 risk / capital-feature substitution
  ['risk', 'BOOM_CRASH tail scales swapped', 'familyGate', 'scale=tail ? .5 : .35', 'scale=tail ? .35 : .5'],
  ['risk', 'JUMP scale .5 -> .95', 'familyGate', "case'JUMP':scale=.5;", "case'JUMP':scale=.95;"],
  ['risk', 'riskScale dropped from riskFraction', 'makeIntent', 'Math.min(1,riskScale)', 'Math.min(1,1)'],
  ['risk', 'profile riskScale replaced by specialist scale', 'analyze', 'result.riskScale=profile.riskScale*result.specialist.scale', 'result.riskScale=result.specialist.scale*result.specialist.scale'],
  // 6 side / direction substitution
  ['side', 'order side from instrument key', 'makeIntent', 'side:String(item.sig)', 'side:String(item.k)'],
  ['side', 'reversal exit side = position side', 'routeConfirmedReversal', 'exitSide:candidate.dir', 'exitSide:position.side'],
  ['side', 'HTF agreement counts opposing votes', 'analyze', 'same=votes.filter(v=>v===candidate.dir)', 'same=votes.filter(v=>v!==candidate.dir)'],
  // 7 entry / stop / target substitution
  ['geometry', 'order stop and target swapped', 'makeIntent', 'stopLoss:Number(levels.stop),takeProfit:Number(target)', 'stopLoss:Number(target),takeProfit:Number(levels.stop)'],
  ['geometry', 'order entry = stop', 'makeIntent', 'entry:Number(item.entryPrice)', 'entry:Number(levels.stop)'],
  ['geometry', 'plan stop written from entry ideal (Object.assign)', 'planTradeLevels', 'stop:stopPrice.toFixed(pr)', 'stop:entryIdeal.toFixed(pr)'],
  ['geometry', 'plan t1 written from another accepted field (Object.assign)', 'planTradeLevels', 'targets:{t1:tg.t1.toFixed(pr)', 'targets:{t1:tg.ordered.toFixed(pr)'],
  // 8 lifecycle / state-rank substitution
  ['lifecycle', 'candidate sort direction reversed', 'analyze', '.sort((a,b)=>rank(b)-rank(a)||b.knownAt-a.knownAt)', '.sort((a,b)=>rank(a)-rank(b)||b.knownAt-a.knownAt)'],
  ['lifecycle', 'BREAK_CONFIRMED rank 1 -> 3', 'analyze', "c.stage==='BREAK_CONFIRMED'?1:0", "c.stage==='BREAK_CONFIRMED'?3:0"],
  // 9 broker order payload substitution
  ['order-payload', 'exit positionId from candidate id', 'routeConfirmedReversal', 'positionId:String(position.positionId)', 'positionId:String(candidate.id)'],
  ['order-payload', 'order instrument from event id', 'makeIntent', 'instrumentKey:String(item.k)', 'instrumentKey:String(item.id)'],
  // 10 producer return-value substitution
  ['producer-return', 'feedGate executionOk from bar count', 'feedGate', 'executionOk:!unique.length', 'executionOk:!a.length'],
  ['producer-return', 'familyGate ok from bias', 'familyGate', 'return{ok:!reasons.length,', 'return{ok:!bias,'],
  // 11 object-property substitution
  ['object-property', 'context opposing count = same', 'analyze', 'opposing:opp,', 'opposing:same,'],
  ['object-property', 'context ok threshold opp<2 -> opp<3', 'analyze', 'ok:same>=1&&opp<2', 'ok:same>=1&&opp<3'],
  // 12 array / list element substitution
  ['array', 'health reasons not carried into blockers', 'analyze', 'result.blockers=[...health.reasons];', 'result.blockers=[];'],
  // ('best = evaluated.at(-1)' was NOT_IN_CLASS: evaluated.at is a new pair for analyze)
  ['array', 'best = second evaluated, not first', 'analyze', 'const best=evaluated[0];', 'const best=evaluated[1]||evaluated[0];'],
  // 13 function-argument substitution
  ['argument', 'planner given the profile bars of another frame', 'checkSig', 'map[lane.executionTf],map,s.price', 'map[lane.profileId],map,s.price'],
  ['argument', 'plan given the zone low for both sides', 'analyze', "(candidate.dir==='BUY'?candidate.zoneHigh:candidate.zoneLow)", "(candidate.dir==='BUY'?candidate.zoneLow:candidate.zoneLow)"],
  // 14 indirect alias substitution
  ['alias', 'reversal lane chosen from DAY regardless of position', 'routeConfirmedReversal', "s.profileStates?.[position.profileId||'DAY']", "s.profileStates?.['DAY']"],
  // Object.assign: literal, conditional and variable sources, computed keys
  // these three introduce Object.assign into analyze, which never used it: the
  // vocabulary (not the baseline) is the expected detector, so they expect VOCAB
  ['object-assign', 'Object.assign writes state READY', 'analyze', 'result.candidate=candidate;result.side=candidate.dir;', "Object.assign(result,{state:'READY'});result.candidate=candidate;result.side=candidate.dir;"],
  ['object-assign', 'Object.assign with conditional source', 'analyze', 'result.candidate=candidate;result.side=candidate.dir;', "Object.assign(result,candidate.triggerFresh?{state:'READY'}:{});result.candidate=candidate;result.side=candidate.dir;"],
  ['object-assign', 'Object.assign from an accepted variable', 'analyze', 'result.candidate=candidate;result.side=candidate.dir;', 'Object.assign(result,candidate);result.candidate=candidate;result.side=candidate.dir;'],
  ['object-assign', 'computed string key writes state', 'analyze', 'result.candidate=candidate;result.side=candidate.dir;', "result['state']='READY';result.candidate=candidate;result.side=candidate.dir;"],
  ['object-assign', 'existing Object.assign leaf: retest level from zone', 'retestView', 'retestLevel:candidate.level,', 'retestLevel:candidate.zoneLow,'],
  // deletion
  ['deletion', 'executionEligible loses its stop conjunct', 'planTradeLevels', 'p.executionEligible=runwayOk&&stopGeometryOk;', 'p.executionEligible=runwayOk;'],
  ['deletion', 'HTF context blocker deleted', 'analyze', "if(!result.context.ok)result.blockers.push('CONTEXT_OPPOSES_OR_UNKNOWN');", ''],
  ['deletion', 'tick-stale reason deleted', 'feedGate', "if(!Number.isFinite(tickAt)||now-tickAt>15000||tickAt>now+2000)reasons.push('TICK_STALE');", ''],
  ['deletion', 'reversal ignores data health', 'routeConfirmedReversal', '||!lane.dataHealth.executionOk', ''],
  ['deletion', 'opposing-FIRE conflict ignores side', 'analyze', '&&r.side!==best.side', ''],
  ['deletion', 'READY guard removed', 'analyze', READY, "if(true){result.state='READY'"],
  // rerouting: same dependency, different authority consequence
  ['reroute', 'PRICE_INVALID routed to another blocker code', 'analyze', "result.blockers.push('PRICE_INVALID')", "result.blockers.push('CONTEXT_OPPOSES_OR_UNKNOWN')"],
  ['reroute', 'cooldown no longer blocks the lane', 'checkSig', "if(now<cooldown){lane.executionBlock='Signal cooldown';continue;}", "if(now<cooldown){lane.executionBlock='Signal cooldown';}"],
];

// precision controls: must scan with zero defects
const CONTROLS = [
  // (an earlier version appended `// ok` mid-line, which commented out the code
  // after it on the same line; the baseline correctly reported a removed sink)
  ['block comment added inside an authority function', () => inOwner(BASE, 'analyze', 'const best=evaluated[0];', '/* reviewer note */ const best=evaluated[0];')],
  ['line comment on its own line inside an authority function', () => inOwner(BASE, 'feedGate', 'const unique=[...new Set(reasons)]', '// reviewer note\n    const unique=[...new Set(reasons)]')],
  ['whitespace reflowed inside an authority function', () => inOwner(BASE, 'feedGate', 'const unique=[...new Set(reasons)],executionBars=map[executionTf]||[];', 'const unique = [...new Set(reasons)],\n      executionBars = map[executionTf] || [];')],
];

const EXPECT_VOCAB = new Set(['Object.assign writes state READY', 'Object.assign with conditional source', 'Object.assign from an accepted variable']);
const rows = [];
for (const [cat, name, owner, anchor, rep] of CASES) {
  const expect = EXPECT_VOCAB.has(name) ? 'VOCAB' : 'SINK';
  let src, out = 'ERROR', detail = '';
  try {
    src = inOwner(BASE, owner, anchor, rep);
    const vocabOnly = S.scanSource(src, 'battery', { baseline: null }).inventoryDefects;
    if (vocabOnly.length) { out = 'VOCAB'; detail = vocabOnly[0].slice(0, 120); }
    else {
      const d = S.scanSource(src, 'battery').inventoryDefects;
      const sinkHit = d.find((x) => x.startsWith(`AUTHORITY_BASELINE_DRIFT: ${owner} `));
      const ownerHit = d.find((x) => x.startsWith('AUTHORITY_OWNER_DRIFT:') && x.includes(` ${owner} `));
      out = sinkHit ? 'SINK' : ownerHit ? 'OWNER' : d.length ? 'OTHER' : 'MISSED';
      detail = (sinkHit || ownerHit || d[0] || '').slice(0, 140);
    }
  } catch (e) { detail = e.message; }
  rows.push({ category: cat, name, owner, expect, outcome: out, pass: out === expect, detail });
  console.log(`${cat.padEnd(16)} ${name.padEnd(54)} ${out}${out === expect ? '' : '   <-- expected ' + expect}`);
}
const controls = [];
for (const [name, fn] of CONTROLS) {
  let n = -1, err = '';
  try { n = S.scanSource(fn(), 'control').inventoryDefects.length; } catch (e) { err = e.message; }
  controls.push({ name, defects: n, error: err });
  console.log(`control          ${name.padEnd(54)} ${n === 0 ? 'clean' : 'DEFECTS ' + n + ' ' + err}`);
}
const clean = S.scanSource(BASE, 'clean').inventoryDefects.length;
const count = (o) => rows.filter((r) => r.outcome === o).length;
const summary = { cases: rows.length, failed: rows.filter((r) => !r.pass).length, sink: count('SINK'), vocab: count('VOCAB'), ownerOnly: count('OWNER'), other: count('OTHER'), missed: count('MISSED'), errors: count('ERROR'), controlsFailed: controls.filter((c) => c.defects !== 0).length, cleanArtifactDefects: clean };
console.log(`--- ${summary.cases} cases, failed ${summary.failed}: sink ${summary.sink}, vocab ${summary.vocab}, owner-only ${summary.ownerOnly}, other ${summary.other}, missed ${summary.missed}, errors ${summary.errors}; controls failed ${summary.controlsFailed}; clean-artifact defects ${clean}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ scanner: path.relative(path.join(__dirname, '..'), scannerPath), summary, rows, controls }, null, 2) + '\n');
if (summary.failed || summary.controlsFailed || clean) process.exitCode = 1;
