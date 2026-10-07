'use strict';
/**
 * Gate 3.1 — batch 1 review (PROVISIONAL, non-governing).
 *
 *   node tools/build-batch1-review.js
 *
 * Joins the generated worksheet (BATCH-1-WORKSHEET.json) with the authored
 * decisions (BATCH-1-DECISIONS.json) and writes BATCH-1-REVIEW.{json,md}.
 *
 * The decisions are authored by the reviewer; this tool decides nothing. It
 * fails (exit 1) unless the decisions cover the worksheet exactly and obey
 * the review rules:
 *   - every one of the worksheet's entries maps to a decided site whose
 *     literals match the entry's literals, value for value and in order;
 *   - every decided site and every decided field is used by the worksheet;
 *   - provenance is UNKNOWN or NOT_A_THRESHOLD, unless the literal cites a
 *     source document by repository path and sha256 (none does today);
 *   - NOT_A_THRESHOLD only for unit conversions, numerical tolerances,
 *     ordinal codes and display limits; decision values are never exempt;
 *   - HP-2 PASS only for a field that owns no threshold of unknown origin;
 *   - every P/L-flagged worksheet entry has an explicit P/L disposition.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, '..');
const worksheet = JSON.parse(fs.readFileSync(path.join(DIR, 'BATCH-1-WORKSHEET.json'), 'utf8'));
const decisions = JSON.parse(fs.readFileSync(path.join(DIR, 'BATCH-1-DECISIONS.json'), 'utf8'));

const siteKey = t => t.owner + '::' + crypto.createHash('sha256').update(t.expression).digest('hex').slice(0, 12);
const ROLES = Object.keys(decisions.vocabulary.role);
const EXEMPT = new Set(['UNIT_CONVERSION', 'NUMERIC_TOLERANCE', 'ORDINAL_ENCODING', 'DISPLAY_LIMIT']);
const HP = Object.keys(decisions.vocabulary.hp);
const FIELDS = new Set(worksheet.fields.map(f => f.field));

const errors = [];
const fail = msg => errors.push(msg);

// Sites.
const usedSites = new Set();
for (const [key, site] of Object.entries(decisions.sites)) {
  if (!Array.isArray(site.literals) || !site.literals.length) fail(key + ': no literal decisions');
  for (const [i, l] of (site.literals || []).entries()) {
    const at = key + ' literal ' + i + ' (' + l.value + ')';
    if (!ROLES.includes(l.role)) fail(at + ': unknown role ' + l.role);
    if (l.belongsTo != null && !FIELDS.has(l.belongsTo)) fail(at + ': belongsTo ' + l.belongsTo + ' is not a batch-1 field');
    if (l.provenance === 'NOT_A_THRESHOLD') {
      if (!EXEMPT.has(l.role)) fail(at + ': role ' + l.role + ' cannot be NOT_A_THRESHOLD');
    } else if (l.provenance === 'UNKNOWN') {
      if (EXEMPT.has(l.role)) fail(at + ': role ' + l.role + ' should be NOT_A_THRESHOLD, not UNKNOWN');
    } else {
      const src = l.source || {};
      if (!src.path || !/^[0-9a-f]{64}$/.test(src.sha256 || '')) fail(at + ': provenance ' + JSON.stringify(l.provenance) + ' cites no source {path, sha256}');
      else if (!fs.existsSync(path.join(DIR, '..', '..', src.path))) fail(at + ': cited source ' + src.path + ' is not in the repository');
    }
  }
}

// Worksheet entries.
const entries = [];
for (const f of worksheet.fields) {
  f.thresholds.forEach((t, i) => {
    const key = siteKey(t), site = decisions.sites[key], at = f.field + '#' + i + ' ' + key;
    if (!site) { fail(at + ': no decision for this site'); return; }
    usedSites.add(key);
    const decided = site.literals.map(l => l.value);
    if (JSON.stringify(decided) !== JSON.stringify(t.literals)) fail(at + ': literals ' + JSON.stringify(t.literals) + ' do not match decided ' + JSON.stringify(decided));
    const owned = site.literals.filter(l => l.belongsTo === f.field);
    const pnlFlagged = t.flags.some(x => /PNL/.test(x));
    if (pnlFlagged && !site.literals.some(l => l.pnlReview)) fail(at + ': P/L-flagged entry has no pnlReview');
    entries.push({
      field: f.field, index: i, site: key, owner: t.owner, literals: t.literals, flags: t.flags,
      attribution: owned.length ? 'OWNS' : 'CONSUMER_ONLY',
      ownedLiterals: owned.map(l => l.value),
      literalDecisions: site.literals,
      pnlFlagged,
    });
  });
}
for (const key of Object.keys(decisions.sites)) if (!usedSites.has(key)) fail(key + ': decided site is not in the worksheet');

// Fields.
for (const name of FIELDS) {
  const d = decisions.fields[name];
  if (!d) { fail(name + ': no field decision'); continue; }
  for (const hp of ['hp1', 'hp2']) {
    if (!d[hp] || !HP.includes(d[hp].verdict)) fail(name + ': ' + hp + ' verdict missing or not in vocabulary');
    if (d[hp] && !d[hp].basis) fail(name + ': ' + hp + ' has no basis');
  }
  if (!d.classification || !d.classification.value) fail(name + ': no classification');
  const unknownOwned = Object.values(decisions.sites).flatMap(s => s.literals).filter(l => l.belongsTo === name && l.provenance === 'UNKNOWN');
  if (d.hp2 && d.hp2.verdict === 'PASS' && unknownOwned.length) fail(name + ': HP-2 PASS but the field owns ' + unknownOwned.length + ' threshold(s) of UNKNOWN provenance');
}
for (const name of Object.keys(decisions.fields)) if (!FIELDS.has(name)) fail(name + ': decided field is not in the worksheet');

if (entries.length !== worksheet.totals.thresholdSites) fail('entries ' + entries.length + ' != worksheet thresholdSites ' + worksheet.totals.thresholdSites);
const literalCount = entries.reduce((a, e) => a + e.literals.length, 0);
if (literalCount !== worksheet.totals.literals) fail('literals ' + literalCount + ' != worksheet literals ' + worksheet.totals.literals);

if (errors.length) {
  console.error('BATCH-1 review is inconsistent with the worksheet:\n  ' + errors.join('\n  '));
  process.exit(1);
}

// Totals.
const count = (xs, k) => xs.reduce((m, x) => (m[x[k]] = (m[x[k]] || 0) + 1, m), {});
const siteLiterals = Object.values(decisions.sites).flatMap(s => s.literals);
const totals = {
  worksheetEntries: entries.length,
  distinctSites: usedSites.size,
  worksheetLiterals: literalCount,
  distinctSiteLiterals: siteLiterals.length,
  entriesOwning: entries.filter(e => e.attribution === 'OWNS').length,
  entriesConsumerOnly: entries.filter(e => e.attribution === 'CONSUMER_ONLY').length,
  pnlFlaggedEntries: entries.filter(e => e.pnlFlagged).length,
  rolesBySiteLiteral: count(siteLiterals, 'role'),
  provenanceBySiteLiteral: count(siteLiterals, 'provenance'),
  hp1: count(Object.values(decisions.fields).map(d => d.hp1), 'verdict'),
  hp2: count(Object.values(decisions.fields).map(d => d.hp2), 'verdict'),
  outOfWorksheetItems: decisions.outOfWorksheet.length,
};

const out = {
  schema: 'zugrio.gate3-1-batch1-review/provisional-1',
  status: decisions.status,
  review: decisions.review,
  scope: decisions.scope,
  rules: decisions.rules,
  source: worksheet.source,
  totals,
  fields: worksheet.fields.map(f => ({
    field: f.field,
    catalogue: { classification: f.provisionalClassification, admission: f.predicateAdmission, destination: f.intendedDestination },
    decision: decisions.fields[f.field],
    entries: entries.filter(e => e.field === f.field).map(({ field, ...e }) => e),
  })),
  outOfWorksheet: decisions.outOfWorksheet,
  summary: decisions.summary,
};
fs.writeFileSync(path.join(DIR, 'BATCH-1-REVIEW.json'), JSON.stringify(out, null, 1) + '\n');

// Markdown.
const esc = s => String(s).replace(/\|/g, '\\|');
const code = s => '`' + esc(s.length > 90 ? s.slice(0, 90) + '…' : s) + '`';
const md = [];
md.push('# Gate 3.1 — batch 1 review (PROVISIONAL)', '');
md.push('> **PROVISIONAL / NOT GOVERNING.** First-pass decisions by ' + decisions.review.preparedBy + ', ' + decisions.review.date + '. Independent review: **' + decisions.review.independentReview + '**. Owner sign-off: **' + decisions.review.ownerSignOff + '**. This review admits nothing and clears nothing. Gate 3.2 and Gate 3.3 have not started. Gate 4 is not authorised.', '');
md.push('Generated by `node tools/build-batch1-review.js`. The generator joins `BATCH-1-WORKSHEET.json` (evidence) with `BATCH-1-DECISIONS.json` (authored decisions) and refuses to write unless the decisions cover the worksheet exactly.', '');
md.push('## Layering', '', decisions.scope.layering, '');
md.push('## Rules applied', '', ...decisions.rules.map(r => '- ' + r), '');
md.push('## Result', '');
md.push('| Field | Catalogue | Candidate | Classification | HP-1 | HP-2 |', '|---|---|---|---|---|---|');
for (const f of worksheet.fields) {
  const d = decisions.fields[f.field];
  md.push('| `' + f.field + '` | ' + f.provisionalClassification + ' / ' + f.predicateAdmission + ' | ' + d.candidateHardPredicate + ' | ' + d.classification.decision + ': ' + esc(d.classification.value) + ' | ' + d.hp1.verdict + ' | ' + d.hp2.verdict + ' |');
}
md.push('');
md.push('- Hard-predicate candidates confirmed: ' + decisions.summary.candidateHardPredicates.confirmed.map(x => '`' + x + '`').join(', ') + '.');
md.push('- Amended: ' + decisions.summary.candidateHardPredicates.amended.join(', ') + '. Rejected: ' + (decisions.summary.candidateHardPredicates.rejected.join(', ') || 'none') + '.');
md.push('- Ready for Gate 3.3 without threshold-provenance work: ' + decisions.summary.readyForGate33WithoutProvenanceWork.map(x => '`' + x + '`').join(', ') + '.');
md.push('- Admitted by this review: ' + (decisions.summary.admittedByThisReview.join(', ') || '**none**') + '. Thresholds with established provenance: **' + decisions.summary.thresholdProvenanceEstablished + '**.');
md.push('- ' + decisions.summary.note, '');
md.push('## Counts', '');
md.push('- ' + totals.worksheetEntries + ' worksheet entries (' + totals.worksheetLiterals + ' literals) make up ' + totals.distinctSites + ' distinct sites (' + totals.distinctSiteLiterals + ' literals).');
md.push('- ' + totals.entriesOwning + ' entries are owned by the field they are listed under, and ' + totals.entriesConsumerOnly + ' are consumer-only: the field reads or appears in the expression but owns none of its literals.');
md.push('- Literal roles: ' + Object.entries(totals.rolesBySiteLiteral).map(([k, v]) => k + ' ' + v).join(', ') + '.');
md.push('- Provenance: ' + Object.entries(totals.provenanceBySiteLiteral).map(([k, v]) => k + ' ' + v).join(', ') + '.');
md.push('- HP-1: ' + Object.entries(totals.hp1).map(([k, v]) => k + ' ' + v).join(', ') + '. HP-2: ' + Object.entries(totals.hp2).map(([k, v]) => k + ' ' + v).join(', ') + '.', '');

md.push('## The 17 P/L-flagged entries', '');
md.push('| Entry | Site | Literal | Disposition |', '|---|---|---|---|');
for (const e of entries.filter(x => x.pnlFlagged)) {
  for (const l of e.literalDecisions.filter(x => x.pnlReview)) md.push('| ' + e.field + '#' + e.index + ' | `' + e.site + '` | ' + l.value + ' | ' + esc(l.pnlReview) + ' |');
}
md.push('', 'There is one more HP-2 risk the worksheet did not flag: `plan::87c33a76fdaa` (0.15 profileBufferATR). The artifact declares its calibration route as MAE, which is a trade-outcome measurement. See STOP_GEOMETRY.', '');

for (const f of worksheet.fields) {
  const d = decisions.fields[f.field];
  md.push('## `' + f.field + '`', '');
  md.push('- **Catalogue:** ' + f.provisionalClassification + ' / ' + f.predicateAdmission + '. ' + esc(f.intendedDestination));
  md.push('- **Candidate hard predicate:** ' + d.candidateHardPredicate);
  md.push('- **Classification (§14A):** ' + d.classification.decision + ': ' + d.classification.value + (d.classification.scope ? '. ' + d.classification.scope : ''));
  md.push('- **HP-1:** ' + d.hp1.verdict + '. ' + d.hp1.basis);
  md.push('- **HP-2:** ' + d.hp2.verdict + '. ' + d.hp2.basis);
  md.push('- **Consequence:** ' + d.consequence);
  if (d.attribution) md.push('- **Attribution:** ' + d.attribution);
  for (const q of d.openQuestions || []) md.push('- **Open question:** ' + q);
  md.push('');
  const es = entries.filter(e => e.field === f.field);
  if (es.length) {
    md.push('| # | Site | Expression | Attribution | Literal decisions |', '|---|---|---|---|---|');
    for (const e of es) {
      const t = f.thresholds[e.index];
      const lits = e.literalDecisions.map(l => l.value + ' → ' + l.role + ', ' + (l.belongsTo || '—') + ', ' + l.provenance).join('<br>');
      md.push('| ' + e.index + ' | `' + e.site + '` | ' + code(t.expression) + ' | ' + e.attribution + (e.ownedLiterals.length ? ' (' + e.ownedLiterals.join(', ') + ')' : '') + ' | ' + esc(lits) + ' |');
    }
    md.push('');
  }
}

md.push('## Site notes', '');
for (const [key, s] of Object.entries(decisions.sites)) {
  const notes = [s.note, ...s.literals.map(l => l.note && (l.value + ': ' + l.note)), ...s.literals.map(l => l.declaredStatus && (l.value + ' declared status: ' + l.declaredStatus))].filter(Boolean);
  md.push('- `' + key + '`: ' + s.what + (notes.length ? ' ' + notes.join(' ') : ''));
}
md.push('');
md.push('## Outside the worksheet (input to Gate 3.3)', '');
md.push('These thresholds bear on batch-1 fields but are not worksheet literals. They are recorded so that Gate 3.3 does not treat the worksheet as a complete HP-3 inventory.', '');
md.push('| Item | Field | Why it is outside | Provenance |', '|---|---|---|---|');
for (const o of decisions.outOfWorksheet) md.push('| ' + esc(o.item) + ' | ' + esc(o.field) + ' | ' + esc(o.why) + ' | ' + o.provenance + (o.declaredStatus ? ' (declared: ' + esc(o.declaredStatus) + ')' : '') + ' |');
md.push('');
fs.writeFileSync(path.join(DIR, 'BATCH-1-REVIEW.md'), md.join('\n') + '\n');

console.log('BATCH-1 review: ' + totals.worksheetEntries + ' entries / ' + totals.distinctSites + ' sites / ' + FIELDS.size + ' fields; consistent with the worksheet.');
