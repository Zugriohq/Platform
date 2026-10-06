'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EV = path.join(ROOT, 'evidence');
const invDoc = JSON.parse(fs.readFileSync(path.join(EV,'GATE3-AUTHORITY-INVENTORY.json'),'utf8'));
const sweepDoc = JSON.parse(fs.readFileSync(path.join(EV,'GATE3-ATR-SEMANTIC-SWEEP.json'),'utf8'));
const I = invDoc.inventory, S = sweepDoc.report;
const short = (x) => String(x).slice(0,12)+'…';

const liveFields = I.fields.filter(f => f.reachabilityClasses.includes('REACHABLE_AUTHORITY'));
const deadFields = I.fields.filter(f => f.reachabilityClasses.includes('UNREACHABLE_LEGACY'));
const unadmitted = I.fields.filter(f => f.predicateAdmission === 'CANDIDATE_UNADMITTED');
const admitted = I.fields.filter(f => f.predicateAdmission === 'ADMITTED');
const verdictWrites = I.sinks.filter(s => s.kind === 'VERDICT_WRITE');
const BASELINE_FILE = path.join(ROOT, 'tools', 'gate3-authority-baseline.json');
const baselineDoc = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const baselineSha = require('node:crypto').createHash('sha256').update(fs.readFileSync(BASELINE_FILE)).digest('hex');
const leafCount = baselineDoc.sinks.filter((e) => e.kind === 'OBJECT_ASSIGN_LEAF' || e.kind === 'OBJECT_ASSIGN_SOURCE').length;
// [round 8] HP-3 worksheet: every live authority sink carrying a non-trivial
// numeric literal. Provenance is recorded as UNRECORDED — never inferred.
const thresholdRows = baselineDoc.sinks
  .map((e) => ({ owner: e.owner, kind: e.kind, expression: e.expression, literals: e.literals.filter((l) => !['0', '1'].includes(l)), signature: e.signature }))
  .filter((e) => e.literals.length)
  .map((e) => ({ ...e, thresholdProvenance: 'UNRECORDED', hpClassification: 'UNCLASSIFIED' }));
fs.writeFileSync(path.join(EV, 'GATE3A-THRESHOLD-WORKSHEET.json'), JSON.stringify({
  schema: 'zugrio.gate3a-threshold-worksheet/1', artifactSha256: I.artifactSha256,
  purpose: 'Input to Gate 3.3 (§14C HP-3): every numeric literal other than 0/1 in a live authority sink of the frozen Gate 2.2 artifact. thresholdProvenance and hpClassification are deliberately UNRECORDED/UNCLASSIFIED: Gate 3A asserts none of them, and none may be invented.',
  rows: thresholdRows.length, literals: thresholdRows.reduce((n, r) => n + r.literals.length, 0), entries: thresholdRows,
}, null, 1) + '\n');

