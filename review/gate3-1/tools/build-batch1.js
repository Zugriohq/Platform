'use strict';
/**
 * Gate 3.1 — review batch 1 worksheet (PROVISIONAL, non-governing).
 *
 *   node tools/build-batch1.js
 *
 * Batch 1, as the independent reviewer scoped it: the candidate hard
 * predicates (catalogue class HARD_STRUCTURAL_PREDICATE) and every field
 * whose live consumers carry numeric thresholds. For each field it gathers
 * the evidence a reviewer needs to decide §14A classification and the §14C
 * HP-1/HP-2/HP-3 questions: consumers, every threshold literal in context,
 * source comments next to it (provenance CLUES, not provenance), mechanical
 * flags, and the frozen-specification clauses that name the field.
 *
 * It decides nothing. Every decision field is blank. It proposes no
 * classification and asserts no threshold provenance.
 */
const fs = require('node:fs');
const path = require('node:path');

const R11 = path.join(__dirname, '..', '..', '..', 'legacy', 'gate-baselines', 'gate3a', 'round11');
const S = require(path.join(R11, 'tools', 'gate3-authority-inventory.js'));
const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CONSUMER-MAP.provisional.json'), 'utf8'));
const code = S.inlineScripts(fs.readFileSync(path.join(R11, 'artifacts', 'Zugrio-1.0.0-gate2.2.html'), 'utf8')).join('\n');
const index = S.functionIndex(code);

// Frozen specification clauses (Zugrio Signal Authority Architecture v1.0.2,
// docs/architecture/frozen/…_FROZEN.md on release/private-validation-alpha-2026-09-28),
// quoted verbatim.
const SPEC = {
  'HP-1': '§14C HP-1 "Its failure must mean structural invalidity, data invalidity, execution infeasibility or safety violation independently of profitability."',
  'HP-2': '§14C HP-2 "Its threshold must not have been chosen by optimizing outcomes. If historical P/L, win rate or expectancy set the value, it belongs downstream."',
  'HP-3': '§14C HP-3 "Every predicate records threshold provenance in predicateClassifications."',
  'HP-4': '§14C HP-4 "Presumed to pass: DATA_HEALTH_OK, GEOMETRY_COMPLETE."',
  'HP-5': '§14C HP-5 "Presumed model features until proven otherwise: REGIME_QUALITY_OK, HTF_GRADE_NOT_C, REWARD_GRADE_NOT_C, TRIGGER_GRADE_NOT_C."',
  'HP-6': '§14C HP-6 "Failing HP-1 or HP-2 moves the field downstream. No partial credit."',
  'S13': '§13 ATR: "W is accepted only against … a decision-flip sensitivity test at every ATR-denominated threshold (1.10 range, 0.08 penetration, 0.80 extension, 0.15 stop buffer, 0.35 minimum stop)." Below W "every ATR-denominated decision fails closed."',
  'UNSET': 'Preamble: "[UNSET] marks values that must still be measured and validated before capital authority."',
  'S14B': '§14B "pWin and EV are the only continuous quantities permitted to gate state. … Ambiguity resolves toward the feature vector, never toward state authority."',
};
// Fields the specification names directly, or whose catalogue text maps them to a named grade.
const SPEC_NAMES = { DATA_HEALTH_OK: ['HP-4'], GEOMETRY_COMPLETE: ['HP-4'] };
const HP5_HINT = /REGIME_QUALITY_OK|HTF_GRADE_NOT_C|REWARD_GRADE_NOT_C|TRIGGER_GRADE_NOT_C/;
const S13_LITERALS = new Set(['1.10', '1.1', '0.08', '.08', '0.80', '.8', '0.8', '0.15', '.15', '0.35', '.35']);

