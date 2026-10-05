# Round 11 — REVIEW CANDIDATE (final scanner round, under a proposed stopping rule)

Status: **REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED**

Round 11 answers the independent review of round 10 (`../round10/INDEPENDENT-REVIEW.md`, R10-01 and R10-02). It proposes a stopping rule that needs the reviewer's agreement; the rule is stated in `CLAUDE-REVIEW-HANDOFF.md` ("Round 11").

- Delivered archive: `Zugrio_Gate3A_Round11_Review.zip`, SHA-256 `9f98b95ccaf7743292dad248fa0fe8b1fef2b2e25c58fa8b68109ba3130ead69`
- Internal manifest: `PACKAGE-SHA256-MANIFEST.json` (27 files; this file is not listed)
- Supersedes: round 10 (`../round10`, archive `fdae009b…4ffc`)
- Frozen artifact unchanged (`52dcdbcd…c178`); vocabulary unchanged since round 7

## Stopping rule (proposed)

Gate 3A clears when:
1. the artifact's SHA-256 is pinned;
2. the inventory is reproducible;
3. code shapes the scanner does not model are fail-closed on the actual artifact — either proven absent (any appearance is a defect), or every occurrence is listed and dispositioned.

Mutation batteries are regression tests, not clearance criteria. A new adversarial form blocks only if it shows that the actual artifact contains an unmapped authority route.

## R10-01 / R10-02 against the actual artifact

- **R10-02 (global object as a value):** 0 occurrences. Fail-closed as scanner assumption A3.
- **R10-01 (producer reference handed off):** the artifact has 241 sites. They are frozen, so a new site is `REFERENCE_ESCAPE_DRIFT`. Every existing site is bound or dispositioned, and **0 need review** (`evidence/GATE3A-REFERENCE-ESCAPES.json`).
- The reviewer's exact counterexamples are caught when inserted into an existing IIFE (3A-81, 3A-82).

Same-author results; these show remediation, not independent validation:
- 83/83 tests pass;
- the producer battery runs 32 cases with 0 failed; the round-10 scanner misses 4 of them;
- the substitution battery (46 cases) and mutation battery (53 cases) are both clean.

## Reproduce

```
cd review/gate3a/round11
node --test test/gate3a.test.js                                                     # 83 tests
node tools/gate3-producer-battery.js                                                # 32 cases, 0 failed
node tools/gate3-producer-battery.js ../round10/tools/gate3-authority-inventory.js  # 4 failed (non-vacuity)
node tools/gate3-authority-inventory.js && node tools/gate3-generate-report.js && git status --porcelain .   # expect no output
```

Provisional Gate 3.1 draft (not governing): `../../gate3-1/`.
