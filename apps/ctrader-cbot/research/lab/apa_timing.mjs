// apa_timing_prereg.json: TTI 5.16 APA as the ENTRY TIMING inside evidenced base signals.
// node apa_timing.mjs <TTI html> <INDEX|GOLD|FX|CRYPTO> <out.json> SYMBOL=file[,file...] [SYMBOL=...]
// Files are hdfetch.py/bnfetch.mjs format (float64 rows: epoch s, o, h, l, c); several files per symbol are merged,
// the first file owning a timestamp.
import fs from "fs";
import { loadAPA } from "../tti/apa_lib.mjs";

const [html, GROUP, outPath, ...specs] = process.argv.slice(2);
const APA = loadAPA(html), W = 300;
const CFG = {
  INDEX: { tf: 900, apaTf: "M15", window: 24 * 3600, cost: 0.0002, fin: 0.05, cut: 21 },
  GOLD: { tf: 3600, apaTf: "H1", window: 120 * 3600, cost: 0.0003, fin: 0.015, cut: 21 },
  FX: { tf: 3600, apaTf: "H1", window: 120 * 3600, cost: 0.0001, fin: 0.015, cut: 21 },
  CRYPTO: { tf: 3600, apaTf: "H1", window: 48 * 3600, cost: 0.002, fin: 0.10, cut: 0 },
}[GROUP];
const SPLIT = GROUP === "CRYPTO" ? Date.UTC(2022, 0, 1) / 1000 : Date.UTC(2018, 0, 1) / 1000;

function load(files) {
  const seen = new Set(), rows = [];
  for (const p of files) {
    const b = fs.readFileSync(p), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8);
    for (let i = 0; i < f.length; i += 5) { if (seen.has(f[i])) continue; seen.add(f[i]); rows.push([f[i], f[i + 1], f[i + 2], f[i + 3], f[i + 4]]); }
  }
  return rows.sort((a, b) => a[0] - b[0]);
}
// bars of `sec` seconds aligned so that a day ends at `cut` UTC (cut 21: the FX/CFD day; cut 0: UTC days)
function agg(rows, sec, cutHour) {
  const off = sec >= 86400 ? (24 - cutHour) % 24 * 3600 : 0, out = [];
  for (const r of rows) {
    const t = Math.floor((r[0] + off) / sec) * sec - off, x = out.at(-1);
    if (x && x.t === t) { x.h = Math.max(x.h, r[2]); x.l = Math.min(x.l, r[3]); x.c = r[4]; x.n++; }
    else out.push({ t, o: r[1], h: r[2], l: r[3], c: r[4], n: 1 });
  }
  return out;
}

// One trade from timing bar k0's open (entry price e) to exit time exitT at exitPx, unless the stop is touched first.
function walk(B, k0, dir, e, stop, exitT, exitPx) {
  for (let k = k0; k < B.length && B[k].t + CFG.tf <= exitT; k++) {
    const x = B[k];
    if (dir > 0 ? x.l <= stop : x.h >= stop) return { px: k > k0 && (dir > 0 ? x.o < stop : x.o > stop) ? x.o : stop, t: x.t + CFG.tf, stopped: true };
  }
  return { px: exitPx, t: exitT, stopped: false };
}

