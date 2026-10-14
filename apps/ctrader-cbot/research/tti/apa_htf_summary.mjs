// apa_htf_prereg.json: pools apa_replay.mjs outputs named <GROUP>_<SYMBOL>_<seconds>.json by group, timeframe, rule, variant.
// node apa_htf_summary.mjs <dir>
import fs from "fs";
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => /^(INDEX|GOLD|FX|CRYPTO)_.*\.json$/.test(f)).map((f) => ({ g: f.split("_")[0], ...JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")) }));
const split = (g) => (g === "CRYPTO" ? Date.UTC(2022, 0, 1) : Date.UTC(2018, 0, 1)) / 1000;
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const f = (s) => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(3)}R t ${s.t.toFixed(1)} (n ${s.n})` : `n ${s.n}`);
const out = ["net R (costs and financing paid) per half | trade minus mirror per half | before costs, all -> verdict"];
let passes = 0, cells = 0;
for (const rule of ["TTI", "FIX15"]) for (const tf of [14400, 86400]) for (const g of ["INDEX", "GOLD", "FX", "CRYPTO"]) for (const v of ["ALL", "HTF"]) {
  const h = [[], []], d = [[], []], gross = [];
  for (const file of files.filter((x) => x.g === g && x.tf === tf)) for (const t of file.trades) {
    if (t.rule !== rule || (v === "HTF" && !t.htf)) continue;
    const k = t.t < split(g) ? 0 : 1; h[k].push(t.r); d[k].push(t.r - t.mirror); gross.push(t.r + t.costR);
  }
  const a = st(h[0]), b = st(h[1]), d0 = st(d[0]), d1 = st(d[1]);
  const pass = a.m > 0 && a.t >= 2 && b.m > 0 && b.t >= 2 && d0.m > 0 && d1.m > 0; cells++; if (pass) passes++;
  out.push(`${rule} ${tf === 14400 ? "H4" : "D1"} ${g} ${v}: ${f(a)} / ${f(b)} | ${f(d0)} / ${f(d1)} | gross ${f(st(gross))} -> ${pass ? "PASS" : "fail"}`);
}
out.push(`${passes} of ${cells} cells pass`);
console.log(out.join("\n"));
