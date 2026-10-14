// Demo validation record (README.md, "Demo validation record"): reads the EA's log and summarises, per engine
// (style), the entries, fills, costs, protective orders, exits, drawdown and net expectancy.
// node summarize.mjs <log files...>   — cTrader log text with "ZUGRIO {json}" lines, or logs/ea-*.jsonl files.
// It decides nothing and has no thresholds: it is the record the owner judges the EA on.
import fs from "fs";

export function records(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    // the start record carries the whole configuration and is cut off in the printed log; its plain line is not
    if (line.includes("Zugrio EA started:")) { out.push({ kind: "started_line", line: line.slice(line.indexOf("Zugrio EA started:")) }); continue; }
    const i = line.indexOf("{"); if (i < 0) continue;
    if (!line.startsWith("{") && !line.includes("ZUGRIO {")) continue;
    try { const r = JSON.parse(line.slice(i)); if (r && r.kind) out.push(r); } catch { /* a cut-off line */ }
  }
  // the same record can be in both the printed log and the file: keep one
  const seen = new Set();
  return out.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => ((a.t ?? "") < (b.t ?? "") ? -1 : (a.t ?? "") > (b.t ?? "") ? 1 : 0));
}

const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
function ci(v) {
  if (v.length < 2) return { n: v.length, mean: v.length ? v[0] : NaN, lo: NaN, hi: NaN };
  const m = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)), se = sd / Math.sqrt(v.length);
  return { n: v.length, mean: m, lo: m - 1.96 * se, hi: m + 1.96 * se };
}
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function summarize(recs) {
  const entries = recs.filter((r) => r.kind === "entry"), closes = recs.filter((r) => r.kind === "close");
  const styles = [...new Set([...entries, ...closes].map((r) => r.style || "?"))].sort();
  const byLabel = new Map(entries.map((e) => [e.label, e]));
  const result = { styles: {}, account: {} };
  for (const st of styles) {
    const en = entries.filter((e) => (e.style || "?") === st), cl = closes.filter((c) => (c.style || "?") === st);
    const slip = en.map((e) => num(e.slippagePips)).filter((x) => x !== null), spread = en.map((e) => num(e.spreadPips)).filter((x) => x !== null);
    const protectedAtEntry = en.filter((e) => num(e.brokerStop) !== null).length;
    const reasons = {}; for (const c of cl) reasons[c.reason] = (reasons[c.reason] || 0) + 1;
    const r = cl.map((c) => num(c.r)).filter((x) => x !== null), net = cl.map((c) => num(c.netProfit)).filter((x) => x !== null);
    const costs = cl.map((c) => num(c.costs)).filter((x) => x !== null), gross = cl.map((c) => num(c.grossProfit)).filter((x) => x !== null);
    result.styles[st] = {
      entries: en.length, closed: cl.length, unmatchedCloses: cl.filter((c) => !byLabel.has(c.label)).length,
      protectedAtEntry, slippagePips: ci(slip), spreadPips: ci(spread), exits: reasons,
      grossProfit: gross.reduce((s, x) => s + x, 0), costs: costs.reduce((s, x) => s + x, 0), netProfit: net.reduce((s, x) => s + x, 0),
      netR: ci(r), won: cl.filter((c) => num(c.netProfit) > 0).length,
      stopMoves: recs.filter((x) => x.kind === "protect_profit" && x.style === st).length,
    };
  }
  const eq = recs.filter((r) => r.kind === "equity" || r.kind === "stop");
  result.account = {
    starts: Math.max(recs.filter((r) => r.kind === "start").length, recs.filter((r) => r.kind === "started_line").length),
    maxDrawdown: Math.max(0, ...eq.map((r) => num(r.maxDrawdown) ?? 0)),
    maxDrawdownPct: Math.max(0, ...eq.map((r) => num(r.maxDrawdownPct) ?? 0)),
    protectionFailed: recs.filter((r) => r.kind === "protection_failed").length,
    rejected: recs.filter((r) => r.kind === "order_rejected").length,
    submissionUnknown: recs.filter((r) => r.kind === "submission_unknown").length,
    killSwitch: recs.filter((r) => r.kind === "kill_switch").length,
    configs: [...new Set(recs.map((r) => r.cfg).filter(Boolean))], engines: [...new Set(recs.map((r) => r.eng).filter(Boolean))],
    from: recs.find((r) => r.t)?.t, to: [...recs].reverse().find((r) => r.t)?.t,
  };
  return result;
}

export function format(s) {
  const f = (x, d = 2) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(d) : "n/a");
  const c = (x, d = 2) => `${f(x.mean, d)} [${f(x.lo, d)}, ${f(x.hi, d)}] (n ${x.n})`;
  const a = s.account, lines = [
    `Demo record ${a.from ?? "?"} to ${a.to ?? "?"}: ${a.starts} start(s); config ${a.configs.join(", ") || "?"}; engine ${a.engines.join(", ") || "?"}` +
      (a.configs.length > 1 || a.engines.length > 1 ? " (MORE THAN ONE: the engines or parameters changed during the record)" : ""),
    `Deepest drawdown (largest within one start) ${a.maxDrawdown.toFixed(2)} (${a.maxDrawdownPct.toFixed(1)}%); protection failures ${a.protectionFailed}; rejected orders ${a.rejected}; unknown submissions ${a.submissionUnknown}; kill-switch events ${a.killSwitch}`,
  ];
  for (const [st, x] of Object.entries(s.styles)) {
    lines.push(`${st}: ${x.entries} entries (${x.protectedAtEntry} with a broker stop on the fill), ${x.closed} closed (${x.won} won), ${x.stopMoves} stop moves`,
      `  spread at submit, pips ${c(x.spreadPips)}; slippage vs quote, pips (+ = worse) ${c(x.slippagePips)}`,
      `  exits ${Object.entries(x.exits).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}; gross ${x.grossProfit.toFixed(2)}, costs ${x.costs.toFixed(2)}, net ${x.netProfit.toFixed(2)}`,
      `  net expectancy per trade ${c(x.netR)} R` + (x.unmatchedCloses ? `; ${x.unmatchedCloses} closes without their entry in these logs` : ""));
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("node summarize.mjs <log files...>"); process.exit(2); }
  console.log(format(summarize(records(files.map((p) => fs.readFileSync(p, "utf8")).join("\n")))));
}
