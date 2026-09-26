# ADR-0004: Strategy evidence, health and scope-specific admission

- **Status:** Proposed
- **Date:** 2026-09-24
- **Decision owners:** Founder / Product Lead; Engineering
- **Related issue:** #15
- **Related ADR:** ADR-0003 — Strategy and entry contracts
- **Supersedes:** none

## Context

Zugrio supports first-party, supported and user-defined strategy directions. A strategy being represented or machine-evaluable does not establish that it has a positive edge, that its evidence transfers across markets, or that it is suitable for live Signal/automation.

The existing architecture already separates Method Profiles from model applicability and capital authority. The product now also needs an explicit evidence/admission layer so a user-authored strategy cannot silently borrow Zugrio's credibility.

This ADR **extends ADR-0003** by adding provenance classes and allowing user-authored structured MethodProfiles to exist as versioned, inspectable strategy definitions. ADR-0003's rejection of arbitrary user scripts with direct capital authority still stands. A structured user MethodProfile is not an executable script and gains no Signal or capital authority without the separate evidence/admission path defined here.

## Decision

Introduce separate, auditable concepts for:

1. **Strategy representation** — the versioned MethodProfile and its machine-readable rules.
2. **Strategy evidence** — scope-bound research/observation artifacts and limitations.
3. **Strategy admission** — explicit operational permission for a MethodProfile version and scope to participate in a product mode.
4. **Strategy health** — ongoing evidence assessment that remains separate from process adherence and P/L.

Admission is scope-specific and version-specific. It must reference evidence and a versioned admission policy. No subscription, user preference, LLM output or strategy label creates admission.

No numeric admission threshold is defined by this ADR. Thresholds and statistical policy require evidence and separate review.

## Consequences

### Positive
- user strategies can be represented without being endorsed;
- first-party strategies are held to the same evidence discipline;
- Signal/Semi-Auto/Auto readiness can differ by strategy and scope;
- strategy degradation can be reviewed without confusing it with trader behaviour;
- historical decisions remain tied to the exact strategy/admission context.

### Tradeoffs
- additional evidence/provenance records;
- more explicit unavailable/insufficient states;
- strategy-builder UX must communicate representation versus admission clearly.

## Capital/safety impact

High if admission gates live capital. This ADR defines the separation but does not alter the frozen Signal Authority path or authorize a new capital transition.

Any integration whereby strategy-health/admission state directly changes existing capital-authority semantics must be separately reviewed and tested against the frozen architecture.

## Alternatives rejected

### Any structured user strategy can generate Zugrio signals
Rejected because machine readability is not evidence of edge, applicability or safety.

### One global strategy score
Rejected because evidence is scope-, version-, cost- and regime-dependent and should not be collapsed into false precision.

### First-party strategies bypass evidence
Rejected because ownership does not establish performance.

## Unresolved

- exact admission-policy thresholds;
- required forward-observation evidence by mode;
- statistical degradation tests;
- review authority/workflow;
- jurisdiction-specific constraints on strategy recommendation/automation.
