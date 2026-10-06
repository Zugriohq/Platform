# Gate 3A — Adversarial Self-Review

<!-- GENERATED:CURRENT-EVIDENCE:BEGIN -->
## Current evidence (generated from the final JSON — do not edit by hand)

| | |
|---|---|
| Artifact scanned | `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178` (Gate 2.2, cleared, unchanged) |
| Authority inventory hash | `92ece2864134b7b7333af3151d7677832170876ea005b0dfb3ef8bfee3668f43` |
| ATR semantic sweep hash | `a704fe2b6c1198da3e18524ce471e480a056de515b94e04cb4aa7b4d63fc3616` |
| Authority sink records | **1005 authority sink records** (920 live) |
| Verdict-write sinks | **39 verdict-write sinks** |
| Returned-field sinks | 39 |
| Authority producer sinks | 687 |
| Reassignment / alias / Object.assign sinks | 5 / 7 / 1 |
| Schema-frozen live owners | 10 |
| Broker order-field / collection-mutation / invocation-guard sinks | 45 / 0 / 1 |
| Frozen dependency vocabulary | **1367 frozen vocabulary entries**, `90499ad2362c1a1e486a9c55736d9ba6c9b4f628f1d3c9076d7c1cf0aa9229cc` |
| Frozen authority baseline | **1009 signed sinks** (89 unclassified Object.assign leaves), 89 owner fingerprints, `a3ce122e16e69530d45f8daf60c2240cd44536145c70a0710e33ae22d2f6c371` |
| HP-3 threshold worksheet | 209 live sinks with non-trivial numeric literals, provenance UNRECORDED |
| Classified semantics | **47 classified semantic fields** |
| Inventory defects | **0** |
| ATR sweep | 53 bindings, 96 consumer statements, 0 permissive capital branches, 0 unresolved |
| Gate 3A tests | **72 tests** |
<!-- GENERATED:CURRENT-EVIDENCE:END -->

## Round 8 — what the vocabulary could not see, and what the baseline does not prove

The independent review of round 7 was right about the mechanism. Before writing any fix, I reproduced it: an accepted dependency swapped for another accepted one, a deleted conjunct, a literal-only threshold change, and a stop/target swap all scanned clean under round 7. A novelty check is blind to everything that is not new.

The fix is an authority baseline. It signs every live sink and fingerprints every function that owns one, so a substitution, deletion, threshold change or reroute is reported at the sink it changed. The substitution battery proves class membership case by case, so it cannot pass by accident: a case the vocabulary alone already flags is not a substitution case. Round 7 misses 43 of its 43 in-class cases; round 8 misses none.

Mistakes of my own that this round caught, all through verification rather than reasoning:

1. **The first canonical form was wrong.** It let comment text through, and it collapsed whitespace inside string literals. A literal/comment mask fixed both.
2. **The second canonical form was also wrong.** It merged `return⏎x` with `return x`, which automatic semicolon insertion gives different meanings. Restricted-production line breaks are now kept.
3. **One precision control was itself wrong.** It appended `// ok` mid-line and so commented out real code. The baseline correctly reported the removed sink.
4. **One non-vacuity check of my own test was invalid.** With truncated signing, the committed baseline mismatched the clean artifact itself, so the test passed for the wrong reason. The long-consequence test is now a direct unit test that fails without full signing.
5. **I first classified two battery results as coverage gaps.** They are not authority on this artifact. The `planTradeLevels` plan fields are read only by renderers and outcome tracking. They are now signed and localised anyway.

What this round does **not** establish: that any frozen dependency is semantically correct. The vocabulary and the baseline both record what the cleared artifact does. Checking it against the frozen Signal Authority specification is Gate 3.1–3.3 classification work. That work needs the specification as its oracle and human sign-off, and a scanner rule must not stand in for it.

## Round 7 — independent review: what the scanner could not see

