// Reads backtest outputs and reports expectancy (avg R) of the EA as it is, of each filter's skipped
// trades, and of candidate features, split into an early (in-sample) and late (out-of-sample) half.
import { readFileSync } from "node:fs";
const files = process.argv.slice(2);
const all = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")).trades).filter((x) => x.r !== null);
const split = all.map((x) => x.t).sort()[Math.floor(all.length / 2)];
const stat = (xs) => {
  const n = xs.length; if (!n) return "n=0";
  const rs = xs.map((x) => x.r), m = rs.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(rs.reduce((s, r) => s + (r - m) ** 2, 0) / Math.max(1, n - 1));
  return `n=${String(n).padStart(4)} win ${String(Math.round(100 * rs.filter((r) => r > 0).length / n)).padStart(3)}% avg ${(m >= 0 ? "+" : "") + m.toFixed(3)}R ±${(sd / Math.sqrt(n)).toFixed(3)} sum ${(rs.reduce((s, r) => s + r, 0)).toFixed(1)}R`;
};
const row = (name, xs) => console.log(`${name.padEnd(44)} ${stat(xs).padEnd(58)} | early ${stat(xs.filter((x) => x.t < split)).padEnd(52)} | late ${stat(xs.filter((x) => x.t >= split))}`);
const taken = all.filter((x) => !x.skip);
console.log(`Trades ${all.length} (all READY setups that could be priced), split at ${split}\n`);
console.log("== The EA as it is (all filters on) =="); row("taken", taken);
for (const s of [...new Set(taken.map((x) => x.symbol))]) row("  " + s, taken.filter((x) => x.symbol === s));
console.log("\n== What each filter removes (shadow trades) ==");
for (const k of ["TREND_NOT_ALIGNED", "COUNTER_TREND_RECLAIM", "STOP_TOO_CLOSE", "SPREAD_TOO_WIDE", "POSITION_OPEN"]) row(k, all.filter((x) => x.skip === k));
const pool = all.filter((x) => !x.skip || x.skip === "POSITION_OPEN");   // every tradable setup, ignoring the one-at-a-time limit
console.log("\n== Features over all tradable setups ==");
row("all tradable", pool);
for (const r of ["CONTINUATION_RETEST", "REVERSAL_RECLAIM"]) row("route " + r, pool.filter((x) => x.route === r));
const aligned = (x, tr) => tr === (x.side === "BUY" ? "UP" : "DOWN"), against = (x, tr) => tr === (x.side === "BUY" ? "DOWN" : "UP");
for (const [n, k] of [["H4", "h4Trend"], ["D1", "d1Trend"]]) {
  row(`${n} trend with the trade`, pool.filter((x) => aligned(x, x[k])));
  row(`${n} trend against the trade`, pool.filter((x) => against(x, x[k])));
  row(`${n} trend mixed/unknown`, pool.filter((x) => !aligned(x, x[k]) && !against(x, x[k])));
}
row("H1+H4 both with the trade", pool.filter((x) => aligned(x, x.trend) && aligned(x, x.h4Trend)));
row("buy in H4 discount (<0.5) / sell in premium", pool.filter((x) => (x.side === "BUY") === (x.h4Loc < 0.5)));
row("buy in H4 premium / sell in discount", pool.filter((x) => (x.side === "BUY") !== (x.h4Loc < 0.5)));
for (const [n, lo, hi] of [["Asia 00-07", 0, 7], ["London 07-12", 7, 12], ["London/NY 12-16", 12, 16], ["NY 16-21", 16, 21], ["late 21-24", 21, 24]]) row("session " + n, pool.filter((x) => x.hour >= lo && x.hour < hi));
for (const [n, lo, hi] of [["rr < 1.5", 0, 1.5], ["rr 1.5-3", 1.5, 3], ["rr 3-6", 3, 6], ["rr >= 6", 6, 1e9]]) row(n, pool.filter((x) => x.rr >= lo && x.rr < hi));
for (const [n, lo, hi] of [["stop 0.3-0.5 ATR", 0, 0.5], ["stop 0.5-0.8 ATR", 0.5, 0.8], ["stop >= 0.8 ATR", 0.8, 1e9]]) row(n, pool.filter((x) => x.stopAtr >= lo && x.stopAtr < hi));
for (const [n, lo, hi] of [["ATR regime < 0.8 (quiet)", 0, 0.8], ["ATR regime 0.8-1.2", 0.8, 1.2], ["ATR regime >= 1.2 (active)", 1.2, 1e9]]) row(n, pool.filter((x) => x.atrRegime >= lo && x.atrRegime < hi));
for (const h of ["SL", "TP", "TRAIL", "END"]) row("exit " + h, taken.filter((x) => x.how === h));
