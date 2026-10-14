// Binance spot klines -> hdfetch.py's .m1 format (float64 rows: epoch seconds, o, h, l, c), any interval.
// node bnfetch.mjs <out dir> <interval e.g. 15m> <from YYYY-MM-DD> SYMBOL [SYMBOL...]
import fs from "fs";
const [out, iv, from, ...syms] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const s of syms) {
  const rows = []; let t = Date.parse(from + "T00:00:00Z");
  for (;;) {
    let j; for (let a = 0; a < 6; a++) { try { const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${s}&interval=${iv}&limit=1000&startTime=${t}`); j = await r.json(); if (Array.isArray(j)) break; } catch {} await sleep(2000 * (a + 1)); }
    if (!Array.isArray(j) || !j.length) break;
    for (const k of j) rows.push(k[0] / 1000, +k[1], +k[2], +k[3], +k[4]);
    t = j.at(-1)[0] + 1; if (j.length < 1000) break;
  }
  fs.writeFileSync(`${out}/${s}.m1`, Buffer.from(new Float64Array(rows).buffer));
  console.log(s, rows.length / 5, "bars", new Date(rows[0] * 1000).toISOString(), "->", new Date(rows.at(-5) * 1000).toISOString());
}