The round-6 scanner proved closure only for dependency *shapes* it already knew, and decided "classified" by name patterns. Round 7 attacked it with realistic authority changes rather than rerunning its tests. 24 of 39 were missed (23 silently), and six of the miss classes concealed live authority in the unmodified artifact: the truncated `riskFraction` value, the uninventoried order payload (side, entry, instrument, identifiers), the order record's provenance stopping at the event bus, the guards that decide when reversal exits are evaluated, the early-return guards (including `planTradeLevels`' structural plan rejections), and expression-bodied arrows that owned unrelated code.

The decisive fix is not another sink family but a **frozen dependency vocabulary**. Shape coverage can always be extended by one more JavaScript form; what the freeze needs is that nothing new is *accepted* without review. Every pair a live sink accepts is now stored with its acceptance rule, and novelty or reclassification is a defect. The shape fixes (order fields, compound/logical assignment, mutation, reference dispatch, guarded emits, order-record closure, depth-aware values, code-only function boundaries) are what made the clean artifact's real gaps visible before the vocabulary was frozen from it.

Limits introduced by this round are stated in the frozen map (§8) and the handoff's round-8 list.

## Round 6 — pinning the scanner assumptions, and what verifying them exposed

The reviewer asked for the two remaining limitations to be recorded as `SCANNER_ASSUMPTION — VALID FOR FROZEN GATE 2.2 ARTIFACT; MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE`, and mechanically pinned: silent on Gate 2.2, explicit the moment the pattern appears. Both are now guards that run on every scan.

**A2 — intrinsics trusted by method name.** The artifact defines seven functions under a trusted name (`get`). All seven are `Object.defineProperty` accessor descriptors in the charting library, none inside live code. The guard reports any application method under a trusted name that is defined in a live function or invoked from live authority; accessor descriptors are excluded. Silent on Gate 2.2, loud on a masquerading `.join()` on the capital path.

**A1 — renamed names for shared state.** Verifying "no live code does this" found that it does. Shared instrument state is bound as `s` in almost every live function, but `portfolioCorrelation` binds it as `proposed`. Writes and reads are linked by member path, so `proposed.signal` can never be linked to a write `s.signal`. It is safe today only incidentally: each such writer sits in a function that consumes `s`, which closes all its writes. The guard now makes that dependency explicit — every member read through a renamed binding must have all of its canonical-name writers closed. Its first version false-flagged `dispatch`, which writes `s.candles = ca` twice with an identical expression; closure inspects that expression once, and the guard was aligned to that rule.

### The shared blanker was not reading code

Every pattern in these tools depends on blanking comments and strings while preserving offsets. That blanker did not recognise regex literals and let quoted strings run across lines, so a quote inside a pattern such as `/['"]/` opened a phantom string. A whole-file pass erased **62 of 362 functions by more than half**, including the live roots `route` and `updateSignalState`. It is replaced by a single-pass lexer that handles comments, line-bounded strings, template literals (keeping `${...}` interpolations as code) and regex literals together, since each changes how the others must be read. Whole-file and per-function blanking now agree on every function.

**The ATR sweep was not affected, and that was verified rather than assumed.** It blanked the whole file, so it could have been blind. All 44 ATR call sites were visible to the old blanker; none fell in an erased region. Its hash is unchanged.

### The call graph, and the root set

The call graph read raw source, so a function name in a comment or string became a call edge, and an outer function inherited calls made by named functions nested inside it. My first correction, built on the still-broken blanker, dropped **100** functions to dead — including `analyze`, `plan` and `lifecycle` — and the scanner's own sanity check caught it. With the lexer in place, nine functions genuinely change, none carrying reachable authority.

The root set was a hand-written list of seven engine functions. Real execution also starts at page load, in HTML and template event attributes, and in listener and timer callbacks. Counting those takes the live set from 201 to over 300 functions. Reachability now **over-approximates** execution: a call outside any named function counts as reachable, whether it sits in page-load code or an anonymous callback. For an authority map that is the safe direction — more is checked, nothing is hidden. Two live gaps closed as a result:

