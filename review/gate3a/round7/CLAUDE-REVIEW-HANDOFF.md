# Gate 3A — Independent Review Handoff

<!-- GENERATED:CURRENT-EVIDENCE:BEGIN -->
## Current evidence (generated from the final JSON — do not edit by hand)

| | |
|---|---|
| Artifact scanned | `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178` (Gate 2.2, cleared, unchanged) |
| Authority inventory hash | `3aa2b5b742bffa432d5a3011f45471b6a0ae8ad2336e3f1f53c50fc330a2f4c2` |
| ATR semantic sweep hash | `a704fe2b6c1198da3e18524ce471e480a056de515b94e04cb4aa7b4d63fc3616` |
| Authority sink records | **1005 authority sink records** (920 live) |
| Verdict-write sinks | **39 verdict-write sinks** |
| Returned-field sinks | 39 |
| Authority producer sinks | 687 |
| Reassignment / alias / Object.assign sinks | 5 / 7 / 1 |
| Schema-frozen live owners | 10 |
| Broker order-field / collection-mutation / invocation-guard sinks | 45 / 0 / 1 |
| Frozen dependency vocabulary | **1367 frozen vocabulary entries**, `90499ad2362c1a1e486a9c55736d9ba6c9b4f628f1d3c9076d7c1cf0aa9229cc` |
| Classified semantics | **47 classified semantic fields** |
| Inventory defects | **0** |
| ATR sweep | 53 bindings, 96 consumer statements, 0 permissive capital branches, 0 unresolved |
| Gate 3A tests | **65 tests** |
<!-- GENERATED:CURRENT-EVIDENCE:END -->

## Round 7 — independent adversarial review of the round-6 package

Reviewer: Claude Code, working in the repository. The round-6 package reproduced exactly (evidence byte-identical, all tests passing). It was then attacked with 39 realistic, authority-changing mutations of the frozen Gate 2.2 artifact. **24 were missed**: 23 produced no defect at all, and one (an expression-bodied arrow) produced only an unrelated alarm — it had made `familyGate` unreachable. All 39 are caught now; a callback-registry dispatch (M7) is caught at its dispatch site, as it already was. The misses fell into the classes below; each is now closed and pinned by a test (3A-53 … 3A-65). Several classes also hid **real, uninventoried authority in the unmodified artifact**, which this round adds to the map.

| Class | Example that was missed | Root cause | Real gap in the frozen artifact? |
|---|---|---|---|
| Laundering by name similarity | READY gated on `candidate.targetBias` / `riskAppetite` / `stopHunter` | the global classification table matches substrings (`stop`, `risk`, `target`, `.score`…) | every accepted token is now published for review |
| UPPER_CASE / NOISE names | `&& SECRET_SWITCH`, `&& value` | bare UPPER_CASE names excused; NOISE names dropped | constants such as `TTI_SPECIALIST_MODELS`, `ASSET_PROFILES`, `RETEST_POLICY` were accepted unreviewed |
| Helper reads an undeclared field of its argument | `quietGate(c){return c.pnlHint>0}` | parameter termination assumed the caller had checked the field | — |
| Truncated order values | `riskFraction: …*Math.min(1,riskScale)*boost` | `key:([^,}]+)` stops at the first comma | **yes** — `riskFraction` was recorded as `…*Math.min(1` |
| Order payload not a sink | `stopLoss: Number(levels.stop)*fudge`, side flipped | only risk/data/permission fields were sinks | **yes** — side, entry, instrument, event/position/candidate identity sent to the broker were uninventoried (new field `BROKER_ORDER_PAYLOAD`) |
| Order provenance cut at the event bus | — | `emitEngine(…,{k,item})` passes `item`, a NOISE name, so the slice never reached `checkSig`'s `const item={…}` | **yes** — the emitted order record is now closed field by field |
| Compound / logical assignment | `result.riskScale *= hidden`, `lane.state &&= …` | writes matched `name = expr` only | 62 compound writes exist in live code |
| Evidence removed by mutation | `cond && result.blockers.splice(0)`, guarded `Object.assign(result,{state:'READY'})` | not an assignment, so not a write | — |
| Early-return guards | `if(input.hiddenStop) return base;` in `analyze`; same in `checkSig` / `updateSignalState` | an `if` whose consequence only returns or breaks was not an authority action | **yes** — `planTradeLevels`' plan rejections (`zoneCalc.infeasible`, stop below `__minValidStop`, unordered targets), the `evaluateStrategy` CORE/IMPLEMENTED switch, minimum-bars and missing-price guards |
| Expression-bodied arrows | — | `const f=(a)=>expr;` was given the body of the next `{` in the file | **yes** — seven arrows (including `run` in the broker queue) owned up to ~9 KB of unrelated code |
| Dispatch by reference / guarded emits | `if(flag) Promise.resolve(item).then(route)` | only `route(` calls counted; emit guards were not sinks | **yes** — the guards deciding when reversal exits run (`recomputeFull: isNewClosedBar`, `updateSignalState: lastProfileCloseKey`) were uninventoried |

