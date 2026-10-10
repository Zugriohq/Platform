/** Jint has no structuredClone. decision-core only clones plain JSON data, so this clones plain objects/arrays/primitives exactly and throws on anything else. Node keeps its native implementation. */
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = function zugrioPlainClone(v) {
    if (v === null || typeof v !== 'object') { if (typeof v === 'function' || typeof v === 'symbol') throw new TypeError('structuredClone: unsupported ' + typeof v); return v; }
    if (Array.isArray(v)) return v.map(zugrioPlainClone);
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) throw new TypeError('structuredClone: only plain objects and arrays are supported');
    const out = {};
    for (const k of Object.keys(v)) out[k] = zugrioPlainClone(v[k]);
    return out;
  };
}
