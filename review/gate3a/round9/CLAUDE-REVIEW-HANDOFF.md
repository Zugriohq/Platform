# Gate 3A — Independent Review Handoff

<!-- GENERATED:CURRENT-EVIDENCE:BEGIN -->
## Current evidence (generated from the final JSON — do not edit by hand)

| | |
|---|---|
| Artifact scanned | `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178` (Gate 2.2, cleared, unchanged) |
| Authority inventory hash | `37714db59d9954321e871345c752b1c2adeedb9d0447f49f164110a665fa9088` |
| ATR semantic sweep hash | `a704fe2b6c1198da3e18524ce471e480a056de515b94e04cb4aa7b4d63fc3616` |
| Authority sink records | **1005 authority sink records** (920 live) |
| Verdict-write sinks | **39 verdict-write sinks** |
| Returned-field sinks | 39 |
| Authority producer sinks | 687 |
| Reassignment / alias / Object.assign sinks | 5 / 7 / 1 |
| Schema-frozen live owners | 10 |
| Broker order-field / collection-mutation / invocation-guard sinks | 45 / 0 / 1 |
| Frozen dependency vocabulary | **1367 frozen vocabulary entries**, `90499ad2362c1a1e486a9c55736d9ba6c9b4f628f1d3c9076d7c1cf0aa9229cc` |
| Frozen authority baseline | **1009 signed sinks** (89 unclassified Object.assign leaves), 89 owner fingerprints, `77c4193782078f555d0e08a38f30c7a0ad6a2838c291f50e277a60fbb5de6159` |
| Module-scope producer closure | **108 producers** (43 bindings, 36 functions, 29 writers) |
| HP-3 threshold worksheet | 209 live sinks with non-trivial numeric literals, provenance UNRECORDED |
| Classified semantics | **47 classified semantic fields** |
| Inventory defects | **0** |
| ATR sweep | 53 bindings, 96 consumer statements, 0 permissive capital branches, 0 unresolved |
| Gate 3A tests | **77 tests** |
<!-- GENERATED:CURRENT-EVIDENCE:END -->

## Round 9 — module-scope producer closure

**Status: REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED.** These fixes are by the same author as rounds 7 and 8. They are evidence of remediation, not independent validation.

The independent review of round 8 accepted its substitution work but rejected it for freeze on **R8-01**. Module-scope values read by live authority were outside the baseline: `ASSET_PROFILES`, `TTI_GEOMETRY`, `V5_THRESH`, `PROFILES`, `SECONDS`, and others. A table could change while every consumer expression (for example `ASSET_PROFILES[k]`) and every authority function stayed byte-identical. **This was reproduced first:** five such edits scanned clean under round 8.

### What changed

| | |
|---|---|
| Producer closure (`topLevelProducerClosure`) | Seeds: the module-scope names that a live sink's expression, or its code consequence, reads. It follows those names to a fixed point through:<ul><li>declarators and module-level writes;</li><li>the bodies of value-producing functions;</li><li>every function that writes a producer;</li><li>aliases and arguments through which an object producer can be written (`const p=ASSET_PROFILES; p.X=…`, `zgSet(ASSET_PROFILES)`).</li></ul>Scope is modelled properly: the script, plus the body of every module-level IIFE (`(function(){…})()`, `const TTI_PROFILE_ENGINE=(()=>{…})()`). Each producer is fingerprinted in canonical code form. A drift is `AUTHORITY_PRODUCER_DRIFT`, naming the producer. |
| What is *not* a producer | A function called only for its effect (result discarded) does not join the closure through that call; if it writes a producer, it is found as a writer anyway. The prose consequence of a producer-closure sink is not read as code. A primitive constant cannot be written through an alias, so the escape rule does not apply to it. |
| Size | **108 producers: 43 bindings, 36 functions, 29 writers**, out of 362 functions. Values that live authority does not read stay outside the closure (3A-76): `SIGNAL_STATES` (read only by unreachable legacy code), `GLOSSARY` (renderer only) and `CONTINUATION_REGIMES` (research only). |
| Producer battery (`tools/gate3-producer-battery.js`) | 18 cases covering the review's 10 categories:<ol><li>property value;</li><li>property presence or removal;</li><li>numeric threshold;</li><li>nested profile field;</li><li>array member;</li><li>constant;</li><li>table entry;</li><li>default or fallback;</li><li>enum mapping;</li><li>module-level function body.</li></ol>It also covers a module-level write, an alias write, an argument write, an effect call and a runtime UI writer. Every consumer-preserving case must be reported **only** at the producer boundary, with no sink or owner drift. Results: round 9 catches 18 of 18; round 8 catches 1 (the runtime writer, through the round-6 global-write closure). All 4 precision controls are clean. |

