# Gate 3B — Entry Directive (frozen with Gate 3A)

This directive is frozen with the Gate 3A authority map. It records the ordering and constraints Gate 3A's findings impose on Gate 3B. Test 3A-51 checks it is present and that the live authority it names exists in the frozen map.

## 1. The first behavioural extraction

The first authority to remove is live today in `coreStrategyEvaluate`:

```
eligible: score >= V5_THRESH.watch
```

It collapses a continuous legacy conviction score into a flag called `eligible`, using a historical threshold with no validation artifact. The frozen architecture says Layer 1 eligibility is deterministic structural validity, never a score threshold.

`score >= V5_THRESH.watch` is **REMOVED FROM STRUCTURAL AUTHORITY.**

## 2. It must not be renamed

`eligible` must not be renamed to `STRUCTURAL_ELIGIBLE`, or to any other name, and kept. A renamed threshold on the same score is semantic laundering: the authority survives under a label that claims a meaning it does not have.

The semantics change first:

- every constituent of the legacy score is classified individually;
- an actual structural predicate goes to Layer 1, and only after passing §14C with recorded non-P/L threshold provenance;
- a model feature goes to the capital feature schema;
- a research heuristic goes to research only;
- legacy goes to removal.

## 3. Layer 1 emits eligibility only

Layer 1 returns `ELIGIBLE`, `INELIGIBLE` or `INVALIDATED` with named reason codes, raw features and admissible named booleans. It never emits weighted conviction, a probability, READY or FIRE, a "strong trigger" scalar, a setup score that 2B can consume, or a single winning setup chosen by priority suppression. It emits every distinct eligible candidate, de-duplicating only overlapping representations of the same structural event.

## 4. The primary proof

Change every `RAW_MODEL_FEATURE` dramatically. Layer-1 structural validity must stay unchanged — unless that feature has separately been proven a §14C hard predicate. The proof must also show that `score >= threshold` cannot return under a renamed boolean.

## 5. `assessTrigger` is not rehabilitated

`assessTrigger` is unreachable from every real entry point — engine roots, page-load code, HTML and template event attributes, and listener or timer callbacks. Its only callers are the unreachable legacy state machine.

Disposition: extract any still-needed raw measurements, prove live equivalents where necessary, then remove the dead authority implementation. It does not receive major rehabilitation effort, because it is not where live authority sits.

## 6. Research cannot enter the capital contract

The research toggle is still passed into the live `analyze()` call as `continuationReference`. Gate 3A proved it currently has no effect on production output. Gate 3B removes that argument from the production authority interface, so the guarantee becomes structural — the capital contract cannot receive research authority — rather than behavioural.

## 7. The brownfield scanner is not production architecture

Gate 3A's scanner rests on two assumptions recorded as `SCANNER_ASSUMPTION — VALID FOR FROZEN GATE 2.2 ARTIFACT; MUST NOT BE RELIED UPON BY NEW PRODUCTION ARCHITECTURE`: renamed names for shared state are guarded rather than resolved (A1), and intrinsics are trusted by method name (A2). Gate 3B's typed extraction must eliminate dependence on both rather than extending the scanner. The scanner is frozen with Gate 3A and is not extended further.

## 8. Sequencing

Gate 3B begins actual authority decomposition. **Gate 4 is not authorized.** After the whole of Gate 3 clears, work stops for the Zugrio 1.0 Engineering Foundation checkpoint — organization-owned repository, CI and governance, permanent repository context, greenfield-production and brownfield-migration discipline, the Broker Adapter Contract, a broker-neutral core, MT5 without a Zugrio VPS, the Canonical Instrument Registry, and separate market-data and execution adapters — before Gate 4 opens. The runtime remains non-capital-authoritative; executable FIRE is still Gate 8.
