# ADR-0003: Versioned Method Profiles and extensible Entry Model contracts

- **Status:** Proposed
- **Date:** 2026-09-21
- **Decision owners:** Founder / Product Lead; Engineering
- **Supersedes:** none
- **Related issues/PRs:** #4

## Context

Zugrio must not hard-code its identity to a small list of entry patterns such as retests, shallow pullbacks or breakouts. Different methods can admit different setup and entry logic while still sharing the same authority, risk and execution controls.

Historical prototype behavior must not become a permanent product taxonomy by accident.

## Decision

A governed decision binds to an immutable/versioned `MethodProfile`.

Entry logic is implemented through versioned `EntryModel` contracts referenced by Method Profiles.

Entry Models may create/evaluate entry evidence and geometry. They may not:
- create calibrated conviction by themselves;
- size capital;
- bypass state/selection/execution policies;
- directly cause FIRE;
- submit broker orders.

V1 may use system-defined/configurable Method Profiles. An unrestricted strategy-programming language is not required for V1.

## Evidence

- founder-directed V1 scope explicitly requires extensible entry strategies;
- frozen authority architecture separates structural eligibility from probabilistic conviction and execution authority;
- future market/strategy expansion requires adding entry logic without rewriting capital authority.

## Alternatives considered

### One universal Zugrio entry algorithm
Rejected because it would overfit product identity to one method and prevent legitimate strategy variation.

### Arbitrary user scripts with capital authority
Rejected for V1 due validation, security and auditability risks.

### Encode entry logic inside UI/broker adapter
Rejected because entry qualification belongs upstream of execution presentation/integration.

## Consequences

### Positive
- strategy expansion without authority rewrite;
- exact historical method provenance;
- clean testing and model applicability.

### Negative / tradeoffs
- method/profile version management;
- configuration UX must distinguish safe supported parameters from arbitrary code.

## Capital/safety impact

High. Entry Models are deliberately non-authoritative; this separation must be conformance-tested.

## Rollback / supersession

Specific contract fields may evolve through schema versions; the separation between entry logic and capital authority should remain unless new evidence justifies an architecture amendment.