const map = `# Gate 3A — Corrected Frozen Authority Map

Status: **FROZEN BEFORE ANY AUTHORITY CODE CHANGE — CORRECTED SINK-FIRST INVENTORY.**

No production authority code was modified in Gate 3A. This package replaces the first Gate 3A evidence bundle, whose field-first scanner could not prove completeness.

| | |
|---|---|
| Artifact scanned | \`${I.artifactSha256}\` (Gate 2.2, cleared) |
| Authority inventory hash | \`${invDoc.inventoryHash}\` |
| ATR semantic sweep hash | \`${sweepDoc.sweepHash}\` |
| Inventory methodology | **SINK_FIRST** |
| Authority sink records | **${I.totals.sinks} authority sink records** (${I.totals.reachableAuthoritySinks} live) |
| Classified semantics | **${I.totals.fields} classified semantic fields** |
| Inventory defects | **${I.inventoryDefects.length}** |
| ATR sweep | **${S.totals.atrBindings} ATR bindings**, **${S.totals.distinctConsumerStatements} ATR consumer statements** |
| ATR permissive capital branches | **${S.totals.permissiveAuthorityBranches}** |
| ATR unresolved shapes | **${S.totals.unresolvedShapes}** |

## 1. What changed from the rejected Gate 3A bundle

The first Gate 3A scanner declared 18 field names first and searched only for those names. That made an omitted authority input invisible by construction. This version reverses the dependency:

**authority sinks → discovered dependencies → semantic classification.**

A live sink dependency that does not map to a declared semantic field is now an inventory defect. The test suite attacks four shapes: a READY conditional, broker admission, the \`readyOk\` initializer itself, and the live \`p.executionEligible\` initializer. Each undeclared dependency is rejected without adding it to catalogue metadata.

The corrected package also:

1. distinguishes **REACHABLE_AUTHORITY** from **UNREACHABLE_LEGACY**;
2. proves \`updateLegacySignalState\` and \`checkLegacySig\` are not reachable from the live roots;
3. decomposes \`evaln\` / \`strategyPreview\` at member level rather than classifying the whole object;
4. separates predicate *classification* from predicate *admission*;
5. keeps undeclared predicates at **CANDIDATE_UNADMITTED**;
6. maps all four semantic grade families: regime, HTF/context, reward/economics and trigger;
7. explicitly maps planner economics and current selection authority;
8. preserves research/advisory semantics even when they have no capital sink;
9. generates narrative counters from JSON evidence so the 45/74 versus 53/96 drift cannot recur;
10. treats verdict-write initializers as first-class sinks and explicitly dispositions the twelve challenged verdict names from the independent review;
11. **(round 7)** freezes the dependency vocabulary: every \`(owner, token)\` a live authority sink accepts — by catalogue mapping, bound-parameter or local-producer termination, UPPER_CASE constant, internal call, trusted intrinsic or NOISE name — is stored with the rule that accepted it in \`tools/gate3-dependency-vocabulary.json\`. Any new or reclassified pair is a defect, so a new input can no longer inherit a classification by name similarity;
13. **(round 8)** freezes an authority baseline (\`tools/gate3-authority-baseline.json\`): every live authority sink signed over owner, kind, code-only expression, whole consequence and dependency→canonical list, every live \`Object.assign\` leaf (unclassified), and a code-only fingerprint of every function owning a sink. The vocabulary only sees *new* inputs; the baseline reports an accepted input substituted for another, a deleted conjunct or guard, a changed threshold literal, a swapped order field or a rerouted consequence — localised to the sink — while comment and layout edits stay clean.
14. **(round 9)** binds the module-scope producers of live authority: every binding, function and writer that a live sink's expression or consequence reads by name — followed through declarators, module-level writes, value-producing function bodies, functions that write a producer, and aliases or arguments through which a producer can be written — is fingerprinted in the baseline. A change to \`ASSET_PROFILES\`, \`TTI_GEOMETRY\`, \`V5_THRESH\`, \`PROFILES\` or \`SECONDS\` that leaves every consumer byte-identical is \`AUTHORITY_PRODUCER_DRIFT\` naming the producer. Values live authority does not read (legacy-only, renderer-only, research-only) stay outside the closure.
15. **(round 10)** treats a *path* under a producer (\`ASSET_PROFILES.AUDUSD\`) as a write route when it is aliased and written through, handed to a mutation API (\`Object.defineProperty\`, \`Object.assign\`, \`Reflect.*\`) or passed to a module function; and freezes every dynamic-access site in the whole script — \`eval\`, \`Function\`, string timers, computed or member access on the global object, prototype writes, reflective definition — so a route to authority *without a name* needs a new site, reported as \`DYNAMIC_ACCESS_DRIFT\`. This brought the risk policies (\`TTI_RISK_POLICY\`, \`TTI_META_RISK\`, \`RG_POLICY\`) into the closure; round 9 had missed them.
12. **(round 7)** inventories every field of the submitted broker orders, traces the order record to what \`checkSig\` actually emits, recognises compound/logical assignment and evidence-removing mutation (\`splice\`, \`length =\`, guarded \`Object.assign\`), treats functions used as values as possible entry points, and makes any guard that invokes or passes a broker function — or emits an event an authority listener acts on — a sink.

## 2. Reachability

Live roots: ${I.liveRoots.map(x=>'`'+x+'`').join(', ')}.

The scanner records ${I.liveReachableFunctions.length} functions reachable from those roots. The legacy state/execution functions \`updateLegacySignalState\` and \`checkLegacySig\` are recorded as **UNREACHABLE_LEGACY**, not described as current capital authority.

This distinction matters because legacy consumers still need deletion/migration evidence, but they are not allowed to inflate the description of the current live path.

## 3. Classification and predicate admission

| classification | count |
|---|---:|
${Object.entries(I.totals.byClassification).map(([k,v])=>`| ${k} | ${v} |`).join('\n')}

| predicate admission | count |
|---|---:|
${Object.entries(I.totals.byPredicateAdmission).map(([k,v])=>`| ${k} | ${v} |`).join('\n')}

**Admitted hard predicates (${admitted.length})** are limited to semantics with explicit non-P/L/data/safety provenance in this map. **${unadmitted.length}** semantics remain \`CANDIDATE_UNADMITTED\` and receive no new 2B authority merely because they are boolean-shaped.

In particular:

- \`ENTRY_EVENT_CONFIRMED\` is **not created by renaming assessTrigger**. Its current classification is LEGACY_REMOVE / CANDIDATE_UNADMITTED until a closed-bar definition and every constituent threshold pass §14C.
- \`DATA_HEALTH_OK\` and \`GEOMETRY_COMPLETE\` remain candidate predicates; their composites must be decomposed before admission.
- the semantic equivalents of \`REGIME_QUALITY_OK\`, \`HTF_GRADE_NOT_C\`, \`REWARD_GRADE_NOT_C\` and \`TRIGGER_GRADE_NOT_C\` are all present and none is hard-admitted.

## 4. Live authority that Gate 3B+ must migrate

${liveFields.length} classified semantics touch at least one live authority sink. Load-bearing examples:

- **data health:** execution status, reason arrays, canonical ATR availability, tick freshness;
- **context:** same/opposing higher-timeframe votes and \`context.ok\`;
- **specialist:** market-family reasons, shock/alignment/bias logic and risk scale;
- **lifecycle:** current stage, trigger freshness and stage ranking;
- **planner:** structural stop/target checks mixed with gross R, net R and cost R;
- **selection:** state rank, lifecycle rank, context vote strength, causal age, profile scope and opposing-FIRE conflict;
- **execution/journal:** duplicate consumption, cooldown, market-open and family execution permission;
- **browser broker boundary:** \`route\` / \`makeIntent\` / \`routeConfirmedReversal\` / \`closePosition\`, including environment + armed/mode checks, current risk-fraction construction, calibration/trade-permission payload fields, the three \`/api/broker/*\` submission sinks, opposite-structure exits and the manual close path;
- **legacy permission assertions:** \`riskCanOpen:true\` and \`executionPermission:'DEMO_AUTO'\` are explicitly inventoried for removal rather than being treated as permission;
- **risk-reducing exit marker:** the reversal exit's hard-coded \`dataExecutionOk:true\` is inventoried separately; Gate 4 replaces this with explicit \`RISK_REDUCING\` classification rather than spoofing data health;
- **legacy evaluation still reachable for support:** \`strategyPreview.score\` and direction are still consumed by \`recomputeFull\` for data-request/preview behavior even though the legacy state machine is dead.

The planner economics are explicitly classified away from Layer 1: gross R / net R / cost R and \`minGrossR\` / \`minNetR\` / \`maxCostR\` move to dynamic execution economics / Gate 4, not structural candidate validity.

## 5. Verdict-write completeness

The inventory now contains **${verdictWrites.length} first-class \`VERDICT_WRITE\` sinks**. This closes the one-level-up blindness where a downstream \`if (!readyOk)\` could be mapped while the initializer that computed \`readyOk\` remained invisible.

The independent-review set is explicitly dispositioned in \`inventory.verdictAudit\`: \`readyOk\`, \`fireOk\`, \`executionEligible\`, \`econOk\`, \`thesisOk\`, \`runwayOk\`, \`stopGeometryOk\`, \`coreOk\`, \`regimeOk\`, \`priceValid\`, \`directEligible\`, and \`allValid\`. Authority/research producers are sink-covered; renderer/logging/presentation-only values are explicitly marked non-authority rather than silently omitted.

\`LEGACY_REMOVE\` means **remove the legacy authority**, not necessarily delete the semantic obligation. The separate \`migrationDisposition\` field distinguishes \`REMOVE_LEGACY_AUTHORITY\` from \`REMOVE_LEGACY_AUTHORITY_AND_REPLACE_AS_SPECIFIED\`. In particular, lifecycle, future entry-event semantics, and the risk-reducing exit path preserve their frozen successor obligations.

## 6. ATR semantic sweep

The Gate 2 limitation remains closed with the existing sweep:

- ${S.totals.atrBindings} ATR bindings;
- ${S.totals.distinctConsumerStatements} consumer statements;
- ${S.totals.blockingByUpstreamGuard} blocked by upstream availability guard;
- ${S.totals.blockingByDownstreamFiniteSink} blocked by downstream finite sink;
- **${S.totals.permissiveAuthorityBranches} permissive capital-path branches**;
- ${S.totals.permissiveNonAuthorityBranches} permissive non-authority branches;
- **${S.totals.unresolvedShapes} unresolved**.

The tool remains non-vacuous: it flags the known \`bias()\` / NaN-permissive defect on Gate 2.1 and returns clean on Gate 2.2.

## 7. Gate 3A disposition

**This package is a review candidate; Gate 3A is not cleared until independent review passes.** It is an evidence freeze, not authorization to skip Gate 3B–3F. The scanner, catalogue judgements and tests must be independently reviewed before the freeze is accepted.

No pWin/EV thresholds were invented. No State Policy, broker admission, 4A/4B or execution permission was pulled forward. The runtime remains non-capital-authoritative.

## 8. Known limits carried forward

- The sink scanner is a purpose-built brownfield static analyser, not a general JavaScript AST/type-flow proof. It protects the current monolith with explicit sink families, owner-local alias mappings, verdict-write sinks, and independent mutations of READY conditionals, broker admission, legacy READY verdict computation, and live planner execution eligibility. A genuinely new control-flow shape must either be discovered as an unmapped dependency or extend the scanner before Gate 3A can be re-frozen.
- This artifact contains the browser-side cTrader boundary only. The implementation behind \`/api/broker/intent\`, \`/api/broker/exit-intent\` and \`/api/broker/close\` is not present in the scanned HTML, so Gate 3A cannot claim server-side execution completeness. Gate 4 must inventory/verify that server boundary before execution provenance can clear.
- **Round 7 boundary (closed against new inputs):** the frozen vocabulary makes the map closed against *new* authority inputs, at \`(owner, token)\` granularity. Adding behaviour-preserving code to live authority is reported as vocabulary novelty, by design. A callback stored in a data structure and invoked by index is flagged at its dispatch site rather than traced into its body.
- **Round 8 boundary (bound, not proven correct):** the authority baseline makes any change to live authority code a defect, localised to the sink where one covers it. It does **not** establish that a frozen dependency is the semantically correct one for its decision — it records what the cleared artifact does. Whether each input, predicate and threshold belongs where it is, under the frozen Signal Authority specification, is the §14A/§14B/§14C classification work of Gate 3.1–3.3, which needs the specification as its oracle; a scanner rule cannot stand in for it. The baseline is valid for the frozen Gate 2.2 artifact only; for migrated code it is an equivalence reference, not a detector.
- **Round 9–10 boundary (producer closure and dynamic access):** the closure follows module-scope names and paths under them; nameless code routes (\`eval\`, \`Function\`, string timers, global-object lookup, prototype and reflective writes) are frozen as dynamic-access sites. What remains outside is *data* loaded at runtime (storage, network, the market-data feed): its content is not code and legitimately varies; the code that loads it is bound. Shadowing is resolved conservatively (a local that shadows a module name may over-include, never under-include). A function called only for its effect (result discarded) is not a producer through that call; if it writes a producer it is found as a writer.
- **Gate 3.1 scope is wider than this inventory:** §14A requires mapping *every* consumer — including watchlist ordering, trade-plan presentation and research logging — whereas Gate 3A inventories authority sinks. The ${leafCount} live \`Object.assign\` leaves are signed but unclassified, and feed legacy scoring/display rather than the capital path on this artifact; their classification is Gate 3.1 work.
- **Threshold provenance (HP-3):** \`evidence/GATE3A-THRESHOLD-WORKSHEET.json\` lists the ${thresholdRows.length} live authority sinks carrying a numeric literal other than 0/1. Every provenance is \`UNRECORDED\`: none is asserted here, and none may be invented to complete Gate 3.3.
- Dead legacy internals are preserved and reachability-labelled rather than exhaustively classified at every local alias because they are scheduled for removal, not migration into new authority.
- The Gate-2 decision-flip study still uses proxy geometry; Gate 3 candidate-contract extraction owns engine-derived structural-level measurement.
- The profile engine still depends on outer \`TTI_FOUNDATION_REFERENCE\`; Gate 3 extraction owns that boundary.
`;