- **Operator handler.** `chooseTradeProfile`, invoked from an `onclick`, writes the global `selectedTradeProfiles` that `updateSignalState` and `checkSig` read. Writes to global variables in any live function are now producers of what live authority reads.
- **The engine event bus — the capital trigger.** `emitEngine` calls every function registered through `onEngineEvent`. One anonymous listener places the orders: `SIGNAL_FIRED → route(p.item)`, `CLOSED_BAR → routeConfirmedReversal(p.k)`. Its own condition was never a sink, because sinks were discovered only in named functions; and `route`'s parameter `item`, "closed at the caller", had no traceable caller, because dispatch is dynamic. A taint in the listener's condition, in the payload `checkSig` emits, or in the reversal condition was missed. Registered listeners are now named owners with an edge from `emitEngine`; a listener that invokes an authority owner is itself an authority owner; and a listener's payload parameter is linked to the payload argument at every live `emitEngine(...)` call. A named handler registered by reference is covered the same way.

**The conclusions handed to Gate 3B survive every real entry point.** `updateLegacySignalState`, `checkLegacySig`, `assessTrigger`, `validateFireGeometry` and `assessDataHealth` remain unreachable. `coreStrategyEvaluate` remains live. One function changes status: `rgEvaluate` becomes live, through a call inside an anonymous block of the APA engine — counted as reachable under the over-approximation.

### Two corrections to things I reported

- **`checkSig` → `liveRiskMetrics`.** I reported that this edge came from a comment. False: `risk = liveRiskMetrics(k)` is real code, and the broken blanker had erased it so that it looked like a comment. `liveRiskMetrics` and `portfolioCorrelation` are genuinely live.
- **GARCH.** Round 5 described `updateGARCH` as writing "onto its parameter `s`". In both `updateGARCH` and `recomputeFull`, `s` is a local, `const s = S[k]`, bound to shared state. The link worked because both functions use the same name — which is exactly the dependency the A1 guard now checks.

### Non-vacuity

The consolidated battery (`tools/gate3-mutation-battery.js`) holds every mutation that broke an earlier scanner generation. Against the round-5 scanner it misses exactly the eight round-6 cases; against the current scanner it catches all of them; the clean artifact has zero defects under both. Separately, on the round-5 scanner 62 functions are blanked inconsistently, code after a quote-bearing regex is erased, and comments create false call edges; on the current scanner, none of those occur.

### Limits after round 6

- **Reachability over-approximates.** Code inside an anonymous callback is treated as running whether or not anything triggers it.
- **Dynamic dispatch.** The artifact has no `eval`, `new Function` or `window[...]()` calls. It has one computed call, the event bus, now modelled, and `.call`/`.apply` only on built-ins. A second event bus or registry would need the same treatment.
- **The lexer decides regex-versus-division from the preceding token**, so a regex directly after `)` or `]` would be misread. The artifact contains none, a test pins that, and the damage from a misread is bounded to one line.
- **The two scanner assumptions remain assumptions.** They are guarded, not resolved, and Gate 3B must not rely on them.

## Round 5 — the parameter boundary

The reviewer asked for one final attack before freeze: producer closure stops at function parameters, which is sound only if a caller's argument is itself an explicit graph edge. Otherwise a parameter becomes a laundering boundary.

**The return channel already held.** Injecting a taint only at a call site — `familyGate(mysteryCallerAuthority(input), …)`, the `spread` argument into `plan`, and a genuine two-hop chain `updateSignalState → analyze(input) → plan(spread) → costR` — was caught by the round-4 scanner. The reason is structural: when a call's return value is consumed by authority, the producer of that value is the *complete call expression, arguments included*, so the arguments are always inside a checked sink.

**But a parameter was a laundering boundary in two other ways, both on live code, both missed by the round-4 scanner:**