Held up under attack: the round-6 lexer claim (a regex after `)` — detected), early returns, selection filters, ternary verdict writes, arming-check bypasses, and the event-bus listener modelling. A function-boundary weakness (braces matched on raw text) had **no** effect on this artifact (identical index) but moved sink ownership under mutation; it is fixed.

**ATR sweep hash changed, totals did not.** The sweep reuses the scanner's function index. With expression-bodied arrows fixed, one ATR site inside the seed record is now attributed to `mk` (the arrow that contains it) instead of `seeds`; every sweep total — bindings, statements, permissive and unresolved branches — is identical.

### Changes that need the reviewer's judgement

1. **New semantic field `BROKER_ORDER_PAYLOAD`** (LEGACY_REMOVE / NOT_APPLICABLE, successor: the Gate-4 typed order payload). No new classification was added to the frozen taxonomy. Stop and take-profit stay under STOP_GEOMETRY / TARGET_GEOMETRY.
2. **Emit guards mapped to `POSITION_MANAGEMENT_GATE`**, because `CLOSED_BAR` drives `routeConfirmedReversal`.
3. **Behaviour change of two round-6 precision controls.** A behaviour-preserving helper on the capital path, or a second order-submitting listener, is now reported — only as vocabulary novelty naming the new surface. Precision is instead pinned on edits outside live authority (3A-63). The reviewer should confirm that new authority code, even if equivalent, must surface in a reviewed diff.
4. **The vocabulary itself** (`tools/gate3-dependency-vocabulary.json`) is the list of what live authority currently accepts and by which rule. Its UPPER_CASE and NOISE_NAME acceptances deserve a direct read: configuration tables such as `TTI_SPECIALIST_MODELS` decide execution permission.

### What to attack in round 8

1. **Same-owner reuse.** The vocabulary works per `(owner, token)`. A gate rewired inside one owner to an already-classified token is not reported; decide whether that granularity is enough.
2. **Registry bodies.** A callback stored in an array is flagged at its dispatch site but its body is not traced.
3. **The noise-name trace.** Field-level order closure is implemented for the order builder's `item`; any other bare NOISE name that carries a whole record across a call boundary would still stop the backward trace.
4. **Server side.** Everything behind `/api/broker/*` remains outside this artifact (unchanged limit).

## History (superseded — not current evidence)

### Round 6 handoff — superseded by the round-7 review above (round-6 package `8be267b3…`)

#### What to attack in round 7 (as written by the round-6 author)

Round 6 pinned both scanner assumptions and, in verifying them, replaced the shared blanker, corrected the call graph, widened the root set to real entry points, and modelled the engine event bus. Worth challenging:

1. **A second dispatch mechanism.** The event bus is modelled by name (`onEngineEvent` / `emitEngine`). Any other registry of callbacks invoked by index would be invisible in the same way the bus was.
2. **The over-approximation.** Calls outside named functions count as reachable. That is safe for finding authority, but it means "live" in this map is an upper bound, not a statement that code runs.
3. **The lexer.** Regex-versus-division is decided from the preceding token, so a regex literal directly after `)` or `]` is read as division. Verified: the frozen artifact contains none, a test fails if one is introduced, and the damage from a misread stops at the end of that line.
4. **The A1 guard's canonical name** is chosen as the most frequent binding of `S[...]`. A different shared-state container would need its own canonical name.

If none of these produces a live miss, I would freeze here. The reviewer's stated position was to stop extending the scanner once the boundary holds; round 6 extended it only where verification found live gaps.


Everything below is retained for lineage. Hashes and counters in this section describe **earlier rounds** and are not current evidence; the only current evidence is the generated block above.

## Claude Review Handoff — Zugrio Gate 3A Verdict-Write Closure

Your blocker was reproduced and fixed. Please review independently; do not infer clearance from the passing tests.

### Source identity

Cleared Gate 2.2 production artifact remains unchanged:

`52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178`

