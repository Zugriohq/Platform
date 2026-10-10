// Permutation table for topdown2 outputs: theory-driven filter families x entry/exit permutations, with
// consistency metrics. Usage: node analyze4.mjs STYLE dev|holdout [filter] [perm]   (reads td2/STYLE-*.json)
import { readFileSync, readdirSync } from "node:fs";
const [style, set, onlyF, onlyP] = process.argv.slice(2);
const MK = JSON.parse(readFileSync("markets.json", "utf8"));
const files = readdirSync("td2").filter((f) => f.startsWith(style + "-") && f.split("-").length === 2).filter((f) => MK[f.split("-")[1].replace(".json", "")]?.set === set);
const T = files.flatMap((f) => JSON.parse(readFileSync("td2/" + f, "utf8")).setups).sort((a, b) => a.t.localeCompare(b.t));
const anyPoi = (x) => Object.values(x.inPoi).some(Boolean);
const keyLvl = (x) => ["PDH", "PDL", "PWH", "PWL"].includes(x.level);
const h4 = (x) => x.bias.H4 === (x.side === "BUY" ? "BULL" : "BEAR");
export const FILTERS = {
  "F0 all": () => true,
  "F1 FVG": (x) => x.fvg,
  "F2 FVG+(candle|ind)": (x) => x.fvg && (x.revCandle || x.inducement),
  "F3 F2+H4 with": (x) => x.fvg && (x.revCandle || x.inducement) && h4(x),
  "F4 FVG+HTF POI": (x) => x.fvg && anyPoi(x),
  "F5 FVG+key level": (x) => x.fvg && keyLvl(x),
  "F6 F2+HTF POI": (x) => x.fvg && (x.revCandle || x.inducement) && anyPoi(x),
};
const PERMS = ["MKT_1.5", "MKT_2", "MKT_3", "MKT_liq", "FVG_1.5", "FVG_2", "FVG_3", "FVG_liq", "CE_1.5", "CE_2", "CE_3", "CE_liq"];
function metrics(xs, p) {
  const tr = xs.filter((x) => x.res[p] !== null && x.res[p] !== undefined); const rs = tr.map((x) => x.res[p]); const n = rs.length;
  if (n < 5) return null;
  const sum = rs.reduce((s, r) => s + r, 0), m = sum / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / (n - 1));
  const gw = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0), gl = -rs.filter((r) => r < 0).reduce((s, r) => s + r, 0);
  let eq = 0, peak = 0, dd = 0; for (const r of rs) { eq += r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  const months = {}; for (const x of tr) { const k = x.t.slice(0, 7); months[k] = (months[k] || 0) + x.res[p]; }
  const mv = Object.values(months); const posM = mv.filter((v) => v > 0).length / mv.length;
  const bySym = {}; for (const x of tr) bySym[x.symbol] = (bySym[x.symbol] || 0) + x.res[p];
  const symPos = Object.values(bySym).filter((v) => v > 0).length, symN = Object.keys(bySym).length;
  const half = tr[Math.floor(n / 2)]?.t; const e = tr.filter((x) => x.t < half).map((x) => x.res[p]), l = tr.filter((x) => x.t >= half).map((x) => x.res[p]);
  const avg = (a) => a.length ? a.reduce((s, r) => s + r, 0) / a.length : NaN;
  const years = (Date.parse(tr.at(-1).t) - Date.parse(tr[0].t)) / (365 * 86400000);
  return { n, win: rs.filter((r) => r > 0).length / n, m, se: sd / Math.sqrt(n), pf: gl > 0 ? gw / gl : Infinity, dd, posM, months: mv.length, symPos, symN, early: avg(e), late: avg(l), perYear: n / Math.max(years, 1e-9), sum };
}
const fmt = (k) => `n=${String(k.n).padStart(4)} ${Math.round(100 * k.win).toString().padStart(3)}% avg ${(k.m >= 0 ? "+" : "") + k.m.toFixed(2)}±${k.se.toFixed(2)} PF ${k.pf.toFixed(2)} sum ${k.sum.toFixed(0).padStart(4)}R maxDD ${k.dd.toFixed(0).padStart(3)}R months+ ${Math.round(100 * k.posM)}% mkts+ ${k.symPos}/${k.symN} early ${k.early.toFixed(2)} late ${k.late.toFixed(2)} ${k.perYear.toFixed(0)}/yr`;
console.log(`${style} ${set}: ${T.length} setups from ${files.length} markets`);
for (const [fn, f] of Object.entries(FILTERS)) {
  if (onlyF && !fn.startsWith(onlyF)) continue;
  const xs = T.filter(f);
  for (const p of PERMS) { if (onlyP && p !== onlyP) continue; const k = metrics(xs, p); if (k) console.log(`${fn.padEnd(22)} ${p.padEnd(8)} ${fmt(k)}`); }
}