### Bugs of my own found while doing this

1. **The first closure was over-inclusive (863 producers).** Locals inside anonymous callbacks looked module-scoped. The fix was to model module scopes and IIFE bodies.
2. **Seeding from whole authority-function bodies pulled in every renderer they call.** Seeds are now what flows into a sink.
3. **A module-level statement scan stopped at an unmatched `(`, so the forward scan ran to the end of the file.** Prepending one benign listener then pulled about 40 unrelated bindings into the closure. Test 3A-77 fails without the fix; this was verified by reverting it.

### Limits (also in the frozen map, §8)

- The closure follows names. A value reaching live authority without a name — through a runtime-keyed lookup on a module object, `eval`, or data loaded at runtime — is outside it. The artifact SHA-256 still pins the code that does so.
- Shadowing is resolved conservatively: it may over-include, never under-include.
- Binding is not correctness. Whether `ASSET_PROFILES`, `riskFraction` or a regime quality value belongs where it is used is §14A–§14C work.

### What to attack in round 10

1. A producer that reaches a live sink **without** a module-scope name.
2. A write to a producer that the writer and escape rules miss: a getter/setter, `Reflect.set`, `Object.defineProperty`, a prototype, or a spread copy that is then mutated.
3. The effect-call rule: a discarded-result call whose callee changes authority other than by writing a module-scope binding.
4. **Recommended next, instead of continuing scanner rounds:** the §14A consumer map for Gate 3.1. The review surface of the inventory itself should now be narrow.

Reproduce (round 8 sits beside this package in the repository):

```
cd review/gate3a/round9
node --test test/gate3a.test.js                                          # 77 tests
node tools/gate3-producer-battery.js                                     # 18 cases, 0 failed
node tools/gate3-producer-battery.js ../round8/tools/gate3-authority-inventory.js   # 17 failed (non-vacuity)
node tools/gate3-substitution-battery.js                                 # 46 cases, 0 failed
node tools/gate3-mutation-battery.js                                     # 53 cases, 0 missed
```

## History (superseded — not current evidence)

### Round 8 — superseded by round 9 (round-8 package `67fc846f…`)

**Status: SUPERSEDED — rejected for freeze (finding R8-01).** The fixes below were written by the same agent that wrote round 7, so the green results here show what was remediated; they do not validate it.

The independent review of round 7 rejected it for freeze. Its central claim was that the frozen vocabulary detects *new* dependencies but not an accepted dependency swapped for another accepted one, a deleted dependency, or a rerouted one. **That claim was reproduced before anything was fixed:** 11 such mutations (a threshold swap, a deleted conjunct, a stop/target swap, a literal-only threshold change, a deleted guard, …) all scanned clean under round 7.

#### What changed

