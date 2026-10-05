# Round 6 — SUPERSEDED

Status: **SUPERSEDED / NOT CLEARED / NOT GOVERNED**

This directory is the round-6 Gate 3A closure package, byte-identical to the
delivered archive's contents. It is preserved as audit history and must not be
edited in place.

- Delivered archive: `Zugrio_Gate3A_Round6_Closure.zip`
- Archive SHA-256: `8be267b3535552ace65e700e45f63c46dba6dfc256cc9a77ba642898f0040556`
- Internal manifest: `PACKAGE-SHA256-MANIFEST.json` (16 files, all verified at import)
- Frozen artifact: `artifacts/Zugrio-1.0.0-gate2.2.html`, SHA-256 `52dcdbcd…c178`

Why superseded: an adversarial review (round 7) injected 39 undeclared
authority inputs into the frozen artifact. This scanner missed 24 of them:
23 produced no defect at all, one raised only an unrelated
reachability alarm. Its clean "0 defects" result was therefore not evidence of
completeness. See `../round7/CLAUDE-REVIEW-HANDOFF.md` ("Round 7") for the miss
classes.

This file is the only addition to the package; it is not listed in the
package manifest.
