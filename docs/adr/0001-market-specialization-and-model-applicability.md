# ADR-0001: Market specialization and explicit model applicability

- **Status:** Proposed
- **Date:** 2026-09-21
- **Decision owners:** Founder / Product Lead; Engineering
- **Supersedes:** none
- **Related issues/PRs:** #4

## Context

Zugrio spans Forex, Gold and Synthetic Indices. Historical prototypes already distinguish synthetic families such as event-hazard and distributional instruments rather than applying one universal structure model. The production system must preserve that insight without hard-coding prototype routing or assuming asset class alone determines behavior.

A visually similar move can arise from different market/product mechanisms. Reusing visual features does not establish that probability, calibration, costs or execution logic transfer.

## Decision

Zugrio will be:

> **mechanism-aware, family-specialised, instrument-calibrated and regime-adaptive.**

Production inference requires an explicit, immutable Model Applicability Manifest. No applicability match means no admitted inference.

The Canonical Instrument Registry, not symbol-name regex, is the production source for instrument/product/venue identity and model-routing metadata.

Family-wide model admission must be earned by evidence; it is not the default.

## Evidence

- Zugrio legacy lineage already contains separate specialist-family routing.
- Frozen architecture requires exact model/calibration/provenance identity and fail-closed behavior when valid/admitted inference is unavailable.
- Current product direction requires parallel FX, Gold and Synthetic tracks without automatic edge transfer.

## Alternatives considered

### One universal multi-asset model
Rejected as the default because it encourages unsupported transfer from visual similarity and obscures scope/calibration failures.

### One independent model per instrument
Rejected as a universal requirement because it can waste data and prevent justified family-level learning. Instrument-specific calibration/scoping can narrow a family model.

### Route by broker symbol patterns
Rejected for production identity because naming conventions are broker-specific and fragile.

## Consequences

### Positive
- new markets can be added without weakening existing validation;
- model scope becomes auditable;
- specialist family intelligence can compound over time;
- feature reuse is possible without unsafe probability transfer.

### Negative / tradeoffs
- more manifests, calibration artifacts and scope-specific validation;
- fewer situations where Zugrio can legitimately claim inference is available.

### Operational implications
- model registry and instrument registry become critical control-plane data;
- validation/release gates operate by scope, not only by global app version.

## Capital/safety impact

High. Out-of-scope model use can directly corrupt conviction. Applicability checks must be part of the admitted inference path and fail closed.

## Rollback / supersession

A future universal model may supersede narrower specialists only if evidence demonstrates valid cross-scope calibration and an ADR explicitly expands its applicability.