| | |
|---|---|
| Authority baseline (`tools/gate3-authority-baseline.json`) | Every live authority sink is signed over owner, kind, code-only expression, whole consequence (no longer truncated at 360 characters) and its dependency → canonical list. Every function owning a sink gets a code-only fingerprint. Any removed, added or changed sink is `AUTHORITY_BASELINE_DRIFT`, localised to the sink. A removed and an added sink that share an expression are reported as one *changed* sink, saying whether its dependencies or its consequence moved. An owner change with no sink change is `AUTHORITY_OWNER_DRIFT`, meaning authority code that no sink covers. It is frozen with `--freeze-baseline` and, like the vocabulary, refuses to freeze from a scan that has defects (3A-71). |
| Canonical code form | Comments and layout are ignored; literal contents, operators and the line breaks that automatic semicolon insertion makes significant (`return⏎x` ≠ `return x`) are kept (3A-69). |
| `Object.assign` leaves | Signed as `OBJECT_ASSIGN_LEAF` / `OBJECT_ASSIGN_SOURCE`, unclassified. Before this round, a substituted plan `stop` or `t1` inside `planTradeLevels`' `Object.assign` was caught only by the owner fingerprint. |
| Substitution battery (`tools/gate3-substitution-battery.js`) | 46 cases across the review's 14 categories, plus deletion, reroute and `Object.assign`. Each case proves its class first: with the baseline disabled it must scan clean, otherwise the case is invalid. Results: round 8 gives 43 sink-localised and 3 caught by the vocabulary (as each declares), with 0 missed. Round 7 misses 43 of 43. All 3 precision controls (comments, own-line comment, reflow) stay clean. |
| Order-field successors (`evidence/GATE3A-ORDER-FIELD-SUCCESSORS.json`, **proposed**) | All 45 broker order fields are mapped to their successor in the frozen specification: REPLACE 19, PROVENANCE 15, REMOVE 8, AUDIT 3. Test 3A-72 fails if a field is sent without an entry, or an entry is left for a field that no longer exists. This keeps `BROKER_ORDER_PAYLOAD` (LEGACY_REMOVE) from becoming an escape hatch. |
| HP-3 threshold worksheet (`evidence/GATE3A-THRESHOLD-WORKSHEET.json`) | Lists the 209 live authority sinks that carry a numeric literal other than 0/1 (380 literals). Every provenance is `UNRECORDED`. |

#### Where this round disagrees with the review, and why

1. **The scanner can prove change, not correctness.** "Every authority-changing substitution must be detected" can only be met as "every change to live authority code is detected". A static scanner cannot decide which change is authority-changing, or which dependency is the right one. Passing the substitution battery therefore proves the inventory is **bound** to the cleared code. It does not prove semantic authority integrity.
2. **The review's point 2 is correct and is not closed here.** The vocabulary and the baseline are both derived from the artifact and trust it. Whether each input, predicate and threshold belongs where it is, is the §14A/§14B/§14C classification of Gate 3.1–3.3, checked against the frozen Signal Authority specification and signed off by a person. No scanner rule was written to stand in for it, and no classification was changed in this round.
3. **The artifact's SHA-256 already detects any byte change** to the frozen artifact (3A-01). The baseline's value is:
   - localisation: it says *which* decision changed;
   - binding each catalogue classification to exact code;
   - an equivalence reference for the migrated Decision Core.

   It adds no detection power over the frozen file itself, and it should be weighed on that basis.
4. **`Object.assign`:** the mechanism concern was right, and it is fixed above. On Gate 2.2, though, no live `Object.assign` leaf reaches the capital path.
   - `makeIntent` takes its levels from the profile engine's `plan()` through `checkSig`'s `lvls:cloneResearchSnapshot(plan)`, not from `planTradeLevels`.
   - The plan `stop`/`targets` that `planTradeLevels` writes are read only by renderers, outcome tracking and the unreachable legacy state machine.
   - The variable-source, conditional-source and literal attacks introduce `Object.assign` into `analyze`, which never used it, so the vocabulary catches them.
5. **Early-return mappings and UPPER_CASE/NOISE acceptances** remain provisional scanner classifications. Swapping one accepted name for another is now caught (battery). Whether each acceptance is *legitimate* is classification work, listed per sink in the inventory for the reviewer.

