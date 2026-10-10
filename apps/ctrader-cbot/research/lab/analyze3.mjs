// Top-down model: expectancy of each component, early vs late half. Usage: node analyze3.mjs STYLE files...
import { readFileSync } from "node:fs";
const [style, ...files] = process.argv.slice(2);
const T = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")).setups).filter((x) => x.outcome === "TRIGGER");
const split = T.map((x) => x.t).sort()[Math.floor(T.length / 2)];
const al = (x, tf) => x.bias[tf] === (x.side === "BUY" ? "BULL" : "BEAR"), op = (x, tf) => x.bias[tf] === (x.side === "BUY" ? "BEAR" : "BULL");
const disc = (x, tf) => Number.isFinite(x.pos[tf]) && (x.side === "BUY" ? x.pos[tf] < 0.5 : x.pos[tf] > 0.5);
const tfs = Object.keys(T[0]?.bias ?? {}), locs = Object.keys(T[0]?.pos ?? {});
const S = (xs, key) => { const rs = xs.map((x) => key(x)).filter((r) => r !== null && Number.isFinite(r)); const n = rs.length; if (!n) return "n=0";
  const m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / Math.max(1, n - 1));
  return `n=${String(n).padStart(4)} ${String(Math.round(100 * rs.filter((r) => r > 0).length / n)).padStart(3)}% ${(m >= 0 ? "+" : "") + m.toFixed(2)}±${(sd / Math.sqrt(n)).toFixed(2)}`; };
const r2 = (x) => x.r_2R?.r ?? null, rl = (x) => x.r_liq?.r ?? null, rm = (x) => x.r_2R_lim50?.r ?? null;
const row = (name, f) => { const xs = T.filter(f), e = xs.filter((x) => x.t < split), l = xs.filter((x) => x.t >= split);
  console.log(`${name.padEnd(40)} 2R ${S(xs, r2).padEnd(24)} [early ${S(e, r2).padEnd(22)} late ${S(l, r2).padEnd(22)}]  liq ${S(xs, rl).padEnd(22)} lim50 ${S(xs, rm)}`); };
console.log(`${style}: ${T.length} triggered setups, split ${split}`);
row("all", () => true);
for (const tf of tfs) { row(`${tf} bias with the trade`, (x) => al(x, tf)); row(`${tf} bias against`, (x) => op(x, tf)); }
for (const tf of locs) { row(`${tf} discount buy / premium sell`, (x) => disc(x, tf)); row(`${tf} premium buy / discount sell`, (x) => Number.isFinite(x.pos[tf]) && !disc(x, tf)); }
const top = tfs.slice(0, 2), mid = tfs.slice(2);
row(`top-down: ${top.join("+")} aligned`, (x) => top.every((tf) => al(x, tf)));
row(`top-down: ${tfs.join("+")} all aligned`, (x) => tfs.every((tf) => al(x, tf)));
row(`top-down: ${top[1]} aligned + ${locs[0]} discount`, (x) => al(x, top[1]) && disc(x, locs[0]));
row(`top-down: ${top[1]} aligned + ${locs[1]} discount`, (x) => al(x, top[1]) && disc(x, locs[1]));
row(`top-down: ${top.join("+")} aligned + ${locs[1]} discount`, (x) => top.every((tf) => al(x, tf)) && disc(x, locs[1]));
row(`pullback sweep (${top[1]} aligned, ${mid.at(-1)} against)`, (x) => al(x, top[1]) && op(x, mid.at(-1)));
row("counter-trend (" + top.join("+") + " against)", (x) => top.every((tf) => op(x, tf)));
row("displacement on the shift", (x) => x.displacement); row("no displacement", (x) => !x.displacement);
row("FVG in the shift leg", (x) => x.fvg); row("inducement taken first", (x) => x.inducement);
row("reversal candle at sweep (hammer/star/engulf)", (x) => x.candleSweep.some((c) => ["HAMMER", "SHOOTING_STAR", "BULLISH_ENGULFING", "BEARISH_ENGULFING", "MORNING_STAR", "EVENING_STAR"].includes(c) && (x.side === "BUY" ? !["SHOOTING_STAR", "BEARISH_ENGULFING", "EVENING_STAR"].includes(c) : !["HAMMER", "BULLISH_ENGULFING", "MORNING_STAR"].includes(c))));
row("doji at sweep", (x) => x.candleSweep.includes("DOJI"));
for (const k of [...new Set(T.map((x) => x.level))].sort()) row(`level ${k}`, (x) => x.level === k);
if (style !== "SWING") for (const [n, a, b] of [["Asia 00-07", 0, 7], ["London 07-12", 7, 12], ["NY 12-17", 12, 17], ["late 17-24", 17, 24]]) row(`session ${n}`, (x) => x.hour >= a && x.hour < b);
for (const s of [...new Set(T.map((x) => x.symbol))]) row(`market ${s}`, (x) => x.symbol === s);
for (const [n, a, b] of [["stop < 1 ATR", 0, 1], ["stop 1-2 ATR", 1, 2], ["stop 2-4 ATR", 2, 4], ["stop >= 4 ATR", 4, 1e9]]) row(n, (x) => x.stopAtr >= a && x.stopAtr < b);
