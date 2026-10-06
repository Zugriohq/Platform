'use strict';
/**
 * Gate 3A — ATR consumer semantic sweep.
 *
 * Closes the limitation carried from Gate 2. The Gate 2 report claimed that
 * "NaN makes every ATR-denominated comparison false, which is what failing
 * closed means". Gate 2.2 proved that wrong twice: `false` is only fail-closed
 * where `false` is the SAFE outcome.
 *
 * Syntax searches cannot find this. `G2-8b` looked for `atr(...) || x` and
 * `G2-8c` for sub-W slices; neither could see `Math.abs(move) < atr*0.25 ?
 * NEUTRAL : direction`, where the NaN simply travels through a comparison that
 * quietly evaluates false and the else-branch is the permissive one.
 *
 * So this tool works on SHAPE and OUTCOME rather than on tokens:
 *
 *   1. find every binding of an ATR-producing call to a local name;
 *   2. find every use of that name inside its owning function;
 *   3. extract the enclosing expression and classify its shape;
 *   4. EVALUATE the shape with the ATR substituted by NaN;
 *   5. decide whether the resulting branch is permissive or blocking.
 *
 * Every shape class carries a declared verdict. An unrecognised shape fails the
 * run rather than being assumed safe — the whole point is that assumption is
 * what produced the Gate 2.2 defects.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalBytes } = require('./lib/serialize');
const { inlineScripts, functionIndex, ownerOf } = require('./gate3-authority-inventory');

const ARTIFACT = process.argv[2] || path.join(__dirname, '..', 'artifacts', 'Zugrio-1.0.0-gate2.2.html');

/** ATR-producing calls. A binding of any of these makes the bound name ATR-derived. */
const ATR_PRODUCERS = /\b(canonicalATR|atrAt|apaAtr|atrSeries|atrPct|atr)\s*\(/;

/**
 * ATR also reaches code by ALIAS, not only by direct call: `const av =
 * candidate.atrAtBirth`. The first version tracked only direct calls, so the
 * Gate 2.2 shock defect — whose variable is such an alias — was reported as an
 * unresolved fragment rather than as a permissive branch. Aliases are tracked
 * as first-class ATR bindings.
 */
const ATR_ALIASES = /\.\s*(atrBefore|atrAtBirth|atrAtBreak|atrBeforeBreak|atrAt|_av)\b/;

/* ------------------------------------------------------------------ *
 * Shape classification. Each class declares what NaN does and whether
 * the resulting branch is permissive.
 * ------------------------------------------------------------------ */

const SHAPES = [
  {
    id: 'AVAILABILITY_GUARD',
    test: (e) => /ZUGRIO_ATR_OK\s*\(|Number\.isFinite\s*\(/.test(e),
    nanOutcome: 'false',
    verdict: 'BLOCKING',
    note: 'Explicit availability check. NaN is detected rather than compared. This is the correct shape.',
  },
  {
    id: 'POSITIVITY_GUARD',
    test: (e) => /\b[A-Za-z_$][\w$]*\s*>\s*0\b/.test(e) && !/\?/.test(e),
    nanOutcome: 'false',
    verdict: 'BLOCKING',
    note: 'NaN > 0 is false, and here false means "unavailable", which is the safe outcome.',
  },
  {
    id: 'NAN_PROPAGATING_AGGREGATE',
    /*
     * Balanced scan, not `[^)]*`. The first version of this test could not see
     * `Math.max(atr(bars,i), av)` because the character class stopped at the
     * closing paren of the inner call — which is precisely the shape of the
     * real Gate 2.2 shock defect. A detector that misses the defect it was
     * written for makes a clean report worthless.
     */
    test: (e, atrVar) => containsAggregateOver(e, atrVar),
    nanOutcome: 'NaN',
    verdict: 'PERMISSIVE',
    note: 'Math.max/min propagate NaN into a downstream comparison, which then reads false. This is the exact Gate 2.2 shock defect.',
  },
  {
    id: 'TERNARY_WITH_PERMISSIVE_ELSE',
    /*
     * A `?` with a `:` is not necessarily a ternary: an object literal is full
     * of colons. Require a comparison operator before the `?` and reject text
     * that looks like a property list, otherwise mkStr's level object is
     * reported as a permissive ternary.
     */
    test: (e) => {
      const q = e.indexOf('?');
      if (q < 0 || e.indexOf(':', q) < 0) return false;
      const before = e.slice(0, q);
      if (!/(===|!==|==|!=|>=|<=|>|<|&&|\|\||!)/.test(before)) return false;
      const props = (e.match(/[A-Za-z_$][\w$]*\s*:/g) || []).length;
      return props < 3;
    },
    nanOutcome: 'else-branch',
    verdict: 'DEPENDS_ON_ELSE',
    note: 'A NaN condition selects the else-branch. Permissive when the else-branch yields a direction, a value or a pass rather than UNKNOWN/null/block. This is the exact Gate 2.2 bias defect.',
  },
  {
    id: 'THRESHOLD_COMPARISON',
    test: (e) => /(>=|<=|>|<)/.test(e),
    nanOutcome: 'false',
    verdict: 'DEPENDS_ON_SENSE',
    note: 'NaN makes the comparison false. Blocking when false means reject; permissive when false means "constraint not violated".',
  },
  {
    id: 'BARE_REFERENCE',
    test: (e) => /^[A-Za-z_$][\w$]*$/.test(e.trim()),
    nanOutcome: 'value only',
    verdict: 'NO_BRANCH',
    note: 'A bare mention of the value. No test is performed here, so no branch can be permissive. Safety is decided wherever the value is consumed, which this sweep reports under that consumer.',
  },
  {
    id: 'PROPERTY_ASSIGNMENT',
    test: (e) => /^[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$][\w$.]*$/.test(e.trim()) || /^[A-Za-z_$][\w$]*\s*:\s*$/.test(e.trim()),
    nanOutcome: 'stored',
    verdict: 'DEFERRED_TO_CONSUMER',
    note: 'The value is written into a record rather than branched on. The record\'s readers appear in this sweep under their own names.',
  },
  {
    id: 'PASSED_AS_ARGUMENT',
    test: (e) => /^[\w$.\[\]'\s,]*$/.test(e) && /,/.test(e),
    nanOutcome: 'propagates to callee',
    verdict: 'DEFERRED_TO_CALLEE',
    note: 'The ATR value is handed to another function rather than branched on here. Safety is decided in the callee, which appears in this sweep under its own name.',
  },
  {
    id: 'ARITHMETIC_ONLY',
    test: (e) => /[*/+-]/.test(e),
    nanOutcome: 'NaN',
    verdict: 'DEFERRED',
    note: 'Produces a NaN value with no branch here. Safety depends on the eventual consumer, which is reported separately.',
  },
];

/**
 * Guard awareness.
 *
 * A per-statement view cannot see that `bias()` now returns UNKNOWN before its
 * ternary is ever reached. Without this the sweep reports the Gate 2.2 FIX as
 * a permissive branch, which is worse than useless — it would train a reader to
 * ignore the report. A use is GUARDED when an availability check on the same
 * variable dominates it: it appears earlier in the same function and its
 * failure path leaves (return/continue/break/throw) or assigns a blocking value.
 */
function guardsBefore(scope, atrVar, useOffset) {
  const v = atrVar.replace(/[$]/g, '\\$');
  const patterns = [
    new RegExp(`if\\s*\\(\\s*!\\s*ZUGRIO_ATR_OK\\s*\\(\\s*${v}\\s*\\)[^)]*\\)\\s*(return|continue|break|throw)`),
    new RegExp(`if\\s*\\(\\s*!\\s*Number\\.isFinite\\s*\\(\\s*${v}\\s*\\)[^)]*\\)\\s*(return|continue|break|throw)`),
    new RegExp(`if\\s*\\(\\s*!\\s*\\(\\s*${v}\\s*>\\s*0\\s*\\)\\s*\\)\\s*(return|continue|break|throw)`),
    new RegExp(`ZUGRIO_ATR_OK\\s*\\(\\s*${v}\\s*\\)\\s*\\?`),
    new RegExp(`if\\s*\\(\\s*ZUGRIO_ATR_OK\\s*\\(\\s*${v}\\s*\\)`),
    // `if(!A) return` and `if(x||!A) return` are guards too: !NaN is true.
    new RegExp(`if\\s*\\([^)]*!\\s*${v}\\b[^)]*\\)\\s*(return|continue|break|throw)`),
    new RegExp(`if\\s*\\([^)]*!\\s*\\(\\s*${v}\\s*>\\s*0\\s*\\)[^)]*\\)\\s*(return|continue|break|throw)`),
  ];
  const before = scope.slice(0, useOffset);
  for (const re of patterns) if (re.test(before)) return true;
  return false;
}

/**
 * Downstream finite sink. A NaN that reaches a `Number.isFinite`/`every(Number.isFinite)`
 * rejection collapses to "no candidate", which is blocking in effect even though
 * the arithmetic itself carried NaN.
 */
function hasFiniteSink(scope) {
  return /every\(Number\.isFinite\)|Number\.isFinite\(/.test(scope);
}

/** True when a Math.max/min call encloses the ATR variable, at any nesting depth. */
function containsAggregateOver(expr, atrVar) {
  const re = /Math\.(?:max|min)\s*\(/g;
  // atrVar may be an identifier or a whole call expression such as `atr(bars,i)`
  const nameRe = /[(),.]/.test(atrVar)
    ? new RegExp(atrVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    : new RegExp(`\\b${atrVar.replace(/[$]/g, '\\$')}\\b`);
  let m;
  while ((m = re.exec(expr))) {
    let depth = 0, i = m.index + m[0].length - 1;
    for (; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') { depth--; if (depth === 0) break; }
    }
    const args = expr.slice(m.index + m[0].length, i);
    if (nameRe.test(args)) return true;
  }
  return false;
}

/** Else-branch tokens that mean "refuse" rather than "proceed". */
const BLOCKING_ELSE = /(UNKNOWN|null|NaN|INSUFFICIENT|false|return\s*;|BLOCK|reject|'NONE')/i;

function classify(expr, atrVar) {
  const e = expr;
  for (const s of SHAPES) {
    if (!s.test(e, atrVar)) continue;
    let verdict = s.verdict;
    if (s.id === 'TERNARY_WITH_PERMISSIVE_ELSE') {
      const elseBranch = e.slice(e.lastIndexOf(':') + 1, e.lastIndexOf(':') + 60);
      verdict = BLOCKING_ELSE.test(elseBranch) ? 'BLOCKING' : 'PERMISSIVE';
      return { shape: s.id, nanOutcome: s.nanOutcome, verdict, elseBranch: elseBranch.trim(), note: s.note };
    }
    if (s.id === 'NAN_PROPAGATING_AGGREGATE') {
      return { shape: s.id, nanOutcome: s.nanOutcome, verdict: 'PERMISSIVE', note: s.note };
    }
    if (s.id === 'THRESHOLD_COMPARISON') {
      // `x / atr >= T` and `x > atr*k` reject on false -> blocking.
      // `x / atr <= T` and `x < atr*k` treat false as "not violated" -> permissive.
      verdict = /<=|<(?!=)/.test(e) ? 'PERMISSIVE' : 'BLOCKING';
      return { shape: s.id, nanOutcome: s.nanOutcome, verdict, note: s.note };
    }
    return { shape: s.id, nanOutcome: s.nanOutcome, verdict, note: s.note };
  }
  return { shape: 'UNRECOGNISED', nanOutcome: 'unknown', verdict: 'UNRESOLVED', note: 'No declared shape matched. Must be classified by hand before Gate 3 can clear.' };
}

/**
 * Hand classifications for sites no declared shape matches.
 *
 * These are argument lists and object-literal fragments that the extractor
 * cannot widen cleanly. They are classified explicitly, with reasons, rather
 * than by loosening a pattern until the unresolved count reaches zero — that
 * would be fitting the tool to the desired answer, which is the failure mode
 * this whole gate exists to prevent. Each entry names the guard that makes it
 * safe so a reviewer can check the claim against the artifact.
 */
const MANUAL = [
  {
    owner: 'atrPct', match: '...s',
    shape: 'SPREAD_OF_SERIES', verdict: 'NO_BRANCH',
    reason: 'Spread of the bounded ATR series into a sort. The series is empty when unavailable and atrPct returns ZUGRIO_ATR_UNAVAILABLE before this line, so no NaN reaches the comparison.',
  },
  {
    owner: 'recomputeFull', match: 'price,av,gS(k).s',
    shape: 'PASSED_AS_ARGUMENT', verdict: 'DEFERRED_TO_CALLEE',
    reason: 'Argument to roundNumScore. recomputeFull returns on !ZUGRIO_ATR_OK(av) at G21-07 before any call site is reached.',
  },
  {
    owner: 'recomputeFull', match: 'tf:',
    shape: 'PROPERTY_ASSIGNMENT', verdict: 'DEFERRED_TO_CONSUMER',
    reason: 'Structure-lane record. The M5 lane is reached only after the G21-07 guard; the M15 lane is added only when ZUGRIO_ATR_OK(avM15) per G21-08.',
  },
  {
    owner: 'recomputeFull', match: 'bbV,atrP,ms,msM15',
    shape: 'PASSED_AS_ARGUMENT', verdict: 'DEFERRED_TO_CALLEE',
    reason: 'Component bundle passed downstream. Both av and atrP are proven finite by the G21-07 guard above it.',
  },
  {
    owner: 'feedGate', match: 'atr(executionBars)',
    shape: 'AVAILABILITY_GUARD', verdict: 'BLOCKING',
    reason: 'The call sits inside ZUGRIO_ATR_OK(atr(executionBars)) at G22-03; the extractor bounds the statement at the inner paren so the guard falls outside the captured text. Verified against the artifact: coreOk is the guard result itself.',
  },
  {
    owner: 'drawCoreStructure', match: 'const Adecl=',
    shape: 'RENDERER_DECLUTTER', verdict: 'NON_AUTHORITY',
    reason: 'Chart label declutter spacing. Not a capital-path decision; Gate 3E removes renderer-owned economics entirely.',
  },
  {
    owner: 'TTI_FOUNDATION_SELF_TEST', match: 'setupKnownIndex:40',
    shape: 'TEST_FIXTURE', verdict: 'NON_AUTHORITY',
    reason: 'Self-test fixture construction. Not reachable from the capital path.',
  },
];

function manualFor(owner, statement) {
  return MANUAL.find((x) => x.owner === owner && statement.trim().startsWith(x.match)) || null;
}

/* ------------------------------------------------------------------ */

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
const REGEX_AFTER_KEYWORD = /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

function blankNonCode(src) {
  const n = src.length;
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (src[k] !== '\n') out[k] = ' '; };
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
      if (c !== '\n') out[j] = ' ';
      j++;
    }
    return { end: n, interp: false };
  };

  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (ch === '/' && nx === '/') { let j = i; while (j < n && src[j] !== '\n') j++; blank(i, j); i = j; continue; }
    if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2), j = e < 0 ? n : e + 2; blank(i, j); i = j; continue; }
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
      out[i] = ' ';
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
        tmpl.pop(); out[i] = ' ';
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


/** Statement containing a position, bounded by ; { } at depth 0. */
/**
 * Widen a statement outward through an enclosing `if(!( ... ))`.
 *
 * `if(!(m.rangeATR>=cfg.minRangeATR))out.reasons.push('...')` is blocking, but
 * the inner expression alone reads as a bare comparison. Dropping the negation
 * inverts the verdict, which is the worst possible error for this tool.
 */
function negationWrapped(src, start) {
  const before = src.slice(Math.max(0, start - 8), start);
  return /if\s*\(\s*!\s*\($/.test(before) || /!\s*\($/.test(before);
}

function statementAt(src, pos) {
  let start = pos, end = pos;
  let depth = 0;
  for (let i = pos; i >= 0; i--) {
    const c = src[i];
    if (c === ')' || c === ']') depth++;
    else if (c === '(' || c === '[') { if (depth === 0) { start = i + 1; break; } depth--; }
    else if ((c === ';' || c === '{' || c === '}' || c === '\n') && depth === 0) { start = i + 1; break; }
  }
  depth = 0;
  for (let i = pos; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') { if (depth === 0) { end = i; break; } depth--; }
    else if ((c === ';' || c === '{' || c === '}' || c === '\n') && depth === 0) { end = i; break; }
    end = i + 1;
  }
  return src.slice(start, end).trim();
}

function main() {
  const html = fs.readFileSync(ARTIFACT, 'utf8');
  const artifactSha = crypto.createHash('sha256').update(html).digest('hex');
  const raw = inlineScripts(html).join('\n');
  const src = blankNonCode(raw);
  const index = functionIndex(src);

  // 1. bindings of ATR-producing calls
  /*
   * Every declarator, not just the first. `const knownAt=..., Apre=atr(...)`
   * previously registered only `knownAt`, so Apre — an ATR value feeding every
   * normalised break metric in mkStr — was invisible to the sweep.
   */
  const bindings = [];
  const declRe = /(?:const|let|var)\s+([^;\n]{0,400})/g;
  let m;
  while ((m = declRe.exec(src))) {
    const declStart = m.index + m[0].indexOf(m[1]);
    let depth = 0, seg = '', segStart = declStart;
    const flush = (endPos) => {
      const eq = seg.indexOf('=');
      if (eq > 0) {
        const name = seg.slice(0, eq).trim();
        const init = seg.slice(eq + 1).trim();
        /*
         * An object literal that merely carries an ATR property is not itself
         * an ATR value. `const m={atrBefore:A,ageBars:n}` was being tracked as
         * an ATR binding, which then reported `m.ageBars<=...` as a permissive
         * ATR branch. It is neither ATR nor permissive.
         */
        const isObjectLiteral = /^\{/.test(init.trim());
        if (/^[A-Za-z_$][\w$]*$/.test(name) && !isObjectLiteral && (ATR_PRODUCERS.test(init) || ATR_ALIASES.test(init))) {
          bindings.push({
            name, pos: segStart, owner: ownerOf(index, segStart),
            producer: init.slice(0, 90),
            viaAlias: !ATR_PRODUCERS.test(init),
          });
        }
      }
      seg = ''; segStart = endPos + 1;
    };
    for (let i = 0; i < m[1].length; i++) {
      const ch = m[1][i];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { flush(declStart + i); continue; }
      seg += ch;
    }
    flush(declStart + m[1].length);
  }
  // plus well-known ATR-carrying property reads
  const propRe = /\b(?:atrBefore|atrAtBirth|atrAtBreak|atrBeforeBreak)\b/g;
  while ((m = propRe.exec(src))) {
    bindings.push({ name: m[0], pos: m.index, owner: ownerOf(index, m.index), producer: 'property carrying a canonical ATR' });
  }

  // 2/3/4/5. uses, shapes, NaN outcome, verdict
  const sites = [];
  for (const b of bindings) {
    const fn = index.find((f) => f.name === b.owner && f.start <= b.pos && b.pos <= f.end);
    const scopeStart = fn ? fn.start : b.pos;
    const scopeEnd = fn ? fn.end : Math.min(src.length, b.pos + 1500);
    const useRe = new RegExp(`\\b${b.name.replace(/[$]/g, '\\$')}\\b`, 'g');
    const scope = src.slice(scopeStart, scopeEnd);
    let u;
    while ((u = useRe.exec(scope))) {
      const abs = scopeStart + u.index;
      if (Math.abs(abs - b.pos) < b.name.length + 2) continue; // the binding itself
      const stmt = statementAt(src, abs);
      if (!stmt || stmt.length < 4) continue;
      // the binding statement is not a consumer of its own value
      if (new RegExp(`(?:const|let|var)\\s+${b.name.replace(/[$]/g, '\\$')}\\s*=`).test(stmt)) continue;
      // a length/size read on an ATR SERIES cannot carry NaN into a branch
      if (new RegExp(`${b.name.replace(/[$]/g, '\\$')}\\s*\\.\\s*(length|size)`).test(stmt)) continue;
      let c = classify(stmt, b.name);
      if (c.verdict === 'PERMISSIVE' && negationWrapped(src, abs - (src.slice(0, abs).length - src.lastIndexOf(stmt.slice(0, 12), abs)))) {
        c = { ...c, verdict: 'BLOCKING', note: 'Enclosed by an if(!( ... )) rejection, so the false outcome pushes a blocking reason. ' + c.note };
      }
      if (c.shape === 'UNRECOGNISED') {
        const hand = manualFor(b.owner, stmt);
        if (hand) c = { shape: hand.shape, nanOutcome: 'n/a', verdict: hand.verdict, note: 'HAND-CLASSIFIED: ' + hand.reason, handClassified: true };
      }
      const inlineGuard = new RegExp(`!\\s*${b.name.replace(/[$]/g, '\\$')}\\b`).test(stmt);
      const guarded = inlineGuard || guardsBefore(scope, b.name, u.index);
      if (guarded && c.verdict === 'PERMISSIVE') {
        c.verdict = 'BLOCKING';
        c.guarded = true;
        c.note = 'Shape is permissive in isolation, but an availability guard on the same variable dominates this use. ' + c.note;
      } else if (guarded) {
        c.guarded = true;
      } else if (c.verdict === 'PERMISSIVE' && hasFiniteSink(scope)) {
        c.verdict = 'BLOCKING_BY_SINK';
        c.note = 'NaN propagates but the owning function rejects non-finite results before a candidate is produced. Blocking in effect, by a downstream sink rather than by a guard at the use.';
      }
      sites.push({
        atrVar: b.name, owner: b.owner, producer: b.producer,
        expression: raw.slice(Math.max(0, abs - 60), abs + 120).replace(/\s+/g, ' ').trim().slice(0, 170),
        statement: stmt.slice(0, 170),
        ...c,
      });
    }
  }

  /*
   * Second pass: inline ATR calls that are never bound to a name. The shock
   * defect read `Math.max(atr(bars, i), av)` directly inside a comparison, so a
   * binding-only scan could not see it.
   */
  const inlineRe = /\b(?:canonicalATR|atrAt|apaAtr|atr)\s*\(/g;
  let im;
  while ((im = inlineRe.exec(src))) {
    const owner = ownerOf(index, im.index);
    const stmt = statementAt(src, im.index);
    if (!stmt || stmt.length < 8) continue;
    if (/(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:canonicalATR|atrAt|apaAtr|atr)\s*\(/.test(stmt)) continue;
    // a function DEFINITION is not a consumer of its own return value
    if (/^\s*function\s+(?:canonicalATR|atrAt|apaAtr|atrSeries|atrPct|atr)\s*\(/.test(stmt)) continue;
    if (/^\s*return\s+canonicalATR\s*\(/.test(stmt)) continue;
    // wrapped in an explicit availability check
    if (/ZUGRIO_ATR_OK\s*\(\s*(?:canonicalATR|atrAt|apaAtr|atr)\s*\(/.test(stmt)) continue;
    const callText = src.slice(im.index, src.indexOf(')', im.index) + 1);
    let c = classify(stmt, callText);
    if (c.shape === 'UNRECOGNISED') {
      const hand = manualFor(owner, stmt);
      if (hand) c = { shape: hand.shape, nanOutcome: 'n/a', verdict: hand.verdict, note: 'HAND-CLASSIFIED: ' + hand.reason, handClassified: true };
    }
    sites.push({
      atrVar: callText, owner, producer: 'inline call (unbound)',
      expression: raw.slice(Math.max(0, im.index - 60), im.index + 120).replace(/\s+/g, ' ').trim().slice(0, 170),
      statement: stmt.slice(0, 170), inlineCall: true, ...c,
    });
  }

  // de-duplicate identical (owner, statement)
  const seen = new Set();
  const unique = sites.filter((s) => {
    const k = `${s.owner}|${s.statement}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  /*
   * A permissive branch only matters where it can influence capital authority.
   * Renderer decluttering and the self-test harness are declared non-authority
   * surfaces; they are reported separately rather than dropped, so the claim is
   * "zero permissive branches ON THE CAPITAL PATH" rather than "zero found".
   */
  const NON_AUTHORITY = /^(draw|render|sync|chart|ui)|SELF_TEST$/i;
  const allPermissive = unique.filter((s) => s.verdict === 'PERMISSIVE');
  const permissive = allPermissive.filter((s) => !NON_AUTHORITY.test(s.owner));
  const permissiveNonAuthority = allPermissive.filter((s) => NON_AUTHORITY.test(s.owner));
  const bySink = unique.filter((s) => s.verdict === 'BLOCKING_BY_SINK');
  const guarded = unique.filter((s) => s.guarded === true);
  const unresolved = unique.filter((s) => s.verdict === 'UNRESOLVED');
  const byShape = {};
  for (const s of unique) byShape[s.shape] = (byShape[s.shape] || 0) + 1;

  const report = {
    schema: 'zugrio.gate3-atr-semantic-sweep/1',
    gate: '3A',
    purpose:
      'Close the Gate 2 limitation: determine, for every ATR-derived value, whether the ' +
      'branch taken when ATR is unavailable is permissive or blocking. Syntax searches ' +
      'cannot answer this; shape and outcome can.',
    artifact: path.basename(ARTIFACT),
    artifactSha256: artifactSha,
    declaredShapes: SHAPES.map(({ id, nanOutcome, verdict, note }) => ({ id, nanOutcome, verdict, note })),
    handClassifications: MANUAL,
    totals: {
      atrBindings: bindings.length,
      distinctConsumerStatements: unique.length,
      byShape,
      permissiveAuthorityBranches: permissive.length,
      permissiveNonAuthorityBranches: permissiveNonAuthority.length,
      blockingByUpstreamGuard: guarded.length,
      blockingByDownstreamFiniteSink: bySink.length,
      unresolvedShapes: unresolved.length,
    },
    blockingByDownstreamFiniteSink: bySink,
    permissiveBranches: permissive,
    permissiveNonAuthorityBranches: permissiveNonAuthority,
    unresolvedShapes: unresolved,
    allSites: unique,
  };

  const hash = crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from('zugrio:gate3-atr-sweep:v1', 'utf8'), canonicalBytes(report)]))
    .digest('hex');

  fs.writeFileSync(
    path.join(__dirname, '..', 'evidence', 'GATE3-ATR-SEMANTIC-SWEEP.json'),
    JSON.stringify({ sweepHash: hash, report }, null, 2) + '\n'
  );

  console.log(`artifact ${artifactSha}`);
  console.log(`ATR bindings ${bindings.length}, distinct consumer statements ${unique.length}`);
  console.log('by shape:', JSON.stringify(byShape));
  console.log(`guarded upstream:    ${guarded.length}`);
  console.log(`blocked by sink:     ${bySink.length}`);
  console.log(`PERMISSIVE (capital path): ${permissive.length}`);
  console.log(`PERMISSIVE (non-authority): ${permissiveNonAuthority.length} -> ${permissiveNonAuthority.map((x) => x.owner).join(', ') || 'none'}`);
  console.log(`UNRESOLVED shapes:   ${unresolved.length}`);
  console.log(`sweep hash ${hash}`);
}

if (require.main === module) main();
module.exports = { classify, SHAPES, blankNonCode, statementAt, containsAggregateOver };
