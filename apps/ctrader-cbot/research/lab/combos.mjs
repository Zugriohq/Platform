import { readFileSync } from "node:fs";
const [style, ...files] = process.argv.slice(2);
const T = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")).setups).filter((x) => x.outcome === "TRIGGER");
const split = T.map((x) => x.t).sort()[Math.floor(T.length / 2)];
const rev = (x) => x.candleSweep.some((c) => (x.side === "BUY" ? ["HAMMER", "BULLISH_ENGULFING", "MORNING_STAR"] : ["SHOOTING_STAR", "BEARISH_ENGULFING", "EVENING_STAR"]).includes(c));
const h4 = (x) => x.bias.H4 === (x.side === "BUY" ? "BULL" : "BEAR");
const S = (xs, k) => { const rs = xs.map(k).filter((r) => r !== null && Number.isFinite(r)); const n = rs.length; if (!n) return "n=0".padEnd(22);
  const m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / Math.max(1, n - 1));
  return `n=${String(n).padStart(4)} ${String(Math.round(100 * rs.filter((r) => r > 0).length / n)).padStart(3)}% ${(m >= 0 ? "+" : "") + m.toFixed(2)}±${(sd / Math.sqrt(n)).toFixed(2)}`.padEnd(22); };
const k2 = (x) => x.r_2R?.r ?? null, kl = (x) => x.r_2R_lim50?.r ?? null;
const C = { "FVG": (x) => x.fvg, "FVG + reversal candle": (x) => x.fvg && rev(x), "FVG + inducement": (x) => x.fvg && x.inducement,
  "FVG + H4 with": (x) => x.fvg && h4(x), "FVG + (candle or inducement)": (x) => x.fvg && (rev(x) || x.inducement),
  "FVG + (candle or inducement) + H4 with": (x) => x.fvg && (rev(x) || x.inducement) && h4(x), "reversal candle + H4 with": (x) => rev(x) && h4(x) };
console.log(`${style}  (columns: early half | late half, market 2R and limit-50% entry)`);
for (const [n, f] of Object.entries(C)) { const xs = T.filter(f), e = xs.filter((x) => x.t < split), l = xs.filter((x) => x.t >= split);
  console.log(`${n.padEnd(40)} mkt ${S(e, k2)}| ${S(l, k2)}  lim ${S(e, kl)}| ${S(l, kl)}`); }
