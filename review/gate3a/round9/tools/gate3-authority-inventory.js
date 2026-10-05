'use strict';
/**
 * Gate 3A — sink-first authority inventory.
 *
 * The old Gate 3A scanner started from a hand-declared list of fields. That can
 * never prove completeness: a field omitted from the list is invisible to the
 * scanner. This replacement starts from authority sinks in the cleared Gate 2.2
 * artifact, discovers the dependencies that feed those sinks, assigns reachability,
 * and fails if any discovered dependency has no declared classification.
 *
 * No production code is modified by this tool.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalBytes } = require('./lib/serialize');

const DEFAULT_ARTIFACT = path.join(__dirname, '..', 'artifacts', 'Zugrio-1.0.0-gate2.2.html');
const ARTIFACT = process.argv.slice(2).find((a) => !a.startsWith('--')) || DEFAULT_ARTIFACT;
const FREEZE_VOCABULARY = process.argv.includes('--freeze-vocabulary');
const FREEZE_BASELINE = process.argv.includes('--freeze-baseline');
const EVIDENCE_PATH = path.join(__dirname, '..', 'evidence', 'GATE3-AUTHORITY-INVENTORY.json');

const CLASSIFICATIONS = [
  'HARD_STRUCTURAL_PREDICATE',
  'RAW_MODEL_FEATURE',
  'ADVISORY_FEATURE',
  'RESEARCH_HEURISTIC',
  'LEGACY_REMOVE',
];
const PREDICATE_ADMISSION = ['ADMITTED', 'CANDIDATE_UNADMITTED', 'NOT_APPLICABLE'];
const REACHABILITY = ['REACHABLE_AUTHORITY', 'UNREACHABLE_LEGACY', 'RENDERER', 'LOGGING', 'RESEARCH_ONLY'];

function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

/** Blank comments and strings while preserving byte offsets. */
/**
 * [Gate 3A freeze] Single-pass lexer for blanking non-code while preserving
 * every byte offset.
 *
 * The previous blanker recognised comments and quoted strings but not regex
 * literals, and let a quoted string run across newlines. A quote inside a regex
 * literal such as /['"]/ therefore opened a phantom "string" that could run for
 * hundreds of kilobytes. In a whole-file pass this erased 62 of 362 functions by
 * more than half, including the live roots route and updateSignalState.
 *
 * States handled in one pass, because each changes how the others are read:
 *   line comment, block comment, '...' and "..." strings (end at newline, as JS
 *   requires), template literals with nested ${...} code, and regex literals.
 * Regex-vs-division is decided from the previous significant token: after an
 * operator, open bracket, comma, colon, semicolon, or keywords such as return,
 * a slash begins a regex; after an identifier, number, ')' or ']' it divides.
 * Template ${...} interpolations are code and are KEPT, not blanked.
 */
/**
 * [Gate 3A round 7] One assignment-operator pattern for every write matcher.
 * Writes were matched as `name = expr` only, so compound (`x *= k`, `x += k`)
 * and logical (`x &&= v`, `x ||= v`, `x ??= v`) assignments were not writes at
 * all: `result.riskScale *= hidden` and `lane.state &&= ...` were invisible.
 * The lookahead keeps `==`, `===` and `=>` out.
 */
const ASSIGN_OP = '(?:\\*\\*|<<|>>>|>>|&&|\\|\\||\\?\\?|[-+*/%&|^])?=(?![=>])';

const REGEX_AFTER_KEYWORD = /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

// [Gate 3A round 7] Whole-source blanking is now needed by function indexing,
// object-literal parsing and guard discovery; memoise large inputs (a small
// most-recent cache, keyed by the source string itself) so a scan stays fast.
const _blankCache = new Map();
function blankNonCode(src) {
  if (src.length > 20000) {
    const hit = _blankCache.get(src);
    if (hit !== undefined) return hit;
    const out = blankNonCodeUncached(src);
    _blankCache.set(src, out);
    if (_blankCache.size > 6) _blankCache.delete(_blankCache.keys().next().value);
    return out;
  }
  return blankNonCodeUncached(src);
}

function blankNonCodeUncached(src, kinds = null) {
  // `kinds`, when given, receives 'C' (comment) or 'L' (string/template/regex
  // literal) for every blanked position; the blanked text itself is unchanged.
  const n = src.length;
  const out = src.split('');
  const blank = (a, b, kind = 'L') => { for (let k = a; k < b; k++) { if (kinds) kinds[k] = kind; if (src[k] !== '\n') out[k] = ' '; } };
  let i = 0;
  let lastSig = '';      // last significant non-whitespace character outside literals
  let lastWord = '';     // last identifier/keyword
  const tmpl = [];       // brace depth at which each open ${ began
  let depth = 0;

  const regexAllowed = () => {
    if (lastSig === '') return true;
    if (/[(,=:[!&|?{};+\-*%<>~^]/.test(lastSig)) return true;
    if (lastSig === 'w' && REGEX_AFTER_KEYWORD.test(lastWord)) return true;
    return false;
  };

  // scan a template literal body starting at index `start` (just after ` or after a closing } of ${})
  const scanTemplate = (start) => {
    let j = start;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { blank(j, Math.min(n, j + 2)); j += 2; continue; }
      if (c === '`') { blank(j, j + 1); return { end: j + 1, interp: false }; }
      if (c === '$' && src[j + 1] === '{') { blank(j, j + 2); return { end: j + 2, interp: true }; }
      if (kinds) kinds[j] = 'L';
      if (c !== '\n') out[j] = ' ';
      j++;
    }
    return { end: n, interp: false };
  };

  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (ch === '/' && nx === '/') { let j = i; while (j < n && src[j] !== '\n') j++; blank(i, j, 'C'); i = j; continue; }
    if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2), j = e < 0 ? n : e + 2; blank(i, j, 'C'); i = j; continue; }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === ch) { j++; break; }
        if (src[j] === '\n') break;                 // a quoted string cannot span a line
        j++;
      }
      blank(i, j); i = j; lastSig = '"'; lastWord = ''; continue;
    }
    if (ch === '`') {
      out[i] = ' '; if (kinds) kinds[i] = 'L';
      const r = scanTemplate(i + 1);
      i = r.end;
      if (r.interp) { tmpl.push(depth); depth++; lastSig = '{'; }
      else { lastSig = '"'; lastWord = ''; }
      continue;
    }
    if (ch === '/' && regexAllowed()) {
      let j = i + 1, inClass = false, ok = false;
      for (; j < n; j++) {
        const c = src[j];
        if (c === '\\') { j++; continue; }
        if (c === '\n') break;
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) { ok = true; break; }
      }
      if (ok) {
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        blank(i, j); i = j; lastSig = '"'; lastWord = ''; continue;
      }
    }
    if (ch === '{') { depth++; lastSig = '{'; i++; continue; }
    if (ch === '}') {
      depth--;
      if (tmpl.length && depth === tmpl[tmpl.length - 1]) {
        // closes a ${...} interpolation: resume the template literal
        tmpl.pop(); out[i] = ' '; if (kinds) kinds[i] = 'L';
        const r = scanTemplate(i + 1);
        i = r.end;
        if (r.interp) { tmpl.push(depth); depth++; lastSig = '{'; }
        else { lastSig = '"'; lastWord = ''; }
        continue;
      }
      lastSig = '}'; i++; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1; while (j < n && /[\w$]/.test(src[j])) j++;
      lastWord = src.slice(i, j); lastSig = 'w'; i = j; continue;
    }
    if (/[0-9]/.test(ch)) { let j = i + 1; while (j < n && /[\w.]/.test(src[j])) j++; lastSig = 'n'; lastWord = ''; i = j; continue; }
    if (!/\s/.test(ch)) { lastSig = ch; lastWord = ''; }
    i++;
  }
  return out.join('');
}


function functionIndex(rawSrc) {
  // [Gate 3A round 7] Declarations and braces are matched on code-only text.
  // Matching on raw source let a '{' or '}' inside a string, template, regex or
  // comment move a function's end, so sinks after it changed owner (and could
  // change reachability); a `function x(` inside a string became a function.
  // blankNonCode preserves every offset, so positions are unchanged.
  const src = blankNonCode(rawSrc);
  const out = [];
  const re = /(?:^|\n)\s*(?:(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:async\s+)?function\s*\(|(?:async\s*)?\([^)]*\)\s*=>))/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1] || m[2];
    // `start` keeps the round-6 convention: the newline that opens the run of
    // RAW whitespace before the declaration. On code-only text `\s*` would also
    // swallow blanked comment lines, putting `start` inside a comment whose
    // parentheses boundNames() would then read as the signature.
    const kw = m.index + (m[0].length - m[0].replace(/^\s+/, '').length);
    let j = kw; while (j > 0 && /\s/.test(rawSrc[j - 1])) j--;
    const nl = rawSrc.indexOf('\n', j);
    const start = j === 0 ? 0 : (nl >= 0 && nl < kw ? nl : kw);
    // [Gate 3A round 7] An expression-bodied arrow (`const f = (a) => a + 1;`)
    // has no braces: its body is the expression. It used to be given the body of
    // the NEXT `{` in the file, spanning up to ~9 KB of unrelated code (seven
    // such arrows on Gate 2.2, including `run` inside the broker queue).
    if (/=>$/.test(m[0])) {
      let q = m.index + m[0].length;
      while (q < src.length && /\s/.test(src[q])) q++;
      if (src[q] !== '{') {
        const e = initializerEnd(src, q);
        if (e > q) out.push({ name, start, bodyStart: q, end: e - 1, expressionBody: true });
        continue;
      }
    }
    let open = src.indexOf('{', kw), depth = 0, end = -1;
    if (open < 0) continue;
    for (let j = open; j < src.length; j++) {
      const ch = src[j];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end > start) out.push({ name, start, bodyStart: open + 1, end });
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end);
}

function ownerOf(index, pos) {
  let best = null;
  for (const f of index) if (f.start <= pos && pos <= f.end) {
    if (!best || (f.end - f.start) < (best.end - best.start)) best = f;
  }
  return best ? best.name : '<top-level>';
}

/**
 * [Gate 3A freeze] Call graph corrected.
 *
 * The previous construction scanned each function's RAW body, including the
 * bodies of named functions nested inside it. Two consequences:
 *   - a function name appearing in a comment or string literal became a call
 *     edge. checkSig, a live root, acquired an edge to liveRiskMetrics this
 *     way, so liveRiskMetrics and portfolioCorrelation were reported live
 *     although every real call to liveRiskMetrics comes from dead legacy;
 *   - an outer function inherited every call made by named functions nested in
 *     it, whether or not it ever invoked them.
 * Now calls are matched on comment/string-blanked source and attributed to the
 * innermost named function that contains them. `.name(` matching is kept on
 * purpose: it is how namespaced engine calls such as
 * TTI_PROFILE_ENGINE.analyze(...) are found, and over-inclusion errs toward
 * treating code as live, which is the safe direction for an authority map.
 */
