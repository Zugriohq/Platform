# ADR-0004: Strategy admission and behavioral guardrails cannot widen capital authority

- **Status:** Proposed
- **Date:** 2026-09-24
- **Decision owners:** Founder / Product Lead; Engineering
- **Related issue:** #17
- **Related specification:** `docs/product/STRATEGY_HEALTH_AND_BEHAVIOR_GUARDRAILS.md`

## Context

Zugrio intends to support:
- first-party, supported external and user-defined strategies;
- evidence-based Strategy Health;
- behavioral/process analytics;
- user-defined behavioral guardrails;
- Signal, Semi-Auto, Auto and Full Auto control modes.

These capabilities create two risks if their boundaries are unclear:

1. a user-authored or AI-structured strategy could be mistaken for a Zugrio-validated strategy and gain signal/execution authority without evidence;
2. a behavioral analytic or AI narrative could become an ungoverned capital veto/permission path.

The frozen Signal Authority Architecture already defines the allowed capital-authority graph. This ADR preserves that architecture.

## Decision

### Strategy definition and strategy admission are separate

A `StrategyDefinition` describes rules. It does not by itself authorize:
- probabilistic conviction;
- a Zugrio-admitted signal;
- capital sizing;
- broker submission.

A separate, versioned `StrategyAdmission` may admit an exact strategy version for a stated scope and use only when supported by identified evidence/policy artifacts.

Admission is dimensional. It may differ by:
- market family;
- instrument/product/venue;
- horizon;
- entry/model version;
- control mode;
- validity interval.

Signal admission does not imply Auto or Full Auto admission.

### Strategy Health is evidence, not authority by default

A `StrategyHealthAssessment` consumes identified evidence artifacts and reports a scoped evidence state.

It has no direct capital-authorizing edge.

If a future risk/state/execution policy consumes Strategy Health:
- the contract must be explicit;
- accepted artifact type/version/freshness must be defined;
- failure semantics must be defined;
- the policy may narrow or block an existing authority path but may not create missing authority;
- this change requires review and tests.

### Behavioral analytics are observational by default

`BehaviorObservation` and process-adherence records describe recorded actions/patterns.

LLM-generated labels or psychological interpretations are never capital-authoritative.

### Behavioral guardrails can only narrow

A versioned `BehaviorGuardrail` may be:
- Inform;
- Confirm;
- Enforce.

An Enforce guardrail may block a new risk-increasing action only inside a Zugrio-controlled execution path and only when explicitly admitted by governing policy.

A guardrail can narrow an existing authority envelope. It cannot:
- create execution authority;
- increase risk limits;
- widen allowed instruments/strategies;
- bypass model or strategy admission;
- authorize a broker action.

### Non-custodial boundary

A broker connection does not imply account custody or universal control.

Signal mode has no order authority. Read-only broker data may support post-action analysis, but Zugrio cannot claim to prevent independently placed broker trades.

Semi-Auto/Auto/Full Auto can govern only the actions covered by their valid delegated authority and integration capabilities.

## Consequences

### Positive
- user strategies can be useful without borrowing Zugrio validation;
- AI can help structure strategies without becoming a trading authority;
- behavioral intervention can become stronger over time without creating an unreviewed capital path;
- Strategy Health can evolve scientifically without conflating evidence with permission;
- existing frozen authority semantics remain intact.

### Tradeoffs
- more explicit domain objects and statuses;
- a strategy may be monitorable before it is signal-admitted;
- some behavioral interventions will remain warnings because Zugrio does not control independent broker actions;
- stronger automation requires additional evidence and policy work.

## Required conformance tests

1. Structured user strategy without admission cannot produce a Zugrio-admitted capital signal.
2. Signal admission cannot create Auto admission.
3. AI output cannot create/update StrategyAdmission or ExecutionAuthorityManifest.
4. BehaviorGuardrail can only preserve or narrow authority.
5. Inform guardrail cannot block.
6. Signal mode cannot block an independent broker action.
7. Stale/expired strategy admission fails according to explicit policy and never widens authority.
8. User/system/broker actors remain separately attributable in the Decision Case ledger.
9. Profit/loss does not overwrite Strategy Health or ProcessAdherence.
10. An unavailable Strategy Health assessment cannot be replaced by an invented neutral/positive score.

## Rollback / supersession

This ADR may be superseded only by an explicit architecture decision that identifies a new validated authority path and updates the frozen authority architecture through its required review process.