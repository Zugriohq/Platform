'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const EV = path.join(ROOT, 'evidence');
const ART = path.join(ROOT, 'artifacts', 'Zugrio-1.0.0-gate2.2.html');
const DIRTY = path.join(ROOT, 'artifacts', 'Zugrio-1.0.0-gate2.1.html');
const invDoc = JSON.parse(fs.readFileSync(path.join(EV, 'GATE3-AUTHORITY-INVENTORY.json'), 'utf8'));
const inv = invDoc.inventory;
const sweepDoc = JSON.parse(fs.readFileSync(path.join(EV, 'GATE3-ATR-SEMANTIC-SWEEP.json'), 'utf8'));
const sweep = sweepDoc.report;
const scanner = require('../tools/gate3-authority-inventory');

const GATE2_2 = '52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178';

function field(name) {
  const f = inv.fields.find((x) => x.field === name);
  assert.ok(f, `missing inventory field ${name}`);
  return f;
}

function rawScripts(file = ART) {
  const html = fs.readFileSync(file, 'utf8');
  return scanner.inlineScripts(html).join('\n');
}

test('3A-01 evidence is bound to the cleared Gate 2.2 artifact', () => {
  assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(ART)).digest('hex'), GATE2_2);
  assert.strictEqual(inv.artifactSha256, GATE2_2);
  assert.strictEqual(sweep.artifactSha256, GATE2_2);
});

test('3A-02 authority inventory is sink-first and closed under live dependencies', () => {
  assert.strictEqual(inv.methodology, 'SINK_FIRST');
  assert.deepStrictEqual(inv.inventoryDefects, []);
  assert.ok(inv.totals.reachableAuthoritySinks > 0, 'no live authority sinks discovered');
  assert.ok(inv.totals.fields >= 30, 'inventory unexpectedly small');
  for (const s of inv.sinks.filter((x) => x.reachability === 'REACHABLE_AUTHORITY')) {
    assert.ok(Array.isArray(s.dependencies), `${s.id} has no discovered dependencies array`);
  }
});

test('3A-03 undeclared gate mutation is detected without adding it to field metadata', () => {
  const original = rawScripts();
  const needle = "if(!result.blockers.length){result.state='READY'";
  assert.ok(original.includes(needle), 'mutation anchor missing; test would be vacuous');
  const mutated = original.replace(needle, "if(!result.blockers.length&&mysteryAuthorityGate){result.state='READY'");
  const m = scanner.scanSource(mutated, 'mutation');
  assert.ok(m.inventoryDefects.some((d) => d.includes("mysteryAuthorityGate")),
    'sink-first scanner failed to detect an undeclared READY gate');
});

test('3A-04 reachability separates the live profile engine from dead legacy state machinery', () => {
  for (const name of ['updateSignalState','checkSig','analyze','feedGate','familyGate','plan','lifecycle']) {
    assert.ok(inv.liveReachableFunctions.includes(name), `${name} should be live-reachable`);
  }
  for (const name of ['updateLegacySignalState','checkLegacySig']) {
    assert.ok(!inv.liveReachableFunctions.includes(name), `${name} unexpectedly live-reachable`);
    assert.ok(inv.unreachableLegacyFunctions.includes(name), `${name} not recorded as legacy`);
  }
});

test('3A-05 evaln/evaluateStrategy is decomposed at member level with reachability preserved', () => {
  const members = [
    'LEGACY_EVAL_SCORE','LEGACY_EVAL_DIRECTION','LEGACY_EVAL_PRIMARY_SETUP',
    'LEGACY_EVAL_FAMILY_COUNTS','LEGACY_EVAL_SPECIALIST','LEGACY_EVAL_RISK_SCALE','LEGACY_EVAL_THESIS'
  ];
  for (const name of members) field(name);
  assert.ok(field('LEGACY_EVAL_SCORE').reachabilityClasses.includes('REACHABLE_AUTHORITY'),
    'live strategyPreview.score data-acquisition authority was lost');
  assert.ok(field('LEGACY_EVAL_SCORE').reachabilityClasses.includes('UNREACHABLE_LEGACY'),
    'dead evaln.score state consumers were not distinguished');
  assert.ok(field('LEGACY_EVAL_PRIMARY_SETUP').reachabilityClasses.includes('UNREACHABLE_LEGACY'));
});

test('3A-06 all four grade semantic families are mapped and none is hard-admitted by wrapping', () => {
  const families = ['REGIME_QUALITY_OK','HTF_GRADE_NOT_C','REWARD_GRADE_NOT_C','TRIGGER_GRADE_NOT_C'];
  for (const fam of families) {
    const rows = inv.fields.filter((x) => x.semanticFamily === fam);
    assert.ok(rows.length > 0, `semantic family ${fam} is missing`);
    for (const r of rows) {
      assert.notStrictEqual(r.predicateAdmission, 'ADMITTED', `${r.field} silently hard-admitted ${fam}`);
    }
  }
});

test('3A-07 proposed predicate names with undeclared constituent provenance remain unadmitted', () => {
  const entry = field('ENTRY_EVENT_CONFIRMED');
  assert.strictEqual(entry.predicateAdmission, 'CANDIDATE_UNADMITTED');
  assert.notStrictEqual(entry.gate3Classification, 'HARD_STRUCTURAL_PREDICATE',
    'ENTRY_EVENT_CONFIRMED was created by renaming legacy trigger authority');
  assert.match(entry.thresholdSource, /UNDECLARED/i);
  for (const f of inv.fields.filter((x) => x.gate3Classification === 'HARD_STRUCTURAL_PREDICATE' && x.predicateAdmission === 'ADMITTED')) {
    assert.doesNotMatch(f.thresholdSource, /UNDECLARED|to be declared/i, `${f.field} admitted without provenance`);
  }
});

test('3A-08 DATA_HEALTH_OK and GEOMETRY_COMPLETE are candidates, not silently approved composites', () => {
  for (const name of ['DATA_HEALTH_OK','GEOMETRY_COMPLETE']) {
    const f = field(name);
    assert.strictEqual(f.predicateAdmission, 'CANDIDATE_UNADMITTED');
    assert.match(f.intendedDestination, /after|until|decompose|only after|constituent/i);
  }
});

test('3A-09 planner economics are explicitly mapped out of Layer 1/state authority', () => {
  const econ = field('REWARD_ECONOMIC_QUALITY');
  assert.ok(econ.reachabilityClasses.includes('REACHABLE_AUTHORITY'));
  assert.strictEqual(econ.gate3Classification, 'LEGACY_REMOVE');
  assert.match(econ.semanticMeaning, /Gross R|net R|cost R/i);
  assert.match(econ.intendedDestination, /ExecutionSnapshot|Gate-4/i);
  assert.ok(field('PLAN_STATUS').reachabilityClasses.includes('REACHABLE_AUTHORITY'));
  assert.ok(field('PLAN_BLOCKERS').reachabilityClasses.includes('REACHABLE_AUTHORITY'));
});

test('3A-10 current selection authority is mapped, including state/lifecycle/context/age/conflict/profile scope', () => {
  for (const name of ['STATE_RANK','LIFECYCLE_RANK','HTF_CONTEXT_QUALITY','CAUSAL_AGE','OPPOSING_FIRE_CONFLICT','PROFILE_SELECTION']) {
    const f = field(name);
    assert.ok(f.reachabilityClasses.includes('REACHABLE_AUTHORITY'), `${name} missing live selection reachability`);
  }
});

/**
 * Load the live profile engine from the frozen artifact, with the outer
 * dependencies it reads supplied from the SAME artifact (canonical ATR block
 * and TTI_FOUNDATION_REFERENCE). Used to prove behaviour, not just structure.
 */
function loadProfileEngine(file = ART) {
  const vm = require('node:vm');
  const html = fs.readFileSync(file, 'utf8');
  const src = scanner.inlineScripts(html).join('\n');
  const atrStart = src.indexOf('/* ============================ GATE 2 =======');
  // From the Gate 2 marker to the legacy `atr` delegate. In the 2.1+ artifact the
  // Gate 2.1 fail-closed block sits inside this span already, so it is not added
  // separately (doing so declared ZUGRIO_ATR_INSUFFICIENT twice).
  const atrBlock = src.slice(atrStart, src.indexOf('function atr(ca,p=14)', atrStart));
  const refM = /^const TTI_FOUNDATION_REFERENCE\s*=/m.exec(src);
  let d = 0, i = src.indexOf('{', refM.index), end = -1;
  for (let j = i; j < src.length; j++) { if (src[j] === '(' || src[j] === '{') d++; else if (src[j] === ')' || src[j] === '}') { d--; if (d === 0) { end = src.indexOf(';', j); break; } } }
  const ref = src.slice(refM.index, end + 1);
  const a = html.indexOf('var TTI_PROFILE_ENGINE = (function () {'), b = html.indexOf('})();', a);
  const code = atrBlock + '\n' + ref + '\n' + html.slice(a, b + 5) + '\n;TTI_PROFILE_ENGINE;';
  return vm.runInContext(code, vm.createContext({ console }), { filename: 'profile-engine.js' });
}

