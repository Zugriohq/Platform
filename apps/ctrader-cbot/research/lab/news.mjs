// news_prereg.json: B2 pre-FOMC drift, and B1 the index engine's news veto (FOMC, NFP, CPI).
// node news.mjs <fomc_announcements.json> SPXUSD=f1,f2 NSXUSD=f1,f2 [EURUSD=f1,f2 for B1's NFP/CPI days]
import fs from "fs";
const [fomcPath, ...specs] = process.argv.slice(2);
const files = Object.fromEntries(specs.map((s) => { const [k, v] = s.split("="); return [k, v.split(",")]; }));
const FOMC = JSON.parse(fs.readFileSync(fomcPath, "utf8"));
const SPLIT = Date.UTC(2018, 0, 1) / 1000, END = Date.UTC(2026, 9, 1) / 1000;

// New York wall time -> UTC epoch seconds (US rules since 2007)
function nyToUtc(y, m, d, hh, mm) {
  const nthSun = (mo, n) => { const f = new Date(Date.UTC(y, mo, 1)).getUTCDay(); return 1 + ((7 - f) % 7) + 7 * (n - 1); };
  const t = Date.UTC(y, m, d, hh, mm) / 1000, start = Date.UTC(y, 2, nthSun(2, 2), 2) / 1000, end = Date.UTC(y, 10, nthSun(10, 1), 2) / 1000;
  return t + (t >= start && t < end ? 4 : 5) * 3600;
}
const isoToYmd = (s) => s.split("-").map(Number);
function load(list) {
  const m = new Map();
  for (const p of list) { const b = fs.readFileSync(p), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8); for (let i = 0; i < f.length; i += 5) if (!m.has(f[i])) m.set(f[i], [f[i + 1], f[i + 2], f[i + 3], f[i + 4]]); }
  const t = [...m.keys()].sort((a, b) => a - b); return { t, v: t.map((k) => m.get(k)), at: m };
}
// last close at or before time T (within 30 minutes), and the daily ATR14 (21:00 UTC days) at that time
function closeAt(S, T) { let lo = 0, hi = S.t.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (S.t[mid] <= T) { k = mid; lo = mid + 1; } else hi = mid - 1; } return k >= 0 && T - S.t[k] <= 1800 ? S.v[k][3] : null; }
function dailyBars(S) {
  const D = []; for (let i = 0; i < S.t.length; i++) { const key = Math.floor((S.t[i] + 3 * 3600) / 86400), [o, h, l, c] = S.v[i], x = D.at(-1);
    if (x && x.key === key) { x.h = Math.max(x.h, h); x.l = Math.min(x.l, l); x.c = c; x.n++; } else D.push({ key, o, h, l, c, n: 1 }); }
  return D.filter((d) => d.n >= 60);
}
const st = (v) => { const n = v.length; if (n < 2) return { n, m: NaN, t: NaN }; const m = v.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return { n, m, t: m / (sd / Math.sqrt(n)) }; };
const fmt = (s, u = "") => (Number.isFinite(s.m) ? `${s.m >= 0 ? "+" : ""}${s.m.toFixed(u === "%" ? 3 : 3)}${u} (t ${s.t.toFixed(2)}, n ${s.n})` : `n ${s.n}`);
const out = [];
const IDX = ["SPXUSD", "NSXUSD"].filter((s) => files[s]).map((s) => ({ sym: s, S: load(files[s]) }));
for (const x of IDX) x.D = dailyBars(x.S);

// ---- B2: pre-FOMC drift ----
{
  const byMeeting = [];
  for (const iso of FOMC) {
    const [y, m, d] = isoToYmd(iso); const stmt = nyToUtc(y, m - 1, d, 13, 55); if (stmt > END) continue;
    let prev = new Date(Date.UTC(y, m - 1, d)); do prev = new Date(prev.getTime() - 86400000); while ([0, 6].includes(prev.getUTCDay()));
    const start = nyToUtc(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate(), 14, 0);
    const legs = [];
    for (const x of IDX) {
      const a = closeAt(x.S, start), b = closeAt(x.S, stmt); if (a == null || b == null) continue;
      const di = x.D.findIndex((q) => q.key * 86400 + 21 * 3600 >= start) - 1; if (di < 15) continue;
      let atr = 0; for (let k = di - 13; k <= di; k++) atr += Math.max(x.D[k].h - x.D[k].l, Math.abs(x.D[k].h - x.D[k - 1].c), Math.abs(x.D[k].l - x.D[k - 1].c)); atr /= 14;
      const net = b / a - 1 - 0.0002 - 0.05 / 365;
      legs.push({ sym: x.sym, pct: 100 * net, gross: 100 * (b / a - 1), r: (net * a) / (3 * atr) });
    }
    if (legs.length) byMeeting.push({ iso, T: stmt, pct: legs.reduce((s, l) => s + l.pct, 0) / legs.length, gross: legs.reduce((s, l) => s + l.gross, 0) / legs.length, r: legs.reduce((s, l) => s + l.r, 0) / legs.length, legs });
  }
  const h = [0, 1].map((k) => byMeeting.filter((x) => (x.T < SPLIT ? 0 : 1) === k));
  const all = st(byMeeting.map((x) => x.pct)), pass = [0, 1].every((k) => st(h[k].map((x) => x.pct)).m > 0) && all.t >= 2;
  out.push(`B2 pre-FOMC drift (${byMeeting.length} meetings, ${byMeeting[0]?.iso} to ${byMeeting.at(-1)?.iso}; mean over the indices per meeting):`);
  out.push(`  gross ${fmt(st(byMeeting.map((x) => x.gross)), "%")}; net 2010-17 ${fmt(st(h[0].map((x) => x.pct)), "%")}, 2018-26 ${fmt(st(h[1].map((x) => x.pct)), "%")}, pooled ${fmt(all, "%")}`);
  out.push(`  in R (3 x daily ATR): 2010-17 ${fmt(st(h[0].map((x) => x.r)), "R")}, 2018-26 ${fmt(st(h[1].map((x) => x.r)), "R")}; per index: ` +
    IDX.map((x) => `${x.sym} ${fmt(st(byMeeting.flatMap((m) => m.legs.filter((l) => l.sym === x.sym).map((l) => l.pct))), "%")}`).join("; "));
  out.push(`  -> ${pass ? "PASS" : "fail"}`);
}