function buildCallGraph(src, index) {
  const blanked = blankNonCode(src);
  const names = [...new Set(index.map((f) => f.name))];
  const graph = Object.fromEntries(names.map((n) => [n, new Set()]));
  const known = new Set(names);
  // innermost-owner lookup: functions sorted by start; scan with a stack
  const sorted = [...index].sort((a, b) => a.start - b.start || b.end - a.end);
  const re = /(?:\b|\.)([A-Za-z_$][\w$]*)\s*\(/g;
  const stack = [];
  let fi = 0, m;
  while ((m = re.exec(blanked))) {
    const name = m[1];
    if (!known.has(name)) continue;
    const pos = m.index;
    while (fi < sorted.length && sorted[fi].start <= pos) { stack.push(sorted[fi]); fi++; }
    while (stack.length && stack[stack.length - 1].end < pos) stack.pop();
    // innermost containing function = last on stack that still contains pos
    let owner = null;
    for (let i = stack.length - 1; i >= 0; i--) { if (stack[i].start <= pos && pos <= stack[i].end) { owner = stack[i]; break; } }
    if (!owner || owner.name === name) continue;
    graph[owner.name].add(name);
  }
  return graph;
}


/* ------------------------------------------------------------------------ *
 * [Gate 3A freeze] Entry points.
 *
 * LIVE_ROOTS is a hand-written list of engine functions. Real execution also
 * starts from code that runs at page load, from functions named in HTML or
 * template event attributes, and from functions handed to listeners and
 * timers. chooseTradeProfile — invoked only from an onclick — writes the global
 * selectedTradeProfiles that live authority reads, and was invisible: hidden
 * logic in it decided which profiles trade, undetected.
 *
 * Reachability therefore over-approximates execution: a call that is not inside
 * a NAMED function is treated as reachable, whether it sits in page-load code or
 * an anonymous callback. For an authority map that is the safe direction — more
 * is checked, nothing is hidden.
 * ------------------------------------------------------------------------ */
// Frozen from the Gate 2.2 artifact's markup (outside <script>), which is
// identical across every mutation of this frozen artifact. scanArtifact fails if
// the real markup ever differs.
const MARKUP_ENTRY_ROOTS = Object.freeze(["action", "add", "closeSettings", "closeWelcome", "downloadDiagnostics", "filterSymDrop", "manualRetry", "openSettings", "runVet", "setBPTab", "setGran", "setMM", "setSigFilter", "setView", "setWLCat", "toggleLayersPanel", "toggleSnd", "toggleSymDrop", "toggleTfMenu", "toggleTheme", "toggleWatchlist"]);

function entryRoots(src, index) {
  const blanked = blankNonCode(src);
  const names = new Set(index.map((f) => f.name));
  const roots = new Set();
  // called from code outside any named function (page load, IIFE bodies, anonymous callbacks)
  for (const m of blanked.matchAll(/(?:\b|\.)([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (names.has(m[1]) && ownerOf(index, m.index) === '<top-level>') roots.add(m[1]);
  }
  // event attributes written inside script templates (innerHTML), read from RAW source
  for (const m of src.matchAll(/on[a-z]+=\\?["']([^"'\\]{0,160})/gi)) {
    for (const c of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) if (names.has(c[1])) roots.add(c[1]);
  }
  // function references handed to listeners, timers and on* properties
  for (const m of blanked.matchAll(/(?:addEventListener\s*\(\s*[^,]+,|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|\.on[a-z]+\s*=)\s*([A-Za-z_$][\w$]*)\s*[,)\s;]/g)) {
    if (names.has(m[1])) roots.add(m[1]);
  }
  // [Gate 3A round 7] A function used as a VALUE — stored in an array or map,
  // passed to .then/.forEach/any helper, returned — may be invoked through that
  // value by a dispatch mechanism the call graph cannot see (a callback
  // registry called by index is exactly how the engine bus hid listeners). Its
  // name in value position therefore makes it a root. Over-approximation: more
  // is checked, nothing is hidden.
  for (const m of blanked.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\b(?!\s*\()/g)) {
    const name = m[1];
    if (!names.has(name)) continue;
    const before = blanked.slice(Math.max(0, m.index - 24), m.index);
    if (/\b(?:function|const|let|var|class)\s+$/.test(before)) continue;      // the declaration itself
    const after = blanked.slice(m.index + name.length, m.index + name.length + 4);
    if (/^\s*(?:[-+*/%&|^]|&&|\|\||\?\?)?=(?![=>])/.test(after)) continue;   // an assignment target
    const prev = before.trimEnd().slice(-1);
    if ((prev === '{' || prev === ',') && /^\s*:/.test(after)) continue;      // an object-literal key
    roots.add(name);
  }
  return roots;
}

function markupEntryRoots(html, names) {
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const out = new Set();
  for (const m of markup.matchAll(/\son[a-z]+\s*=\s*(['"])([\s\S]*?)\1/gi)) {
    for (const c of m[2].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) if (names.has(c[1])) out.add(c[1]);
  }
  return [...out].sort();
}

const LIVE_ROOTS = ['recomputeFull', 'recomputeLight', 'updateSignalState', 'checkSig', 'route', 'routeConfirmedReversal', 'closePosition'];
function reachableFrom(graph, roots) {
  const seen = new Set(), stack = roots.filter((r) => graph[r]);
  while (stack.length) {
    const n = stack.pop(); if (seen.has(n)) continue; seen.add(n);
    for (const c of graph[n] || []) if (!seen.has(c)) stack.push(c);
  }
  return seen;
}

const RENDERER_RE = /^(render|sync|draw|paint|chart|ui|signalCard|sigCard)/i;
const LOGGING_RE = /^(log|persist|export|record|ledger|telemetry|debug|engineDiagnostics)/i;
const RESEARCH_RE = /^(referenceContinuationBreak|referenceEntryRouteStudy|captureAPAResult|exportAPALedger|TTI_FOUNDATION_SELF_TEST)$/;
const LEGACY_RE = /^(updateLegacySignalState|checkLegacySig)$/;

function classifyReachability(owner, liveReachable) {
  if (RENDERER_RE.test(owner)) return 'RENDERER';
  if (LOGGING_RE.test(owner)) return 'LOGGING';
  if (RESEARCH_RE.test(owner)) return 'RESEARCH_ONLY';
  if (LEGACY_RE.test(owner)) return 'UNREACHABLE_LEGACY';
  return liveReachable.has(owner) ? 'REACHABLE_AUTHORITY' : 'UNREACHABLE_LEGACY';
}

function findBalanced(src, open, left = '(', right = ')') {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === left) depth++;
    else if (src[i] === right) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function statementEnd(src, start) {
  let p = 0, b = 0, c = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') p++; else if (ch === ')') p--;
    else if (ch === '[') b++; else if (ch === ']') b--;
    else if (ch === '{') c++; else if (ch === '}') { if (c === 0) return i; c--; }
    else if (ch === ';' && p === 0 && b === 0 && c === 0) return i + 1;
  }
  return src.length;
}

/**
 * [Gate 3A round 7] Start of the statement containing `pos`, inside owner range
 * `f`: walk back on code-only text to the nearest `;`, `{` or `}` that is not
 * inside an enclosing parenthesis/bracket of the statement itself.
 */
function statementStart(src, f, pos) {
  const b = blankNonCode(src.slice(f.bodyStart, f.end));
  let depth = 0;
  for (let i = pos - f.bodyStart - 1; i >= 0; i--) {
    const ch = b[i];
    if (ch === ')' || ch === ']') depth++;
    else if (ch === '(' || ch === '[') { if (depth === 0) continue; depth--; }
    else if (depth === 0 && (ch === ';' || ch === '{' || ch === '}')) return f.bodyStart + i + 1;
  }
  return f.bodyStart;
}

/**
 * [Gate 3A round 7] Leaf properties of the object literal whose `{` is at
 * `open`, recursing into nested object-literal values: `{intent:{side:x}}`
 * yields path `intent.side`. Splits at depth-0 commas on code-only text.
 */
function objectLiteralLeaves(src, open, prefix = '') {
  const b = blankNonCode(src);
  const close = findBalanced(b, open, '{', '}');
  if (close < 0) return [];
  const out = [];
  let d = 0, segStart = open + 1; const segs = [];
  for (let i = open + 1; i < close; i++) {
    const ch = b[i];
    if (ch === '{' || ch === '(' || ch === '[') d++;
    else if (ch === '}' || ch === ')' || ch === ']') d--;
    else if (ch === ',' && d === 0) { segs.push([segStart, i]); segStart = i + 1; }
  }
  segs.push([segStart, close]);
  for (const [a, z] of segs) {
    const segB = b.slice(a, z), segR = src.slice(a, z);
    if (!segB.trim()) continue;
    if (/^\s*\.\.\./.test(segB)) { out.push({ path:`${prefix}<spread>`, value:segR.trim().replace(/^\.\.\./, ''), pos:a }); continue; }
    let dd = 0, colon = -1;
    for (let i = 0; i < segB.length; i++) {
      const ch = segB[i];
      if (ch === '{' || ch === '(' || ch === '[') dd++;
      else if (ch === '}' || ch === ')' || ch === ']') dd--;
      else if (ch === ':' && dd === 0) { colon = i; break; }
    }
    if (colon < 0) { const k = segR.trim(); if (/^[A-Za-z_$][\w$]*$/.test(k)) out.push({ path:prefix + k, value:k, pos:a }); continue; }
    const key = segR.slice(0, colon).trim().replace(/^['"]|['"]$/g, '');
    const valStart = a + colon + 1;
    const lead = b.slice(valStart, z).search(/\S/);
    if (lead >= 0 && b[valStart + lead] === '{') out.push(...objectLiteralLeaves(src, valStart + lead, `${prefix}${key}.`));
    else out.push({ path:prefix + key, value:segR.slice(colon + 1).trim(), pos:valStart });
  }
  return out;
}

/** Extract every if condition with a short consequence slice. */
function ifConditions(src, ownerRange) {
  const out = [];
  const body = src.slice(ownerRange.bodyStart, ownerRange.end);
  const re = /\bif\s*\(/g; let m;
  while ((m = re.exec(body))) {
    const abs = ownerRange.bodyStart + m.index;
    const open = src.indexOf('(', abs), close = findBalanced(src, open);
    if (close < 0) continue;
    const after = close + 1;
    let consequenceEnd;
    if (src[after] === '{') consequenceEnd = findBalanced(src, after, '{', '}') + 1;
    else consequenceEnd = statementEnd(src, after);
    out.push({ pos: abs, condition: src.slice(open + 1, close).trim(), consequence: src.slice(after, Math.min(consequenceEnd, after + 900)).trim() });
  }
  return out;
}

function extractArrowArgument(src, callPos) {
  const open = src.indexOf('(', callPos), close = findBalanced(src, open);
  return close < 0 ? '' : src.slice(open + 1, close).trim();
}

function uniq(arr) { return [...new Set(arr)]; }

/*
 * Canonical authority inputs. These are classifications/destinations, not the
 * scan universe. The scan universe is the sink set discovered below. A sink
 * dependency that does not resolve here is a Gate 3A defect.
 */
const CATALOG = {
  DATA_HEALTH_OK: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Composite feed/data-health verdict used by the live profile engine.',
    thresholdSource: 'Current feedGate contains minimum-bar, age, continuity, ATR-availability and tick-recency thresholds. Those constituent thresholds must be recorded individually before §14C admission.',
    destination: 'Decompose into named Layer-1 data-validity predicates. Until constituent provenance is complete, DATA_HEALTH_OK is not admitted as 2B authority.',
    semanticFamily: 'DATA_QUALITY',
  },
  DATA_HEALTH_REASONS: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Composite reason/blocker array from feedGate.', thresholdSource: 'Mixed thresholds inherited from feedGate.',
    destination: 'Replace with named Layer-1 reason codes emitted by individual admitted predicates.', semanticFamily: 'DATA_QUALITY',
  },
  DATA_ADVISORY_FEATURES: {
    classification: 'ADVISORY_FEATURE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current advisory-only data-health observations/reasons that are intentionally not execution-critical.', thresholdSource: 'Diagnostic/advisory semantics; no capital authority.',
    destination: 'advisoryFeatureSchema and diagnostics only; structurally unreachable from pWin/EV/state authority.', semanticFamily: 'DATA_QUALITY',
  },
  CANONICAL_ATR_AVAILABLE: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'ADMITTED',
    semantic: 'Canonical Gate-2 ATR availability check.', thresholdSource: 'W=200 canonical-history requirement frozen by Gate 2; failure is data insufficiency independent of profitability.',
    destination: 'Layer-1 data-validity predicate/reason code.', semanticFamily: 'DATA_QUALITY',
  },
  PRICE_VALID: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'ADMITTED',
    semantic: 'Executable analysis price must be finite and positive.', thresholdSource: 'Numeric/domain validity only; no outcome optimization.',
    destination: 'Layer-1 data-validity predicate. Implementation note: the admitted predicate\'s live authority consumer is the inline finite/positive price check in analyze(). The separately named `priceValid` write in finalizeOutcome() is dispositioned LOGGING_OUTCOME_ONLY and is not this predicate\'s implementation; do not read the logging write as the predicate, and do not promote it to authority.', semanticFamily: 'DATA_QUALITY',
  },
  HTF_CONTEXT_QUALITY: {
    classification: 'RAW_MODEL_FEATURE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Directional context quality: same/opposing votes and derived context.ok.',
    thresholdSource: 'Current same>=1 && opposing<2 rule has no recorded non-P/L derivation.',
    destination: 'Capital feature(s), not direct 2B gate. This is the semantic successor of HTF_GRADE_NOT_C unless later proven structural under §14C.',
    semanticFamily: 'HTF_GRADE_NOT_C',
  },
  REGIME_QUALITY: {
    classification: 'RAW_MODEL_FEATURE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Canonical regime confidence/quality quantities used by legacy gates.',
    thresholdSource: 'Historical confidence thresholds are priors without validation artifact.',
    destination: 'capitalFeatureSchema/diagnostics only; no raw regime-confidence state gate.', semanticFamily: 'REGIME_QUALITY_OK',
  },
  REWARD_ECONOMIC_QUALITY: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Gross R, net R, cost R and profile economics currently mixed into plan validity/state.',
    thresholdSource: 'minGrossR/minNetR/maxCostR are profile economic policy values, not structural validity.',
    destination: 'Remove from Layer-1/state eligibility. Economics move to ExecutionSnapshot + Gate-4 veto/policy; any model use is feature-only.', semanticFamily: 'REWARD_GRADE_NOT_C',
  },
  TRIGGER_QUALITY: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Legacy weighted/fresh trigger semantics and confirmation components.',
    thresholdSource: 'Legacy trigger thresholds/weights have incomplete or outcome-adjacent provenance.',
    destination: 'Decompose. Continuous pieces become capital features; a future ENTRY_EVENT_CONFIRMED is created only after every constituent passes §14C.', semanticFamily: 'TRIGGER_GRADE_NOT_C',
  },
  ENTRY_EVENT_CONFIRMED: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Proposed FIRE-entry-event boolean; it does not yet exist as an admitted predicate.',
    thresholdSource: 'UNDECLARED. The current assessTrigger/lifecycle thresholds cannot be renamed into authority.',
    destination: 'Do not create in production until its closed-bar definition and every threshold provenance are frozen and pass HP-1/HP-2.', semanticFamily: 'TRIGGER_GRADE_NOT_C', proposed: true, replacementRequired: true,
  },
  GEOMETRY_COMPLETE: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Proposed completeness/coherence predicate for frozen trade geometry.',
    thresholdSource: 'Structural completeness concept is non-P/L, but the current plan object also mixes economics. Exact constituent definition still requires separation/provenance.',
    destination: 'Layer-1 named predicate only after structural-only definition is extracted from planner economics.', semanticFamily: 'GEOMETRY', proposed: true,
  },
  LIFECYCLE_STAGE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Current BREAK_CONFIRMED/RETEST_TOUCHED/RETEST_HELD/TRIGGERED lifecycle stage and its thresholds.',
    thresholdSource: 'Stage transitions include 5-bar expiry and continuation/rejection thresholds that require provenance review.',
    destination: 'Replace with frozen Layer-1 lifecycle ending in LIFECYCLE_CONFIRMED; Layer 1 no longer emits TRIGGERED.', semanticFamily: 'LIFECYCLE', replacementRequired: true,
  },
  TRIGGER_FRESHNESS: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Current triggerFresh/triggerAt recency gates.',
    thresholdSource: 'Current max 120s / 1.5× execution timeframe rule has no recorded §14C provenance.',
    destination: 'Re-express as named freshness predicate only after provenance; FIRE freshness ultimately belongs to State Policy.', semanticFamily: 'TRIGGER_GRADE_NOT_C',
  },
  SPECIALIST_GATE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Composite market-family specialist reasons/alignment/bias gate.',
    thresholdSource: 'Mix of safety/data conditions and heuristic directional filters.',
    destination: 'Decompose per market family: safety/data predicates may pass §14C; heuristic terms become capital/advisory features.', semanticFamily: 'SPECIALIST',
  },
  RISK_SCALE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Profile/specialist risk scaling currently produced before canonical sizing.',
    thresholdSource: 'Sizing policy values; not Layer-1 validity.',
    destination: 'Gate-4 Risk/Sizing Policy only. No Layer-1 or conviction authority.', semanticFamily: 'SIZING',
  },
  OPPORTUNITY_SCORE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current continuous score used by live/legacy presentation and some legacy/data-acquisition logic.',
    thresholdSource: 'Engineering weights/thresholds; not calibrated pWin/EV.',
    destination: 'Remove as authority. Selection uses conviction state→pWin→EV→setup priority→causal age; presentation may show non-authoritative diagnostics.', semanticFamily: 'LEGACY_SCORE',
  },
  LEGACY_EVAL_DIRECTION: {
    classification: 'RAW_MODEL_FEATURE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'evaluateStrategy direction output/strategyPreview.direction.', thresholdSource: 'Derived from current legacy evaluation semantics.',
    destination: 'Map to explicit candidate direction/feature semantics; never use as hidden state authority.', semanticFamily: 'LEGACY_EVAL',
  },
  LEGACY_EVAL_SCORE: {
    classification: 'RAW_MODEL_FEATURE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'evaluateStrategy/evaln score.', thresholdSource: 'Weighted legacy strategy components; not calibrated.',
    destination: 'capitalFeatureSchema only if retained; all direct state/data-request thresholds removed.', semanticFamily: 'LEGACY_EVAL',
  },
  LEGACY_EVAL_PRIMARY_SETUP: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'evaln.primarySetupQualified alters legacy READY/FIRE thresholds.', thresholdSource: 'Current stage-membership shortcut has no independent safety justification.',
    destination: 'Remove threshold-shortcut authority. Candidate lifecycle is handled explicitly in Layer 1.', semanticFamily: 'LEGACY_EVAL',
  },
  LEGACY_EVAL_FAMILY_COUNTS: {
    classification: 'RAW_MODEL_FEATURE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'evaln broad/execution/actionable family counts.', thresholdSource: 'Legacy evidence-count heuristics.',
    destination: 'Feature vector/diagnostics only unless a later validated model uses them.', semanticFamily: 'LEGACY_EVAL',
  },
  LEGACY_EVAL_SPECIALIST: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'evaln.specialistQualified/specialistGate composite.', thresholdSource: 'Mixed specialist heuristics and data/safety rules.',
    destination: 'Decompose into named safety predicates and features; no composite state authority.', semanticFamily: 'LEGACY_EVAL',
  },
  LEGACY_EVAL_RISK_SCALE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'evaln.riskScale.', thresholdSource: 'Legacy/profile sizing heuristic.',
    destination: 'Gate-4 Risk/Sizing Policy.', semanticFamily: 'SIZING',
  },
  LEGACY_EVAL_THESIS: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'evaln.thesisId consistency checks.', thresholdSource: 'Identity consistency rather than profitability, but currently bound to legacy evaluation object.',
    destination: 'Replace with deterministic candidate/setup identity in FrozenTradeGeometry.', semanticFamily: 'IDENTITY',
  },
  PLAN_STATUS: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'plannerStatus/executionEligible composite mixes structural geometry and economics.', thresholdSource: 'Mixed.',
    destination: 'Split structural geometry completeness from dynamic execution economics. No composite plan verdict survives.', semanticFamily: 'GEOMETRY',
  },
  PLAN_BLOCKERS: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'reasonTree.blockers/reasons array from current plan.', thresholdSource: 'Mixed structural/economic thresholds.',
    destination: 'Split into named Layer-1 structural reason codes and Gate-4 economic veto reasons.', semanticFamily: 'GEOMETRY',
  },
  STOP_GEOMETRY: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Stop side/distance/volatility-floor/width checks.', thresholdSource: 'Some checks are structural; ATR multipliers/limits require provenance separation from optimized policy.',
    destination: 'Structural stop-side/completeness may become Layer-1 predicates; economic width limits belong later unless independently safety-derived.', semanticFamily: 'GEOMETRY',
  },
  TARGET_GEOMETRY: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Existence/ordering of a credible target.', thresholdSource: 'Structural target existence is non-P/L; target-selection policy is separately versioned.',
    destination: 'Layer-1 geometry completeness only after separation from minimum-R economics.', semanticFamily: 'GEOMETRY',
  },
  ENTRY_EXTENSION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Current entry-extension thresholds relative to ATR/reference.', thresholdSource: '0.35 ATR and continuation-extension limits are reference policy values requiring provenance/validation.',
    destination: 'Dynamic execution/State Policy feature or Gate-4 veto as appropriate; not silently structural.', semanticFamily: 'TRIGGER_GRADE_NOT_C',
  },
  STATE_RANK: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current state-based ranking of lanes/candidates.', thresholdSource: 'Deterministic ranking policy.',
    destination: 'Candidate Selection Policy with version/hash; current ranking replaced by frozen §6.6 ordering.', semanticFamily: 'SELECTION',
  },
  LIFECYCLE_RANK: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current rank(c) of TRIGGERED/RETEST/BREAK states.', thresholdSource: 'Legacy selection policy.',
    destination: 'Candidate Selection Policy; no current lifecycle rank may suppress a distinct candidate before inference.', semanticFamily: 'SELECTION',
  },
  CAUSAL_AGE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'knownAt/triggerAt recency currently used in selection.', thresholdSource: 'Deterministic tie-break semantics.',
    destination: 'Candidate Selection Policy final tie-break only after conviction/setup priority.', semanticFamily: 'SELECTION',
  },
  OPPOSING_FIRE_CONFLICT: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Current opposing-FIRE demotion based partly on context.same.', thresholdSource: 'Legacy conflict policy.',
    destination: 'Execution exposure/conflict policy; candidate states remain individually preserved.', semanticFamily: 'SELECTION',
  },
  DUPLICATE_CONSUMED: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'ADMITTED',
    semantic: 'Candidate/event has already been consumed/recorded.', thresholdSource: 'Identity/idempotency safety condition; no outcome optimization.',
    destination: 'Identity/dedup safety predicate; final broker idempotency belongs Gate 4/Boundary.', semanticFamily: 'SAFETY',
  },
  EXECUTION_COOLDOWN: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Per-profile signal cooldown.', thresholdSource: 'Policy duration, not structural validity.',
    destination: 'Broker/Execution Policy if retained and validated; not candidate/state authority.', semanticFamily: 'EXECUTION_POLICY',
  },
  TICK_FRESHNESS: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Execution-tick recency checks.', thresholdSource: '15s and clock-skew values are execution/data-safety thresholds requiring recorded provenance.',
    destination: 'Named data/execution-safety predicate; Gate-4 final price freshness uses pinned snapshots.', semanticFamily: 'DATA_QUALITY',
  },
  MARKET_OPEN: {
    classification: 'HARD_STRUCTURAL_PREDICATE', predicateAdmission: 'ADMITTED',
    semantic: 'Venue/session is open for the relevant market.', thresholdSource: 'Market schedule/execution feasibility, independent of profitability.',
    destination: 'Execution-feasibility predicate/reason code; venue-specific adapter ultimately owns authoritative schedule.', semanticFamily: 'EXECUTION_POLICY',
  },
  FAMILY_EXECUTION_PERMISSION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'family.demoExecutionAllowed / broker-model availability gate.', thresholdSource: 'Product/adapter permission, not market structure.',
    destination: 'Gate-4 execution/entitlement admission. Must not alter valid conviction state.', semanticFamily: 'EXECUTION_POLICY',
  },
  PROFILE_SELECTION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Which user-selected/managed profile lanes are eligible to enter the live lane pool.', thresholdSource: 'User/product configuration, not signal quality.',
    destination: 'Candidate Selection Policy input/configuration. It may define lane scope but must not impersonate conviction.', semanticFamily: 'SELECTION',
  },
  BROKER_EXECUTION_ADMISSION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current browser-side cTrader route environment/connection/armed/mode checks.', thresholdSource: 'Execution/configuration/security policy, not signal quality.',
    destination: 'Gate-4 EXECUTION_POLICY_ADMITTED / Broker Execution Policy. Failure locks execution but must not demote a valid conviction state.', semanticFamily: 'EXECUTION_POLICY',
  },
  CALIBRATION_PERMISSION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current calibration/trade-permission fields copied into browser execution intents.', thresholdSource: 'Legacy calibration/permission contract.',
    destination: 'Replace with scoped INFERENCE_ADMITTED/STATE_POLICY_ADMITTED/EXECUTION_POLICY_ADMITTED provenance; no status string grants execution.', semanticFamily: 'PROVENANCE',
  },
  POSITION_MANAGEMENT_GATE: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'CANDIDATE_UNADMITTED',
    semantic: 'Current automated opposite-structure exit gate over managed positions.', thresholdSource: 'Mixed lifecycle/context/specialist/freshness conditions.',
    destination: 'Versioned Position Management Policy plus emergency risk-reduction kernel; classify actual effect as RISK_REDUCING/RISK_INCREASING.', semanticFamily: 'POSITION_MANAGEMENT',
  },
  RISK_REDUCING_DATA_BYPASS: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current reversal-exit intent hardcodes dataExecutionOk:true instead of expressing risk-reducing classification directly.', thresholdSource: 'Legacy exit-intent convention; not a data-health proof.',
    destination: 'Replace with explicit RISK_REDUCING order classification and reduced safety invariant set; do not spoof data health to obtain permission.', semanticFamily: 'POSITION_MANAGEMENT', replacementRequired: true,
  },
  BROKER_SUBMISSION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current browser boundary that submits entry, reversal-exit or manual-close instructions to /api/broker/*.', thresholdSource: 'Transport/submission action; not signal quality or eligibility.',
    destination: 'Gate-4 Broker Execution Boundary with deterministic intent identity, idempotency, reconciliation and scoped execution admission.', semanticFamily: 'EXECUTION_POLICY',
  },
  // [Gate 3A round 7] Surfaced when every field of the submitted order became a
  // sink. Previously only riskFraction/data/permission fields were; the order's
  // identity and direction were sent to the broker uninventoried.
  BROKER_ORDER_PAYLOAD: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Identity and direction of the order the browser submits to /api/broker/*: instrument, side, entry price, event/candidate/position identifiers, source timeframe, signal time, model and family labels and the data-quality label. Stop and take-profit values are classified as STOP_GEOMETRY / TARGET_GEOMETRY.', thresholdSource: 'Copied from the fired signal record / managed position; no thresholds.',
    destination: 'Gate-4 broker intent contract / ExecutionSnapshot: replace with a typed, hashed order payload whose every field has declared provenance.', semanticFamily: 'EXECUTION_POLICY',
  },
  LEGACY_EXECUTION_PERMISSION_ASSERTION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Legacy execution intent fields such as riskCanOpen:true / executionPermission:DEMO_AUTO that assert permission inside the payload.', thresholdSource: 'Legacy browser intent convention; no scoped provenance proof.',
    destination: 'Remove. Execution permission comes only from scoped provenance plus Gate-4 veto/broker policy; payload strings/booleans never grant capital authority.', semanticFamily: 'PROVENANCE',
  },
  MANUAL_RISK_REDUCTION: {
    classification: 'LEGACY_REMOVE', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Current user-confirmed direct close-position path exposed by the browser broker integration.', thresholdSource: 'User request plus broker position identifier; current browser path is not the frozen reduced safety kernel.',
    destination: 'Gate-4/Position Management reduced safety path: verified POSITION_IDENTITY + REDUCTION_PROOF + BROKER_REACHABILITY, without risk-increasing side effects.', semanticFamily: 'POSITION_MANAGEMENT',
  },
  RESEARCH_CONTINUATION: {
    classification: 'RESEARCH_HEURISTIC', predicateAdmission: 'NOT_APPLICABLE',
    semantic: 'Continuation OBSERVE route / researchSeeds.', thresholdSource: 'Research priors only.',
    destination: 'Research ledger only; unreachable from production candidate/state authority.', semanticFamily: 'RESEARCH',
  },
};

/* Resolve concrete source tokens to canonical catalogue entries. */
function canonicalDependency(token, owner, expression) {
  const t = token.replace(/\?\./g, '.');

  // Owner-local aliases are intentionally explicit rather than ignored. This
  // preserves the mutation guarantee: an unknown new gate name does not inherit
  // a broad owner-level classification.
  const local = {
    analyze: {
      HTF_CONTEXT_QUALITY: [/^(context|ok|opposing|same|opp|votes|profile\.context|candidate\.dir)$/,/^v$/],
      LIFECYCLE_STAGE: [/^candidate\.stage$/],
      LIFECYCLE_RANK: [/^[ab]\.candidate$/, /^candidates\.length$/],
      TRIGGER_FRESHNESS: [/^candidate\.(triggerFresh|triggerAt)$/,/^execTf$/],
      RISK_SCALE: [/^(specialist|scale|result\.specialist\.scale)$/],
      OPPORTUNITY_SCORE: [/^candidate\.touchAt$|^touchAt$/],
      OPPOSING_FIRE_CONFLICT: [/^(side|best\.side|r\.side)$/],
      DUPLICATE_CONSUMED: [/^c\.id$/],
      // ([Gate 3A round 7] LIFECYCLE_RANK above also covers the early-return guard
      //  `!candidates.length`: no ranked, unconsumed candidate -> NO_TRADE)
    },
    feedGate: {
      DATA_HEALTH_OK: [/^(a\.length|age|g|scheduled|map\.W1|map\.W1\.length|profile\.id|end|t|executionTf)$/],
      // [Gate 3A closure] feedGate's returned coreOk is ZUGRIO_ATR_OK(atr(executionBars)),
      // the G22-03 execution-frame ATR availability check.
      CANONICAL_ATR_AVAILABLE: [/^executionBars$/],
    },
    assessDataHealth: {
      DATA_HEALTH_OK: [/^(coreOk|executionOk|blockingReasons\.length|reasons\.some)$/],
    },
    coreStrategyEvaluate: {
      // [Gate 3A closure] the returned eval record's `eligible: score>=V5_THRESH.watch`
      // and `score` are a live authority write gated on the historical WATCH prior.
      LEGACY_EVAL_SCORE: [/^(score|V5_THRESH\.watch)$/],
      REGIME_QUALITY: [/^s\.regime$/],
      LEGACY_EVAL_PRIMARY_SETUP: [/^(active|active\.(dir|stage))$/],
    },
    computeTargets: {
      REWARD_ECONOMIC_QUALITY: [/^(t1RR|readyMinTP1R|TTI_GEOMETRY\.readyMinTP1R)$/],
    },
    seeds: {
      RESEARCH_CONTINUATION: [/^(rangeATR|eff|closeLoc|penetrationATR|ref\.(minRangeATR|minDirectionalEfficiency|minCloseLocation|minPenetrationATR))$/],
    },
    familyGate: {
      SPECIALIST_GATE: [/^(candidate\.(type|dir)|type|bias|input\.regime|regime|h|l|recent|recent\[i\]\.(h|l)|input\.now|aligned|profile\.id|a\.length)$/],
      CANONICAL_ATR_AVAILABLE: [/^(av|refAtr|recent\.length)$/],
    },
    lifecycle: {
      // [Gate 3A closure] b.h/b.l/hi/lo feed the reassigned `overlap` retest-touch
      // verdict inside the lifecycle touch loop, surfaced by reassignment coverage.
      LIFECYCLE_STAGE: [/^(seed\.level|offset|last|c\.expiresAt|expiresAt|end|direct|seed\.direct|seed\.dir|b\.(c|o|t|h|l)|t|invalid|pad|overlap|touch|ti|directional|held|location|range|touch\.(h|l)|h|l|o|hi|lo)$/],
      // [Gate 3A closure] returned-alias writes c.triggerAt / c.triggerFresh:
      // `c.triggerFresh = i===bars.length-1` is a closed-bar recency fact.
      TRIGGER_FRESHNESS: [/^(bars\.length|at|c\.triggerAt)$/],
    },
    plan: {
      TARGET_GEOMETRY: [/^(entry|v|crossed|a\.length|p\.(known|v)|known|a\.v|b\.(v|c))$/],
      ENTRY_EXTENSION: [/^(av|trigger|trigger\.c|route|TTI_FOUNDATION_REFERENCE\.entry\.breakAndGo\.maxExtensionATR|breakAndGo|maxExtensionATR)$/],
      STOP_GEOMETRY: [/^tick$/],
    },
    planTradeLevels: {
      REWARD_ECONOMIC_QUALITY: [/^(runwayOk|rr1|TTI_GEOMETRY\.readyMinTP1R)$/],
      STOP_GEOMETRY: [/^(stopGeometryOk|maxStopATR|stopATR|TTI_GEOMETRY\.maxStopATR|zoneCalc\.infeasible|zone\.invalidationLevel|__minValidStop|plannedStopDist)$/],
      TARGET_GEOMETRY: [/^tg\.(ordered|t1)$/],
      // [Gate 3A round 7] early-return plan rejections
      GEOMETRY_COMPLETE: [/^setupType$/],
      PRICE_VALID: [/^s\.price$/],

    },
    updateLegacySignalState: {
      LEGACY_EVAL_SCORE: [/^V5_THRESH\.(?:ready|fire)$/],
      HTF_CONTEXT_QUALITY: [/^htfOk$/],
      GEOMETRY_COMPLETE: [/^geometry\.ok$/],
      DUPLICATE_CONSUMED: [/^fireEventId$/],
    },
    updateSignalState: {
      STATE_RANK: [/^state$/,/^lane\.state$/,/^best\.state$/],
      PRICE_VALID: [/^s\.price$/],
      PROFILE_SELECTION: [/^(instrumentKey|p\.instrumentKey|profileId|l\.profileId|TTI_PROFILE_ENGINE\.PROFILES)$/],
      DUPLICATE_CONSUMED: [/^(buildTag|h\.buildTag|lane\.candidate\.id)$/],
      TRIGGER_FRESHNESS: [/^(TTI_PROFILE_ENGINE\.SECONDS|executionTf|lane\.executionTf)$/],
      MARKET_OPEN: [/^forex$/],
      // [Gate 3A round 7] guards the profile-update emitEngine(CLOSED_BAR) that drives routeConfirmedReversal
      POSITION_MANAGEMENT_GATE: [/^(closeKey|s\.lastProfileCloseKey)$/],
    },
    checkSig: {
      STATE_RANK: [/^(state|l\.state|s\.profileStates)$/],
      PROFILE_SELECTION: [/^(profileId|l\.profileId|selectedTradeProfiles)$/],
      DUPLICATE_CONSUMED: [/^(buildTag|h\.buildTag|c\.id)$/],
      TRIGGER_FRESHNESS: [/^(TTI_PROFILE_ENGINE\.SECONDS|executionTf|lane\.executionTf)$/],
    },
    recomputeFull: {
      // [Gate 3A round 7] guards emitEngine(CLOSED_BAR), which drives routeConfirmedReversal
      POSITION_MANAGEMENT_GATE: [/^isNewClosedBar$/],
      PRICE_VALID: [/^s\.price$/],
      DATA_HEALTH_OK: [/^cls\.length$/],
      CANONICAL_ATR_AVAILABLE: [/^(av|atrP)$/],
      LEGACY_EVAL_SCORE: [/^(V5_THRESH\.watch|score|watch)$/],
    },
    evaluateStrategy: {
      // [Gate 3A round 7] early-return guards choosing which strategy evaluator runs
      PROFILE_SELECTION: [/^(TTI_V5\.(getStrategy|activeStrategy)|st\.(status|id|name))$/],
    },
    makeIntent: {
      RISK_SCALE: [/^(state\.status\.policy\.riskPerTradePct|riskScale|evaln\.riskScale|policy|status)$/],
      DATA_HEALTH_OK: [/^(item\.dataHealth\.executionOk|item\.dataHealth|dataHealth|item\.dataHealth\.status)$/],
      // [Gate 3A round 7] order identity/direction fields
      BROKER_ORDER_PAYLOAD: [/^(item\.(id|k|sig|entryPrice|signalAt|strategyModelId)|evaln\.modelId|family\.(modelId|family))$/],
      CALIBRATION_PERMISSION: [/^(item\.tradePermission|calibrationAudit)$/],
    },
    route: {
      BROKER_EXECUTION_ADMISSION: [/^(location\.(protocol|hostname)|state\.(csrf|status|status\.executionMode|status\.armed))$/],
      DUPLICATE_CONSUMED: [/^(payload\.result(?:\.duplicate)?)$/],
    },
    closePosition: {
      MANUAL_RISK_REDUCTION: [/^(window\.confirm|positionId|String)$/],
    },
    routeConfirmedReversal: {
      BROKER_EXECUTION_ADMISSION: [/^(status\.connected|state\.status)$/],
      FAMILY_EXECUTION_PERMISSION: [/^(familyPolicy\.demoExecutionAllowed)$/],
      POSITION_MANAGEMENT_GATE: [/^(position\.side|candidate\.dir|side)$/],
      LIFECYCLE_STAGE: [/^(candidate\.stage|stage)$/],
      TRIGGER_FRESHNESS: [/^(candidate\.(triggerFresh|triggerAt))$/],
      HTF_CONTEXT_QUALITY: [/^(lane\.context\.ok)$/],
      SPECIALIST_GATE: [/^(lane\.specialist\.ok|specialist)$/],
      DATA_HEALTH_OK: [/^(lane\.dataHealth\.executionOk|dataHealth)$/],
      DUPLICATE_CONSUMED: [/^(state\.exitIds|eventId|exitIds)$/],
      // [Gate 3A round 7] reversal-exit order identity fields
      BROKER_ORDER_PAYLOAD: [/^(position\.positionId|candidate\.(id|sourceTf)|familyPolicy\.(family|modelId))$/],
    },
  };
  for (const [canonical, patterns] of Object.entries(local[owner] || {})) {
    if (patterns.some((re) => re.test(t))) return canonical;
  }

  // [Gate 3A closure] calls into the engine's own namespace resolve to known engine
  // functions; the execution spread model is a cost input.
  if (/^TTI_PROFILE_ENGINE\.(plan|analyze|lifecycle|seeds|feedGate|familyGate)$/.test(t)) return 'PROFILE_SELECTION';
  if (/^TTI_EXECUTION\.spread$/.test(t)) return 'REWARD_ECONOMIC_QUALITY';
  if (/^PROFILES\.[A-Z]+$/.test(t)) return 'PROFILE_SELECTION';
  // [Gate 3A freeze] an engine listener's routing condition — event type and the
  // presence of its payload — is the admission point for a broker action
  if ((/^engineListener_\d+$/.test(owner || '') || ENGINE_LISTENER_NAMES.has(owner)) && /^(?:type|p|p\.(?:item|k)|ENGINE_EVENTS\.[A-Z_]+)$/.test(t)) return 'BROKER_EXECUTION_ADMISSION';
  // the engine's declared profile catalogue, read by the operator profile selector
  if (/^TTI_PROFILE_ENGINE\.PROFILES(?:\.[A-Z]+)?$/.test(t)) return 'PROFILE_SELECTION';
  // the New York venue clock that computes the retail-FX week boundary
  if (/^nyClock\.formatToParts$/.test(t)) return 'MARKET_OPEN';
  // retest expiry age and confirmation-bar counts per timeframe: lifecycle timing
  if (/^RETEST_POLICY\.[A-Z0-9]+(?:\.[A-Za-z]+)?$/.test(t)) return 'LIFECYCLE_STAGE';
  const table = [
    [/^(health|dataHealth)\.executionOk$|^executionOk$/, 'DATA_HEALTH_OK'],
    [/^(health|dataHealth)\.(reasons|blockingReasons)$|^unique\.length$/, 'DATA_HEALTH_REASONS'],
    [/ZUGRIO_ATR_OK|ATR_INSUFFICIENT|atrOk|coreOk/, 'CANONICAL_ATR_AVAILABLE'],
    [/^price$|Number\.isFinite\(price\)/, 'PRICE_VALID'],
    [/context\.(ok|same|opposing|votes)|^same$|^opp$|^votes$/, 'HTF_CONTEXT_QUALITY'],
    [/regimeConf|REGIME_QUALITY_OK/, 'REGIME_QUALITY'],
    [/grossR|netR|costR|minGrossR|minNetR|maxCostR|execution\.rrTP1|estimatedCostR|estimatedNetRR/, 'REWARD_ECONOMIC_QUALITY'],
    [/assessTrigger|weighted|freshPriceAction|trigger\.confirmed|trigger\.path|tickVel|m1Close|zoneReact|sweepRej|fvgMitig/, 'TRIGGER_QUALITY'],
    [/ENTRY_EVENT_CONFIRMED/, 'ENTRY_EVENT_CONFIRMED'],
    [/GEOMETRY_COMPLETE/, 'GEOMETRY_COMPLETE'],
    [/candidate\.stage|c\.stage|stageRank|STRUCTURE_STAGE|^rank$/, 'LIFECYCLE_STAGE'],
    [/candidate\.triggerFresh|candidate\.triggerAt|c\.triggerAt|triggerAt|triggerFresh/, 'TRIGGER_FRESHNESS'],
    [/specialist\.(ok|reasons|scale)|result\.specialist|aligned|tail|shock|shockAtrUnavailable|RESET_BIAS_CONFLICT|SPECIALIST_UNAVAILABLE/, 'SPECIALIST_GATE'],
    [/riskScale|profile\.riskScale|specialist\.scale/, 'RISK_SCALE'],
    [/opportunityScore|\.score$|result\.score|best\.score|lane\.score/, 'OPPORTUNITY_SCORE'],
    [/evaln\.direction|strategyPreview\.direction/, 'LEGACY_EVAL_DIRECTION'],
    [/evaln\.score|strategyPreview\.score/, 'LEGACY_EVAL_SCORE'],
    [/evaln\.primarySetupQualified|primarySetupQualified|^primary$/, 'LEGACY_EVAL_PRIMARY_SETUP'],
    [/evaln\.(broadFamilies|executionFamilies|actionableFamilies|families)|^broad$/, 'LEGACY_EVAL_FAMILY_COUNTS'],
    [/evaln\.(specialistQualified|specialistGate)/, 'LEGACY_EVAL_SPECIALIST'],
    [/evaln\.riskScale/, 'LEGACY_EVAL_RISK_SCALE'],
    [/evaln\.thesisId|plan\.thesisId/, 'LEGACY_EVAL_THESIS'],
    [/plannerStatus|executionEligible|plan\.plannerStatus/, 'PLAN_STATUS'],
    [/reasonTree\.blockers|plan\.reason|result\.blockers|base\.blockers|reasons\.length|blockers\.length/, 'PLAN_BLOCKERS'],
    [/STOP_WRONG_SIDE|STOP_TOO_TIGHT|STOP_TOO_WIDE|stop|risk/, 'STOP_GEOMETRY'],
    [/NO_STRUCTURAL_TARGET|objective|target|targets/, 'TARGET_GEOMETRY'],
    [/ENTRY_TOO_EXTENDED|BREAK_AND_GO_EXTENSION_LIMIT|extensionATR|pRef/, 'ENTRY_EXTENSION'],
    [/stateRank|rank\[|\.state$/, 'STATE_RANK'],
    [/rank\(|LIFECYCLE_RANK/, 'LIFECYCLE_RANK'],
    [/knownAt|\.triggerAt$|candidate\.knownAt/, 'CAUSAL_AGE'],
    [/OPPOSING_CONFIRMED_SETUPS|opposing.*FIRE|r\.side|best\.side/, 'OPPOSING_FIRE_CONFLICT'],
    [/consumed|profileConsumed|histLog\.some|lastConsumedFireId|candidateId/, 'DUPLICATE_CONSUMED'],
    [/cooldown|profileCooldown/, 'EXECUTION_COOLDOWN'],
    [/lastTickExchangeTime|TICK_STALE|tickAt/, 'TICK_FRESHNESS'],
    [/fxOpen|MARKET_CLOSED/, 'MARKET_OPEN'],
    [/demoExecutionAllowed|BROKER_MODEL_UNAVAILABLE|tradePermission/, 'FAMILY_EXECUTION_PERMISSION'],
    [/selectedTradeProfiles|profileId|instrumentKey/, 'PROFILE_SELECTION'],
    [/executionMode|\.armed|status\.connected|location\.(protocol|hostname)|csrf/, 'BROKER_EXECUTION_ADMISSION'],
    [/calibrationOk|tradePermission|calibrationAudit/, 'CALIBRATION_PERMISSION'],
    [/position\.side|OPPOSITE_STRUCTURE_CONFIRMED|exitSide/, 'POSITION_MANAGEMENT_GATE'],
    [/window\.confirm/, 'MANUAL_RISK_REDUCTION'],
    [/continuationReference|researchSeeds|breakAndGoFresh|referenceContinuationBreak/, 'RESEARCH_CONTINUATION'],
  ];
  for (const [re, name] of table) if (re.test(t)) return name;
  return null;
}

const NOISE = new Set([
  'if','else','return','continue','break','function','true','false','null','undefined','Infinity','NaN',
  'const','let','var','new','this','typeof','in','of','await','async',
  'Math','Number','Array','Object','Set','Map','Date','String','Boolean','JSON','Intl',
  'min','max','abs','test','https','context','ok','opposing','profileId','state','type','regime','h','l','o','known','v','direct','expiresAt','instrumentKey','isFinite','isArray','includes','some','every','filter','map','sort','slice','push','length','at','toFixed','floor','round',
  'result','base','candidate','profile','input','map','bars','lane','lanes','best','evaluated','c','s','k','tf','id','now','dir','family','reasons','blockers','plan','raw','frames','item','inst','p','b','r','a','i','x','old','newState','value','code','key',
  'TTI_PROFILE_ENGINE','SECONDS','SIGNAL_STATES','ENGINE_EVENTS','TTI_EXECUTION','TTI_FOUNDATION_REFERENCE','STRUCTURE_STAGE',
]);

/**
 * [Gate 3A closure] Tokenizer corrections. Producer sinks are frequently object
 * literals and regex-bearing expressions, which exposed three places where the
 * tokenizer read syntax as dependencies:
 *   - regex literal contents and flags (`/_/g` yielded `g`, `\d` yielded `d`);
 *   - object-literal KEYS (`{stage:'X'}` yielded `stage`) — a key in key
 *     position is never a dependency, whereas a ternary branch `?b:c` is kept;
 *   - properties read off a call result (`m1.at(-1).t` yielded root `t`).
 * Each is a correctness fix. It can only remove false dependencies: every value
 * position, including every key's value, is still tokenized.
 */
function blankRegexLiterals(src) {
  const out = src.split('');
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '/') continue;
    let j = i - 1; while (j >= 0 && /\s/.test(src[j])) j--;
    const prev = j >= 0 ? src[j] : '';
    const prevWord = src.slice(Math.max(0, j - 5), j + 1);
    if (!(prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\breturn$/.test(prevWord))) continue;
    if (src[i + 1] === '/' || src[i + 1] === '*') continue;
    let k = i + 1, inClass = false, ok = false;
    for (; k < src.length; k++) {
      const c = src[k];
      if (c === '\\') { k++; continue; }
      if (c === '\n') break;
      if (c === '[') inClass = true; else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { ok = true; break; }
    }
    if (!ok) continue;
    let f = k + 1; while (f < src.length && /[a-z]/.test(src[f])) f++;
    for (let x = i; x < f; x++) if (src[x] !== '\n') out[x] = ' ';
    i = f - 1;
  }
  return out.join('');
}

