# Gate 3A baseline: authority-inventory evidence freeze

**Status: CLEARED (Gate 3A only). Frozen 2026-10-06 and confirmed by independent review.** See `REVIEWER-CONFIRMATION.md`.

This is **not** Gate 3 clearance. Gate 3 as a whole is not cleared. Gate 3.1 (§14A) is next, Gates 3.2–3.14 are not started, and Gate 4 is not authorised (`../../../CURRENT-GATE.md`).

## What is frozen

| | SHA-256 |
|---|---|
| Gate 2.2 artifact (`round11/artifacts/Zugrio-1.0.0-gate2.2.html`) | `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178` |
| Round-11 package (delivered archive) | `9f98b95ccaf7743292dad248fa0fe8b1fef2b2e25c58fa8b68109ba3130ead69` |
| Authority inventory (hash) | `8f2db15840c2d2d3e5e6d7c1432797af9a49167815e93f5d71d04f5ba6655eae` |
| Authority baseline (`round11/tools/gate3-authority-baseline.json`) | `e63d298ba380a97e575edae6be75f1253a326e2917bc9827c20ccf02e3d405d8` |
| Dependency vocabulary | `90499ad2362c1a1e486a9c55736d9ba6c9b4f628f1d3c9076d7c1cf0aa9229cc` |
| Reference-escape register | `175a3b963007eb4f57b72b20c29f0c6236930554356b40a224cc1f1c54bc353f` |

Both directories are imported byte-exact from the confirmed commit `b940cb1c9f704dc21c0889acae3313e822fa038c`:
- `round11/` matches its 27-file `PACKAGE-SHA256-MANIFEST.json`;
- `freeze/` matches its 5-file `FREEZE-SHA256-MANIFEST.json`.

`STATUS.md` files describe the state at that commit. This README and `REVIEWER-CONFIRMATION.md` give the cleared status.

## Scope and limits (the accepted stopping rule)

1. **Artifact-scoped:** the freeze covers only the artifact above. Any modification, or a different artifact, requires a fresh Gate 3A identity and inventory check.
2. **Reproducible:** the round-11 scanner regenerates the inventory and baseline byte for byte.
3. **Fail-closed on unmodelled shapes in the actual artifact:** each is proven absent (scanner assumption A3: the global object is never a value) or enumerated and dispositioned:
   - 241 reference escapes;
   - 30 implicit-global uses;
   - 137 dynamic-access sites.
4. **Independently auditable:** every disposition is re-derived with evidence in `freeze/GATE3A-DISPOSITION-AUDIT.json`, with 0 unresolved.
5. **Not semantic correctness:** whether each classified field, predicate or threshold is correct under the frozen Signal Authority specification is Gate 3.1–3.3 work.

Recorded for Gate 4, not resolved here: `window.TTI_BROKER.getStatus()` exposes a live reference to broker status, including `armed`.

## Not imported here

- **Superseded rounds 6–10 and their review records** remain on PR #111 (branch `gate3/round7-review`) as history.
- **The provisional Gate 3.1 consumer map** is **not** cleared evidence and is not imported.

## Reproduce

```
cd legacy/gate-baselines/gate3a/round11 && node --test test/gate3a.test.js      # 83 tests
cd ../freeze && node tools/verify-dispositions.js                                # 241/241, 30/30, 6 self-tests; exit 0
```