// ---- event days: FOMC (list), NFP and CPI (reconstructed from EURUSD's 08:30 New York minute) ----
const eventDays = new Map();   // "YYYY-MM-DD" (New York date) -> [names]
const add = (iso, n) => eventDays.set(iso, [...(eventDays.get(iso) || []), n]);
for (const iso of FOMC) add(iso, "FOMC");
if (files.EURUSD) {
  const E = load(files.EURUSD);
  const rangeAt = (y, m, d) => { const t = nyToUtc(y, m, d, 8, 30), v = E.at.get(t); return v ? v[1] - v[2] : null; };
  const pad = (n) => String(n).padStart(2, "0");
  let nfpN = 0, cpiN = 0;
  for (let y = 2010; y <= 2026; y++) for (let m = 0; m < 12; m++) {
    if (Date.UTC(y, m, 1) / 1000 > END) break;
    const days = (lo, hi, fri) => { const o = []; for (let d = lo; d <= hi; d++) { const wd = new Date(Date.UTC(y, m, d)).getUTCDay(); if (fri ? wd === 5 : wd >= 1 && wd <= 5) { const r = rangeAt(y, m, d); if (r != null) o.push({ d, r }); } } return o; };
    const f = days(1, 10, true).sort((a, b) => b.r - a.r)[0]; if (f) { add(`${y}-${pad(m + 1)}-${pad(f.d)}`, "NFP"); nfpN++; }
    const c = days(9, 16, false).filter((x) => !f || x.d !== f.d).sort((a, b) => b.r - a.r)[0]; if (c) { add(`${y}-${pad(m + 1)}-${pad(c.d)}`, "CPI"); cpiN++; }
  }
  out.push("", `Event days: ${FOMC.length} FOMC (list), ${nfpN} NFP and ${cpiN} CPI (reconstructed). Check: 2025-09-05 NFP ${(eventDays.get("2025-09-05") || []).join(",") || "missing"}; 2024-08-02 NFP ${(eventDays.get("2024-08-02") || []).join(",") || "missing"}`);

  // ---- B1: the index engine's signals with an event on the next trading day ----
  const rows = [];
  for (const x of IDX) {
    const D = x.D, sma = (i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += D[k].c; return s / n; };
    const atr = (i) => { let s = 0; for (let k = i - 13; k <= i; k++) s += Math.max(D[k].h - D[k].l, Math.abs(D[k].h - D[k - 1].c), Math.abs(D[k].l - D[k - 1].c)); return s / 14; };
    for (let i = 201; i < D.length - 1; i++) {
      if (!(D[i].c > sma(i, 200) && D[i].c < D[i - 1].c && D[i - 1].c < D[i - 2].c && D[i - 2].c < D[i - 3].c)) continue;
      const e = D[i].c, R = 3 * atr(i), stop = e - R; let n = 0, res = null, j = i + 1;
      for (; j < D.length; j++) { n++; if (D[j].l <= stop) { res = Math.min(stop, D[j].o); break; } if (D[j].c > sma(j, 5)) { res = D[j].c; break; } }
      if (res == null) break;
      const next = new Date(D[i + 1].key * 86400 * 1000).toISOString().slice(0, 10);   // the next trading day's date (its 21:00 UTC close)
      rows.push({ sym: x.sym, T: D[i].key * 86400, r: (res - e - e * (0.0002 + 0.05 / 252 * n)) / R, ev: eventDays.get(next) || null });
      i = j;   // one position at a time
    }
  }
  const half = (r) => (r.T < SPLIT ? 0 : 1), yrs = (Math.max(...rows.map((r) => r.T)) - Math.min(...rows.map((r) => r.T))) / (365.25 * 86400);
  const vet = rows.filter((r) => r.ev), keep = rows.filter((r) => !r.ev);
  const vh = [0, 1].map((k) => st(vet.filter((r) => half(r) === k).map((r) => r.r))), pass = vh[0].m < 0 && vh[1].m < 0;
  out.push(`B1 index veto (event on the next trading day): all signals ${fmt(st(rows.map((r) => r.r)), "R")}; vetoed ${fmt(st(vet.map((r) => r.r)), "R")} [2010-17 ${fmt(vh[0], "R")}, 2018-26 ${fmt(vh[1], "R")}]; kept ${fmt(st(keep.map((r) => r.r)), "R")}`);
  for (const n of ["FOMC", "NFP", "CPI"]) out.push(`  vetoed by ${n}: ${fmt(st(vet.filter((r) => r.ev.includes(n)).map((r) => r.r)), "R")}`);
  out.push(`  total R a year: without veto ${(rows.reduce((a, r) => a + r.r, 0) / yrs).toFixed(2)}, with veto ${(keep.reduce((a, r) => a + r.r, 0) / yrs).toFixed(2)} -> ${pass ? "PASS (adopt the veto)" : "fail (do not adopt)"}`);
}
console.log(out.join("\n"));
