# Tick Data Source for the Synthetic Null Harness (#118)

Status: **decided 2026-10-15** (engineering decision inside research scope; no capital authority).
Constraints: D1 (CFD-only) and D2 (cTrader/MT5 routing), recorded in PR #117 §0.

## Decision

| Role | Source | Why |
|---|---|---|
| **Primary** | Tick export from **Deriv's MT5 server** (MT5 terminal → Symbols → Ticks → Request → Export). A demo account is sufficient. | It is the venue D2 executes on, so the series comes from the same generator as the traded symbol by construction. It also carries **bid and ask**, which the CFD cost model (D1) needs. |
| **Secondary / cross-check** | Deriv public WebSocket API `ticks_history` (`scripts/fetch_deriv_ticks.py`) | Gives a single spot quote only (no bid/ask). Its history may be longer. It is admissible **only after** `feed_check` passes against an MT5 export over an overlapping window. |
| **Deferred** | cTrader (Deriv cTrader) | cTrader is the first Release 1 Semi-Auto broker. Deriv lists Crash/Boom on cTrader, but whether the other families are offered there is unconfirmed. Before a Slice 4 result is applied to a cTrader scope, the cTrader feed must pass the same `feed_check`. Until then, results are scoped to the **MT5-venue symbols**. |

## Who runs it

The founder runs the exports on their own machine. No broker credentials, tokens or account identifiers enter this repository or the agent environment. A demo login is enough and needs no trading scope.

This agent environment **cannot** fetch Deriv data. Its egress proxy does not support WebSocket upgrades: `ws.derivws.com`, `ws.binaryws.com`, `green.derivws.com` and `blue.derivws.com` all return HTTP 520 (checked 2026-10-15).

## Storage

- Raw exports are **not committed** to git, for reasons of size and possible broker terms. Place them under `research/synthetic-null/data/`, which is git-ignored, and archive them in object storage (`STACK.md`).
- What *is* committed is a dataset manifest per file: `dataset_id` (SHA-256 of the canonical tick array), source, symbol, server, export time, tick count, first and last timestamps, and gap report. `python -m synthnull.data manifest <file>` produces it.

## Feed check (secondary → admissible)

`python -m synthnull.feed_check <mt5_export.csv> <deriv_ticks.jsonl>` aligns the two series on whole-second timestamps over their overlap and reports:

- overlap tick count;
- fraction of aligned ticks where |MT5 mid − API spot| ≤ 1 price increment;
- correlation of aligned increments.

Pass criteria, fixed before any comparison is run:

- ≥ 10,000 aligned ticks;
- ≥ 99% within one increment;
- increment correlation ≥ 0.99.

A failed check means the API series is a different feed, and it is not used.

## Open items to resolve on the first export

1. **MT5 server time zone.** It is recorded per export and needed for the swap-rollover cost. It is not assumed.
2. **Tick history depth** that the server provides per symbol. This decides whether the secondary source is needed at all.
3. Whether the MT5 export contains every generator tick or a thinned stream. Compare tick intervals against the documented 1 s / 2 s cadence.
4. Which symbol names the server uses. The harness keys instruments by an explicit mapping, never by regex on symbol names (ADR-0001).

## Requested from the founder

For each instrument in the first batch, one MT5 tick export of at least the most recent 30 contiguous days, or the maximum the server provides if less. First batch, in compute order:

1. Boom 500, Boom 1000, Crash 500, Crash 1000
2. Jump 10, 25, 50, 75, 100
3. Step Index
4. Volatility 10, 25, 50, 75, 100, plus their (1s) variants

The 30-day figure is a planning target only. The predeclaration file fixes the actual calibration, test and holdout window lengths before the test or holdout windows are read, and the positive-control power curve shows whether those lengths are enough.