function impulseFrames(seed, mult) {
  const frames = {};
  for (const [tf, sec] of Object.entries({ M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400 })) {
    let st = seed >>> 0; const r = () => { st = (Math.imul(st, 1103515245) + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    const out = []; let p = 100; const vol = tf === 'H4' ? 2.4 : 0.6;
    for (let k = 0; k < 520; k++) {
      const o = p; let c, h, l;
      if (k > 20 && k % 37 === 0) { const dir = (k / 37) % 2 === 0 ? 1 : -1; c = o + dir * vol * mult; h = Math.max(o, c) + vol * 0.1; l = Math.min(o, c) - vol * 0.1; }
      else { c = o + Math.sin(k / 6) * vol * 0.4 + (r() - 0.5) * vol * 0.5; h = Math.max(o, c) + r() * vol * 0.35; l = Math.min(o, c) - r() * vol * 0.35; }
      out.push({ t: 1700000000 + k * sec, o, h, l, c, v: 500 }); p = c;
    }
    frames[tf] = out;
  }
  return frames;
}

test('3A-11 research and advisory semantics are explicit; the one live research flow is proven non-influencing', () => {
  assert.strictEqual(field('RESEARCH_CONTINUATION').gate3Classification, 'RESEARCH_HEURISTIC');
  assert.strictEqual(field('DATA_ADVISORY_FEATURES').gate3Classification, 'ADVISORY_FEATURE');

  // Producer closure surfaced a genuine data flow the old scanner could not see:
  // updateSignalState passes `continuationReference: continuationReferenceEnabled`
  // INTO the live authority call TTI_PROFILE_ENGINE.analyze(...), whose result
  // drives lane.state. A static map cannot prove that argument has no effect, so
  // this test does not relax the requirement. It pins the flow to exactly that
  // one argument, and then proves non-influence BEHAVIOURALLY.
  const live = field('RESEARCH_CONTINUATION').consumers.filter((c) => c.reachability === 'REACHABLE_AUTHORITY');
  assert.ok(live.length >= 1, 'expected the analyze() argument flow to be visible');
  for (const c of live) {
    assert.strictEqual(c.owner, 'updateSignalState', `unexpected live research consumer in ${c.owner}`);
    assert.strictEqual(c.token, 'continuationReferenceEnabled', `unexpected live research token ${c.token}`);
    assert.ok(/TTI_PROFILE_ENGINE\.analyze\(/.test(c.expression) && /continuationReference\s*:\s*continuationReferenceEnabled/.test(c.expression),
      'live research flow is not the analyze() continuationReference argument');
  }

  // Behavioural proof on THIS frozen artifact: production output is byte-identical
  // with the research toggle off and on. Only research capture may differ.
  const eng = loadProfileEngine();
  let compared = 0, active = 0;
  for (const seed of [1, 2, 3, 5, 8, 13]) {
    for (const mult of [4, 6, 9]) {
      const frames = impulseFrames(seed, mult);
      const now = (frames.M5.at(-1).t + 300) * 1000;
      const run = (flag) => eng.analyze({ key:'EURUSD', profileId:'DAY', frames, price:frames.M5.at(-1).c, now,
        tickAt:now, tickSize:0.0001, spread:0.00012, family:'FOREX', assetBias:'BUY', regime:'TRENDING',
        continuationReference:flag, consumed:[] });
      const off = run(false), on = run(true);
      assert.strictEqual(JSON.stringify(off), JSON.stringify(on), `research toggle changed production output (seed=${seed} mult=${mult})`);
      if ((off.candidates || []).length) active++;
      compared++;
    }
  }
  assert.ok(compared >= 18, `too few behavioural comparisons: ${compared}`);
  assert.ok(active >= 9, `only ${active}/${compared} fixtures produced candidates; the comparison would be vacuous`);
});

test('3A-12 ATR semantic sweep resolves every statement and has zero permissive capital branch', () => {
  assert.strictEqual(sweep.totals.unresolvedShapes, 0);
  assert.strictEqual(sweep.totals.permissiveAuthorityBranches, 0);
  assert.strictEqual(sweep.totals.atrBindings, 53);
  assert.strictEqual(sweep.totals.distinctConsumerStatements, 96);
  for (const s of sweep.allSites) {
    assert.ok(s.shape && s.shape !== 'UNRECOGNISED');
    assert.ok(s.verdict);
  }
});

test('3A-13 ATR scanner still recognises both historical permissive-NaN shapes', () => {
  const { classify } = require('../tools/gate3-atr-sweep');
  const bias = classify("return Math.abs(move)<v*0.25?'NEUTRAL':move>0?'BUY':'SELL'", 'v');
  assert.strictEqual(bias.shape, 'TERNARY_WITH_PERMISSIVE_ELSE');
  assert.strictEqual(bias.verdict, 'PERMISSIVE');
  const shock = classify('b.h-b.l>Math.max(atr(bars,i),av)*3', 'av');
  assert.strictEqual(shock.shape, 'NAN_PROPAGATING_AGGREGATE');
  assert.strictEqual(shock.verdict, 'PERMISSIVE');
});

test('3A-14 ATR sweep is non-vacuous against defective Gate 2.1 and clean on Gate 2.2', () => {
  const tool = path.join(ROOT, 'tools', 'gate3-atr-sweep.js');
  const run = (artifact) => {
    execFileSync(process.execPath, [tool, artifact], { cwd: ROOT, encoding:'utf8' });
    return JSON.parse(fs.readFileSync(path.join(EV, 'GATE3-ATR-SEMANTIC-SWEEP.json'), 'utf8')).report;
  };
  try {
    const bad = run(DIRTY);
    assert.ok(bad.totals.permissiveAuthorityBranches + bad.totals.unresolvedShapes > 0,
      'dirty artifact unexpectedly passed ATR sweep');
    assert.ok(bad.permissiveBranches.some((s) => s.owner === 'bias'));
  } finally {
    const good = run(ART);
    assert.strictEqual(good.artifactSha256, GATE2_2);
    assert.strictEqual(good.totals.permissiveAuthorityBranches, 0);
    assert.strictEqual(good.totals.unresolvedShapes, 0);
  }
});

test('3A-15 admitted hard predicates have explicit non-P/L/safety provenance', () => {
  const admitted = inv.fields.filter((x) => x.gate3Classification === 'HARD_STRUCTURAL_PREDICATE' && x.predicateAdmission === 'ADMITTED');
  assert.ok(admitted.length > 0);
  for (const f of admitted) {
    assert.match(f.thresholdSource, /independent of profitability|data insufficiency|validity|identity|idempotency|market schedule|execution feasibility/i,
      `${f.field} lacks explicit independent provenance`);
  }
});

test('3A-16 generated report counters agree with the JSON evidence', () => {
  const map = fs.readFileSync(path.join(EV, 'GATE3A-FROZEN-MAP.md'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const doc of [map, readme]) {
    assert.match(doc, new RegExp(`${inv.totals.fields} classified semantic fields`));
    assert.match(doc, new RegExp(`${inv.totals.sinks} authority sink records`));
    assert.match(doc, new RegExp(`${sweep.totals.atrBindings} ATR bindings`));
    assert.match(doc, new RegExp(`${sweep.totals.distinctConsumerStatements} ATR consumer statements`));
  }
});

test('3A-17 browser broker/execution boundary is inventoried rather than treated as outside authority', () => {
  for (const name of ['route','makeIntent','routeConfirmedReversal','closePosition']) {
    assert.ok(inv.liveReachableFunctions.includes(name), `${name} is an exposed/live broker authority surface`);
  }
  for (const name of [
    'BROKER_EXECUTION_ADMISSION','BROKER_SUBMISSION','CALIBRATION_PERMISSION',
    'LEGACY_EXECUTION_PERMISSION_ASSERTION','POSITION_MANAGEMENT_GATE',
    'MANUAL_RISK_REDUCTION','RISK_REDUCING_DATA_BYPASS','RISK_SCALE'
  ]) {
    const f = field(name);
    assert.ok(f.reachabilityClasses.includes('REACHABLE_AUTHORITY'), `${name} missing live broker reachability`);
  }
  const submitKinds = new Set(inv.sinks.filter((s) => s.reachability === 'REACHABLE_AUTHORITY' && s.owner.match(/^(route|routeConfirmedReversal|closePosition)$/)).map((s) => s.kind));
  for (const kind of ['BROKER_ENTRY_SUBMISSION','BROKER_EXIT_SUBMISSION','BROKER_CLOSE_SUBMISSION']) {
    assert.ok(submitKinds.has(kind), `${kind} not frozen as an execution sink`);
  }
});

test('3A-18 undeclared broker admission mutation is detected', () => {
  const original = rawScripts();
  const needle = "state.status.executionMode!=='DEMO'||!state.status.armed";
  assert.ok(original.includes(needle), 'broker mutation anchor missing; test would be vacuous');
  const mutated = original.replace(needle, `${needle}||mysteryBrokerPermission`);
  const m = scanner.scanSource(mutated, 'broker-mutation');
  assert.ok(m.inventoryDefects.some((d) => d.includes('mysteryBrokerPermission')),
    'scanner failed to detect a new undeclared broker permission gate');
});



test('3A-19 verdict-write initializers are first-class sinks, including READY/FIRE and live planner verdicts', () => {
  const verdicts = inv.sinks.filter((s) => s.kind === 'VERDICT_WRITE');
  assert.ok(verdicts.length >= 20, `verdict-write inventory unexpectedly small: ${verdicts.length}`);
  for (const [owner,target] of [
    ['updateLegacySignalState','readyOk'],
    ['updateLegacySignalState','fireOk'],
    ['planTradeLevels','runwayOk'],
    ['planTradeLevels','stopGeometryOk'],
  ]) {
    assert.ok(verdicts.some((s) => s.owner === owner && s.verdictTarget === target),
      `missing verdict-write sink ${owner}.${target}`);
  }
});

test('3A-20 undeclared dependency injected into READY verdict WRITE is detected', () => {
  const original = rawScripts();
  const needle = "const readyOk=evaln.score>=(primary?0.46:V5_THRESH.ready)&&";
  assert.ok(original.includes(needle), 'READY verdict-write mutation anchor missing; test would be vacuous');
  const mutated = original.replace(needle, "const readyOk=secretEdgeFilter(k)&&evaln.score>=(primary?0.46:V5_THRESH.ready)&&");
  const m = scanner.scanSource(mutated, 'ready-verdict-write-mutation');
  assert.ok(m.inventoryDefects.some((d) => d.includes('secretEdgeFilter')),
    'scanner failed to detect undeclared authority inside readyOk initializer');
});

test('3A-21 undeclared dependency injected into live executionEligible verdict WRITE is detected', () => {
  const original = rawScripts();
  const needle = 'p.executionEligible=runwayOk&&stopGeometryOk;';
  assert.ok(original.includes(needle), 'executionEligible verdict-write mutation anchor missing; test would be vacuous');
  const mutated = original.replace(needle, 'p.executionEligible=runwayOk&&stopGeometryOk&&undeclaredProfitFilter(runwayOk);');
  const m = scanner.scanSource(mutated, 'execution-verdict-write-mutation');
  assert.ok(m.inventoryDefects.some((d) => d.includes('undeclaredProfitFilter')),
    'scanner failed to detect undeclared authority inside executionEligible initializer');
});

test('3A-22 LEGACY_REMOVE explicitly distinguishes deletion from required successor replacement', () => {
  for (const name of ['LIFECYCLE_STAGE','ENTRY_EVENT_CONFIRMED','RISK_REDUCING_DATA_BYPASS']) {
    const f = field(name);
    assert.strictEqual(f.gate3Classification, 'LEGACY_REMOVE');
    assert.strictEqual(f.migrationDisposition, 'REMOVE_LEGACY_AUTHORITY_AND_REPLACE_AS_SPECIFIED',
      `${name} could be misread as delete-without-successor`);
    assert.ok(f.intendedDestination.length > 20, `${name} successor destination is not explicit`);
  }
});



test('3A-23 all twelve challenged verdict-write names are explicitly dispositioned, with authority/research producers sink-covered', () => {
  const required = ['readyOk','fireOk','executionEligible','econOk','thesisOk','runwayOk','stopGeometryOk','coreOk','regimeOk','priceValid','directEligible','allValid'];
  for (const name of required) {
    assert.ok(inv.verdictAudit.some((r) => r.name === name), `verdict audit omitted ${name}`);
  }
  const mustBeSinkCovered = new Set(['readyOk','fireOk','executionEligible','runwayOk','stopGeometryOk','coreOk','regimeOk','directEligible']);
  for (const r of inv.verdictAudit) {
    if (mustBeSinkCovered.has(r.name)) assert.strictEqual(r.sinkCovered, true, `${r.name} producer is not a first-class verdict sink`);
  }
  for (const name of ['econOk','thesisOk','priceValid','allValid']) {
    const rows = inv.verdictAudit.filter((r) => r.name === name);
    assert.ok(rows.every((r) => /RENDERER_ONLY|LOGGING_OUTCOME_ONLY|PRESENTATION_AGGREGATION_ONLY/.test(r.disposition)),
      `${name} lacks an explicit non-authority disposition`);
  }
});

test('3A-24 all inline scripts in the frozen source still parse', () => {
  const vm = require('node:vm');
  const scripts = scanner.inlineScripts(fs.readFileSync(ART, 'utf8'));
  assert.strictEqual(scripts.length, 7, 'unexpected inline-script count; review extraction boundary');
  scripts.forEach((src, i) => assert.doesNotThrow(() => new vm.Script(src, { filename:`inline-${i}.js` })));
});

/* ======================================================================== *
 * Gate 3A verdict-write closure, round 3.
 *
 * Three live misses found by independent review:
 *   1. an undeclared conjunct on feedGate's returned `coreOk:` property;
 *   2. a brand-new field on a live gate's returned record;
 *   3. a post-declaration REASSIGNMENT of a declaration-covered live verdict.
 * ======================================================================== */

/**
 * Replace `anchor` with `replacement` ONLY inside `owner`, and assert that it
 * landed there. The reviewer's own first probes used a plain replace(), which
 * hits the first occurrence anywhere; three of them silently mutated
 * calibrationAudit, exportHistCSV and emptyLevelPlan instead of the intended
 * live gates and reported misses that were not real. A mutation test that can
 * land in the wrong function proves nothing either way.
 */
function mutateInOwner(owner, anchor, replacement, src = rawScripts()) {
  const idx = scanner.functionIndex(src);
  let p = -1;
  while ((p = src.indexOf(anchor, p + 1)) >= 0) {
    if (scanner.ownerOf(idx, p) === owner) {
      const out = src.slice(0, p) + replacement + src.slice(p + anchor.length);
      const landed = scanner.ownerOf(scanner.functionIndex(out), p);
      assert.strictEqual(landed, owner, `mutation intended for ${owner} landed in ${landed}`);
      return out;
    }
  }
  assert.fail(`anchor ${JSON.stringify(anchor)} not found inside ${owner}; test would be vacuous`);
}

test('3A-25 undeclared conjunct on a live gate RETURN PROPERTY (feedGate coreOk:) is detected', () => {
  assert.ok(inv.liveReachableFunctions.includes('feedGate'), 'feedGate must be live for this test to mean anything');
  const m = scanner.scanSource(mutateInOwner('feedGate',
    'coreOk:ZUGRIO_ATR_OK(atr(executionBars))',
    'coreOk:ZUGRIO_ATR_OK(atr(executionBars))&&mysteryPolicy(executionBars)'), 'gate-return-property');
  assert.ok(m.inventoryDefects.some((d) => d.includes('mysteryPolicy') && d.includes('coreOk')),
    `feedGate coreOk: return-property mutation not detected: ${m.inventoryDefects.join(' | ')}`);
});

test('3A-26 a NEW field on a live gate record is detected by the frozen schema, whatever its name or value', () => {
  // Three shapes a dependency check alone cannot catch together:
  //  - an innocuous name that does not look like a verdict;
  //  - a bare literal with no undeclared token at all (`forceExecute:true`);
  //  - a verdict-shaped name.
  const cases = [
    ['feedGate',   'required,atrRequired',  'required,atrRequired,hiddenGate:mysteryPolicy(map)', 'hiddenGate'],
    ['familyGate', 'return{ok:',            'return{hint:mysteryPolicy(k),ok:',                    'hint'],
    ['makeIntent', 'riskFraction:',         'forceExecute:true,riskFraction:',                     'forceExecute'],
    ['plan',       'plannerStatus:',        'sneakyOk:mysteryPolicy(entry),plannerStatus:',        'sneakyOk'],
  ];
  for (const [owner, anchor, repl, name] of cases) {
    const m = scanner.scanSource(mutateInOwner(owner, anchor, repl), `new-field-${name}`);
    assert.ok(m.inventoryDefects.some((d) => d.includes(`unregistered gate return field '${name}'`)),
      `${owner}: new field '${name}' not detected: ${m.inventoryDefects.join(' | ')}`);
  }
});

test('3A-27 REASSIGNMENT of a declaration-covered live verdict is detected', () => {
  const cases = [
    ['computeTargets', 'const runwayOk=t1RR!=null&&t1RR>=readyMinTP1R-1e-12',
      'let runwayOk=t1RR!=null&&t1RR>=readyMinTP1R-1e-12;runwayOk=runwayOk&&postHocFilter(t1RR)'],
    ['planTradeLevels', 'const stopGeometryOk=isFinite(stopATR)&&stopATR<=maxStopATR+1e-12',
      'let stopGeometryOk=isFinite(stopATR)&&stopATR<=maxStopATR+1e-12;stopGeometryOk=stopGeometryOk&&postHocFilter(stopATR)'],
  ];
  for (const [owner, anchor, repl] of cases) {
    assert.ok(inv.liveReachableFunctions.includes(owner), `${owner} must be live`);
    const m = scanner.scanSource(mutateInOwner(owner, anchor, repl), `reassign-${owner}`);
    assert.ok(m.inventoryDefects.some((d) => d.includes('postHocFilter')),
      `${owner}: post-declaration reassignment not detected: ${m.inventoryDefects.join(' | ')}`);
  }
});

test('3A-28 reassignment coverage records the write form, so it is auditable rather than implied', () => {
  const forms = new Set(inv.sinks.filter((s) => s.writeForm).map((s) => s.writeForm));
  for (const f of ['BARE', 'MEMBER', 'RETURN_PROPERTY']) {
    assert.ok(forms.has(f), `no sink records write form ${f}`);
  }
  // the clean artifact genuinely contains a reassigned lifecycle verdict, which
  // only reassignment coverage could surface
  const overlap = inv.sinks.find((s) => s.owner === 'lifecycle' && s.verdictTarget === 'overlap' && s.writeForm === 'BARE_REASSIGN');
  assert.ok(overlap, 'reassigned lifecycle `overlap` verdict was not surfaced');
  assert.ok(overlap.dependencies.every((d) => d.canonical === 'LIFECYCLE_STAGE'),
    'reassigned `overlap` must classify to LIFECYCLE_STAGE');
});

test('3A-29 gate-return schema is frozen from Gate 2.2, clean artifact conforms, dead owners are not held to it', () => {
  assert.strictEqual(inv.artifactSha256, GATE2_2);
  const schema = inv.gateReturnSchema;
  for (const g of ['feedGate', 'familyGate', 'plan', 'lifecycle', 'makeIntent']) {
    assert.ok(Array.isArray(schema[g]) && schema[g].length > 0, `${g} has no frozen return schema`);
    assert.ok(inv.liveReachableFunctions.includes(g), `${g} is schema-frozen but not live`);
  }
  assert.ok(Object.isFrozen(scanner.GATE_RETURN_SCHEMA), 'schema object is mutable at runtime');
  assert.ok(!inv.inventoryDefects.some((d) => /unregistered gate return field/.test(d)),
    'the clean artifact violates its own frozen schema');
  // a new field on an UNREACHABLE legacy owner must not block the live freeze
  const legacy = mutateInOwner('updateLegacySignalState', 'const readyOk=', 'const unrelatedLocal=1;const readyOk=');
  const m = scanner.scanSource(legacy, 'legacy-field');
  assert.ok(!m.inventoryDefects.some((d) => d.startsWith('updateLegacySignalState: unregistered gate return field')),
    'dead legacy owner was held to the live gate schema');
});

test('3A-30 the fallthrough reachability state is published, not hidden inside classifyReachability', () => {
  assert.deepStrictEqual(inv.unreachableByNamedLegacy, ['checkLegacySig', 'updateLegacySignalState']);
  for (const o of ['assessDataHealth', 'assessTrigger', 'validateFireGeometry']) {
    assert.ok(inv.unreachableByFallthrough.includes(o), `${o} not published as fallthrough-unreachable`);
    assert.ok(inv.unreachableLegacyFunctions.includes(o), `${o} missing from unreachableLegacyFunctions`);
  }
  assert.ok(/REACHABLE_AUTHORITY iff/.test(inv.reachabilityRule), 'reachability rule not stated');
  // and each fallthrough owner genuinely has only legacy callers, with no
  // dynamic or string-dispatched reference that a static call graph could miss
  const src = rawScripts(), code = scanner.blankNonCode(src), idx = scanner.functionIndex(src);
  for (const fn of inv.unreachableByFallthrough) {
    const callers = new Set();
    const re = new RegExp(`\\b${fn}\\s*\\(`, 'g'); let mm;
    while ((mm = re.exec(code))) {
      if (!code.slice(Math.max(0, mm.index - 12), mm.index).includes('function')) callers.add(scanner.ownerOf(idx, mm.index));
    }
    for (const c of callers) assert.ok(inv.unreachableLegacyFunctions.includes(c), `${fn} is called by non-legacy ${c}`);
    assert.ok(!new RegExp(`['"]${fn}['"]|window\\.${fn}|globalThis\\.${fn}`).test(src), `${fn} has a dynamic reference`);
  }
});

test('3A-31 PRICE_VALID record distinguishes the admitted predicate from the logging-only write', () => {
  const f = field('PRICE_VALID');
  assert.strictEqual(f.predicateAdmission, 'ADMITTED');
  assert.ok(/analyze\(\)/.test(f.intendedDestination), 'live consumer in analyze() not named');
  assert.ok(/LOGGING_OUTCOME_ONLY/.test(f.intendedDestination) && /finalizeOutcome/.test(f.intendedDestination),
    'logging-only priceValid write not distinguished from the predicate');
  const audit = inv.verdictAudit.find((r) => r.name === 'priceValid');
  assert.strictEqual(audit.disposition, 'LOGGING_OUTCOME_ONLY');
});

test('3A-32 every dependency the new sinks surfaced classifies to an EXISTING catalogue field', () => {
  // The closure must not buy a clean scan by inventing fields. The field count
  // is unchanged at 46 and the three previously invisible dependencies land in
  // fields that already existed.
  // Round 7 added exactly one field, BROKER_ORDER_PAYLOAD, when every submitted
  // order field became a sink; it may only be consumed by the order builders.
  assert.strictEqual(inv.fields.length, 47, 'closure added or removed semantic fields');
  const bop = field('BROKER_ORDER_PAYLOAD');
  // (the reversal exit's idempotency key is built from the same identity fields,
  // so its producer write in routeConfirmedReversal is the one allowed non-field consumer)
  assert.ok(bop.consumers.length > 0 && bop.consumers.every((c) => ['makeIntent','routeConfirmedReversal'].includes(c.owner) &&
    (c.kind === 'BROKER_ORDER_FIELD' || (c.kind === 'AUTHORITY_PRODUCER_WRITE' && c.owner === 'routeConfirmedReversal'))),
    'BROKER_ORDER_PAYLOAD classifies something other than a submitted order field');
  const newSinks = inv.sinks.filter((s) => ['GATE_FIELD_WRITE'].includes(s.kind) || s.writeForm === 'BARE_REASSIGN');
  assert.ok(newSinks.length > 0, 'no new sinks recorded');
  const existing = new Set(inv.fields.map((f) => f.field));
  for (const s of newSinks) for (const d of s.dependencies) {
    assert.ok(existing.has(d.canonical), `${s.id} depends on non-catalogue field ${d.canonical}`);
  }
  // coreStrategyEvaluate has two `eligible` returns: an early `eligible:false`
  // with no dependencies, and the real `eligible: score>=V5_THRESH.watch`.
  // Select the gated one explicitly rather than whichever comes first.
  const eligible = inv.sinks.filter((s) => s.owner === 'coreStrategyEvaluate' && s.verdictTarget === 'return.eligible');
  assert.ok(eligible.length >= 2, 'expected both the early and the gated eligible return');
  const gated = eligible.find((s) => /V5_THRESH\.watch/.test(s.expression));
  assert.ok(gated, 'the WATCH-prior-gated eligible return was not surfaced');
  assert.ok(gated.reachability === 'REACHABLE_AUTHORITY', 'gated eligible should be live authority');
  assert.ok(gated.dependencies.length > 0 && gated.dependencies.every((d) => d.canonical === 'LEGACY_EVAL_SCORE'),
    'gated eligible is not classified as LEGACY_EVAL_SCORE');
});

test('3A-33 a gate returning its record by ALIAS is covered: new fields and conjuncts on the alias are detected', () => {
  // lifecycle builds `c`, mutates it and returns it four times via `return c;`.
  // Literal-return parsing alone left lifecycle's whole returned authority record
  // invisible. It also meant the first frozen schema was wrong for lifecycle.
  const lifecycleFields = inv.gateReturnSchema.lifecycle;
  for (const f of ['stage', 'triggerAt', 'triggerFresh', 'touchAt', 'expiresAt']) {
    assert.ok(lifecycleFields.includes(f), `lifecycle schema misses alias-written field ${f}`);
  }
  const cases = [
    ['lifecycle', 'return c;', 'c.forceFire=mysteryPolicy(c);return c;', /unregistered gate return field 'forceFire'/],
    ['lifecycle', 'return c;', 'c.note=true;return c;', /unregistered gate return field 'note'/],
    ['lifecycle', "c.stage='RETEST_TOUCHED'", "c.stage=mysteryPolicy(c)?'RETEST_TOUCHED':'EXPIRED'", /mysteryPolicy/],
    ['lifecycle', 'c.triggerFresh=i===bars.length-1', 'c.triggerFresh=i===bars.length-1&&mysteryPolicy(c)', /mysteryPolicy/],
    ['analyze', 'return result;', 'result.hiddenAuthority=mysteryPolicy(result);return result;', /unregistered gate return field 'hiddenAuthority'/],
  ];
  for (const [owner, anchor, repl, expect] of cases) {
    const m = scanner.scanSource(mutateInOwner(owner, anchor, repl), `alias-${owner}`);
    assert.ok(m.inventoryDefects.some((d) => expect.test(d)),
      `${owner}: alias mutation ${JSON.stringify(repl.slice(0, 40))} not detected: ${m.inventoryDefects.join(' | ')}`);
  }
  // every alias field is schema-frozen, but only authority-bearing alias fields
  // are dependency-closed; human-readable reason text is not treated as authority
  const aliasSinks = inv.sinks.filter((s) => s.writeForm === 'ALIAS_MEMBER_WRITE');
  assert.ok(aliasSinks.some((s) => s.verdictTarget === 'return.c.stage'), 'c.stage alias write is not a sink');
  assert.ok(!aliasSinks.some((s) => /\.reason$/.test(s.verdictTarget)), 'reason text was promoted to an authority sink');
});

test('3A-34 a gate populating its returned alias through Object.assign is covered', () => {
  // planTradeLevels: const p = emptyLevelPlan(...); Object.assign(p, {...}); return p;
  // The first frozen schema held 5 fields for the live planner; the real returned
  // record carries 39. A field injected through Object.assign was invisible.
  assert.ok(inv.liveReachableFunctions.includes('planTradeLevels'));
  const fields = inv.gateReturnSchema.planTradeLevels;
  assert.ok(fields.length >= 39, `planTradeLevels schema still incomplete: ${fields.length} fields`);
  for (const f of ['direction', 'setupType', 'entryRoute', 'referenceEntry']) {
    assert.ok(fields.includes(f), `planTradeLevels schema misses Object.assign field ${f}`);
  }
  const m = scanner.scanSource(mutateInOwner('planTradeLevels', 'Object.assign(p,{', 'Object.assign(p,{forceExecute:true,'), 'object-assign');
  assert.ok(m.inventoryDefects.some((d) => /unregistered gate return field 'forceExecute'/.test(d)),
    `field injected through Object.assign not detected: ${m.inventoryDefects.join(' | ')}`);
});

test('3A-35 spread sources are frozen at their producer, so a field cannot enter a live record through ...spread', () => {
  // lifecycle builds `c = {...seed, ...}` and analyze builds `result = {...base, ...}`.
  // The gate schema only sees a `<spread>` placeholder there. Rather than chase the
  // spread across functions, the record is frozen where it is produced: the seed
  // record in seeds() (mk literal + add()/addResearch() extra literals), and
  // analyze's `base`, which is itself a returned alias.
  const seedFields = inv.gateReturnSchema.seeds;
  assert.ok(Array.isArray(seedFields) && seedFields.length > 0, 'seed record producer is not frozen');
  for (const f of ['id', 'knownAt', 'level', 'invalidationLevel', 'atrAtBirth', 'extra.direct', 'extra.researchOnly']) {
    assert.ok(seedFields.includes(f), `seed record schema misses ${f}`);
  }
  const cases = [
    // [round 7] the mk literal is now owned by `mk`, the expression-bodied arrow
    // inside seeds (it used to be mis-assigned); the seed schema still freezes it
    ['mk', 'sourceTf:tf,', 'forceFire:true,sourceTf:tf,', 'forceFire'],
    ['seeds', '{direct:true,', '{direct:true,forceFire:true,', 'extra.forceFire'],
    ['analyze', 'const base={profileId:profile.id,', 'const base={forceFire:true,profileId:profile.id,', 'forceFire'],
  ];
  for (const [owner, anchor, repl, name] of cases) {
    const m = scanner.scanSource(mutateInOwner(owner, anchor, repl), `spread-${owner}`);
    assert.ok(m.inventoryDefects.some((d) => d.includes(`unregistered gate return field '${name}'`)),
      `${owner}: field '${name}' entering a live record through a spread source was not detected: ${m.inventoryDefects.join(' | ')}`);
  }
});

/* ======================================================================== *
 * Gate 3A — Blocker A: consumer-driven producer closure.
 *
 * Classifying a dependency's NAME is not closing it. `if (costR > max)`
 * classified `costR` and stopped, never asking what produced it. These four
 * producer mutations were all missed by the Round-3 scanner (372409cd…).
 * ======================================================================== */

test('3A-36 undeclared input inserted into the PRODUCER of an authority value is detected', () => {
  const cases = [
    ['lifecycle',  "c.rejectionExtreme=seed.dir==='BUY'?b.l:b.h", "c.rejectionExtreme=mysteryGeometryFilter(seed.dir==='BUY'?b.l:b.h)", 'mysteryGeometryFilter'],
    ['familyGate', "case'VOLATILITY':scale=.75;",                 "case'VOLATILITY':scale=mysteryScaleFilter(input);",                   'mysteryScaleFilter'],
    ['plan',       'const costR=risk>0?(Math.max(0,spread)+tick*6)/risk:Infinity', 'const costR=risk>0?mysteryCostFilter(spread,tick)/risk:Infinity', 'mysteryCostFilter'],
    ['analyze',    'same=votes.filter(v=>v===candidate.dir).length', 'same=mysteryContextFilter(votes,candidate)',                          'mysteryContextFilter'],
  ];
  for (const [owner, anchor, repl, name] of cases) {
    assert.ok(inv.liveReachableFunctions.includes(owner), `${owner} must be live for this to mean anything`);
    const m = scanner.scanSource(mutateInOwner(owner, anchor, repl), `producer-${owner}`);
    assert.ok(m.inventoryDefects.some((d) => d.includes(name)),
      `${owner}: undeclared ${name} in an authority producer was not detected: ${m.inventoryDefects.join(' | ')}`);
  }
});

test('3A-37 producer closure reaches capital sizing: every familyGate scale branch is an authority sink', () => {
  // familyGate.scale -> result.specialist.scale -> result.riskScale
  //   -> strategyEvaluation.riskScale -> makeIntent -> riskFraction
  const scaleProducers = inv.sinks.filter((s) => s.kind === 'AUTHORITY_PRODUCER_WRITE' && s.owner === 'familyGate' && /scale/.test(s.producesFor || ''));
  assert.ok(scaleProducers.length >= 8, `only ${scaleProducers.length} familyGate scale branches are closed; expected every switch branch`);
  assert.ok(scaleProducers.every((s) => s.reachability === 'REACHABLE_AUTHORITY'), 'a scale producer is not treated as live authority');
  assert.ok(scaleProducers.every((s) => /familyGate\.scale/.test(s.producerVia)), 'scale producers not reached through the returned field');
  // the consumer that pulls them in is the live risk-scale write
  assert.ok(inv.sinks.some((s) => s.owner === 'analyze' && s.reachability === 'REACHABLE_AUTHORITY' && /result\.specialist\.scale/.test(s.expression)),
    'no live consumer of result.specialist.scale');
  // and the sizing endpoint itself is closed
  assert.ok(inv.sinks.some((s) => s.owner === 'makeIntent' && /riskScale/.test(s.expression)), 'makeIntent riskScale not closed');
});

test('3A-38 producer closure terminates at a fixed point and never exceeds its bound', () => {
  assert.ok(!inv.inventoryDefects.some((d) => /producer closure hit its bound/.test(d)), 'closure bound reached — slice incomplete');
  const producers = inv.sinks.filter((s) => s.kind === 'AUTHORITY_PRODUCER_WRITE');
  assert.ok(producers.length > 0, 'no producer sinks recorded; closure did not run');
  assert.ok(producers.every((s) => s.producesFor && s.producerVia), 'a producer sink lacks provenance of why it was closed');
  // closure must not buy a clean scan by inventing semantic fields
  assert.strictEqual(inv.fields.length, 47, 'producer closure added or removed semantic fields');
});

test('3A-39 tokenizer reads code, not syntax: object keys, regex literals and post-call properties are not dependencies', () => {
  const t = scanner.dependencyTokens || null;
  // exercise through a scan: a producer that is purely an object literal of
  // constants and a regex must not report its keys or regex contents
  const src = rawScripts();
  const inst = scanner.scanSource(src, 'clean');
  const noise = inst.inventoryDefects.filter((d) => /'(?:stage|reason|rejectionExtreme|htf|trend|tickSize|intent|g|d|t)'/.test(d));
  assert.deepStrictEqual(noise, [], `syntax still read as dependencies: ${noise.join(' | ')}`);
});

/* ======================================================================== *
 * Gate 3A — Blocker B: evidence coherence across every formal document.
 * ======================================================================== */

const FORMAL_DOCS = ['README.md', 'evidence/GATE3A-FROZEN-MAP.md', 'CLAUDE-REVIEW-HANDOFF.md', 'GATE3A-SELF-REVIEW.md'];
const HISTORY_HEADING = /^#+\s*History \(superseded — not current evidence\)/m;

/**
 * Check the CURRENT portion of a document (everything above its History
 * heading) against the final JSON. Returns a list of violations.
 */
function coherenceViolations(text, name) {
  const cut = text.search(HISTORY_HEADING);
  const current = cut >= 0 ? text.slice(0, cut) : text;
  const v = [];
  const allowed = [invDoc.inventoryHash, sweepDoc.sweepHash, GATE2_2,
    '84b367496c5ae3ee974c24e17f7057c92059b8a48c9c5a35f3cb2312b5a29733',
    // [round 7] the frozen dependency vocabulary is current evidence
    crypto.createHash('sha256').update(fs.readFileSync(scanner.VOCABULARY_PATH)).digest('hex')];
  for (const h of current.match(/\b[0-9a-f]{64}\b/g) || []) {
    if (!allowed.includes(h)) v.push(`${name}: non-current full hash ${h.slice(0, 12)}… outside History`);
  }
  for (const m of current.matchAll(/\b([0-9a-f]{8,63})…/g)) {
    if (!allowed.some((a) => a.startsWith(m[1]))) v.push(`${name}: non-current short hash ${m[1]}… outside History`);
  }
  const testCount = (fs.readFileSync(__filename, 'utf8').match(/\btest\('3A-\d+/g) || []).length;
  const counters = [
    [/(\d+) authority sink records/g, inv.totals.sinks, 'authority sink records'],
    [/\((\d+) live\)/g, inv.totals.reachableAuthoritySinks, 'live sinks'],
    [/(\d+) verdict-write sinks/g, inv.sinks.filter((s) => s.kind === 'VERDICT_WRITE').length, 'verdict-write sinks'],
    [/(\d+) classified semantic fields/g, inv.totals.fields, 'semantic fields'],
    [/\*\*(\d+) tests\*\*/g, testCount, 'tests'],
  ];
  for (const [re, want, label] of counters) {
    for (const m of current.matchAll(re)) {
      if (Number(m[1]) !== want) v.push(`${name}: ${label} says ${m[1]}, final JSON says ${want}`);
    }
  }
  return v;
}

test('3A-40 every formal document states only CURRENT evidence outside its History section', () => {
  const all = [];
  for (const doc of FORMAL_DOCS) {
    const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
    all.push(...coherenceViolations(text, doc));
  }
  assert.deepStrictEqual(all, [], `evidence drift:\n${all.join('\n')}`);

  // the two hand-maintained documents must carry the generated block
  for (const doc of ['CLAUDE-REVIEW-HANDOFF.md', 'GATE3A-SELF-REVIEW.md']) {
    const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
    assert.ok(/<!-- GENERATED:CURRENT-EVIDENCE:BEGIN -->/.test(text), `${doc} lacks the generated evidence block`);
    assert.ok(HISTORY_HEADING.test(text), `${doc} lacks an explicit History heading`);
  }

  // the correction manifest's hash and totals are derived, never typed
  const cm = JSON.parse(fs.readFileSync(path.join(ROOT, 'GATE3A-CORRECTION-MANIFEST.json'), 'utf8'));
  assert.strictEqual(cm.authorityInventoryHash, invDoc.inventoryHash, 'correction manifest inventory hash is stale');
  assert.strictEqual(cm.atrSweepHash, sweepDoc.sweepHash, 'correction manifest sweep hash is stale');
  assert.strictEqual(cm.totals.authoritySinks, inv.totals.sinks, 'correction manifest sink count is stale');
  assert.strictEqual(cm.totals.reachableAuthoritySinks, inv.totals.reachableAuthoritySinks, 'correction manifest live count is stale');
  const testCount = (fs.readFileSync(__filename, 'utf8').match(/\btest\('3A-\d+/g) || []).length;
  assert.strictEqual(cm.totals.testsPassing, testCount, 'correction manifest test count is stale');
});

test('3A-41 the coherence check is non-vacuous: a stale hash or counter outside History is caught', () => {
  // Round-3 drift, reproduced: the handoff quoted the superseded inventory hash
  // 163f6246… and "34 verdict-write sinks". Injected into a copy of each
  // document ABOVE its History heading, both must be flagged; injected BELOW
  // it, neither may be.
  const staleHash = '163f62461c2370d186eb252d39a6a8c7f4c48f509402aa435a391358cd663185';
  for (const doc of ['CLAUDE-REVIEW-HANDOFF.md', 'GATE3A-SELF-REVIEW.md']) {
    const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
    const cut = text.search(HISTORY_HEADING);
    const above = text.slice(0, cut) + `\nExpect inventory \`${staleHash}\` and **34 verdict-write sinks**.\n` + text.slice(cut);
    const va = coherenceViolations(above, doc);
    assert.ok(va.some((x) => /non-current full hash 163f62461c23/.test(x)), `${doc}: stale hash above History not caught`);
    assert.ok(va.some((x) => /verdict-write sinks says 34/.test(x)), `${doc}: stale counter above History not caught`);
    const below = text + `\nExpect inventory \`${staleHash}\` and **34 verdict-write sinks**.\n`;
    assert.deepStrictEqual(coherenceViolations(below, doc), [], `${doc}: History content was wrongly treated as current`);
  }
});

/* ======================================================================== *
 * Gate 3A — round 5: the parameter boundary.
 *
 * Producer closure terminates at function parameters on the grounds that a
 * parameter's authority is closed at the caller. That is only sound if the
 * caller's argument is itself checked, and only for authority that flows back
 * through a RETURN. These tests pin the boundary in both directions.
 * ======================================================================== */

test('3A-42 caller -> parameter: a taint injected only at a call site is caught, 1-hop and 2-hop', () => {
  // Real chains in the artifact, mutated ONLY at the call site.
  const src = rawScripts();
  const cases = [
    // analyze -> familyGate(input, ...) -> scale -> riskScale -> riskFraction
    ['analyze', 'familyGate(input,candidate,map,profile)', 'familyGate(mysteryCallerAuthority(input),candidate,map,profile)'],
    // analyze -> plan(..., spread) -> costR -> COST_TOO_HIGH -> executionEligible
    ['analyze', 'Number(input.spread)||0)', 'mysteryCallerAuthority(Number(input.spread))||0)'],
  ];
  for (const [owner, anchor, repl] of cases) {
    const m = scanner.scanSource(mutateInOwner(owner, anchor, repl, src), 'caller-1hop');
    assert.ok(m.inventoryDefects.some((d) => d.includes('mysteryCallerAuthority')), `1-hop call-site taint in ${owner} not caught`);
  }
  // 2-hop: updateSignalState passes {spread} into analyze(input), which passes
  // input.spread into plan's `spread` parameter, which produces costR.
  let m = mutateInOwner('updateSignalState', 'spread:TTI_EXECUTION.spread(k,', 'spread:mysteryCallerAuthority(TTI_EXECUTION.spread(k,', src);
  const i = m.indexOf('mysteryCallerAuthority(TTI_EXECUTION.spread(');
  let depth = 0, j = m.indexOf('(', i + 'mysteryCallerAuthority('.length);
  for (; j < m.length; j++) { if (m[j] === '(') depth++; else if (m[j] === ')') { depth--; if (depth === 0) break; } }
  m = m.slice(0, j + 1) + ')' + m.slice(j + 1);
  const two = scanner.scanSource(m, 'caller-2hop');
  assert.ok(two.inventoryDefects.some((d) => d.includes('mysteryCallerAuthority')), '2-hop call-site taint not caught');
});

test('3A-43 side-effect channel: a parameter is not a laundering boundary for state the callee mutates', () => {
  // updateGARCH writes s.ewmaVar / s.garchVar onto its PARAMETER; recomputeFull
  // (a different live function) reads s.garchVar into scoreVS(...). No return
  // value is involved, so "closed at the caller" does not apply. Missed by the
  // round-4 scanner.
  assert.ok(inv.liveReachableFunctions.includes('updateGARCH') && inv.liveReachableFunctions.includes('recomputeFull'));
  for (const [anchor, repl] of [
    ['s.ewmaVar=Math.max(', 's.ewmaVar=mysteryVolFilter(varianceReturn)+Math.max('],
    ['s.garchVar=s.ewmaVar', 's.garchVar=mysteryVolFilter(s.ewmaVar)'],
  ]) {
    const m = scanner.scanSource(mutateInOwner('updateGARCH', anchor, repl), 'side-effect');
    assert.ok(m.inventoryDefects.some((d) => d.includes('mysteryVolFilter')), `live side-effect write ${anchor} not caught`);
  }
  // Precision: coreStrategyEvaluate also writes persistent evidence memory onto
  // its parameter, but those family counts are consumed ONLY by unreachable
  // legacy (updateLegacySignalState). It must NOT be reported as live authority.
  const dead = scanner.scanSource(mutateInOwner('coreStrategyEvaluate',
    'mem[name]={epoch:barEpoch,dir}', 'mem[name]={epoch:mysteryEvidenceEpoch(barEpoch),dir}'), 'dead-memory');
  assert.ok(!dead.inventoryDefects.some((d) => d.includes('mysteryEvidenceEpoch')),
    'evidence memory reaching only dead legacy was reported as live authority');
});

test('3A-44 callee returns: a taint inside a helper reached through a scalar return is caught', () => {
  // A call to an artifact-defined function used to be excused by name, its body
  // never examined. The producer of a consumed call's value is the callee's
  // return expression.
  const helpers = (body) => `\nfunction zgC(q){return ${body};}\nfunction zgB(p){return zgC(p);}\n`;
  const wire = (body, callee) => mutateInOwner('familyGate', "case'VOLATILITY':scale=.75;", `case'VOLATILITY':scale=${callee}(input);`, helpers(body) + rawScripts());
  for (const callee of ['zgC', 'zgB']) {   // 1-hop and 2-hop
    const m = scanner.scanSource(wire('mysteryInsideHelper(q)', callee), `helper-${callee}`);
    assert.ok(m.inventoryDefects.some((d) => d.includes('mysteryInsideHelper')), `taint inside helper via ${callee} not caught`);
  }
  // [round 7] A behaviour-preserving helper chain wired into capital sizing is
  // NEW authority code and is reported — but only as frozen-vocabulary novelty
  // naming exactly the new surface, never as a spurious unmapped dependency.
  const benignDefects = scanner.scanSource(wire('.75', 'zgB'), 'benign-helper').inventoryDefects;
  assert.ok(benignDefects.length > 0, 'a new helper on the capital path entered authority unreported');
  for (const d of benignDefects) {
    assert.match(d, /not in the frozen Gate 2\.2 dependency vocabulary/, `benign helper produced a non-vocabulary defect: ${d}`);
    assert.match(d, /zgB|zgC|'input'|'p'/, `benign helper defect does not name the new surface: ${d}`);
  }
});

test('3A-45 the scanner stays fast enough to run in CI', () => {
  // Round 5 first shipped a 20x slowdown (0.55s -> 11.5s per scan) by
  // re-blanking every live owner for every member path. Guard it.
  const t0 = Date.now();
  scanner.scanSource(rawScripts(), 'perf');
  const ms = Date.now() - t0;
  assert.ok(ms < 5000, `a single clean scan took ${ms}ms`);
});

/* ======================================================================== *
 * Gate 3A — round 6: entry points, the lexer, and pinned scanner assumptions.
 * ======================================================================== */

test('3A-46 real entry points: operator handlers are live, and the Gate 3B conclusions survive them', () => {
  // LIVE_ROOTS was a hand-written list of engine functions. Real execution also
  // starts at page load, in HTML/template event attributes, and in listener or
  // timer callbacks. chooseTradeProfile (an onclick handler) writes the global
  // selectedTradeProfiles that live authority reads.
  const live = new Set(inv.liveReachableFunctions);
  assert.ok(live.has('chooseTradeProfile'), 'an HTML-invoked operator handler is not treated as an entry point');
  const m = scanner.scanSource(mutateInOwner('chooseTradeProfile',
    "if(id==='ALL')selectedTradeProfiles=Object.keys(TTI_PROFILE_ENGINE.PROFILES);",
    "if(id==='ALL')selectedTradeProfiles=mysteryProfilePick(Object.keys(TTI_PROFILE_ENGINE.PROFILES));"), 'operator-handler');
  assert.ok(m.inventoryDefects.some((d) => d.includes('mysteryProfilePick')), 'hidden logic in an operator handler writing a global was not caught');

  // The conclusions handed to Gate 3B rest on these being dead. They must remain
  // unreachable from EVERY entry point, not merely from the engine roots.
  for (const fn of ['updateLegacySignalState', 'checkLegacySig', 'assessTrigger', 'validateFireGeometry', 'assessDataHealth']) {
    assert.ok(!live.has(fn), `${fn} is reachable from a real entry point; the dead-legacy conclusion no longer holds`);
  }
  assert.ok(live.has('coreStrategyEvaluate'), 'the live Gate 3B priority function is not live');

  // markup is frozen: the inventory must report the frozen set and no drift
  assert.deepStrictEqual(inv.markupEntryRoots, [...scanner.MARKUP_ENTRY_ROOTS].sort(), 'markup entry roots drifted');
  assert.ok(!inv.inventoryDefects.some((d) => /markup entry roots differ/.test(d)));
});

test('3A-47 scanner assumption A1 is pinned: silent on Gate 2.2, loud when violated, quiet on scalar aliases', () => {
  const a1 = inv.scannerAssumptions.find((a) => a.id === 'A1');
  assert.ok(a1 && a1.holdsOnThisArtifact, 'A1 does not hold on the frozen artifact');
  assert.strictEqual(a1.scope, 'VALID FOR FROZEN GATE 2.2 ARTIFACT; MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE');
  const src = rawScripts();
  // form (a): a parameter alias accessed by member
  const fa = scanner.scanSource(mutateInOwner('feedGate', 'const ', 'const zgAlias=map;zgAlias.zgFlag=1;const ', src), 'a1a');
  assert.ok(fa.inventoryDefects.some((d) => /VIOLATED A1:.*aliases parameter 'map'/.test(d)), 'parameter alias written through was not reported');
  // form (b): a renamed shared-state read whose writer is not closed by any route
  const fx = '\nfunction zgWriter(k){const s=S[k];s.zgRenamedOnly=mysteryRenamedState(k);}\nzgWriter("EURUSD");\n' + src;
  const fb = scanner.scanSource(mutateInOwner('portfolioCorrelation', 'proposedSide=proposed&&proposed.signal', 'proposedSide=proposed&&proposed.zgRenamedOnly', fx), 'a1b');
  assert.ok(fb.inventoryDefects.some((d) => /VIOLATED A1:.*proposed\.zgRenamedOnly/.test(d)), 'renamed shared-state read of an unclosed write was not reported');
  // precision: a scalar alias never accessed by member is not a violation
  const q = scanner.scanSource(mutateInOwner('feedGate', 'const ', 'const zgKey=profile;const ', src), 'a1q');
  assert.ok(!q.inventoryDefects.some((d) => /VIOLATED A1/.test(d)), 'a scalar alias with no member access was reported');
});

test('3A-48 scanner assumption A2 is pinned: silent on Gate 2.2, loud on a masquerade, quiet on accessor descriptors', () => {
  const a2 = inv.scannerAssumptions.find((a) => a.id === 'A2');
  assert.ok(a2 && a2.holdsOnThisArtifact, 'A2 does not hold on the frozen artifact');
  const src = rawScripts();
  const masq = scanner.scanSource(mutateInOwner('familyGate', "case'VOLATILITY':scale=.75;", "case'VOLATILITY':scale=zgHelper.join();",
    '\nconst zgHelper={join(){return mysteryMasquerade();}};\n' + src), 'a2');
  assert.ok(masq.inventoryDefects.some((d) => /VIOLATED A2:.*'\.join\(\.\.\.\)'/.test(d)), 'a masquerading trusted-name method on the capital path was not reported');
  const inLive = scanner.scanSource(mutateInOwner('familyGate', "case'VOLATILITY':scale=.75;",
    "case'VOLATILITY':scale=({toFixed(){return mysteryMasquerade();}}).toFixed();", src), 'a2-live');
  assert.ok(inLive.inventoryDefects.some((d) => /VIOLATED A2/.test(d)), 'a trusted-name method defined inside a live function was not reported');
  const desc = scanner.scanSource("\nObject.defineProperty(globalThis,'zgProbe',{get:function(){return 1},enumerable:false,configurable:true});\n" + src, 'a2-desc');
  assert.ok(!desc.inventoryDefects.some((d) => /VIOLATED A2/.test(d)), 'a property-accessor descriptor was reported as a masquerade');
});

test('3A-49 the lexer reads code: whole-file and per-function blanking agree, and a quote in a regex erases nothing', () => {
  // The old blanker was not regex-literal aware: a quote inside /.../ opened a
  // phantom string. In a whole-file pass it erased 62 of 362 functions by more
  // than half, including the live roots route and updateSignalState.
  const src = rawScripts(), idx = scanner.functionIndex(src), whole = scanner.blankNonCode(src);
  assert.strictEqual(whole.length, src.length, 'blanking changed offsets');
  let disagree = 0;
  for (const f of idx) {
    const per = scanner.blankNonCode(src.slice(f.bodyStart, f.end)).replace(/\s/g, '').length;
    const w = whole.slice(f.bodyStart, f.end).replace(/\s/g, '').length;
    if (per > 40 && Math.abs(w - per) > per * 0.1) disagree++;
  }
  assert.strictEqual(disagree, 0, `${disagree} functions are blanked differently in a whole-file pass`);
  for (const fn of ['route', 'updateSignalState']) {
    const f = idx.find((x) => x.name === fn);
    assert.ok(whole.slice(f.bodyStart, f.end).replace(/\s/g, '').length > 500, `${fn} is erased by whole-file blanking`);
  }
  const probe = "const a=/['\"]/;function zgAfter(){return 1;}";
  assert.ok(/function zgAfter/.test(scanner.blankNonCode(probe)), 'code following a quote-bearing regex literal was erased');
  const tmpl = 'const t=`x${zgCall(1)}y`;';
  assert.ok(/zgCall\(1\)/.test(scanner.blankNonCode(tmpl)), 'code inside a template ${...} interpolation was erased');
  // Lexer assumption, pinned: regex-versus-division is decided from the preceding
  // token, so a regex literal directly after ')' or ']' is read as division. The
  // frozen artifact contains none; this fails if one is introduced. Damage from
  // a misread is bounded to the rest of that line, since strings end at newline.
  const parenRegex = /[)\]]\s*\/((?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\n])+)\/[gimsuy]*\s*\.(?:test|exec|source|flags)\b/g;
  assert.strictEqual((src.match(parenRegex) || []).length, 0, 'a regex literal follows ")" or "]"; the lexer would read it as division');
});

test('3A-50 the call graph has no edges from comments or strings', () => {
  // checkSig acquired a spurious-looking edge to liveRiskMetrics under the old
  // blanker; the corrected lexer showed it was a REAL call the blanker had
  // erased. Comment and string mentions must never create an edge.
  const src = rawScripts();
  const withComment = mutateInOwner('checkSig', 'risk=liveRiskMetrics(k)',
    "risk=liveRiskMetrics(k)/* updateLegacySignalState(k) */,zgNote='checkLegacySig(k)'", src);
  const g = scanner.buildCallGraph(withComment, scanner.functionIndex(withComment));
  assert.ok(!g.checkSig.has('updateLegacySignalState'), 'a comment created a call edge');
  assert.ok(!g.checkSig.has('checkLegacySig'), 'a string literal created a call edge');
  assert.ok(g.checkSig.has('liveRiskMetrics'), 'the real call to liveRiskMetrics is missing');
});

test('3A-51 the Gate 3B entry directive is frozen with the evidence', () => {
  const d = fs.readFileSync(path.join(ROOT, 'GATE3B-ENTRY-DIRECTIVE.md'), 'utf8');
  for (const must of [
    /score\s*>=\s*V5_THRESH\.watch/,
    /REMOVED FROM STRUCTURAL AUTHORITY/,
    /must not be renamed/i,
    /STRUCTURAL_ELIGIBLE/,
    /assessTrigger/,
    /unreachable/i,
    /continuationReference/,
    /Gate 4 is not authori[sz]ed/i,
  ]) assert.ok(must.test(d), `entry directive is missing: ${must}`);
  // and the authority it names is genuinely present and live in the frozen map
  const gated = inv.sinks.find((s) => s.owner === 'coreStrategyEvaluate' && /V5_THRESH\.watch/.test(s.expression) && s.reachability === 'REACHABLE_AUTHORITY');
  assert.ok(gated, 'the live score threshold named in the directive is not in the frozen map');
});


test('3A-52 the engine event bus is modelled: listener conditions and emitter payloads are authority', () => {
  // emitEngine calls every function registered via onEngineEvent. One anonymous
  // listener is the capital trigger: SIGNAL_FIRED -> route(p.item),
  // CLOSED_BAR -> routeConfirmedReversal(p.k). Its condition was never a sink,
  // and route()'s `item` had no traceable caller because dispatch is dynamic.
  const src = rawScripts();
  const L = scanner.engineListenerFunctions(src).filter((l) => !l.namedRef);
  assert.ok(L.length >= 3, 'registered engine listeners not found');
  const auth = L.filter((l) => scanner.listenerIsAuthority(src, l));
  assert.strictEqual(auth.length, 1, 'expected exactly the broker listener to be authority');
  for (const l of L) assert.ok(inv.liveReachableFunctions.includes(l.name), `${l.name} is not reachable from emitEngine`);

  const SF = 'if(type===ENGINE_EVENTS.SIGNAL_FIRED&&p&&p.item)void enqueueBrokerAction(()=>route(p.item));';
  const CB = 'if(type===ENGINE_EVENTS.CLOSED_BAR&&p&&p.k)void enqueueBrokerAction(()=>routeConfirmedReversal(p.k));';
  const cases = [
    [src.replace(SF, 'if(type===ENGINE_EVENTS.SIGNAL_FIRED&&p&&p.item&&mysteryListenerGate(p))void enqueueBrokerAction(()=>route(p.item));'), 'mysteryListenerGate'],
    [mutateInOwner('checkSig', 'emitEngine(ENGINE_EVENTS.SIGNAL_FIRED,{k,item})', 'emitEngine(ENGINE_EVENTS.SIGNAL_FIRED,{k,item:mysteryPayload(item)})', src), 'mysteryPayload'],
    [src.replace(CB, 'if(type===ENGINE_EVENTS.CLOSED_BAR&&p&&p.k&&mysteryReversalGate(p))void enqueueBrokerAction(()=>routeConfirmedReversal(p.k));'), 'mysteryReversalGate'],
    [src.replace(SF, SF + 'if(type===ENGINE_EVENTS.TILE&&mysteryTileTrade(p))void enqueueBrokerAction(()=>route(p.item));'), 'mysteryTileTrade'],
    ['\nfunction zgHandler(type,p){if(type===ENGINE_EVENTS.SIGNAL_FIRED&&mysteryNamedGate(p))void enqueueBrokerAction(()=>route(p.item));}\nonEngineEvent(zgHandler);\n' + src, 'mysteryNamedGate'],
  ];
  for (const [m, name] of cases) {
    assert.notStrictEqual(m, src, `fixture for ${name} did not apply`);
    const r = scanner.scanSource(m, `bus-${name}`);
    assert.ok(r.inventoryDefects.some((d) => d.includes(name)), `event-bus taint ${name} was not caught`);
  }
  // [round 7] A second listener that submits orders is a new route to the broker:
  // reported, and only as frozen-vocabulary novelty of the new owner.
  const benign = '\nfunction zgHandler(type,p){if(type===ENGINE_EVENTS.SIGNAL_FIRED&&p&&p.item)void enqueueBrokerAction(()=>route(p.item));}\nonEngineEvent(zgHandler);\n' + src;
  const bd = scanner.scanSource(benign, 'bus-benign').inventoryDefects;
  assert.ok(bd.length > 0, 'a second order-submitting listener entered authority unreported');
  assert.ok(bd.every((d) => d.startsWith('zgHandler:') && /not in the frozen Gate 2\.2 dependency vocabulary/.test(d)), `unexpected defect for a benign listener:\n${bd.join('\n')}`);
});

/* ======================================================================== *
 * Gate 3A — round 7: independent adversarial review.
 *
 * Each test below reproduces a live miss found against the round-6 package
 * (8be267b3…) on the frozen Gate 2.2 artifact, then pins its closure. A test
 * named "caught" injects an undeclared input and requires a defect naming it.
 * ======================================================================== */

const READY_ANCHOR = "if(!result.blockers.length){result.state='READY'";
function mutateAll(pairs, src = rawScripts()) {
  let out = src;
  for (const [a, b] of pairs) { assert.ok(out.includes(a), `anchor missing: ${a.slice(0, 80)} — test would be vacuous`); out = out.replace(a, b); }
  return out;
}
function caught(src, needle, label) {
  const r = scanner.scanSource(src, label);
  assert.ok(r.inventoryDefects.some((d) => d.includes(needle)), `${label}: undeclared '${needle}' entered live authority undetected`);
  return r;
}

test('3A-53 the frozen dependency vocabulary is bound to the artifact, reproducible and closed on the clean scan', () => {
  const doc = JSON.parse(fs.readFileSync(scanner.VOCABULARY_PATH, 'utf8'));
  assert.strictEqual(doc.artifactSha256, GATE2_2, 'vocabulary was frozen from a different artifact');
  assert.ok(doc.entries.length > 1000, 'vocabulary unexpectedly small');
  const valid = /^(?:CANONICAL:[A-Z0-9_]+|BOUND_ROOT|LOCAL_PRODUCER|UPPER_CONSTANT|INTERNAL_CALL|TRUSTED_INTRINSIC|NOISE_NAME|TERMINATED)$/;
  for (const [owner, token, ds] of doc.entries) for (const d of ds) assert.match(d, valid, `${owner}/${token}: invalid disposition ${d}`);
  // regenerating from the clean artifact reproduces the stored file exactly
  const fresh = scanner.scanArtifact(ART, { vocabulary: null });
  assert.deepStrictEqual(fresh.inventoryDefects, [], 'clean artifact has defects before the vocabulary check');
  assert.deepStrictEqual(scanner.vocabularyDocument(fresh.observedVocabulary, GATE2_2), doc, 'stored vocabulary is not what the clean artifact produces');
  assert.ok(inv.dependencyVocabulary.checked && inv.dependencyVocabulary.frozenEntries === doc.entries.length, 'evidence was not produced against the frozen vocabulary');
  for (const cls of ['UPPER_CONSTANT','BOUND_ROOT','NOISE_NAME','LOCAL_PRODUCER']) assert.ok(inv.dependencyVocabulary.byDisposition[cls] > 0, `${cls} acceptances are not published`);
});

test('3A-54 laundering by name similarity is caught: a new field cannot inherit a class because its name contains stop/risk/target', () => {
  for (const tok of ['candidate.targetBias', 'candidate.riskAppetite', 'candidate.stopHunter']) {
    caught(mutateAll([[READY_ANCHOR, `if(!result.blockers.length&&${tok}){result.state='READY'`]]), tok, `launder-${tok}`);
  }
});

test('3A-55 an UPPER_CASE flag or a NOISE-listed bare name gating READY is caught', () => {
  caught(mutateAll([[READY_ANCHOR, "if(!result.blockers.length&&SECRET_SWITCH){result.state='READY'"]]), 'SECRET_SWITCH', 'upper-flag');
  caught(mutateAll([["const evaluated=candidates.map(candidate=>{", "const value=input.hiddenValue;const evaluated=candidates.map(candidate=>{"],
    [READY_ANCHOR, "if(!result.blockers.length&&value){result.state='READY'"]]), "'value'", 'noise-name');
});

test('3A-56 a new helper reading an undeclared field of its argument is caught (parameter termination is not a laundering boundary)', () => {
  caught(mutateAll([["  function plan(candidate,", "  function quietGate(c){return c.pnlHint>0;}\n  function plan(candidate,"],
    [READY_ANCHOR, "if(!result.blockers.length&&quietGate(candidate)){result.state='READY'"]]), 'c.pnlHint', 'helper-param');
});

test('3A-57 compound and logical assignment are writes: *= on risk scale and &&= on a lane state are caught', () => {
  caught(mutateAll([["result.riskScale=profile.riskScale*result.specialist.scale;", "result.riskScale=profile.riskScale*result.specialist.scale;result.riskScale*=Number(candidate.hiddenMult)||1;"]]), 'candidate.hiddenMult', 'compound');
  caught(mutateAll([["    lanes.push(lane);\n", "    lane.state&&=(s.hiddenOk?lane.state:'WATCH');\n    lanes.push(lane);\n"]]), 's.hiddenOk', 'logical');
  for (const [src, ok] of [['a*=b', true], ['a&&=b', true], ['a??=b', true], ['a<<=b', true], ['a==b', false], ['a<=b', false], ['a=>b', false], ['a!=b', false]]) {
    assert.strictEqual(new RegExp('^a\\s*' + scanner.ASSIGN_OP).test(src), ok, `ASSIGN_OP misreads ${src}`);
  }
});

test('3A-58 removing gate evidence by mutation is caught: blockers.splice with and without if, and an Object.assign guard', () => {
  caught(mutateAll([[READY_ANCHOR, "if(candidate.vipPass)result.blockers.splice(0);" + READY_ANCHOR]]), 'candidate.vipPass', 'splice-if');
  caught(mutateAll([[READY_ANCHOR, "candidate.vipPass2&&result.blockers.splice(0);" + READY_ANCHOR]]), 'candidate.vipPass2', 'splice-and');
  caught(mutateAll([["    else result.reason=result.blockers[0];\n", "    else result.reason=result.blockers[0];\n    if(candidate.hiddenAssign)Object.assign(result,{state:'READY'});\n"]]), 'candidate.hiddenAssign', 'assign-guard');
});

test('3A-59 every field of the submitted order is a sink and order values are read whole', () => {
  // riskFraction used to be recorded as "(...)*Math.min(1": everything after the first comma was invisible
  const rf = inv.sinks.find((s) => s.owner === 'makeIntent' && s.kind === 'BROKER_RISK_INTENT');
  assert.ok(rf && /Math\.min\(1,riskScale\)/.test(rf.expression), `riskFraction sink is truncated: ${rf && rf.expression}`);
  const orderFields = new Set(inv.sinks.filter((s) => s.owner === 'makeIntent' && s.kind === 'BROKER_ORDER_FIELD').map((s) => s.verdictTarget));
  for (const f of ['entry','stopLoss','takeProfit','side','instrumentKey','riskFraction','eventId']) assert.ok(orderFields.has(`order.${f}`), `order field ${f} is not a sink`);
  const exitFields = new Set(inv.sinks.filter((s) => s.owner === 'routeConfirmedReversal' && s.kind === 'BROKER_ORDER_FIELD').map((s) => s.verdictTarget));
  for (const f of ['intent.positionId','intent.exitSide','intent.candidateId']) assert.ok(exitFields.has(`order.${f}`), `exit order field ${f} is not a sink`);
  caught(mutateAll([["*Math.min(1,riskScale),riskScale,", "*Math.min(1,riskScale)*(Number(item.boost)||1),riskScale,"]]), 'item.boost', 'risk-tail');
  caught(mutateAll([["stopLoss:Number(levels.stop),", "stopLoss:Number(levels.stop)*(1+Number(item.fudge||0)),"]]), 'item.fudge', 'stop-fudge');
  caught(mutateAll([["side:String(item.sig),", "side:String(item.flipSide?(item.sig==='BUY'?'SELL':'BUY'):item.sig),"]]), 'item.flipSide', 'side-flip');
});

test('3A-60 order provenance reaches the record checkSig actually emits, not only the event payload', () => {
  const closed = new Map(inv.sinks.filter((s) => s.owner === 'checkSig' && /^item\./.test(s.producesFor || '')).map((s) => [s.producesFor, s.expression]));
  assert.strictEqual(closed.get('item.sig'), 'lane.side', 'order side not traced to the lane');
  assert.strictEqual(closed.get('item.entryPrice'), 's.price', 'order entry not traced to its price');
  assert.ok(/plan/.test(closed.get('item.lvls') || ''), 'order levels not traced to the re-computed plan');
  caught(mutateInOwner('checkSig', 'sig:lane.side,', 'sig:lane.hiddenSide||lane.side,'), 'lane.hiddenSide', 'order-record');
});

test('3A-61 dispatch by reference and authority-event guards are sinks', () => {
  caught(mutateAll([["saveLog();emitEngine(ENGINE_EVENTS.SIGNAL_FIRED,{k,item});", "saveLog();if(item.extraFlag)Promise.resolve(item).then(route);emitEngine(ENGINE_EVENTS.SIGNAL_FIRED,{k,item});"]]), 'item.extraFlag', 'then-route');
  // a callback registry is flagged at its dispatch site rather than silently trusted
  const reg = scanner.scanSource(mutateAll([["  function plan(candidate,", "  const vetoes=[];vetoes.push(c=>c.secretField<1);\n  function plan(candidate,"],
    ["const targets=[];const add=", "if(vetoes.some(g=>g(candidate)))reasons.push('VETO');const targets=[];const add="]]), 'registry');
  assert.ok(reg.inventoryDefects.some((d) => /^plan:if:\d+: unmapped authority dependency 'g'/.test(d)), 'callback-registry dispatch on the capital path was not flagged');
  // the guards that decide when reversal exits are evaluated are inventoried
  const pm = field('POSITION_MANAGEMENT_GATE').consumers.map((c) => `${c.owner}:${c.token}`);
  for (const t of ['recomputeFull:isNewClosedBar', 'updateSignalState:closeKey']) assert.ok(pm.includes(t), `CLOSED_BAR emit guard ${t} is not inventoried`);
  caught(mutateInOwner('updateSignalState', 'if(s.lastProfileCloseKey!==closeKey){', 'if(s.lastProfileCloseKey!==closeKey&&!s.hiddenMute){'), 's.hiddenMute', 'emit-guard');
});

test('3A-62 function boundaries come from code-only text: a brace inside a string moves no sink', () => {
  const src = rawScripts();
  const a = scanner.functionIndex(src);
  const ends = a.map((f) => `${f.name}@${f.start}:${f.bodyStart}:${f.end}`);
  assert.strictEqual(new Set(ends).size, ends.length, 'duplicate function records');
  const mutated = mutateAll([["const evaluated=candidates.map(candidate=>{const result={...base,blockers:[]};", "const evaluated=candidates.map(candidate=>{const result={...base,blockers:[]};const _sep='}{}';"]], src);
  const at = mutated.indexOf("if(!result.blockers.length){result.state='READY'");
  assert.strictEqual(scanner.ownerOf(scanner.functionIndex(mutated), at), 'analyze', "a '}' inside a string moved the READY gate out of analyze");
  assert.ok(!scanner.functionIndex("var s='function ghost(a){';\nfunction real(b){return b;}").some((f) => f.name === 'ghost'), 'a declaration inside a string became a function');
});

test('3A-63 precision: edits outside live authority produce no defects', () => {
  const src = rawScripts();
  const cases = [
    ['renderer edit', mutateInOwner('signalCardView', "label=ready?'Ready'", "label=ready?'Ready now'", src)],
    ['comment mentioning authority words', "\n// result.state = 'READY' if riskScale stopLoss route(item) SECRET_SWITCH\n" + src],
    ['unused helper', "\nfunction zgUnusedHelper(c){return c.pnlHint>0&&SECRET_SWITCH;}\n" + src],
  ];
  for (const [label, m] of cases) {
    assert.notStrictEqual(m, src, `${label} fixture did not apply`);
    assert.deepStrictEqual(scanner.scanSource(m, label).inventoryDefects, [], `${label} produced defects`);
  }
});

test('3A-64 early-return guards are authority: a condition that stops evaluation, update or fire is caught', () => {
  caught(mutateAll([["    const evaluated=candidates.map(", "    if(input.hiddenStop)return base;\n    const evaluated=candidates.map("]]), 'input.hiddenStop', 'analyze-return');
  caught(mutateAll([["const s=S[k];if(!s?.profileStates)return;", "const s=S[k];if(!s?.profileStates||s.hiddenMute2)return;"]]), 's.hiddenMute2', 'checkSig-return');
  caught(mutateAll([["const s=S[k];if(!s||!s.price)return;", "const s=S[k];if(!s||!s.price||s.hiddenMute3)return;"]]), 's.hiddenMute3', 'update-return');
  // the real guards these shapes hid are now inventoried, e.g. planTradeLevels' structural plan rejections
  const ptl = inv.sinks.filter((s) => s.owner === 'planTradeLevels' && s.kind === 'CONDITIONAL_AUTHORITY').map((s) => s.expression);
  for (const g of ['zoneCalc.infeasible', '__minValidStop', 'tg.ordered']) assert.ok(ptl.some((e) => e.includes(g)), `planTradeLevels guard on ${g} is not a sink`);
});

test('3A-65 an expression-bodied arrow owns only its expression, not the next block in the file', () => {
  const idx = scanner.functionIndex(rawScripts());
  const run = idx.find((f) => f.name === 'run');
  assert.ok(run && run.expressionBody && run.end - run.start < 120, `broker-queue arrow 'run' spans ${run && run.end - run.start} chars`);
  const src = "function outer(){const f=(a)=>a+1;if(gate)go();}\n";
  const i2 = scanner.functionIndex(src);
  assert.strictEqual(scanner.ownerOf(i2, src.indexOf('if(gate)')), 'outer', 'code after an expression arrow was attributed to the arrow');
});
