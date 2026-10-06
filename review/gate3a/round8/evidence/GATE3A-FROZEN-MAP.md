# Gate 3A — Corrected Frozen Authority Map

Status: **FROZEN BEFORE ANY AUTHORITY CODE CHANGE — CORRECTED SINK-FIRST INVENTORY.**

No production authority code was modified in Gate 3A. This package replaces the first Gate 3A evidence bundle, whose field-first scanner could not prove completeness.

| | |
|---|---|
| Artifact scanned | `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178` (Gate 2.2, cleared) |
| Authority inventory hash | `92ece2864134b7b7333af3151d7677832170876ea005b0dfb3ef8bfee3668f43` |
| ATR semantic sweep hash | `a704fe2b6c1198da3e18524ce471e480a056de515b94e04cb4aa7b4d63fc3616` |
| Inventory methodology | **SINK_FIRST** |
| Authority sink records | **1005 authority sink records** (920 live) |
| Classified semantics | **47 classified semantic fields** |
| Inventory defects | **0** |
| ATR sweep | **53 ATR bindings**, **96 ATR consumer statements** |
| ATR permissive capital branches | **0** |
| ATR unresolved shapes | **0** |

## 1. What changed from the rejected Gate 3A bundle

The first Gate 3A scanner declared 18 field names first and searched only for those names. That made an omitted authority input invisible by construction. This version reverses the dependency:

**authority sinks → discovered dependencies → semantic classification.**

A live sink dependency that does not map to a declared semantic field is now an inventory defect. The test suite attacks four shapes: a READY conditional, broker admission, the `readyOk` initializer itself, and the live `p.executionEligible` initializer. Each undeclared dependency is rejected without adding it to catalogue metadata.

The corrected package also:

1. distinguishes **REACHABLE_AUTHORITY** from **UNREACHABLE_LEGACY**;
2. proves `updateLegacySignalState` and `checkLegacySig` are not reachable from the live roots;
3. decomposes `evaln` / `strategyPreview` at member level rather than classifying the whole object;
4. separates predicate *classification* from predicate *admission*;
5. keeps undeclared predicates at **CANDIDATE_UNADMITTED**;
6. maps all four semantic grade families: regime, HTF/context, reward/economics and trigger;
7. explicitly maps planner economics and current selection authority;
8. preserves research/advisory semantics even when they have no capital sink;
9. generates narrative counters from JSON evidence so the 45/74 versus 53/96 drift cannot recur;
10. treats verdict-write initializers as first-class sinks and explicitly dispositions the twelve challenged verdict names from the independent review;
11. **(round 7)** freezes the dependency vocabulary: every `(owner, token)` a live authority sink accepts — by catalogue mapping, bound-parameter or local-producer termination, UPPER_CASE constant, internal call, trusted intrinsic or NOISE name — is stored with the rule that accepted it in `tools/gate3-dependency-vocabulary.json`. Any new or reclassified pair is a defect, so a new input can no longer inherit a classification by name similarity;
13. **(round 8)** freezes an authority baseline (`tools/gate3-authority-baseline.json`): every live authority sink signed over owner, kind, code-only expression, whole consequence and dependency→canonical list, every live `Object.assign` leaf (unclassified), and a code-only fingerprint of every function owning a sink. The vocabulary only sees *new* inputs; the baseline reports an accepted input substituted for another, a deleted conjunct or guard, a changed threshold literal, a swapped order field or a rerouted consequence — localised to the sink — while comment and layout edits stay clean.
12. **(round 7)** inventories every field of the submitted broker orders, traces the order record to what `checkSig` actually emits, recognises compound/logical assignment and evidence-removing mutation (`splice`, `length =`, guarded `Object.assign`), treats functions used as values as possible entry points, and makes any guard that invokes or passes a broker function — or emits an event an authority listener acts on — a sink.

## 2. Reachability

Live roots: `recomputeFull`, `recomputeLight`, `updateSignalState`, `checkSig`, `route`, `routeConfirmedReversal`, `closePosition`.