1. **Side effects on shared state.** `updateGARCH` writes `s.ewmaVar` and `s.garchVar` onto its parameter `s`; `recomputeFull`, a different live function, reads `s.garchVar` into a volatility score. No return value is involved, so "closed at the caller" does not apply — the taint is in state the callee mutates, not in the caller's argument. Closure now treats writes as producers of what is later read: writes *into* a local object (`mem[k] = …`), and writes *onto* a parameter's member path, indexed across live functions.
2. **Helper bodies excused by name.** A call to any function defined in the artifact was treated as trusted, and its body never examined. So `scale = helper(input)` was "a known call" however `helper` computed its result. The producer of a consumed call's value is the callee's return expression; those are now closed recursively. The callee's own parameters still terminate — soundly, because the caller's arguments are already inside the calling sink.

Both are now caught, one and two hops deep, and a benign helper chain produces no defects.

**A claim I retracted.** Probing the parameter boundary, I found `coreStrategyEvaluate` keeps persistent evidence memory on its parameter across calls, and I reported that as live laundering in the very function the reviewer named as Gate 3B's top priority. I then traced where the chain ended. The family counts it feeds are consumed **only** by `updateLegacySignalState`, which is unreachable. It does not reach live authority, and the scanner correctly does not report it. Test 3A-43 now pins that negative case, so the side-effect closure is shown to be precise and not merely more aggressive.

**Two defects of my own this round.** First, two functions share the name `atr` — the top-level estimator and the profile engine's inner arrow — and resolving functions by name checked one's parameters against the other's signature. Functions are now resolved by the range that contains the sink. Second, the first working version was **20× slower** — about 11.5 seconds per scan against 0.55 — because it re-scanned every live function body for every member path. A per-scan cache and a single member-write index brought it back under a second with identical results. Test 3A-45 bounds scan time so it cannot regress silently.

**A genuine addition to the authority map.** GARCH volatility state persisted on the instrument object is now recorded as a live authority input, written in one function and consumed in another.

### Limits after round 5

- **Trusted intrinsics are trusted by method name**, not by receiver type. The list now includes deterministic serialization (`JSON.*`, `structuredClone`), transport (`fetch`, `response.json`) and the mandated time service `__TS`. Transport is trusted because what is *sent* is closed through `makeIntent`; server behaviour remains Gate 4.
- **Side-effect writes are indexed by member path.** Shared state reached through an alias with a *different* name — `const st = s; st.x = …` — would not be matched to a read of `s.x`. Verified rather than assumed: that form is missed, and no live function aliases its state parameter today.
- **Record returns are closed field-by-field, scalar returns wholesale.** A callee returning an object that is then consumed as a whole, rather than by field, is covered only through its fields.
- The scanner remains a purpose-built brownfield analyser. Mutation testing proves coverage of the shapes tried; every shape here is now a regression test.

## Round 4 — Blocker A: consumer-driven producer closure

**The defect.** The scanner treated classifying a dependency's *name* as closing it. `if (costR > profile.maxCostR)` classified `costR` as `REWARD_ECONOMIC_QUALITY` and stopped. It never asked what produced `costR`, so an undeclared input inserted into any classified local's producer was invisible. The most serious instance reaches capital sizing:

`familyGate.scale → result.specialist.scale → result.riskScale → strategyEvaluation.riskScale → makeIntent → riskFraction`

**The fix.** A bounded backward authority slice. From every reachable authority sink, each dependency token is traced to its producer — a declaration, reassignment or switch-case assignment in the same function, or, for a returned field consumed cross-function, the producer of that field inside the returning function. Each producer becomes an `AUTHORITY_PRODUCER_WRITE` sink, and the process repeats to a fixed point. It is bounded, and hitting the bound is itself a defect rather than a silent truncation.

**Termination rule**, applied only to producer sinks so every guarantee on the original sinks is unchanged: a producer's dependency is closed when its root is a bound name — a parameter, callback binder or loop variable, closed at the caller or by the iterated expression — or a local whose own producer is already a sink. Everything else must classify or it is a defect.

**A bug in my first version.** `familyGate.scale` was still missed after the fix landed. The consumer token is `result.specialist.scale`; `result` has its own local producer (`{...base, blockers:[]}`), and I only attempted the deeper `result.specialist = familyGate(...)` resolution when the base had *no* local producer. Every intermediate member prefix is now resolved unconditionally. On the clean artifact all eight `scale` branches in `familyGate` are sinks — not only the one mutated.

