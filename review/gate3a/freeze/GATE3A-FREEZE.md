# Gate 3A — evidence freeze (stopping rule as amended, and disposition audit)

**Status: FROZEN — confirmed by the independent reviewer at commit `b940cb1` (`REVIEWER-CONFIRMATION.md`).** Round 11 passed independent review subject to one amendment: dispositions must be independently auditable (`../round11/INDEPENDENT-REVIEW.md`). This addendum supplies that audit. It adds evidence only. It changes neither the round-11 package nor the artifact.

## Accepted stopping rule (as amended by the independent reviewer)

1. **Artifact identity is pinned:** Gate 2.2 artifact SHA-256 `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178`.
2. **The inventory is reproducible:** re-running the scanner on that exact artifact gives the same inventory and hashes, and no production authority code is changed while the freeze is built.
3. **Unmodelled code shapes are fail-closed on the actual artifact:** each is either proven absent, or every occurrence is enumerated with an explicit disposition. A shape found only in a hypothetical mutation does not by itself require another scanner round, unless it is an unmapped authority route in the frozen artifact.
4. **"Bound or dispositioned" is independently auditable:** a label does not count because a generator assigned it. The evidence must reproduce why each disposition is safe for this artifact. **"0 unresolved" means 0 authority-relevant occurrences without a reproducible disposition, not 0 rows a tool selected for review.**
5. **The rule is artifact-scoped:** it does not cover future production code. Any change to the cleared artifact, or a different artifact, needs a fresh Gate 3A identity and inventory check. Gate 3A does not establish semantic correctness of the classified fields; that is Gate 3.1–3.3.

## The disposition audit (`GATE3A-DISPOSITION-AUDIT.json`)

`tools/verify-dispositions.js` re-derives every disposition from the artifact, by a check independent of the generator's label. Each row carries raw evidence (statement text, recomputed fingerprints, alias uses, evaluated values), so a person can check it without trusting either tool. The verifier runs the round-11 scanner plus non-enumerable diagnostics (`tools/gate3-authority-inventory.diag.js`), and first proves that this copy reproduces round 11's inventory and baseline byte for byte.

| Register | Rows | Verified | Unresolved |
|---|---:|---:|---:|
| Reference escapes of authority producers (round 11 register) | 241 | 241 | **0** |
| Implicit globals (`window.NAME = …` read by bare name; enumerated here) | 30 bare uses of 17 names | 30 | **0** |

### What the audit found

- **Six of round 11's automatic labels did not reproduce.** Four rows labelled `BOUND_MODULE_STATEMENT` were not inside any frozen fingerprint, and two labelled `PRIMITIVE_MEMBER` failed a sound primitive check. All six are safe on another reproducible basis, and each row records the basis that actually holds:
  - `APA_CONFIG` and `TTI_EXECUTION` member reads: const binding, primitive in the declarator, member never written anywhere in the artifact;
  - `TTI_FOUNDATION_REFERENCE`: const and frozen at every level of the path;
  - `state.status`: inside the frozen `window.TTI_BROKER={…}` dynamic-access statement.

  The reviewer's amendment was therefore well founded.
- **An unsound check in my own first version of the verifier.** It accepted `state.status` as primitive because its declarator holds `null`, but it is assigned an object at runtime. An evaluated declarator now counts only for a binding that is never written after declaration. Self-test 3 pins this.
- **Implicit globals are a shape the scanner does not model:** a name created by `window.NAME = …` and read bare, like `TTI_BROKER`. That makes them stopping-rule item 3, enumerated here. Of the 30 bare uses:
  - 9 lie inside frozen dynamic-access statements (all `TTI_BROKER` uses);
  - 2 lie inside fingerprinted functions;
  - 19 are not read by any live authority sink (chart library, icons, UI shell state such as `ZUGRIO_ACCOUNT.authorityPreference`).
- **For Gate 4, not changed here:** `window.TTI_BROKER.getStatus()` returns a live reference to the broker status object, including `armed`, to any script on the page. In this artifact it is bound, because that export is a frozen dynamic-access site, and its only consumer (`updateSignalState`) reads `managedPositions`. A Gate 4 broker boundary should not expose mutable status.

### Non-vacuity

Six negative self-tests must each reject a case that should fail, for the reason the check is about:
1. a renderer outside the fingerprints;
2. a binding outside the closure;
3. `state.status` (written at runtime);
4. `APA_CONFIG` (not frozen);
5. a path whose member is written elsewhere;
6. a global read by live sinks.

All six reject. Two of them first rejected for the wrong reason, because of fixture offsets; they were corrected so they now exercise the check they name.

## Frozen identity

| | SHA-256 |
|---|---|
| Gate 2.2 artifact | `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178` |
| Round-11 package archive | `9f98b95ccaf7743292dad248fa0fe8b1fef2b2e25c58fa8b68109ba3130ead69` |
| Authority inventory (hash) | `8f2db15840c2d2d3e5e6d7c1432797af9a49167815e93f5d71d04f5ba6655eae` |
| Authority baseline | `e63d298ba380a97e575edae6be75f1253a326e2917bc9827c20ccf02e3d405d8` |
| Dependency vocabulary | `90499ad2362c1a1e486a9c55736d9ba6c9b4f628f1d3c9076d7c1cf0aa9229cc` |
| Reference-escape register | `175a3b963007eb4f57b72b20c29f0c6236930554356b40a224cc1f1c54bc353f` |
| Disposition audit | see `FREEZE-SHA256-MANIFEST.json` |

## Gate state

| Gate | Status |
|---|---|
| Gate 2.2 artifact identity | Pinned |
| Gate 3A | **Frozen**: passed independent review (round 11); the amendment is met by this audit; confirmed by the reviewer |
| Gate 3.1 (§14A) | Next. `../../gate3-1/` stays provisional until §14A review begins |
| Gate 4 | Not authorised |

Rule going forward: a new exotic JavaScript form reopens Gate 3A only if it shows an unmapped authority route in this frozen artifact. Otherwise it goes in the scanner's documented limits.

## Reproduce

```
cd review/gate3a/freeze
node tools/verify-dispositions.js     # identity true/true; 241/241 and 30/30 verified; 6 self-tests ok; exit 0
```