The scanner records 332 functions reachable from those roots. The legacy state/execution functions `updateLegacySignalState` and `checkLegacySig` are recorded as **UNREACHABLE_LEGACY**, not described as current capital authority.

This distinction matters because legacy consumers still need deletion/migration evidence, but they are not allowed to inflate the description of the current live path.

## 3. Classification and predicate admission

| classification | count |
|---|---:|
| HARD_STRUCTURAL_PREDICATE | 9 |
| RAW_MODEL_FEATURE | 5 |
| ADVISORY_FEATURE | 1 |
| RESEARCH_HEURISTIC | 1 |
| LEGACY_REMOVE | 31 |

| predicate admission | count |
|---|---:|
| ADMITTED | 4 |
| CANDIDATE_UNADMITTED | 20 |
| NOT_APPLICABLE | 23 |

**Admitted hard predicates (4)** are limited to semantics with explicit non-P/L/data/safety provenance in this map. **20** semantics remain `CANDIDATE_UNADMITTED` and receive no new 2B authority merely because they are boolean-shaped.

In particular:

- `ENTRY_EVENT_CONFIRMED` is **not created by renaming assessTrigger**. Its current classification is LEGACY_REMOVE / CANDIDATE_UNADMITTED until a closed-bar definition and every constituent threshold pass §14C.
- `DATA_HEALTH_OK` and `GEOMETRY_COMPLETE` remain candidate predicates; their composites must be decomposed before admission.
- the semantic equivalents of `REGIME_QUALITY_OK`, `HTF_GRADE_NOT_C`, `REWARD_GRADE_NOT_C` and `TRIGGER_GRADE_NOT_C` are all present and none is hard-admitted.

## 4. Live authority that Gate 3B+ must migrate

41 classified semantics touch at least one live authority sink. Load-bearing examples:

- **data health:** execution status, reason arrays, canonical ATR availability, tick freshness;
- **context:** same/opposing higher-timeframe votes and `context.ok`;
- **specialist:** market-family reasons, shock/alignment/bias logic and risk scale;
- **lifecycle:** current stage, trigger freshness and stage ranking;
- **planner:** structural stop/target checks mixed with gross R, net R and cost R;
- **selection:** state rank, lifecycle rank, context vote strength, causal age, profile scope and opposing-FIRE conflict;
- **execution/journal:** duplicate consumption, cooldown, market-open and family execution permission;
- **browser broker boundary:** `route` / `makeIntent` / `routeConfirmedReversal` / `closePosition`, including environment + armed/mode checks, current risk-fraction construction, calibration/trade-permission payload fields, the three `/api/broker/*` submission sinks, opposite-structure exits and the manual close path;
- **legacy permission assertions:** `riskCanOpen:true` and `executionPermission:'DEMO_AUTO'` are explicitly inventoried for removal rather than being treated as permission;
- **risk-reducing exit marker:** the reversal exit's hard-coded `dataExecutionOk:true` is inventoried separately; Gate 4 replaces this with explicit `RISK_REDUCING` classification rather than spoofing data health;
- **legacy evaluation still reachable for support:** `strategyPreview.score` and direction are still consumed by `recomputeFull` for data-request/preview behavior even though the legacy state machine is dead.

The planner economics are explicitly classified away from Layer 1: gross R / net R / cost R and `minGrossR` / `minNetR` / `maxCostR` move to dynamic execution economics / Gate 4, not structural candidate validity.

## 5. Verdict-write completeness

The inventory now contains **39 first-class `VERDICT_WRITE` sinks**. This closes the one-level-up blindness where a downstream `if (!readyOk)` could be mapped while the initializer that computed `readyOk` remained invisible.

The independent-review set is explicitly dispositioned in `inventory.verdictAudit`: `readyOk`, `fireOk`, `executionEligible`, `econOk`, `thesisOk`, `runwayOk`, `stopGeometryOk`, `coreOk`, `regimeOk`, `priceValid`, `directEligible`, and `allValid`. Authority/research producers are sink-covered; renderer/logging/presentation-only values are explicitly marked non-authority rather than silently omitted.

