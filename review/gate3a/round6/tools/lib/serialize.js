'use strict';
/**
 * Zugrio canonical serialization — implements H-1 of the frozen architecture v1.0.2.
 *
 *   H-1: SHA-256 over canonical UTF-8 serialization with lexicographically sorted
 *        keys, no insignificant whitespace, fixed numeric canonical form, no
 *        exponent notation and explicit negative-zero handling.
 *
 * Two named, versioned forms are frozen here. Changing either changes every
 * identity in the system and is an architectural amendment, not a refactor.
 */

const NUMERIC_CANONICAL_FORM = 'zugrio-dec-1';
const SERIALIZATION_FORM = 'zugrio-canon-1';

/* ------------------------------------------------------------------ *
 * Numeric canonical form: zugrio-dec-1
 *
 *  - NaN, +Infinity, -Infinity are REJECTED. A non-finite number in an
 *    authority-path object is a defect, not a value to encode.
 *  - Negative zero normalises to "0". (H-1 explicit negative-zero handling.)
 *  - Integers render as plain digits with no decimal point and no sign on zero.
 *  - Non-integers render as the shortest round-trip decimal (V8 Number#toString)
 *    with any exponent expanded to plain positional notation. No "e" ever
 *    appears in output. The expansion is lossless: it re-parses to the same
 *    double.
 *  - No trailing zeros, no leading "+".
 * ------------------------------------------------------------------ */

function expandExponent(s) {
  const m = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/i.exec(s);
  if (!m) return s;
  const [, sign, intPart, fracPart = '', expStr] = m;
  const exp = parseInt(expStr, 10);
  const digits = intPart + fracPart;
  // position of the decimal point within `digits`, counted from the left
  let point = intPart.length + exp;
  let out;
  if (point <= 0) {
    out = '0.' + '0'.repeat(-point) + digits;
  } else if (point >= digits.length) {
    out = digits + '0'.repeat(point - digits.length);
  } else {
    out = digits.slice(0, point) + '.' + digits.slice(point);
  }
  // strip redundant zeros introduced by expansion
  if (out.includes('.')) out = out.replace(/0+$/, '').replace(/\.$/, '');
  out = out.replace(/^0+(?=\d)/, '');
  return sign + out;
}

function canonicalNumber(n) {
  if (typeof n !== 'number') throw new TypeError('canonicalNumber: not a number');
  if (!Number.isFinite(n)) {
    throw new RangeError(`canonicalNumber: non-finite value (${n}) is not serializable`);
  }
  if (n === 0) return '0'; // covers -0
  let s = String(n);
  if (/e/i.test(s)) s = expandExponent(s);
  if (/e/i.test(s)) throw new RangeError('canonicalNumber: exponent expansion failed');
  return s;
}

/* ------------------------------------------------------------------ *
 * String encoding
 *
 * JSON.stringify produces minimal RFC 8259 escapes and, since ES2019, escapes
 * lone surrogates rather than emitting ill-formed UTF-8. We reject lone
 * surrogates outright: an unpaired surrogate in an authority-path value means
 * upstream corruption, and silently encoding it would let two different
 * corrupt inputs collide after transport.
 * ------------------------------------------------------------------ */

function canonicalString(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new RangeError(`canonicalString: lone high surrogate at index ${i}`);
      }
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      throw new RangeError(`canonicalString: lone low surrogate at index ${i}`);
    }
  }
  return JSON.stringify(s);
}

/* ------------------------------------------------------------------ *
 * Structural serialization
 *
 * Object keys sort by UTF-16 code unit, which is what the default string
 * comparator does. Arrays preserve order — order is semantic.
 * `undefined`, functions and symbols are rejected rather than dropped: a
 * silently dropped field changes an identity without changing the source
 * object, which is precisely the failure content addressing exists to stop.
 * ------------------------------------------------------------------ */

function canonicalize(value, path = '$') {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return canonicalNumber(value);
  if (t === 'bigint') throw new TypeError(`canonicalize: bigint at ${path} is not serializable`);
  if (t === 'string') return canonicalString(value);
  if (t === 'undefined') throw new TypeError(`canonicalize: undefined at ${path}`);
  if (t === 'function' || t === 'symbol') {
    throw new TypeError(`canonicalize: ${t} at ${path} is not serializable`);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v, i) => canonicalize(v, `${path}[${i}]`)).join(',') + ']';
  }
  if (value instanceof Date) {
    throw new TypeError(
      `canonicalize: Date at ${path}; timestamps must be explicit strings or numbers`
    );
  }
  if (value instanceof Set || value instanceof Map) {
    throw new TypeError(`canonicalize: ${value.constructor.name} at ${path} has no canonical order`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError(`canonicalize: non-plain object at ${path}`);
  }
  const keys = Object.keys(value).sort();
  const parts = [];
  for (const k of keys) {
    parts.push(canonicalString(k) + ':' + canonicalize(value[k], `${path}.${k}`));
  }
  return '{' + parts.join(',') + '}';
}

function canonicalBytes(value) {
  return Buffer.from(canonicalize(value), 'utf8');
}

module.exports = {
  NUMERIC_CANONICAL_FORM,
  SERIALIZATION_FORM,
  canonicalNumber,
  canonicalString,
  canonicalize,
  canonicalBytes,
  expandExponent,
};
