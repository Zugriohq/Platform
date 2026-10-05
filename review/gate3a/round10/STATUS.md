# Round 10 — REVIEW CANDIDATE

Status: **REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED**

Round 10 supersedes round 9 before round 9's independent review ran. The author ran the reviewer's round-9 checklist against round 9 first, and round 9 failed it:
- paths under a producer were not treated as write routes;
- reflective writes (`defineProperty`, `Reflect.set`) were missed;
- nameless routes (`eval`, computed global lookup, prototype writes) were only stated as limits;
- the module-scope risk policies were outside the closure. A 10× change to `TTI_RISK_POLICY.perEventRiskPct` scanned clean.

- Delivered archive: `Zugrio_Gate3A_Round10_Review.zip`, SHA-256 `fdae009bc59db752367d259391ba5b914690372bc07ab2e0e6cb0e393b1e4ffc`
- Internal manifest: `PACKAGE-SHA256-MANIFEST.json` (26 files; this file is not listed)
- Supersedes: round 9 (`../round9`, archive `8c3a811c…289e`)
- Frozen artifact unchanged (`52dcdbcd…c178`). The dependency vocabulary is unchanged since round 7 (`90499ad2…`).

Same-author results, which are evidence of remediation and not independent validation:
- 80/80 tests pass;
- producer battery: 28 cases, 0 failed (10 failed under the round-9 scanner);
- substitution battery: 46 cases, 0 failed;
- mutation battery: 53 cases, 0 missed.

## Narrow review scope: the reviewer's round-9 checklist, applied to round 10

1. **Producer-closure correctness:** 146 producers, including the risk policies; shadowing; module IIFEs; termination.
2. **Consumer-preserving mutations:** reported at the producer only (3A-73/74; producer battery).
3. **Indirect paths:** aliases, helper arguments, helper chains, nested object/array mutation, add/remove/replace, defaults (3A-75/78).
4. **Precision:** renderer-only, legacy-only and research-only values stay out; read-only aliases are not writers; scanner prose is not parsed as code (3A-76/77/78).
5. **Boundary:** `eval`, `Function`, string timers, global lookup, prototype, `Reflect`/`defineProperty` are frozen as dynamic-access sites (3A-79). Remaining outside: runtime-loaded *data*.
6. **Evidence integrity:** rounds 6–9 are unchanged; a fresh extract regenerates byte-identically.

After this, the next step is the Gate 3.1 §14A consumer map.

## Reproduce (from this repository layout)

```
cd review/gate3a/round10
node --test test/gate3a.test.js                                                   # 80 tests
node tools/gate3-producer-battery.js                                              # 28 cases, 0 failed
node tools/gate3-producer-battery.js ../round9/tools/gate3-authority-inventory.js   # 10 failed (non-vacuity)
node tools/gate3-substitution-battery.js && node tools/gate3-mutation-battery.js
node tools/gate3-authority-inventory.js && node tools/gate3-generate-report.js && git status --porcelain .   # expect no output
```