**Non-vacuity.** All four mandatory producer mutations — `lifecycle.rejectionExtreme`, `familyGate.scale`, `plan.costR`, `analyze.same` — miss on the round-3 scanner and are caught after. Every mutation from rounds 1–3 is still caught. The clean artifact has zero defects under both.

### What producer closure surfaced on the clean artifact

**My own tokenizer was reading syntax as code.** Producer sinks are often object literals and regex-bearing expressions, which exposed three tokenizer errors that had been present all along: object-literal *keys* read as dependencies (`{stage:'X'}` produced `stage`), regex literal contents and flags read as identifiers (`/_/g` produced `g`, `\d` produced `d`), and properties read off a call result read as roots (`m1.at(-1).t` produced `t`). Each is a correctness fix that can only remove false dependencies; every value position is still tokenized. The remaining unclassified producer dependencies were genuine and each was classified individually: policy constants `TTI_GEOMETRY.readyMinTP1R` and `TTI_GEOMETRY.maxStopATR`, the execution spread model, profile constants, and broker `state.status`.

**A genuine research-to-authority data flow.** `updateSignalState` passes `continuationReference: continuationReferenceEnabled` *into* the live `TTI_PROFILE_ENGINE.analyze(...)` call, whose result drives `lane.state`. The previous test passed only because the scanner could not see argument flow. A static map cannot prove an argument has no effect, so the requirement was **not** relaxed. Test 3A-11 now pins the flow to exactly that one argument and proves non-influence behaviourally on this frozen artifact: production output is byte-identical with the toggle off and on across 18 fixtures. That check is itself proven non-vacuous — re-wiring research capture into the production population makes **18 of 18** fixtures diverge, against **0 of 18** on the clean artifact.

Recommendation for Gate 3B: remove the `continuationReference` argument from the live `analyze()` signature entirely, so non-influence becomes structural rather than something that has to be re-proven behaviourally.

## Round 4 — Blocker B: evidence coherence

The handoff and self-review told the next reviewer to expect a superseded inventory hash and superseded counters — the same drift class Gate 3A had already fixed once. The cause was structural: README and the frozen map were generated from JSON, but these two documents were hand-written.

Now every formal Gate 3A document's current evidence is generated from the final JSON into a marker-delimited block, including the correction manifest's hash and totals. Everything older sits under an explicit *History (superseded — not current evidence)* heading. Test 3A-40 fails on any full or abbreviated hash, or any sink, reachable, verdict-write or test counter, that appears outside that heading and does not match the final JSON.

## Limits, derived from verification rather than asserted

- **Parameter termination is load-bearing.** The slice treats a parameter as closed at its caller. That holds when the caller's argument expression is itself a closed sink. It is the rule most likely to be leaned on.
- **Behaviourally proven, not structurally proven.** The research argument into `analyze()` is shown non-influencing by off/on equivalence, not by the static map.
- **Name-based field resolution.** A consumed member whose base is a parameter is resolved by field name across live schemas; a field name shared with an unrelated record could be closed against the wrong producer.
- **Trusted intrinsics are trusted by method name**, not by receiver type.
- The scanner remains a purpose-built brownfield analyser, not a whole-program dataflow prover. Mutation testing proves coverage of shapes someone thought to try.

## History (superseded — not current evidence)

Everything below is retained for lineage. Hashes and counters in this section describe **earlier rounds** and are not current evidence; the only current evidence is the generated block above.

## Zugrio Gate 3A — Adversarial Self-Review After Verdict-Write Closure

**Scope:** Gate 3A evidence freeze only.  
**Production artifact:** unchanged Gate 2.2 artifact, SHA-256 `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178`.  
**Disposition:** ready for independent Claude review. This does not clear Gate 3B–3F or Gate 3 as a whole.

### 1. Blocker reproduced before fixing