const norm = (x) => x.replace(/\s+/g, '');
function locate(owner, expression) {
  const target = norm(expression);
  for (const f of index.filter((x) => x.name === owner)) {
    const body = code.slice(f.start, f.end + 1);
    // map positions in the whitespace-stripped body back to raw offsets
    const map2 = []; let stripped = '';
    for (let i = 0; i < body.length; i++) if (!/\s/.test(body[i])) { map2.push(i); stripped += body[i]; }
    const k = stripped.indexOf(target.slice(0, Math.min(80, target.length)));
    if (k >= 0) return f.start + map2[k];
  }
  return -1;
}
function commentsNear(pos) {
  if (pos < 0) return [];
  const lineStart = code.lastIndexOf('\n', pos);
  const before = code.slice(Math.max(0, lineStart - 700), lineStart).split('\n').slice(-6);
  const lineEnd = code.indexOf('\n', pos);
  const line = code.slice(lineStart + 1, lineEnd < 0 ? code.length : lineEnd);
  const out = [];
  for (const l of [...before, line]) {
    for (const m of l.matchAll(/\/\/(.*)$|\/\*([\s\S]*?)\*\//g)) {
      const t = (m[1] || m[2] || '').trim();
      if (t && t.length > 3) out.push(t.slice(0, 220));
    }
  }
  return [...new Set(out)];
}
function flags(expression, literals) {
  const f = [];
  if (/\b(?:atr|ATR|av|avM15|atrAtBirth|refAtr|stopATR|maxStopATR)\b/.test(expression) || /ATR/.test(expression)) f.push('ATR_DENOMINATED');
  if (literals.some((l) => S13_LITERALS.has(l)) && f.includes('ATR_DENOMINATED')) f.push('NAMED_IN_§13');
  if (/\b(?:rr\d?|RR|grossR|netR|costR|t1RR|tp1RR|score|pWin|EV|ev|evNet|winRate|expectancy|reward|readyMinTP1R|fireMinNetTP1R|minGrossR|minNetR|maxCostR)\b/.test(expression)) f.push('PNL_OR_SCORE_SHAPED (HP-2 risk)');
  if (/\b(?:now|At|age|triggerAt|knownAt|tickAt|SECONDS|ms|Ms|cooldown|maxAgeSec)\b|\/1000|86400|60000|15000/.test(expression)) f.push('TIME_WINDOW');
  // capital risk / sizing (not `risk`, which in plan() is the stop distance)
  if (/\b(?:riskScale|scale|riskPct|riskPerTradePct|perEventRiskPct|riskFraction|maxOpenRiskPct|dailyLossLimitPct|drawdownLimitPct)\b/.test(expression)) f.push('RISK_OR_SIZING');
  if (literals.length && literals.every((l) => /^1e-\d+$/i.test(l))) f.push('NUMERIC_EPSILON (tolerance, likely not a threshold)');
  return f;
}
// a threshold read from a module table: that table's own declared status and the
// comment above its declaration (clues toward provenance, not provenance)
function tableClues(expression) {
  const out = [];
  for (const name of new Set(expression.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || [])) {
    const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`).exec(code);
    if (!m) continue;
    const head = code.slice(m.index, m.index + 600);
    const status = (/\bstatus\s*:\s*'([^']+)'/.exec(head) || [])[1];
    const above = code.slice(Math.max(0, m.index - 400), m.index).split('\n').slice(-3).map((l) => (/\/\/(.*)$/.exec(l) || [])[1]).filter(Boolean).map((x) => x.trim());
    if (status || above.length) out.push(`${name}${status ? ` declares status '${status}'` : ''}${above.length ? ` — comment: ${above.join(' ').slice(0, 160)}` : ''}`);
  }
  return out;
}

const hp = map.fields.filter((f) => f.provisionalClassification === 'HARD_STRUCTURAL_PREDICATE').map((f) => f.field);
const th = map.fields.filter((f) => f.thresholdsInConsumers.length).map((f) => f.field);
const batch = [...new Set([...hp, ...th])];
const fields = map.fields.filter((f) => batch.includes(f.field)).map((f) => {
  const specRefs = [...(SPEC_NAMES[f.field] || [])];
  if (HP5_HINT.test(`${f.semanticMeaning} ${f.intendedDestination} ${f.thresholdSource}`)) specRefs.push('HP-5');
  const thresholds = f.thresholdsInConsumers.map((t) => {
    const pos = locate(t.owner, t.expression);
    return { owner: t.owner, literals: t.literals, expression: t.expression, flags: flags(t.expression, t.literals), sourceComments: commentsNear(pos), tableClues: tableClues(t.expression), located: pos >= 0, provenance: 'UNRECORDED' };
  });
  const isHP = f.provisionalClassification === 'HARD_STRUCTURAL_PREDICATE';
  return {
    field: f.field, inBatchBecause: [isHP ? 'CANDIDATE_HARD_PREDICATE' : null, thresholds.length ? 'THRESHOLDS_IN_LIVE_CONSUMERS' : null].filter(Boolean),
    semanticMeaning: f.semanticMeaning, semanticFamily: f.semanticFamily,
    provisionalClassification: f.provisionalClassification, predicateAdmission: f.predicateAdmission,
    catalogueThresholdSource: f.thresholdSource, intendedDestination: f.intendedDestination,
    liveConsumers: f.liveConsumers, consumerCategories: f.consumerCategories,
    specClauses: specRefs, thresholds,
    decisions: {
      classification: null,
      ...(isHP ? { 'HP-1': null, 'HP-2': null } : {}),
      thresholdProvenance: thresholds.map((t) => ({ owner: t.owner, literals: t.literals, provenance: null })),
      reviewer: null, date: null,
    },
  };
});

const out = {
  schema: 'zugrio.gate3-1-batch1/provisional-1',
  status: 'PROVISIONAL — NOT GOVERNING. Evidence for §14A/§14C review. No decision recorded; no classification proposed; no provenance asserted.',
  source: map.source,
  spec: SPEC,
  totals: {
    fields: fields.length,
    candidateHardPredicates: fields.filter((f) => f.inBatchBecause.includes('CANDIDATE_HARD_PREDICATE')).length,
    thresholdBearing: fields.filter((f) => f.inBatchBecause.includes('THRESHOLDS_IN_LIVE_CONSUMERS')).length,
    thresholdSites: fields.reduce((n, f) => n + f.thresholds.length, 0),
    literals: fields.reduce((n, f) => n + f.thresholds.reduce((a, t) => a + t.literals.length, 0), 0),
    pnlShapedSites: fields.reduce((n, f) => n + f.thresholds.filter((t) => t.flags.some((x) => x.startsWith('PNL'))).length, 0),
    sitesWithSourceComments: fields.reduce((n, f) => n + f.thresholds.filter((t) => t.sourceComments.length || t.tableClues.length).length, 0),
    numericEpsilonSites: fields.reduce((n, f) => n + f.thresholds.filter((t) => t.flags.some((x) => x.startsWith('NUMERIC_EPSILON'))).length, 0),
  },
  fields,
};
fs.writeFileSync(path.join(__dirname, '..', 'BATCH-1-WORKSHEET.json'), JSON.stringify(out, null, 1) + '\n');

const md = [];
md.push('# Gate 3.1 — review batch 1 (PROVISIONAL)', '');
md.push('> **PROVISIONAL / NOT GOVERNING.** This is evidence for §14A classification and the §14C hard-predicate tests. **It records no decision, proposes no classification and asserts no threshold provenance.** Each decision is left blank for the reviewer. Source comments are *clues* toward provenance, to be confirmed against a document, not provenance in themselves. Regenerate with `node tools/build-batch1.js`.', '');
md.push('## Scope', '');
md.push(`${out.totals.fields} fields: ${out.totals.candidateHardPredicates} candidate hard predicates and ${out.totals.thresholdBearing} fields with numeric thresholds in live consumers (the two sets overlap).`);
md.push('');
md.push(`They carry ${out.totals.thresholdSites} threshold sites and ${out.totals.literals} literals:`);
md.push(`- ${out.totals.pnlShapedSites} sites sit in a P/L-, R:R- or score-shaped expression, which is an HP-2 risk;`);
md.push(`- ${out.totals.sitesWithSourceComments} sites have a source comment or table status nearby;`);
md.push(`- ${out.totals.numericEpsilonSites} sites are numerical tolerances such as \`1e-12\`, which are probably not thresholds and are left for the reviewer to confirm.`);
md.push('');
md.push('## The questions per field', '');
md.push(`1. **Classification (§14A):** HARD_STRUCTURAL_PREDICATE, RAW_MODEL_FEATURE, RESEARCH_HEURISTIC or LEGACY_REMOVE. ${SPEC.S14B}`);
md.push(`2. **Hard predicates only:** ${SPEC['HP-1']} ${SPEC['HP-2']}`);
md.push(`3. **Every threshold:** ${SPEC['HP-3']} An unknown provenance stays unknown. ${SPEC['HP-6']}`);
md.push('');
md.push(`Clauses that apply across the batch: ${SPEC['HP-4']} ${SPEC['HP-5']} ${SPEC.S13} ${SPEC.UNSET}`, '');
for (const f of fields) {
  md.push(`## \`${f.field}\``, '');
  md.push(`*In batch because: ${f.inBatchBecause.join(', ').toLowerCase().replace(/_/g, ' ')}.*`, '');
  md.push(`- **Meaning:** ${f.semanticMeaning}`);
  md.push(`- **Provisional (scanner catalogue):** ${f.provisionalClassification} / ${f.predicateAdmission}. **Catalogue threshold source:** ${f.catalogueThresholdSource}`);
  md.push(`- **Intended destination:** ${f.intendedDestination}`);
  md.push(`- **Live consumers:** ${f.liveConsumers}, in these categories: ${Object.keys(f.consumerCategories).map((k) => k.toLowerCase().replace(/_/g, ' ')).join('; ') || 'none'}`);
  if (f.specClauses.length) md.push(`- **Specification:** ${f.specClauses.map((k) => SPEC[k]).join(' ')}`);
  if (f.thresholds.length) {
    md.push('', '| Owner | Literals | Expression | Flags | Source comment (clue only) |', '|---|---|---|---|---|');
    for (const t of f.thresholds) md.push(`| \`${t.owner}\` | ${t.literals.join(', ')} | \`${t.expression.replace(/\|/g, '\\|').slice(0, 110)}${t.expression.length > 110 ? '…' : ''}\` | ${t.flags.join('; ') || '—'} | ${([...t.tableClues, ...t.sourceComments][0] || '—').replace(/\|/g, '\\|').slice(0, 160)} |`);
  }
  md.push('', '**Decision (reviewer):**');
  md.push('- Classification: ______');
  if (f.decisions['HP-1'] !== undefined) md.push('- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______', '- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______');
  if (f.thresholds.length) md.push('- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN; per HP-6, UNKNOWN moves the field downstream)');
  md.push('');
}
fs.writeFileSync(path.join(__dirname, '..', 'BATCH-1-WORKSHEET.md'), md.join('\n') + '\n');
console.log(`batch 1: ${out.totals.fields} fields, ${out.totals.thresholdSites} threshold sites, ${out.totals.literals} literals; ${out.totals.pnlShapedSites} P/L-shaped; ${out.totals.sitesWithSourceComments} with comments; located ${fields.reduce((n, f) => n + f.thresholds.filter((t) => t.located).length, 0)}`);