`LEGACY_REMOVE` means **remove the legacy authority**, not necessarily delete the semantic obligation. The separate `migrationDisposition` field distinguishes `REMOVE_LEGACY_AUTHORITY` from `REMOVE_LEGACY_AUTHORITY_AND_REPLACE_AS_SPECIFIED`. In particular, lifecycle, future entry-event semantics, and the risk-reducing exit path preserve their frozen successor obligations.

## 6. ATR semantic sweep

The Gate 2 limitation remains closed with the existing sweep:

- 53 ATR bindings;
- 96 consumer statements;
- 25 blocked by upstream availability guard;
- 4 blocked by downstream finite sink;
- **0 permissive capital-path branches**;
- 4 permissive non-authority branches;
- **0 unresolved**.

The tool remains non-vacuous: it flags the known `bias()` / NaN-permissive defect on Gate 2.1 and returns clean on Gate 2.2.

## 7. Gate 3A disposition

**This package is a review candidate; Gate 3A is not cleared until independent review passes.** It is an evidence freeze, not authorization to skip Gate 3B–3F. The scanner, catalogue judgements and tests must be independently reviewed before the freeze is accepted.

No pWin/EV thresholds were invented. No State Policy, broker admission, 4A/4B or execution permission was pulled forward. The runtime remains non-capital-authoritative.

## 8. Known limits carried forward

- The sink scanner is a purpose-built brownfield static analyser, not a general JavaScript AST/type-flow proof. It protects the current monolith with explicit sink families, owner-local alias mappings, verdict-write sinks, and independent mutations of READY conditionals, broker admission, legacy READY verdict computation, and live planner execution eligibility. A genuinely new control-flow shape must either be discovered as an unmapped dependency or extend the scanner before Gate 3A can be re-frozen.
- This artifact contains the browser-side cTrader boundary only. The implementation behind `/api/broker/intent`, `/api/broker/exit-intent` and `/api/broker/close` is not present in the scanned HTML, so Gate 3A cannot claim server-side execution completeness. Gate 4 must inventory/verify that server boundary before execution provenance can clear.
- **Round 7 boundary (closed against new inputs):** the frozen vocabulary makes the map closed against *new* authority inputs, at `(owner, token)` granularity. Adding behaviour-preserving code to live authority is reported as vocabulary novelty, by design. A callback stored in a data structure and invoked by index is flagged at its dispatch site rather than traced into its body.
- **Round 8 boundary (bound, not proven correct):** the authority baseline makes any change to live authority code a defect, localised to the sink where one covers it. It does **not** establish that a frozen dependency is the semantically correct one for its decision — it records what the cleared artifact does. Whether each input, predicate and threshold belongs where it is, under the frozen Signal Authority specification, is the §14A/§14B/§14C classification work of Gate 3.1–3.3, which needs the specification as its oracle; a scanner rule cannot stand in for it. The baseline is valid for the frozen Gate 2.2 artifact only; for migrated code it is an equivalence reference, not a detector.
- **Gate 3.1 scope is wider than this inventory:** §14A requires mapping *every* consumer — including watchlist ordering, trade-plan presentation and research logging — whereas Gate 3A inventories authority sinks. The 89 live `Object.assign` leaves are signed but unclassified, and feed legacy scoring/display rather than the capital path on this artifact; their classification is Gate 3.1 work.
- **Threshold provenance (HP-3):** `evidence/GATE3A-THRESHOLD-WORKSHEET.json` lists the 209 live authority sinks carrying a numeric literal other than 0/1. Every provenance is `UNRECORDED`: none is asserted here, and none may be invented to complete Gate 3.3.
- Dead legacy internals are preserved and reachability-labelled rather than exhaustively classified at every local alias because they are scheduled for removal, not migration into new authority.
- The Gate-2 decision-flip study still uses proxy geometry; Gate 3 candidate-contract extraction owns engine-derived structural-level measurement.
- The profile engine still depends on outer `TTI_FOUNDATION_REFERENCE`; Gate 3 extraction owns that boundary.
