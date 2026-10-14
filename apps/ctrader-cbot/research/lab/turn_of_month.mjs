// realmarkets_prereg.json, I_index_turn_of_month: long from the close of the 2nd-last trading day of a month to the
// close of the 3rd trading day of the next month, on five index CFDs (HistData M1 -> daily closes at a 21:00 UTC cut).
// node turn_of_month.mjs <dir with SYMBOL.m1> [<more dirs>...]    (hdfetch.py format; later dirs fill gaps, duplicates dropped)
import fs from "fs";

const SYMS = ["SPXUSD", "NSXUSD", "GRXEUR", "UKXGBP", "JPXJPY"], DIRS = process.argv.slice(2);
// Data fix (after the first run): HistData's GRXEUR file holds a different index from 2020-06-15 to 2023-12-04 (about 3,200-4,400
// against the DAX near 12,000-16,000), so a day moving more than BREAK in log terms is a data break: its return and any trade across it are dropped.
const BREAK = 0.25, SPLIT = 2018, END = Date.UTC(2026, 9, 1) / 1000, COST = 0.0002, FIN = 0.05;

// Daily closes: a bar from 21:00 UTC belongs to the next day; the close is the day's last bar. Days with < 60 bars are dropped.
function daily(sym) {
  const days = new Map();   // when two directories hold the same day, the one with more bars owns it
  for (const d of DIRS) {
    const p = `${d}/${sym}.m1`; if (!fs.existsSync(p)) continue;
    const b = fs.readFileSync(p), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), mine = new Map();
    for (let i = 0; i < f.length; i += 5) {
      const t = f[i]; if (t >= END) continue;
      const key = Math.floor((t + 3 * 3600) / 86400), cur = mine.get(key);
      if (!cur) mine.set(key, { t, c: f[i + 4], n: 1 });
      else { cur.n++; if (t > cur.t) { cur.t = t; cur.c = f[i + 4]; } }
    }
    for (const [k, v] of mine) if (!days.has(k) || days.get(k).n < v.n) days.set(k, v);
  }
  return [...days.entries()].filter(([, v]) => v.n >= 60).sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ day: k, c: v.c }));
}

const out = [], events = new Map();   // event key "YYYY-MM" (month of entry) -> per-index rows
const ym = (day) => { const d = new Date(day * 86400000); return [d.getUTCFullYear(), d.getUTCMonth()]; };
for (const sym of SYMS) {
  const D = daily(sym); if (D.length < 500) { out.push(`${sym}: only ${D.length} days, skipped`); continue; }
  // position of each day within its month, from the start (1, 2, ...) and from the end (..., -2, -1)
  const fromStart = [], fromEnd = [];
  for (let i = 0; i < D.length; i++) { const [y, m] = ym(D[i].day), [py, pm] = i ? ym(D[i - 1].day) : [-1, -1]; fromStart[i] = py === y && pm === m ? fromStart[i - 1] + 1 : 1; }
  for (let i = D.length - 1; i >= 0; i--) { const [y, m] = ym(D[i].day), [ny, nm] = i + 1 < D.length ? ym(D[i + 1].day) : [-1, -1]; fromEnd[i] = ny === y && nm === m ? fromEnd[i + 1] - 1 : -1; }
  // daily log return of day i (close i-1 -> close i) is in the window when day i is the month's last day or its 1st-3rd day
  const inW = (i) => fromEnd[i] === -1 || fromStart[i] <= 3;
  const rets = { in: [[], []], out: [[], []] }; let breaks = 0;
  for (let i = 1; i < D.length; i++) {
    if (D[i].day - D[i - 1].day > 5) continue;   // data gap
    const r = Math.log(D[i].c / D[i - 1].c); if (Math.abs(r) > BREAK) { breaks++; continue; }
    const half = ym(D[i].day)[0] < SPLIT ? 0 : 1;
    rets[inW(i) ? "in" : "out"][half].push(r);
  }
  // trades: entry at the 2nd-last day's close, exit at the 3rd day's close of the next month
  let trades = 0;
  for (let i = 0; i < D.length; i++) {
    if (fromEnd[i] !== -2) continue;
    let j = i + 1; while (j < D.length && fromStart[j] !== 3) j++;
    if (j >= D.length || D[j].day - D[i].day > 12) continue;
    let broken = false; for (let k = i + 1; k <= j; k++) if (Math.abs(Math.log(D[k].c / D[k - 1].c)) > BREAK) broken = true;
    if (broken) continue;
    const [y, m] = ym(D[i].day), key = `${y}-${String(m + 1).padStart(2, "0")}`, half = y < SPLIT ? 0 : 1;
    const gross = D[j].c / D[i].c - 1, net = gross - COST - FIN * (D[j].day - D[i].day) / 365;
    const perDay = Math.log(D[j].c / D[i].c) / (j - i);
    const outMean = rets.out[half].reduce((a, x) => a + x, 0) / rets.out[half].length;
    if (!events.has(key)) events.set(key, { half, rows: [] });
    events.get(key).rows.push({ sym, gross, net, excess: perDay - outMean, days: j - i });
    trades++;
  }
  const s = (v) => v.length ? (v.reduce((a, x) => a + x, 0) / v.length * 1e4).toFixed(2) : "-";
  out.push(`${sym}: ${D.length} days ${new Date(D[0].day * 864e5).toISOString().slice(0, 10)} to ${new Date(D.at(-1).day * 864e5).toISOString().slice(0, 10)}, ${trades} trades, ${breaks} data breaks dropped; ` +
    `mean daily return (bp) window ${s(rets.in[0])} vs outside ${s(rets.out[0])} (2010-17), window ${s(rets.in[1])} vs outside ${s(rets.out[1])} (2018-26)`);
}

// Pooled test, clustered by month boundary: one value per event (the average over the indices that traded it).
const st = (v) => { const n = v.length, m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const avg = (rows, k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
const bp = (x) => `${x >= 0 ? "+" : ""}${(x * 1e4).toFixed(2)}bp`;
let pass = true;
for (const half of [0, 1]) {
  const ev = [...events.values()].filter((e) => e.half === half);
  const ex = st(ev.map((e) => avg(e.rows, "excess"))), g = st(ev.map((e) => avg(e.rows, "gross"))), n = st(ev.map((e) => avg(e.rows, "net")));
  const ok = ex.m > 0 && ex.t >= 2 && n.m > 0; pass &&= ok;
  out.push(`${half ? "2018-2026" : "2010-2017"}: ${ex.n} month boundaries; window minus outside, per day ${bp(ex.m)} (t ${ex.t.toFixed(2)}); ` +
    `window trade gross ${bp(g.m)} (t ${g.t.toFixed(2)}), net ${bp(n.m)} (t ${n.t.toFixed(2)}) -> ${ok ? "passes" : "fails"}`);
}
// per-index net trade, both halves (descriptive, not part of the pass rule)
for (const sym of SYMS) {
  const cells = [0, 1].map((h) => { const v = [...events.values()].filter((e) => e.half === h).flatMap((e) => e.rows.filter((r) => r.sym === sym).map((r) => r.net)); return v.length > 2 ? st(v) : null; });
  if (cells[0] || cells[1]) out.push(`  ${sym} net per trade: ` + cells.map((c, h) => `${h ? "2018-26" : "2010-17"} ${c ? `${bp(c.m)} (t ${c.t.toFixed(2)}, n ${c.n})` : "-"}`).join("; "));
}
out.push(`VERDICT (registered rule): ${pass ? "PASS" : "FAIL"}`);
console.log(out.join("\n"));