function blankObjectKeys(src) {
  // identifier directly after `{` or `,` (whitespace allowed) and directly before `:`
  return src.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)(?!:)/g, (m, a, key, c) => a + ' '.repeat(key.length) + c);
}

function dependencyTokens(expression) {
  const scrub = blankObjectKeys(blankRegexLiterals(blankNonCode(expression))).replace(/\b(?:BUY|SELL|WATCH|READY|FIRE|NO_TRADE|EXPIRED|INVALIDATED|VALID|BLOCKED)\b/g, ' ');
  // a chain that begins right after `.` is a property of a call/index result, not a root
  const members = [...scrub.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*(?:\?\.|\.)[A-Za-z_$][\w$]*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)*/g)].map((m) => m[0]);
  const bare = [...scrub.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*\b/g)].map((m) => m[0]);
  const memberSegments = new Set(members.flatMap((m) => m.split(/\?\.|\./)));
  return uniq([...members, ...bare.filter((x) => !NOISE.has(x) && !memberSegments.has(x) && !/^\d/.test(x))]);
}




function initializerEnd(src, start) {
  let p = 0, b = 0, c = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') p++; else if (ch === ')') p--;
    else if (ch === '[') b++; else if (ch === ']') b--;
    else if (ch === '{') c++; else if (ch === '}') { if (c === 0) return i; c--; }
    else if ((ch === ',' || ch === ';') && p === 0 && b === 0 && c === 0) return i;
  }
  return src.length;
}

/**
 * Find simple variable/member assignment verdict writes inside a function body.
 * Authority is not only downstream conditionals: the expression that computes a
 * verdict (for example `const readyOk = ...`) is itself an authority sink.
 */
function assignmentWrites(src, ownerRange) {
  const out = [];
  const body = src.slice(ownerRange.bodyStart, ownerRange.end);
  const decl = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=(?!=)\s*/g;
  let m;
  while ((m = decl.exec(body))) {
    const abs = ownerRange.bodyStart + m.index;
    const initStart = ownerRange.bodyStart + decl.lastIndex;
    const end = initializerEnd(src, initStart);
    const expression = src.slice(initStart, end).trim();
    if (expression) out.push({ target:m[1], targetKind:'BARE', expression, pos:abs });
  }
  const member = new RegExp('\\b([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)\\.(state|signalState|executionEligible|executionOk|plannerStatus|riskScale|score|calibrationOk|tradePermission|riskCanOpen|executionPermission)\\s*' + ASSIGN_OP + '\\s*', 'g');
  while ((m = member.exec(body))) {
    const abs = ownerRange.bodyStart + m.index;
    const initStart = ownerRange.bodyStart + member.lastIndex;
    const end = initializerEnd(src, initStart);
    const expression = src.slice(initStart, end).trim();
    if (expression) out.push({ target:`${m[1]}.${m[2]}`, targetKind:'MEMBER', expression, pos:abs });
  }
  /*
   * [Gate 3A closure] Bare REASSIGNMENT of a verdict: `runwayOk = runwayOk && x`.
   * Declarations were covered and member writes to listed authority props were
   * covered, so `p.executionEligible = ...` reassignment was caught while
   * `runwayOk = ...` was not. A verdict can be mutated after its declaration,
   * so every later write is as much an authority sink as the first.
   * Excludes declarations (handled above), member targets, comparisons,
   * arrows and compound assignment by construction of the pattern.
   */
  const reassign = new RegExp('(^|[^\\w$.])([A-Za-z_$][\\w$]*)\\s*' + ASSIGN_OP + '\\s*', 'g');
  const blanked = blankNonCode(body);
  while ((m = reassign.exec(blanked))) {
    const nameStart = m.index + m[1].length;
    const before = blanked.slice(Math.max(0, nameStart - 8), nameStart);
    if (/\b(?:const|let|var)\s+$/.test(before)) continue;       // a declaration, already captured
    const prevCh = blanked.slice(0, nameStart).trimEnd().slice(-1);
    if (/[!<>=+\-*/%&|^?]/.test(prevCh) && prevCh !== ';') {
      // part of an expression such as `a<b=c` is not valid JS anyway; keep conservative
    }
    const abs = ownerRange.bodyStart + nameStart;
    const initStart = ownerRange.bodyStart + reassign.lastIndex;
    const end = initializerEnd(src, initStart);
    const expression = src.slice(initStart, end).trim();
    if (expression) out.push({ target:m[2], targetKind:'BARE_REASSIGN', expression, pos:abs });
  }
  return out;
}

/**
 * [Gate 3A closure] Parse the top-level properties of every `return { ... }`
 * record in a function. A live gate communicates its verdict by the record it
 * returns, not by a local variable, so `coreOk: <expr>` on feedGate's return is
 * an authority write exactly like `const coreOk = <expr>`. Only its sibling
 * `executionOk:` had a direct pattern before, which is why appending an
 * undeclared conjunct to `coreOk:` was invisible.
 */
