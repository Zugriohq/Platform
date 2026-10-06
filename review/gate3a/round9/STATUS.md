# Round 9 — SUPERSEDED

Status: **SUPERSEDED / NOT CLEARED / NOT GOVERNED**. Superseded before independent review: the author's
pre-review against the reviewer's round-9 checklist found in-scope gaps (paths under a producer,
reflective writes, the risk policies outside the closure); remediated in `../round10`. The package is unchanged.

_Original status as committed:_ REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED

Round 9 answers the independent review of round 8 (`../round8/INDEPENDENT-REVIEW.md`, finding R8-01: module-scope producers of live authority were not bound by the baseline). It is committed exactly as produced and is not to be edited in place.

- Delivered archive: `Zugrio_Gate3A_Round9_Review.zip`, SHA-256 `8c3a811c2999235833f857c16a4fa3aed591b35b0072271da39291926ee6289e`
- Internal manifest: `PACKAGE-SHA256-MANIFEST.json` (26 files; this file is not listed)
- Supersedes: round 8 (`../round8`, archive `67fc846f…1d59`)
- Frozen artifact unchanged (`52dcdbcd…c178`); dependency vocabulary unchanged since round 7 (`90499ad2…`)

The same author wrote rounds 7–9. Its results are evidence of remediation, not independent validation:
- 77/77 tests pass;
- the producer battery runs 18 cases with 0 failed, against 17 failed under the round-8 scanner;
- the substitution battery runs 46 cases with 0 failed;
- the mutation battery runs 53 cases with 0 missed.

## Narrow review scope (as the round-8 review asked)

1. The producer closure (`topLevelProducerClosure`) and its 108 producers. Is anything that live authority reads by name missing, and is anything included that it does not read?
2. Write routes the writer and escape rules may miss: getters/setters, `Reflect.set`, `Object.defineProperty`, prototypes, or a spread copy that is then mutated.
3. The effect-call rule: a call whose result is discarded is not treated as a producer through that call.
4. Values that reach authority without a module-scope name. This is stated as a limit.

After this, the recommended next step is the Gate 3.1 §14A consumer map, not more scanner rounds.

## Reproduce (from this repository layout)

```
cd review/gate3a/round9
node --test test/gate3a.test.js                                                  # 77 tests
node tools/gate3-producer-battery.js                                             # 18 cases, 0 failed
node tools/gate3-producer-battery.js ../round8/tools/gate3-authority-inventory.js  # 17 failed (non-vacuity)
node tools/gate3-substitution-battery.js && node tools/gate3-mutation-battery.js
node tools/gate3-authority-inventory.js && node tools/gate3-generate-report.js && git status --porcelain .   # expect no output
```
