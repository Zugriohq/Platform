// Downloads Deriv ticks (time, price) for one symbol, newest first back N hours, into <out>.ticks (float64 pairs).
// node derivticks.mjs <out dir> <hours> <SYMBOL> [SYMBOL ...]
import fs from "fs";
import { connect } from "../tti/derivfetch.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [dir, hours, ...syms] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const api = await connect(); console.log("connected", api.url);
for (const s of syms) {
  const from = Math.floor(Date.now() / 1000) - +hours * 3600, m = new Map(); let end = "latest";
  for (let page = 0; page < 2000; page++) {
    let r; for (let a = 0; a < 5; a++) { r = await api.ask({ ticks_history: s, style: "ticks", count: 5000, end }); if (!r.error) break; await sleep(2000 * (a + 1)); }
    if (r.error) throw new Error(s + ": " + r.error.message);
    const t = r.history?.times ?? [], p = r.history?.prices ?? []; if (!t.length) break;
    for (let i = 0; i < t.length; i++) m.set(+t[i], +p[i]);
    if (+t[0] <= from || t.length < 2) break; end = String(+t[0] - 1); await sleep(300);
  }
  const rows = [...m.entries()].filter(([t]) => t >= from).sort((a, b) => a[0] - b[0]);
  const f = new Float64Array(rows.length * 2); rows.forEach(([t, p], i) => { f[2 * i] = t; f[2 * i + 1] = p; });
  fs.writeFileSync(`${dir}/${s}.ticks`, Buffer.from(f.buffer));
  const span = rows.length > 1 ? (rows.at(-1)[0] - rows[0][0]) : 0;
  console.log(`${s}: ${rows.length} ticks over ${(span / 3600).toFixed(1)} h (${(rows.length / Math.max(1, span)).toFixed(2)} per second)`);
}
api.close(); process.exit(0);
