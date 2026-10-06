'use strict';
/**
 * Gate 3.1 (§14A) consumer map — PROVISIONAL draft generator.
 *
 *   node tools/build-consumer-map.js
 *
 * Built only from the Gate 3A round-11 evidence (not yet cleared). It
 * restructures that inventory into the shape §14A asks for: every consumer of
 * every classified semantic field, grouped by consumer category, with the
 * thresholds those consumers carry. It asserts NO classification: each row's
 * classification is the scanner catalogue's provisional one, and every §14C
 * judgement (HP-1, HP-2, HP-3) is recorded as PENDING for human sign-off.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = path.join(__dirname, '..', '..', 'gate3a', 'round11');
const invDoc = JSON.parse(fs.readFileSync(path.join(SRC, 'evidence', 'GATE3-AUTHORITY-INVENTORY.json'), 'utf8'));
const worksheet = JSON.parse(fs.readFileSync(path.join(SRC, 'evidence', 'GATE3A-THRESHOLD-WORKSHEET.json'), 'utf8'));
const I = invDoc.inventory;

// §14A consumer categories. The mapping from (owner, sink kind) is a heuristic
// for review, not a classification.
const EXEC = /^(route|makeIntent|routeConfirmedReversal|closePosition|enqueueBrokerAction)$/;
const PLAN = /^(plan|planTradeLevels|computeTargets|computeZoneTolerance|planSetupZone|validateFireGeometry)$/;
function category(c) {
  if (/^BROKER_|LEGACY_PERMISSION_ASSERTION/.test(c.kind) || EXEC.test(c.owner)) return 'BROKER_OR_EXECUTION_GATE';
  if (c.kind === 'SCORE_WRITE') return 'OPPORTUNITY_SCORE';
  if (c.kind === 'SELECTION' || c.kind === 'FILTER') return 'SELECTION_AND_WATCHLIST_ORDERING';
  if (c.kind === 'PLAN_VERDICT_WRITE' || PLAN.test(c.owner)) return 'ENTRY_GRADING_AND_TRADE_PLAN';
  if (c.kind === 'AUTHORITY_PRODUCER_WRITE') return 'PRODUCER_OF_THE_ABOVE';
  return 'FIRE_AND_STATE_PROGRESSION';
}
const thresholdsFor = (consumers) => {
  const keys = new Set(consumers.map((c) => `${c.owner}\u0000${c.kind}\u0000${c.expression}`));
  return worksheet.entries.filter((e) => keys.has(`${e.owner}\u0000${e.kind}\u0000${e.expression}`)).map((e) => ({ owner: e.owner, expression: e.expression.slice(0, 160), literals: e.literals, thresholdProvenance: e.thresholdProvenance }));
};

const rows = I.fields.map((f) => {
  const live = f.consumers.filter((c) => c.reachability === 'REACHABLE_AUTHORITY');
  const byCat = {};
  for (const c of live) (byCat[category(c)] = byCat[category(c)] || new Set()).add(`${c.owner}:${c.kind}`);
  const thresholds = thresholdsFor(live);
  return {
    field: f.field,
    semanticMeaning: f.semanticMeaning,
    semanticFamily: f.semanticFamily,
    provisionalClassification: f.gate3Classification,
    predicateAdmission: f.predicateAdmission,
    thresholdSource: f.thresholdSource,
    intendedDestination: f.intendedDestination,
    migrationDisposition: f.migrationDisposition,
    liveConsumers: live.length,
    unreachableConsumers: f.consumers.length - live.length,
    consumerCategories: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, [...v].sort()])),
    thresholdsInConsumers: thresholds,
    signOff: {
      classification: 'PENDING',
      'HP-1 failure means structural/data/execution/safety invalidity independent of profitability': f.gate3Classification === 'HARD_STRUCTURAL_PREDICATE' ? 'PENDING' : 'NOT_APPLICABLE',
      'HP-2 threshold not chosen by optimising outcomes': f.gate3Classification === 'HARD_STRUCTURAL_PREDICATE' ? 'PENDING' : 'NOT_APPLICABLE',
      'HP-3 threshold provenance recorded': thresholds.length ? 'PENDING' : 'NO_LITERAL_THRESHOLDS_IN_LIVE_CONSUMERS',
    },
  };
});

const out = {
  schema: 'zugrio.gate3-1-consumer-map/provisional-1',
  status: 'PROVISIONAL — NOT GOVERNING. Built from the Gate 3A round-11 review candidate, which is not cleared. No classification here is asserted; every §14C judgement is PENDING.',
  source: { artifactSha256: I.artifactSha256, inventoryHash: invDoc.inventoryHash, round: 'review/gate3a/round11' },
  spec: 'Zugrio Signal Authority Architecture v1.0.2 — §14A (consumer map), §14B (state-policy decomposition), §14C (hard-predicate admissibility)',
  knownGap: 'Gate 3A inventories authority sinks only. §14A also requires trade-plan presentation and research-logging consumers; those are not yet in this map.',
  totals: {
    fields: rows.length,
    byProvisionalClassification: rows.reduce((a, r) => ((a[r.provisionalClassification] = (a[r.provisionalClassification] || 0) + 1), a), {}),
    liveConsumers: rows.reduce((n, r) => n + r.liveConsumers, 0),
    fieldsWithThresholds: rows.filter((r) => r.thresholdsInConsumers.length).length,
    hardPredicatesPendingHP: rows.filter((r) => r.provisionalClassification === 'HARD_STRUCTURAL_PREDICATE').length,
  },
  fields: rows,
};
fs.writeFileSync(path.join(__dirname, '..', 'CONSUMER-MAP.provisional.json'), JSON.stringify(out, null, 1) + '\n');

const md = [];
md.push('# Gate 3.1 — §14A consumer map (PROVISIONAL)', '');
md.push('> **PROVISIONAL / NOT GOVERNING.** This is generated from the Gate 3A round-11 review candidate, which is not cleared. It asserts no classification: every row shows the scanner catalogue\'s provisional classification, and every §14C judgement is **PENDING** human sign-off. Regenerate it with `node tools/build-consumer-map.js`.', '');
md.push(`Source: artifact \`${I.artifactSha256.slice(0, 12)}…\`, inventory \`${invDoc.inventoryHash.slice(0, 12)}…\` (round 11).`, '');
md.push('## Summary', '');
md.push(`- ${out.totals.fields} semantic fields; ${out.totals.liveConsumers} live consumer records.`);
md.push(`- Provisional classification: ${Object.entries(out.totals.byProvisionalClassification).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
md.push(`- ${out.totals.hardPredicatesPendingHP} candidate hard predicates need an HP-1/HP-2 decision. ${out.totals.fieldsWithThresholds} fields have numeric thresholds in live consumers, which need HP-3 provenance.`);
md.push(`- **Known gap:** ${out.knownGap}`, '');
md.push('## What a reviewer decides per field', '');
md.push('1. Is the provisional classification right under §14A/§14B? For example, is it truly a hard structural predicate, or does it move to the feature vector?');
md.push('2. For a hard predicate: HP-1 (does failure mean invalidity independent of profitability?) and HP-2 (was the threshold set without outcome optimisation?).');
md.push('3. HP-3: record each listed threshold\'s provenance. Do not invent it; an unknown provenance stays unknown, and per HP-6 the field moves downstream.', '');
md.push('## Fields', '');
md.push('| Field | Provisional class | Admission | Live consumers | Consumer categories | Thresholds | Sign-off |');
md.push('|---|---|---|---:|---|---:|---|');
for (const r of rows) md.push(`| \`${r.field}\` | ${r.provisionalClassification} | ${r.predicateAdmission} | ${r.liveConsumers} | ${Object.keys(r.consumerCategories).map((k) => k.replace(/_/g, ' ').toLowerCase()).join('; ') || '—'} | ${r.thresholdsInConsumers.length} | PENDING |`);
md.push('', 'Each field\'s consumers, thresholds and destination are in `CONSUMER-MAP.provisional.json`.', '');
fs.writeFileSync(path.join(__dirname, '..', 'CONSUMER-MAP.provisional.md'), md.join('\n') + '\n');
console.log(`consumer map: ${rows.length} fields, ${out.totals.liveConsumers} live consumers, ${out.totals.fieldsWithThresholds} with thresholds`);