Claude's blocker was valid: the prior sink-first scanner could see downstream `if` gates while missing the assignment that computed the verdict itself. In particular, inserting an undeclared term into `readyOk` could leave the inventory clean.

The repair therefore does **not** merely add `readyOk` to a list. Verdict initializers are now first-class `VERDICT_WRITE` sinks. The current inventory contains **34 verdict-write sinks** and **189 total authority/evidence sinks**, of which **137** are live/reachable authority sinks.

### 2. Non-vacuity now covers four different authority shapes

All four controls fail when mutated and pass on the clean artifact:

1. undeclared `mysteryAuthorityGate` in a READY conditional;
2. undeclared `mysteryBrokerPermission` in broker admission;
3. undeclared `secretEdgeFilter(k)` inside the `readyOk` initializer itself;
4. undeclared `undeclaredProfitFilter(...)` inside the live `p.executionEligible` initializer.

The third control is Claude's exact defect class: a hidden dependency inside the verdict write rather than in the downstream conditional.

### 3. Twelve challenged verdict names explicitly dispositioned

`inventory.verdictAudit` now records every name Claude called out:

`readyOk`, `fireOk`, `executionEligible`, `econOk`, `thesisOk`, `runwayOk`, `stopGeometryOk`, `coreOk`, `regimeOk`, `priceValid`, `directEligible`, `allValid`.

Authority/research-producing verdicts are sink-covered. Renderer/logging/presentation-only values are explicitly marked as such rather than silently omitted. This prevents a report reader from assuming every boolean-like value in the monolith is capital authority.

The audit also catches the two `runwayOk` producers separately: one in target computation and the final live planner verdict in `planTradeLevels`.

### 4. Minor LEGACY_REMOVE ambiguity resolved

The classification vocabulary remains compatible with the frozen four-way authority classification plus advisory semantics; I did **not** invent a new authority class. Instead, every inventory row now carries a separate `migrationDisposition`.

For legacy authority that must have a frozen successor, the value is:

`REMOVE_LEGACY_AUTHORITY_AND_REPLACE_AS_SPECIFIED`

This is asserted for at least:

- `LIFECYCLE_STAGE` → frozen Layer-1 lifecycle ending in `LIFECYCLE_CONFIRMED`;
- `ENTRY_EVENT_CONFIRMED` → future closed-bar event predicate only after §14C provenance, never a rename of `assessTrigger`;
- `RISK_REDUCING_DATA_BYPASS` → explicit `RISK_REDUCING` path rather than spoofed `dataExecutionOk:true`.

So `LEGACY_REMOVE` now means **remove the legacy authority**, not necessarily delete the semantic obligation.

### 5. Evidence after final self-review

- authority inventory hash: `163f62461c2370d186eb252d39a6a8c7f4c48f509402aa435a391358cd663185`
- ATR sweep hash: `017d57d31be53f5f90d2c75880332da4d0453dad76598d8d719f81ac0d0dd6d8`
- semantic fields: **46**
- total sinks: **189**
- live/reachable authority sinks: **137**
- verdict-write sinks: **34**
- inventory defects: **0**
- ATR bindings / consumer statements: **53 / 96**
- permissive ATR capital branches: **0**
- unresolved ATR shapes: **0**
- Gate 3A tests: **24/24 passing**
- frozen source inline scripts: **7/7 parse**

### 6. What I challenged after the fix

I did not stop at the requested `readyOk` mutation. I checked whether the same one-level-up defect persisted in the live planner and added the `p.executionEligible` mutation. I also audited the full challenged name set so `coreOk`, `regimeOk`, the research-only `directEligible`, and non-authority renderer/logging values could not disappear from the evidence simply because they sit in different functions.

I deliberately did **not** expand the scanner into every helper/filter/sort in every function reachable from the monolith. That produced a large false-positive surface where ordinary data transformations were mislabeled as authority. The final design stays purpose-built: authority sinks plus verdict producers that are known to compute authority/research decisions, with explicit disposition for the challenged non-authority values.

### 7. Remaining limits

