# ZUGRIO SIGNAL AUTHORITY ARCHITECTURE — v1.0.2 ERRATA

Status: **ERRATA AMENDMENT TO FROZEN v1.0.1 ARCHITECTURE**

This amendment corrects five implementation-level defects/ambiguities discovered after v1.0.1. It does **not** reopen or alter the frozen authority-layer boundaries, provenance scopes, conviction-state semantics, candidate-selection authority, validation sequence, or certification standard.

## Version history

- **v1.0** — architecture frozen after convergence.
- **v1.0.1** — first errata amendment.
- **v1.0.2** — second errata amendment; identity semantics, live-FIRE refresh, emergency protection recovery, fill-breach detection, and EV/slippage normalization.

## E2-1 — Observation identity versus construction determinism

**Defect.** v1.0.1 excluded `capturedAt`/`derivedAt` from snapshot identity. That can make a fresh and stale observation share the same content ID when measured values are unchanged, while the authority path binds snapshots by ID.

**Correction.**

Observation timestamps that establish freshness/staleness remain in the identity preimage. This includes:

- `ExecutionSnapshot.derivedAt`
- `RiskContextSnapshot.capturedAt`
- `VetoContextSnapshot.capturedAt`
- `ManagedPositionSnapshot.capturedAt`
- `ManagementContextSnapshot.capturedAt`
- `BrokerSafetySnapshot.capturedAt`

Authoritative `quoteAt`, source-bar times/IDs and broker event times remain identity-bearing as already required.

Audit-only **construction** timestamps are excluded from construction identity:

- `EntryIntent.constructedAt`
- `ManagementIntent.constructedAt`
- `SubmissionEnvelope.preparedAt`

Thus two observations made at different authoritative times receive different snapshot IDs even when their measurements match, while two deterministic constructions over identical pinned inputs/policy receive the same semantic construction ID despite different audit execution times.

**Gate impact.** This correction is mandatory before Gate 0 content-addressing implementation.

## E2-2 — SNAPSHOT_BOUND refresh during a live FIRE event

**Defect.** v1.0.1 declared READY refresh/re-inference cadence but did not say whether that cadence continues after FIRE forms.

**Correction.**

- While READY and **no FIRE event is live**, each scheduled ExecutionSnapshot refresh requires a fresh snapshot-bound 2A inference before FIRE evaluation.
- Once FIRE forms, routine snapshot refresh/re-inference for that opportunity is **suspended**.
- The FIRE event remains bound to its pinned ExecutionSnapshot.
- The refresh timer itself does not terminate/replace FIRE.
- FE-2 (changed closed-bar facts) and FE-6 (pinned-snapshot staleness), plus ordinary invalidation/expiry rules, govern termination.
- After FIRE resolves or terminates, normal snapshot refresh/re-inference resumes from current facts.

This prevents routine refresh from making a correctly formed short-lived FIRE event self-cancel.

## E2-3 — Emergency protection recovery cannot widen risk

**Defect.** v1.0.1 allowed the Emergency Risk-Reduction Kernel to restore the frozen stop. If a management policy had already tightened the broker-confirmed stop, restoring the older frozen level could widen risk.

**Correction.**

The kernel may place/recover a protective stop only if the action cannot increase `maximumLossNow`.

The candidate recovery level is the directionally tighter of:

1. the verified FrozenTradeGeometry stop; and
2. the last broker-confirmed `ManagedPositionSnapshot.currentStop`, when present.

For LONG, the tighter valid protective level is the higher stop. For SHORT, it is the lower stop. A confirmed tighter stop is never moved outward to the historical frozen stop.

If no candidate level is verifiable, the proposed stop would increase `maximumLossNow`, or the broker rejects the non-widening stop, the kernel escalates to broker-supported full close by verified position ID.

## E2-4 — Pre-submission versus realized fill-breach detection

**Defect.** ID-6 attributed breach detection jointly to BrokerSafetySnapshot and post-fill reconciliation, although BrokerSafetySnapshot exists before submission and cannot observe the actual fill.

**Correction.**

- `BrokerSafetySnapshot` may detect only pre-submission quote/connectivity/adverse-price conditions and abort before the network submission.
- Actual fill-price/slippage breaches are detected by **post-fill reconciliation**.
- A realized breach invokes the declared protection/risk-reduction response and can never authorize retry, top-up, or added exposure.

## E2-5 — EV calibration normalization includes slippage and declares R

**Defect.** v1.0.1 normalized account-specific non-slippage costs but left actual-versus-expected slippage inside realized R, still confounding model calibration. It also did not declare the calibration R denominator.

**Correction.**

For calibration:

`canonicalInitialRiskAmount`

is the monetary initial risk of the actually executed quantity from pinned `pExec` to the frozen stop, before costs/slippage, under the bound instrument/value-conversion semantics.

All calibration R quantities use that denominator.

Record:

`accountCostDeltaR = actualAccountNonSlippageCostsR - canonicalCostModelNonSlippageCostsR`

and:

`accountSlippageDeltaR = actualExecutionSlippageCostR - canonicalExpectedSlippageCostR`

for the exact execution legs included by `evDefinitionHash`.

Then:

`executionNormalizedRealizedR = realizedNetRAccount + accountCostDeltaR + accountSlippageDeltaR`

where `realizedNetRAccount` is itself expressed on `canonicalInitialRiskAmount` for calibration.

Gate 7 validates EV against `executionNormalizedRealizedR` under both the bound `costModelHash` and `evDefinitionHash`. Raw account net R, account-risk-based operational R where used, `accountCostDeltaR`, and `accountSlippageDeltaR` remain separately reported for execution realism.

## Freeze preservation

v1.0.2 changes no authority boundary, provenance scope, conviction state, selection authority, risk-increasing/risk-reducing distinction, or validation sequence.

The architecture remains **FROZEN at v1.0.2**.

Gate implications:

- **Gate 0:** MUST implement E2-1 from the start.
- **Gate 3/4:** MUST implement E2-2 and E2-3 before clearance.
- **Gate 4:** MUST implement E2-4 before broker-boundary clearance.
- **Gate 7:** MUST implement E2-5 before EV calibration/certification.