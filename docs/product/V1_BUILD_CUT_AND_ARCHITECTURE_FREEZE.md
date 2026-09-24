# Zugrio Release 1 Build Cut and Architecture Freeze

Status: **Founder-directed build boundary**  
Date: 2026-09-24  
Applies after PR #27 is accepted/merged.

## Definitions

**Zugrio 1.0** = the full product scope defined in `docs/product/ZUGRIO_1_0_PRD.md`.

**Release 1** = the first build and shipped release defined in this document.

The PRD defines what the Zugrio 1.0 architecture must support. This document defines what Release 1 builds and ships. Where they differ, this document governs **build/release scope**; the PRD governs **architecture/product scope**.

The existing PRD labels `V1-F` and `V1-LG` continue to mean Zugrio 1.0 foundation / gated Zugrio 1.0 capability. They do **not** mean every such requirement ships in Release 1.

The filename is intentionally unchanged so existing links remain valid.

## 1. Why this exists

The product/architecture map is now sufficient to begin implementation.

The next objective is no longer to expand the specification. It is to prove the smallest coherent product slice against the frozen architecture and real evidence.

After this document is accepted:

- do not open another product/architecture-expansion PR merely to make the map more complete;
- new architecture work requires a concrete blocker discovered during implementation, safety/regulatory necessity, or contradictory evidence;
- such changes should be narrow amendments, not another redesign cycle;
- the next substantive PR after #27 should contain working product/engine code.

This freeze does not override the frozen Signal Authority Architecture or Gate process.

## 2. Release 1 product cut

### Active strategy

**Zugrio Core only.**

Core Release 1 is the productized descendant of the strongest TTI Advanced Price Action research lineage.

It is not an empty proprietary label and it is not an adaptive strategy router in Release 1.

### Strategy status

- Core — active build target, still subject to evidence/admission.
- SMC — in validation.
- Trend Following — in validation.
- Range / Mean Reversion — in validation.
- Separate APA preset — withheld as a distinct live option until its distinction from Core is demonstrated.
- Custom Strategy Builder — later.

### Markets

Release 1 product scope is:

**FX · Gold · Synthetic Indices**

FX leads public narrative. Gold and Synthetic Indices remain parallel initial tracks.

Admission is still granular:
- FX bundles may differ by instrument/scope;
- Gold has its own bundle/evidence;
- synthetic products may require different bundles by synthetic family/instrument rather than one generic synthetic bundle.

### Release 1 launch criterion

Release 1 does not ship merely because three market slices have been coded.

To ship the three-market product claim, it requires at minimum:

- at least **one admitted Core Signal scope in FX**;
- at least **one admitted Core Signal scope in Gold**;
- at least **one admitted Core Signal scope in one Synthetic Index family/instrument**.

Gold and Synthetic Indices therefore remain initial Release 1 tracks, not "coming soon" markets.

Semi-Auto admission is independent. Release 1 may claim Semi-Auto only for exact cTrader scopes that separately clear the relevant strategy, broker, execution, protection, reconciliation, safety and regulatory activation gates. At least one such admitted Semi-Auto scope is required before Semi-Auto is represented as released rather than validation-pending.

## 3. Fixed-bundle rule

Release 1 uses **one frozen TradeBundle per admitted scope**.

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

No Release 1 dynamic component routing.

No mixing an entry from one tested bundle with the exit from another.

If the fixed bundle does not qualify, Zugrio returns PASS / no qualifying setup.

## 4. Control modes

### Release 1
- Signal
- Semi-Auto

### Not Release 1
- Auto
- Full Auto

Auto and Full Auto remain part of the Zugrio 1.0 architecture (`ZR-MODE-003`, `ZR-MODE-004`, `ZR-RSK-005`, and related Auto semantics such as the Auto portion of `ZR-STR-025`), but they are not Release 1 delivery scope.

## 5. Behaviour and health

### Release 1
- Decision Case / journal history;
- Strategy Health at strategy + TradeBundle + scope level where evidence is sufficient;
- Decision/Process adherence;
- Execution adherence where broker facts support it;
- Financial Outcome;
- factual BehaviourObservations;
- **Advisory guardrails only**.

### Zugrio 1.0 but not Release 1
- Confirmation/friction guardrails;
- Enforcing guardrails;
- dynamic component-health optimisation;
- automated strategy switching;
- Custom Strategy Builder / AI strategy structuring;
- custom-strategy adaptive routing;
- StrategyComponentPolicy.

This preserves the Zugrio 1.0 architecture in `ZR-BHV-004`, `ZR-BHV-007`, `ZR-AI-001`, `ZR-STR-023` and `ZR-STR-024` without making them Release 1 exit criteria.

Component analysis in research is permitted, but a component claim must hold the rest of the bundle fixed or use another predeclared valid experimental design.

### PRD §19 success-evidence clarification

The Zugrio 1.0 Success Evidence list is broader than Release 1.