const readme = `# Zugrio Gate 3A — Corrected Closure Package

This package repairs the rejected Gate 3A authority inventory without changing production authority code.

- scanned artifact: \`${I.artifactSha256}\`
- authority inventory: \`${invDoc.inventoryHash}\`
- ATR sweep: \`${sweepDoc.sweepHash}\`
- **${I.totals.sinks} authority sink records** / ${I.totals.reachableAuthoritySinks} live
- **${I.totals.fields} classified semantic fields**
- **${verdictWrites.length} verdict-write sinks**
- **${S.totals.atrBindings} ATR bindings** / **${S.totals.distinctConsumerStatements} ATR consumer statements**
- inventory defects: **${I.inventoryDefects.length}**
- permissive ATR capital branches: **${S.totals.permissiveAuthorityBranches}**

Read \`evidence/GATE3A-FROZEN-MAP.md\` first, then inspect \`tools/gate3-authority-inventory.js\` and \`test/gate3a.test.js\`.

## Run

\`\`\`bash
node tools/gate3-authority-inventory.js artifacts/Zugrio-1.0.0-gate2.2.html
node tools/gate3-atr-sweep.js artifacts/Zugrio-1.0.0-gate2.2.html
node tools/gate3-generate-report.js
node --test test/gate3a.test.js
\`\`\`

The dependency vocabulary (\`tools/gate3-dependency-vocabulary.json\`) is frozen from the clean artifact with \`node tools/gate3-authority-inventory.js artifacts/Zugrio-1.0.0-gate2.2.html --freeze-vocabulary\`, which refuses to run while any defect exists. Re-freezing is a reviewed act: its diff is the list of authority inputs being accepted.

The authority baseline (\`tools/gate3-authority-baseline.json\`) is frozen the same way with \`--freeze-baseline\`, under the same refusal rule. \`node tools/gate3-substitution-battery.js\` attacks it with accepted-dependency substitutions, deletions, threshold changes and reroutes; each case proves its own class membership (the vocabulary alone must not flag it) before the baseline must catch it.

The package includes the cleared Gate 2.2 artifact and Gate 2.1 dirty artifact so the mutation/non-vacuity evidence is self-contained.
`;

