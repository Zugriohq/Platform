'use strict';
/**
 * Gate 3A round-9 battery: module-scope producer substitution.
 *
 *   node tools/gate3-producer-battery.js [path/to/scanner.js] [--json out.json]
 *
 * The independent review of round 8 (finding R8-01) showed that a module-scope
 * value read by live authority — ASSET_PROFILES, TTI_GEOMETRY, V5_THRESH,
 * PROFILES, SECONDS … — could change while every consumer expression and every
 * authority function stayed byte-identical, and the baseline reported nothing.
 *
 * Every case here changes a producer, not a consumer. Outcomes:
 *   PRODUCER  an AUTHORITY_PRODUCER_DRIFT names the expected producer (or, for a
 *             case that changes a function, sink/owner drift naming it)
 *   OTHER     defects, but none naming it
 *   MISSED    no defect
 * A case marked `consumerPreserved` must also leave every sink and every
 * authority-owner fingerprint unchanged — it is reported at the producer
 * boundary and nowhere else, which is what the review asked to be proven.
 * Precision controls change module-scope values that live authority does not
 * read (legacy-only, renderer-only, research-only) and must scan clean.
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

function once(src, anchor, replacement) {
  if (src.split(anchor).length !== 2) throw new Error(`anchor not unique: ${anchor.slice(0, 60)}`);
  return src.replace(anchor, () => replacement);
}
function inOwner(src, owner, anchor, replacement) {
  const ix = S.functionIndex(src);
  let p = -1, hit = -1;
  while ((p = src.indexOf(anchor, p + 1)) >= 0) if (S.ownerOf(ix, p) === owner) { if (hit >= 0) throw new Error(`anchor not unique in ${owner}`); hit = p; }
  if (hit < 0) throw new Error(`anchor not inside ${owner}: ${anchor.slice(0, 60)}`);
  return src.slice(0, hit) + replacement + src.slice(hit + anchor.length);
}
const AUD = '"AUDUSD":{"cls":"REAL_MARKET","stopScale":1.2020085728250887,"sess":true,"tail":true,"dir":null';

// [category, name, expected producer, consumerPreserved, mutate]
const CASES = [
  ['property-value', 'ASSET_PROFILES.AUDUSD.dir null -> BUY (consumer ASSET_PROFILES[k] untouched)', 'ASSET_PROFILES', true, () => once(BASE, AUD, AUD.replace('"dir":null', '"dir":"BUY"'))],
  ['property-removal', 'ASSET_PROFILES.AUDUSD.tail removed', 'ASSET_PROFILES', true, () => once(BASE, AUD, AUD.replace('"tail":true,', ''))],
  ['property-removal', 'V5_THRESH.minFamilies removed', 'V5_THRESH', true, () => once(BASE, 'minRegime:0.55,minFamilies:2}', 'minRegime:0.55}')],
  ['numeric-threshold', 'TTI_GEOMETRY.readyMinTP1R 1.0 -> 0.3', 'TTI_GEOMETRY', true, () => once(BASE, 'readyMinTP1R:1.0,', 'readyMinTP1R:0.3,')],
  ['numeric-threshold', 'RETEST_POLICY M5 confirmBars 3 -> 1', 'RETEST_POLICY', true, () => once(BASE, 'M5:{maxAgeSec:3*60*60,confirmBars:3}', 'M5:{maxAgeSec:3*60*60,confirmBars:1}')],
  ['nested-profile-field', 'PROFILES.SCALP execution M1 -> M5', 'TTI_PROFILE_ENGINE', true, () => once(BASE, "SCALP: Object.freeze({id:'SCALP',label:'Scalp',setups:['M5'],execution:'M1'", "SCALP: Object.freeze({id:'SCALP',label:'Scalp',setups:['M5'],execution:'M5'")],
  ['array-member', 'PROFILES.SCALP setups [M5] -> [M1]', 'TTI_PROFILE_ENGINE', true, () => once(BASE, "SCALP: Object.freeze({id:'SCALP',label:'Scalp',setups:['M5']", "SCALP: Object.freeze({id:'SCALP',label:'Scalp',setups:['M1']")],
  ['constant-value', 'ZUGRIO_ATR_PERIOD 14 -> 7', 'ZUGRIO_ATR_PERIOD', true, () => once(BASE, 'const ZUGRIO_ATR_PERIOD=14;', 'const ZUGRIO_ATR_PERIOD=7;')],
  ['table-entry', 'SECONDS.M1 60 -> 6000', 'SECONDS', true, () => once(BASE, 'const SECONDS={M1:60,', 'const SECONDS={M1:6000,')],
  ['table-entry', 'TTI_SPECIALIST_MODELS.VOLATILITY model id', 'TTI_SPECIALIST_MODELS', true, () => once(BASE, "VOLATILITY:'VOLATILITY_STRUCTURE_V1'", "VOLATILITY:'CORE_STRUCTURE_MTF_V2'")],
  ['default-fallback', 'DEFAULT_PROFILE.stopScale 1.0 -> 3.0', 'DEFAULT_PROFILE', true, () => once(BASE, "const DEFAULT_PROFILE={cls:'UNKNOWN',stopScale:1.0", "const DEFAULT_PROFILE={cls:'UNKNOWN',stopScale:3.0")],
  ['enum-mapping', 'SETUP_TYPES.SWEEP mapped to the FVG value', 'SETUP_TYPES', true, () => once(BASE, "SWEEP:'LIQUIDITY_SWEEP_REVERSAL',FVG:'FVG_MITIGATION'", "SWEEP:'FVG_MITIGATION',FVG:'FVG_MITIGATION'")],
  ['top-level-function', 'pivots() left-side test >= -> >', 'pivots', true, () => once(BASE, 'if(left.every(c=>a[i].h>=c.h)&&right.every(c=>a[i].h>c.h))H.push', 'if(left.every(c=>a[i].h>c.h)&&right.every(c=>a[i].h>c.h))H.push')],
  // laundering routes around a name-based closure
  ['writer', 'a UI handler writes TTI_GEOMETRY at runtime', 'setMM', false, () => inOwner(BASE, 'setMM', 'marketMode=m;', 'marketMode=m;TTI_GEOMETRY.readyMinTP1R=0.2;')],
  ['alias-write', 'new function writes ASSET_PROFILES through a local alias', 'zgTune', false, () => BASE + "\nfunction zgTune(){const p=ASSET_PROFILES;p.AUDUSD.dir='BUY';}\nzgTune();\n"],
  ['argument-write', 'ASSET_PROFILES passed to a helper that writes its parameter', 'zgSet', false, () => BASE + "\nfunction zgSet(t){t.AUDUSD.dir='BUY';}\nzgSet(ASSET_PROFILES);\n"],
  ['effect-call', 'top-level call to a function that writes ASSET_PROFILES', 'zgMut', false, () => BASE + "\nfunction zgMut(){ASSET_PROFILES.AUDUSD.dir='BUY';}\nzgMut();\n"],
  ['top-level-write', 'module-level statement writes V5_THRESH after its declaration', 'V5_THRESH', true, () => BASE + '\nV5_THRESH.ready=0.2;\n'],
  // [round 10] found by the pre-review of round 9: paths under a producer, and
  // reflective writes. The expected name is the producer, the writer, or — for
  // a nameless route — `DYNAMIC:<construct>`.
  ['path-alias', 'alias of a nested member written through', 'zgN', false, () => BASE + "\nfunction zgN(){const a=ASSET_PROFILES.AUDUSD;a.dir='BUY';}\nzgN();\n"],
  ['path-argument', 'nested member passed to a helper that writes it', 'ASSET_PROFILES', false, () => BASE + "\nfunction zgP(o){o.dir='BUY';}\nzgP(ASSET_PROFILES.AUDUSD);\n"],
  ['reflective', 'Object.defineProperty getter on a nested member (module level)', 'ASSET_PROFILES', false, () => BASE + "\nObject.defineProperty(ASSET_PROFILES.AUDUSD,'dir',{get(){return 'BUY';}});\n"],
  ['reflective', 'Reflect.set on a nested member (module level)', 'ASSET_PROFILES', false, () => BASE + "\nReflect.set(ASSET_PROFILES.AUDUSD,'dir','BUY');\n"],
  ['reflective', 'Object.defineProperty inside a UI handler', 'setMM', false, () => inOwner(BASE, 'setMM', 'marketMode=m;', "marketMode=m;Object.defineProperty(ASSET_PROFILES.AUDUSD,'dir',{value:'BUY'});")],
  ['nameless', 'computed global lookup', 'DYNAMIC:GLOBAL_COMPUTED', false, () => BASE + "\nwindow['ASSET_'+'PROFILES'].AUDUSD.dir='BUY';\n"],
  ['nameless', 'eval', 'DYNAMIC:EVAL', false, () => BASE + "\neval(\"ASSET_PROFILES.AUDUSD.dir='BUY'\");\n"],
  ['nameless', 'Function constructor', 'DYNAMIC:FUNCTION_CONSTRUCTOR', false, () => BASE + "\nnew Function(\"ASSET_PROFILES.AUDUSD.dir='BUY'\")();\n"],
  ['nameless', 'string timer', 'DYNAMIC:STRING_TIMER', false, () => BASE + "\nsetTimeout(\"ASSET_PROFILES.AUDUSD.dir='BUY'\",0);\n"],
  ['nameless', 'prototype pollution', 'DYNAMIC:PROTOTYPE', false, () => BASE + "\nObject.prototype.dir='BUY';\n"],
];

const CONTROLS = [
  ['SIGNAL_STATES (read only by unreachable legacy code)', () => once(BASE, "READY:'READY',FIRE:'FIRE',EXPIRED", "READY:'FIRE',FIRE:'FIRE',EXPIRED")],
  ['GLOSSARY text (renderer only)', () => once(BASE, "{t:'Structure',d:'The shape price has been making", "{t:'Structure',d:'The form price has been making")],
  ['CONTINUATION_REGIMES (research-only reference study)', () => once(BASE, "new Set(['TRENDING','EXPANSION','BREAKOUT'])", "new Set(['TRENDING','EXPANSION'])")],
  ['comment and layout inside ASSET_PROFILES', () => once(BASE, AUD, '/* reviewer note */\n  ' + AUD.replace(',"sess"', ', "sess"'))],
];

