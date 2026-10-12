// Pre-registered intraday momentum test (intraday_prereg.json) on hourly bars (hbars/ from hfetch.py).
import { readFileSync } from "node:fs";
const pre = JSON.parse(readFileSync("intraday_prereg.json", "utf8"));
const COST = 0.0001;
const load = (s) => JSON.parse(readFileSync(`hbars/${s}.json`, "utf8")).bars.map(([t, o, h, l, c]) => ({ t, c }));
// New York and London wall clocks (US rules since 2007; EU: last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC).
const nth = (y, m, n) => { const f = Date.UTC(y, m, 1); const d = new Date(f).getUTCDay(); return f + ((7 - d) % 7 + 7 * (n - 1)) * 864e5; };
const lastSun = (y, m) => { const l = Date.UTC(y, m + 1, 0); return l - new Date(l).getUTCDay() * 864e5; };
const ny = (t) => { const y = new Date(t).getUTCFullYear(); const dst = t >= nth(y, 2, 2) + 7 * 36e5 && t < nth(y, 10, 1) + 6 * 36e5; return t + (dst ? -4 : -5) * 36e5; };
const ldn = (t) => { const y = new Date(t).getUTCFullYear(); const dst = t >= lastSun(y, 2) + 36e5 && t < lastSun(y, 9) + 36e5; return t + (dst ? 1 : 0) * 36e5; };
// close price at a local wall-clock hour H = close of the hour bar opening at local H-1.
function closesAt(bars, local, hours) {
  const m = new Map();
  for (const b of bars) { const lt = local(b.t), d = new Date(lt), wd = d.getUTCDay(); if (wd === 0 || wd === 6) continue;
    const hEnd = d.getUTCHours() + 1; if (!hours.includes(hEnd)) continue; const day = new Date(lt).toISOString().slice(0, 10);
    (m.get(day) || m.set(day, {}).get(day))[hEnd] = b.c; }
  return m;
}
function trades(sym, local, sigFrom, sigTo, tIn, tOut) {
  const days = closesAt(load(sym), local, [sigFrom, sigTo, tIn, tOut]); const keys = [...days.keys()].sort(); const out = [];
  for (let k = 1; k < keys.length; k++) { const p = days.get(keys[k - 1]), d = days.get(keys[k]);
    if (!(p[sigFrom] && d[sigTo] && d[tIn] && d[tOut])) continue;
    const sig = Math.sign(d[sigTo] / p[sigFrom] - 1); if (!sig) continue;
    out.push({ day: keys[k], r: sig * (d[tOut] / d[tIn] - 1) - COST, gross: sig * (d[tOut] / d[tIn] - 1) }); }
  return out;
}
const st = (xs) => { const n = xs.length, m = xs.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
for (const [g, syms] of Object.entries(pre.groups)) {
  const isIdx = g === "indices"; const all = syms.flatMap((s) => isIdx ? trades(s, ny, 16, 10, 15, 16) : trades(s, ldn, 16, 9, 15, 16));
  const byDay = new Map(); for (const x of all) (byDay.get(x.day) || byDay.set(x.day, []).get(x.day)).push(x);
  const port = [...byDay.entries()].sort().map(([d, v]) => ({ d, r: v.reduce((a, x) => a + x.r, 0) / v.length, g: v.reduce((a, x) => a + x.gross, 0) / v.length }));
  const mid = port[Math.floor(port.length / 2)].d;
  const a = st(port.filter((x) => x.d < mid).map((x) => x.r)), b = st(port.filter((x) => x.d >= mid).map((x) => x.r)), p = st(port.map((x) => x.r)), gr = st(port.map((x) => x.g));
  const pass = a.m > 0 && b.m > 0 && p.t >= 2;
  console.log(`${g.padEnd(8)} days=${p.n} trades=${all.length} gross ${(1e4 * gr.m).toFixed(2)}bp (t ${gr.t.toFixed(2)}) net ${(1e4 * p.m).toFixed(2)}bp t=${p.t.toFixed(2)} | halves ${(1e4 * a.m).toFixed(2)} / ${(1e4 * b.m).toFixed(2)}bp | win ${Math.round(100 * all.filter((x) => x.r > 0).length / all.length)}% | ${pass ? "PASS" : "fail"}`);
  for (const s of syms) { const x = isIdx ? trades(s, ny, 16, 10, 15, 16) : trades(s, ldn, 16, 9, 15, 16); const q = st(x.map((v) => v.r)); console.log(`   ${s.padEnd(7)} n=${q.n} net ${(1e4 * q.m).toFixed(2)}bp t=${q.t.toFixed(2)}`); }
}
