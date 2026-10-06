'use strict';
/**
 * Gate 3A freeze addendum — auditable reference-escape dispositions.
 *
 *   node tools/verify-dispositions.js
 *
 * The round-11 register (`../round11/evidence/GATE3A-REFERENCE-ESCAPES.json`)
 * labels each of the artifact's producer hand-off sites. The independent
 * review required that a label must not count merely because the generator
 * assigned it: every disposition must carry enough evidence to reproduce why
 * it is safe for this artifact. This verifier re-derives each disposition
 * from the artifact itself, by a method independent of the generator's
 * label, and records raw evidence (statement text, fingerprint hashes,
 * alias uses, evaluated values) so a person can check each row without
 * trusting either tool.
 *
 *   VERIFIED     the mechanical check passed; the evidence shows why
 *   UNRESOLVED   the check did not pass — an authority-relevant occurrence
 *                without a reproducible disposition
 *
 * `unresolved = 0` is the freeze condition: zero unresolved
 * authority-relevant occurrences, not zero rows a tool chose to flag.
 *
 * The scanner used here (`gate3-authority-inventory.diag.js`) is the round-11
 * scanner plus non-enumerable diagnostics (site positions, fingerprinted
 * ranges); it is proven to regenerate round 11's inventory and baseline
 * byte for byte before any row is checked.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const D = require('./gate3-authority-inventory.diag.js');

const R11 = path.join(__dirname, '..', '..', 'round11');
const ART = path.join(R11, 'artifacts', 'Zugrio-1.0.0-gate2.2.html');
const html = fs.readFileSync(ART, 'utf8');
const artifactSha = crypto.createHash('sha256').update(html).digest('hex');
const code = D.inlineScripts(html).join('\n');
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// 0. identity: this scanner reproduces round 11 exactly
const inv = D.scanArtifact(ART);
const refInv = JSON.parse(fs.readFileSync(path.join(R11, 'evidence', 'GATE3-AUTHORITY-INVENTORY.json'), 'utf8')).inventory;
const refBaseline = fs.readFileSync(path.join(R11, 'tools', 'gate3-authority-baseline.json'), 'utf8');
const identity = {
  artifactSha256: artifactSha,
  inventoryIdenticalToRound11: JSON.stringify(inv) === JSON.stringify(refInv),
  baselineIdenticalToRound11: JSON.stringify(D.baselineDocument(inv.observedBaseline, inv.artifactSha256), null, 1) + '\n' === refBaseline,
};
if (!identity.inventoryIdenticalToRound11 || !identity.baselineIdenticalToRound11) throw new Error('diagnostic scanner does not reproduce round 11 — refusing to verify');

const ob = inv.observedBaseline;
const baseline = JSON.parse(refBaseline);
const register = JSON.parse(fs.readFileSync(path.join(R11, 'evidence', 'GATE3A-REFERENCE-ESCAPES.json'), 'utf8'));
const index = D.functionIndex(code);
const blanked = D.blankNonCode(code);
const ownerSha = new Map(baseline.owners.map((o) => [o.owner, o.sha256]));

// sites with positions, in the register's own order
const key = (e) => `${e.producer}\u0000${e.owner}\u0000${e.context}\u0000${e.sha256}`;
const sitesByKey = new Map();
for (const e of ob.referenceEscapes) { if (!sitesByKey.has(key(e))) sitesByKey.set(key(e), []); sitesByKey.get(key(e)).push(e); }

const text = (a, z) => code.slice(a, z).replace(/\s+/g, ' ').trim();
const near = (pos, n = 70) => text(Math.max(0, pos - n), Math.min(code.length, pos + n));

function checkFingerprintedFunction(site) {
  const fn = site.diag.fn;
  if (!fn) return { ok: false, why: 'site is not inside a named function' };
  // (a) an authority owner: recompute its code-only fingerprint from the artifact
  if (ownerSha.has(fn.name)) {
    const fns = index.filter((f) => f.name === fn.name);
    const recomputed = sha(fns.map((f) => D.canonicalCode(code.slice(f.start, f.end + 1))).join('\u0000'));
    return { ok: recomputed === ownerSha.get(fn.name), basis: 'site lies inside an authority-owner function whose whole body is fingerprinted in the baseline', evidence: { function: fn.name, fingerprintKind: 'AUTHORITY_OWNER', baselineSha256: ownerSha.get(fn.name), recomputedSha256: recomputed } };
  }
  // (b) a producer function or writer: a fingerprinted range must contain the site
  for (const p of ob.producers) for (const [a, z] of p.ranges) if (a <= site.diag.pos && site.diag.pos < z && a <= fn.start && fn.end < z) {
    const frozen = baseline.producers.find((q) => q.producer === p.producer && q.kind === p.kind && q.sha256 === p.sha256);
    return { ok: !!frozen, basis: 'site lies inside a function whose whole body is part of a frozen producer fingerprint', evidence: { function: fn.name, fingerprintKind: p.kind, producer: p.producer, baselineSha256: frozen && frozen.sha256 } };
  }
  return { ok: false, why: `function ${fn.name} is neither an authority owner nor wholly inside a producer fingerprint` };
}
function checkModuleStatement(site) {
  for (const p of ob.producers) for (const [a, z] of p.ranges) if (a <= site.diag.pos && site.diag.pos < z) {
    const frozen = baseline.producers.find((q) => q.producer === p.producer && q.kind === p.kind && q.sha256 === p.sha256);
    return { ok: !!frozen, basis: 'the module-level statement holding the site is part of a frozen producer fingerprint', evidence: { producer: p.producer, fingerprintKind: p.kind, fingerprintedRange: [a, z], baselineSha256: frozen && frozen.sha256 } };
  }
  return { ok: false, why: 'no frozen producer fingerprint contains this module-level statement' };
}
function checkPrimitiveMember(site) {
  const rest = blanked.slice(site.diag.pos + site.producer.length, site.diag.pos + site.producer.length + 200);
  const m = /^((?:\s*\??\.\s*[A-Za-z_$][\w$]*)+)/.exec(rest);
  if (!m) return { ok: false, why: 'no member path after the producer' };
  const pathParts = m[1].replace(/\s/g, '').split(/\??\./).filter(Boolean);
  const pathText = `${site.producer}.${pathParts.join('.')}`;
  if (pathParts[pathParts.length - 1] === 'length') return { ok: true, basis: 'the handed-off value is `.length` of the producer path: a number, not a reference', evidence: { path: pathText } };
  // evaluate the producer's own declarator in an empty sandbox and read the path.
  // Sound only for a binding that is never written after declaration: the
  // declarator gives the INITIAL value (state.status is null there and an
  // object at runtime). A binding with any writer, or any module-level write
  // statement in its fingerprint, does not qualify.
  const writers = ob.producers.filter((p) => p.kind === 'PRODUCER_WRITER' && (p.writes || []).includes(site.producer)).map((p) => p.producer);
  const binding = ob.producers.find((p) => p.kind === 'TOP_LEVEL_BINDING' && p.producer === site.producer);
  const moduleWrites = binding ? binding.segments - site.diag.declSegs.length : 0;
  if (writers.length || moduleWrites > 0) return { ok: false, why: `binding is written after declaration (writers: ${writers.join(', ') || 'none'}; module-level statements: ${moduleWrites}), so its declarator does not fix the value` };
  const decl = site.diag.declSegs.map(([a, z]) => code.slice(a, z)).join(';');
  const init = decl.slice(decl.indexOf('=') + 1);
  try {
    const value = vm.runInNewContext(`(${init})`, { Object, Math, Number, String, Boolean, Array, JSON, NaN, Infinity }, { timeout: 200 });
    let v = value;
    for (const k of pathParts) v = v == null ? undefined : v[k];
    const primitive = v === null || (typeof v !== 'object' && typeof v !== 'function');
    return { ok: primitive, basis: 'the producer is never written after declaration, and its declarator, evaluated in an empty sandbox, holds a primitive at this path', evidence: { path: pathText, writers: [],  value: v === undefined ? 'undefined' : JSON.stringify(v), declarator: text(site.diag.declSegs[0][0], Math.min(site.diag.declSegs[0][1], site.diag.declSegs[0][0] + 160)) } };
  } catch (e) {
    return { ok: false, why: `declarator could not be evaluated in isolation (${e.message.slice(0, 80)})` };
  }
}
function checkReadOnlyAlias(site) {
  const fn = site.diag.fn;
  if (!fn) return { ok: false, why: 'alias at module level' };
  const before = blanked.slice(Math.max(fn.bodyStart, site.diag.pos - 80), site.diag.pos);
  const am = /(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*$/.exec(before);
  if (!am) return { ok: false, why: 'alias name not identifiable' };
  const alias = am[1];
  const body = blanked.slice(fn.bodyStart, fn.end);
  const uses = [];
  const re = new RegExp(`(?<![\\w$.])${alias.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
  let mm;
  while ((mm = re.exec(body))) {
    const at = fn.bodyStart + mm.index;
    if (at < site.diag.pos - 80) continue;
    const after = blanked.slice(at + alias.length, at + alias.length + 160);
    const prev = blanked.slice(Math.max(0, at - 12), at);
    const memberPath = (/^(?:\s*\??\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]]*\])*/.exec(after) || [''])[0];
    const tail = after.slice(memberPath.length);
    let use = 'READ';
    if (/^\s*(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=(?![=>])/.test(tail) && memberPath) use = 'WRITE_THROUGH';
    else if (/^\s*\.\s*(?:push|splice|pop|shift|unshift|set|add|delete|clear|fill|sort|reverse|copyWithin)\s*\(/.test(tail)) use = 'MUTATING_CALL';
    else if (!memberPath && /^\s*(?:[,;)\]}]|$)/.test(tail) && /(?:[(,=]|\breturn|\.\.\.)\s*$/.test(prev) && at !== site.diag.pos) use = 'HANDED_ON';
    else if (/(?:Object\.assign\(|\bdelete)\s*$/.test(prev)) use = 'MUTATING_CALL';
    if (/(?:const|let|var)\s*$/.test(prev) && /^\s*=/.test(after)) use = 'DECLARATION';
    uses.push({ use, at, context: near(at, 45) });
  }
  const unsafe = uses.filter((u) => u.use === 'WRITE_THROUGH' || u.use === 'MUTATING_CALL' || u.use === 'HANDED_ON');
  return { ok: unsafe.length === 0, basis: 'every use of the alias in its function is a read: no write through it, no mutating call, not handed on', evidence: { function: fn.name, alias, uses: uses.map(({ use, context }) => ({ use, context })) }, ...(unsafe.length ? { why: `alias ${alias} is ${unsafe.map((u) => u.use).join(', ')}` } : {}) };
}
const frozenDyn = new Set(baseline.dynamicAccess.map((x) => `${x.kind}\u0000${x.owner}\u0000${x.sha256}`));
function checkFrozenDynamicStatement(site) {
  const pos = site.diag ? site.diag.pos : site.pos;
  for (const x of ob.dynamicAccess) if (x.range[0] <= pos && pos < x.range[1] && frozenDyn.has(`${x.kind}\u0000${x.owner}\u0000${x.sha256}`))
    return { ok: true, basis: 'the occurrence lies inside a statement frozen as a dynamic-access site; any change to it, or any new access to the same global, is DYNAMIC_ACCESS_DRIFT', evidence: { dynamicAccessKind: x.kind, owner: x.owner, frozenStatementSha256: x.sha256, range: x.range } };
  return { ok: false, why: 'not inside a frozen dynamic-access statement' };
}
// A member read off a const binding whose declarator holds a primitive there,
// where that member NAME is never written anywhere in the artifact — on any
// object, through any alias, by assignment, computed key, Object.assign source
// key, delete or defineProperty. Then no code in the frozen artifact can change
// the value, whatever aliases of the binding exist.
const ASSIGN_OP_RE = '(?:\\*\\*|<<|>>>|>>|&&|\\|\\||\\?\\?|[-+*/%&|^])?=(?![=>])';
function memberNeverWritten(member) {
  const e = member.replace(/\$/g, '\\$');
  const pats = [
    new RegExp(`\\.\\s*${e}\\s*${ASSIGN_OP_RE}`), new RegExp(`\\[\\s*['"\`]${e}['"\`]\\s*\\]\\s*${ASSIGN_OP_RE}`),
    new RegExp(`\\bdelete\\s+[^;]*\\.\\s*${e}\\b`), new RegExp(`defineProperty\\([^,]*,\\s*['"\`]${e}['"\`]`),
    new RegExp(`Object\\.assign\\([^;]*[{,]\\s*['"]?${e}['"]?\\s*:`),
  ];
  // object keys are blanked in `blanked` only by blankObjectKeys, not here: search the code-only text
  return pats.filter((re) => re.test(blanked)).map((re) => re.source.slice(0, 40));
}
function checkConstPrimitiveUnwritten(site) {
  const decl = site.diag.declSegs.map(([a, z]) => code.slice(a, z)).join(';');
  const declStart = site.diag.declSegs[0][0];
  const kw = /(const|let|var)\s*$/.exec(blanked.slice(Math.max(0, declStart - 12), declStart));
  if (!kw || kw[1] !== 'const') return { ok: false, why: 'binding is not const' };
  const rest = blanked.slice(site.diag.pos + site.producer.length, site.diag.pos + site.producer.length + 200);
  const m = /^((?:\s*\??\.\s*[A-Za-z_$][\w$]*)+)/.exec(rest);
  if (!m) return { ok: false, why: 'no member path' };
  const parts = m[1].replace(/\s/g, '').split(/\??\./).filter(Boolean);
  let v;
  try { v = vm.runInNewContext(`(${decl.slice(decl.indexOf('=') + 1)})`, { Object, Math, Number, String, Boolean, Array, JSON, NaN, Infinity }, { timeout: 200 }); for (const k of parts) v = v == null ? undefined : v[k]; }
  catch (e) { return { ok: false, why: `declarator not evaluable (${e.message.slice(0, 60)})` }; }
  if (!(v === null || (typeof v !== 'object' && typeof v !== 'function'))) return { ok: false, why: 'declarator value at path is not primitive' };
  const hits = parts.flatMap((k) => memberNeverWritten(k).map((h) => `${k}: ${h}`));
  return hits.length ? { ok: false, why: `member written somewhere in the artifact (${hits.join('; ')})` }
    : { ok: true, basis: 'const binding; its declarator holds a primitive at this path; no member on the path is ever written anywhere in the artifact (assignment, computed key, Object.assign key, delete, defineProperty)', evidence: { path: `${site.producer}.${parts.join('.')}`, value: v === undefined ? 'undefined' : JSON.stringify(v), membersChecked: parts } };
}
// const binding whose evaluated declarator is Object.freeze-d at every level of
// the path and primitive at its end: a frozen property cannot be reassigned
// (strict mode throws, sloppy mode ignores) and a const cannot be rebound.
function checkConstDeepFrozen(site) {
  const declStart = site.diag.declSegs[0][0];
  const kw = /(const|let|var)\s*$/.exec(blanked.slice(Math.max(0, declStart - 12), declStart));
  if (!kw || kw[1] !== 'const') return { ok: false, why: 'binding is not const' };
  const decl = site.diag.declSegs.map(([a, z]) => code.slice(a, z)).join(';');
  const rest = blanked.slice(site.diag.pos + site.producer.length, site.diag.pos + site.producer.length + 200);
  const m = /^((?:\s*\??\.\s*[A-Za-z_$][\w$]*)+)/.exec(rest);
  if (!m) return { ok: false, why: 'no member path' };
  const parts = m[1].replace(/\s/g, '').split(/\??\./).filter(Boolean);
  let v;
  try { v = vm.runInNewContext(`(${decl.slice(decl.indexOf('=') + 1)})`, { Object, Math, Number, String, Boolean, Array, JSON, NaN, Infinity }, { timeout: 200 }); } catch (e) { return { ok: false, why: `declarator not evaluable (${e.message.slice(0, 60)})` }; }
  const frozenChain = [];
  for (const k of parts) { if (v == null || typeof v !== 'object' || !Object.isFrozen(v)) return { ok: false, why: `not frozen at .${k}` }; frozenChain.push(k); v = v[k]; }
  if (!(v === null || (typeof v !== 'object' && typeof v !== 'function'))) return { ok: false, why: 'value at path is not primitive' };
  return { ok: true, basis: 'const binding, Object.freeze-d at every level of this path (verified by evaluating its declarator), primitive at its end: no code can change the value', evidence: { path: `${site.producer}.${parts.join('.')}`, value: JSON.stringify(v), frozenAt: frozenChain } };
}
const CHECK = { BOUND_FINGERPRINTED_FUNCTION: checkFingerprintedFunction, BOUND_MODULE_STATEMENT: checkModuleStatement, PRIMITIVE_MEMBER: checkPrimitiveMember, READ_ONLY_ALIAS: checkReadOnlyAlias };
// when the generator's label does not reproduce, the row may still be safe on
// another reproducible basis; the basis that actually held is recorded
const FALLBACK = [['PRIMITIVE_MEMBER', checkPrimitiveMember], ['CONST_PRIMITIVE_MEMBER_NEVER_WRITTEN', checkConstPrimitiveUnwritten], ['CONST_DEEP_FROZEN_PRIMITIVE', checkConstDeepFrozen], ['BOUND_FINGERPRINTED_FUNCTION', checkFingerprintedFunction], ['BOUND_MODULE_STATEMENT', checkModuleStatement], ['FROZEN_DYNAMIC_ACCESS_STATEMENT', checkFrozenDynamicStatement]];

