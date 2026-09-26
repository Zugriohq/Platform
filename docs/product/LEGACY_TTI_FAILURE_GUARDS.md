# Legacy TTI failures → Zugrio regression guards

Status: engineering migration ledger, not performance evidence.

This document records product/engine failures observed during TTI 5.14–5.16 work and the corresponding Zugrio guard. It prevents old defects from silently returning under a new UI or name. It does **not** import TTI profitability claims, calibration, or authority into Zugrio.

The frozen authority source remains `docs/architecture/frozen/Zugrio_Signal_Authority_Architecture_v1.0.2_FROZEN.md`.

## Guard matrix

| Legacy failure | Zugrio guard | Current status |
|---|---|---|
| Break candle could effectively double as retest/confirmation | Research lifecycle observer requires source-bar chronology strictly after the confirmed break source bar. Fresh request time cannot change that. | Implemented + tested |
| Valid BOS/retest looked missed because retest persistence was fragile | Retest touch and hold are explicit lifecycle facts with an append-only diagnostic trace; deterministic OHLC overlap/hold extraction is available from frozen geometry. | Implemented + tested |
| Mandatory retest caused valid strong continuations to disappear | Frozen continuation lifecycle is represented behind `continuationReferenceEnabled`; it is research-only and defaults off. | Implemented + tested; no production authority |
| Fixed/over-aggressive candle timer killed setups | Lifecycle observer has no implicit bar-count expiry. `EXPIRED` requires explicit policy evidence. | Implemented + tested |
| Invalid/expired setup later resurrected | Terminal lifecycle is sticky; later evidence is diagnostic only. | Implemented + tested |
| Incomplete cached candle was treated as closed | `INCOMPLETE` observations cannot advance lifecycle. | Implemented + tested |
| Fresh request timestamp renewed stale trade evidence | Source close time and explicit freshness status remain separate from request/known time. Stale evidence cannot advance. | Implemented + tested |
| A failing first candidate hid another valid candidate | `observeCandidateSet` evaluates and returns every distinct candidate; duplicate IDs fail instead of overwrite. | Implemented + tested |
| Rolling/index-derived identity destabilized setups | Lifecycle observer consumes a stable upstream `candidateId` and never derives identity from array position. | Implemented + tested |
| BUY/SELL intelligence interfered prematurely | Opposite-direction candidates coexist in research observation. Execution conflict policy remains downstream. | Implemented + tested |
| Universal monthly/HTF agreement suppressed short-horizon trades | Timeframe evidence gate evaluates only the profile-declared required timeframes. | Implemented + tested |
| Stale current entry remained presented as if still obtainable | Current-entry recheck separates historical event identity from fresh quote, geometry, cost, runway and continuity facts. | Implemented + tested |
| Later request time could make old entry look fresh | Entry freshness is an explicit provenance-bearing predicate; evaluation time alone cannot renew it. | Implemented + tested |
| Generic/specialist routing locked synthetics before useful structural observation | Do not put family admission ahead of structural diagnostics. Family-specific TradeBundles still need separate scope implementation/evidence. | Guard principle recorded; scope work pending |
| Forex opportunities disappeared somewhere between detection and signal output | Every lifecycle advance/ignore/termination has a reason code and the research funnel composes data → lifecycle → current-entry attrition into one diagnostic stage. | Diagnostic foundation implemented; live scanner connection pending |
| Fixed HTF polling missed newly closed swing evidence | Required-timeframe gate exposes missing/stale evidence; market-data scheduler must refresh at source candle boundaries. | Decision-side guard implemented; scheduler work pending |
| M1 recursive history requests | Request throttling/caching belongs to market-data ingestion, not decision authority. | Pending market-data layer |
| Settings/profile changes altered open-trade policy | Frozen accepted policy/position management belongs to Gate 4M. | Deliberately not implemented in alpha |
| Duplicate/unknown broker actions resent | Durable reservation/reconciliation belongs to Gate 4 broker boundary. | Deliberately not implemented in alpha |

## Non-negotiable semantic boundaries

- A signal/event is not permission.
- Layer 1 never emits `TRIGGERED`.
- Structural readiness is not model-scored READY.
- Continuation capture is not authority merely because it exists.
- No hidden timer, score, or heuristic may substitute for a named lifecycle predicate.
- No stale request timestamp may renew the original market fact.
- A rejected/missed candidate remains observable; selection must not erase counterfactual candidates.
- Entry availability is rechecked from current evidence and never inferred from an old event alone.
- Synthetic-family and broker-specific rules must live in named, versioned scope artifacts rather than generic locks.
