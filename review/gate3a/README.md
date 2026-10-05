# Gate 3A review packages (non-governing)

**Nothing in this directory is Gate evidence, cleared, or governed.** It exists
so independent reviewers can inspect each round of the Gate 3A authority
inventory work in the repository, with a clean audit trail:

round 6 → discovered misses → round 7 remediation → independent review (rejected) → round 8 remediation → independent review (rejected: R8-01) → round 9 remediation → independent review → …

| Round | Directory | Status |
|---|---|---|
| 6 | `round6/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED |
| 7 | `round7/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED (rejected for freeze) |
| 8 | `round8/` | SUPERSEDED / NOT CLEARED / NOT GOVERNED (rejected for freeze: R8-01) |
| 9 | `round9/` | REVIEW CANDIDATE / NOT CLEARED / NOT GOVERNED |

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
