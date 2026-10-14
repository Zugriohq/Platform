// The engine's rule (causal sigma, stop 3xATR14, hold H) at a range of spreads; also the M1 ATR and what the EA's
// generic "spread <= 0.25 x stop distance" rule allows (stop = 3 x ATR14).
import fs from "fs";
for (const [file, L, H, minSp] of [["DSI10", 2, 5, 0.22], ["DSI20", 5, 10, 0.2], ["DSI30", 8, 15, 0.39]]) {
  const b = fs.readFileSync(`m1/${file}.m1`), f = new Float64Array(b.buffer, b.byteOffset, b.length / 8), n = f.length / 5;
  const o = [], h = [], l = [], c = []; for (let i = 0; i < n; i++) { o.push(f[5*i+1]); h.push(f[5*i+2]); l.push(f[5*i+3]); c.push(f[5*i+4]); }
  const r = [0]; for (let i = 1; i < n; i++) r.push(c[i] / c[i-1] - 1);
  const atr = (i) => { let s = 0; for (let k = i - 13; k <= i; k++) s += Math.max(h[k] - l[k], Math.abs(h[k] - c[k-1]), Math.abs(l[k] - c[k-1])); return s / 14; };
  let sig = NaN; const sigAt = []; for (let i = 0; i < n; i++) { if (i >= 1440 && i % 60 === 0) { const w = r.slice(i - 1440, i).sort((a, b) => a - b), med = w[720]; sig = 1.4826 * w.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[720]; } sigAt.push(sig); }
  // trades once, record gross points and ATR at entry
  const tr = [];
  for (let i = 1440 + L; i + H < n;) {
    const s = sigAt[i], move = c[i] / c[i - L] - 1, a = atr(i);
    if (!(s > 0) || Math.abs(move) < s * Math.sqrt(L)) { i++; continue; }
    const d = Math.sign(move), e = c[i], st = e - d * 3 * a; let x = c[i + H], k = i + H;
    for (let j = i + 1; j <= i + H; j++) if (d > 0 ? l[j] <= st : h[j] >= st) { x = d > 0 ? Math.min(o[j], st) : Math.max(o[j], st); k = j; break; }
    tr.push({ pts: d * (x - e), a }); i = k;
  }
  const atrs = tr.map((t) => t.a).sort((x, y) => x - y), q = (p) => atrs[Math.floor(p * (atrs.length - 1))];
  const gross = tr.reduce((s, t) => s + t.pts, 0) / tr.length;
  const perDay = tr.length / ((n - 1440) / 1440);
  console.log(`${file}: ${tr.length} trades (${perDay.toFixed(0)}/day); ATR14(M1) median ${q(0.5).toFixed(3)}, 10th pct ${q(0.1).toFixed(3)}, 90th ${q(0.9).toFixed(3)}; generic rule allows spread up to 0.25 x 3 x ATR = ${(0.75 * q(0.5)).toFixed(2)} at median ATR (${(0.75 * q(0.1)).toFixed(2)} at the 10th pct)`);
  console.log(`   gross ${gross.toFixed(3)} points per trade = break-even spread; net points per trade at spread:` + [0.2, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map((sp) => ` ${sp}: ${(gross - sp).toFixed(2)}`).join(";"));
  // expectancy in risk units (risk = 3 ATR) at given spreads
  console.log(`   net per trade in risk units (stop = 1):` + [minSp, 0.5, 1, 1.5, 2].map((sp) => ` spread ${sp}: ${(tr.reduce((s, t) => s + (t.pts - sp) / (3 * t.a), 0) / tr.length).toFixed(3)}`).join(";"));
}
