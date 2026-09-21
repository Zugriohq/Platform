# ADR-0002: Persistent Decision Case and append-only decision ledger

- **Status:** Proposed
- **Date:** 2026-09-21
- **Decision owners:** Founder / Product Lead; Engineering
- **Supersedes:** none
- **Related issues/PRs:** #4

## Context

Zugrio's product direction requires the reason for a trade to remain connected to the decision as facts change. A mutable “current signal” record is insufficient for audit, learning, debugging, process-adherence review or future team governance.

The outcome must not rewrite the original reasoning.

## Decision

Every governed opportunity/decision will have a stable `DecisionCaseId`.

Material lifecycle events will be recorded append-only with references to immutable evidence/snapshot/artifact identities. Read-optimized projections may be mutable; the reconstruction record is not.

User overrides append new facts and never erase the original system state/recommendation.

Outcome and process-adherence assessments are separate records.

## Evidence

- frozen architecture already relies on immutable identities/snapshots at key capital transitions;
- product direction requires review of entered, passed, missed, blocked and expired opportunities;
- human handoff and diligence require reconstructable decisions without AI chat history.

## Alternatives considered

### Store only current state
Rejected because it destroys decision continuity and enables hindsight rewriting.

### Store screenshots/UI logs
Rejected because UI representation is not a stable domain record.

### Full infrastructure-level event sourcing for every application entity
Not required. The decision ledger is append-only for material decision events; other product domains may use ordinary relational state.

## Consequences

### Positive
- exact journal/replay/audit path;
- supports process-vs-outcome analysis;
- improves incident debugging and future model research;
- future capital-team governance becomes possible without retrofitting history.

### Negative / tradeoffs
- additional storage and schema discipline;
- event/version migration must be designed carefully.

### Operational implications
- durable write must accompany material capital transitions where reconstruction is required;
- projections can be rebuilt/tested from ledger events.

## Capital/safety impact

Medium-to-high. The ledger does not decide capital, but inability to persist required capital-transition evidence may require fail-closed behavior.

## Rollback / supersession

May be superseded by an equivalent cryptographically verifiable audit/event architecture, but not by mutable current-state-only storage.