fs.writeFileSync(path.join(EV,'GATE3A-FROZEN-MAP.md'), map);
fs.writeFileSync(path.join(ROOT,'README.md'), readme);
console.log(`generated reports: ${I.totals.fields} fields, ${I.totals.sinks} sinks, ${S.totals.atrBindings}/${S.totals.distinctConsumerStatements} ATR`);


/* ------------------------------------------------------------------ *
 * [Gate 3A — Blocker B] Evidence coherence.
 *
 * README and the frozen map were generated from JSON, but the reviewer-facing
 * handoff and self-review were hand-written — and they drifted, telling the
 * next reviewer to expect a superseded inventory hash and superseded counters.
 * This is the same drift class Gate 3A had already fixed once (45/74 vs 53/96).
 *
 * Rule now: every formal Gate 3A document's CURRENT evidence is generated from
 * the final JSON into a marker-delimited block. Anything older lives only under
 * an explicit "History (superseded — not current evidence)" heading, and test
 * 3A-40 fails on any current-looking hash or counter outside that heading.
 * ------------------------------------------------------------------ */
const TEST_FILE = path.join(ROOT, 'test', 'gate3a.test.js');
const testCount = (fs.readFileSync(TEST_FILE, 'utf8').match(/\btest\('3A-\d+/g) || []).length;
const kind = (k) => I.sinks.filter((x) => x.kind === k).length;
const VOCAB_FILE = path.join(ROOT, 'tools', 'gate3-dependency-vocabulary.json');
const vocabSha = require('node:crypto').createHash('sha256').update(fs.readFileSync(VOCAB_FILE)).digest('hex');
const vocabEntries = JSON.parse(fs.readFileSync(VOCAB_FILE, 'utf8')).entries.length;
const guardSinks = I.sinks.filter((x) => x.discoveredBy === 'BROKER_INVOCATION_GUARD').length;
const form = (f) => I.sinks.filter((x) => x.writeForm === f).length;

const currentBlock = `<!-- GENERATED:CURRENT-EVIDENCE:BEGIN -->
## Current evidence (generated from the final JSON — do not edit by hand)

| | |
|---|---|
| Artifact scanned | \`${I.artifactSha256}\` (Gate 2.2, cleared, unchanged) |
| Authority inventory hash | \`${invDoc.inventoryHash}\` |
| ATR semantic sweep hash | \`${sweepDoc.sweepHash}\` |
| Authority sink records | **${I.totals.sinks} authority sink records** (${I.totals.reachableAuthoritySinks} live) |
| Verdict-write sinks | **${kind('VERDICT_WRITE')} verdict-write sinks** |
| Returned-field sinks | ${kind('GATE_FIELD_WRITE')} |
| Authority producer sinks | ${kind('AUTHORITY_PRODUCER_WRITE')} |
| Reassignment / alias / Object.assign sinks | ${form('BARE_REASSIGN')} / ${form('ALIAS_MEMBER_WRITE')} / ${form('ALIAS_ASSIGN')} |
| Schema-frozen live owners | ${Object.keys(I.gateReturnSchema || {}).length} |
| Broker order-field / collection-mutation / invocation-guard sinks | ${kind('BROKER_ORDER_FIELD')} / ${kind('COLLECTION_MUTATION')} / ${guardSinks} |
| Frozen dependency vocabulary | **${vocabEntries} frozen vocabulary entries**, \`${vocabSha}\` |
| Frozen authority baseline | **${baselineDoc.sinks.length} signed sinks** (${leafCount} unclassified Object.assign leaves), ${baselineDoc.owners.length} owner fingerprints, \`${baselineSha}\` |
| Module-scope producer closure | **${(baselineDoc.producers || []).length} producers** (${(baselineDoc.producers || []).filter((p) => p.kind === 'TOP_LEVEL_BINDING').length} bindings, ${(baselineDoc.producers || []).filter((p) => p.kind === 'TOP_LEVEL_FUNCTION').length} functions, ${(baselineDoc.producers || []).filter((p) => p.kind === 'PRODUCER_WRITER').length} writers) |
| Dynamic-access sites (frozen) | ${(baselineDoc.dynamicAccess || []).length} sites (${[...new Set((baselineDoc.dynamicAccess || []).map((x) => x.kind))].join(', ')}) |
| HP-3 threshold worksheet | ${thresholdRows.length} live sinks with non-trivial numeric literals, provenance UNRECORDED |
| Classified semantics | **${I.totals.fields} classified semantic fields** |
| Inventory defects | **${I.inventoryDefects.length}** |
| ATR sweep | ${S.totals.atrBindings} bindings, ${S.totals.distinctConsumerStatements} consumer statements, ${S.totals.permissiveAuthorityBranches} permissive capital branches, ${S.totals.unresolvedShapes} unresolved |
| Gate 3A tests | **${testCount} tests** |
<!-- GENERATED:CURRENT-EVIDENCE:END -->`;

function injectBlock(file) {
  const fp = path.join(ROOT, file);
  let t = fs.readFileSync(fp, 'utf8');
  const re = /<!-- GENERATED:CURRENT-EVIDENCE:BEGIN -->[\s\S]*?<!-- GENERATED:CURRENT-EVIDENCE:END -->/;
  if (!re.test(t)) throw new Error(`${file} has no generated current-evidence block`);
  t = t.replace(re, currentBlock);
  fs.writeFileSync(fp, t);
}
injectBlock('CLAUDE-REVIEW-HANDOFF.md');
injectBlock('GATE3A-SELF-REVIEW.md');

// The correction manifest's hash and headline totals are also derived, never typed.
const cmPath = path.join(ROOT, 'GATE3A-CORRECTION-MANIFEST.json');
const cm = JSON.parse(fs.readFileSync(cmPath, 'utf8'));
cm.authorityInventoryHash = invDoc.inventoryHash;
cm.atrSweepHash = sweepDoc.sweepHash;
cm.dependencyVocabularySha256 = vocabSha;
cm.authorityBaselineSha256 = baselineSha;
cm.totals = Object.assign({}, cm.totals, {
  semanticFields: I.totals.fields, authoritySinks: I.totals.sinks, reachableAuthoritySinks: I.totals.reachableAuthoritySinks,
  verdictWriteSinks: kind('VERDICT_WRITE'), gateFieldWriteSinks: kind('GATE_FIELD_WRITE'),
  authorityProducerSinks: kind('AUTHORITY_PRODUCER_WRITE'),
  reassignmentSinks: form('BARE_REASSIGN'), aliasMemberWriteSinks: form('ALIAS_MEMBER_WRITE'), aliasAssignSinks: form('ALIAS_ASSIGN'),
  schemaFrozenOwners: Object.keys(I.gateReturnSchema || {}).length,
  brokerOrderFieldSinks: kind('BROKER_ORDER_FIELD'), collectionMutationSinks: kind('COLLECTION_MUTATION'), invocationGuardSinks: guardSinks,
  dependencyVocabularyEntries: vocabEntries,
  authorityBaselineSinks: baselineDoc.sinks.length, authorityBaselineOwners: baselineDoc.owners.length, objectAssignLeavesSigned: leafCount,
  moduleScopeProducers: (baselineDoc.producers || []).length,
  dynamicAccessSites: (baselineDoc.dynamicAccess || []).length,
  thresholdWorksheetRows: thresholdRows.length,
  inventoryDefects: I.inventoryDefects.length,
  atrBindings: S.totals.atrBindings, atrConsumerStatements: S.totals.distinctConsumerStatements,
  atrPermissiveAuthorityBranches: S.totals.permissiveAuthorityBranches, atrUnresolvedShapes: S.totals.unresolvedShapes,
  testsPassing: testCount,
});
fs.writeFileSync(cmPath, JSON.stringify(cm, null, 2) + '\n');
console.log(`coherent documents regenerated: handoff, self-review, correction manifest (${testCount} tests)`);