function returnRecordFields(src, ownerRange) {
  const out = [];
  const body = src.slice(ownerRange.bodyStart, ownerRange.end);
  const blanked = blankNonCode(body);
  const re = /\breturn\s*\{/g;
  let m;
  while ((m = re.exec(blanked))) {
    const open = m.index + m[0].length - 1;
    let depth = 0, close = -1;
    for (let i = open; i < blanked.length; i++) {
      const ch = blanked[i];
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close < 0) continue;
    // split top-level properties at depth-0 commas
    let d = 0, segStart = open + 1;
    const segs = [];
    for (let i = open + 1; i < close; i++) {
      const ch = blanked[i];
      if (ch === '{' || ch === '(' || ch === '[') d++;
      else if (ch === '}' || ch === ')' || ch === ']') d--;
      else if (ch === ',' && d === 0) { segs.push([segStart, i]); segStart = i + 1; }
    }
    segs.push([segStart, close]);
    for (const [a, b] of segs) {
      const segB = blanked.slice(a, b), segR = body.slice(a, b);
      if (!segB.trim()) continue;
      if (/^\s*\.\.\./.test(segB)) { out.push({ name:'<spread>', value:segR.trim().replace(/^\.\.\./,''), pos:ownerRange.bodyStart + a, spread:true }); continue; }
      // first depth-0 colon separates key from value (a ternary colon sits deeper or later)
      let dd = 0, colon = -1;
      for (let i = 0; i < segB.length; i++) {
        const ch = segB[i];
        if (ch === '{' || ch === '(' || ch === '[') dd++;
        else if (ch === '}' || ch === ')' || ch === ']') dd--;
        else if (ch === ':' && dd === 0) { colon = i; break; }
      }
      if (colon < 0) {
        const key = segR.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(key)) out.push({ name:key, value:key, pos:ownerRange.bodyStart + a, shorthand:true });
        continue;
      }
      const key = segR.slice(0, colon).trim().replace(/^['"]|['"]$/g, '');
      const value = segR.slice(colon + 1).trim();
      out.push({ name:key, value, pos:ownerRange.bodyStart + a });
    }
  }
  return out;
}


function looksLikeVerdictWrite(w) {
  const bare = (w.targetKind === 'BARE' || w.targetKind === 'BARE_REASSIGN') ? w.target : w.target.split('.').at(-1);
  if (w.targetKind === 'MEMBER') return /^(?:state|signalState|executionEligible|executionOk|plannerStatus|riskScale|score|calibrationOk|tradePermission|riskCanOpen|executionPermission)$/.test(bare);
  // Brownfield verdict identifiers. The suffix rules catch future verdicts of the
  // same semantic shape; the explicit names cover existing terse booleans.
  if (/^(?:readyOk|fireOk|econOk|thesisOk|runwayOk|stopGeometryOk|coreOk|regimeOk|priceValid|directEligible|allValid|held|directional|overlap|shock|aligned|tail|portfolioBlocked|blocked|htfOk)$/i.test(bare)) return true;
  return /(?:Ok|Eligible|Blocked|Allowed|Qualified|Confirmed|Fresh|Open|Caution)$/i.test(bare);
}

function sink(id, owner, kind, expression, pos, consequence = '') {
  const full = consequence.replace(/\s+/g, ' ').trim();
  const s = { id, owner, kind, expression: expression.replace(/\s+/g, ' ').trim(), pos, consequence: full.slice(0, 360) };
  // [Gate 3A round 8] the published consequence is truncated for readability;
  // the authority baseline signs the whole of it, so an edit past character
  // 360 of a guarded block is not invisible.
  Object.defineProperty(s, 'fullConsequence', { value: full, enumerable: false });
  return s;
}


const MANDATORY_VERDICT_META = {
  assessDataHealth: {
    coreOk: { canonical:'DATA_HEALTH_OK' },
    executionOk: { canonical:'DATA_HEALTH_OK' },
  },
  coreStrategyEvaluate: {
    regimeOk: { canonical:'REGIME_QUALITY' },
    primarySetupQualified: { canonical:'LEGACY_EVAL_PRIMARY_SETUP' },
  },
  computeTargets: {
    runwayOk: { canonical:'REWARD_ECONOMIC_QUALITY' },
  },
  seeds: {
    directEligible: { canonical:'RESEARCH_CONTINUATION', reachability:'RESEARCH_ONLY' },
  },
  planTradeLevels: {
    runwayOk: { canonical:'REWARD_ECONOMIC_QUALITY' },
    stopGeometryOk: { canonical:'STOP_GEOMETRY' },
  },
  updateLegacySignalState: {
    readyOk: {}, fireOk: {},
  },
};

/**
 * [Gate 3A closure] A gate may build a record, mutate it, and return the ALIAS:
 *   const c = {...seed, stage:'BREAK_CONFIRMED'}; c.stage = ...; c.triggerAt = ...; return c;
 * `returnRecordFields` only sees literal `return {...}` records, so lifecycle —
 * which returns `c` four times — had its entire returned authority record
 * invisible: a new field on `c`, or a conjunct injected into `c.stage = ...`,
 * produced zero defects. This resolves each returned identifier to its record:
 * the fields of its object-literal initializer plus every member write onto it.
 */
function aliasReturnFields(src, ownerRange) {
  const out = [];
  const body = src.slice(ownerRange.bodyStart, ownerRange.end);
  const blanked = blankNonCode(body);
  const aliases = new Set([...blanked.matchAll(/\breturn\s+([A-Za-z_$][\w$]*)\s*;/g)].map((m) => m[1]));
  for (const alias of aliases) {
    const esc = alias.replace(/[$]/g, '\\$');
    // object-literal initializer: const alias = { ... }
    const init = new RegExp(`\\b(?:const|let|var)\\s+${esc}\\s*=\\s*\\{`).exec(blanked);
    if (init) {
      const open = init.index + init[0].length - 1;
      let depth = 0, close = -1;
      for (let i = open; i < blanked.length; i++) {
        const ch = blanked[i];
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { close = i; break; } }
      }
      if (close > 0) {
        let d = 0, segStart = open + 1; const segs = [];
        for (let i = open + 1; i < close; i++) {
          const ch = blanked[i];
          if (ch === '{' || ch === '(' || ch === '[') d++;
          else if (ch === '}' || ch === ')' || ch === ']') d--;
          else if (ch === ',' && d === 0) { segs.push([segStart, i]); segStart = i + 1; }
        }
        segs.push([segStart, close]);
        for (const [a, b] of segs) {
          const segB = blanked.slice(a, b), segR = body.slice(a, b);
          if (!segB.trim()) continue;
          if (/^\s*\.\.\./.test(segB)) { out.push({ name:'<spread>', value:segR.trim().replace(/^\.\.\./,''), pos:ownerRange.bodyStart + a, spread:true, alias }); continue; }
          let dd = 0, colon = -1;
          for (let i = 0; i < segB.length; i++) {
            const ch = segB[i];
            if (ch === '{' || ch === '(' || ch === '[') dd++;
            else if (ch === '}' || ch === ')' || ch === ']') dd--;
            else if (ch === ':' && dd === 0) { colon = i; break; }
          }
          if (colon < 0) { const k = segR.trim(); if (/^[A-Za-z_$][\w$]*$/.test(k)) out.push({ name:k, value:k, pos:ownerRange.bodyStart + a, alias, shorthand:true }); continue; }
          out.push({ name:segR.slice(0, colon).trim().replace(/^['"]|['"]$/g,''), value:segR.slice(colon + 1).trim(), pos:ownerRange.bodyStart + a, alias, form:'ALIAS_INITIALIZER' });
        }
      }
    }
    // [Gate 3A closure] Object.assign(alias, {...}) onto a returned alias.
    // planTradeLevels builds `p = emptyLevelPlan(...)`, populates it through
    // Object.assign(p, {...}) and returns p six times, so the live planner's
    // entry/stop/target record was invisible to the literal and member passes.
    const oa = new RegExp(`Object\\.assign\\s*\\(\\s*${esc}\\s*,\\s*\\{`, 'g');
    let om;
    while ((om = oa.exec(blanked))) {
      const open = om.index + om[0].length - 1;
      let depth = 0, close = -1;
      for (let i = open; i < blanked.length; i++) {
        const ch = blanked[i];
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { close = i; break; } }
      }
      if (close < 0) continue;
      let d = 0, segStart = open + 1; const segs = [];
      for (let i = open + 1; i < close; i++) {
        const ch = blanked[i];
        if (ch === '{' || ch === '(' || ch === '[') d++;
        else if (ch === '}' || ch === ')' || ch === ']') d--;
        else if (ch === ',' && d === 0) { segs.push([segStart, i]); segStart = i + 1; }
      }
      segs.push([segStart, close]);
      for (const [a, b] of segs) {
        const segB = blanked.slice(a, b), segR = body.slice(a, b);
        if (!segB.trim()) continue;
        if (/^\s*\.\.\./.test(segB)) { out.push({ name:'<spread>', value:segR.trim().replace(/^\.\.\./,''), pos:ownerRange.bodyStart + a, spread:true, alias }); continue; }
        let dd = 0, colon = -1;
        for (let i = 0; i < segB.length; i++) {
          const ch = segB[i];
          if (ch === '{' || ch === '(' || ch === '[') dd++;
          else if (ch === '}' || ch === ')' || ch === ']') dd--;
          else if (ch === ':' && dd === 0) { colon = i; break; }
        }
        if (colon < 0) { const k = segR.trim(); if (/^[A-Za-z_$][\w$]*$/.test(k)) out.push({ name:k, value:k, pos:ownerRange.bodyStart + a, alias, form:'ALIAS_ASSIGN' }); continue; }
        out.push({ name:segR.slice(0, colon).trim().replace(/^['"]|['"]$/g,''), value:segR.slice(colon + 1).trim(), pos:ownerRange.bodyStart + a, alias, form:'ALIAS_ASSIGN' });
      }
    }
    // every member write onto the alias
    const mw = new RegExp(`(^|[^\\w$.])${esc}\\.([A-Za-z_$][\\w$]*)\\s*${ASSIGN_OP}\\s*`, 'g');
    let m;
    while ((m = mw.exec(blanked))) {
      const initStart = ownerRange.bodyStart + mw.lastIndex;
      const end = initializerEnd(src, initStart);
      out.push({ name:m[2], value:src.slice(initStart, end).trim(), pos:ownerRange.bodyStart + m.index + m[1].length, alias, form:'ALIAS_MEMBER_WRITE' });
    }
  }
  return out;
}

/**
 * [Gate 3A closure] Freeze a record at its PRODUCER, not at every consumer.
 *
 * lifecycle builds its returned record as `{...seed, ...}`, and analyze spreads
 * `base`. The gate schema records only a `<spread>` placeholder there, so a field
 * added to the spread source upstream flowed into a live returned record
 * undetected. Chasing a spread across functions is whole-program dataflow — the
 * wrong boundary for Gate 3A. Instead the seed record is frozen where it is
 * made: the `mk` arrow's object literal in seeds(), plus the `extra` object
 * literals passed at each add()/addResearch() call site, which feed mk's
 * `...extra` tail. All of that is inside one function.
 */
function literalKeysAt(blanked, raw, open) {
  let depth = 0, close = -1;
  for (let i = open; i < blanked.length; i++) {
    const ch = blanked[i];
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) return [];
  const keys = []; let d = 0, segStart = open + 1; const segs = [];
  for (let i = open + 1; i < close; i++) {
    const ch = blanked[i];
    if (ch === '{' || ch === '(' || ch === '[') d++;
    else if (ch === '}' || ch === ')' || ch === ']') d--;
    else if (ch === ',' && d === 0) { segs.push([segStart, i]); segStart = i + 1; }
  }
  segs.push([segStart, close]);
  for (const [a, b] of segs) {
    const segB = blanked.slice(a, b), segR = raw.slice(a, b);
    if (!segB.trim()) continue;
    if (/^\s*\.\.\./.test(segB)) { keys.push('<spread>'); continue; }
    let dd = 0, colon = -1;
    for (let i = 0; i < segB.length; i++) {
      const ch = segB[i];
      if (ch === '{' || ch === '(' || ch === '[') dd++;
      else if (ch === '}' || ch === ')' || ch === ']') dd--;
      else if (ch === ':' && dd === 0) { colon = i; break; }
    }
    const k = (colon < 0 ? segR : segR.slice(0, colon)).trim().replace(/^['"]|['"]$/g, '');
    if (/^[A-Za-z_$][\w$]*$/.test(k)) keys.push(k);
  }
  return keys;
}

function seedRecordFields(src, ownerRange) {
  const body = src.slice(ownerRange.bodyStart, ownerRange.end);
  const blanked = blankNonCode(body);
  const keys = new Set();
  const mk = /\bconst\s+mk\s*=\s*\([^)]*\)\s*=>\s*\(\s*\{/.exec(blanked);
  if (mk) for (const k of literalKeysAt(blanked, body, mk.index + mk[0].length - 1)) keys.add(k);
  // extra-literal keys at every add()/addResearch() call site feed mk's ...extra
  const call = /\b(?:add|addResearch)\s*\(/g; let m;
  while ((m = call.exec(blanked))) {
    const openParen = m.index + m[0].length - 1;
    let depth = 0, close = -1;
    for (let i = openParen; i < blanked.length; i++) {
      const ch = blanked[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close < 0) continue;
    // last top-level argument, if it is an object literal
    let d = 0, lastComma = openParen;
    for (let i = openParen + 1; i < close; i++) {
      const ch = blanked[i];
      if (ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === ')' || ch === ']' || ch === '}') d--;
      else if (ch === ',' && d === 0) lastComma = i;
    }
    const lastArg = blanked.slice(lastComma + 1, close);
    const brace = lastArg.search(/\S/);
    if (brace >= 0 && lastArg[brace] === '{') {
      for (const k of literalKeysAt(blanked, body, lastComma + 1 + brace)) keys.add(`extra.${k}`);
    }
  }
  return keys;
}

/** Property names returned by each authority owner, filled by discoverSinks. */
const gateReturnFields = new Map();

/**
 * [Gate 3A closure] Frozen returned-record field sets for live gate owners.
 * Frozen from the cleared Gate 2.2 artifact. Adding a property to a live gate's
 * returned record is an authority change and must be declared here, which is
 * what makes `hiddenGate: mysteryPolicy(map)` on feedGate a defect.
 * Frozen from Gate 2.2 artifact 52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178,
 * with alias-return tracking ON. An earlier freeze derived from literal
 * `return {...}` records only and was incomplete for lifecycle, which returns
 * its record by alias (`return c;`) and carried nine fields that freeze missed,
 * and for planTradeLevels, which populates its returned `p` through
 * Object.assign(p, {...}) and carried 34 fields that freeze missed. `seeds`
 * is the PRODUCER of the seed record that lifecycle spreads as `...seed`; its
 * `extra.*` keys come from the add()/addResearch() call sites feeding mk's tail.
 */
const GATE_RETURN_SCHEMA = Object.freeze({
  "feedGate": [
    "atrRequired",
    "blockingReasons",
    "checkedAt",
    "coreOk",
    "executionOk",
    "reasons",
    "required",
    "status"
  ],
  "familyGate": [
    "aligned",
    "bias",
    "ok",
    "reasons",
    "scale",
    "shock"
  ],
  "lifecycle": [
    "<spread>",
    "executionTf",
    "expiresAt",
    "invalidatedAt",
    "level",
    "reason",
    "rejectionExtreme",
    "stage",
    "touchAt",
    "triggerAt",
    "triggerFresh",
    "zoneHigh",
    "zoneLow"
  ],
  "plan": [
    "costR",
    "direction",
    "entry",
    "entryRoute",
    "entryZone",
    "executionEligible",
    "extensionATR",
    "grossR",
    "levelsFrozen",
    "netR",
    "plannerStatus",
    "priceSemantics",
    "reason",
    "reasonTree",
    "referenceEntry",
    "rr",
    "rrNet",
    "rrRaw",
    "setupType",
    "stop",
    "stopDist",
    "target",
    "targets",
    "thesisId",
    "triggerReference"
  ],
  "analyze": [
    "<spread>",
    "alternatives",
    "blockers",
    "candidate",
    "candidates",
    "context",
    "dataHealth",
    "executionTf",
    "plan",
    "profile",
    "profileId",
    "reason",
    "riskScale",
    "score",
    "side",
    "specialist",
    "state",
    "topDown"
  ],
  "evaluateStrategy": [
    "broadFamilies",
    "components",
    "direction",
    "eligible",
    "families",
    "reason",
    "score"
  ],
  "coreStrategyEvaluate": [
    "actionableFamilies",
    "broadFamilies",
    "components",
    "direction",
    "eligible",
    "events",
    "evidenceMode",
    "evidenceTTLBars",
    "executionFamilies",
    "families",
    "modelId",
    "primarySetupQualified",
    "reason",
    "riskScale",
    "score",
    "specialistGate",
    "specialistQualified",
    "thesisId"
  ],
  "planTradeLevels": [
    "actualRR",
    "costR",
    "direction",
    "entry",
    "entryPad",
    "entryQuality",
    "entryRoute",
    "entryStatus",
    "entryZone",
    "evNet",
    "evRaw",
    "executionEligible",
    "executionModelVersion",
    "expiresAt",
    "expiryReason",
    "geometry",
    "geometryWarning",
    "invalidationLevel",
    "levelInvalidReason",
    "levelLockedAt",
    "levelsFrozen",
    "marketEntry",
    "priceSemantics",
    "reason",
    "reasonTree",
    "referenceEntry",
    "rr",
    "rrNet",
    "rrRaw",
    "setupType",
    "stop",
    "stopDist",
    "target",
    "targetAllFallback",
    "targetKinds",
    "targetSources",
    "targets",
    "thesisId",
    "triggerReference"
  ],
  "makeIntent": [
    "accountProvider",
    "brokerAdapter",
    "buildTag",
    "calibrationOk",
    "createdAt",
    "dataExecutionOk",
    "dataQuality",
    "engineVersion",
    "entry",
    "eventId",
    "executionPermission",
    "exitPolicy",
    "family",
    "instrumentKey",
    "marketDataProvider",
    "profileId",
    "riskCanOpen",
    "riskFraction",
    "riskScale",
    "riskState",
    "schema",
    "side",
    "signalAt",
    "stopLoss",
    "strategyModelId",
    "takeProfit",
    "tradePermission"
  ],
  "seeds": [
    "<spread>",
    "atrAtBirth",
    "breakType",
    "dir",
    "extra.breakMetrics",
    "extra.direct",
    "extra.entryRoute",
    "extra.lineSlopePerSec",
    "extra.originalGapKnownAt",
    "extra.referenceEntry",
    "extra.researchOnly",
    "extra.triggerPrice",
    "id",
    "invalidationLevel",
    "knownAt",
    "level",
    "sourceTf",
    "type",
    "zoneHigh",
    "zoneLow"
  ]
});


/**
 * [Gate 3A closure — Blocker A] Consumer-driven producer closure.
 *
 * The scanner used to treat CLASSIFYING a dependency name as CLOSING it. A
 * condition `if (costR > profile.maxCostR)` classified `costR` as
 * REWARD_ECONOMIC_QUALITY and stopped, never asking what produced `costR`. So an
 * undeclared input inserted into the producer of any classified local was
 * invisible, including familyGate's `scale`, which reaches capital sizing:
 *   familyGate.scale -> result.specialist.scale -> result.riskScale
 *     -> strategyEvaluation.riskScale -> makeIntent -> riskFraction.
 *
 * This is a bounded backward authority slice, not a whole-program prover:
 *   reachable authority sink
 *     -> each dependency token
 *     -> its producer (declaration / reassignment / switch-case assignment),
 *        or, for a returned field consumed cross-function, the producer of that
 *        field inside the returning function
 *     -> that producer's dependencies -> ... until a fixed point.
 *
 * The slice terminates at function parameters (their authority is closed at the
 * caller), constants, data primitives and trusted intrinsics. Only values that
 * are actually CONSUMED by reachable authority are closed, so reason strings and
 * presentation fields are not dragged in.
 */
const PRODUCER_CLOSURE_MAX_SINKS = 4000;


/**
 * [Gate 3A closure] Names BOUND inside a function, where a backward slice
 * legitimately terminates: the function's own parameters (authority closed at
 * the caller), nested arrow/function parameters and loop variables (bound to an
 * iterated expression that is itself part of the enclosing sink), catch
 * parameters, and destructured bindings.
 */
function boundNames(src, fnRange) {
  const names = new Set();
  const sig = src.slice(fnRange.start, fnRange.bodyStart);
  const addList = (txt) => {
    for (let part of txt.split(',')) {
      part = part.replace(/=.*$/s, '').replace(/[{}\[\]\s.]/g, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(part)) names.add(part);
    }
  };
  const sp = /\(([^()]*)\)/.exec(sig);
  if (sp) addList(sp[1]);
  const body = blankNonCode(src.slice(fnRange.bodyStart, fnRange.end));
  for (const m of body.matchAll(/\(([^()]*)\)\s*=>/g)) addList(m[1]);
  for (const m of body.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1]);
  for (const m of body.matchAll(/\bfunction\s*[A-Za-z_$]?[\w$]*\s*\(([^)]*)\)/g)) addList(m[1]);
  for (const m of body.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of body.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s*[\[{]([^\]}]*)[\]}]/g)) addList(m[1]);
  for (const m of body.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of body.matchAll(/\b(?:const|let|var)\s*[\[{]([^\]}]*)[\]}]\s*=/g)) addList(m[1]);
  return names;
}

/**
 * [Gate 3A closure — side-effect channel] A value is produced not only by
 * `name = expr` but by every write that POPULATES it:
 *   - index/member writes INTO a local object: `mem[k] = expr`, `mem.x = expr`;
 *   - member writes ONTO a parameter path: `s.v5EvidenceThesis = expr`.
 * Without this a parameter is a laundering boundary. coreStrategyEvaluate keeps
 * persistent evidence memory on its parameter `s` across calls — one evaluation
 * writes `mem[name] = {epoch, dir}`, a later one reads it back into an age that
 * decides whether a family is still live evidence. Terminating the slice at `s`
 * "because a parameter is closed at the caller" missed both writes: the taint is
 * not in the caller's argument, it is in state the callee mutates.
 */
/**
 * [Gate 3A closure — performance] Blanking a function body is the dominant cost,
 * and producer closure asks for the same body many times per scan. Cached per
 * source string, so a mutated source never reuses a clean source's blanking.
 */
let _bcSrc = null, _bcMap = null;
function blankedBodyOf(src, ownerRange) {
  if (_bcSrc !== src) { _bcSrc = src; _bcMap = new Map(); }
  const key = `${ownerRange.bodyStart}:${ownerRange.end}`;
  let v = _bcMap.get(key);
  if (!v) { v = blankNonCode(src.slice(ownerRange.bodyStart, ownerRange.end)); _bcMap.set(key, v); }
  return v;
}

function populatingWrites(src, ownerRange, name) {
  const out = [];
  const blanked = blankedBodyOf(src, ownerRange);
  const esc = name.replace(/[$]/g, '\\$').replace(/\./g, '\\.');
  // name[...] = expr   and   name.prop = expr   (one level into the object)
  const re = new RegExp(`(^|[^\\w$.])${esc}\\s*(?:\\[[^\\]]*\\]|\\.[A-Za-z_$][\\w$]*)\\s*${ASSIGN_OP}\\s*`, 'g');
  let m;
  while ((m = re.exec(blanked))) {
    const initStart = ownerRange.bodyStart + re.lastIndex;
    const end = initializerEnd(src, initStart);
    const expression = src.slice(initStart, end).trim();
    if (expression) out.push({ expression, pos: ownerRange.bodyStart + m.index + m[1].length, populating: true });
  }
  return out;
}

function localProducers(src, ownerRange, name) {
  const out = [];
  const blanked = blankedBodyOf(src, ownerRange);
  const esc = name.replace(/[$]/g, '\\$').replace(/\./g, '\\.');
  const re = new RegExp(`(^|[^\\w$.])${esc}\\s*${ASSIGN_OP}\\s*`, 'g');
  let m;
  while ((m = re.exec(blanked))) {
    const nameAt = m.index + m[1].length;
    // skip object-literal keys and destructuring targets are not produced here
    const initStart = ownerRange.bodyStart + re.lastIndex;
    const end = initializerEnd(src, initStart);
    const expression = src.slice(initStart, end).trim();
    if (!expression) continue;
    out.push({ expression, pos: ownerRange.bodyStart + nameAt });
  }
  return out;
}

function returnedFieldValues(src, ownerRange, field) {
  const vals = [];
  for (const pr of returnRecordFields(src, ownerRange)) if (pr.name === field && !pr.spread) vals.push(pr);
  for (const pr of aliasReturnFields(src, ownerRange)) if (pr.name === field && !pr.spread) vals.push(pr);
  return vals;
}

function producerClosure(src, index, sinks, liveReachable) {
  const byName = Object.fromEntries(index.map((f) => [f.name, f]));
  const fieldOwners = new Map();              // field -> live owners whose returned record carries it
  for (const [owner, fields] of Object.entries(GATE_RETURN_SCHEMA)) {
    if (!liveReachable.has(owner)) continue;
    for (const f of fields) {
      const k = f.startsWith('extra.') ? f.slice(6) : f;
      if (!fieldOwners.has(k)) fieldOwners.set(k, new Set());
      fieldOwners.get(k).add(owner);
    }
  }
  const seenKey = new Set(sinks.map((s) => `${s.owner}|${s.expression}`));
  const visitedLocal = new Set(), visitedField = new Set();
  const added = [];
  const queue = sinks.filter((s) => liveReachable.has(s.owner) && !s.forcedReachability);
  let bounded = false;

  const addProducer = (owner, target, expression, pos, via) => {
    const key = `${owner}|${expression.replace(/\s+/g, ' ').trim()}`;
    if (seenKey.has(key)) return;
    seenKey.add(key);
    const rec = sink(`${owner}:AUTHORITY_PRODUCER_WRITE:${target}:${pos}`, owner, 'AUTHORITY_PRODUCER_WRITE', expression, pos, `produces ${target} consumed by reachable authority (${via})`);
    rec.producesFor = target;
    rec.producerVia = via;
    added.push(rec); queue.push(rec);
    if (sinks.length + added.length > PRODUCER_CLOSURE_MAX_SINKS) bounded = true;
  };

  const closeField = (fnOwner, field, via) => {
    const fk = `${fnOwner}|${field}`;
    if (visitedField.has(fk) || !byName[fnOwner]) return;
    visitedField.add(fk);
    for (const v of returnedFieldValues(src, byName[fnOwner], field)) {
      const val = (v.value || '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(val)) closeLocal(fnOwner, val, `returned field ${fnOwner}.${field}`);
      else if (val) addProducer(fnOwner, `${fnOwner}.${field}`, val, v.pos, via);
    }
  };

  const closeLocal = (owner, name, via) => {
    const lk = `${owner}|${name}`;
    if (visitedLocal.has(lk) || !byName[owner]) return;
    visitedLocal.add(lk);
    for (const pr of localProducers(src, byName[owner], name)) addProducer(owner, name, pr.expression, pr.pos, via);
    for (const pr of populatingWrites(src, byName[owner], name)) addProducer(owner, `${name}[*]`, pr.expression, pr.pos, `${via}; populating write into ${name}`);
  };

  // A member path rooted at a PARAMETER (or other bound name) is not closed at the
  // caller when the owner itself writes that path: the write is its producer.
  // Searched in the owner and in every other live owner that writes the same
  // root.path, since shared instrument state is conventionally named alike.
  // One pass over every live owner indexes every member-path write and every
  // write one level into a member path. closeParamPath then looks paths up
  // instead of rescanning every owner body for every token.
  const memberWrites = new Map();
  const pushW = (key, rec) => { if (!memberWrites.has(key)) memberWrites.set(key, []); memberWrites.get(key).push(rec); };
  for (const o of liveReachable) {
    if (!byName[o]) continue;
    for (const fr of index.filter((f) => f.name === o)) {
      const blanked = blankedBodyOf(src, fr);
      const re = new RegExp('(^|[^\\w$.])([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)+)\\s*(\\[[^\\]]*\\])?\\s*' + ASSIGN_OP + '\\s*', 'g');
      let m;
      while ((m = re.exec(blanked))) {
        const initStart = fr.bodyStart + re.lastIndex;
        const end = initializerEnd(src, initStart);
        const expression = src.slice(initStart, end).trim();
        if (!expression) continue;
        const pos = fr.bodyStart + m.index + m[1].length;
        const path = m[2];
        if (m[3]) pushW(`${path}[*]`, { owner:o, expression, pos });       // path[k] = ...
        else {
          pushW(path, { owner:o, expression, pos });                        // a.b.c = ...
          const parent = path.slice(0, path.lastIndexOf('.'));              // also populates a.b
          if (parent.includes('.') || parent) pushW(`${parent}[*]`, { owner:o, expression, pos });
        }
      }
    }
  }
  /*
   * [Gate 3A freeze] Writes to GLOBAL variables. A bare name read by live
   * authority that is neither a local nor a parameter of the reading function is
   * a module-level variable, and every assignment to it in any live function is
   * a producer of what is read. chooseTradeProfile writes selectedTradeProfiles,
   * which updateSignalState and checkSig read; that write was never inspected.
   * A function that declares the name itself (const/let/var) owns a different,
   * local variable and is excluded.
   */
  const globalWrites = new Map();
  for (const o of liveReachable) {
    for (const fr of index.filter((f) => f.name === o)) {
      const b = blankedBodyOf(src, fr);
      const declared = new Set([...b.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((x) => x[1]));
      for (const p of ownParams(src, fr)) declared.add(p);
      const re = new RegExp('(^|[^\\w$.])([A-Za-z_$][\\w$]*)\\s*' + ASSIGN_OP + '\\s*', 'g');
      let m;
      while ((m = re.exec(b))) {
        const name = m[2];
        if (declared.has(name)) continue;
        const initStart = fr.bodyStart + re.lastIndex;
        const end = initializerEnd(src, initStart);
        const expression = src.slice(initStart, end).trim();
        if (!expression) continue;
        if (!globalWrites.has(name)) globalWrites.set(name, []);
        globalWrites.get(name).push({ owner: o, expression, pos: fr.bodyStart + m.index + m[1].length });
      }
    }
  }
  const closeGlobal = (owner, name, via) => {
    const gk = `global|${name}`;
    if (visitedLocal.has(gk)) return;
    visitedLocal.add(gk);
    for (const w of globalWrites.get(name) || []) addProducer(w.owner, name, w.expression, w.pos, `${via}; write to global ${name} in ${w.owner}`);
  };

  // [Gate 3A freeze] a listener's payload parameter is produced at every live
  // emitEngine(type, payload) call site — the callers the bus hides
  const payloads = enginePayloadSites(src, index, liveReachable);
  const closeEnginePayload = (via) => {
    if (visitedLocal.has('engine|payload')) return;
    visitedLocal.add('engine|payload');
    for (const p of payloads) addProducer(p.owner, 'emitEngine.payload', p.expression, p.pos, `${via}; payload at emitEngine call in ${p.owner}`);
  };

  const visitedOrderFields = new Set();
  const closeOrderItemField = (field, via) => {
    if (visitedOrderFields.has(field)) return;
    visitedOrderFields.add(field);
    for (const p of payloads) {
      if (!/(?:^|[{,\s])item\s*(?:[,}:]|$)/.test(blankNonCode(p.expression))) continue;
      const fr = byName[p.owner];
      if (!fr) continue;
      for (const pr of localProducers(src, fr, 'item')) {
        const at = src.indexOf(pr.expression, pr.pos);
        const open = at < 0 ? -1 : at + pr.expression.search(/\{/);
        if (open < at || !pr.expression.trim().startsWith('{')) continue;
        for (const leaf of objectLiteralLeaves(src, open)) {
          if (leaf.path.split('.')[0] !== field) continue;
          addProducer(p.owner, `item.${leaf.path}`, leaf.value, leaf.pos, `${via}; field ${field} of the item record emitted by ${p.owner}`);
        }
      }
    }
  };

  const closeParamPath = (owner, path, via) => {
    const pk = `param|${path}`;
    if (visitedLocal.has(pk)) return;
    visitedLocal.add(pk);
    for (const w of memberWrites.get(path) || []) addProducer(w.owner, path, w.expression, w.pos, `${via}; write onto ${path} in ${w.owner}`);
    for (const w of memberWrites.get(`${path}[*]`) || []) addProducer(w.owner, `${path}[*]`, w.expression, w.pos, `${via}; populating write into ${path} in ${w.owner}`);
  };

  /*
   * [Gate 3A closure — callee returns] A call to a function defined in the
   * artifact was excused by name, and its body was never examined. So
   * `scale = zgB(input)` was "a known call" however zgB computed its result. The
   * producer of a consumed call's value is the callee's RETURN expression; each
   * is closed as a producer sink in the callee, recursively. The callee's own
   * parameters still terminate — soundly, because the caller's arguments are
   * inside the calling sink's expression and are checked there.
   * Record returns (`return {...}`) are already closed field-by-field.
   */
  const visitedReturns = new Set();
  const closeReturns = (fnName, via) => {
    if (visitedReturns.has(fnName) || !byName[fnName]) return;
    visitedReturns.add(fnName);
    for (const fr of index.filter((f) => f.name === fnName)) closeReturnsOf(fr, fnName, via);
  };
  const closeReturnsOf = (fr, fnName, via) => {
    const body = src.slice(fr.bodyStart, fr.end);
    const blanked = blankNonCode(body);
    const re = /\breturn\b\s*/g;
    let m;
    while ((m = re.exec(blanked))) {
      const abs = fr.bodyStart + m.index;
      const inner = index.filter((f) => f.start <= abs && abs <= f.end).sort((x, y) => (x.end - x.start) - (y.end - y.start))[0];
      if (!inner || inner.start !== fr.start) continue;            // a nested function's return
      const start = fr.bodyStart + re.lastIndex;
      if (src[start] === ';' || src[start] === '}' || src[start] === '{') continue; // bare or record return
      const end = initializerEnd(src, start);
      const expr = src.slice(start, end).trim();
      if (expr) addProducer(fnName, `${fnName}()`, expr, abs, via);
    }
  };

  while (queue.length && !bounded) {
    const s = queue.shift();
    const owner = s.owner;
    if (!byName[owner]) continue;
    // calls to artifact functions inside this sink: close what they return
    for (const cm of blankNonCode(s.expression).matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const callee = cm[1];
      if (byName[callee] && callee !== owner) closeReturns(callee, `${owner} consumes ${callee}()`);
    }
    for (const tok of dependencyTokens(s.expression)) {
      const segs = tok.replace(/\?\./g, '.').split('.');
      const base = segs[0];
      if (NOISE.has(base) && segs.length === 1) continue;
      // [Gate 3A round 7] The order builder's `item.F` was "closed at the caller",
      // but the caller chain (route(item) <- listener route(p.item) <-
      // emitEngine(SIGNAL_FIRED,{k,item})) passes `item` as a bare NOISE name, so
      // no hop ever reached checkSig's `const item = {...}`: the provenance of
      // what is actually sent stopped at the event payload. Close field F at the
      // object literal of every record emitted as an engine payload.
      if (owner === 'makeIntent' && segs[0] === 'item' && segs.length > 1) closeOrderItemField(segs[1], `makeIntent consumes ${tok}`);
      // Resolve every intermediate member prefix that is assigned from a call.
      // `result.specialist.scale`: `result` has its own local producer, but the
      // authority-relevant hop is `result.specialist = familyGate(...)`. The
      // first version only tried this when the base had NO local producer, so
      // the path into familyGate — and on to capital sizing — was never taken.
      for (let d = 2; d < segs.length; d++) {
        const prefix = segs.slice(0, d).join('.');
        for (const mp of localProducers(src, byName[owner], prefix)) {
          const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(mp.expression);
          if (call && byName[call[1]]) closeField(call[1], segs[d], `${owner}.${tok} <- ${call[1]}()`);
        }
      }
      if (segs.length > 1) for (let d = 2; d <= segs.length; d++) closeParamPath(owner, segs.slice(0, d).join('.'), `${owner} consumes ${tok}`);
      const ownerFr = index.find((f) => f.name === owner);
      if (ownerFr && ownerFr.engineListener && ownParams(src, ownerFr)[1] === base) closeEnginePayload(`${owner} consumes ${tok}`);
      const local = localProducers(src, byName[owner], base);
      if (!local.length && globalWrites.has(base)) {
        const fr0 = index.filter((f) => f.name === owner && f.start <= s.pos && s.pos <= f.end).sort((x, y) => (x.end - x.start) - (y.end - y.start))[0] || byName[owner];
        if (!boundNames(src, fr0).has(base)) closeGlobal(owner, base, `${owner} consumes global ${base}`);
      }
      if (local.length) {
        // member token rooted at a local assigned from a call: resolve the field
        // in the returning function, e.g. result.specialist = familyGate(...)
        if (segs.length > 1) {
          for (const lp of local) {
            const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(lp.expression);
            if (call && byName[call[1]]) closeField(call[1], segs[segs.length - 1], `${owner}.${tok} <- ${call[1]}()`);
          }
        }
        closeLocal(owner, base, `${owner} consumes ${tok}`);
      } else if (segs.length > 1) {
        // record member whose base is a parameter or callback argument (e.g.
        // candidate.rejectionExtreme): resolve by the field's live producer(s)
        const fld = segs[segs.length - 1];
        const owners = fieldOwners.get(fld);
        if (owners) for (const fo of owners) if (fo !== owner) closeField(fo, fld, `${owner} consumes ${tok}`);
        // also a member path rooted at a local of another shape, e.g. result.specialist.scale
        if (segs.length > 2) {
          const mid = segs.slice(0, 2).join('.');
          const midProducers = localProducers(src, byName[owner], mid);
          for (const mp of midProducers) {
            const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(mp.expression);
            if (call && byName[call[1]]) closeField(call[1], segs[segs.length - 1], `${owner}.${tok} <- ${call[1]}()`);
          }
        }
      }
    }
  }
  return { added, bounded };
}


/* ------------------------------------------------------------------------ *
 * [Gate 3A freeze] SCANNER ASSUMPTIONS, mechanically guarded.
 *
 * This is a purpose-built brownfield analyser for ONE frozen artifact, not a
 * general JavaScript analyser. Two of its simplifications are assumptions about
 * that artifact. Each is checked on every scan: it holds silently on Gate 2.2,
 * and the moment the pattern appears the scan reports an explicit
 * SCANNER_ASSUMPTION_VIOLATED defect rather than mapping around it.
 *
 * Scope, verbatim from the Gate 3A review: VALID FOR FROZEN GATE 2.2 ARTIFACT;
 * MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE. Gate 3B's typed
 * extraction must eliminate dependence on both.
 * ------------------------------------------------------------------------ */
const ASSUMPTION_SCOPE = 'VALID FOR FROZEN GATE 2.2 ARTIFACT; MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE';
const TRUSTED_METHOD_NAMES = ['some','every','filter','map','find','findIndex','includes','has','at','slice','toUpperCase','toLowerCase','startsWith','endsWith','toFixed','replace','join','reduce','get','trim','split','concat','indexOf','padStart','padEnd','toString','json'];

const SCANNER_ASSUMPTIONS = Object.freeze([
  Object.freeze({
    id: 'A1',
    statement: 'Side-effect writes are linked to reads by member path, so a renamed name for the same object breaks the link. Two forms are guarded: (a) a live function accessing one of its own parameters by member through a renamed alias (`const st = s; st.x = ...`); (b) a live function reading shared instrument state through a renamed binding (`const proposed = S[k]; ... proposed.x`) whose canonical-name writers (`s.x = ...`) are not all closed producers. Form (b) exists today in portfolioCorrelation and is safe only because each such writer is closed by another route; the guard turns that from incidental into checked.',
    scope: ASSUMPTION_SCOPE,
    guard: 'Every live function is checked for a parameter alias that is subsequently accessed by member, read or write. Scalar aliases that are never member-accessed (loop counters, direction or key strings) cannot carry a side effect and are not violations.',
  }),
  Object.freeze({
    id: 'A2',
    statement: 'No application code defines its own method under a trusted intrinsic name that is invoked from live authority. Intrinsics are trusted by method name, not by receiver type.',
    scope: ASSUMPTION_SCOPE,
    guard: 'User-defined methods carrying a trusted name are enumerated (property-accessor descriptors excluded). A violation is any such method defined inside a live function, or any such name invoked as `x.name(...)` from a reachable authority sink.',
  }),
]);

function ownParams(src, fr) {
  const pm = /\(([^()]*)\)/.exec(src.slice(fr.start, fr.bodyStart));
  return pm ? pm[1].split(',').map((x) => x.replace(/=.*/s, '').replace(/[{}\[\]\s.]/g, '')).filter((x) => /^[A-Za-z_$][\w$]*$/.test(x)) : [];
}

function assumptionViolations(src, index, liveReachable, sinks) {
  const v = [];
  const blankedAll = blankNonCode(src);
  // A1 — parameter aliased and then written through
  for (const o of liveReachable) {
    for (const fr of index.filter((f) => f.name === o)) {
      const b = blankedAll.slice(fr.bodyStart, fr.end);
      for (const p of ownParams(src, fr)) {
        const re = new RegExp(`(?:^|[^\\w$.])(?:(?:const|let|var)\\s+)?([A-Za-z_$][\\w$]*)\\s*=\\s*${p.replace(/[$]/g, '\\$')}\\s*[;,)]`, 'g');
        for (const m of b.matchAll(re)) {
          const a = m[1];
          if (a === p) continue;
          const w = new RegExp(`(?:^|[^\\w$.])${a.replace(/[$]/g, '\\$')}\\s*(?:\\.[A-Za-z_$][\\w$]*|\\[[^\\]]*\\])`);
          if (w.test(b)) v.push(`SCANNER_ASSUMPTION_VIOLATED A1: ${o} aliases parameter '${p}' as '${a}' and accesses it by member; side-effect closure links writes and reads by member path and cannot follow the renamed alias`);
        }
      }
    }
  }
  // A1 (shared state) — a member read through a RENAMED binding of shared state
  // must have every canonical-name writer closed. Shared instrument state S[...]
  // is bound as `s` in almost every live function; portfolioCorrelation binds it
  // as `proposed`. Writes and reads are linked by member path, so `proposed.x`
  // can never be linked to a write `s.x`. Today that is safe only because each
  // such write sits in a function that consumes `s` and therefore closes all of
  // its writes. This makes that dependency explicit instead of incidental.
  const stateBind = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*S\s*\[/g;
  const counts = new Map();
  const renamed = [];
  for (const o of liveReachable) {
    for (const fr of index.filter((f) => f.name === o)) {
      const b = blankedAll.slice(fr.bodyStart, fr.end);
      for (const m of b.matchAll(stateBind)) {
        counts.set(m[1], (counts.get(m[1]) || 0) + 1);
        renamed.push({ owner: o, name: m[1], fr });
      }
    }
  }
  const canonical = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (canonical) {
    const canon = canonical[0];
    const sinkPos = new Set(sinks.map((x) => `${x.owner}@${x.pos}`));
    // Producer closure de-duplicates by owner and expression, so a second write
    // with an identical value expression in the same function is folded into
    // the first. It is closed: that expression was inspected. Checking by
    // position alone misread it as unclosed (dispatch writes s.candles = ca twice).
    const norm = (e) => (e || '').replace(/\s+/g, ' ').trim();
    const sinkExpr = new Set(sinks.map((x) => `${x.owner}|${norm(x.expression)}`));
    for (const r of renamed.filter((x) => x.name !== canon)) {
      const b = blankedAll.slice(r.fr.bodyStart, r.fr.end);
      const members = new Set([...b.matchAll(new RegExp(`(?:^|[^\\w$.])${r.name}\\.([A-Za-z_$][\\w$]*)`, 'g'))].map((m) => m[1]));
      for (const mem of members) {
        for (const o of liveReachable) {
          for (const fr of index.filter((f) => f.name === o)) {
            const wb = blankedAll.slice(fr.bodyStart, fr.end);
            for (const w of wb.matchAll(new RegExp(`(^|[^\\w$.])${canon}\\.${mem}\\s*${ASSIGN_OP}`, 'g'))) {
              const pos = fr.bodyStart + w.index + w[1].length;
              const rhsStart = fr.bodyStart + w.index + w[0].length;
              const rhs = norm(src.slice(rhsStart, initializerEnd(src, rhsStart)));
              if (!sinkPos.has(`${o}@${pos}`) && !sinkExpr.has(`${o}|${rhs}`)) {
                v.push(`SCANNER_ASSUMPTION_VIOLATED A1: ${r.owner} reads shared state as '${r.name}.${mem}', but the write '${canon}.${mem} = ...' in ${o} is not a closed producer; a renamed binding cannot be linked to it`);
              }
            }
          }
        }
      }
    }
  }

  // A2 — application method under a trusted intrinsic name
  const alt = TRUSTED_METHOD_NAMES.join('|');
  const defPats = [
    new RegExp(`[{,};]\\s*(${alt})\\s*\\([^)]*\\)\\s*\\{`, 'g'),                                  // method shorthand / class method
    new RegExp(`[{,]\\s*(${alt})\\s*:\\s*(?:function\\b|\\([^)]*\\)\\s*=>|[A-Za-z_$][\\w$]*\\s*=>)`, 'g'), // property function
    new RegExp(`\\.(${alt})\\s*=\\s*(?:function\\b|\\([^)]*\\)\\s*=>)`, 'g'),                      // member-assigned function
  ];
  const userDefined = new Map();
  for (const re of defPats) {
    for (const m of blankedAll.matchAll(re)) {
      const name = m[1];
      const after = src.slice(m.index, m.index + 260), before = src.slice(Math.max(0, m.index - 160), m.index);
      // property-accessor descriptors (Object.defineProperty) are not callable methods
      if ((name === 'get') && (/enumerable|configurable/.test(after) || /defineProperty\s*\(/.test(before))) continue;
      const owner = ownerOf(index, m.index);
      if (!userDefined.has(name)) userDefined.set(name, []);
      userDefined.get(name).push(owner);
    }
  }
  for (const [name, owners] of userDefined) {
    for (const o of owners) if (liveReachable.has(o)) v.push(`SCANNER_ASSUMPTION_VIOLATED A2: application method '${name}' is defined inside live function ${o}; calls to '.${name}(...)' would be trusted as the built-in`);
    const re = new RegExp(`\\.${name}\\s*\\(`);
    for (const s of sinks) {
      if (s.reachability !== 'REACHABLE_AUTHORITY' && !liveReachable.has(s.owner)) continue;
      if (re.test(blankNonCode(s.expression))) {
        v.push(`SCANNER_ASSUMPTION_VIOLATED A2: live authority sink ${s.id} invokes '.${name}(...)', which the application also defines as its own method (in ${[...new Set(owners)].join(', ')}); the call would be trusted as the built-in`);
        break;
      }
    }
  }
  return [...new Set(v)];
}


/* ------------------------------------------------------------------------ *
 * [Gate 3A freeze] The engine event bus.
 *
 * emitEngine(type, payload) calls every function registered through
 * onEngineEvent(fn). Those listeners are anonymous and registered at page load,
 * and one of them is the actual capital trigger:
 *   SIGNAL_FIRED -> route(p.item);  CLOSED_BAR -> routeConfirmedReversal(p.k)
 * Two things were invisible. Sinks are discovered only inside NAMED functions,
 * so the listener's own condition — whether an order is routed at all — was
 * never inspected. And dynamic dispatch creates no call edge, so route()'s
 * parameter `item`, "closed at the caller", had no caller: the payload that
 * checkSig emits was never checked.
 *
 * Each registered listener becomes a named owner in the function index, with an
 * edge from emitEngine. A listener whose body invokes an authority owner is
 * itself an authority owner — it decides whether that owner runs — so every
 * condition in it is a sink. A listener's payload parameter is linked to the
 * payload argument at every live emitEngine(...) call site.
 * ------------------------------------------------------------------------ */
const ENGINE_REGISTRAR = 'onEngineEvent';
/** Names of named functions registered as listeners in the current scan. */
const ENGINE_LISTENER_NAMES = new Set();
const ENGINE_EMITTER = 'emitEngine';

function engineListenerFunctions(src) {
  const blanked = blankNonCode(src);
  const out = [];
  const re = new RegExp(`\\b${ENGINE_REGISTRAR}\\s*\\(`, 'g');
  let m, n = 0;
  while ((m = re.exec(blanked))) {
    // skip the registrar's own declaration
    if (/function\s*$/.test(blanked.slice(Math.max(0, m.index - 12), m.index))) continue;
    let i = m.index + m[0].length;
    while (i < blanked.length && /\s/.test(blanked[i])) i++;
    const start = i;
    let sigOpen = -1;
    if (blanked.startsWith('function', i)) sigOpen = blanked.indexOf('(', i);
    else if (blanked[i] === '(') sigOpen = i;
    else {
      // a NAMED function registered by reference: it is already in the index,
      // but it still needs the edge from emitEngine and owner promotion
      const ref = /^([A-Za-z_$][\w$]*)\s*[,)]/.exec(blanked.slice(i, i + 80));
      if (ref) out.push({ name: ref[1], namedRef: true });
      continue;
    }
    let d = 0, sigClose = -1;
    for (let j = sigOpen; j < blanked.length; j++) {
      if (blanked[j] === '(') d++;
      else if (blanked[j] === ')') { d--; if (d === 0) { sigClose = j; break; } }
    }
    const open = blanked.indexOf('{', sigClose);
    if (open < 0) continue;
    d = 0; let end = -1;
    for (let j = open; j < blanked.length; j++) {
      if (blanked[j] === '{') d++;
      else if (blanked[j] === '}') { d--; if (d === 0) { end = j; break; } }
    }
    if (end < 0) continue;
    out.push({ name: `engineListener_${n++}`, start, bodyStart: open + 1, end, engineListener: true });
  }
  return out;
}

const AUTHORITY_INVOKED = /\b(?:route|routeConfirmedReversal|closePosition|makeIntent|enqueueBrokerAction)\s*\(/;
function listenerIsAuthority(src, f) {
  return AUTHORITY_INVOKED.test(blankNonCode(src.slice(f.bodyStart, f.end)));
}

/** Payload argument expressions at every emitEngine(type, payload) call site. */
function enginePayloadSites(src, index, liveReachable) {
  const blanked = blankNonCode(src);
  const out = [];
  const re = new RegExp(`\\b${ENGINE_EMITTER}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(blanked))) {
    const owner = ownerOf(index, m.index);
    if (owner === ENGINE_EMITTER || !liveReachable.has(owner)) continue;
    const open = m.index + m[0].length - 1;
    let d = 0, close = -1, comma = -1;
    for (let j = open; j < blanked.length; j++) {
      const c = blanked[j];
      if (c === '(' || c === '{' || c === '[') d++;
      else if (c === ')' || c === '}' || c === ']') { d--; if (d === 0) { close = j; break; } }
      else if (c === ',' && d === 1 && comma < 0) comma = j;
    }
    if (close < 0 || comma < 0) continue;
    const expr = src.slice(comma + 1, close).trim();
    if (expr) out.push({ owner, expression: expr, pos: comma + 1 });
  }
  return out;
}

/** Discover authority sinks from live and legacy authority functions. */
function discoverSinks(src, index) {
  const sinks = [];
  const byName = Object.fromEntries(index.map((f) => [f.name, f]));
  // These are the brownfield authority surfaces discovered from the current
  // state/selection/plan/execution sinks. The field catalogue does NOT define
  // the universe: every dependency inside these sinks is discovered first and
  // must classify. Gate 3B extraction replaces this purpose-built boundary with
  // structural package boundaries.
  const owners = [
    'feedGate','familyGate','lifecycle','plan','analyze','updateSignalState','checkSig',
    'recomputeFull','updateLegacySignalState','checkLegacySig','assessTrigger','evaluateStrategy','coreStrategyEvaluate','planTradeLevels','validateFireGeometry',
    'makeIntent','route','routeConfirmedReversal','closePosition',
  ].filter((n) => byName[n]);
  const allIfAuthorityOwners = new Set(['feedGate','familyGate','lifecycle','plan','route','routeConfirmedReversal','closePosition']);
  // a listener that invokes an authority owner decides whether it runs
  for (const f of index) {
    if (f.engineListener && listenerIsAuthority(src, f)) { owners.push(f.name); allIfAuthorityOwners.add(f.name); }
  }

  const authorityAction = /(\.state\s*(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=|\.signalState\s*(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=|\.blockers\.push|reasons\.push|\bcontinue\b|executionOk\s*:|executionEligible\s*:|plannerStatus\s*:|profileConsumed\.add|histLog\.unshift|feed\.unshift|requestFreshM1\s*\(|requestHTF\s*\(|requestD1\s*\(|\/api\/broker\/(?:intent|exit-intent|close))/;
  // [Gate 3A round 7] Authority is also exercised by shapes the list above did not
  // name: removing blockers/reasons by mutation (`blockers.splice(0)`,
  // `reasons.length = 0`, `delete`), writing a gate record through
  // Object.assign, and invoking OR PASSING a broker function (`.then(route)`)
  // or emitting an event that an authority listener turns into a broker action.
  const authorityEvents = new Set();
  for (const f of index) if (f.engineListener && listenerIsAuthority(src, f)) {
    for (const m of blankNonCode(src.slice(f.bodyStart, f.end)).matchAll(/ENGINE_EVENTS\.([A-Z_]+)/g)) authorityEvents.add(m[1]);
  }
  const brokerRef = '(?<![\\w$.])(?:route|routeConfirmedReversal|closePosition|makeIntent|enqueueBrokerAction)\\b';
  const eventEmit = authorityEvents.size ? `|\\bemitEngine\\s*\\(\\s*ENGINE_EVENTS\\.(?:${[...authorityEvents].sort().join('|')})\\b` : '';
  const authorityInvoke = new RegExp(brokerRef + eventEmit);
  const collectionMutation = /(?:\b(?:blockers|reasons|candidates|lanes|evaluated|alternatives)\.(?:splice|pop|shift|unshift|fill|copyWithin|reverse)\s*\(|\b(?:blockers|reasons|candidates|lanes|evaluated)\.length\s*(?:[-+*/%&|^]|&&|\|\||\?\?)?=(?![=>])|\bdelete\s+[A-Za-z_$][\w$.]*\.(?:state|signalState|blockers|reasons|plan|candidate|executionEligible|plannerStatus|riskScale|score)\b|\bObject\.assign\s*\()/;
  // An early `return` / `break` in an authority owner decides whether the
  // evaluation, the state update or the fire happens at all for this instrument
  // (`if(!s||!s.price)return;`, `if(!candidates.length){...return base;}`), so
  // the guard in front of it is authority exactly like a `continue`.
  const earlyExit = /^\s*\{?\s*(?:[^;{}]*;\s*)*(?:return\b|break\b)|^\s*\{[\s\S]*\b(?:return|break)\b[^;]*;\s*\}?\s*$/;
  const isAuthorityAction = (txt) => authorityAction.test(txt) || authorityInvoke.test(blankNonCode(txt)) || collectionMutation.test(blankNonCode(txt)) || earlyExit.test(blankNonCode(txt));

  for (const owner of owners) {
    const f = byName[owner];
    const conds = ifConditions(src, f);
    let seq = 0;
    for (const c of conds) {
      if (isAuthorityAction(c.consequence) || allIfAuthorityOwners.has(owner)) {
        sinks.push(sink(`${owner}:if:${++seq}`, owner, 'CONDITIONAL_AUTHORITY', c.condition, c.pos, c.consequence));
      }
    }

    const body = src.slice(f.bodyStart, f.end);
    for (const method of ['sort','filter']) {
      const re = new RegExp(`\\.${method}\\s*\\(`, 'g'); let m;
      while ((m = re.exec(body))) {
        const abs = f.bodyStart + m.index;
        const arg = extractArrowArgument(src, abs + m[0].indexOf('(') - 1);
        sinks.push(sink(`${owner}:${method}:${abs}`, owner, method === 'sort' ? 'SELECTION' : 'FILTER', arg, abs));
      }
    }

    // Direct authority-producing assignments/object fields that do not need an if.
    const directPatterns = [
      { kind:'STATE_WRITE', re:/\b(?:result|lane|best|s)\.(?:state|signalState)\s*(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=\s*([^;]+)/g },
      { kind:'SCORE_WRITE', re:/\bresult\.score\s*(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=\s*([^;]+)/g },
      { kind:'RISK_SCALE_WRITE', re:/\bresult\.riskScale\s*(?:\*\*|<<|>>>|>>|&&|\|\||\?\?|[-+*/%&|^])?=\s*([^;]+)/g },
      { kind:'CONTEXT_GATE_WRITE', re:/\bresult\.context\s*=\s*\{([^;]+)\}/g },
      { kind:'PLAN_VERDICT_WRITE', re:/\breturn\s*\{[^;]{0,1200}?plannerStatus\s*:\s*([^,}]+)[^;]{0,1200}?executionEligible\s*:\s*([^,}]+)/g },
      { kind:'EXECUTION_OK_WRITE', re:/\bexecutionOk\s*:\s*/g, valueAt:true },
      { kind:'DATA_REQUEST_GATE', re:/\bif\s*\(([^)]*strategyPreview\.score[^)]*)\)\s*\{?\s*requestHTF/g },
      { kind:'BROKER_RISK_INTENT', re:/\briskFraction\s*:\s*/g, valueAt:true },
      { kind:'BROKER_DATA_INTENT', re:/\bdataExecutionOk\s*:\s*/g, valueAt:true },
      { kind:'BROKER_PERMISSION_INTENT', re:/\b(?:tradePermission|calibrationOk)\s*:\s*/g, valueAt:true },
      { kind:'LEGACY_PERMISSION_ASSERTION', re:/\b(?:riskCanOpen|executionPermission)\s*:\s*/g, valueAt:true, forcedCanonical:'LEGACY_EXECUTION_PERMISSION_ASSERTION' },
      { kind:'BROKER_ENTRY_SUBMISSION', re:/\bapi\(\s*['"]\/api\/broker\/intent['"]\s*,\s*\{intent\s*:\s*makeIntent\(item\)\}\s*\)/g, forcedCanonical:'BROKER_SUBMISSION' },
      { kind:'BROKER_EXIT_SUBMISSION', re:/\bapi\(\s*['"]\/api\/broker\/exit-intent['"]/g, forcedCanonical:'BROKER_SUBMISSION' },
      { kind:'BROKER_CLOSE_SUBMISSION', re:/\bapi\(\s*['"]\/api\/broker\/close['"]/g, forcedCanonical:'BROKER_SUBMISSION' },
    ];
    for (const p of directPatterns) {
      let m;
      while ((m = p.re.exec(body))) {
        const abs = f.bodyStart + m.index;
        // [Gate 3A round 7] `key: value` sinks were read with ([^,}]+), which
        // stops at the FIRST comma or brace — including one inside a nested call.
        // riskFraction was recorded as `(...)*Math.min(1` and everything after the
        // comma (the risk scale, or any multiplier appended to it) was invisible.
        const expr = p.valueAt
          ? src.slice(f.bodyStart + p.re.lastIndex, initializerEnd(src, f.bodyStart + p.re.lastIndex)).trim() || p.kind
          : (m.slice(1).filter(Boolean).join(' && ') || p.kind);
        const rec = sink(`${owner}:${p.kind}:${abs}`, owner, p.kind, expr, abs);
        if (p.forcedCanonical) rec.forcedCanonical = p.forcedCanonical;
        if (p.kind === 'BROKER_DATA_INTENT' && owner === 'routeConfirmedReversal' && /^true$/.test(expr.trim())) rec.forcedCanonical = 'RISK_REDUCING_DATA_BYPASS';
        sinks.push(rec);
      }
    }
  }
  // [Gate 3A round 7] Statement-level authority shapes inside authority owners.
  //  - COLLECTION_MUTATION: a statement that removes or rewrites gate evidence by
  //    mutation, e.g. `cond && result.blockers.splice(0)`; the whole statement is
  //    the sink, so a guard written as `&&` instead of `if` is still closed.
  //  - BROKER_ORDER_FIELD: every field of the order the browser sends to the
  //    broker. Only riskFraction/data/permission fields were sinks, so the
  //    entry, stopLoss, takeProfit, side and instrument actually submitted were
  //    not: `stopLoss: Number(levels.stop) * fudge` was invisible.
  for (const owner of owners) {
    const f = byName[owner];
    const bodyB = blankNonCode(src.slice(f.bodyStart, f.end));
    const mutRe = new RegExp(collectionMutation.source, 'g');
    let mm;
    while ((mm = mutRe.exec(bodyB))) {
      const at = f.bodyStart + mm.index;
      const stStart = statementStart(src, f, at), stEnd = statementEnd(src, at);
      // Object.assign: the returned-alias pass already closes the authority
      // fields it writes (3A-34) and deliberately leaves text fields out, so
      // only the GUARD in front of it (`cond && Object.assign(...)`) is the sink.
      const isAssign = /^Object\.assign/.test(mm[0]);
      const expr = (isAssign ? src.slice(stStart, at) : src.slice(stStart, Math.min(stEnd, stStart + 900))).trim();
      if (expr) sinks.push(sink(`${owner}:COLLECTION_MUTATION:${at}`, owner, 'COLLECTION_MUTATION', expr, at, isAssign ? 'guards an Object.assign onto a gate record' : 'mutates gate evidence'));
    }
    if (owner === 'makeIntent') {
      for (const pr of returnRecordFields(src, f)) {
        if (pr.spread) continue;
        const rec = sink(`${owner}:BROKER_ORDER_FIELD:${pr.name}:${pr.pos}`, owner, 'BROKER_ORDER_FIELD', pr.value, pr.pos, `broker order field ${pr.name}`);
        rec.verdictTarget = `order.${pr.name}`;
        sinks.push(rec);
      }
    }
    const apiRe = /\bapi\s*\(\s*['"]\/api\/broker\/(?:intent|exit-intent|close)['"]\s*,\s*\{/g;
    const rawBody = src.slice(f.bodyStart, f.end);
    let am;
    while ((am = apiRe.exec(rawBody))) {
      for (const leaf of objectLiteralLeaves(src, f.bodyStart + am.index + am[0].length - 1)) {
        if (/^makeIntent\s*\(/.test(leaf.value)) continue;   // closed through makeIntent's own order fields
        const rec = sink(`${owner}:BROKER_ORDER_FIELD:${leaf.path}:${leaf.pos}`, owner, 'BROKER_ORDER_FIELD', leaf.value, leaf.pos, `broker order field ${leaf.path}`);
        rec.verdictTarget = `order.${leaf.path}`;
        sinks.push(rec);
      }
    }
  }
  // [Gate 3A round 7] A conditional in ANY function that invokes or passes a
  // broker function, or emits an event an authority listener acts on, decides
  // whether that action happens. Discovery was limited to a fixed owner list,
  // so such a guard elsewhere was not a sink at all. Reachability still decides
  // whether it is live authority.
  const ownerSet = new Set(owners);
  for (const f of index) {
    if (ownerSet.has(f.name) || f.name === ENGINE_EMITTER || f.name === ENGINE_REGISTRAR) continue;
    let seq = 0;
    for (const c of ifConditions(src, f)) {
      if (!authorityInvoke.test(blankNonCode(c.consequence))) continue;
      const rec = sink(`${f.name}:if-invoke:${++seq}`, f.name, 'CONDITIONAL_AUTHORITY', c.condition, c.pos, c.consequence);
      rec.discoveredBy = 'BROKER_INVOCATION_GUARD';
      sinks.push(rec);
    }
  }

  // Verdict writes are first-class authority sinks. Any local variable whose
  // value is consumed by an already-discovered state/selection/plan/execution
  // sink gets its initializer audited too. Repeat to a fixed point so a verdict
  // alias cannot hide another layer upstream.
  const verdictOwners = [...new Set([...owners, ...Object.keys(MANDATORY_VERDICT_META).filter((n) => byName[n])])];
  for (const owner of verdictOwners) {
    const f = byName[owner];
    const writes = assignmentWrites(src, f);
    const added = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      const evidenceText = sinks.filter((s) => s.owner === owner).map((s) => `${s.expression} ${s.consequence || ''}`).join('\n');
      for (const w of writes) {
        if (!looksLikeVerdictWrite(w)) continue;
        const bare = (w.targetKind === 'BARE' || w.targetKind === 'BARE_REASSIGN') ? w.target : w.target.split('.').at(-1);
        const targetRe = new RegExp(`\\b${bare.replace(/[$]/g,'\\$')}\\b`);
        const propertyAuthority = w.targetKind === 'MEMBER' && /\.(?:state|signalState|executionEligible|executionOk|plannerStatus|riskScale|score|calibrationOk|tradePermission|riskCanOpen|executionPermission)$/.test(w.target);
        const mandatoryMeta = MANDATORY_VERDICT_META[owner]?.[bare] || null;
        const reassignOfTrackedVerdict = w.targetKind === 'BARE_REASSIGN' && writes.some((x) => x.targetKind === 'BARE' && x.target === w.target);
        if (!mandatoryMeta && !propertyAuthority && !reassignOfTrackedVerdict && !targetRe.test(evidenceText)) continue;
        const key = `${w.target}|${w.pos}`;
        if (added.has(key)) continue;
        const rec = sink(`${owner}:VERDICT_WRITE:${w.target}:${w.pos}`, owner, 'VERDICT_WRITE', w.expression, w.pos, `writes ${w.target}`);
        rec.verdictTarget = w.target;
        rec.writeForm = w.targetKind;
        if (mandatoryMeta?.canonical) rec.forcedCanonical = mandatoryMeta.canonical;
        if (mandatoryMeta?.reachability) rec.forcedReachability = mandatoryMeta.reachability;
        sinks.push(rec);
        added.add(key);
        changed = true;
      }
    }
  }

  // [Gate 3A closure] Returned gate records. Every top-level property of a
  // `return {...}` in an authority owner is recorded; verdict-shaped properties
  // become GATE_FIELD_WRITE sinks whose value dependencies must close, and the
  // full property-name set is exposed so scanSource can hold it to the frozen
  // GATE_RETURN_SCHEMA. A new field on a live gate is then a defect even when
  // its name does not look like a verdict.
  gateReturnFields.clear();
  for (const owner of owners) {
    const f = byName[owner];
    const literalProps = returnRecordFields(src, f);
    const aliasProps = aliasReturnFields(src, f);
    const props = [...literalProps, ...aliasProps];
    if (!props.length) continue;
    gateReturnFields.set(owner, new Set(props.map((x) => x.name)));
    for (const pr of props) {
      if (pr.spread) continue;
      // Every field of a returned alias is part of the gate's returned record, so
      // EVERY field is schema-frozen (an addition is always a defect, via
      // gateReturnFields above). But only AUTHORITY-bearing fields are
      // dependency-closed as sinks. Closing every field would drag human-readable
      // `reason` text and counterfactual `alternatives` lists into authority —
      // the false-positive surface this scanner deliberately avoids. A lifecycle
      // stage is set by `c.stage = ...`, not by a verdict-named local, so the
      // authority set is named explicitly rather than inferred from suffixes.
      const ALIAS_AUTHORITY = /^(?:stage|state|signalState|triggerAt|triggerFresh|invalidatedAt|expiresAt|executionEligible|executionOk|plannerStatus|riskScale|score|ok|coreOk)$/;
      const aliasForm = pr.form === 'ALIAS_MEMBER_WRITE' || pr.form === 'ALIAS_ASSIGN';
      if (aliasForm && !(ALIAS_AUTHORITY.test(pr.name) || looksLikeVerdictWrite({ targetKind:'BARE', target:pr.name }))) continue;
      if (aliasForm) {
        const rec = sink(`${owner}:GATE_FIELD_WRITE:${pr.alias}.${pr.name}:${pr.pos}`, owner, 'GATE_FIELD_WRITE', pr.value, pr.pos, `writes returned ${pr.alias}.${pr.name}`);
        rec.verdictTarget = `return.${pr.alias}.${pr.name}`;
        rec.writeForm = pr.form;
        sinks.push(rec);
        continue;
      }
      const verdictShaped = looksLikeVerdictWrite({ targetKind:'BARE', target:pr.name }) ||
        /^(?:state|signalState|executionEligible|executionOk|plannerStatus|riskScale|score|calibrationOk|tradePermission|riskCanOpen|executionPermission|ok|status)$/.test(pr.name);
      if (!verdictShaped) continue;
      const rec = sink(`${owner}:GATE_FIELD_WRITE:${pr.name}:${pr.pos}`, owner, 'GATE_FIELD_WRITE', pr.value, pr.pos, `returns ${pr.name}`);
      rec.verdictTarget = `return.${pr.name}`;
      rec.writeForm = pr.shorthand ? 'RETURN_SHORTHAND' : 'RETURN_PROPERTY';
      sinks.push(rec);
    }
  }

  // [Gate 3A closure] freeze the seed record at its producer
  if (byName.seeds) {
    const sk = seedRecordFields(src, byName.seeds);
    if (sk.size) gateReturnFields.set('seeds', sk);
  }

  // Deduplicate exact owner/kind/expression records.
  const seen = new Set();
  return sinks.filter((s) => { const k = `${s.owner}|${s.kind}|${s.expression}`; if (seen.has(k)) return false; seen.add(k); return true; });
}


function trustedCallToken(token) {
  // [Gate 3A closure] pure formatting/aggregation intrinsics added: toFixed,
  // replace, join, reduce, get (Map.get), trim, split, concat, indexOf, pad*.
  // Also deterministic serialization/copy (JSON.*, structuredClone, Object.assign),
  // the mandated canonical time service (__TS.now/__TS.date — the engineering
  // standard forbids any other clock), and browser->server transport (fetch,
  // response.json). Transport is trusted because WHAT is sent is closed
  // separately through makeIntent, and server behaviour is Gate 4.
  return /^(?:Math\.(?:min|max|abs|floor|round|ceil|log|sign|sqrt|exp|pow|hypot|trunc)|Number\.isFinite|Number\.isInteger|parseFloat|parseInt|Number|Boolean|Date\.now|String|JSON\.(?:stringify|parse)|structuredClone|__TS\.(?:now|date)|fetch|response\.json|Object\.(?:values|keys|entries|fromEntries|assign)|Array\.isArray|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.(?:some|every|filter|map|find|findIndex|includes|has|at|slice|toUpperCase|toLowerCase|startsWith|endsWith|toFixed|replace|join|reduce|get|trim|split|concat|indexOf|padStart|padEnd|toString))$/.test(token);
}


function buildVerdictAudit(code, index, sinks) {
  const specs = [
    ['readyOk', /\bconst\s+readyOk\s*=/g, 'AUTHORITY_VERDICT_UNREACHABLE_LEGACY'],
    ['fireOk', /\bconst\s+fireOk\s*=/g, 'AUTHORITY_VERDICT_UNREACHABLE_LEGACY'],
    ['executionEligible', /\bp\.executionEligible\s*=/g, 'AUTHORITY_VERDICT_REACHABLE'],
    ['econOk', /\bconst\s+econOk\s*=/g, 'RENDERER_ONLY'],
    ['thesisOk', /\bconst\s+thesisOk\s*=/g, 'RENDERER_ONLY'],
    ['runwayOk', /\bconst\s+runwayOk\s*=/g, 'AUTHORITY_OR_PLAN_VERDICT'],
    ['stopGeometryOk', /\bconst\s+stopGeometryOk\s*=/g, 'AUTHORITY_VERDICT_REACHABLE'],
    ['coreOk', /\bconst\s+coreOk\s*=/g, 'LEGACY_DATA_HEALTH_VERDICT'],
    ['regimeOk', /\bconst\s+regimeOk\s*=/g, 'RAW_MODEL_FEATURE_VERDICT'],
    ['priceValid', /\bconst\s+priceValid\s*=/g, 'LOGGING_OUTCOME_ONLY'],
    ['directEligible', /\bconst\s+directEligible\s*=/g, 'RESEARCH_ONLY'],
    ['allValid', /\bconst\s+allValid\s*=/g, 'PRESENTATION_AGGREGATION_ONLY'],
  ];
  const rows=[];
  for (const [name,re,disposition] of specs) {
    let m;
    while ((m=re.exec(code))) {
      const owner=ownerOf(index,m.index), suffix=(t)=>t===name||t.endsWith('.'+name);
      const covered=sinks.some((s)=>s.kind==='VERDICT_WRITE'&&s.owner===owner&&suffix(s.verdictTarget||''));
      rows.push({name,owner,pos:m.index,disposition,sinkCovered:covered});
    }
  }
  return rows;
}

/* ------------------------------------------------------------------------ *
 * [Gate 3A round 7] FROZEN DEPENDENCY VOCABULARY.
 *
 * Whether a live sink's dependency was "classified" was decided by patterns, and
 * several patterns accept a token without the token ever having been reviewed:
 *   - the global table matches SUBSTRINGS: any new field containing `stop`,
 *     `risk` or `target`, ending in `.score`, etc. silently inherited an
 *     existing classification (`candidate.targetBias` became TARGET_GEOMETRY);
 *   - every bare UPPER_CASE name was excused (`&& SECRET_SWITCH` gated READY);
 *   - a member path rooted at a callee's parameter terminated the slice, so a
 *     helper reading a new field of its argument was invisible;
 *   - bare names on the NOISE list (`value`, `known`, `state`, ...) were dropped.
 * The fix freezes what the clean artifact accepts. Every (owner, token) that a
 * live authority sink accepts is recorded with HOW it was accepted; the set
 * computed on the cleared Gate 2.2 artifact is stored in
 * gate3-dependency-vocabulary.json and published for review. A scan that
 * accepts a pair outside that set — or accepts a known pair by a different
 * rule or into a different class — reports a defect. Nothing new enters live
 * authority without appearing in a diff of a reviewed file.
 * ------------------------------------------------------------------------ */
const VOCABULARY_PATH = path.join(__dirname, 'gate3-dependency-vocabulary.json');
const VOCAB_KEYWORDS = new Set(['if','else','return','continue','break','function','true','false','null','undefined','Infinity','NaN','const','let','var','new','this','typeof','in','of','await','async','void','delete','instanceof','Math','Number','Array','Object','Set','Map','Date','String','Boolean','JSON','Intl']);
function loadFrozenVocabulary(file = VOCABULARY_PATH) {
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  // a pair can legitimately be accepted by more than one rule (two inner
  // functions of one owner, or forced sinks of different targets), so each
  // frozen pair maps to the SET of dispositions seen on the cleared artifact
  return new Map(doc.entries.map(([owner, token, dispositions]) => [`${owner}\u0000${token}`, new Set([].concat(dispositions))]));
}
let FROZEN_VOCABULARY = loadFrozenVocabulary();
function vocabularyDocument(observed, artifactSha) {
  const entries = [...observed.entries()].map(([k, d]) => { const [owner, token] = k.split('\u0000'); return [owner, token, [...d].sort()]; })
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return { schema:'zugrio.gate3-dependency-vocabulary/1', artifactSha256:artifactSha, scope:'VALID FOR FROZEN GATE 2.2 ARTIFACT; MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE',
    rule:'Every (owner, token) accepted by a REACHABLE_AUTHORITY sink, with the rule that accepted it. A scan accepting a pair outside this set, or by a different rule, is an inventory defect.',
    entries };
}
/** Bare names the tokenizer drops as NOISE although they may be real variables. */
function noiseDroppedTokens(expression) {
  const scrub = blankObjectKeys(blankRegexLiterals(blankNonCode(expression))).replace(/\b(?:BUY|SELL|WATCH|READY|FIRE|NO_TRADE|EXPIRED|INVALIDATED|VALID|BLOCKED)\b/g, ' ');
  const members = [...scrub.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*(?:\?\.|\.)[A-Za-z_$][\w$]*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)*/g)].map((m) => m[0]);
  const memberSegments = new Set(members.flatMap((m) => m.split(/\?\.|\./)));
  return uniq([...scrub.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*\b/g)].map((m) => m[0])
    .filter((x) => NOISE.has(x) && !VOCAB_KEYWORDS.has(x) && !memberSegments.has(x)));
}

/* ---------------------------------------------------------------------------
 * [Gate 3A round 8] Frozen authority baseline.
 *
 * The vocabulary answers "has this (owner, token) been accepted before?". It
 * cannot see an accepted dependency replaced by another accepted one
 * (V5_THRESH.ready -> V5_THRESH.fire), a conjunct deleted, a stop/target swap
 * between two order fields, or a threshold literal changed: round 7 reported
 * all of those clean. The baseline signs every REACHABLE_AUTHORITY sink
 * (owner, kind, expression, whole consequence, dependency -> canonical list,
 * numeric literals) and fingerprints the code-only body of every function
 * that owns one. Any difference from the frozen baseline is a defect:
 *
 *   AUTHORITY_BASELINE_DRIFT  a sink was removed, added or changed — localised
 *   AUTHORITY_OWNER_DRIFT     an authority function's body changed
 *
 * An owner drift with no sink drift in that owner means the edit landed in
 * authority code that no inventoried sink covers: a sink-coverage gap, which
 * the mutation battery reports separately.
 *
 * What the baseline does NOT prove: that the frozen dependency at a sink is
 * the semantically correct one. It binds the inventory to the exact cleared
 * code; correctness against the frozen Signal Authority specification is the
 * §14A/§14B/§14C classification work of Gate 3.1–3.3.
 * ------------------------------------------------------------------------ */
const BASELINE_PATH = path.join(__dirname, 'gate3-authority-baseline.json');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
/**
 * Canonical code-only form: comments removed, whitespace dropped except where
 * it separates two identifier characters; string, template and regex literal
 * contents are kept verbatim. Two sources that differ only in comments or
 * layout have the same canonical form, so the baseline does not drift on a
 * reformat, while any token, literal or operator change still changes it.
 */
function canonicalCode(raw) {
  const kinds = new Array(raw.length).fill('');
  blankNonCodeUncached(raw, kinds);
  let out = '', pendingSpace = false, pendingNewline = false;
  const word = (c) => /[\w$]/.test(c || '');
  // Automatic semicolon insertion makes a line break significant in the
  // restricted productions: after return/break/continue/throw/yield/async and
  // before a prefix ++/--. `return\nx` returns undefined; `return x` returns x.
  // A line break is kept (as \n) exactly there and dropped everywhere else.
  const RESTRICTED = /(?:^|[^\w$])(?:return|break|continue|throw|yield|async)$/;
  const flush = (c, next) => {
    if (pendingNewline && (RESTRICTED.test(out) || ((c === '+' || c === '-') && next === c))) out += '\n';
    else if (pendingSpace && out.length && ((word(out[out.length - 1]) && word(c)) || ('+-'.includes(c) && out[out.length - 1] === c))) out += ' ';
    pendingSpace = pendingNewline = false;
  };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i], k = kinds[i];
    if (k === 'C') { pendingSpace = true; if (raw[i] === '\n') pendingNewline = true; continue; }
    if (k === 'L') { if (pendingNewline && RESTRICTED.test(out)) out += '\n'; else if (pendingSpace && word(out[out.length - 1]) && word(c)) out += ' '; pendingSpace = pendingNewline = false; out += c; continue; }
    if (/\s/.test(c)) { pendingSpace = true; if (c === '\n') pendingNewline = true; continue; }
    flush(c, raw[i + 1]);
    out += c;
  }
  return out;
}
/**
 * [Gate 3A round 8] Leaves of every Object.assign in an authority function.
 * Round 7 made only an Object.assign's guard an inventory sink (its leaves are
 * display/legacy-scoring fields on Gate 2.2, and mapping them would mean
 * inventing classifications). The leaves are still signed here, unclassified,
 * so a substitution inside one is localised instead of surfacing only as an
 * owner-fingerprint change. A non-literal source (Object.assign(t, patch)) is
 * signed as the whole call. Classification is Gate 3.1 work (§14A).
 */
function objectAssignLeaves(code, index, owner) {
  const blanked = blankNonCode(code), out = [];
  for (const f of index.filter((x) => x.name === owner)) {
    const re = /\bObject\.assign\s*\(/g; re.lastIndex = f.bodyStart;
    let m;
    while ((m = re.exec(blanked)) && m.index < f.end) {
      if (ownerOf(index, m.index) !== owner) continue;
      const open = m.index + m[0].length - 1, close = findBalanced(blanked, open);
      if (close < 0) continue;
      const args = []; let d = 0, a = open + 1;
      for (let i = open + 1; i < close; i++) { const c = blanked[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ',' && d === 0) { args.push([a, i]); a = i + 1; } }
      args.push([a, close]);
      const target = canonicalCode(code.slice(args[0][0], args[0][1]));
      for (const [x, z] of args.slice(1)) {
        const lead = x + blanked.slice(x, z).search(/\S/);
        if (blanked[lead] === '{') for (const l of objectLiteralLeaves(code, lead)) out.push({ owner, kind: 'OBJECT_ASSIGN_LEAF', expression: `${target}.${l.path}=${canonicalCode(l.value)}` });
        else out.push({ owner, kind: 'OBJECT_ASSIGN_SOURCE', expression: `Object.assign(${target},${canonicalCode(code.slice(x, z))})` });
      }
    }
  }
  return out;
}
function numericLiterals(expression) {
  const code = blankRegexLiterals(blankNonCode(expression));
  return [...code.matchAll(/(?<![\w$.])(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?![\w$])/gi)].map((m) => m[0]);
}
/* ---------------------------------------------------------------------------
 * [Gate 3A round 9] Top-level producer closure.
 *
 * Round 8 bound every live sink and every function owning one, but not the
 * module-scope values those functions read. ASSET_PROFILES, TTI_GEOMETRY,
 * V5_THRESH, PROFILES, SECONDS … are accepted dependencies (UPPER_CONSTANT or
 * canonical) whose CONTENTS were outside the baseline: a profile's direction or
 * a geometry threshold could change while every consumer expression and owner
 * stayed byte-identical (the independent review of round 8, finding R8-01).
 *
 * The producer closure, to a fixed point:
 *   seeds      every module-scope binding or function that a live sink's
 *              expression or consequence reads (what flows into a decision —
 *              not every function an authority owner happens to call);
 *   binding    a top-level const/let/var: its declarator, plus every top-level
 *              statement that writes it (N=, N.x=, N[k]=, N.push(…),
 *              Object.assign(N,…), delete N.x);
 *   function   a top-level function referenced by a producer: its body;
 *   writer     any function that writes a producer binding (module-scope
 *              mutable state): its body is fingerprinted whole;
 *   and every module-scope name read by a declarator, a top-level write, a
 *   producer function body or a writer's write statement joins the closure.
 * Each producer is fingerprinted in canonical code form. Its drift is
 * AUTHORITY_PRODUCER_DRIFT naming the producer. The closure is not the whole
 * script: only what live authority code can reach by name.
 * ------------------------------------------------------------------------ */
function topLevelProducerClosure(code, index, ownerNames, authoritySinks = []) {
  const b = blankNonCode(code), keyless = blankObjectKeys(b), n = b.length;
  // brace depth before every position, on code-only text
  const depth = new Int32Array(n + 1);
  for (let i = 0, d = 0; i < n; i++) { depth[i] = d; if (b[i] === '{') d++; else if (b[i] === '}') d--; }
  // module scopes: the script itself, and the body of every IIFE opened directly
  // in a module scope (`(function(){…})()`, `const X=(()=>{…})()`), recursively
  const scopes = [{ a: 0, z: n, depth: 0 }];
  const inner = (pos) => { let best = scopes[0]; for (const sc of scopes) if (sc.a <= pos && pos < sc.z && sc.depth >= best.depth) best = sc; return best; };
  for (const m of b.matchAll(/\(\s*(?:async\s*)?(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{/g)) {
    const o = m.index + m[0].length - 1;
    const sc = inner(o);
    if (depth[o] !== sc.depth) continue;
    const z = findBalanced(b, o, '{', '}');
    if (z > o) { scopes.push({ a: o + 1, z, depth: sc.depth + 1 }); scopes.sort((x, y) => x.a - y.a); }
  }
  // declarations at module depth, declarator by declarator
  const decls = new Map();   // key `${scopeStart}:${name}` -> { name, scope, segs }
  const declare = (sc, name, seg) => { const k = `${sc.a}:${name}`; if (!decls.has(k)) decls.set(k, { name, scope: sc, segs: [] }); if (seg) decls.get(k).segs.push(seg); return decls.get(k); };
  for (const m of b.matchAll(/(?<![\w$.])(?:const|let|var)\s+/g)) {
    const sc = inner(m.index);
    if (depth[m.index] !== sc.depth || /\bfor\s*\(\s*$/.test(b.slice(Math.max(0, m.index - 12), m.index))) continue;
    let i = m.index + m[0].length;
    for (;;) {
      while (/\s/.test(b[i])) i++;
      let names = [], a0 = i;
      if (b[i] === '{' || b[i] === '[') { const z = findBalanced(b, i, b[i], b[i] === '{' ? '}' : ']'); if (z < 0) break; names = blankObjectKeys(b.slice(i, z + 1)).match(/[A-Za-z_$][\w$]*/g) || []; i = z + 1; }
      else { const id = /^[A-Za-z_$][\w$]*/.exec(b.slice(i, i + 200)); if (!id) break; names = [id[0]]; i += id[0].length; }
      while (/\s/.test(b[i])) i++;
      let end = i;
      if (b[i] === '=' && b[i + 1] !== '=') { end = initializerEnd(b, i + 1); i = end; }
      for (const nm of names) declare(sc, nm, [a0, end]);
      while (/\s/.test(b[i])) i++;
      if (b[i] === ',') { i++; continue; }
      break;
    }
  }
  // functions declared at module depth
  const fnDecl = new Map();  // key -> [ranges]
  for (const f of index) {
    const kw = f.start + (b.slice(f.start, f.bodyStart).search(/\S/));
    const sc = inner(kw);
    if (depth[kw] !== sc.depth) continue;
    const k = `${sc.a}:${f.name}`;
    declare(sc, f.name, null);
    if (!fnDecl.has(k)) fnDecl.set(k, []);
    fnDecl.get(k).push(f);
  }
  // resolve an occurrence to the innermost module scope that declares the name
  const byName = new Map();
  for (const [k, d] of decls) { if (!byName.has(d.name)) byName.set(d.name, []); byName.get(d.name).push(k); }
  const resolve = (name, pos) => { const ks = byName.get(name); if (!ks) return null; let best = null; for (const k of ks) { const sc = decls.get(k).scope; if (sc.a <= pos && pos < sc.z && (!best || sc.depth > decls.get(best).scope.depth)) best = k; } return best; };
  // A call statement whose result is discarded (`renderFeed();`, `if(x)toast(m)`,
  // `await refresh(false);`) is an effect, not a producer: its callee does not
  // join the closure through it. A call whose value is used stays a producer.
  const effectCall = (pos, name) => {
    if (!/^\s*\(/.test(keyless.slice(pos + name.length, pos + name.length + 8))) return false;
    const before = keyless.slice(Math.max(0, pos - 80), pos).replace(/(?:\b(?:await|void)\s*)+$/, '');
    if (!/(?:^|[;{}]|\belse|\)|:)\s*$/.test(before)) return false;
    // `cond ? a() : b()` and object values `k: f()` are used values, not statements
    if (/:\s*$/.test(before) && !/\bcase\b[^;{}]*:\s*$|\bdefault\s*:\s*$/.test(before)) return false;
    if (/\)\s*$/.test(before) && !/\b(?:if|for|while)\s*\([^;{}]*\)\s*$/.test(before)) return false;
    const close = findBalanced(keyless, pos + name.length + keyless.slice(pos + name.length).search(/\(/));
    return close > 0 && /^\s*(?:[;}\n]|$)/.test(keyless.slice(close + 1, close + 3));
  };
  const refs = (a, z) => { const out = new Set(); for (const x of keyless.slice(a, z).matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g)) { const pos = a + x.index; if (effectCall(pos, x[0])) continue; const k = resolve(x[0], pos); if (k) out.add(k); } return out; };
  const occ = new Map();
  for (const x of keyless.matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g)) { if (!byName.has(x[0])) continue; const k = resolve(x[0], x.index); if (!k) continue; if (!occ.has(k)) occ.set(k, []); occ.get(k).push(x.index); }
  const fnAt = (pos) => { let best = null; for (const f of index) if (f.start <= pos && pos <= f.end && (!best || f.end - f.start < best.end - best.start)) best = f; return best; };
  // start of the statement containing pos: back to a `;`, `}` or block `{` at
  // depth 0 — an unmatched `(` / `[` is a call or index the occurrence sits
  // inside, so the scan continues through it (stopping there made the forward
  // scan start inside parentheses and run to the end of the file)
  const stmtStart = (pos) => { let d = 0; for (let i = pos - 1; i >= 0; i--) { const c = b[i]; if (c === ')' || c === ']') d++; else if (c === '}') { if (d === 0) return i + 1; d++; } else if (c === '(' || c === '[') { if (d > 0) d--; } else if (c === '{') { if (d === 0) return i + 1; d--; } else if (c === ';' && d === 0) return i + 1; } return 0; };
  const stmtRange = (pos) => { const a0 = stmtStart(pos), sc = inner(pos); return [a0, Math.min(statementEnd(b, a0), sc.z)]; };
  const WRITE_AFTER = new RegExp(`^(?:\\s*(?:\\??\\.[A-Za-z_$][\\w$]*|\\[[^\\]]*\\]))*\\s*(?:${ASSIGN_OP}|\\.(?:push|splice|pop|shift|unshift|set|add|delete|clear|fill|sort|reverse|copyWithin)\\s*\\()`);
  const isWrite = (name, pos) => {
    if (WRITE_AFTER.test(b.slice(pos + name.length, pos + name.length + 300))) return true;
    const before = b.slice(Math.max(0, pos - 40), pos);
    return /Object\.assign\(\s*$/.test(before) || /\bdelete\s+$/.test(before) || /(?:\+\+|--)\s*$/.test(before);
  };
  const producers = new Map();
  const NON_MUTATING = /^(?:freeze|isFrozen|stringify|keys|values|entries|isArray|String|Number|Boolean|parse)$/;
  const escapes = (name, pos) => {
    const after = keyless.slice(pos + name.length, pos + name.length + 4);
    if (/^\s*(?:\??\.|\[|\(|=[^=]|\+\+|--)/.test(after)) return false;     // member use, call, or assignment target
    const before = keyless.slice(Math.max(0, pos - 12), pos);
    if (/(?:typeof|instanceof|in)\s+$|[!=<>]=?=?\s*$/.test(before) && !/(?:^|[^=!<>])=\s*$/.test(before)) return false;   // comparison / typeof
    return true;
  };
  const enclosingCallee = (pos) => {
    let d = 0;
    for (let i = pos - 1; i >= Math.max(0, pos - 2000); i--) {
      const c = keyless[i];
      if (c === ')' || c === ']' || c === '}') d++;
      else if (c === '[' || c === '{') { if (d === 0) return null; d--; }
      else if (c === '(') { if (d === 0) { const m = /([A-Za-z_$][\w$]*)\s*$/.exec(keyless.slice(Math.max(0, i - 60), i)); if (!m || NON_MUTATING.test(m[1]) || /\.\s*$/.test(keyless.slice(Math.max(0, i - 61 - m[1].length), i - m[1].length))) return null; return m[1]; } d--; }
      else if (c === ';' && d === 0) return null;
    }
    return null;
  };
  const markWriter = (f, name) => {
    const wk = `W:${f.name}:${f.start}`;
    if (!producers.has(wk)) producers.set(wk, { name: f.name, kind: 'PRODUCER_WRITER', writes: new Set(), ranges: [[f.start, f.end + 1]] });
    producers.get(wk).writes.add(name);
  };
  // a binding initialised to a primitive literal cannot be written through an alias
  const primitive = (k) => { const d = decls.get(k); if (!d.segs.length || fnDecl.has(k)) return false; return d.segs.every(([a0, z]) => { const t = code.slice(a0, z); const e = t.indexOf('='); return e > 0 && /^\s*(?:-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?|'[^'\\]*'|"[^"\\]*"|`[^`$\\]*`|true|false|null|undefined)\s*$/i.test(t.slice(e + 1)); }); };
  const inDecl = (k, pos) => decls.get(k).segs.some(([a0, z]) => a0 <= pos && pos < z);
  const owners = new Set(ownerNames);
  const queue = [], seen = new Set();
  const enqueue = (k) => { if (!seen.has(k)) { seen.add(k); queue.push(k); } };
  // seeds: module-scope names a live sink's expression or consequence reads
  // (a function CALLED in a consequence is an effect of the decision, not an
  // input to it — renderers and toasts — so from consequences only the values
  // read are seeds; calls in the expression itself are inputs and are kept)
  for (const sk of authoritySinks) {
    const ex = blankObjectKeys(blankNonCode(sk.expression));
    for (const x of ex.matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g)) { const k = resolve(x[0], sk.pos); if (k) enqueue(k); }
    // a producer-closure sink's consequence is scanner prose ("produces x consumed
    // by …"), not code: only code consequences are read for seeds
    if (sk.kind === 'AUTHORITY_PRODUCER_WRITE') continue;
    const cq = blankObjectKeys(blankNonCode(sk.fullConsequence ?? sk.consequence ?? ''));
    for (const x of cq.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?!\s*\()/g)) { const k = resolve(x[1], sk.pos); if (k) enqueue(k); }
  }
  while (queue.length) {
    const k = queue.shift(), d = decls.get(k);
    const ranges = [...d.segs];
    let kind = d.segs.length ? 'TOP_LEVEL_BINDING' : 'TOP_LEVEL_FUNCTION';
    for (const f of fnDecl.get(k) || []) if (!owners.has(f.name)) ranges.push([f.start, f.end + 1]);
    for (const pos of occ.get(k) || []) {
      if (inDecl(k, pos)) continue;
      // an escape — the binding used as a bare value (aliased, returned, or
      // passed as an argument) — can be written through the alias: the
      // function holding it, and a module function it is passed to, are
      // fingerprinted as writers
      if (!isWrite(d.name, pos) && !primitive(k) && escapes(d.name, pos)) {
        const f = fnAt(pos);
        if (f && inner(pos).a <= f.start && !owners.has(f.name)) markWriter(f, d.name);
        const callee = enclosingCallee(pos);
        if (callee) { const ck = resolve(callee, pos); for (const g of (ck && fnDecl.get(ck)) || []) if (!owners.has(g.name)) markWriter(g, d.name); }
        if (!f || inner(pos).a > f.start) ranges.push(stmtRange(pos));
        continue;
      }
      if (!isWrite(d.name, pos)) continue;
      const f = fnAt(pos);
      if (!f || inner(pos).a > f.start) { ranges.push(stmtRange(pos)); continue; }
      if (owners.has(f.name)) continue;   // already fingerprinted as an authority owner
      // the writer's body is fingerprinted whole; the closure continues only
      // from the write statement itself — the value written, not every UI call
      // the writer happens to make
      markWriter(f, d.name);
      const [s0, s1] = stmtRange(pos);
      for (const r of refs(Math.max(f.bodyStart, s0), Math.min(f.end, s1))) enqueue(r);
    }
    producers.set(`N:${k}`, { name: d.name, kind, ranges });
    for (const [a0, z] of ranges) for (const r of refs(a0, z)) enqueue(r);
  }
  return [...producers.values()].filter((p) => p.ranges.length).map((p) => {
    const rs = [...new Map(p.ranges.map((r) => [r.join(':'), r])).values()].sort((x, y) => x[0] - y[0]);
    return { producer: p.name, kind: p.kind, segments: rs.length, ...(p.writes ? { writes: [...p.writes].sort() } : {}), sha256: sha256(rs.map(([a0, z]) => canonicalCode(code.slice(a0, z))).join('\u0000')) };
  }).sort((x, y) => x.kind.localeCompare(y.kind) || x.producer.localeCompare(y.producer) || x.sha256.localeCompare(y.sha256));
}

function authorityBaselineOf(code, index, authoritySinks) {
  const sinks = authoritySinks.map((s) => {
    const deps = uniq((s.dependencies || []).map((d) => `${d.token}>${d.canonical || ''}`)).sort();
    const e = { owner: s.owner, kind: s.kind, expression: s.expression, consequence: s.consequence || '', consequenceSha256: sha256(canonicalCode(s.fullConsequence ?? s.consequence ?? '')), dependencies: deps, literals: numericLiterals(s.expression) };
    e.signature = sha256(JSON.stringify([e.owner, e.kind, canonicalCode(e.expression), e.consequenceSha256, e.dependencies]));
    return e;
  });
  for (const owner of [...new Set(authoritySinks.map((s) => s.owner))]) for (const l of objectAssignLeaves(code, index, owner)) {
    const e = { owner, kind: l.kind, expression: l.expression, consequence: '', consequenceSha256: sha256(''), dependencies: [], literals: numericLiterals(l.expression), classification: 'UNCLASSIFIED_GATE3_1' };
    e.signature = sha256(JSON.stringify([e.owner, e.kind, e.expression, e.consequenceSha256, e.dependencies]));
    sinks.push(e);
  }
  sinks.sort((a, b) => a.owner.localeCompare(b.owner) || a.kind.localeCompare(b.kind) || a.signature.localeCompare(b.signature));
  const ownerNames = new Set(authoritySinks.map((s) => s.owner));
  const owners = [];
  for (const name of [...ownerNames].sort()) {
    const fns = index.filter((f) => f.name === name);
    if (!fns.length) continue;
    // a name declared more than once is fingerprinted as the ordered list
    owners.push({ owner: name, sha256: sha256(fns.map((f) => canonicalCode(code.slice(f.start, f.end + 1))).join('\u0000')) });
  }
  const producers = topLevelProducerClosure(code, index, [...ownerNames], authoritySinks);
  return { sinks, owners, producers };
}
function loadAuthorityBaseline(file = BASELINE_PATH) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
let FROZEN_BASELINE = loadAuthorityBaseline();
function baselineDocument(observed, artifactSha) {
  return { schema: 'zugrio.gate3-authority-baseline/1', artifactSha256: artifactSha,
    scope: 'VALID FOR FROZEN GATE 2.2 ARTIFACT; MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE',
    rule: 'Every REACHABLE_AUTHORITY sink of the cleared artifact, signed over owner, kind, expression, whole consequence and dependency->canonical list, plus a code-only fingerprint of every function owning one, plus (round 9) the module-scope producer closure: every binding, function and writer a live sink reads by name, fingerprinted. Any removed, added or changed sink or owner body is an inventory defect. This binds the inventory to the cleared code; it does not establish that a frozen dependency is semantically correct.',
    sinks: observed.sinks, owners: observed.owners, producers: observed.producers };
}
function baselineDrift(observed, frozen) {
  if (!frozen) return [];
  const out = [];
  const bag = (list) => { const m = new Map(); for (const e of list) { if (!m.has(e.signature)) m.set(e.signature, []); m.get(e.signature).push(e); } return m; };
  const F = bag(frozen.sinks), O = bag(observed.sinks);
  const removed = [], added = [];
  for (const [k, list] of F) removed.push(...list.slice((O.get(k) || []).length));
  for (const [k, list] of O) added.push(...list.slice((F.get(k) || []).length));
  const short = (x, n = 140) => (x.length > n ? x.slice(0, n - 3) + '...' : x);
  // pair a removed and an added sink with the same owner, kind and expression:
  // the code is unchanged but what it feeds (dependencies or consequence) is not
  const key = (e) => `${e.owner}\u0000${e.kind}\u0000${canonicalCode(e.expression)}`;
  const pool = new Map();
  for (const e of added) { const k = key(e); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(e); }
  for (const r of removed) {
    const cand = pool.get(key(r));
    if (cand && cand.length) {
      const a = cand.shift(), what = [];
      if (JSON.stringify(a.dependencies) !== JSON.stringify(r.dependencies)) what.push(`dependencies now [${short(a.dependencies.join(', '), 100)}]`);
      if (a.consequenceSha256 !== r.consequenceSha256) what.push(`consequence now "${short(a.consequence || '', 100)}"`);
      out.push(`AUTHORITY_BASELINE_DRIFT: ${r.owner} ${r.kind} sink changed: ${short(r.expression)} — ${what.join('; ') || 'signature differs'}`);
    } else out.push(`AUTHORITY_BASELINE_DRIFT: ${r.owner} ${r.kind} frozen sink removed or changed: ${short(r.expression)}`);
  }
  for (const list of pool.values()) for (const a of list) out.push(`AUTHORITY_BASELINE_DRIFT: ${a.owner} ${a.kind} sink not in frozen baseline: ${short(a.expression)}`);
  const fo = new Map(frozen.owners.map((o) => [o.owner, o.sha256]));
  const oo = new Map(observed.owners.map((o) => [o.owner, o.sha256]));
  for (const [name, h] of fo) if (!oo.has(name)) out.push(`AUTHORITY_OWNER_DRIFT: frozen authority function ${name} no longer owns an authority sink`);
  else if (oo.get(name) !== h) out.push(`AUTHORITY_OWNER_DRIFT: ${name} body differs from the frozen baseline`);
  for (const name of oo.keys()) if (!fo.has(name)) out.push(`AUTHORITY_OWNER_DRIFT: ${name} is a new authority function`);
  // [round 9] module-scope producers read by live authority
  const pk = (p) => `${p.kind}\u0000${p.producer}`;
  const groupP = (list) => { const m = new Map(); for (const p of list || []) { if (!m.has(pk(p))) m.set(pk(p), []); m.get(pk(p)).push(p.sha256); } return m; };
  const FP = groupP(frozen.producers), OP = groupP(observed.producers);
  for (const [k, hs] of FP) {
    const [kind, name] = k.split('\u0000');
    const now = OP.get(k);
    if (!now) out.push(`AUTHORITY_PRODUCER_DRIFT: ${name} ${kind} no longer reaches live authority (removed, renamed or disconnected)`);
    else if (JSON.stringify([...hs].sort()) !== JSON.stringify([...now].sort())) out.push(`AUTHORITY_PRODUCER_DRIFT: ${name} ${kind} differs from the frozen baseline`);
  }
  for (const k of OP.keys()) if (!FP.has(k)) { const [kind, name] = k.split('\u0000'); out.push(`AUTHORITY_PRODUCER_DRIFT: ${name} ${kind} is a new producer of live authority`); }
  return out;
}

function scanSource(rawSrc, artifactSha = null, opts = {}) {
  const vocabulary = opts.vocabulary !== undefined ? opts.vocabulary : FROZEN_VOCABULARY;
  const baseline = opts.baseline !== undefined ? opts.baseline : FROZEN_BASELINE;
  const observedVocabulary = new Map();
  const vocabDefects = [];
  const code = rawSrc, index = functionIndex(code);
  // [Gate 3A freeze] registered engine listeners become named owners
  const found = engineListenerFunctions(code);
  const listeners = found.filter((l) => !l.namedRef);
  index.push(...listeners);
  ENGINE_LISTENER_NAMES.clear();
  for (const r of found.filter((l) => l.namedRef)) ENGINE_LISTENER_NAMES.add(r.name);
  // a named function registered by reference is marked as a listener in place
  for (const r of found.filter((l) => l.namedRef)) for (const f of index) if (f.name === r.name) f.engineListener = true;
  index.sort((a, b) => a.start - b.start || b.end - a.end);
  const graph = buildCallGraph(code, index);
  if (graph[ENGINE_EMITTER]) for (const l of found) if (graph[l.name]) graph[ENGINE_EMITTER].add(l.name);
  const allRoots = [...new Set([...LIVE_ROOTS, ...MARKUP_ENTRY_ROOTS, ...entryRoots(code, index)])];
  const liveReachable = reachableFrom(graph, allRoots);
  const sinks = discoverSinks(code, index);
  const defects = [], discovered = new Map();
  const boundCache = new Map();
  // [Gate 3A closure — Blocker A] bounded backward authority slice to a fixed point
  const closure = producerClosure(code, index, sinks, liveReachable);
  sinks.push(...closure.added);
  // [Gate 3A freeze] scanner assumptions are checked on every scan
  for (const s of sinks) if (s.reachability === undefined) s.reachability = liveReachable.has(s.owner) ? 'REACHABLE_AUTHORITY' : 'UNREACHABLE_LEGACY';
  const assumptionDefects = assumptionViolations(code, index, liveReachable, sinks);
  defects.push(...assumptionDefects);
  if (closure.bounded) defects.push(`producer closure hit its bound (${PRODUCER_CLOSURE_MAX_SINKS} sinks) before reaching a fixed point; the slice is incomplete`);

  for (const s of sinks) {
    s.reachability = s.forcedReachability || classifyReachability(s.owner, liveReachable);
    if (!REACHABILITY.includes(s.reachability)) defects.push(`${s.id}: invalid reachability ${s.reachability}`);
    s.dependencies = [];
    if (s.forcedCanonical) {
      if (!CATALOG[s.forcedCanonical]) defects.push(`${s.id}: forced canonical dependency ${s.forcedCanonical} has no catalogue entry`);
      else {
        s.dependencies.push({ token:`<${s.kind}>`, canonical:s.forcedCanonical });
        if (!discovered.has(s.forcedCanonical)) discovered.set(s.forcedCanonical, []);
        discovered.get(s.forcedCanonical).push({ sinkId:s.id, owner:s.owner, kind:s.kind, reachability:s.reachability, token:`<${s.kind}>`, expression:s.expression });
      }
    }
    const tokens = dependencyTokens(s.expression);
    const vocabLive = s.reachability === 'REACHABLE_AUTHORITY' || (s.kind === 'VERDICT_WRITE' && ['readyOk','fireOk'].includes(s.verdictTarget));
    const accept = (token, disposition) => {
      if (!vocabLive) return;
      const key = `${s.owner}\u0000${token}`;
      if (!observedVocabulary.has(key)) observedVocabulary.set(key, new Set());
      observedVocabulary.get(key).add(disposition);
      if (!vocabulary) return;
      const frozen = vocabulary.get(key);
      if (frozen === undefined) vocabDefects.push(`${s.id}: dependency '${token}' accepted as ${disposition} is not in the frozen Gate 2.2 dependency vocabulary — a new authority input must be declared and reviewed`);
      else if (!frozen.has(disposition)) vocabDefects.push(`${s.id}: dependency '${token}' is frozen as ${[...frozen].join('/')} but now accepted as ${disposition} — reclassification must be declared and reviewed`);
    };
    if (s.forcedCanonical) accept(`<${s.kind}${s.verdictTarget ? ':' + s.verdictTarget : ''}>`, `CANONICAL:${s.forcedCanonical}`);
    for (const t of noiseDroppedTokens(s.expression)) accept(t, 'NOISE_NAME');
    for (const token of tokens) {
      const canonical = canonicalDependency(token, s.owner, s.expression);
      if (!canonical) {
        // Reachable authority must be closed under discovered dependencies. Dead
        // legacy/render/log/research sinks are preserved as evidence but do not
        // block the live-map freeze merely because their internals are being deleted.
        const callLike = new RegExp(`\\b${token.replace(/[$]/g,'\\$')}\\s*\\(`).test(s.expression);
        const upperConstant = /^[A-Z0-9_]+$/.test(token);
        const knownInternalCall = callLike && index.some((f) => f.name === token);
        // a REFERENCE to a pure predicate intrinsic, e.g. .filter(Number.isFinite), is trusted too
        const trustedIntrinsicCall = trustedCallToken(token) && (callLike || /^(?:Number\.isFinite|Number\.isInteger|Boolean|String)$/.test(token));
        let mustCloseDependency = s.reachability === 'REACHABLE_AUTHORITY' || (s.kind === 'VERDICT_WRITE' && ['readyOk','fireOk'].includes(s.verdictTarget));
        let terminatedBy = null;
        // [Gate 3A closure] Termination rule, applied ONLY to producer sinks so the
        // guarantees on original sinks are unchanged. A producer's dependency is
        // closed when its root is a bound name (parameter / callback / loop
        // binder — closed at the caller or by the iterated expression), or a
        // local that has its own producer (that producer is itself a sink).
        if (mustCloseDependency && s.kind === 'AUTHORITY_PRODUCER_WRITE') {
          const root = token.replace(/\?\./g, '.').split('.')[0];
          // Resolve the function range that CONTAINS this sink. Two functions can
          // share a name — top-level `function atr(ca,p)` and the profile engine's
          // inner `const atr = (a, end = a.length) => ...` — and first-by-name
          // checked the inner function's parameters against the outer signature.
          const same = index.filter((f) => f.name === s.owner && f.start <= s.pos && s.pos <= f.end);
          const fr = same.sort((x, y) => (x.end - x.start) - (y.end - y.start))[0] || index.find((f) => f.name === s.owner);
          if (fr) {
            const bk = `${s.owner}@${fr.start}`;
            if (!boundCache.has(bk)) boundCache.set(bk, boundNames(code, fr));
            // a bound name terminates only as a non-call root; calling an unknown
            // function is never excused by the caller's name being bound
            if (!callLike && boundCache.get(bk).has(root)) { mustCloseDependency = false; terminatedBy = 'BOUND_ROOT'; }
            // a local (including a local arrow such as `const rFor = x => ...`) whose
            // producer is itself a sink closes by recursion
            else if (localProducers(code, fr, root).length) { mustCloseDependency = false; terminatedBy = 'LOCAL_PRODUCER'; }
          }
        }
        const isDefect = mustCloseDependency && !upperConstant && !(trustedIntrinsicCall && !callLike) && (!callLike || (!knownInternalCall && !trustedIntrinsicCall));
        if (isDefect) defects.push(`${s.id}: unmapped authority dependency '${token}' in ${s.expression}`);
        else accept(token, terminatedBy || (upperConstant ? 'UPPER_CONSTANT' : trustedIntrinsicCall ? 'TRUSTED_INTRINSIC' : knownInternalCall ? 'INTERNAL_CALL' : 'TERMINATED'));
        continue;
      }
      if (!CATALOG[canonical]) defects.push(`${s.id}: canonical dependency ${canonical} has no catalogue entry`);
      accept(token, `CANONICAL:${canonical}`);
      s.dependencies.push({ token, canonical });
      if (!discovered.has(canonical)) discovered.set(canonical, []);
      discovered.get(canonical).push({ sinkId:s.id, owner:s.owner, kind:s.kind, reachability:s.reachability, token, expression:s.expression });
    }
    s.dependencies = uniq(s.dependencies.map((d) => JSON.stringify(d))).map((x) => JSON.parse(x));
  }

  // [Gate 3A closure] Frozen gate-return schema. Only live gate owners are held
  // to it; a dead legacy function returning a new field is not capital authority.
  for (const [owner, names] of gateReturnFields) {
    if (!liveReachable.has(owner)) continue;
    const frozen = GATE_RETURN_SCHEMA[owner];
    if (!frozen) continue;
    for (const n of names) {
      if (!frozen.includes(n)) defects.push(`${owner}: unregistered gate return field '${n}' — a new field on a live gate record is an authority change and must be declared in GATE_RETURN_SCHEMA`);
    }
  }

  // Explicit member-level legacy-eval decomposition: these are required even if
  // a particular member only appears inside unreachable legacy code.
  const mandatoryMembers = {
    LEGACY_EVAL_SCORE: /(?:evaln|strategyPreview)\.score/,
    LEGACY_EVAL_DIRECTION: /(?:evaln|strategyPreview)\.direction/,
    LEGACY_EVAL_PRIMARY_SETUP: /evaln\.primarySetupQualified/,
    LEGACY_EVAL_FAMILY_COUNTS: /evaln\.(?:broadFamilies|executionFamilies|actionableFamilies|families)/,
    LEGACY_EVAL_SPECIALIST: /evaln\.(?:specialistQualified|specialistGate)/,
    LEGACY_EVAL_RISK_SCALE: /evaln\.riskScale/,
    LEGACY_EVAL_THESIS: /evaln\.thesisId/,
  };
  for (const [canonical, re] of Object.entries(mandatoryMembers)) {
    const hits=[]; const g=new RegExp(re.source, 'g'); let mm;
    while ((mm=g.exec(code))) {
      const owner=ownerOf(index, mm.index), reachability=classifyReachability(owner, liveReachable);
      hits.push({sinkId:`MEMBER_OCCURRENCE:${owner}:${mm.index}`,owner,kind:'MEMBER',reachability,token:mm[0],expression:mm[0]});
    }
    if (hits.length) {
      if (!discovered.has(canonical)) discovered.set(canonical, []);
      const bucket=discovered.get(canonical), keys=new Set(bucket.map(x=>`${x.owner}|${x.token}|${x.reachability}`));
      for (const h of hits) { const k=`${h.owner}|${h.token}|${h.reachability}`; if(!keys.has(k)){bucket.push(h);keys.add(k);} }
    }
  }

  // Four semantic grade families are mandatory and cannot be hard-admitted by wrapper.
  const semanticPresence = {
    REGIME_QUALITY: /regimeConf|REGIME_QUALITY_OK/,
    HTF_CONTEXT_QUALITY: /context\.(?:ok|same|opposing|votes)|directionContext/,
    REWARD_ECONOMIC_QUALITY: /grossR|netR|costR|minGrossR|minNetR|maxCostR/,
    TRIGGER_QUALITY: /assessTrigger|weighted|freshPriceAction|trigger\.confirmed/,
  };
  for (const [c,re] of Object.entries(semanticPresence)) {
    if (!discovered.has(c) && re.test(code)) discovered.set(c, [{sinkId:'SEMANTIC_FAMILY_PRESENCE',owner:'<multiple>',kind:'SEMANTIC_FAMILY',reachability:'UNREACHABLE_LEGACY',token:re.source,expression:'semantic family present in artifact'}]);
    if (!discovered.has(c)) defects.push(`semantic family ${c} is absent from inventory and artifact`);
  }

  // Non-authority semantic surfaces remain in the frozen map rather than
  // disappearing merely because sink-first authority discovery correctly finds
  // no capital sink for them.
  if (/researchSeeds|continuationReferenceEnabled|breakAndGoFresh|referenceContinuationBreak/.test(code) && !discovered.has('RESEARCH_CONTINUATION')) {
    discovered.set('RESEARCH_CONTINUATION', [{sinkId:'RESEARCH_PRESENCE',owner:'<research>',kind:'RESEARCH_ONLY',reachability:'RESEARCH_ONLY',token:'continuation research',expression:'Gate-1 OBSERVE continuation route'}]);
  }
  if (/advisoryReasons/.test(code) && !discovered.has('DATA_ADVISORY_FEATURES')) {
    discovered.set('DATA_ADVISORY_FEATURES', [{sinkId:'ADVISORY_PRESENCE',owner:'assessDataHealth',kind:'ADVISORY_ONLY',reachability:'RESEARCH_ONLY',token:'advisoryReasons',expression:'advisory data-health reasons'}]);
  }

  // Proposed predicates must remain visible even before they have consumers.
  for (const c of ['ENTRY_EVENT_CONFIRMED','GEOMETRY_COMPLETE']) if (!discovered.has(c)) discovered.set(c, []);

  const fields = [...discovered.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([name, consumers]) => {
    const meta = CATALOG[name];
    if (!meta) { defects.push(`${name}: missing catalogue metadata`); return null; }
    if (!CLASSIFICATIONS.includes(meta.classification)) defects.push(`${name}: invalid classification ${meta.classification}`);
    if (!PREDICATE_ADMISSION.includes(meta.predicateAdmission)) defects.push(`${name}: invalid predicate admission ${meta.predicateAdmission}`);
    if (meta.classification === 'HARD_STRUCTURAL_PREDICATE' && meta.predicateAdmission === 'ADMITTED' && /UNDECLARED|To be declared/i.test(meta.thresholdSource)) {
      defects.push(`${name}: admitted predicate has undeclared provenance`);
    }
    return {
      field: name,
      semanticMeaning: meta.semantic,
      semanticFamily: meta.semanticFamily,
      thresholdSource: meta.thresholdSource,
      gate3Classification: meta.classification,
      predicateAdmission: meta.predicateAdmission,
      intendedDestination: meta.destination,
      status: meta.proposed ? 'PROPOSED' : 'EXISTING_SEMANTIC',
      migrationDisposition: meta.classification === 'LEGACY_REMOVE' ? (meta.replacementRequired || /replace|future|Gate-4|Candidate Selection Policy|Position Management Policy|Layer-1 lifecycle/i.test(meta.destination) ? 'REMOVE_LEGACY_AUTHORITY_AND_REPLACE_AS_SPECIFIED' : 'REMOVE_LEGACY_AUTHORITY') : 'PRESERVE_PER_CLASSIFICATION',
      consumers,
      reachabilityClasses: uniq(consumers.map((c) => c.reachability)).sort(),
    };
  }).filter(Boolean);

  // prove key legacy functions are not reachable and key live functions are.
  for (const n of ['updateSignalState','checkSig','analyze','feedGate','familyGate','plan','lifecycle','route','makeIntent','routeConfirmedReversal','closePosition']) if (!liveReachable.has(n)) defects.push(`reachability: expected live function ${n} is not reachable from roots`);
  for (const n of ['updateLegacySignalState','checkLegacySig']) if (liveReachable.has(n)) defects.push(`reachability: legacy function ${n} unexpectedly reachable from live roots`);

  const authoritySinks = sinks.filter((s) => s.reachability === 'REACHABLE_AUTHORITY');
  const observedBaseline = authorityBaselineOf(code, index, authoritySinks);
  const baselineDefects = baselineDrift(observedBaseline, baseline);
  const inventory = {
    schema: 'zugrio.gate3-authority-inventory/3',
    gate: '3A',
    status: 'FROZEN BEFORE ANY AUTHORITY CODE CHANGE',
    artifactSha256: artifactSha,
    methodology: 'SINK_FIRST',
    liveRoots: LIVE_ROOTS,
    liveReachableFunctions: [...liveReachable].sort(),
    // [Gate 3A closure] classifyReachability() returns UNREACHABLE_LEGACY for ANY
    // owner not reachable from LIVE_ROOTS, not only for the two named legacy
    // functions. The previous hard-coded two-element list hid that fallthrough,
    // so assessDataHealth's sinks were UNREACHABLE_LEGACY while appearing in
    // neither published list. Both populations are now published separately.
    unreachableLegacyFunctions: uniq([
      'updateLegacySignalState','checkLegacySig',
      ...sinks.filter((x) => x.reachability === 'UNREACHABLE_LEGACY').map((x) => x.owner),
    ]).sort(),
    unreachableByNamedLegacy: ['checkLegacySig','updateLegacySignalState'],
    unreachableByFallthrough: uniq(
      sinks.filter((x) => x.reachability === 'UNREACHABLE_LEGACY').map((x) => x.owner)
    ).filter((o) => !['updateLegacySignalState','checkLegacySig'].includes(o)).sort(),
    reachabilityRule: 'An owner is REACHABLE_AUTHORITY iff it is reachable from LIVE_ROOTS in the static call graph. Otherwise it is UNREACHABLE_LEGACY, whether named as legacy (unreachableByNamedLegacy) or simply not called from any live root (unreachableByFallthrough). Defects in UNREACHABLE_LEGACY sinks are recorded as evidence but do not block the freeze.',
    gateReturnSchema: GATE_RETURN_SCHEMA,
    scannerAssumptions: SCANNER_ASSUMPTIONS.map((a) => ({ ...a, holdsOnThisArtifact: !assumptionDefects.some((d) => d.includes(`VIOLATED ${a.id}:`)) })),
    allowedClassifications: CLASSIFICATIONS,
    predicateAdmissionStates: PREDICATE_ADMISSION,
    reachabilityClasses: REACHABILITY,
    rule: 'Authority sinks are discovered first, including verdict-write initializers feeding state/selection/plan/execution decisions. Every dependency feeding a discovered sink must resolve to a classified semantic field. Declared field metadata cannot define the scan universe.',
    sinks,
    verdictAudit: buildVerdictAudit(code, index, sinks),
    fields,
    dependencyVocabulary: {
      file: 'tools/gate3-dependency-vocabulary.json',
      checked: !!vocabulary,
      observedEntries: observedVocabulary.size,
      frozenEntries: vocabulary ? vocabulary.size : 0,
      byDisposition: [...observedVocabulary.values()].flatMap((d) => [...d]).reduce((a, d) => { const k = d.startsWith('CANONICAL:') ? 'CANONICAL' : d; a[k] = (a[k] || 0) + 1; return a; }, {}),
    },
    authorityBaseline: {
      file: 'tools/gate3-authority-baseline.json',
      checked: !!baseline,
      observedSinks: observedBaseline.sinks.length,
      observedOwners: observedBaseline.owners.length,
      frozenSinks: baseline ? baseline.sinks.length : 0,
      frozenOwners: baseline ? baseline.owners.length : 0,
      thresholdLiterals: observedBaseline.sinks.reduce((n, e) => n + e.literals.length, 0),
      observedProducers: observedBaseline.producers.length,
      frozenProducers: baseline && baseline.producers ? baseline.producers.length : 0,
    },
    inventoryDefects: uniq([...defects, ...vocabDefects, ...baselineDefects]).sort(),
    totals: {
      sinks: sinks.length,
      reachableAuthoritySinks: authoritySinks.length,
      fields: fields.length,
      byClassification: Object.fromEntries(CLASSIFICATIONS.map((c) => [c, fields.filter((f) => f.gate3Classification === c).length])),
      byPredicateAdmission: Object.fromEntries(PREDICATE_ADMISSION.map((c) => [c, fields.filter((f) => f.predicateAdmission === c).length])),
      byReachability: Object.fromEntries(REACHABILITY.map((c) => [c, sinks.filter((s) => s.reachability === c).length])),
    },
  };
  Object.defineProperty(inventory, 'observedVocabulary', { value: observedVocabulary, enumerable: false });
  Object.defineProperty(inventory, 'observedBaseline', { value: observedBaseline, enumerable: false });
  return inventory;
}

function scanArtifact(filePath, opts = {}) {
  const html = fs.readFileSync(filePath, 'utf8');
  const sha = crypto.createHash('sha256').update(html).digest('hex');

  // [Gate 3A freeze] the frozen markup entry roots must equal the real markup
  const _names = new Set(functionIndex(inlineScripts(html).join('\n')).map((f) => f.name));
  const _markup = markupEntryRoots(html, _names);
  const _markupDrift = JSON.stringify(_markup) !== JSON.stringify([...MARKUP_ENTRY_ROOTS].sort());
  const rawSrc = inlineScripts(html).join('\n');
  const inv = scanSource(rawSrc, sha, opts);
  inv.markupEntryRoots = _markup;
  if (_markupDrift) inv.inventoryDefects.push(`markup entry roots differ from the frozen MARKUP_ENTRY_ROOTS: artifact markup is not the frozen Gate 2.2 markup`);
  return inv;
}

function writeEvidence(inventory, evidencePath = EVIDENCE_PATH) {
  const hash = crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from('zugrio:gate3-authority-inventory:v3','utf8'), canonicalBytes(inventory)]))
    .digest('hex');
  fs.mkdirSync(path.dirname(evidencePath), { recursive:true });
  fs.writeFileSync(evidencePath, JSON.stringify({ inventoryHash:hash, inventory }, null, 2) + '\n');
  return hash;
}

function main() {
  if (FREEZE_VOCABULARY) {
    // Freezing is a deliberate, reviewed act: only from a scan with no other defect.
    const pre = scanArtifact(ARTIFACT, { vocabulary: null });
    if (pre.inventoryDefects.length) { console.error('refusing to freeze vocabulary: the scan has defects'); pre.inventoryDefects.forEach((d) => console.error('  -', d)); process.exitCode = 2; return; }
    fs.writeFileSync(VOCABULARY_PATH, JSON.stringify(vocabularyDocument(pre.observedVocabulary, pre.artifactSha256), null, 1) + '\n');
    FROZEN_VOCABULARY = loadFrozenVocabulary();
    console.log(`froze ${FROZEN_VOCABULARY.size} vocabulary entries -> ${path.relative(process.cwd(), VOCABULARY_PATH)}`);
  }
  if (FREEZE_BASELINE) {
    // Same governance as the vocabulary: a baseline is frozen only from a scan
    // that is otherwise clean, and the frozen file is a reviewed artifact.
    const pre = scanArtifact(ARTIFACT, { baseline: null });
    if (pre.inventoryDefects.length) { console.error('refusing to freeze authority baseline: the scan has defects'); pre.inventoryDefects.forEach((d) => console.error('  -', d)); process.exitCode = 2; return; }
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baselineDocument(pre.observedBaseline, pre.artifactSha256), null, 1) + '\n');
    FROZEN_BASELINE = loadAuthorityBaseline();
    console.log(`froze ${FROZEN_BASELINE.sinks.length} authority sinks, ${FROZEN_BASELINE.owners.length} owner fingerprints and ${FROZEN_BASELINE.producers.length} module-scope producers -> ${path.relative(process.cwd(), BASELINE_PATH)}`);
  }
  const inv = scanArtifact(ARTIFACT), hash = writeEvidence(inv);
  console.log(`artifact ${inv.artifactSha256}`);
  console.log(`sinks ${inv.totals.sinks}, reachable authority ${inv.totals.reachableAuthoritySinks}, fields ${inv.totals.fields}`);
  console.log(`inventory defects ${inv.inventoryDefects.length}`);
  if (inv.inventoryDefects.length) inv.inventoryDefects.forEach((d) => console.log('  -', d));
  console.log(`inventory hash ${hash}`);
  if (inv.inventoryDefects.length) process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { topLevelProducerClosure, loadAuthorityBaseline, baselineDocument, baselineDrift, authorityBaselineOf, canonicalCode, objectAssignLeaves, numericLiterals, BASELINE_PATH, loadFrozenVocabulary, vocabularyDocument, VOCABULARY_PATH, noiseDroppedTokens, objectLiteralLeaves, statementStart, ASSIGN_OP, scanArtifact, scanSource, discoverSinks, functionIndex, ownerOf, buildCallGraph, reachableFrom, blankNonCode, inlineScripts, CATALOG, CLASSIFICATIONS, PREDICATE_ADMISSION, LIVE_ROOTS, gateReturnFields, GATE_RETURN_SCHEMA, returnRecordFields, MARKUP_ENTRY_ROOTS, markupEntryRoots, entryRoots, assumptionViolations, SCANNER_ASSUMPTIONS, TRUSTED_METHOD_NAMES, engineListenerFunctions, enginePayloadSites, listenerIsAuthority };