const rows = [];
for (const spec of specs) {
  const [sym, list] = spec.split("="), raw = load(list.split(","));
  const D = agg(raw, 86400, CFG.cut).filter((d) => d.n >= (GROUP === "CRYPTO" ? 40 : 60)).map((d) => ({ ...d, close: d.t + 86400 }));
  const B = agg(raw, CFG.tf, CFG.cut);
  const firstBarAtOrAfter = (t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const cost = (e, entryT, exitT) => e * (CFG.cost + CFG.fin * Math.max(0, exitT - entryT) / 86400 / 365);

  // base signals: { T: signal close time, dir, e, stopFrac (stop distance / price), exitAfter(t) -> {t, px} }
  const sigs = [];
  if (GROUP === "INDEX") {
    const sma = (i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += D[k].c; return s / n; };
    const atr = (i) => { let s = 0; for (let k = i - 13; k <= i; k++) s += Math.max(D[k].h - D[k].l, Math.abs(D[k].h - D[k - 1].c), Math.abs(D[k].l - D[k - 1].c)); return s / 14; };
    let busyUntil = -1;
    for (let i = 201; i < D.length - 1; i++) {
      if (D[i].close <= busyUntil) continue;
      if (!(D[i].c > sma(i, 200) && D[i].c < D[i - 1].c && D[i - 1].c < D[i - 2].c && D[i - 2].c < D[i - 3].c)) continue;
      const exitAfter = (t) => { for (let k = i + 1; k < D.length; k++) if (D[k].close > t && D[k].c > sma(k, 5)) return { t: D[k].close, px: D[k].c }; return null; };
      const s = { T: D[i].close, dir: 1, e: D[i].c, stopDist: 3 * atr(i), exitAfter };
      const x = exitAfter(s.T); if (!x) break;
      const w = walk(B, firstBarAtOrAfter(s.T), 1, s.e, s.e - s.stopDist, x.t, x.px); busyUntil = w.t;   // one base position at a time
      sigs.push(s);
    }
  } else {
    const weekly = GROUP === "CRYPTO", ends = [];
    for (let i = 1; i < D.length; i++) {
      const a = new Date((D[i - 1].close - 3600) * 1000), b = new Date((D[i].close - 3600) * 1000);   // the trading day's date
      if (weekly ? b.getUTCDay() === 1 : a.getUTCMonth() !== b.getUTCMonth()) ends.push(i - 1);
    }
    const back = weekly ? 4 : 12, scale = Math.sqrt(weekly ? 7 : 21);
    for (let k = back; k + 1 < ends.length; k++) {
      const i = ends[k], j = ends[k + 1], dir = Math.sign(D[i].c - D[ends[k - back]].c); if (!dir || i < 61) continue;
      let s2 = 0, s1 = 0; const rs = []; for (let q = i - 59; q <= i; q++) rs.push(Math.log(D[q].c / D[q - 1].c));
      for (const r of rs) { s1 += r; } const mu = weekly ? 0 : s1 / 60; for (const r of rs) s2 += (r - mu) ** 2;
      const sig = Math.sqrt(s2 / (weekly ? 60 : 59)) * scale; if (!(sig > 0)) continue;
      sigs.push({ T: D[i].close, dir, e: D[i].c, stopDist: 3 * sig * D[i].c, exitAfter: () => ({ t: D[j].close, px: D[j].c }) });
    }
  }

  let apaCalls = 0;
  for (const s of sigs) {
    const x0 = s.exitAfter(s.T); if (!x0) continue;
    const k0 = firstBarAtOrAfter(s.T), baseStop = s.e - s.dir * s.stopDist;
    const wb = walk(B, k0, s.dir, s.e, baseStop, x0.t, x0.px);
    const row = { sym, T: s.T, dir: s.dir, base: (s.dir * (wb.px - s.e) - cost(s.e, s.T, wb.t)) / s.stopDist, baseStopped: wb.stopped, apa: null };
    // APA timing: the first fresh trigger in the signal's direction inside the window
    for (let k = k0; k < B.length && B[k].t + CFG.tf <= s.T + CFG.window && B[k].t + CFG.tf < x0.t; k++) {
      if (k + 1 >= B.length || k < W) continue;
      const win = B.slice(k - W + 1, k + 1); apaCalls++;
      const a = APA.analyseAPA(win, { timeframe: CFG.apaTf, cfg: APA.APA_CONFIG });
      if (a.stage !== "TRIGGERED" || a.components.triggerAt !== B[k].t || a.dir !== (s.dir > 0 ? "BUY" : "SELL")) continue;
      const plan = APA.buildPlan(a, win); if (!plan) continue;
      const e = B[k + 1].o, entryT = B[k + 1].t;
      if (s.dir > 0 ? e <= baseStop : e >= baseStop) break;   // already beyond the base stop: no trade
      const x = s.exitAfter(entryT); if (!x) break;
      const w1 = walk(B, k + 1, s.dir, e, baseStop, x.t, x.px);
      const apaRisk = Math.abs(e - plan.stop), okT2 = s.dir > 0 ? plan.stop < e : plan.stop > e;
      const w2 = okT2 ? walk(B, k + 1, s.dir, e, plan.stop, x.t, x.px) : null;
      row.apa = { delayH: (entryT - s.T) / 3600, entryVsBase: s.dir * (s.e - e) / s.stopDist,
        t1: (s.dir * (w1.px - e) - cost(e, entryT, w1.t)) / s.stopDist,
        t2: w2 ? (s.dir * (w2.px - e) - cost(e, entryT, w2.t)) / apaRisk : null, t2RiskVsBase: apaRisk / s.stopDist, t2Stopped: w2 && w2.stopped };
      break;
    }
    rows.push(row);
  }
  const yrs = (D.at(-1).close - D[201 < D.length ? 201 : 0].close) / (365.25 * 86400);
  console.error(`${GROUP} ${sym}: ${D.length} days, ${B.length} timing bars, ${rows.length} signals over ${yrs.toFixed(1)} years, APA triggered on ${rows.filter((r) => r.apa).length}; ${apaCalls} APA calls`);
}

// ---- summary (the registered pass rule) ----
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}R t ${s.t.toFixed(1)} n ${s.n}` : `n ${s.n}`);
const half = (r) => (r.T < SPLIT ? 0 : 1), span = rows.length ? (Math.max(...rows.map((r) => r.T)) - Math.min(...rows.map((r) => r.T))) / (365.25 * 86400) : 1;
const out = [`APA ${APA.version}, TTI html sha256 ${APA.htmlSha256.slice(0, 16)}; group ${GROUP}; ${rows.length} base signals over about ${span.toFixed(1)} years (all symbols)`];
const trig = rows.filter((r) => r.apa), none = rows.filter((r) => !r.apa);
out.push(`base entry, all signals: ${f(st(rows.map((r) => r.base)))}; total ${(rows.reduce((a, r) => a + r.base, 0) / span).toFixed(2)}R a year`);
out.push(`  selection: base on signals where APA triggered ${f(st(trig.map((r) => r.base)))}; where it did not ${f(st(none.map((r) => r.base)))}`);
out.push(`  APA triggered on ${trig.length} of ${rows.length} (${(100 * trig.length / Math.max(1, rows.length)).toFixed(0)}%); median delay ${trig.length ? trig.map((r) => r.apa.delayH).sort((a, b) => a - b)[trig.length >> 1].toFixed(1) : "-"} h; ` +
  `entry better than the base entry by ${f(st(trig.map((r) => r.apa.entryVsBase)))} (in base R)`);
let verdicts = [];
for (const v of ["t1", "t2"]) {
  const ok = trig.filter((r) => r.apa[v] != null), d = [0, 1].map((h) => st(ok.filter((r) => half(r) === h).map((r) => r.apa[v] - r.base)));
  const dAll = st(ok.map((r) => r.apa[v] - r.base)), net = [0, 1].map((h) => st(ok.filter((r) => half(r) === h).map((r) => r.apa[v])));
  const totalApa = ok.reduce((a, r) => a + r.apa[v], 0) / span, totalBase = rows.reduce((a, r) => a + r.base, 0) / span;
  const pass = d[0].m > 0 && d[1].m > 0 && dAll.t >= 2 && net[0].m > 0 && net[1].m > 0 && totalApa >= totalBase;
  verdicts.push(pass);
  out.push(`${v === "t1" ? "T1 (APA entry, base stop and exit, in base R)" : "T2 (APA entry and structural stop, base exit, in its own R)"}:`);
  out.push(`  APA-timed net: halves ${f(net[0])} / ${f(net[1])}; APA minus base on the same signals: halves ${f(d[0])} / ${f(d[1])}, pooled ${f(dAll)}`);
  out.push(`  total R a year: APA-timed ${totalApa.toFixed(2)} vs base ${totalBase.toFixed(2)}` +
    (v === "t2" ? `; structural stop is ${f(st(ok.map((r) => r.apa.t2RiskVsBase)))} of the base stop distance, stopped out ${ok.filter((r) => r.apa.t2Stopped).length} of ${ok.length}` : "") + ` -> ${pass ? "PASS" : "fail"}`);
}
out.push(`VERDICT ${GROUP}: ${verdicts.some(Boolean) ? "PASS (" + ["T1", "T2"].filter((_, i) => verdicts[i]).join(", ") + ")" : "FAIL"}`);
fs.writeFileSync(outPath, JSON.stringify({ group: GROUP, apaVersion: APA.version, htmlSha256: APA.htmlSha256, rows }));
console.log(out.join("\n"));
