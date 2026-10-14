// TTI v5.16 APA replay (apa_prereg.json): TTI's own analyseAPA/buildPlan, run bar by bar on closed bars.
// node apa_replay.mjs <TTI html> <SYMBOL.m1> <bar seconds> <spread: price | min,pct> <out.json>
// Writes the funnel (each setupId's furthest stage and last reason) and every trade with its mirror control.
import fs from "fs";

const [html, m1, tfArg, spreadArg, outPath] = process.argv.slice(2);
const TF = +tfArg, HTF = TF <= 60 ? 900 : 3600, W = 300, HOLD = 96;
const src = fs.readFileSync(html, "utf8");
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error("marker not found: " + from); return src.slice(a, b); };
const code = [
  cut("function atr(ca,p=14){", "\n}\n") + "\n}\n",
  cut("const TTI_FOUNDATION_REFERENCE=Object.freeze({", "if(typeof globalThis!=='undefined')globalThis.TTI_FOUNDATION_REFERENCE"),
  cut("const APA_CONFIG = {", "/* APA reuses the canonical family router"),
].join("\n")
  // research output only (never read by the decision); stubbed for speed
  .replace("function referenceEntryRouteStudy(apa,candles,timeframe='M5',cfg=APA_CONFIG){", "function referenceEntryRouteStudy(apa,candles,timeframe='M5',cfg=APA_CONFIG){return null;")
  .replace("if(typeof globalThis!=='undefined')globalThis.referenceEntryRouteStudy=referenceEntryRouteStudy;", "");
const TTI = new Function(code + "\nreturn { analyseAPA, buildPlan, swings, APA_CONFIG, version: APA_CONFIG.version };")();

function bars(sec) {
  const b = fs.readFileSync(m1), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), out = [];
  for (let i = 0; i < f.length; i += 5) {
    const t = Math.floor(f[i] / sec) * sec, x = out.at(-1);
    if (x && x.t === t) { x.h = Math.max(x.h, f[i + 2]); x.l = Math.min(x.l, f[i + 3]); x.c = f[i + 4]; }
    else out.push({ t, o: f[i + 1], h: f[i + 2], l: f[i + 3], c: f[i + 4] });
  }
  return out;
}
const C = bars(TF), H = bars(HTF);
const [s0, s1] = spreadArg.split(",").map(Number);
const spreadAt = (px) => (s1 === undefined ? s0 : Math.max(s0, (s1 / 100) * px));

// HTF agreement at a bar's close: last two confirmed k=5 swings on closed HTF bars
let hp = 0;
function htfBias(closeT) {
  while (hp < H.length && H[hp].t + HTF <= closeT) hp++;
  const win = H.slice(Math.max(0, hp - 200), hp); if (win.length < 30) return null;
  const { hi, lo } = TTI.swings(win, 5), n = win.length;
  const h = hi.filter((x) => x.confirmedAt < n), l = lo.filter((x) => x.confirmedAt < n);
  if (h.length < 2 || l.length < 2) return null;
  if (h.at(-1).p > h.at(-2).p && l.at(-1).p > l.at(-2).p) return "BUY";
  if (h.at(-1).p < h.at(-2).p && l.at(-1).p < l.at(-2).p) return "SELL";
  return null;
}

function walk(i0, dir, entry, stop, target, spread) {
  const risk = Math.abs(entry - stop);
  for (let j = i0; j < C.length && j < i0 + HOLD; j++) {
    const x = C[j], sHit = dir > 0 ? x.l <= stop : x.h >= stop, tHit = dir > 0 ? x.h >= target : x.l <= target;
    if (sHit) { const px = j > i0 && (dir > 0 ? x.o < stop : x.o > stop) ? x.o : stop; return { r: (dir * (px - entry) - spread) / risk, bars: j - i0 + 1, how: "stop" }; }
    if (tHit) { const px = j > i0 && (dir > 0 ? x.o > target : x.o < target) ? x.o : target; return { r: (dir * (px - entry) - spread) / risk, bars: j - i0 + 1, how: "target" }; }
  }
  const j = Math.min(C.length - 1, i0 + HOLD - 1); return { r: (dir * (C[j].c - entry) - spread) / risk, bars: j - i0 + 1, how: "time" };
}