In particular:
- item **8** — user-authored strategy representation without false admission — is Zugrio 1.0 evidence, not a Release 1 exit criterion;
- item **11** — advisory/confirmation guardrails stating their actual authority limits — is Zugrio 1.0 evidence, not a Release 1 exit criterion. Release 1 implements advisory guardrails only.

## 6. Market intelligence and chart

Release 1 should still demonstrate the core product thesis:

- scan/identify relevant opportunities;
- strategy-specific qualification;
- market/instrument/context awareness;
- deterministic chart annotations from the frozen bundle state;
- current-price/economics re-check;
- Decision Case continuity;
- Signal/Semi-Auto distinction.

AI may explain structured state but does not create authoritative chart/trading state.

## 7. No Release 1 strategy hopping

Release 1 does not:
- recommend another strategy because it currently has a setup;
- automatically route between strategy families;
- silently replace the selected strategy.

A later strategy-discovery/routing feature requires separate evidence, opt-in, behavioural safeguards and regulatory review.

## 8. Multi-strategy account boundary

Before automated portfolio aggregation exists:

- one active Zugrio strategy may own a given account + symbol for capital action at a time;
- Signal/research cases may coexist but remain non-authoritative and separately attributable;
- Semi-Auto surfaces conflicts;
- Auto multi-strategy execution is later and requires netting/hedging/correlation-aware aggregation.

## 9. Release 1 delivery decisions

These are build-scope decisions, not changes to the broader Zugrio 1.0 architecture.

### 9.1 First Semi-Auto broker — cTrader

**cTrader is the first Release 1 Semi-Auto broker path.**

Reasons:
- existing cTrader lineage is stronger;
- delegated/OAuth-style integration is compatible with the current product direction;
- it avoids making the unproven MT5 no-VPS path a Release 1 blocker.

MT5 remains a Zugrio 1.0 endpoint under `ZR-EXE-003`, sequenced after issue #21 establishes a verified capability matrix and proves the chosen no-Zugrio-VPS connector path.

### 9.2 Client surface — Windows desktop first

Release 1 ships:
- **Windows desktop trading client** as the primary authenticated trading workspace;
- **web** for public website, waitlist/invitation, account/authentication, entitlement/readiness status and desktop download/access.

Release 1 does **not** require a full browser trading workspace.

**Mobile is staged**, consistent with `ZR-ID-008`: identity/API contracts must support the later mobile surface without requiring a backend redesign, but a native mobile client is not a Release 1 exit criterion.

macOS/Linux desktop packaging may follow after the Windows release path unless separately justified by evidence/customer demand.

### 9.3 Billing — invite-only early access

Release 1 uses **invite-only early access without live payment processing as a ship blocker**.

Release 1 must still preserve:
- account identity;
- server-authoritative entitlement boundaries;
- separation of commercial entitlement from execution authority.

Billing/provider abstraction and verified billing-event semantics (`ZR-ID-010` / `ZR-ID-011`) remain Zugrio 1.0 requirements, but payment integration follows Release 1 rather than blocking first shipment.

No early-access invitation or entitlement grants trading authority.

### 9.4 Release status truth

Every surface must distinguish:
- admitted/released;
- validation pending;
- research only;
- locked/later.

A capability being part of Zugrio 1.0 architecture does not make it a Release 1 capability.

## 10. First implementation sequence

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
- behaviour observation/advisory.

### Slice 6 — Semi-Auto / cTrader
Only after broker/readiness prerequisites:
- cTrader connection path;
- prepared intent;
- revalidation;
- same-symbol strategy conflict handling;
- route-specific fill assumptions;
- broker reconciliation;
- protection.

This order may be adjusted when evidence dictates, but scope may not expand by default.

## 11. Pre-implementation gates

Issue #21 remains the implementation prerequisite tracker.

Before capital-path or authority-conformance implementation:
- import/reference the actual frozen Signal Authority Architecture artifact; do not reconstruct it from summaries;
- settle account-risk-policy ownership versus behaviour observation;
- establish verified broker read-only/event capability matrices.

If the exact frozen authority artifact is unavailable, implementation must not guess its semantics.

## 12. Definition of "done enough to build"

Architecture is "done enough" when:
- the first Core bundle can be represented without ambiguity;
- point-in-time inputs and versions are identifiable;
- evidence/admission boundaries are explicit;
- risk/authority boundaries remain frozen;
- implementation can return PASS safely;
- tests can prove no silent widening of scope/authority.

It does **not** require every future strategy, market, entry, exit or automation mode to be fully specified before coding begins.

## 13. Freeze rule

After PR #27:

> **Build before broadening.**

Any proposed new strategy, market, adaptive policy, score, AI behaviour, automation mode or portfolio feature should default to backlog/research unless it is required to make the frozen Release 1 slice correct, safe or testable.

Positioning may describe the broader thesis, but the product status layer must distinguish:
- Release 1/current build;
- in validation;
- planned/later.
