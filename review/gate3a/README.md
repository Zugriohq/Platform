# Gate 3A review packages (non-governing)

**Nothing in this directory is Gate evidence, cleared, or governed.** It exists
so independent reviewers can inspect each round of the Gate 3A authority
inventory work in the repository, with a clean audit trail:

round 6 → discovered misses → round 7 remediation → independent review (rejected) → round 8 remediation → independent review (rejected: R8-01) → round 9 remediation → author pre-review (gaps found) → round 10 remediation → independent review (rejected: R10-01/02) → round 11 (final scanner round) → independent review (PASS, stopping rule accepted with amendment) → freeze addendum (disposition audit) → reviewer confirmation → Gate 3.1

| Round | Directory | Status |
|---|---|---|
| 6 | `round6/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED |
| 7 | `round7/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED (rejected for freeze) |
| 8 | `round8/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED (rejected for freeze: R8-01) |
| 9 | `round9/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED (gaps found in author pre-review) |
| 10 | `round10/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED (rejected for freeze: R10-01, R10-02) |
| 11 | `round11/` | PASSED independent review (subject to amendment) |
| freeze | `freeze/` | FREEZE READY — disposition audit, awaiting reviewer confirmation |

A provisional, non-governing Gate 3.1 §14A consumer-map draft is in `../gate3-1/`.

Rules:

- Packages are committed exactly as produced and are never edited in place.
  A later round fixes an earlier one in a new directory. Only a round's
  `STATUS.md` and its review record change when its status changes.
- This directory must not be merged into `main`, a release branch or a
  governed branch, and must not be imported into `legacy/gate-baselines/`
  until independent review clears it.
- After independent review passes, the 3A inventory work is frozen and mapped
  formally into the frozen Gate 3.1–3.14 scope. That mapping is separate work.
- See `CURRENT-GATE.md`: Gate 3 clearance is pending; Gate 4 is not authorized.