The previously supplied corrected package (`23a1daea…`) is superseded by this closure package because its scanner missed verdict-write initializers.

### Reproduce

```bash
node tools/gate3-authority-inventory.js artifacts/Zugrio-1.0.0-gate2.2.html
node tools/gate3-atr-sweep.js artifacts/Zugrio-1.0.0-gate2.2.html
node tools/gate3-generate-report.js
node --test test/gate3a.test.js
```

Expected:

- inventory methodology: `SINK_FIRST`
- semantic fields: **46**
- authority sink records: **189** / **137 live**
- verdict-write sinks: **34**
- inventory defects: **0**
- inventory hash: `163f62461c2370d186eb252d39a6a8c7f4c48f509402aa435a391358cd663185`
- ATR: **53 bindings / 96 statements**
- ATR permissive capital branches: **0**
- ATR unresolved: **0**
- ATR sweep hash: `017d57d31be53f5f90d2c75880332da4d0453dad76598d8d719f81ac0d0dd6d8`
- tests: **24/24**
- inline scripts: **7/7 parse**

### Your blocker — exact closure

The scanner now inventories the initializer that computes a verdict, not only the conditional that consumes it.

Two new non-vacuity controls matter most:

1. `const readyOk=secretEdgeFilter(k)&&...` → inventory defect containing `secretEdgeFilter`;
2. `p.executionEligible=runwayOk&&stopGeometryOk&&undeclaredProfitFilter(...)` → inventory defect containing `undeclaredProfitFilter`.

The test suite also retains the earlier READY-conditional and broker-admission mutations.

### Twelve-name audit

Please inspect `inventory.verdictAudit`. It explicitly dispositions all names you identified:

`readyOk`, `fireOk`, `executionEligible`, `econOk`, `thesisOk`, `runwayOk`, `stopGeometryOk`, `coreOk`, `regimeOk`, `priceValid`, `directEligible`, `allValid`.

Authority/research producers are first-class verdict sinks; renderer/logging/presentation-only values are explicitly excluded with a recorded reason.

### LEGACY_REMOVE clarification

I did not add a fifth authority classification because the frozen Gate-3 classification scheme should remain stable. Instead each field has `migrationDisposition`.

For lifecycle, future entry-event semantics and the risk-reducing data-bypass replacement, the disposition is:

`REMOVE_LEGACY_AUTHORITY_AND_REPLACE_AS_SPECIFIED`

Please challenge whether this is sufficient to prevent accidental semantic deletion during Gate 3B–3F.

### Review questions

1. Does `VERDICT_WRITE` now close the one-level-up blindness you demonstrated?
2. Do the `readyOk` and live `p.executionEligible` mutations genuinely prove non-vacuity of that sink class?
3. Are the twelve challenged verdict names correctly dispositioned between authority/research and renderer/logging/presentation?
4. Are `coreOk`, `regimeOk`, both `runwayOk` producers and research-only `directEligible` represented at the correct semantic layer?
5. Does `migrationDisposition` resolve the `LEGACY_REMOVE` ambiguity without changing the frozen classification taxonomy?
6. Did this closure accidentally broaden a non-authority helper into capital authority or conceal a current authority producer?
7. Are there any other verdict-producing assignments that should be mandatory before Gate 3A freezes?

### Boundary

This remains **Gate 3A only**. Acceptance authorizes Gate 3B. It does not clear Gate 3 as a whole and does not authorize Gate 4. After the whole Gate 3 clears, the separate Zugrio 1.0 Engineering Foundation checkpoint still occurs before Gate 4.


---

### Round 3 handoff — for the next independent reviewer

Claude's round-2 review of `5470b6ff…` reported three live misses; this package closes them. Please attack the new coverage rather than rerun the tests.

Specifically worth challenging:

1. **Geometry right-hand sides** — `rejectionExtreme`, `level`, `zoneLow`, `zoneHigh`, `touchAt` are schema-frozen but not dependency-closed. A conjunct injected into their value is not detected. `rejectionExtreme` feeds stop placement. This is the known gap most likely to matter.
2. **A new live gate owner** not already a discovered authority owner.
3. **Spread from a source that is neither a returned alias nor `seeds`.** Producer freezing covers the two spread sources that exist today; a third would need its producer frozen too.
4. **The four shapes verified absent today** — `Object.assign` onto a non-alias, computed keys, quoted keys, destructuring reassignment. Introduce one into a live gate and see whether anything notices.

Item 1 is where I would look first. It is a known, present gap rather than a hypothetical one.
