# Round 8 — REVIEW CANDIDATE

Status: **REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED**

Round 8 answers the independent review of round 7 (`../round7/INDEPENDENT-REVIEW.md`), which rejected it for freeze because the frozen vocabulary detects only *new* dependencies. Round 8 is committed exactly as produced and is not to be edited in place: if review finds misses, round 9 fixes it in a new directory.

- Delivered archive: `Zugrio_Gate3A_Round8_Review.zip`, SHA-256 `67fc846fa67a4137ba6ba0a526f6866aefbc68f10f95c05dab8f65b285af1d59`
- Internal manifest: `PACKAGE-SHA256-MANIFEST.json` (23 files; this file is not listed)
- Supersedes: round 7 (`../round7`, archive `1f62988e…1d80`)
- Frozen artifact unchanged: `artifacts/Zugrio-1.0.0-gate2.2.html`, SHA-256 `52dcdbcd…c178`
- Dependency vocabulary unchanged from round 7 (`90499ad2…`). No vocabulary entry was added to make any mutation detectable.

The same agent wrote rounds 7 and 8. Its results are evidence of remediation, **not** independent validation:
- 72/72 tests pass;
- the substitution battery runs 46 cases with 0 failed, against 43 failed under the round-7 scanner;
- the mutation battery runs 53 cases with 0 missed.

## What round 8 establishes, and what it does not

- **Established:** every change to live authority code in the frozen artifact is reported, localised to the sink where one covers it. This includes substitution of an already-accepted dependency, deletion, threshold-literal change, reroute and `Object.assign` leaf edits. Comment and layout edits are not reported.
- **Not established:** that any frozen dependency, predicate or threshold is *semantically correct*. Checking that against the frozen Signal Authority specification is Gate 3.1–3.3 classification work (§14A/§14B/§14C). It needs the specification as its oracle and human sign-off.

## Independent review scope

1. The substitution battery: whether every case is in class, and whether any case passes for a reason other than the one it names.
2. The canonical code form: look for collisions between semantically different code.
3. Sink coverage: look for an authority-changing edit that produces only `AUTHORITY_OWNER_DRIFT`.
4. `evidence/GATE3A-ORDER-FIELD-SUCCESSORS.json` (proposed): each successor and disposition against spec v1.0.2.
5. `evidence/GATE3A-THRESHOLD-WORKSHEET.json`: whether anything is missing. It is the input to HP-3; no provenance is asserted in it.
6. The disagreements stated in `CLAUDE-REVIEW-HANDOFF.md` ("Where this round disagrees with the review").

## Reproduce (from this repository layout)

```
cd review/gate3a/round8
node --test test/gate3a.test.js                                                 # 72 tests
node tools/gate3-substitution-battery.js                                        # 46 cases, 0 failed
node tools/gate3-substitution-battery.js ../round7/tools/gate3-authority-inventory.js   # 43 failed (non-vacuity)
node tools/gate3-mutation-battery.js                                            # 53 cases, 0 missed
node tools/gate3-authority-inventory.js && node tools/gate3-generate-report.js && git status --porcelain .   # expect no output
```