const funnel = new Map(), trades = [], skipped = { noPlan: 0, belowOneR: 0, openBeyond: 0 }, taken = new Set();
const rank = (s) => ["NO_CONTEXT", "BOS_WEAK", "BOS_DISPLACEMENT", "FVG_FORMED", "GZ_OVERLAP", "AWAITING_RETEST", "RETEST_ACTIVE", "TRIGGERED", "INVALIDATED", "EXPIRED"].indexOf(s);
const reasonCount = new Map();
for (let i = W; i < C.length - 1; i++) {
  const win = C.slice(i - W + 1, i + 1);
  const apa = TTI.analyseAPA(win, { timeframe: TF === 300 ? "M5" : TF === 60 ? "M1" : "M15", cfg: TTI.APA_CONFIG });
  const key = apa.setupId || `${apa.stage}|${apa.dir}|${apa.components.bosIndex != null ? win[apa.components.bosIndex].t : "none"}`;
  if (apa.dir) {
    const prev = funnel.get(key) || { best: "BOS_WEAK", end: null }, terminal = ["INVALIDATED", "EXPIRED"].includes(apa.stage);
    funnel.set(key, { best: !terminal && rank(apa.stage) > rank(prev.best) ? apa.stage : prev.best, end: terminal ? apa.stage : prev.end, reason: apa.reasons.at(-1) || "" });
  } else reasonCount.set(apa.reasons.at(-1), (reasonCount.get(apa.reasons.at(-1)) || 0) + 1);
  if (apa.stage !== "TRIGGERED" || apa.components.triggerAt !== C[i].t || taken.has(apa.setupId)) continue;
  taken.add(apa.setupId);
  const plan = TTI.buildPlan(apa, win);
  if (!plan) { skipped.noPlan++; continue; }
  const dir = apa.dir === "BUY" ? 1 : -1, entry = C[i + 1].o, spread = spreadAt(entry), risk = Math.abs(entry - plan.stop);
  if (dir > 0 ? entry <= plan.stop : entry >= plan.stop) { skipped.openBeyond++; continue; }
  const base = { t: C[i + 1].t, dir, costR: spread / risk, htf: htfBias(C[i].t + TF) === apa.dir, breakType: apa.components.breakType,
    confluence: apa.components.locationConfluence, trigger: apa.components.triggerPattern && apa.components.triggerPattern.type };
  // amendment 1: FIX15, every trigger with a plan, target 1.5R from the actual entry
  { const tg = entry + dir * 1.5 * risk, a = walk(i + 1, dir, entry, plan.stop, tg, spread), m = walk(i + 1, -dir, entry, entry + (entry - plan.stop), entry - (tg - entry), spread);
    trades.push({ ...base, rule: "FIX15", r: a.r, mirror: m.r, rr: 1.5, bars: a.bars, how: a.how }); }
  if (!plan.executionEligible) { skipped.belowOneR++; continue; }
  if (dir > 0 ? entry >= plan.tp1 : entry <= plan.tp1) { skipped.openBeyond++; continue; }
  const a = walk(i + 1, dir, entry, plan.stop, plan.tp1, spread);
  const m = walk(i + 1, -dir, entry, entry + (entry - plan.stop), entry - (plan.tp1 - entry), spread);
  trades.push({ ...base, rule: "TTI", r: a.r, mirror: m.r, rr: Math.abs(plan.tp1 - entry) / risk, bars: a.bars, how: a.how });
}
const stages = {}; for (const v of funnel.values()) stages[v.best] = (stages[v.best] || 0) + 1;
const lastReasons = {}; for (const v of funnel.values()) if (v.best !== "TRIGGERED") { const k = v.reason.replace(/[-0-9.]+/g, "#"); lastReasons[k] = (lastReasons[k] || 0) + 1; }
fs.writeFileSync(outPath, JSON.stringify({ m1, tf: TF, apaVersion: TTI.version, bars: C.length, from: C[0].t, to: C.at(-1).t, setups: funnel.size, stages, lastReasons,
  noSetupReasons: Object.fromEntries([...reasonCount].map(([k, v]) => [String(k).replace(/[-0-9.]+/g, "#"), v])), skipped, trades }));
console.log(`${m1} tf ${TF}: ${C.length} bars, ${funnel.size} setups, ${trades.filter((x) => x.rule === "TTI").length} TTI trades, ${trades.filter((x) => x.rule === "FIX15").length} FIX15; stages ${JSON.stringify(stages)}; skipped ${JSON.stringify(skipped)}`);