const rows = [];
for (const [category, name, producer, consumerPreserved, fn] of CASES) {
  let outcome = 'ERROR', detail = '', localised = null;
  try {
    const d = S.scanSource(fn(), 'producer-battery').inventoryDefects;
    // a writer may already be an authority owner through the round-6 global-write
    // closure; then it is reported as sink/owner drift naming it, which counts
    // for cases that change a function (never for consumer-preserving ones)
    const hit = (producer.startsWith('DYNAMIC:') && d.find((x) => x.startsWith(`DYNAMIC_ACCESS_DRIFT: ${producer.slice(8)} `)))
      || d.find((x) => x.startsWith(`AUTHORITY_PRODUCER_DRIFT: ${producer} `))
      || (!consumerPreserved && d.find((x) => x.startsWith(`AUTHORITY_BASELINE_DRIFT: ${producer} `) || x.startsWith(`AUTHORITY_OWNER_DRIFT: ${producer} `)));
    outcome = hit ? 'PRODUCER' : d.length ? 'OTHER' : 'MISSED';
    detail = (hit || d[0] || '').slice(0, 140);
    localised = !d.some((x) => /^AUTHORITY_(?:BASELINE|OWNER)_DRIFT:/.test(x));
  } catch (e) { detail = e.message; }
  const pass = outcome === 'PRODUCER' && (!consumerPreserved || localised);
  rows.push({ category, name, producer, consumerPreserved, outcome, onlyAtProducerBoundary: localised, pass, detail });
  console.log(`${category.padEnd(20)} ${name.padEnd(76)} ${outcome}${consumerPreserved ? (localised ? '  (producer boundary only)' : '  <-- consumer drift too') : ''}`);
}
const controls = [];
for (const [name, fn] of CONTROLS) {
  let n = -1, err = '', first = '';
  try { const d = S.scanSource(fn(), 'control').inventoryDefects; n = d.length; first = d[0] || ''; } catch (e) { err = e.message; }
  controls.push({ name, defects: n, error: err, first: first.slice(0, 140) });
  console.log(`control              ${name.padEnd(76)} ${n === 0 ? 'clean' : 'DEFECTS ' + n + ' ' + (err || first.slice(0, 100))}`);
}
const clean = S.scanSource(BASE, 'clean').inventoryDefects.length;
const summary = { cases: rows.length, failed: rows.filter((r) => !r.pass).length, producer: rows.filter((r) => r.outcome === 'PRODUCER').length, missed: rows.filter((r) => r.outcome === 'MISSED').length, controlsFailed: controls.filter((c) => c.defects !== 0).length, cleanArtifactDefects: clean };
console.log(`--- ${summary.cases} cases, failed ${summary.failed}: producer ${summary.producer}, missed ${summary.missed}; controls failed ${summary.controlsFailed}; clean-artifact defects ${clean}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ scanner: path.relative(path.join(__dirname, '..'), scannerPath), summary, rows, controls }, null, 2) + '\n');
if (summary.failed || summary.controlsFailed || clean) process.exitCode = 1;
