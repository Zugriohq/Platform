# ADR-0005: Behaviour observations and user-scoped guardrails

- **Status:** Proposed
- **Date:** 2026-09-24
- **Decision owners:** Founder / Product Lead; Engineering
- **Related issue:** #15
- **Supersedes:** none

## Context

Zugrio's Decision Case, broker records and process-adherence review can reveal observable deviations between a declared plan and actual action. Founder direction requires these insights to become useful before repeated mistakes, not only after the trade.

However, Zugrio must not claim to infer emotions from trade records or claim control over broker actions outside authority actually granted to Zugrio.

Hard behavioural blocking would also introduce a new capital-policy input and must not be silently added to the frozen authority architecture.

## Decision

Introduce separate concepts for:

1. **BehaviourObservation** — reconstructable fact about declared plan versus observed action.
2. **BehaviourPatternAssessment** — evidence-backed cross-case pattern with scope, sample and matching uncertainty.
3. **GuardrailPolicy** — explicit user/account policy that determines whether a matched condition is advisory, requires confirmation, or may eventually be enforcing.
4. **GuardrailEvent** — durable record of presentation, acknowledgement, trigger or enforcement outcome.

Advisory and confirmation experiences may exist without broker order authority.

An enforcing guardrail may only prevent **new risk-increasing actions** routed through Zugrio's own execution path and is not production-authorized by this ADR. Capital-blocking integration requires explicit authority-policy semantics, evidence, tests and acceptance.

### Risk-reduction precedence

A behavioural guardrail must never be the blocking authority for a governed risk-reducing action.

This includes, where the existing safety architecture classifies the action as risk-reducing:
- close;
- reduce;
- cancel an unfilled risk-increasing order;
- add/restore required protection;
- other governed de-risking actions.

Broker availability, reconciliation and protection rules still govern whether the action can actually complete. The invariant is narrower: behavioural friction or enforcement cannot delay/block risk reduction solely because a guardrail triggered, is stale, or is unavailable.

Guardrails may preserve or narrow existing authority. They may never widen authority.

No inferred emotion may become an authoritative guardrail condition.

## Mode truth

- **Signal:** observe/warn/review; cannot claim to block external manual broker action.
- **Semi-Auto:** warn/review/require confirmation inside Zugrio; future enforcement can block a new risk-increasing Zugrio submission only after authority integration; guardrails cannot obstruct governed risk reduction.
- **Auto:** system actions remain inside explicit authority; user interventions/overrides are separately attributable; future behavioural constraints require deterministic admitted policy and may only narrow new risk-increasing action, never governed risk reduction.
- **Full Auto:** same principle plus portfolio-level validation; remains release-gated; portfolio guardrails must preserve risk-reduction precedence.

## Consequences

### Positive
- behavioural analytics can become actionable without pretending to read minds;
- users can define explicit guardrails around known repeatable deviations;
- product language can accurately describe what is and is not enforceable;
- system/user action attribution becomes stronger.

### Tradeoffs
- broker read-only coverage and plan-to-trade matching quality limit observation coverage;
- confirmation friction can be harmful if poorly timed;
- enforcement semantics require capital-path review.

## Capital/safety impact

Advisory/confirmation: low-to-medium.

Enforcing guardrails: high. Not authorized for live capital by this ADR alone.

## Alternatives rejected

### Infer tilt/revenge/fear directly from trades
Rejected as non-verifiable and potentially misleading.

### Claim Zugrio can stop all manual trades
Rejected because the user can act directly at a broker unless the broker/account integration explicitly grants such control.

### Automatically block after a fixed number of losses
Rejected because no universal evidence-backed rule has been established and it would invent authority policy.

## Unresolved

- exact deterministic pattern definitions;
- matching-confidence requirements;
- user creation/edit/revocation UX;
- conflict precedence with risk/execution policies;
- jurisdiction-specific implications;
- evidence required for enforcing guardrails.
