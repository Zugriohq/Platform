// Replays TTI's own decision code (unmodified, loaded from the TTI HTML) on historical 1-minute bars, the way the
// live app drives it, and records every signal it fires. Then each signal is resolved on the bars that follow.
//
// node replay.mjs <tti.html> <bars.m1 (hdfetch.py format)> <TTI key: EURUSD|GBPUSD|USDJPY|XAUUSD> <out.json> [--walk seed]
//
// How the live app drives the code (TTI 4.2), reproduced here:
// - Base timeframe M5, streamed. A new M5 bar arrives with its first price (o=h=l=c) and triggers recomputeFull +
//   checkSig; updates inside the bar trigger recomputeLight only. Signals are emitted only at a new M5 bar.
// - M15/H1/H4/M1 history is fetched when pWin >= 0.5 and refreshed every 10 minutes (so the M1 closes used by the
//   trigger are up to 10 minutes old); D1 once. Fetched candles include the forming bar ("end: latest").
// - Clock: Date.now() and new Date() are the replay time (sessions, expiries, throttles use them).
// Approximation: the tick velocity (last 10 ticks / ATR) is taken as 0.4 x (close - open) of the latest 1-minute bar
// over the ATR. Everything else is TTI's code path.
// --walk: replace the prices by a random walk with the same 1-minute volatility (a no-edge control).
import fs from "fs";
import vm from "vm";

const [html, barsPath, KEY, outPath] = process.argv.slice(2);
const walkSeed = process.argv.includes("--walk") ? +process.argv[process.argv.indexOf("--walk") + 1] : null;

// ---- bars ----
const buf = fs.readFileSync(barsPath), f = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8), N = f.length / 5;
let T = new Float64Array(N), O = new Float64Array(N), H = new Float64Array(N), L = new Float64Array(N), C = new Float64Array(N);
for (let i = 0; i < N; i++) { T[i] = f[5 * i]; O[i] = f[5 * i + 1]; H[i] = f[5 * i + 2]; L[i] = f[5 * i + 3]; C[i] = f[5 * i + 4]; }
if (walkSeed !== null) {
  // Same per-bar ranges and volatility, but each close is the previous close plus a random +/- move.
  let s = walkSeed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  let sum2 = 0; for (let i = 1; i < N; i++) sum2 += (C[i] - C[i - 1]) ** 2; const sd = Math.sqrt(sum2 / (N - 1));
  let p = C[0];
  for (let i = 0; i < N; i++) {
    const o = p, c = o + sd * gauss(), up = Math.abs(gauss()) * sd * 0.5, dn = Math.abs(gauss()) * sd * 0.5;
    O[i] = o; C[i] = c; H[i] = Math.max(o, c) + up; L[i] = Math.min(o, c) - dn; p = c;
  }
  // The generated bars, for evaluate.mjs.
  const w = new Float64Array(5 * N); for (let i = 0; i < N; i++) { w[5 * i] = T[i]; w[5 * i + 1] = O[i]; w[5 * i + 2] = H[i]; w[5 * i + 3] = L[i]; w[5 * i + 4] = C[i]; }
  fs.writeFileSync(outPath + ".m1", Buffer.from(w.buffer));
}

// ---- sandbox ----
let NOW = 0;
class SimDate extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } }
const nullEl = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : nullEl), apply: () => nullEl, set: () => true });
const ctx = {
  console, Math, JSON, Date: SimDate, Intl, Number, String, Array, Object, Set, Map, isFinite, parseFloat, parseInt, Promise,
  setTimeout: () => 0, setInterval: () => 0, clearInterval: () => {}, clearTimeout: () => {}, requestAnimationFrame: () => 0,
  document: { addEventListener() {}, getElementById: () => nullEl, querySelector: () => nullEl, querySelectorAll: () => [], createElement: () => nullEl, body: nullEl, documentElement: nullEl },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: {}, location: { search: "" }, WebSocket: function () {},
  matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, innerWidth: 400,
};
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
const page = fs.readFileSync(html, "utf8");
const app = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("const TTI_VERSION"));
vm.runInContext(app, ctx, { filename: "tti.js" });
const fired = [];
vm.runInContext(`
  for (const f of ["renderTile","renderWatchlist","afterRecompute","subscribeTicksForInst","renderFeed","renderBrain","updateTitle",
    "playAlert","toast","saveLog","refreshWLItem","drawSignalLevels","renderAnalysis","updateTopBarRegime","updateLiveCt"]) globalThis[f] = () => {};
  globalThis.requestHTF = (k) => { S[k]._htfRequested = true; };
  globalThis.scheduleOutcome = (o) => { __fired.push(o); };
`, Object.assign(ctx, { __fired: fired }));
const S = vm.runInContext("S", ctx), st = S[KEY];
if (!st) throw new Error("unknown TTI key " + KEY);
const VERSION = vm.runInContext("TTI_VERSION", ctx);

