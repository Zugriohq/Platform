// Summarises TTI's own Track Record export (tti-track-record-*.csv, from the Track Record panel's export button) by
// instrument: as TTI recorded it, and recomputed from its entry, stop and exit price (R = move / stop distance).
// node trackrecord.mjs <tti-track-record.csv>
// Descriptive only (jump_prereg.json "secondary"): TTI keeps its last 100 signals, and its tracker samples every 30 s.
import fs from "fs";

export function parseCsv(text) {
  const rows = [], lines = text.split(/\r?\n/).filter((l) => l.trim());
  const cells = (l) => { const out = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
  const head = cells(lines[0]).map((h) => h.trim());
  for (const l of lines.slice(1)) { const c = cells(l), r = {}; head.forEach((h, i) => (r[h] = (c[i] ?? "").trim())); rows.push(r); }
  return rows;
}

export function summarise(rows) {
  const by = new Map();
  for (const r of rows) {
    const d = /BUY|LONG/i.test(r.direction) ? 1 : /SELL|SHORT/i.test(r.direction) ? -1 : 0;
    const e = +r.entry, s = +r.stop, x = +r.exit_price, risk = d * (e - s);
    const R = d && risk > 0 && Number.isFinite(x) && x > 0 ? d * (x - e) / risk : NaN;
    const g = by.get(r.instrument) ?? { n: 0, win: 0, loss: 0, other: 0, rs: [] };
    g.n++; if (/WIN/i.test(r.outcome)) g.win++; else if (/LOSS/i.test(r.outcome)) g.loss++; else g.other++;
    if (Number.isFinite(R)) g.rs.push(R);
    by.set(r.instrument, g);
  }
  return [...by.entries()].map(([k, g]) => {
    const m = g.rs.length ? g.rs.reduce((a, b) => a + b, 0) / g.rs.length : NaN;
    const sd = g.rs.length > 1 ? Math.sqrt(g.rs.reduce((a, b) => a + (b - m) ** 2, 0) / (g.rs.length - 1)) : NaN;
    return { instrument: k, n: g.n, win: g.win, loss: g.loss, other: g.other, rN: g.rs.length, avgR: m, t: sd > 0 ? m / (sd / Math.sqrt(g.rs.length)) : NaN };
  }).sort((a, b) => a.instrument.localeCompare(b.instrument));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const s = summarise(parseCsv(fs.readFileSync(process.argv[2], "utf8")));
  for (const x of s) console.log(`${x.instrument}: ${x.n} signals, TTI says ${x.win} WIN / ${x.loss} LOSS / ${x.other} other; recomputed from entry/stop/exit: ${x.rN} trades, avg ${Number.isFinite(x.avgR) ? x.avgR.toFixed(3) : "n/a"}R (t ${Number.isFinite(x.t) ? x.t.toFixed(1) : "n/a"}), before spread`);
}
