# Issue #96 — Lane B engine/API validation slice

Base: `release/private-validation-alpha-2026-09-28`, commit `37e116764fbb8b605e224ae20876b0fd3a0f2574`.
Implementation branch: `engine/lane-b-private-alpha-96`.
Scope: Lane B only. No desktop visual or public landing-page changes. No merge to main.

## Implemented boundaries

- `MarketStateKey`: instrument, source, timeframe, data version, feature-definition version and evaluation boundary. Confirmed pivot derivation is cached separately from the evaluation envelope, so moving evaluation time reruns freshness checks without recomputing identical facts. Same-version changes to data/definitions fail. Inputs reject unexpected account/user fields; results are deeply immutable.
- `StrategyStateKey`: exact shared market keys plus family, instrument, horizon, timeframe, entry-model, strategy, complete TradeBundle, regime-model and calibration bindings. Same-version profile or bundle changes fail. Caller/account identity is absent. Opportunity identity is derived in the engine.
- One grammar: Context → Location → Reaction / Confirmation → Current Entry → Invalidation → Objective → Management. Two implemented research routes: continuation/retest and reversal/reclaim, with BUY/SELL symmetry. Both require confirmed causal location/objective facts and a later closed confirmation bar. Current entry is separate from frozen confirmation geometry. Failed reclaim/retest, stop/objective touch, stale data, chase and expiry prevent readiness.
- Explicit `MarketFamilyProfile`, `InstrumentProfile`, `HorizonProfile`, `TimeframeMap`, and `EntryModel` bindings. Calibration is explicitly unvalidated research. The same algorithm supports different family/horizon calibrations without borrowing applicability or edge.
- Downstream account assessment preserves broker-reported balance, equity, margin, free margin and margin level. Declared field semantics determine reconciliation; free margin is not universally equity minus margin. Unknown projection semantics, missing/contradictory/stale/unreconciled fields, source-time skew and unconfirmed protection fail closed.
- RiskPolicy explicitly chooses BALANCE, EQUITY or DECLARED_CAPITAL. The evaluator assesses a supplied research quantity; it does not size or construct orders. Linear risk includes declared loss buffers and current managed stops, floors each child's risk at zero and never offsets another child's loss with protected profit. Pending, child, thesis, instrument, account and incremental add-on risk are aggregated. Closed child history remains part of cumulative add-on budget checks.
- Parent strategy/timeframe/invalidation/provenance bind to engine context. Multiple intentional partial fills reconcile to one intent/tranche quantity. Duplicate IDs, replayed intents, mismatched quantities and mixed tranche roles fail. Core/add-on policies remain separate. A child close leaves the parent active; campaign re-entry needs a fresh independent entry after the close.
- In-memory materialisation is bounded, deterministic and research-only. Capacity exhaustion is explicit. No Redis or microservices. Repeated reads have no order or ledger side effects.

## API

GET `/v1/alpha/engine-validation/scenarios`

GET `/v1/alpha/engine-validation/scenarios/{scenarioId}/frames/{frameIndex}`

Named fabricated mechanical replay cases: `gold-continuation`, `gold-reclaim`, `fx-continuation`, `synthetic-continuation`, `gold-swing`, `gold-protected-addon`, `gold-campaign-reentry`, `gold-margin-conflict`, `gold-stale-account`. Each has three frames (indices 0–2). A single shared engine serves them. The last four expose partial core fills, protected add-on assessment, closed campaign children, broker-semantics conflict and stale account failure end-to-end.

Wire types are re-exported from decision-core through alpha-api-contract. OpenAPI authority markers are fixed. Existing endpoints/ledger semantics are preserved. There is no new POST/Auto/execution endpoint, caller-supplied account endpoint or live-capital permission.

## Evidence-family extension boundary

The thin implemented adapter uses confirmed pivot facts and closed bars. Deep structural retests, breakdown continuation and first pullback belong to the continuation family; failed highs/lows and failed-breakdown reclaim belong to the reversal family. Trendline/horizontal confluence and other evidence (FVG, BOS/CHoCH/MSS, liquidity and retracement measurements) require separately versioned shared-fact/location adapters and research fixtures before inclusion. They are not universal entry permission. Core/add-on and campaign re-entry are downstream parent/child account relationships, not separate market engines. This change does not claim all evidence families in #92 are implemented or validated.

## Independent adversarial review and fixes

The implementation owner performed a second pass. A separate reviewing agent inspected and reproduced failures under AGENTS.md / AI_COLLABORATION.md, without editing implementation files.