// ---- candle aggregation from 1-minute bars ----
function agg(sec) {
  const out = []; let cur = null;
  for (let i = 0; i < N; i++) {
    const b = Math.floor(T[i] / sec) * sec;
    if (!cur || cur.t !== b) { cur = { t: b, o: O[i], h: H[i], l: L[i], c: C[i], last: i, first: i }; out.push(cur); }
    else { cur.h = Math.max(cur.h, H[i]); cur.l = Math.min(cur.l, L[i]); cur.c = C[i]; cur.last = i; }
  }
  return out;
}
const TF = { M15: agg(900), H1: agg(3600), H4: agg(14400), D1: agg(86400) };
const ptr = { M15: 0, H1: 0, H4: 0, D1: 0 };
// Candles of a timeframe as fetched at time `now` (end: latest): closed bars plus the forming one up to minute index i.
function asOf(tf, i, count) {
  const a = TF[tf], now = T[i]; while (ptr[tf] + 1 < a.length && a[ptr[tf] + 1].t <= now) ptr[tf]++;
  const k = ptr[tf], cur = a[k];
  let h = -Infinity, l = Infinity; for (let j = cur.first; j <= i; j++) { h = Math.max(h, H[j]); l = Math.min(l, L[j]); }
  const form = { t: cur.t, o: cur.o, h, l, c: C[i] };
  return a.slice(Math.max(0, k - count + 1), k).map((x) => ({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c })).concat([form]);
}
function setHTF(i) {
  const m15 = asOf("M15", i, 80), h1 = asOf("H1", i, 120), h4 = asOf("H4", i, 60);
  st.candlesM15 = m15; st.closesM15 = m15.map((x) => x.c);
  st.candlesH1 = h1; st.closesH1 = h1.map((x) => x.c);
  st.candlesH4 = h4; st.closesH4 = h4.map((x) => x.c);
  const m1 = []; for (let j = Math.max(0, i - 59); j <= i; j++) m1.push({ t: T[j], o: O[j], h: H[j], l: L[j], c: C[j] });
  st.candlesM1 = m1; st.closesM1 = m1.map((x) => x.c);
}

// ---- replay ----
st.conn = "live";
const atrFn = vm.runInContext("atr", ctx);
let lastHTF = -Infinity, d1Done = false, m5 = null, started = false;
const pending = [];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const bar5 = Math.floor(T[i] / 300) * 300;
  if (!m5 || m5.t !== bar5) {
    // New M5 bar: arrives with its first price; the previous one is now closed.
    NOW = T[i] * 1000;
    if (m5) { st.candles[st.candles.length - 1] = { t: m5.t, o: m5.o, h: m5.h, l: m5.l, c: m5.c }; st.closes[st.closes.length - 1] = m5.c; }
    m5 = { t: bar5, o: O[i], h: O[i], l: O[i], c: O[i] };
    st.candles.push({ ...m5 }); st.closes.push(m5.c); if (st.candles.length > 300) { st.candles.shift(); st.closes.shift(); }
    st.prevPrice = st.price || m5.o; st.price = m5.o;
    if (st.candles.length >= 20) {
      if (!started) { vm.runInContext(`bootstrapGARCH(${JSON.stringify(KEY)})`, ctx); started = true; }
      if (st._htfRequested && T[i] - lastHTF >= 600) { setHTF(Math.max(0, i - 1)); lastHTF = T[i]; }
      if (!d1Done || T[i] % 86400 < 300) { const d1 = asOf("D1", Math.max(0, i - 1), 35); st.candlesD1 = d1; st.closesD1 = d1.map((x) => x.c); d1Done = true; }
      const before = fired.length;
      vm.runInContext(`recomputeFull(${JSON.stringify(KEY)}); checkSig(${JSON.stringify(KEY)});`, ctx);
      for (let k = before; k < fired.length; k++) pending.push(fired[k]);
    }
  }
  // Updates inside the M5 bar (one per minute here), then the outcome check the app runs on its own record.
  NOW = (T[i] + 59) * 1000;
  m5.h = Math.max(m5.h, H[i]); m5.l = Math.min(m5.l, L[i]); m5.c = C[i];
  st.candles[st.candles.length - 1] = { ...m5 }; st.closes[st.closes.length - 1] = m5.c; st.prevPrice = st.price; st.price = C[i];
  const a = atrFn(st.candles.slice(-20), 14) || 1e-9; st.tickVelocity = (0.4 * (C[i] - O[i])) / a;
  if (st.candles.length >= 20) vm.runInContext(`recomputeLight(${JSON.stringify(KEY)})`, ctx);
  for (let k = pending.length - 1; k >= 0; k--) {
    const s = pending[k], tg = parseFloat(s.lvls.target), sl = parseFloat(s.lvls.stop), p = C[i];
    const r = s.sig === "BUY" ? (p >= tg ? "WIN" : p <= sl ? "LOSS" : null) : (p <= tg ? "WIN" : p >= sl ? "LOSS" : null);
    if (s.outcome !== "PENDING") { pending.splice(k, 1); continue; }
    if (r || T[i] * 1000 - s.firedAt >= 72e5) { s.outcome = r || "TIMEOUT"; s.exitPrice = p; pending.splice(k, 1); }
  }
}

const rows = fired.map((s) => ({ firedAt: s.firedAt, dir: s.sig, price: s.price, stop: +s.lvls.stop, target: +s.lvls.target, entryIdeal: +s.lvls.entry,
  setup: s.lvls.setupType, regime: s.regime, pWin: s.pWin, evNet: s.evNet, rrNet: s.lvls.rrNet, costR: s.lvls.costR, appOutcome: s.outcome }));
fs.writeFileSync(outPath, JSON.stringify({ version: VERSION, key: KEY, bars: barsPath, walk: walkSeed, from: T[0], to: T[N - 1], seconds: (Date.now() - t0) / 1000, signals: rows }));
console.log(KEY, walkSeed !== null ? "(random walk " + walkSeed + ")" : "", "TTI", VERSION, "signals", rows.length, "in", ((Date.now() - t0) / 1000).toFixed(0) + "s");