1. This remains a purpose-built brownfield static analyser, not a JavaScript AST/type-flow theorem prover.
2. Server-side `/api/broker/*` implementations are absent from the HTML and remain Gate-4 evidence.
3. Gate-2 decision-flip evidence still uses proxy geometry; Gate 3 extraction owns engine-derived geometry measurement.
4. The profile engine still depends on outer `TTI_FOUNDATION_REFERENCE`; Gate 3 extraction owns that boundary.
5. Gate 3A evidence completeness is bounded to the frozen Gate 2.2 monolith. Gate 3B should replace this temporary static-analysis boundary with explicit package/contracts and equivalence tests.

### 8. Self-review conclusion

The specific verdict-write blocker is closed and non-vacuously tested. The earlier sink-first, reachability, predicate-admission, planner/selection, broker-boundary and ATR corrections remain intact. I find no remaining **known** Gate 3A blocker in this package.

**Next action:** Claude independently reviews this closure. If accepted, Gate 3B may proceed. Gate 4 remains unauthorized.

---

### Round 3 — closure of Claude's independent review of `5470b6ff…`

Three live misses were reported. All three are closed in the scanner itself, not by adding the reported names to a list.

**1. Returned-record properties.** feedGate's `coreOk:` property accepted an undeclared conjunct with zero defects while its sibling `executionOk:` was caught — only `executionOk:` had a direct pattern. Every top-level property of every `return {...}` in an authority owner is now parsed; verdict-shaped properties become `GATE_FIELD_WRITE` sinks whose value dependencies must close.

**2. New fields on a live gate.** A new property on a live gate record was invisible. `GATE_RETURN_SCHEMA` now freezes the returned-field set of every live gate owner from the cleared Gate 2.2 artifact. Any unregistered field is a defect regardless of its name or value. This is the only mechanism that catches `forceExecute:true` on the broker intent record — a bare literal with no undeclared token for a dependency check to find.

**3. Reassignment.** `p.executionEligible = …` reassignment was caught but `runwayOk = …` was not, because bare names required `const/let/var`. The `BARE_REASSIGN` write form is now captured and audited exactly like a declaration.

#### What the new sinks found in the clean artifact

Coverage that finds nothing on a clean build is suspicious. These three dependencies were previously invisible and are now classified to **existing** catalogue fields (field count unchanged at 46):

- `coreStrategyEvaluate` returns `eligible: score >= V5_THRESH.watch` — a **live** authority write gated on the historical WATCH prior → `LEGACY_EVAL_SCORE`.
- feedGate's returned `coreOk` reads `executionBars` → `CANONICAL_ATR_AVAILABLE`.
- `lifecycle` **reassigns** `overlap = b.l<=hi && b.h>=lo` inside its touch loop — surfaced only by reassignment coverage → `LIFECYCLE_STAGE`.

#### Non-vacuity

All six new mutation cases **miss on the pre-fix scanner and are caught after**. The clean artifact has 0 defects under both.

Mutations are now owner-targeted and assert where they landed. The reviewer's own first probes used a plain `replace()`, which hits the first occurrence anywhere: three of them silently mutated `calibrationAudit`, `exportHistCSV` and `emptyLevelPlan` and reported misses that were not real.

#### Coherence

The reachability fallthrough is now published. `classifyReachability()` returns `UNREACHABLE_LEGACY` for any owner not reachable from `LIVE_ROOTS`, but the published list was hard-coded to two names. `unreachableByFallthrough` now lists `assessDataHealth`, `assessTrigger` and `validateFireGeometry`. Each was verified to have only legacy callers and no dynamic or string-dispatched reference.

#### A finding that changes Gate 3B priorities

**`assessTrigger` is not on the live path.** It is called only from `updateLegacySignalState` and `checkLegacySig`, which are themselves unreachable from the live roots. The live profile engine computes its trigger authority through `lifecycle`/`plan`, not through `assessTrigger`.

Consequences:

