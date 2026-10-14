// Exit variants x candidate filters, early (in-sample) vs late (out-of-sample) halves.
import { readFileSync } from "node:fs";
const all = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, "utf8")).trades).filter((x) => x.r !== null && x.rv);
const split = all.map((x) => x.t).sort()[Math.floor(all.length / 2)];
const pool = all.filter((x) => !x.skip || x.skip === "POSITION_OPEN");
const variants = Object.keys(pool[0].rv);
const m = (xs, v) => { const rs = xs.map((x) => x.rv[v]); const n = rs.length; if (!n) return { n, avg: NaN, se: NaN, win: NaN };
  const avg = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - avg) ** 2, 0) / Math.max(1, n - 1));
  return { n, avg, se: sd / Math.sqrt(n), win: rs.filter((r) => r > 0).length / n }; };
const fmt = (s) => s.n ? `${(s.avg >= 0 ? "+" : "") + s.avg.toFixed(2)}±${s.se.toFixed(2)} (${Math.round(100 * s.win)}%)` : "n/a";
const filters = {
  "EA rules as they are": () => true,
  "+ location (buy discount / sell premium)": (x) => (x.side === "BUY") === (x.h4Loc < 0.5),
  "+ no Asia / late session (07-21 UTC only)": (x) => x.hour >= 7 && x.hour < 21,
  "+ without USDJPY": (x) => x.symbol !== "USDJPY",
  "+ location + session": (x) => (x.side === "BUY") === (x.h4Loc < 0.5) && x.hour >= 7 && x.hour < 21,
  "+ location + session + without USDJPY": (x) => (x.side === "BUY") === (x.h4Loc < 0.5) && x.hour >= 7 && x.hour < 21 && x.symbol !== "USDJPY",
};
for (const [name, f] of Object.entries(filters)) {
  const xs = pool.filter(f), early = xs.filter((x) => x.t < split), late = xs.filter((x) => x.t >= split);
  console.log(`\n${name}: n=${xs.length} (early ${early.length}, late ${late.length})`);
  for (const v of variants) console.log(`  ${v.padEnd(16)} all ${fmt(m(xs, v)).padEnd(20)} early ${fmt(m(early, v)).padEnd(20)} late ${fmt(m(late, v))}`);
}
