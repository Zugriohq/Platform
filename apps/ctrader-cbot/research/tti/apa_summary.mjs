// Pools apa_replay.mjs outputs by group (file name prefix fx_/vol_/jump_), timeframe, rule and variant (apa_prereg.json).
// node apa_summary.mjs <dir with *.json>
import fs from "fs";
const dir = process.argv[2], FX_SPLIT = Date.UTC(2025, 9, 1) / 1000;
const files = fs.readdirSync(dir).filter((f) => /^(fx|vol|jump)_.*\.json$/.test(f)).map((f) => ({ g: f.split("_")[0], ...JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")) }));
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}R t ${s.t.toFixed(1)} (n ${s.n})` : `n ${s.n}`);
const out = [];

// 1. The funnel: why APA rarely fires
out.push("FUNNEL (each setup's furthest stage; fresh triggers; trades)");
for (const tf of [300, 60]) for (const g of ["fx", "vol", "jump"]) {
  const fs_ = files.filter((x) => x.g === g && x.tf === tf); if (!fs_.length) continue;
  const sum = (k) => fs_.reduce((a, x) => a + (x.stages[k] || 0), 0), skip = (k) => fs_.reduce((a, x) => a + x.skipped[k], 0);
  const setups = fs_.reduce((a, x) => a + x.setups, 0), days = fs_.reduce((a, x) => a + (x.to - x.from) / 86400, 0);
  const tti = fs_.reduce((a, x) => a + x.trades.filter((t) => t.rule === "TTI").length, 0), fix = fs_.reduce((a, x) => a + x.trades.filter((t) => t.rule === "FIX15").length, 0);
  out.push(`  ${g} ${tf === 300 ? "M5" : "M1"} (${fs_.length} markets, ${(days / fs_.length).toFixed(0)} days each): ${setups} setups -> stopped at BOS without displacement ${sum("BOS_WEAK")}, no FVG/zone ${sum("BOS_DISPLACEMENT") + sum("FVG_FORMED")}, ` +
    `never retested ${sum("AWAITING_RETEST")}, retest without trigger ${sum("RETEST_ACTIVE")}, TRIGGERED ${sum("TRIGGERED")}; of the fresh triggers, TP1 below 1R ${skip("belowOneR")}, already past stop/TP1 ${skip("openBeyond")}; ` +
    `TTI trades ${tti} (${(tti / days).toFixed(2)} per market-day), FIX15 trades ${fix} (${(fix / days).toFixed(2)} per market-day)`);
}

// 2. Outcomes per registered cell
out.push("", "OUTCOMES: net R (spread paid) per half | mirror control | trade minus mirror | gross | at 2x spread -> verdict");
for (const rule of ["TTI", "FIX15"]) for (const tf of [300, 60]) for (const g of ["fx", "vol", "jump"]) for (const variant of ["ALL", "HTF"]) {
  const halves = [[], []], mir = [[], []], diff = [[], []], gross = [], x2 = [];
  for (const file of files.filter((x) => x.g === g && x.tf === tf)) {
    const mid = g === "fx" ? FX_SPLIT : (file.from + file.to) / 2;
    for (const t of file.trades) {
      if (t.rule !== rule || (variant === "HTF" && !t.htf)) continue;
      const h = t.t < mid ? 0 : 1; halves[h].push(t.r); mir[h].push(t.mirror); diff[h].push(t.r - t.mirror); gross.push(t.r + t.costR); x2.push(t.r - t.costR);
    }
  }
  const a = st(halves[0]), b = st(halves[1]), d0 = st(diff[0]), d1 = st(diff[1]);
  const pass = a.m > 0 && a.t >= 2 && b.m > 0 && b.t >= 2 && d0.m > 0 && d1.m > 0;
  out.push(`  ${rule} ${tf === 300 ? "M5" : "M1"} ${g} ${variant}: H1 ${f(a)}, H2 ${f(b)} | mirror ${f(st(mir[0].concat(mir[1])))} | minus mirror ${f(d0)} / ${f(d1)} | gross ${f(st(gross))} | 2x ${f(st(x2))} -> ${pass ? "PASS" : "fail"}`);
}
console.log(out.join("\n"));
