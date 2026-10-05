# Round 7 — SUPERSEDED

Status: **SUPERSEDED / NOT CLEARED / NOT GOVERNED** — rejected for freeze by independent review
(`INDEPENDENT-REVIEW.md`); remediated in `../round8`. The package below is unchanged; only
this status note and the review record were added.

_Original status as committed:_ REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED

This directory is the round-7 Gate 3A package exactly as produced. It is not
to be edited in place: if independent review finds misses, round 8 fixes
round 7 in a new directory and round 7 stays as history.

- Delivered archive: `Zugrio_Gate3A_Round7_Review.zip`
- Archive SHA-256: `1f62988ee92dcb0d258836442945a2666e0cf85dd52d719cfd975d795b1f1d80`
- Internal manifest: `PACKAGE-SHA256-MANIFEST.json` (17 files)
- Supersedes: round 6 (`../round6`, archive `8be267b3…0556`)
- Frozen artifact unchanged: `artifacts/Zugrio-1.0.0-gate2.2.html`, SHA-256 `52dcdbcd…c178`

The same agent that found the round-6 misses wrote these fixes. Its results
(65/65 tests, 39/39 attacks caught, 53-case battery with 0 missed and 0
vacuous) are evidence of remediation, **not** independent validation.

## Independent review scope

1. All 39 mutations, and whether the new scanner genuinely catches each one
   (not by an unrelated or incidental defect).
2. The 1,367-entry frozen vocabulary (`tools/gate3-dependency-vocabulary.json`).
3. The new `BROKER_ORDER_PAYLOAD` catalogue field and its classification.
4. UPPER_CASE and NOISE-name acceptances in the vocabulary.
5. Narrowed `Object.assign` handling (only the guard prefix is the sink).
6. Early-return / `break` guard treatment.
7. Expression-bodied arrow ownership in the function index.
8. Indirect broker dispatch (by reference) and event-bus (`emitEngine`) dispatch.
9. Reproducibility, and the changed ATR attribution (one site `seeds` → `mk`;
   totals unchanged).
10. Whether the new tests (3A-53 to 3A-65) and the R7 battery cases are
    themselves non-vacuous.

## Reproduce

```
cd review/gate3a/round7
node --test test/gate3a.test.js          # 65 tests
node tools/gate3-mutation-battery.js     # 53 cases, exit 1 on any miss or vacuous case
node tools/gate3-generate-report.js      # regenerates evidence; must be byte-identical
git status --porcelain .                 # expect no output
```

This file is the only addition to the package; it is not listed in the
package manifest.
