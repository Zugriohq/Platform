// Replays the engine's Drift Switch trades (all three indices, 90 days, at Deriv's min spread) through the EA's risk
// rules: risk 1% of balance per trade (sized to the stop), the daily loss limit (5% of day-start equity, or less if
// "never lose more than yesterday made" is on), the profit lock (keep 50% of the day's peak gain), and a position cap.
import fs from "fs";
function trades(file, L, H, spread) {
  const b = fs.readFileSync(`m1/${file}.m1`), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = f.length / 5;
  const t = [], o = [], h = [], l = [], c = []; for (let i = 0; i < n; i++) { t.push(f[5*i]); o.push(f[5*i+1]); h.push(f[5*i+2]); l.push(f[5*i+3]); c.push(f[5*i+4]); }
  const r = [0]; for (let i = 1; i < n; i++) r.push(c[i] / c[i-1] - 1);
  const atr = (i) => { let s = 0; for (let k = i - 13; k <= i; k++) s += Math.max(h[k] - l[k], Math.abs(h[k] - c[k-1]), Math.abs(l[k] - c[k-1])); return s / 14; };
  let sig = NaN; const sigAt = []; for (let i = 0; i < n; i++) { if (i >= 1440 && i % 60 === 0) { const w = r.slice(i - 1440, i).sort((a, b) => a - b), med = w[720]; sig = 1.4826 * w.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[720]; } sigAt.push(sig); }
  const out = []; let busy = -1;
  for (let i = 1440 + L; i + H < n; i++) {
    if (i <= busy) continue;
    const s = sigAt[i], move = c[i] / c[i - L] - 1, a = atr(i);
    if (!(s > 0) || Math.abs(move) < s * Math.sqrt(L)) continue;
    const d = Math.sign(move), e = c[i], st = e - d * 3 * a; let x = c[i + H], k = i + H;
    for (let j = i + 1; j <= i + H; j++) if (d > 0 ? l[j] <= st : h[j] >= st) { x = d > 0 ? Math.min(o[j], st) : Math.max(o[j], st); k = j; break; }
    out.push({ open: t[i] + 60, close: t[k] + 60, R: (d * (x - e) - spread) / (3 * a), sym: file }); busy = k;   // R per unit of risk (stop = 1)
  }
  return out;
}
const all = [...trades("DSI10", 2, 5, 0.22), ...trades("DSI20", 5, 10, 0.2), ...trades("DSI30", 8, 15, 0.39)].sort((a, b) => a.open - b.open);
function sim({ balance0, riskPct, maxPos, protectPrev, lock, maxLossPct = 5 }) {
  let bal = balance0, day = -1, dayStart = bal, prevDay = 0, peak = bal, taken = 0, skipped = 0; const open = []; let tripDays = 0, tripped = false; const days = new Map();
  const events = all.map((x) => x);
  for (const tr of events) {
    // close finished positions first
    for (let k = open.length - 1; k >= 0; k--) if (open[k].close <= tr.open) { bal += open[k].pnl; open.splice(k, 1); }
    const d = Math.floor(tr.open / 86400);
    if (d !== day) { if (day >= 0) { prevDay = bal - dayStart; days.set(day, prevDay); } day = d; dayStart = bal; peak = bal; if (tripped) tripDays++; tripped = false; }
    peak = Math.max(peak, bal);
    let limit = dayStart * maxLossPct / 100; if (protectPrev && prevDay > 0) limit = Math.min(limit, prevDay);
    let floor = dayStart - limit; if (lock > 0 && peak > dayStart) floor = Math.max(floor, dayStart + lock * (peak - dayStart));
    const openRisk = open.reduce((s, p) => s + p.risk, 0), room = bal - floor - openRisk;
    if (bal <= floor) tripped = true;
    let risk = Math.min(bal * riskPct / 100, room);
    if (tripped || open.length >= maxPos || risk < 0.25 * bal * riskPct / 100) { skipped++; continue; }   // below a quarter of the normal size: the broker minimum would refuse it
    open.push({ close: tr.close, risk, pnl: tr.R * risk }); taken++;
  }
  for (const p of open) bal += p.pnl;
  return { taken, skipped, final: bal, ret: 100 * (bal / balance0 - 1), tripDays };
}
console.log(`${all.length} Drift Switch trades over 90 days (three indices), average +${(all.reduce((s, x) => s + x.R, 0) / all.length).toFixed(3)} per unit risked`);
for (const cfg of [
  { name: "before: EA defaults, $200, crypto holding 1 of 2 slots", balance0: 200, riskPct: 1, maxPos: 1, protectPrev: true, lock: 0.5 },
  { name: "after: own 3 drift slots, daily rules as now, $200", balance0: 200, riskPct: 1, maxPos: 3, protectPrev: true, lock: 0.5 },
  { name: "after: own 3 slots, no 'yesterday' rule, lock 50%", balance0: 200, riskPct: 1, maxPos: 3, protectPrev: false, lock: 0.5 },
  { name: "after: own 3 slots, no 'yesterday' rule, no lock", balance0: 200, riskPct: 1, maxPos: 3, protectPrev: false, lock: 0 },
]) { const r = sim(cfg); console.log(`${cfg.name.padEnd(56)} taken ${String(r.taken).padStart(6)} of ${all.length}, refused ${String(r.skipped).padStart(6)}, days stopped early ${String(r.tripDays).padStart(2)}`); }