| Attempt / finding | Fix / verification |
| --- | --- |
| Objective pivot assumed knowable one bar early in initial fixture | Corrected fixture timing; engine had correctly withheld readiness. |
| Change evaluatedAt while keeping identical market data | Separate immutable fact cache; freshness envelope remains time-specific. |
| Risk uses original entry reference despite later current price | Added explicit current research price; account proposal must bind to it. Frozen reference stays unchanged. |
| Intrabar stop breach followed by recovered close | Terminal child invalidation; no resurrection from later recovery. |
| Intrabar objective touch followed by recovered close | Terminal objective state prevents new entry. |
| Parent thesis has unrelated invalidation/fact/strategy | Exact parent context, strategy and timeframe binding. |
| Old CURRENT subresult relabelled with later evaluatedAt | Snapshot-time consistency and price/confirmation causality checks. |
| Empty campaign event list carries future parent thesis | Initial thesis is causally checked even with no events. |
| Label added exposure CORE to bypass pyramiding | Existing active thesis requires ADD_ON assessment. |
| Historical child economics use profit-side original stop | Original child stop must be adverse; original geometry retained. |
| Child observation follows account capture / field skew | Snapshot source-time and exposure-skew rejection. |
| Tick products or closed-fill sums overflow finite operands | Derived distance, geometry, exposure and quantity finiteness checks. |
| Pending order claims a protected profit-side stop before fill | Fail closed on BUY and SELL pending stop contradictions. |
| Material model changes retain original TradeBundle version | Version-content registry rejects altered complete bundle. |
| Future data, timestamp reorder, stale market/account, family/horizon leakage, duplicate/replayed intent, account-field contamination, cache history mutation, failed reclaim, chase, local child stop vs parent, campaign completion | Regression cases reject unsafe combinations; immutable prior results retained. |

Independent review after fixes: **58/58 Lane B core tests passed**; all material findings from that review resolved. No live-capital authority widening observed.

## Local verification after fixes

- `pnpm test`: **285 passed, 6 skipped, 0 failed** — decision-core 221, API contract 3, API 32, desktop 22, release tooling 7. The 6 skipped cases are PostgreSQL integration tests; no local PostgreSQL/Docker service is available.
- Explicit `node --test scripts/release/rc.test.mjs`: **7/7 passed** (also included in the total above).
- `pnpm typecheck`: passed across all workspace packages, API and desktop.
- `pnpm build`: passed for packages, API, desktop renderer and Electron TypeScript.
- `pnpm --filter @zugrio/api prisma:validate`: passed.
- Foundation integrity: 24 required documents plus governing charter/Gate 4 assertions passed.
- `git diff --check`: passed.
- Shared-state test: 1,000 account callers reuse 3 lower-level market computations and 1 strategy interpretation. A different horizon adds a strategy interpretation without repeating market derivation. Advancing evaluation time with unchanged data reuses facts and rechecks freshness.
- API tests compare concurrent responses against exact decision-core results and exercise account PASS/BLOCK fixtures; unsupported order/Auto routes return 404.

Remote CI, PostgreSQL, Windows portable packaging, ARM64 image, Compose and secret-scan status must be read from the PR checks; local success does not assert those gates passed.

## Remaining limitations

- Mechanical fabricated evidence, not statistical calibration, performance evidence, live data or production readiness.
- Closed-bar research price is explicitly `CLOSED_BAR_ONLY_NOT_EXECUTABLE`. No bid/ask, spread, fees or live broker fill availability is inferred. Existing recheck's cost predicate is a research placeholder, not an executable economic admission.
- Only two pivot-based route adapters implemented. No new live-feed/universe worker or continuous alerts in this thin slice.
- Linear, account-currency contract economics supplied as reconciled typed research inputs. No nonlinear derivatives, automatic currency conversion, factor/correlation model, broker integration or live mandate validation.
- Unknown broker-defined margin projection fails closed. More broker semantics require explicit tested adapters.
- No order reservation/submission or durable execution deduplication. Replay/duplicate checks concern supplied research account history only. Capital correctness must not depend on these process-local caches.
- New research frames are reproducible read-only projections, not new persistent ledger event types. Existing append-only Decision Case persistence remains unchanged.
- Management is parent/child lifecycle observation and current-stop risk measurement, not automated stop movement or closing.
- **No live-capital authority introduced.** `RESEARCH_ONLY`, `NO_LIVE_CAPITAL`, `liveCapitalAuthority: false`, and `modelScored: false` remain explicit. Gate 4 is unchanged.

## Exact files changed

1. `apps/api/openapi.json`
2. `apps/api/src/alpha/lane-b.controller.ts`
3. `apps/api/src/app.module.ts`
4. `apps/api/src/openapi-schemas.ts`
5. `apps/api/test/lane-b.test.ts`
6. `apps/api/test/openapi.test.ts`
7. `packages/alpha-api-contract/src/index.ts`
8. `packages/decision-core/src/index.ts`
9. `packages/decision-core/src/validation/accountRisk.ts`
10. `packages/decision-core/src/validation/entryGrammar.ts`
11. `packages/decision-core/src/validation/fixtures.ts`
12. `packages/decision-core/src/validation/index.ts`
13. `packages/decision-core/src/validation/invariants.ts`
14. `packages/decision-core/src/validation/sharedState.ts`
15. `packages/decision-core/test/lane-b.test.ts`
16. `docs/engineering/LANE_B_96_VALIDATION_REPORT.md`
