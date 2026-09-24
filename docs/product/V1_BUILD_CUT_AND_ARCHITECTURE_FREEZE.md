# Zugrio V1 Build Cut and Architecture Freeze

Status: **Founder-directed build boundary**  
Date: 2026-09-24  
Applies after PR #27 is accepted/merged.

## 1. Why this exists

The product/architecture map is now sufficient to begin implementation.

The next objective is no longer to expand the specification. It is to prove the smallest coherent product slice against the frozen architecture and real evidence.

After this document is accepted:

- do not open another product/architecture-expansion PR merely to make the map more complete;
- new architecture work requires a concrete blocker discovered during implementation, safety/regulatory necessity, or contradictory evidence;
- such changes should be narrow amendments, not another redesign cycle;
- the next substantive PR after #27 should contain working product/engine code.

This freeze does not override the frozen Signal Authority Architecture or Gate process.

## 2. V1 product cut

### Active strategy

**Zugrio Core only.**

Core V1 is the productized descendant of the strongest TTI Advanced Price Action research lineage.

It is not an empty proprietary label and it is not an adaptive strategy router in V1.

### Strategy status

- Core — active build target, still subject to evidence/admission.
- SMC — in validation.
- Trend Following — in validation.
- Range / Mean Reversion — in validation.
- Separate APA preset — withheld as a distinct live option until its distinction from Core is demonstrated.
- Custom Strategy Builder — later.

### Markets

V1 product scope remains:

**FX · Gold · Synthetic Indices**

FX leads public narrative. Gold and Synthetic Indices remain parallel initial tracks.

Admission is still granular:
- FX bundles may differ by instrument/scope;
- Gold has its own bundle/evidence;
- synthetic products may require different bundles by synthetic family/instrument rather than one generic synthetic bundle.

## 3. Fixed-bundle rule

V1 uses **one frozen TradeBundle per admitted scope**.

TradeBundle includes:
- setup;
- location/reference;
- entry/trigger;
- broker order route;
- protection;
- exit/management;
- TimeframeMap;
- RegimeModel/version/state applicability;
- context and fill/cost assumptions.

No V1 dynamic component routing.

No mixing an entry from one tested bundle with the exit from another.

If the fixed bundle does not qualify, Zugrio returns PASS / no qualifying setup.

## 4. Control modes

### V1
- Signal
- Semi-Auto

### Later
- Auto
- Full Auto

The architecture may retain Auto/Full-Auto concepts, but first implementation and release work must not treat them as V1 delivery scope.

## 5. Behaviour and health

### V1
- Decision Case / journal history;
- Strategy Health at strategy + TradeBundle + scope level where evidence is sufficient;
- Decision/Process adherence;
- Execution adherence where broker facts support it;
- Financial Outcome;
- factual BehaviourObservations;
- Advisory guardrails only.

### Later
- Confirmation guardrails where product flow supports them;
- enforcing guardrails;
- dynamic component-health optimization;
- automated strategy switching;
- custom-strategy adaptive routing.

Component analysis in research is permitted, but a component claim must hold the rest of the bundle fixed or use another predeclared valid experimental design.

## 6. Market intelligence and chart

V1 should still demonstrate the core product thesis:

- scan/identify relevant opportunities;
- strategy-specific qualification;
- market/instrument/context awareness;
- deterministic chart annotations from the frozen bundle state;
- current-price/economics re-check;
- Decision Case continuity;
- Signal/Semi-Auto distinction.

AI may explain structured state but does not create authoritative chart/trading state.

## 7. No V1 strategy hopping

V1 does not:
- recommend another strategy because it currently has a setup;
- automatically route between strategy families;
- silently replace the selected strategy.

A later strategy-discovery/routing feature requires separate evidence, opt-in, behavior safeguards and regulatory review.

## 8. Multi-strategy account boundary

Before automated portfolio aggregation exists:

- one active Zugrio strategy may own a given account + symbol for capital action at a time;
- Signal/research cases may coexist but remain non-authoritative and separately attributable;
- Semi-Auto surfaces conflicts;
- Auto multi-strategy execution is later and requires netting/hedging/correlation-aware aggregation.

## 9. First implementation sequence

The implementation should be vertical, not broad.

### Slice 1 — Core deterministic case path
Build one end-to-end **non-live-capital** Core TradeBundle path on one scoped instrument using point-in-time data/replay fixtures:
- MethodProfile/version;
- TradeBundle/version;
- RegimeModel/version;
- TimeframeMap/version;
- setup → location → entry states;
- deterministic chart annotations;
- DecisionCase creation/history;
- PASS as a first-class outcome;
- no adaptive routing.

Prefer an FX instrument such as EURUSD only if existing lineage/data makes it the best verified starting fixture; do not choose it merely because it is common.

### Slice 2 — evidence/replay
- reproduce the bundle deterministically;
- cost/fill assumptions explicit;
- point-in-time regime labels;
- no look-ahead;
- Strategy Health remains evidence-limited.

### Slice 3 — Gold fixed bundle
Add XAUUSD only with its own frozen bundle/evidence scope.

### Slice 4 — synthetic-family fixed bundle
Add one synthetic family/instrument using generator-appropriate semantics and null testing. Do not generalize from it to all synthetics.

### Slice 5 — Signal product path
- scanner/watchlist;
- case detail;
- deterministic chart annotation;
- alert;
- decision history;
- behavior observation/advisory.

### Slice 6 — Semi-Auto
Only after broker/readiness prerequisites:
- prepared intent;
- revalidation;
- same-symbol strategy conflict handling;
- route-specific fill assumptions;
- broker reconciliation;
- protection.

This order may be adjusted when evidence dictates, but scope may not expand by default.

## 10. Pre-implementation gates

Issue #21 remains the implementation prerequisite tracker.

Before capital-path or authority-conformance implementation:
- import/reference the actual frozen Signal Authority Architecture artifact; do not reconstruct it from summaries;
- settle account-risk-policy ownership versus behavior observation;
- establish verified broker read-only/event capability matrices.

If the exact frozen authority artifact is unavailable, implementation must not guess its semantics.

## 11. Definition of "done enough to build"

Architecture is "done enough" when:
- the first Core bundle can be represented without ambiguity;
- point-in-time inputs and versions are identifiable;
- evidence/admission boundaries are explicit;
- risk/authority boundaries remain frozen;
- implementation can return PASS safely;
- tests can prove no silent widening of scope/authority.

It does **not** require every future strategy, market, entry, exit or automation mode to be fully specified before coding begins.

## 12. Freeze rule

After PR #27:

> **Build before broadening.**

Any proposed new strategy, market, adaptive policy, score, AI behavior, automation mode or portfolio feature should default to backlog/research unless it is required to make the frozen V1 slice correct, safe or testable.

Positioning may describe the broader thesis, but the product status layer must distinguish:
- V1/current build;
- in validation;
- planned/later.
