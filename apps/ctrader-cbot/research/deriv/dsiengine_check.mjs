// The Drift Switch rule as an engine would run it: causal sigma (trailing 1440 M1 bars), entry at the signal bar close,
// time exit after H bars, optional protective stop at k x ATR14 (checked on bar highs/lows, stop first), spread paid once.
import fs from "fs";
const [file, spread, L, H] = process.argv.slice(2).map((x, i) => (i ? +x : x));
const b = fs.readFileSync(`m1/${file}.m1`), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = f.length / 5;
const t = [], o = [], h = [], l = [], c = []; for (let i = 0; i < n; i++) { t.push(f[5*i]); o.push(f[5*i+1]); h.push(f[5*i+2]); l.push(f[5*i+3]); c.push(f[5*i+4]); }
const r = [0]; for (let i = 1; i < n; i++) r.push(c[i] / c[i-1] - 1);
const atr = (i) => { let s = 0; for (let k = i - 13; k <= i; k++) s += Math.max(h[k] - l[k], Math.abs(h[k] - c[k-1]), Math.abs(l[k] - c[k-1])); return s / 14; };
// trailing robust sigma, recomputed every 60 bars over the last 1440
let sig = NaN; const sigAt = []; for (let i = 0; i < n; i++) { if (i >= 1440 && i % 60 === 0) { const w = r.slice(i - 1440, i).sort((a, b) => a - b), med = w[720]; const mad = w.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[720]; sig = 1.4826 * mad; } sigAt.push(sig); }
function run(stopK, from, to) {
  const res = []; let stops = 0;
  for (let i = Math.max(from, 1440 + L); i + H < to;) {
    const s = sigAt[i], move = c[i] / c[i - L] - 1, a = atr(i);
    if (!(s > 0) || Math.abs(move) < s * Math.sqrt(L)) { i++; continue; }
    const d = Math.sign(move), e = c[i]; let x = c[i + H], k = i + H;
    if (stopK > 0) { const st = e - d * stopK * a; for (let j = i + 1; j <= i + H; j++) if (d > 0 ? l[j] <= st : h[j] >= st) { x = d > 0 ? Math.min(o[j], st) : Math.max(o[j], st); k = j; stops++; break; } }
    res.push((d * (x - e) - spread) / (2 * a)); i = k;
  }
  const m = res.reduce((p, q) => p + q, 0) / res.length, sd = Math.sqrt(res.reduce((p, q) => p + (q - m) ** 2, 0) / (res.length - 1));
  return `${res.length} trades avg ${m >= 0 ? "+" : ""}${m.toFixed(3)}R t ${(m / (sd / Math.sqrt(res.length))).toFixed(1)}${stopK ? `, stops ${stops}` : ""}`;
}
const cut = t.findIndex((x) => x >= t[n - 1] - 21 * 86400);
for (const k of [0, 3, 2]) console.log(`${file} lb${L} hold${H} spread ${spread} stop ${k ? k + "xATR" : "none"}: confirmation(69d) ${run(k, 0, cut)} | registered(21d) ${run(k, cut, n)}`);
