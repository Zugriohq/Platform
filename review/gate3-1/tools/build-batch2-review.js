'use strict';
/**
 * Gate 3.1 — batch 2 review (PROVISIONAL, non-governing).
 *
 *   node tools/build-batch2-review.js
 *
 * Batch 2 is every consumer-map field that batch 1 did not cover. Joins the
 * consumer map (evidence) with the authored BATCH-2-DECISIONS.json and writes
 * BATCH-2-REVIEW.{json,md}. Decides nothing. Fails (exit 1) unless:
 *   - batch 1 and batch 2 together cover the consumer map exactly, with no overlap;
 *   - none of the batch-2 fields has a threshold literal in a live consumer
 *     (those belong to batch 1);
 *   - every decision uses the §14A vocabulary and records HP-1 with a basis;
 *   - every threshold read by reference is recorded with provenance UNKNOWN
 *     unless it cites a repository document by sha256 (none does today).
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(DIR, 'CONSUMER-MAP.provisional.json'), 'utf8'));
const batch1 = JSON.parse(fs.readFileSync(path.join(DIR, 'BATCH-1-WORKSHEET.json'), 'utf8'));
const decisions = JSON.parse(fs.readFileSync(path.join(DIR, 'BATCH-2-DECISIONS.json'), 'utf8'));

const CLASSES = ['HARD_STRUCTURAL_PREDICATE', 'RAW_MODEL_FEATURE', 'RESEARCH_HEURISTIC', 'LEGACY_REMOVE'];
const HP = ['PASS', 'FAIL', 'NOT_ESTABLISHED', 'PRESUMED_PASS_HP4', 'NOT_APPLICABLE'];

const errors = [];
const fail = (m) => errors.push(m);

const in1 = new Set(batch1.fields.map((f) => f.field));
const batch = map.fields.filter((f) => !in1.has(f.field));
const names = new Set(batch.map((f) => f.field));

for (const f of batch) {
  const d = decisions.fields[f.field];
  if (!d) { fail(f.field + ': no decision'); continue; }
  if (f.thresholdsInConsumers.length) fail(f.field + ': has threshold literals in live consumers; it belongs in batch 1');
  const cls = d.classification && d.classification.value;
  if (!cls || !CLASSES.some((c) => cls === c || cls.startsWith(c + ' '))) fail(f.field + ': classification ' + JSON.stringify(cls) + ' is not a §14A class');
  if (!['CONFIRM', 'AMEND'].includes(d.classification && d.classification.decision)) fail(f.field + ': classification decision must be CONFIRM or AMEND');
  if (d.classification.decision === 'AMEND' && !d.classification.scope) fail(f.field + ': an AMEND needs a scope explaining it');
  if (d.classification.decision === 'CONFIRM' && cls !== f.provisionalClassification) fail(f.field + ': CONFIRM but value differs from the catalogue (' + f.provisionalClassification + ')');
  for (const hp of ['hp1', 'hp2']) {
    if (!d[hp]) { if (hp === 'hp1') fail(f.field + ': HP-1 missing'); continue; }
    if (!HP.includes(d[hp].verdict)) fail(f.field + ': ' + hp + ' verdict not in vocabulary');
    if (!d[hp].basis) fail(f.field + ': ' + hp + ' has no basis');
  }
  if (!d.destination14B) fail(f.field + ': no §14B destination recorded');
  for (const t of d.thresholdsByReference || []) {
    if (t.provenance !== 'UNKNOWN' && !(t.source && t.source.path && /^[0-9a-f]{64}$/.test(t.source.sha256 || ''))) fail(f.field + ': threshold "' + t.item + '" has provenance without a cited source');
  }
}
for (const name of Object.keys(decisions.fields)) if (!names.has(name)) fail(name + ': decided but not a batch-2 field');
if (in1.size + names.size !== map.fields.length) fail('batch 1 (' + in1.size + ') + batch 2 (' + names.size + ') != consumer map (' + map.fields.length + ')');

if (errors.length) {
  console.error('BATCH-2 review is inconsistent:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const count = (xs) => xs.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
const totals = {
  fields: names.size,
  coverageWithBatch1: in1.size + names.size + ' / ' + map.fields.length,
  classifications: count(batch.map((f) => decisions.fields[f.field].classification.value.split(' ')[0])),
  amended: batch.filter((f) => decisions.fields[f.field].classification.decision === 'AMEND').length,
  hp1: count(batch.map((f) => decisions.fields[f.field].hp1.verdict)),
  thresholdsByReference: batch.reduce((n, f) => n + (decisions.fields[f.field].thresholdsByReference || []).length, 0),
};

const out = {
  schema: 'zugrio.gate3-1-batch2-review/provisional-1',
  status: decisions.status, review: decisions.review, scope: decisions.scope, rules: decisions.rules, source: map.source, totals,
  fields: batch.map((f) => ({
    field: f.field,
    catalogue: { classification: f.provisionalClassification, admission: f.predicateAdmission, semanticMeaning: f.semanticMeaning, destination: f.intendedDestination, liveConsumers: f.liveConsumers, consumerCategories: f.consumerCategories },
    decision: decisions.fields[f.field],
  })),
  summary: decisions.summary,
};
fs.writeFileSync(path.join(DIR, 'BATCH-2-REVIEW.json'), JSON.stringify(out, null, 1) + '\n');

const esc = (s) => String(s).replace(/\|/g, '\\|');
const md = [];
md.push('# Gate 3.1 — batch 2 review (PROVISIONAL)', '');
md.push('> **PROVISIONAL / NOT GOVERNING.** First-pass decisions by ' + decisions.review.preparedBy + ', ' + decisions.review.date + '. Independent review: **' + decisions.review.independentReview + '**. Owner sign-off: **' + decisions.review.ownerSignOff + '**. This review admits nothing. Gate 3.2 and Gate 3.3 have not started. Gate 4 is not authorised.', '');
md.push('Generated by `node tools/build-batch2-review.js` from `CONSUMER-MAP.provisional.json` (evidence) and `BATCH-2-DECISIONS.json` (authored decisions).', '');
md.push('## Rules applied', '', ...decisions.rules.map((r) => '- ' + r), '');
md.push('## Result', '');
md.push('Coverage with batch 1: **' + totals.coverageWithBatch1 + '** consumer-map fields.', '');
md.push('| Field | Catalogue | Classification (§14A) | HP-1 | §14B destination |', '|---|---|---|---|---|');
for (const f of batch) {
  const d = decisions.fields[f.field];
  md.push('| `' + f.field + '` | ' + f.provisionalClassification + ' / ' + f.predicateAdmission + ' | ' + d.classification.decision + ': ' + esc(d.classification.value) + ' | ' + d.hp1.verdict + ' | ' + esc(d.destination14B) + ' |');
}
md.push('');
md.push('- Classifications: ' + Object.entries(totals.classifications).map(([k, v]) => k + ' ' + v).join(', ') + '. Amended: ' + totals.amended + '.');
md.push('- Amendments: ' + decisions.summary.amended.join('; ') + '.');
md.push('- Gate-4 fields (classified here; their replacement is Gate 4 work): ' + decisions.summary.gate4Fields.map((x) => '`' + x + '`').join(', ') + '.');
md.push('- Admitted by this review: **none**.');
md.push('- ' + decisions.summary.note, '');
for (const f of batch) {
  const d = decisions.fields[f.field];
  md.push('## `' + f.field + '`', '');
  md.push('- **Meaning (catalogue):** ' + f.semanticMeaning);
  md.push('- **Catalogue:** ' + f.provisionalClassification + ' / ' + f.predicateAdmission + '. ' + f.intendedDestination + ' Live consumers: ' + f.liveConsumers + '.');
  md.push('- **Classification (§14A):** ' + d.classification.decision + ': ' + d.classification.value + (d.classification.scope ? '. ' + d.classification.scope : ''));
  md.push('- **HP-1:** ' + d.hp1.verdict + '. ' + d.hp1.basis);
  if (d.hp2) md.push('- **HP-2:** ' + d.hp2.verdict + '. ' + d.hp2.basis);
  md.push('- **§14B destination:** ' + d.destination14B);
  for (const t of d.thresholdsByReference || []) md.push('- **Threshold by reference:** ' + t.item + ', provenance ' + t.provenance + '.');
  if (d.cbot) md.push('- **cBot (ADR-0008):** ' + d.cbot);
  for (const q of d.openQuestions || []) md.push('- **Open question:** ' + q);
  md.push('');
}
fs.writeFileSync(path.join(DIR, 'BATCH-2-REVIEW.md'), md.join('\n') + '\n');
console.log('BATCH-2 review: ' + names.size + ' fields; with batch 1 ' + totals.coverageWithBatch1 + ' consumer-map fields; consistent.');
