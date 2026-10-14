// node --test research/demo/summarize.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { records, summarize, format } from "./summarize.mjs";

const log = [
  "15/10/2026 13:50:00.000 | Info | Zugrio EA started: demo account 123. Index engine on US 500.",
  'ZUGRIO {"t":"2026-10-15T13:50:00Z","kind":"start","cfg":"aaa","eng":"bbb","balance":1000}',
  '15/10/2026 13:51:00.000 | Info | ZUGRIO {"t":"2026-10-15T13:51:00Z","kind":"entry","cfg":"aaa","eng":"bbb","style":"INDEX","label":"L1","fill":5000.5,"brokerStop":4950,"spreadPips":0.6,"slippagePips":0.2}',
  'ZUGRIO {"t":"2026-10-16T14:00:00Z","kind":"close","cfg":"aaa","eng":"bbb","style":"INDEX","label":"L1","reason":"TakeProfit","netProfit":30,"grossProfit":31,"costs":1,"r":1.5}',
  'ZUGRIO {"t":"2026-10-16T14:00:00Z","kind":"close","cfg":"aaa","eng":"bbb","style":"INDEX","label":"L1","reason":"TakeProfit","netProfit":30,"grossProfit":31,"costs":1,"r":1.5}',
  'ZUGRIO {"t":"2026-10-17T13:51:00Z","kind":"entry","cfg":"aaa","eng":"bbb","style":"INDEX","label":"L2","fill":5010,"brokerStop":4960,"spreadPips":0.8,"slippagePips":-0.1}',
  'ZUGRIO {"t":"2026-10-17T20:00:00Z","kind":"close","cfg":"aaa","eng":"bbb","style":"INDEX","label":"L2","reason":"StopLoss","netProfit":-21,"grossProfit":-20,"costs":1,"r":-1.05}',
  'ZUGRIO {"t":"2026-10-17T21:00:00Z","kind":"equity","cfg":"aaa","eng":"bbb","maxDrawdown":25.5,"maxDrawdownPct":2.5}',
  'ZUGRIO {"t":"2026-10-17T22:00:00Z","kind":"entry","style":"INDEX"', // cut off: ignored
].join("\n");

test("summarises the demo record per engine", () => {
  const s = summarize(records(log));
  const x = s.styles.INDEX;
  assert.equal(x.entries, 2); assert.equal(x.closed, 2);            // the duplicate close is counted once
  assert.equal(x.protectedAtEntry, 2);
  assert.deepEqual(x.exits, { TakeProfit: 1, StopLoss: 1 });
  assert.equal(x.costs, 2); assert.equal(x.netProfit, 9);
  assert.ok(Math.abs(x.netR.mean - 0.225) < 1e-9);
  assert.ok(Math.abs(x.slippagePips.mean - 0.05) < 1e-9);
  assert.equal(s.account.maxDrawdown, 25.5);
  assert.deepEqual(s.account.configs, ["aaa"]);
  assert.equal(s.account.starts, 1);                                  // the printed start line and the start record are one start
  assert.match(format(s), /INDEX: 2 entries \(2 with a broker stop on the fill\), 2 closed \(1 won\)/);
});

test("flags a record that spans changed engines or parameters", () => {
  const s = summarize(records(log + '\nZUGRIO {"t":"2026-10-18T00:00:00Z","kind":"start","cfg":"ccc","eng":"bbb"}'));
  assert.match(format(s), /MORE THAN ONE/);
});

test("summarises the EUR hours shadow record (no orders)", () => {
  const s = summarize(records(log + "\n" + [
    'ZUGRIO {"t":"2026-10-19T12:00:00Z","kind":"eur_shadow","netBp":1.5,"grossBp":2.0,"spreadOpenPips":0.5,"spreadClosePips":0.7}',
    'ZUGRIO {"t":"2026-10-20T12:00:00Z","kind":"eur_shadow","netBp":-0.5,"grossBp":0.0,"spreadOpenPips":0.4,"spreadClosePips":0.6}',
  ].join("\n")));
  assert.equal(s.eurShadow.days, 2);
  assert.ok(Math.abs(s.eurShadow.netBp.mean - 0.5) < 1e-9);
  assert.ok(Math.abs(s.eurShadow.spreadPips.mean - 0.55) < 1e-9);
  assert.match(format(s), /EUR hours shadow \(no orders\): 2 days/);
});