- Gate 3B's §14A `assessTrigger` decomposition removes **dead** code. It is still required, because an unreachable function can be re-wired, but it is not where live trigger authority sits.
- Gate 1's `breakAndGoFresh` removal from `assessTrigger` (G1-05/06/07) was belt-and-braces. It did not change live behaviour; Gate 1's live-path equivalence was proven through the profile engine's `seeds()` and `analyze()`, which is where it actually mattered.
- The live conviction-like surface Gate 3B should prioritise is the returned `eligible` in `coreStrategyEvaluate`, which gates on a historical prior in production today.

#### Two false claims of my own, both caught by verifying them

**First.** The draft of this section said the scanner "does not model writes through aliases of the returned object … None occurs in the live gate owners today." I verified that sentence instead of leaving it asserted. It was false. `lifecycle` builds a record `c`, mutates it across nine fields, and returns it via `return c;` four times. A new field on `c`, or a conjunct injected into `c.stage = …`, produced zero defects. `lifecycle` produces lifecycle stage — the canonical Layer-1 contract Gate 3B is built around. It also meant the schema I had just frozen was wrong for `lifecycle`, missing nine fields.

**Second.** The replacement sentence said "none uses `Object.assign` … today." I verified that too. It was also false. `planTradeLevels`, the live trade planner, builds `p = emptyLevelPlan(…)`, populates it through `Object.assign(p, {…})`, and returns `p` six times. Its frozen schema held **5** fields; the real returned record carries **39**. A field injected through `Object.assign` was invisible.

Both are now closed:

- **Alias-return tracking.** Each `return <ident>;` resolves to its record: the fields of its object-literal initializer, every member write onto it, and every `Object.assign(<ident>, {…})` onto it.
- **Producer freezing for spread.** `lifecycle` builds `c = {...seed, …}` and `analyze` builds `result = {...base, …}`. A field added to a spread source upstream flowed into a live record undetected. Rather than chase spreads across functions — whole-program dataflow, the wrong boundary here — the record is frozen where it is produced: the seed record in `seeds()` (the `mk` literal plus the `extra` literals at every `add()`/`addResearch()` call site feeding `mk`'s `...extra` tail), and `analyze`'s `base`, which is itself a returned alias.

The schema was re-frozen after each fix. It now covers ten live owners, including `seeds` as the producer of the record `lifecycle` spreads.

Every alias field is **schema-frozen**, so any addition is a defect. Only **authority-bearing** alias fields are **dependency-closed**. Closing every field would pull human-readable `reason` text and counterfactual `alternatives` into authority — the false-positive surface this scanner deliberately avoids.

The lesson is the one this whole gate keeps teaching: a statement about coverage is a hypothesis until someone tries to break it. That applied to my own sentences as much as to the scanner.

#### Limits, derived from verification rather than asserted

Checked across all ten live owners with a record schema. Each of the following was **found absent in live owners today**. That is an observation about this artifact, verified by scan, not a guarantee about future code:

- `Object.assign` onto anything **other** than a returned alias — absent.
- Computed keys (`{[k]: v}`) — absent.
- Quoted keys (`{"k": v}`) — absent.
- Reassignment through destructuring (`({x} = y)`) — absent.

Known, present, and **not** closed by this scanner:

- **Geometry fields are schema-frozen but not dependency-closed.** `rejectionExtreme`, `level`, `zoneLow`, `zoneHigh` and `touchAt` cannot gain a new sibling undetected, but a conjunct injected into their right-hand side is not detected. `rejectionExtreme` feeds stop placement, so this is the limit most likely to matter economically. It belongs to Gate 3E's `FrozenTradeGeometry`, where geometry stops being a mutable record at all.
- **A brand-new live gate owner** is held to the schema only if it is also a discovered authority owner. The schema freezes existing owners.

The scanner remains a purpose-built brownfield analyser, not a whole-program dataflow prover. Mutation testing proves coverage of shapes someone thought to try; every shape here is now a regression test. `GATE_RETURN_SCHEMA` is frozen by value, so adding a legitimate field at Gate 3B requires a declared schema change — the intended friction.