#### Found while doing this round

- **Conflict with §10.3 OA-1 / H-5B (Gate 4 item, not changed here).** The entry order's `eventId` is built in `checkSig` as `[k, profileId, triggerAt, Math.round(now)]`. The wall-clock term makes it non-deterministic, so it cannot be the identity preimage that OA-3 ("at most one entry intent per `(fireEventId, accountId)`") relies on. The exit intent's `eventId` is deterministic.
- **Capital threshold without provenance.** `riskFraction` defaults to `.0025` when the server policy is absent. It is in the HP-3 worksheet.
- **Gate 3.1 scope is wider than Gate 3A.** §14A requires mapping every consumer, including watchlist ordering, trade-plan presentation and research logging. Gate 3A inventories authority sinks only.

#### What to attack in round 9

1. **Sink coverage.** Find an authority-changing edit that yields only `AUTHORITY_OWNER_DRIFT`. That would be a place where live authority code has no sink. (In this round, the only such cases were the two `Object.assign` leaves, now signed.)
2. **Canonical-form collisions.** Find two semantically different pieces of code with the same canonical form, for example through an automatic-semicolon-insertion context not covered by 3A-69.
3. **Class membership of the battery.** Find a battery case that passes for a reason other than the substitution it names.
4. **The successor table.** It is a proposal, written against spec v1.0.2 §6.7–§10.11. Each REMOVE disposition asserts that something must *not* ride in an order.
5. **Server side.** Everything behind `/api/broker/*` remains outside this artifact. This limit is unchanged.

Reproduce from the repository layout (round 7 sits beside this package):

```
cd review/gate3a/round8
node --test test/gate3a.test.js
node tools/gate3-substitution-battery.js                                       # 46 cases, 0 failed
node tools/gate3-substitution-battery.js ../round7/tools/gate3-authority-inventory.js   # 43 failed: non-vacuity
node tools/gate3-mutation-battery.js                                           # 53 cases, 0 missed
```


### Round 7 review — superseded by round 8 (round-7 package `1f62988e…`)

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

#### Changes that needed the reviewer's judgement (as written in round 7)

1. **New semantic field `BROKER_ORDER_PAYLOAD`** (LEGACY_REMOVE / NOT_APPLICABLE, successor: the Gate-4 typed order payload). No new classification was added to the frozen taxonomy. Stop and take-profit stay under STOP_GEOMETRY / TARGET_GEOMETRY.
2. **Emit guards mapped to `POSITION_MANAGEMENT_GATE`**, because `CLOSED_BAR` drives `routeConfirmedReversal`.
3. **Behaviour change of two round-6 precision controls.** A behaviour-preserving helper on the capital path, or a second order-submitting listener, is now reported — only as vocabulary novelty naming the new surface. Precision is instead pinned on edits outside live authority (3A-63). The reviewer should confirm that new authority code, even if equivalent, must surface in a reviewed diff.
4. **The vocabulary itself** (`tools/gate3-dependency-vocabulary.json`) is the list of what live authority currently accepts and by which rule. Its UPPER_CASE and NOISE_NAME acceptances deserve a direct read: configuration tables such as `TTI_SPECIALIST_MODELS` decide execution permission.

#### What to attack in round 8 (as written in round 7 — item 1 is what the round-8 review found)

1. **Same-owner reuse.** The vocabulary works per `(owner, token)`. A gate rewired inside one owner to an already-classified token is not reported; decide whether that granularity is enough.
2. **Registry bodies.** A callback stored in an array is flagged at its dispatch site but its body is not traced.
3. **The noise-name trace.** Field-level order closure is implemented for the order builder's `item`; any other bare NOISE name that carries a whole record across a call boundary would still stop the backward trace.
4. **Server side.** Everything behind `/api/broker/*` remains outside this artifact (unchanged limit).


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