const used = new Map();
const rows = register.rows.map((r, i) => {
  const k = key(r), list = sitesByKey.get(k) || [], n = used.get(k) || 0;
  used.set(k, n + 1);
  const site = list[n];
  if (!site) return { row: i, ...r, status: 'UNRESOLVED', why: 'register row has no matching site in the artifact' };
  const check = CHECK[r.binding];
  let res = check ? check(site) : { ok: false, why: `no verifier for disposition ${r.binding}` }, verifiedAs = r.binding;
  if (!res.ok) for (const [name, fn] of FALLBACK) { const alt = fn(site); if (alt.ok) { res = { ...alt, labelDidNotReproduce: `${r.binding}: ${res.why}` }; verifiedAs = name; break; } }
  return {
    row: i, producer: r.producer, owner: r.owner, context: r.context, disposition: r.binding, verifiedAs,
    ...(res.labelDidNotReproduce ? { labelDidNotReproduce: res.labelDidNotReproduce } : {}),
    status: res.ok ? 'VERIFIED' : 'UNRESOLVED',
    basis: res.basis, ...(res.why ? { why: res.why } : {}),
    statement: text(...site.diag.stmt).slice(0, 240),
    evidence: res.evidence,
  };
});
// --- implicit globals: a name created only by `window.NAME = …` and then read
// by its bare name is neither a module binding (producer closure) nor a
// window.* site (dynamic-access inventory). Present in the artifact, so per
// stopping-rule item 3 every bare use is listed and dispositioned.
const liveSinks = inv.sinks.filter((x) => x.reachability === 'REACHABLE_AUTHORITY');
const liveText = liveSinks.map((x) => `${x.expression} ${x.fullConsequence ?? x.consequence ?? ''}`).join('\n');
const assigned = [...new Set([...blanked.matchAll(/(?<![\w$.])(?:window|globalThis|self)\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map((m) => m[1]))].sort();
const declared = new Set([...blanked.matchAll(/(?<![\w$.])(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
const implicitOnly = assigned.filter((n) => !declared.has(n));
const globalRows = [];
for (const name of implicitOnly) {
  const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
  for (const m of blanked.matchAll(re)) {
    const pos = m.index, fn = (() => { let best = null; for (const f of index) if (f.start <= pos && pos <= f.end && (!best || f.end - f.start < best.end - best.start)) best = f; return best; })();
    const site = { pos, producer: name, diag: { pos, fn: fn ? { name: fn.name, start: fn.start, end: fn.end } : null } };
    let res = fn ? checkFingerprintedFunction(site) : { ok: false };
    let verifiedAs = 'BOUND_FINGERPRINTED_FUNCTION';
    if (!res.ok) { res = checkFrozenDynamicStatement(site); verifiedAs = 'FROZEN_DYNAMIC_ACCESS_STATEMENT'; }
    if (!res.ok) {
      // not read by live authority: no live sink names the global, nor any member written on it here
      const written = (/^\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/.exec(blanked.slice(pos + name.length, pos + name.length + 80)) || [])[1];
      const read = new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(liveText) || (written && new RegExp(`\\.${written}(?![\\w$])`).test(liveText));
      res = read ? { ok: false, why: `live authority reads ${written ? name + '.' + written : name}` } : { ok: true, basis: 'no live authority sink reads this global (or the member written on it); the use is presentation/UI state', evidence: { checkedLiveSinks: liveSinks.length, memberWritten: written || null } };
      verifiedAs = 'NOT_READ_BY_LIVE_AUTHORITY';
    }
    globalRows.push({ global: name, owner: fn ? fn.name : '<top-level>', status: res.ok ? 'VERIFIED' : 'UNRESOLVED', verifiedAs, basis: res.basis, ...(res.why && !res.ok ? { why: res.why } : {}), context: near(pos, 60), evidence: res.evidence });
  }
}
// --- negative self-tests: each check must REJECT a case where it should fail
const posOf = (needle, n = 0) => { let p = -1; for (let i = 0; i <= n; i++) p = code.indexOf(needle, p + 1); if (p < 0) throw new Error('self-test anchor missing: ' + needle); return p; };
const fnOf = (name) => { const f = index.find((x) => x.name === name); return { name: f.name, start: f.start, end: f.end, bodyStart: f.bodyStart }; };
const declOf = (name) => { const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`).exec(code); const a = m.index + m[0].indexOf(name); return [[a, D.blankNonCode(code) && (function () { let d = 0; for (let i = a; i < code.length; i++) { const c = blanked[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) { if (d === 0) return i; d--; } else if ((c === ';' || c === ',') && d === 0) return i; } return code.length; })()]]; };
// the real round-11 site: window.TTI_BROKER={…getStatus:()=>state.status…} in the broker module
const brokerStateSite = ob.referenceEscapes.find((e) => e.producer === 'state' && e.context === 'ARROW_RETURN' && code.slice(e.diag.pos - 14, e.diag.pos) === 'getStatus:()=>');
if (!brokerStateSite) throw new Error('self-test anchor: broker state.status escape not found');
const selfTests = [
  ['fingerprinted-function rejects a renderer outside the fingerprints', () => checkFingerprintedFunction({ producer: 'GLOSSARY', diag: { pos: posOf('function renderGlossary') + 20, fn: fnOf('renderGlossary') } })],
  ['module-statement rejects a binding outside the closure', () => checkModuleStatement({ producer: 'GLOSSARY', diag: { pos: posOf('const GLOSSARY=') + 6 } })],
  ['primitive-member rejects state.status (written at runtime)', () => checkPrimitiveMember(brokerStateSite)],
  ['deep-frozen rejects APA_CONFIG (not frozen)', () => checkConstDeepFrozen({ producer: 'APA_CONFIG', diag: { pos: posOf('APA_CONFIG.version'), declSegs: declOf('APA_CONFIG') } })],
  ['never-written rejects a path whose member is written (state.status)', () => checkConstPrimitiveUnwritten(brokerStateSite)],
].map(([name, fn]) => { let r; try { r = fn(); } catch (e) { r = { ok: true, why: 'self-test error: ' + e.message }; } return { name, rejected: !r.ok, why: r.why || null }; });
// implicit-global rule must see a global that live authority does read
const liveReads = (n) => new RegExp(`(?<![\\w$])${n}(?![\\w$])`).test(liveText);
selfTests.push({ name: 'not-read-by-live-authority rejects ZUGRIO_ATR_OK (read by live sinks)', rejected: liveReads('ZUGRIO_ATR_OK'), why: null });
const byDisposition = rows.reduce((a, r) => { a[r.disposition] = a[r.disposition] || { verified: 0, unresolved: 0 }; a[r.disposition][r.status === 'VERIFIED' ? 'verified' : 'unresolved']++; return a; }, {});
const out = {
  schema: 'zugrio.gate3a-freeze-disposition-audit/1',
  purpose: 'Independent-review amendment to the Gate 3A stopping rule: every reference-escape disposition is re-derived from the artifact by a method independent of the generator label, with raw evidence for each row. unresolved counts authority-relevant occurrences without a reproducible disposition.',
  identity,
  register: { file: 'review/gate3a/round11/evidence/GATE3A-REFERENCE-ESCAPES.json', rows: register.rows.length },
  totals: { rows: rows.length, verified: rows.filter((r) => r.status === 'VERIFIED').length, unresolved: rows.filter((r) => r.status !== 'VERIFIED').length, labelsThatDidNotReproduce: rows.filter((r) => r.labelDidNotReproduce).length, byDisposition },
  rows,
  selfTests,
  implicitGlobals: {
    purpose: 'Globals created only by window.NAME = … and read by bare name: an unmodelled shape present in the artifact (stopping rule item 3). Every bare use is listed and dispositioned.',
    names: implicitOnly,
    totals: { uses: globalRows.length, verified: globalRows.filter((r) => r.status === 'VERIFIED').length, unresolved: globalRows.filter((r) => r.status !== 'VERIFIED').length, byBasis: globalRows.reduce((a, r) => ((a[r.verifiedAs] = (a[r.verifiedAs] || 0) + 1), a), {}) },
    rows: globalRows,
  },
};
fs.writeFileSync(path.join(__dirname, '..', 'GATE3A-DISPOSITION-AUDIT.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`identity: inventory ${identity.inventoryIdenticalToRound11}, baseline ${identity.baselineIdenticalToRound11}`);
console.log(`${out.totals.rows} rows: verified ${out.totals.verified}, unresolved ${out.totals.unresolved}`, JSON.stringify(byDisposition));
for (const r of rows.filter((x) => x.status !== 'VERIFIED')) console.log(`  UNRESOLVED #${r.row} ${r.producer} ${r.context} in ${r.owner} [${r.disposition}]: ${r.why}`);
for (const r of rows.filter((x) => x.labelDidNotReproduce)) console.log(`  label did not reproduce #${r.row} ${r.producer} (${r.labelDidNotReproduce.split(':')[0]}) -> verified as ${r.verifiedAs}`);
const G = out.implicitGlobals.totals;
console.log(`implicit globals ${implicitOnly.length} names, ${G.uses} bare uses: verified ${G.verified}, unresolved ${G.unresolved}`, JSON.stringify(G.byBasis));
for (const r of globalRows.filter((x) => x.status !== 'VERIFIED')) console.log(`  UNRESOLVED ${r.global} in ${r.owner}: ${r.why}`);
for (const t of selfTests) console.log(`  self-test ${t.rejected ? 'ok  ' : 'FAIL'} ${t.name}${t.why ? ' — ' + t.why.slice(0, 90) : ''}`);
if (out.totals.unresolved || G.unresolved || selfTests.some((t) => !t.rejected)) process.exitCode = 1;
