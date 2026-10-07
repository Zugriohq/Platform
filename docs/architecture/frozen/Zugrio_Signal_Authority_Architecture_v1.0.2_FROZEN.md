---

# ZUGRIO SIGNAL AUTHORITY ARCHITECTURE — v1.0.2 · ARCHITECTURE FROZEN

Status: ARCHITECTURE FROZEN. Normative source of truth for Zugrio signal authority and execution safety. v1.0.2 incorporates implementation errata against frozen v1.0/v1.0.1 without reopening the authority architecture. Future architectural changes require an explicit versioned amendment; implementation non-compliance does not amend this document.

Implementation compliance: NON-COMPLIANT. See §16.

**[RC6]** marks changes introduced during the final convergence pass from RC5. **[ERRATA-1]** marks v1.0.1 corrections. **[ERRATA-2]** marks v1.0.2 corrections. Both errata sets preserve the frozen layer boundaries and authority semantics. **[UNSET]** marks values that must still be measured and validated before capital authority. Frozen architecture does not imply calibrated thresholds, validated edge, or implementation certification.

**Changelog:** closes the remaining execution-boundary gaps: snapshot-bound inference ordering made acyclic; VetoContextSnapshot added; provenance split into four scoped verdicts including selection-policy admission; CONVICTION_UNAVAILABLE added; risk-reducing position-management construction specified; Broker Execution Policy fully defined; broker submission/fill/protection lifecycle specified; immutable decision objects made content-addressed; BrokerSafetySnapshot abort terminates the FIRE event; the broker component is explicitly a downstream boundary rather than a fifth authority layer. **v1.0.1 errata:** deterministic identity preimages exclude audit-only wall-clock fields; snapshot-bound READY refresh requires explicit re-inference; G-12 conformance is enforced; kernel-only protection recovery is explicit; PROTECTION_PENDING has a deadline; EV calibration is cost-normalised; brokerCostContext is removed from Layer-4A sizing identity; conflict-policy and PROPOSE references are made exact; RiskContext coherence becomes testable. **v1.0.2 errata:** observation timestamps remain inside snapshot identity while construction audit timestamps are excluded; SNAPSHOT_BOUND refresh is suspended during a live FIRE event; emergency stop recovery is bounded by current broker-confirmed protection and `maximumLossNow`; BrokerSafetySnapshot is limited to pre-submission detection while post-fill reconciliation owns fill-breach detection; EV validation is normalized for both account-cost and slippage deltas on a declared canonical R denominator.


**Version history**
- **v1.0** — architecture frozen after RC6 convergence.
- **v1.0.1** — errata-only amendment; no change to layer boundaries, provenance scopes, state semantics or validation sequence.
- **v1.0.2** — errata-only amendment correcting identity, live-FIRE refresh, emergency protection recovery, broker fill-breach wording and EV/slippage normalization; no architectural boundary change.

**Locked and not revisited absent contrary evidence:** structural versus conviction ladders; 2A → provenance → 2B separation; hard-predicate anti-laundering; FIRE as a fresh event; FrozenTradeGeometry versus ExecutionSnapshot; advisory-only online component and feature isolation; bounded ATR; continuation at OBSERVE; setup-priority scope; counterfactual preservation; risk-reducing emergency path; permanent holdout spending; Gate 5A → 6 → 7 → 8 validation sequence; BLOCK-terminal entry semantics.

---

## 1. Layers and authority

The architecture retains **four authority layers**. Numbered subcomponents do not create additional signal authority.

**Layer 1 — Deterministic contract. Authority: eligibility.** Returns ELIGIBLE / INELIGIBLE / INVALIDATED with named reasons. Emits named boolean predicates and raw features. Never a continuous scalar consumed directly by state progression.

**Layer 2A — Inference. Authority: probabilistic estimation only.** Emits pWin, EV and auxiliary probabilistic outputs. No state authority.

**Layer 3 — Provenance. Authority: scoped admission.** Issues four independent verdicts: `INFERENCE_ADMITTED`, `STATE_POLICY_ADMITTED`, `SELECTION_POLICY_ADMITTED`, `EXECUTION_POLICY_ADMITTED`.

**Layer 2B — Conviction-state policy. Authority: state progression.** Owns `CONVICTION_UNAVAILABLE`, `MODEL_EVALUATED_NO_SIGNAL`, WATCH, READY and FIRE.

**Layer 4 — Execution safety and construction.** Contains:
- **Layer 4A — Entry-intent construction. Authority: none discretionary.** Mechanically applies the Risk/Sizing Policy to pinned immutable inputs.
- **Layer 4M — Position-management construction. Authority: none discretionary.** Mechanically applies the Position Management Policy to a broker-anchored managed position and immutable inputs.
- **Layer 4B — Deterministic veto. Authority: refusal only.** Returns ALLOW or BLOCK. Never modifies an intent. BLOCK is terminal for an entry FIRE event.

**Broker Execution Boundary / Adapter — downstream machinery, not an authority layer.** Owns idempotent submission, acknowledgement/fill/protection state, unknown-state handling and broker reconciliation. It MUST NOT originate a trade thesis or alter approved economics.

**Invariants**

- I-1 Eligibility is necessary, never sufficient.
- I-2 Conviction is necessary, never sufficient for risk-increasing execution.
- I-3 Inference/State/Selection/Execution-policy admission failures block only their governed authority and MUST NOT by themselves block a valid RISK_REDUCING action. Broker position identity, broker reachability and trusted broker-adapter integrity remain operational prerequisites for automated risk reduction.
- I-4 Layer 4B BLOCK prevents RISK_INCREASING execution. RISK_REDUCING actions traverse the reduced safety path in §10.7.
- I-5 No component may simulate, approximate or substitute for another authority.
- I-6 Removing a mechanism does not license recreating it under another name. Any input to conviction-state progression remains subject to §14B/§14C.
- I-7 Entry position size is determined solely by the versioned Risk/Sizing Policy at Layer 4A from immutable identified inputs. No other component may set, scale or adjust it.
- I-8 Every input to Layer 4A, 4M and 4B is an immutable, identified object. These components read no mutable global market/account state.
- I-9 One broker entry effect per `(fireEventId, accountId)` is enforced at the broker boundary through deterministic submission identity plus reconciliation, not by local counting alone.
- I-10 A risk-reducing management action can never be relabelled to gain authority: classification is determined from its effect on maximum loss/exposure, never from caller or name.

---
## 2. Dataflow and acyclic graph

### 2.1 Core signal path

```text
Market data
→ deterministic measurements [L1]
→ canonical regime [L1]
→ candidate contract + lifecycle [L1]
→ predicates + capital feature assembly [L1]
→ optional pre-inference ExecutionSnapshot assembly when required by contract variant
→ inference [L2A]
→ INFERENCE_ADMITTED [L3]
→ STATE_POLICY_ADMITTED [L3]
→ conviction-state policy [L2B]
→ SELECTION_POLICY_ADMITTED [L3]
→ interim selection [L2B]
→ EXECUTION_POLICY_ADMITTED [L3]
→ RiskContextSnapshot
→ entry-intent construction [L4A]
→ VetoContextSnapshot
→ deterministic veto [L4B]
→ BrokerSafetySnapshot
→ SubmissionEnvelope construction under Broker Execution Policy
→ Broker Execution Boundary / Adapter
→ broker
```

### 2.2 Snapshot-bound inference ordering

For `SNAPSHOT_BOUND` inference, the ExecutionSnapshot is created **before the inference that may produce READY/FIRE**:

```text
LIFECYCLE_CONFIRMED
→ ExecutionSnapshot E
→ inference explicitly bound to E
→ admission
→ state policy
→ FIRE, if qualified
→ FIRE pins that same E
```

For `SNAPSHOT_INDEPENDENT` inference, no ExecutionSnapshot participates in pWin/EV. FIRE still requires a complete fresh ExecutionSnapshot for execution economics.

Before `LIFECYCLE_CONFIRMED`, a profile MAY run snapshot-independent inference for WATCH if the declared model supports it. A snapshot-bound model MUST be re-inferred after geometry becomes complete; a pre-geometry inference can never be promoted to READY or FIRE by reuse. **[ERRATA-1][ERRATA-2]** For `SNAPSHOT_BOUND` profiles, State Policy MUST declare `executionSnapshotRefreshCadence[profile]`. While READY **and no live FIRE event exists for that opportunity**, each required snapshot refresh creates a new ExecutionSnapshot and MUST trigger a new 2A inference bound to that snapshot before any FIRE evaluation. A READY state may persist only while its bound inference and snapshot both remain current under the declared cadence/staleness rules; an older inference may never be combined with a refreshed snapshot. **Once FIRE forms, scheduled snapshot refresh/re-inference for that opportunity is suspended until the FIRE event resolves or terminates.** The live event remains bound to its pinned snapshot and is governed by FE-2/FE-6 freshness and invalidation rules. After resolution/termination, normal evaluation resumes with a fresh snapshot/inference as required.

### 2.3 Position-management path

```text
Broker-managed position
→ ManagedPositionSnapshot
→ Position Management Policy [L4M]
→ ManagementIntent
→ order classification
→ reduced/full veto path as classification requires [L4B]
→ Broker Execution Boundary / Adapter
→ broker
```

A management intent that would increase exposure, widen maximum loss or reverse direction is RISK_INCREASING and is rejected from the management path. Opening the opposite direction requires a new eligible candidate and new FIRE event.

**Graph rules**

- G-1 No authority-path node consumes an output produced later in its applicable path.
- G-2 Canonical regime has exactly two authority-path consumers: candidate contract and capital feature assembly. Diagnostic/UI/append-only research consumers may observe but never feed back.
- G-3 Probabilistic regime characterizations never occupy the canonical regime field and are never read by the candidate contract.
- G-4 Post-formation outcomes are research labels and are unreachable from live authority-path nodes.
- G-5 Replay, shadow, demo and live traverse the same decision nodes, differing only in event source and execution adapter.
- G-6 Unadmitted 2A output has zero authority-path consumers.
- G-7 Advisory features, including all online-component output, have zero authority-path consumers.
- G-8 Layer 4A has exactly five immutable inputs: FIRE event, FrozenTradeGeometry, pinned ExecutionSnapshot, RiskContextSnapshot and Risk/Sizing Policy.
- G-9 Layer 4B receives only immutable intent/snapshots/policy-verdict facts. Any mutable global read is a structural violation.
- G-10 BrokerSafetySnapshot can only abort submission; it is outside pWin, EV, R:R and sizing.
- G-11 Position-management construction cannot originate new exposure.
- G-12 Client/broker submission identity is created only after Layer 4B ALLOW; Layer 4A does not depend on Broker Execution Policy.

Conformance MUST assert G-1 through G-12 structurally. **[ERRATA-1]**

---
## 3. Opportunity states

### 3.1 Structural ladder

Applies when `INFERENCE_ADMITTED` is absent:

```text
STRUCTURAL_CANDIDATE → STRUCTURAL_WATCH → STRUCTURAL_READY
```

STRUCTURAL_READY may notify, render complete geometry, persist to the ledger and be evaluated in research. It cannot submit an order, invoke automated execution, or transition to conviction by deterministic fallback.

Mandatory and untruncated on every STRUCTURAL_READY surface:

```text
STRUCTURAL READY · NOT MODEL-SCORED
Valid structure and trade geometry. No validated pWin/EV is available for this setup.
```

No FIRE language, conviction language, probability badge or affordance visually equivalent to calibrated READY/FIRE.

### 3.2 CONVICTION_UNAVAILABLE

`INFERENCE_ADMITTED = true` but `STATE_POLICY_ADMITTED = false`.

- CU-1 The inference itself remains valid and may be shown diagnostically.
- CU-2 Zugrio MUST NOT translate the inference into WATCH, READY or FIRE.
- CU-3 It is not `MODEL_EVALUATED_NO_SIGNAL`; the model did not reject the opportunity. The system lacks an admitted policy with which to interpret it.
- CU-4 It has no active-plan authority and no execution authority.
- CU-5 It persists to the ledger with pWin, EV and the State Policy admission failure reason.

### 3.3 MODEL_EVALUATED_NO_SIGNAL

`INFERENCE_ADMITTED = true` and `STATE_POLICY_ADMITTED = true`, but the candidate fails to reach WATCH for any reason under the admitted policy.

- NS-1 It is a conviction-policy result, not a structural state.
- NS-2 Once inference and State Policy are admitted, structural labels are suppressed for that opportunity.
- NS-3 It persists with pWin, EV, failing policy condition and evaluated hashes.
- NS-4 It is ledger/diagnostic only and never enters the active-plan pool.

### 3.4 Scoped demotion

- DM-1 `INFERENCE_ADMITTED` failure: recompute structural state solely from current Layer-1 lifecycle.
- DM-2 `STATE_POLICY_ADMITTED` failure with valid inference: enter `CONVICTION_UNAVAILABLE`; do not pretend the model rejected the setup.
- DM-3 `SELECTION_POLICY_ADMITTED` failure: candidate conviction states remain individually valid, but no authoritative active-plan selection is produced.
- DM-4 `EXECUTION_POLICY_ADMITTED` failure: conviction and valid selection may remain visible, but all RISK_INCREASING execution is locked.
- DM-5 Every demotion records scope, reason, timestamp, evaluated hashes, prior state and resulting authority state.

---
## 4. Conviction states

### 4.1 Exhaustive precedence

Only when both `INFERENCE_ADMITTED` and `STATE_POLICY_ADMITTED` are true, Layer 2B assigns the first matching state:

```text
1. INVALIDATED | EXPIRED                           → terminate
2. all FIRE requirements hold                     → FIRE_EVENT
3. all READY requirements hold                    → READY
4. all WATCH requirements hold                    → WATCH
5. otherwise                                      → MODEL_EVALUATED_NO_SIGNAL
```

If inference is admitted but State Policy is not, §3.2 applies instead.

### 4.2 Requirements

```text
WATCH(profile)
  = admitted inference + admitted State Policy
  + pWin ≥ watchPWinFloor[profile]                 [UNSET]
  + required predicates

READY(profile)
  = WATCH requirements
  + LIFECYCLE_CONFIRMED
  + pWin ≥ readyPWinFloor[profile]                 [UNSET]
  + EV ≥ readyEVFloor[profile]                     [UNSET]

FIRE(profile)
  = valid FIRE_EVENT per §4.4
```

- F-1 Every shipped profile — SCALP, DAY, SWING — requires both a pWin floor and EV floor at FIRE.
- F-2 Historical Scalp/Day/WATCH/READY numbers remain reference priors only, never executable thresholds.
- F-3 Numeric thresholds become capital-authoritative only through a validated, versioned State Policy bound to admitted inference identity.
- F-4 Missing Day-EV/Swing values remain [UNSET], never invented for completeness.

### 4.3 Required predicates

Only named Layer-1 booleans passing §14C may gate a conviction state. Raw `regimeConfidence` is never read by 2B. `family`, `decay`, "strong trigger", grade caps and successors are excluded unless they survive §14C.

### 4.4 FIRE as an event

```text
FIRE_EVENT
  = current eligible candidate
  + LIFECYCLE_CONFIRMED
  + fresh ENTRY_EVENT_CONFIRMED
  + admitted inference satisfying admitted FIRE State Policy
  + exactly one eligible ExecutionSnapshot
```

A FIRE event carries immutable:
`fireEventId`, `sourceClosedBarId`, `inferenceId`, `pinnedExecutionSnapshotId`, `candidateId`, `geometryId`.

- FE-1 The FIRE freshness window is declared per profile [UNSET].
- FE-2 New closed-bar facts that change candidate, lifecycle, entry event or inference terminate the event.
- FE-3 Execution requires a live, unexpired FIRE event.
- FE-4 For `SNAPSHOT_BOUND`, the FIRE event MUST pin the exact ExecutionSnapshot used by its inference.
- FE-5 For `SNAPSHOT_INDEPENDENT`, the FIRE event pins the fresh ExecutionSnapshot used for current execution economics.
- FE-6 If the pinned snapshot exceeds its staleness tolerance before entry submission, the FIRE event terminates. It is never refreshed in place.
- FE-6A **[ERRATA-2]** Routine `SNAPSHOT_BOUND` refresh cadence is suspended while this FIRE event is live. A refresh timer does not itself terminate or replace a live FIRE event; only the event's own staleness/closed-bar/invalidation rules do. Once the event resolves or terminates, refresh/re-inference resumes from current facts.
- FE-7 Semi-Auto approval after expiry triggers re-evaluation, never revival.
- FE-8 Layer 4B BLOCK terminates the event.
- FE-9 BrokerSafetySnapshot abort terminates the event. No later retry may use the same fireEventId.
- FE-10 One broker entry effect per `(fireEventId, accountId)` execution scope.

### 4.5 Transition policy

State Policy MUST contain an exhaustive transition matrix covering entry, downgrade/exit, inference freshness, hysteresis, FIRE freshness, reset rules and deduplication keys.

- TR-1 Falling pWin/EV downgrade behavior is explicit.
- TR-2 Hysteresis is declared and validated.
- TR-3 Stale inference forces re-inference or scope demotion.
- TR-4 WATCH → FIRE without READY is allowed only if explicitly declared and all lifecycle/predicate requirements are met.
- TR-5 Undeclared transitions are prohibited.

---
## 5. Regime authority

Canonical regimes: TRENDING, MEAN_REVERTING, EXPANSION, BREAKOUT, NOISE, EXHAUSTION, COMPRESSION. Deterministic and reproducible from the bounded window alone. Runs before candidate validation; feeds the contract and capital feature assembly. The ensemble may consume regime label, age, transition state and expansion measures as features, may emit separately named probabilistic characterizations, and never redefines or retroactively revises the canonical regime. Regime confidence is a feature and a diagnostic; its only path to state progression is `REGIME_QUALITY_OK`, which must pass §14C.

---

## 6. Candidate contract, lifecycle, geometry and selection

### 6.1 Output

Layer 1 returns ELIGIBLE / INELIGIBLE / INVALIDATED with named reason codes. No strength, conviction or composite freshness score.

### 6.2 One contract

A named route has exactly one production interpretation across CORE/profile consumers. Profiles may differ by timeframe, context and economic policy but not by route meaning.

### 6.3 Lifecycle

```text
Retest:       BREAK_CONFIRMED → RETEST_TOUCHED → RETEST_HELD → LIFECYCLE_CONFIRMED
Continuation: BREAK_CONFIRMED → CONTINUATION_HELD → LIFECYCLE_CONFIRMED
Terminal:     INVALIDATED | EXPIRED
```

CONTINUATION_HELD requires the next closed bar to remain on the valid side of the break, preserve invalidation, remain inside extension budget and satisfy data/freshness predicates. Layer 1 never emits TRIGGERED. Every route consumes at least one closed confirming bar beyond the break.

### 6.4 Lifecycle-to-conviction

| Authority result | Minimum lifecycle | Fresh entry event |
|---|---|---|
| CONVICTION_UNAVAILABLE | BREAK_CONFIRMED | not required |
| MODEL_EVALUATED_NO_SIGNAL | BREAK_CONFIRMED | not required |
| WATCH | BREAK_CONFIRMED | not required |
| READY | LIFECYCLE_CONFIRMED | not required |
| FIRE | LIFECYCLE_CONFIRMED | required |

`ENTRY_EVENT_CONFIRMED` is a named Layer-1 predicate and must pass §14C. INVALIDATED/EXPIRED terminate the opportunity regardless of probabilistic state.

### 6.5 Setup priority

```text
LIQUIDITY_SWEEP_REVERSAL > FVG_MITIGATION > CHOCH_RETEST > BOS_RETEST
> BREAKOUT_CONTINUATION > TREND_CONTINUATION > COMPRESSION_BREAKOUT_WATCH
```

Priority has four roles only: deduplication of overlapping representations of the same structural event, presentation ordering, degraded-mode ordering, and final deterministic tie-breaking. It never suppresses a genuinely distinct candidate before inference.

### 6.6 Selection-policy admission and active-plan pool

Selection runs only when `SELECTION_POLICY_ADMITTED = true`.

- SEL-1 At most one authoritative active plan per instrument per direction; BUY and SELL intelligence plans may coexist.
- SEL-2 Pool precedence: admitted WATCH/READY/FIRE candidates first; if none, eligible unadmitted structural candidates. `CONVICTION_UNAVAILABLE` and `MODEL_EVALUATED_NO_SIGNAL` are ledger/diagnostic only.
- SEL-3 Admitted ranking: conviction state → pWin → EV → setup priority → causal age.
- SEL-4 Unadmitted structural ranking: structural lifecycle state → setup priority → causal age.
- SEL-5 Every non-selected eligible candidate persists as `COUNTERFACTUAL_ELIGIBLE` with losing reason and comparison values.
- SEL-6 If BUY and SELL both reach FIRE, Layer 4B invariant 10 `DUPLICATE_OR_CONFLICTING_POSITION` prevents opposing entry unless a later locked policy explicitly permits it. **[ERRATA-1]**
- SEL-7 On selection-policy admission failure, no authoritative active plan is chosen. Individual candidate states remain displayable as non-selected diagnostics.

### 6.7 FrozenTradeGeometry

Frozen at LIFECYCLE_CONFIRMED:

```text
FrozenTradeGeometry {
  geometryId,
  setupType, entryRoute, sourceStructureId, setupIdentity,
  entryReference, entryZone{low,high,ideal,source},
  invalidationLevel, stop, targets{t1,t2,t3},
  frozenAt, expiresAt
}
```

- V-1 Frozen by deterministic lifecycle, never by conviction.
- V-2 Remains frozen through provenance demotion.
- V-3 Unfreezes only on reset, INVALIDATED or EXPIRED.
- V-4 Contains no R:R, current costs, current price or position size.
- V-5 pRef is never presented as currently obtainable once passed.
- V-6 TP1 is the nearest credible objective; a near obstacle blocks rather than being relabelled.

### 6.8 ExecutionSnapshot

Measurements only:

```text
ExecutionSnapshot {
  executionSnapshotId,
  candidateId, geometryId,
  costModelHash,
  pExec, quoteAt, spread, expectedSlippage, costs,
  stopDistanceFromExec, grossRR, netRR, derivedAt
}
```

- X-1 For `SNAPSHOT_BOUND`, it is assembled **before** the applicable 2A inference and its ID is carried by that inference contract/record.
- X-2 For `SNAPSHOT_INDEPENDENT`, it may be assembled after inference but before FIRE evaluation.
- X-3 It contains no eligibility verdict.
- X-4 Snapshot staleness tolerance is declared [UNSET].
- X-5 A materially new snapshot never updates a live FIRE event in place.
- X-6 Every consumer explicitly declares which snapshot/object it consumes.
- X-7 `pExec` is the sole current entry-price basis for live stop-distance and R:R calculations. `stopDistanceFromExec`, grossRR and netRR must all derive from the same pExec and frozen stop/targets.
- X-8 ExecutionSnapshot `costs` are produced by the versioned canonical `costModelHash` bound to inference and are account-neutral assumptions. Account-specific broker costs may only make execution stricter at Layer 4B; they never rewrite a live FIRE event or improve its economics.

### 6.9 Broker-side last-moment safety

Broker-side last-moment safety is intentionally outside candidate geometry and execution economics. The canonical `BrokerSafetySnapshot` schema and authority are defined once, in §10.8. §6 contains no duplicate definition.


---
## 7. Contracts, provenance, identity and hashing

### 7.1 Cryptographic trust root

```text
trustRoot {
  trustRootVersion, trustRootHash,
  allowedSignatureAlgorithms[],
  minimumCryptographicParameters,
  trustedSigningKeys[{keyId, publicKey, validFrom, validUntil, status}],
  keyRotationRule, revocationList[]
}
```

- TRT-1 Provisioned out of band and pinned in the build/deployment trust store.
- TRT-2 Unknown algorithm fails closed.
- TRT-3 Unknown, revoked or expired signing key fails closed.
- TRT-4 An artifact cannot nominate a new trust root for itself.
- TRT-5 Every admission decision records the locally pinned `trustRootVersion` and `trustRootHash`.
- TRT-6 Trust-root rotation is a signed release/deployment event, never a runtime artifact decision; an unrecognized local trustRootHash disables risk-increasing execution until the release trust chain is restored.

### 7.2 Canonical serialization, hashes and content IDs

- H-1 SHA-256 over canonical UTF-8 serialization with lexicographically sorted keys, no insignificant whitespace, fixed numeric canonical form, no exponent notation and explicit negative-zero handling.
- H-2 Self-hash fields are excluded from their own preimage.
- H-3 Only the `signature` value is excluded from the signed preimage. `signatureAlgorithm` and `signingKeyId` remain authenticated.
- H-4 Loaded artifacts are verified against actual bytes, not merely declared metadata.
- H-5 Immutable decision and observation objects use content-addressed IDs where practical, over an explicit **identity preimage**:  `id = SHA256(domainSeparator || canonicalIdentityBytesWithoutId)`. **[ERRATA-1][ERRATA-2]**
- H-5A **Observation identity. [ERRATA-2]** For snapshots whose freshness/staleness is semantically authoritative, the observation/capture timestamp remains **inside** the identity preimage. This includes `ExecutionSnapshot.derivedAt`, `RiskContextSnapshot.capturedAt`, `VetoContextSnapshot.capturedAt`, `ManagedPositionSnapshot.capturedAt`, `ManagementContextSnapshot.capturedAt`, and `BrokerSafetySnapshot.capturedAt`. Authoritative source timestamps such as `quoteAt`, source-bar IDs/times and broker event times likewise remain in the preimage. Two observations with identical measured values but different authoritative observation times MUST have different snapshot IDs.
- H-5B **Construction determinism. [ERRATA-2]** Audit-only construction timestamps are excluded from the identity/determinism preimage: `EntryIntent.constructedAt`, `ManagementIntent.constructedAt`, and `SubmissionEnvelope.preparedAt`. They remain ledgered for audit. Determinism assertions compare canonical construction identity preimages, not the full audit envelope; identical canonical inputs/policy MUST therefore yield identical semantic construction IDs even when those audit timestamps differ.
- H-5C Local receipt/logging timestamps that neither establish observation freshness nor affect decision semantics are audit-only and excluded from identity. A timestamp may be excluded only when its removal cannot make a fresh and a stale authority-path observation share an ID.
- H-6 Domain separators are unique per object type (e.g. `zugrio:execution-snapshot:v1`, `zugrio:fire-event:v1`) to prevent cross-type substitution.

### 7.3 Scoped provenance verdicts

| Verdict | Question | Failure effect |
|---|---|---|
| `INFERENCE_ADMITTED` | Is pWin/EV inference valid? | structural degradation |
| `STATE_POLICY_ADMITTED` | Is the State Policy valid for this inference? | CONVICTION_UNAVAILABLE |
| `SELECTION_POLICY_ADMITTED` | Is authoritative candidate selection policy valid? | states remain; no authoritative active plan |
| `EXECUTION_POLICY_ADMITTED` | Are sizing/management/broker execution policies authorized? | conviction/selection visible; risk-increasing execution locked |

Each verdict is binary in its scope. Failure in one scope does not imply failure in another. All verdicts and reason codes are ledgered.

### 7.4 Inference contract

```text
inferenceContract {
  contractVersion, contractVariant, modelId,
  capitalPathBinding {
    gbmArtifactHash,
    bayesianArtifactHash,
    capitalFeatureSchemaHash,
    capitalEnsembleWeightsHash,
    calibrationHash
  },
  calibrationArtifactId,
  decisionCoreHash, fullBuildHash,
  labelSchemaHash, outcomeDefinition, predictionHorizon, censoringPolicy,
  targetPolicyHash, costModelHash, evDefinitionHash, datasetManifestHash,
  boundExecutionSnapshotId,   // REQUIRED only for SNAPSHOT_BOUND; ABSENT for SNAPSHOT_INDEPENDENT
  trainingWindow{start,end},
  validatedScope{...}, operatingEnvelope{...},
  issuedAt, expiresAt,
  signatureAlgorithm, signingKeyId, signature
}
```

- A-1 Fields required by a declared variant must exist; fields prohibited by that variant must be absent, not null.
- A-2 decisionCoreHash matches running canonical core; fullBuildHash is provenance-only.
- A-3 capitalFeatureSchemaHash matches the actual capital feature vector.
- A-4 Time inside validity interval.
- A-5 Candidate scope inside validatedScope.
- A-6 Signature verifies using already-trusted algorithm/key.
- A-7 Label/target/cost/EV semantics match those in force.
- A-8 Online state never appears in capital admission contract.
- A-9 For SNAPSHOT_BOUND, `boundExecutionSnapshotId` must match the snapshot used to assemble the inference inputs and later pinned by FIRE.
- A-10 All admission decisions are ledgered.

### 7.5 Feature separation

`capitalFeatureSchema` and `advisoryFeatureSchema` are disjoint. Online-component output is advisory-only. Capital inference has no direct or derived dependency on advisory features.

### 7.6 State Policy artifact

```text
statePolicy {
  statePolicyVersion,
  watchPWinFloor[profile], readyPWinFloor[profile], firePWinFloor[profile],
  readyEVFloor[profile], fireEVFloor[profile],
  fireEventFreshnessWindow[profile], executionSnapshotStaleness[profile],
  executionSnapshotRefreshCadence[profile],  // [ERRATA-1] SNAPSHOT_BOUND re-inference cadence
  precedenceRule, transitionMatrix,
  requiredPredicates[profile][state],
  entryEventDefinition, regimeQualityRule, predicateClassifications,
  validationArtifactId,
  boundTo{capitalPathBinding,labelSchemaHash,evDefinitionHash,decisionCoreHash},
  statePolicyHash,
  signatureAlgorithm, signingKeyId, signature
}
```

### 7.7 Candidate Selection Policy artifact

```text
candidateSelectionPolicy {
  version, bucketingRule, poolFormationRule,
  admittedRanking, unadmittedRanking,
  counterfactualPersistenceRule, dedupRule,
  boundTo{decisionCoreHash,statePolicyHash},
  candidateSelectionPolicyHash,
  signatureAlgorithm, signingKeyId, signature
}
```

Layer 3 validates it before selection and issues `SELECTION_POLICY_ADMITTED`.

### 7.8 Risk/Sizing Policy artifact

```text
riskSizingPolicy {
  version,
  riskPerTradePct[profile], equitySource, equityStalenessTolerance,
  volumeRoundingRule, minSize, maxSize, profileRiskScale[profile],
  metaRiskStateReductions{NORMAL,CAUTION,DEFENSIVE,HALT},
  reductionRules, correlationHaircutRule,
  riskContextStalenessTolerance,
  riskContextMaxFieldSkew,             // [ERRATA-1]
  materialExposureChangeThreshold,
  riskSizingPolicyHash,
  signatureAlgorithm, signingKeyId, signature
}
```

### 7.9 Position Management Policy artifact

Current v1 authority is **risk-reducing management only**.

```text
positionManagementPolicy {
  version,
  protectiveStopRecoveryRule,
  breakEvenRule,
  trailingStopRule,
  partialProfitRule,
  fullTargetRule,
  timeExitRule,
  emergencyExitRule,
  managementFreshnessRules,
  supportedActions[],
  positionManagementPolicyHash,
  signatureAlgorithm, signingKeyId, signature
}
```

- PM-1 It may construct initial/recovery protective stop, stop tightening, partial close, full close, break-even/trailing changes that never widen maximum loss, and time/emergency exits.
- PM-2 Any proposed action that would increase maximum loss, exposure or reverse direction is not authorized by this policy.
- PM-3 Opening an opposite position requires a separate FIRE-authorized entry path.
- PM-4 An invalid/unavailable Position Management Policy MUST NOT strand an open position. A minimal built-in **Emergency Risk-Reduction Kernel**, hashed into the canonical `executionSafetyCoreHash`, always retains authority to cancel pending Zugrio risk-increasing orders, request broker-supported full close by verified position ID, and **[ERRATA-1][ERRATA-2] place/recover a protective stop only when the action cannot increase `maximumLossNow`**. The candidate recovery level is the directionally tighter of (a) the frozen stop in verified FrozenTradeGeometry and (b) the last broker-confirmed `ManagedPositionSnapshot.currentStop`, when present: for LONG use the higher valid protective level; for SHORT use the lower valid protective level. The kernel MUST NOT move an existing confirmed stop outward to the frozen historical level. If no candidate level is verifiable, the resulting stop would increase `maximumLossNow`, or the broker rejects the non-widening stop, the kernel escalates to full close. It cannot invent a new level, trail for optimization, partially profit-take, open, add or reverse.

### 7.10 Broker Execution Policy artifact

```text
brokerExecutionPolicy {
  version,
  brokerCapabilityProfile,
  submissionIdDerivationRule,          // binds accountId + brokerVenueId + fireEventId + entryIntentId
  managementActionIdDerivationRule,
  clientOrderIdEncodingAndLength,
  nativeIdempotencyMode,
  supportedOrderTypes[],
  timeInForceRules,
  pendingOrderExpiryRule,
  brokerSafetyThresholds,
  maximumSubmissionLatency,
  submissionTimeoutRule,
  slippageAbortRule,
  adverseExecutionPriceGuardRule,
  partialFillPolicy,
  protectionAttachmentPolicy,
  protectionFailureRecoveryRule,
  maxProtectionPendingInterval,       // [ERRATA-1] hard deadline for live unprotected exposure
  reconciliationMatchRules,
  rejectionHandling,
  marketCloseByPositionIdSemantics,
  brokerExecutionPolicyHash,
  signatureAlgorithm, signingKeyId, signature
}
```

### 7.11 Execution Authority Manifest

```text
executionAuthorityManifest {
  manifestVersion,
  executionSafetyCoreHash,
  brokerAdapterHash,
  riskSizingPolicyHash,
  positionManagementPolicyHash,
  brokerExecutionPolicyHash,
  boundTo{decisionCoreHash, executionSafetyCoreHash, brokerAdapterHash},
  issuedAt, expiresAt,
  signatureAlgorithm, signingKeyId, signature,
  executionAuthorityManifestHash
}
```

Layer 3 validates this manifest and loaded constituent policies before issuing `EXECUTION_POLICY_ADMITTED`.

`EXECUTION_POLICY_ADMITTED` is mandatory for every RISK_INCREASING action. RISK_REDUCING management is intentionally asymmetric: it MAY use an individually trusted, hash-verified Position Management Policy even when the aggregate Execution Authority Manifest is unavailable or expired. If that management policy itself cannot be trusted, only the built-in Emergency Risk-Reduction Kernel may act.

Changing sizing, management or broker execution policy invalidates execution admission only; it does not invalidate pWin/EV or conviction semantics.

---
## 8. Operating envelope

**8.1 Categorical** — instrument, regime, timeframe, horizon, market family, session bucket.

**8.2 Continuous** — declared ranges for spread (absolute and in R), ATR percentile, data age, bars since last gap, time to next high-impact event.

**8.3 Instance OOD, per inference** — per-feature quantile or range checks, a density or conformal score, or Mahalanobis only where validated. PSI MUST NOT be used per inference. Warn and demote thresholds declared.

**8.4 Population drift** — PSI, Jensen-Shannon, Wasserstein or equivalent over a declared window and bin scheme.

**8.5 Integrity** — derived from training data, frozen with the model, never widened post-deployment. All OOD and drift statistics recorded for every inference.

---

## 9. Degradation and demotion — scoped

### 9.1 INFERENCE_ADMITTED failure triggers
Inference-contract failure; envelope/OOD/drift failure; TTL expiry; decision-core mismatch; capital-feature assembly error; inference exception/timeout; calibration-audit failure; realized-vs-predicted calibration breach; loaded capital-artifact mismatch.

Effect: recompute structural state from Layer-1 lifecycle.

### 9.2 STATE_POLICY_ADMITTED failure triggers
State Policy hash/signature/trust failure; bound inference identity mismatch; missing validationArtifactId; predicate-set mismatch; incomplete transition matrix.

Effect: `CONVICTION_UNAVAILABLE`.

### 9.3 SELECTION_POLICY_ADMITTED failure triggers
Selection Policy hash/signature/trust failure; statePolicyHash/decisionCore binding mismatch; undefined or incomplete ranking/dedup semantics.

Effect: candidate states remain valid; authoritative active-plan selection is withheld.

### 9.4 EXECUTION_POLICY_ADMITTED failure triggers
Execution Authority Manifest failure; Risk/Sizing Policy failure; Position Management Policy failure; Broker Execution Policy failure; unresolved reconciliation for affected account; manifest expiry; constituent-policy substitution.

Effect: risk-increasing execution locked. Existing valid convictions remain visible.

### 9.5 Common behavior
Demotion is immediate, scoped, reasoned and visible. Open positions are never force-closed by provenance loss. Valid RISK_REDUCING actions remain available. Recovery requires the failed condition to clear plus fresh admission in that scope; no timeout-only restoration. Repeated flapping may latch until explicit recovery. Retraining remains a new version entering validation from the beginning.

---
## 10. Entry construction, position management, veto and broker boundary

### 10.1 RiskContextSnapshot

```text
RiskContextSnapshot {
  riskContextSnapshotId,
  accountId, brokerVenueId, equity, balance, freeMargin, accountCurrency,
  openRisk, instrumentExposure, currencyExposure, correlationExposure,
  metaRiskState, brokerVolumeConstraints, brokerSymbolConstraints,
  capturedAt
}
```

- RC-1 **[ERRATA-1]** Captured as one coherent account-risk view under a testable rule: all fields come from one atomic broker/account snapshot when supported; otherwise each source field/group carries its authoritative source timestamp and `max(sourceTime)-min(sourceTime)` MUST NOT exceed `riskContextMaxFieldSkew` declared in Risk/Sizing Policy. A breach refuses construction.
- RC-2 Sole account-state source for Layer 4A sizing.
- RC-3 Intent references riskContextSnapshotId.
- RC-4 Layer 4A never reads live mutable account state.

### 10.2 VetoContextSnapshot

Captured immediately before Layer 4B for **safety comparison only**:

```text
VetoContextSnapshot {
  vetoContextSnapshotId,
  accountId, equity, freeMargin,
  openRisk, instrumentExposure, currencyExposure, correlationExposure,
  metaRiskState, brokerVolumeConstraints, brokerSymbolConstraints,
  brokerCostContext,
  capturedAt
}
```

- VC-1 Layer 4B compares it against RiskContextSnapshot using policy tolerances.
- VC-2 It can only BLOCK; it cannot resize or rewrite the intent.
- VC-3 If material exposure/equity/risk changes exceed allowed thresholds, BLOCK.
- VC-3A Account-specific commission/financing/venue costs in `brokerCostContext` are compared against the canonical cost assumptions. If actual expected cost would violate minimum-R:R or cost ceilings, BLOCK; actual account economics never improve the model's declared EV. **[ERRATA-1][ERRATA-2]** Calibration normalization uses the same execution basis as the bound EV definition:
  - `canonicalInitialRiskAmount` is the monetary initial risk of the actually executed quantity measured from the pinned `pExec` to the frozen stop, before costs and slippage, using the bound instrument/value-conversion semantics. This is the R denominator for calibration.
  - `accountCostDeltaR = actualAccountNonSlippageCostsR - canonicalCostModelNonSlippageCostsR` for matching cost components.
  - `accountSlippageDeltaR = actualExecutionSlippageCostR - canonicalExpectedSlippageCostR` for the exact entry/exit legs included by `evDefinitionHash`.
  - `executionNormalizedRealizedR = realizedNetRAccount + accountCostDeltaR + accountSlippageDeltaR`, where `realizedNetRAccount` for calibration is expressed on `canonicalInitialRiskAmount`, not an actual-fill-derived R denominator.
EV calibration is evaluated against `executionNormalizedRealizedR` under the bound `costModelHash`/`evDefinitionHash`. Raw account net R, account-risk-based R where separately used operationally, `accountCostDeltaR`, and `accountSlippageDeltaR` are reported separately as execution-realism/economic records. Actual broker/account advantages never raise the model's declared EV in the live authority path.
- VC-4 Layer 4B performs no mutable global read beyond consuming this pinned snapshot.

### 10.3 Layer 4A — entry-intent construction

```text
constructEntry(
  fireEvent,
  frozenGeometry,
  pinnedExecutionSnapshot,
  riskContextSnapshot,
  riskSizingPolicy
) → EntryIntent {
  entryIntentId,
  fireEventId,
  accountId, brokerVenueId,
  geometryId,
  pinnedExecutionSnapshotId,
  riskContextSnapshotId,
  riskSizingPolicyHash,
  side, size, entryType, stop, targets,
  constructedAt
}
```

- OA-1 Mechanical and deterministic; identical canonical inputs/policy produce a byte-identical **canonical identity preimage** and identical `entryIntentId`. Audit-only `constructedAt` may differ and is excluded per H-5A/H-5B. **[ERRATA-1]**
- OA-2 No hidden optimization or mutable reads.
- OA-3 At most one entry intent may be constructed per `(fireEventId, accountId)` execution scope.
- OA-4 Stale snapshot/risk context or expired FIRE refuses construction.
- OA-5 Layer 4A does not create broker/client submission identity. That identity is created downstream after ALLOW under Broker Execution Policy.

### 10.4 ManagedPositionSnapshot

Broker-anchored representation used by Layer 4M:

```text
ManagedPositionSnapshot {
  managedPositionSnapshotId,
  accountId, brokerPositionId, zugrioOwnershipTag,
  instrument, side, openedAt,
  entryPrice, currentSize,
  currentStop, currentTargets,     // currentStop is the last broker-confirmed protective level; null only if none is confirmed
  maximumLossNow,
  protectionState,
  capturedAt
}
```

- MPS-1 **[ERRATA-2]** `currentStop`, when non-null, MUST be broker-confirmed and directionally valid for the open position. Emergency recovery may never replace a tighter broker-confirmed stop with a looser historical stop.

### 10.5 Layer 4M — management-intent construction

Any market/broker facts needed by management are captured first into an immutable `ManagementContextSnapshot`:

```text
ManagementContextSnapshot {
  managementContextSnapshotId,
  accountId, brokerPositionId,
  currentQuote, quoteAt,
  brokerConnectionState, brokerVolumeConstraints, brokerSymbolConstraints,
  brokerCostContext,
  capturedAt
}
```

The snapshot may omit quote fields for action variants, such as broker-supported full close by position ID, that do not require them.

```text
constructManagement(
  managedPositionSnapshot,
  managementContextSnapshot,
  positionManagementPolicy
) → ManagementIntent {
  managementIntentId,
  managementActionId,
  accountId, brokerPositionId, zugrioOwnershipTag,
  actionType,
  requestedSizeReduction,
  requestedStop,
  requestedClose,
  policyHash,
  constructedAt
}
```

- PMA-1 Mechanical application of Position Management Policy only. Identical canonical inputs/policy produce an identical canonical identity preimage and `managementIntentId`; audit-only `constructedAt` is excluded per H-5A/H-5B. **[ERRATA-1]**
- PMA-2 Intent is classified by its actual effect on maximum loss/exposure.
- PMA-3 Any management intent classified RISK_INCREASING is refused by this path and cannot be relabelled.
- PMA-4 Reversal is two separate acts: risk-reducing close may proceed here; opposite entry requires a new FIRE path.
- PMA-5 Protection recovery receives priority over nonessential management actions.
- PMA-6 If Position Management Policy admission is unavailable, only the built-in Emergency Risk-Reduction Kernel may act; it may cancel pending risk-increasing orders, recover only the non-widening protective level permitted by PM-4, or full-close by verified position ID. Advanced trailing/partial/BE/time-exit logic is suspended. **[ERRATA-1][ERRATA-2]**
- PMA-7 `managementActionId` is deterministic from the verified broker position identity, action semantics and source snapshots. Duplicate or unknown partial-management actions MUST reconcile before repetition.

### 10.6 Layer 4B — veto contract

For entry:

```text
vetoEntry(entryIntent, pinnedExecutionSnapshot, riskContextSnapshot, vetoContextSnapshot)
  → { decision: ALLOW | BLOCK, failedInvariant, inputs, maxPermittedSize }
```

`maxPermittedSize` is diagnostic only and has zero consumers.

For management, apply the invariant set appropriate to its computed classification.

**RISK_INCREASING invariants, in order**

1. DATA_INTEGRITY
2. PRICE_FRESHNESS
3. EXECUTION_SANITY
4. STOP_GEOMETRY
5. MINIMUM_RR from pinned ExecutionSnapshot
6. SPREAD_AND_COST
7. MAXIMUM_RISK
8. EXPOSURE_LIMITS
9. RISK_CONTEXT_FRESHNESS_AND_CHANGE — RiskContext vs VetoContext
10. DUPLICATE_OR_CONFLICTING_POSITION
11. PORTFOLIO_STATE
12. AUTHORITY_CHAIN — all applicable provenance verdicts
13. KILL_SWITCH
14. RECONCILIATION_CLEAR

First failure is BLOCK. BLOCK is terminal for the FIRE event. No automatic resize/retry.

### 10.7 RISK_REDUCING invariant set

At minimum:

```text
POSITION_IDENTITYREDUCTION_PROOF
BROKER_ADAPTER_INTEGRITY
BROKER_REACHABILITY
```

Plus only execution checks genuinely required by the requested broker action.

- RR-1 PRICE_FRESHNESS is not required for broker-supported market close by position ID.
- RR-2 Position identity is broker-side account + immutable broker position ID + verifiable Zugrio ownership tag; a healthy local ledger flag is not required.
- RR-3 Inference/State/Selection/Execution-policy admission failure, entitlement expiry, kill switch and unresolved entry reconciliation never block a genuinely risk-reducing action when broker identity, trusted adapter integrity and reachability are available.
- RR-4 Any management action that widens a stop, adds size or flips direction is RISK_INCREASING.
- RR-5 Protection recovery and emergency exit remain available during degraded states.
- RR-6 If broker adapter integrity or broker reachability is unavailable, Zugrio MUST NOT send an untrusted/undeliverable automated command. It enters `MANUAL_EXIT_REQUIRED`, surfaces the verified broker account/position identity and direct exit instructions, and continues reconciliation/connection recovery. This is an operational inability, not permission to strand the position silently.

### 10.8 BrokerSafetySnapshot

Captured after Layer 4B ALLOW and immediately before risk-increasing submission:

```text
BrokerSafetySnapshot {
  brokerSafetySnapshotId,
  accountId, brokerVenueId,
  currentQuote, quoteAt,
  brokerConnectionState,
  brokerClockSkew,
  capturedAt
}
```

It may only abort. If it aborts an entry submission, the associated FIRE event terminates and cannot be retried.

### 10.9 Deterministic submission identity

Only after Layer 4B ALLOW and BrokerSafetySnapshot pass does the Broker Execution Boundary construct:

```text
SubmissionEnvelope {
  submissionEnvelopeId,
  entryIntentId,
  fireEventId,
  accountId, brokerVenueId,
  clientOrderId,
  adverseExecutionPriceLimit,
  brokerExecutionPolicyHash,
  preparedAt
}
```

- ID-1 `clientOrderId` derives deterministically from canonical `(accountId, brokerVenueId, fireEventId, entryIntentId)` under the frozen Broker Execution Policy.
- ID-2 The broker's charset/length transformation is deterministic and collision-tested.
- ID-3 Native broker idempotency is used when available.
- ID-4 Without native idempotency, durable reservation and reconciliation are mandatory.
- ID-5 Constructing a SubmissionEnvelope does not alter size, stop, target or trade thesis. `adverseExecutionPriceLimit` is a side-aware one-way safety guard mechanically derived from the frozen Broker Execution Policy and pinned ExecutionSnapshot; it may only make execution stricter.
- ID-6 **[ERRATA-2]** The adverse-price guard MUST be no looser than the adverse-price budget implied by the already-passed minimum-R:R, spread/cost and slippage constraints. `BrokerSafetySnapshot` is pre-submission only: it may detect a pre-submit quote/connectivity breach and abort before network submission, but it cannot detect the price actually obtained at fill. If the venue cannot enforce the guard natively, **post-fill reconciliation alone owns detection of realized fill-price/slippage breaches**. Any realized breach is recorded and routed to the declared protection/risk-reduction response; it can never authorize a top-up, retry or additional exposure.

### 10.10 Broker Execution Boundary — submission, fills and protection

The broker boundary is downstream execution machinery, not a fifth authority layer.

**Submission state**

```text
RESERVED → SUBMITTED
SUBMITTED → ACKNOWLEDGED | REJECTED | SUBMISSION_UNKNOWN
```

**Execution state after ACKNOWLEDGED**

```text
OPEN_ORDER | PARTIALLY_FILLED | FILLED | CANCELED
```

**Protection state for any non-zero position**

```text
UNPROTECTED → PROTECTION_PENDING → PROTECTED
                                  ↘ PROTECTION_FAILED
```

Rules:

- SB-1 RESERVED is journalled durably before network submission.
- SB-2 Ambiguous submission result transitions to SUBMISSION_UNKNOWN.
- SB-3 SUBMISSION_UNKNOWN is a hard lock: never resend.
- SB-4 Resolve unknown state only by broker reconciliation using clientOrderId, broker order ID and declared matching rules.
- SB-5 No second entry for the same `(fireEventId, accountId)` while any reservation/submission/fill state is unresolved.
- SB-6 Reconciliation state survives process restart.
- SB-7 REJECTED is terminal for that FIRE event.
- SB-8 PARTIALLY_FILLED is handled exactly according to the frozen Broker Execution Policy; it never triggers an implicit top-up outside policy.
- SB-9 Any non-zero fill without confirmed broker protection enters UNPROTECTED/PROTECTION_PENDING immediately. **[ERRATA-1]** `PROTECTION_PENDING` has a hard deadline from Broker Execution Policy: `maxProtectionPendingInterval`.
- SB-9A If protection is not broker-confirmed before that interval expires, state transitions automatically to PROTECTION_FAILED. An unbounded PROTECTION_PENDING state is prohibited.
- SB-10 PROTECTION_FAILED invokes the risk-reducing protection-recovery/emergency-management path and locks further risk-increasing entries for the affected account/instrument until resolved. Under kernel-only authority, Zugrio first attempts only the non-widening protective level permitted by PM-4; if unverifiable, risk-increasing, unavailable or rejected, it requests full close by verified position ID. **[ERRATA-1][ERRATA-2]**
- SB-11 A broker acknowledgement is not proof of protection; entry/fill/protection states are logged separately.
- SB-12 An unknown fill/protection state never authorizes new exposure.
- SB-13 Any pending/open entry order has a deterministic broker-side or locally enforced expiry no later than the authority window declared by Broker Execution Policy. It MUST NOT remain live indefinitely after the FIRE event that authorized it.
- SB-14 If the underlying candidate becomes INVALIDATED/EXPIRED or a policy-defined cancellation condition occurs while an entry order is still pending, Zugrio issues a cancellation request. Cancellation is risk-reducing and does not require a new FIRE event.
- SB-15 A pending-order cancellation in unknown state locks further entry until broker reconciliation confirms whether the order was canceled or filled.
- SB-16 Management actions are journalled by deterministic `managementActionId`. An ambiguous partial-close/stop-change result MUST NOT be blindly repeated.
- SB-17 For an ambiguous full-close-by-position-ID request, Zugrio first re-queries broker position existence; if the position no longer exists the close is treated as completed, otherwise the emergency close may be retried only under the broker policy's idempotency/reconciliation rule.
- SB-18 A duplicated partial close, duplicated stop change or protection command is a critical broker-boundary defect even when it reduces risk.

### 10.11 Order classification

- OC-1 RISK_INCREASING: opens, adds, reverses direction, widens stop or otherwise increases maximum loss/exposure.
- OC-2 RISK_REDUCING: strictly and monotonically decreases maximum loss on an existing position, with no new exposure and no direction change.
- OC-3 Classification is computed from economic effect, never label/caller.
- OC-4 Misclassification is a critical defect class.

---
## 11. Authority modes by state

| State | Signal | Semi-Auto | Auto | Full Auto |
|---|---|---|---|---|
| STRUCTURAL_CANDIDATE / STRUCTURAL_WATCH | display | display | display | display |
| STRUCTURAL_READY | full plan, NOT MODEL-SCORED | same, non-executable | same, non-executable | same, non-executable |
| CONVICTION_UNAVAILABLE | diagnostic only | diagnostic only | diagnostic only | diagnostic only |
| MODEL_EVALUATED_NO_SIGNAL | diagnostic only | diagnostic only | diagnostic only | diagnostic only |
| WATCH | display | display | display | display |
| READY | display, alert | alert, stage intent | alert, stage intent | alert, stage intent |
| FIRE (live event) | alert only | explicit approval within freshness window | execute within mandate | unavailable until portfolio construction is validated |

- M-1 Mode expresses user preference, never permission.
- M-2 Risk-increasing permission requires the applicable provenance verdicts, valid state/event, immutable construction inputs, Layer 4B ALLOW and broker-boundary safety.
- M-3 Full Auto remains unavailable until portfolio construction exists and is separately validated.
- M-4 Mode change disarms risk-increasing automation unconditionally.
- M-5 No mode alters Layer-4 or broker-boundary safety.
- M-6 RISK_REDUCING management remains available in every mode/degraded state when broker transport integrity/reachability permit; otherwise `MANUAL_EXIT_REQUIRED` is surfaced immediately.
- M-7 Semi-Auto approval after FIRE expiry triggers re-evaluation, not revival.

---
## 12. Continuation route **[RC6]**

Authority is OBSERVE. At OBSERVE it affects nothing in production. `continuationReferenceEnabled` defaults false; null resolves to default; explicit `'true'` enables research capture only. Never promoted in setup priority. The geometry gate exists in the research path as named predicates and does not enter the production candidate contract.

- CR-1 **[RC6]** Promotion to candidate generation requires a new **PROPOSE** authority, not FILTER. FILTER means the right to filter existing production decisions; originating a production candidate is a distinct and greater authority and must not borrow FILTER semantics. The module ladder becomes OBSERVE → EXPLAIN → SHADOW → PROPOSE → FILTER → SIZE → TRIGGER → EXECUTE.
- CR-2 Promotion to PROPOSE requires completion of **Gate 6 research/promotion evidence and the corresponding §17 Gate 6 tests** for the exact strategy, market and horizon scope, followed by a new locked decision. **[ERRATA-1]**

**Route study corrections** — gated and ungated variants recorded separately; pre-fill intrabar movement excluded for limit routes; out-of-range net values null; censoring reported explicitly; spread and gap-through modelled; PASS instrumented; horizon scaled by timeframe; comparison per opportunity with unfilled at zero, in R per the route's own stop, net of costs.

---

## 13. ATR estimator contract

Wilder ATR, declared period, declared and measured warm-up window W. Evaluation uses exactly the canonical last W closed bars with identical seeding on every call. Below W, ATR is unavailable and every ATR-denominated decision fails closed. Same absolute closed bar plus the same preceding W bars yields bit-identical ATR regardless of older history. Live and replay call the same contract; caching only where provably identical to canonical recomputation. One estimator serves CORE, APA and the profile engine. W is accepted only against both a deviation tolerance versus a long reference history and a decision-flip sensitivity test at every ATR-denominated threshold (1.10 range, 0.08 penetration, 0.80 extension, 0.15 stop buffer, 0.35 minimum stop). Once frozen, the bounded estimator **is** the canonical Zugrio ATR.

---

## 14. Decomposition

**14A — assessTrigger** — map every consumer first: FIRE and state progression, entry grading, opportunity score, watchlist ordering, trade-plan presentation, research logging, any broker or execution gate. Classify every term as HARD_STRUCTURAL_PREDICATE, RAW_MODEL_FEATURE, RESEARCH_HEURISTIC or LEGACY_REMOVE. No unnamed weighted scalar survives because a consumer depends on it. `breakAndGoFresh: 0.70` is removed. Behaviour delta measured against a frozen fixture set and disclosed.

**14B — State-Policy Decomposition** — every input to any conviction state is classified under the same scheme, whatever its field name. `pWin` and `EV` are the only continuous quantities permitted to gate state. Every other input becomes a named Layer 1 boolean, a capital feature, an advisory feature, a research heuristic without capital authority, or is removed. Ambiguity resolves toward the feature vector, never toward state authority.

**14C — Hard-predicate admissibility test**

> **A boolean is not a hard predicate merely because it is boolean. Classification depends on the semantic source of its threshold and the authority it exercises.**

- HP-1 Its failure must mean structural invalidity, data invalidity, execution infeasibility or safety violation **independently of profitability**.
- HP-2 Its threshold must not have been chosen by optimizing outcomes. If historical P/L, win rate or expectancy set the value, it belongs downstream.
- HP-3 Every predicate records threshold provenance in `predicateClassifications`.
- HP-4 Presumed to pass: `DATA_HEALTH_OK`, `GEOMETRY_COMPLETE`.
- HP-5 Presumed model features until proven otherwise: `REGIME_QUALITY_OK`, `HTF_GRADE_NOT_C`, `REWARD_GRADE_NOT_C`, `TRIGGER_GRADE_NOT_C`.
- HP-6 Failing HP-1 or HP-2 moves the field downstream. No partial credit.

---

## 15. Lineage and evidence

v4.6.1 (Engine 4.6.1, GATE2-D relative-dominance trend fix) and Zugrio 5.15/5.16 (`seqTrendAt`) are materially divergent lineages. The 26,258-row baseline is evidence for the v4.6.1 detector only. No calibrated, defect-clearance, directional-bias or performance claim crosses that boundary without rerunning against the Zugrio implementation.

Every result binds to artifact hash, strategy version, data period, cost model and decision semantics. No blending across TTI 5.11, 5.15, 5.16 Foundation, v4.6.1 and Zugrio 1.0 Research. Pre-v4.6 numbers remain void; never cite them as Zugrio evidence.

`a007b191b68f5016f0e8217a9234062e09d345eae1ff33c41938272807e07a48` remains the immutable historical hash of the superseded 5.16 Foundation artifact.

Results intended to support Zugrio capital authority additionally bind to:
`decisionCoreHash`, `executionSafetyCoreHash`, `brokerAdapterHash`, `capitalFeatureSchemaHash`, `labelSchemaHash`, `targetPolicyHash`, `costModelHash`, `evDefinitionHash`, `statePolicyHash`, `candidateSelectionPolicyHash`, `riskSizingPolicyHash`, `positionManagementPolicyHash`, `brokerExecutionPolicyHash` and `executionAuthorityManifestHash`.

---
## 16. Remediation gates

### Gate 0 — Identity, trust root and record integrity

0.1 Record §15 in brief/manifest and mark v4.6.1 evidence out-of-lineage wherever cited.  
0.2 Back palette-only changes out of Foundation lineage unless explicitly justified.  
0.3 Atomically update artifact, SHA-256, manifest, brief, QA evidence and identity references.  
0.4 Produce standalone canonical `decisionCore` and `executionSafetyCore` artifacts and build the terminal from those exact artifacts; record the broker-adapter artifact hash separately.  
0.5 Fix numeric canonical form, content-address rules, hashing and signatures before dependent work.  
0.6 Provision the cryptographic trust root: algorithm allow-list, pinned keys, rotation/revocation, minimum parameters.  

### Gate 1 — Stop the bleeding

1.1 `continuationReferenceEnabled` defaults false; explicit true enables research capture only.  
1.2 Restore locked setup priority; remove conditional promotion.  
1.3 Remove `breakAndGoFresh:0.70` from production trigger authority.  
1.4 Remove `seed.direct → TRIGGERED`.  
1.5 Unconditional disarm on mode change.  
1.6 Restore Settings/session/theme controls and RESEARCH indicator.  
1.7 Remove continuation route from production candidate contract.  

### Gate 2 — Determinism

Begins once canonical decision core exists.

2.1 Implement bounded ATR; measure W.  
2.2 Unify CORE/APA/profile ATR.  
2.3 History-depth invariance.  
2.4 Replay/live parity against canonical bounded estimator.  

### Gate 3 — Layer separation and state semantics

3.1 §14A consumer map/classification.  
3.2 §14B State-Policy decomposition.  
3.3 §14C hard-predicate test/provenance.  
3.4 Layer 1 emits eligibility verdicts only.  
3.5 Implement lifecycle and unified route semantics.  
3.6 Remove duplicate render overrides and renderer-owned R:R.  
3.7 Split 2A / Layer 3 / 2B.  
3.8 Reclassify `REGIME_QUALITY_OK` or remove it from direct state authority.  
3.9 Implement structural ladder, CONVICTION_UNAVAILABLE and MODEL_EVALUATED_NO_SIGNAL.  
3.10 Split capital/advisory features.  
3.11 Implement State Policy, Candidate Selection Policy and `SELECTION_POLICY_ADMITTED` before selection.  
3.12 Split FrozenTradeGeometry from ExecutionSnapshot.  
3.13 Implement snapshot-bound inference ordering without cycles.  
3.14 Preserve `COUNTERFACTUAL_ELIGIBLE`.  

### Gate 4 — Provenance, entry construction, management, veto and broker boundary

4.1 Inference contract variants and four scoped provenance verdicts.  
4.2 State Policy and Candidate Selection Policy admission.  
4.3 Execution Authority Manifest binding `executionSafetyCoreHash` and `brokerAdapterHash`.  
4.4 Risk/Sizing Policy.  
4.5 Position Management Policy plus built-in Emergency Risk-Reduction Kernel.  
4.6 Broker Execution Policy.  
4.7 Operating envelope/OOD/drift.  
4.8 RiskContextSnapshot and VetoContextSnapshot.  
4.9 Layer 4A entry construction from five immutable inputs.  
4.10 Layer 4M risk-reducing management construction.  
4.11 Layer 4B veto with BLOCK terminal.  
4.12 BrokerSafetySnapshot; abort terminates FIRE.  
4.13 Deterministic post-ALLOW SubmissionEnvelope/clientOrderId and durable reservation/reconciliation.  
4.14 Submission/acknowledgement/fill/protection state machines including PARTIALLY_FILLED and PROTECTION_FAILED.  
4.15 Protection recovery/emergency exit path, including the built-in Emergency Risk-Reduction Kernel.  
4.16 Pending-order expiry/cancellation and unknown-cancel reconciliation.  
4.17 Full Auto remains unavailable.  

### Gate 5 — Research instrumentation

5.1 Correct route study.  
5.2 Complete predeclaration.  
5.3 Append-only hash-chained ledger with monotonic sequence IDs and externally anchored signed checkpoints.  
5.4 Detect truncation/replay, not merely mutation.  

### Gate 5A — Data sufficiency and partition freeze

5A.1 Representative data by market/horizon.  
5A.2 Bid/ask/execution granularity sufficient for declared fill model.  
5A.3 Cost model reconciled against real observations.  
5A.4 Freeze development, validation and final-holdout partitions.  
5A.5 Freeze certification metrics/tolerances/pass-fail rule before holdout access.  
5A.6 Synthetic mechanical tests never marketed as real-market edge evidence.  

### Gate 6 — Research and model development

Development material only; final holdout sealed. Route/stop/feature studies, walk-forward research, stability and selection-bias controls.

### Gate 7 — Model, calibration and frozen policy artifacts

Training/walk-forward/validation only; holdout sealed. Train ensemble; validate discrimination/calibration and EV against canonical-cost-normalised outcomes under the bound `costModelHash`; select State Policy thresholds; freeze State Policy, Candidate Selection Policy, Risk/Sizing Policy, Position Management Policy, Broker Execution Policy, Execution Authority Manifest and all bound hashes.

### Gate 8 — Final certification

Run completely frozen system once on untouched final holdout under the Gate-5A decision rule, then forward shadow/demo. No tuning after viewing results. A spent holdout is permanently spent; changes require a new unseen holdout for recertification.

Promotion beyond OBSERVE requires Gate 6. **Executable capital FIRE requires Gate 8.**

---
## 17. Mandatory tests

No gate clears by review alone.

### Gate 0
- Artifact hashes and provenance resolve.
- Decision core and execution-safety core are byte-reproducible across independent builds.
- Palette-only changes alter fullBuildHash but not decisionCoreHash, executionSafetyCoreHash or brokerAdapterHash.
- An execution-safety-code change alters executionSafetyCoreHash and invalidates EXECUTION_POLICY_ADMITTED without invalidating INFERENCE_ADMITTED.
- A broker-adapter-code change alters brokerAdapterHash and invalidates automated execution admission.
- Canonical serialization matches across independent implementations, including numeric edge cases.
- Content-address IDs reproduce and reject object mutation/type substitution; audit-only wall-clock differences do not alter canonical identity IDs, while semantically authoritative source-time changes do. **[ERRATA-1]**
- Tampered signature algorithm/key ID fails.
- Untrusted, revoked, expired key or disallowed algorithm fails closed.
- Artifact cannot override trust root.
- Admission ledger records the pinned trustRootVersion/hash; unrecognized local trust root locks risk-increasing execution.

### Gate 1
- Fresh null continuation key = disabled production route.
- Explicit true changes research capture only; production candidates/states remain byte-identical.
- Setup priority invariant.
- Mode change disarms.
- Restored UI controls/RESEARCH indicator reachable at target widths.

### Gate 2
- Same bar with surplus lead-in W..W+500 gives bit-identical ATR.
- Below W, ATR-dependent decisions fail with named reason.
- CORE/APA/profile identical bounded ATR.
- Replay/live candidate sequences identical.
- Cache equals canonical recomputation.
- W decision-flip sensitivity below declared tolerance at every ATR-denominated threshold.

### Gate 3
- Layer 1 exposes no continuous conviction score to 2B.
- Every old `assessTrigger`/state-policy consumer migrated/classified.
- No raw regimeConfidence direct path to 2B.
- Every hard predicate has threshold provenance; P/L-derived threshold fails HP classification.
- Every eligible admitted candidate resolves to exactly one of CONVICTION_UNAVAILABLE / MODEL_EVALUATED_NO_SIGNAL / WATCH / READY / FIRE / terminal as appropriate.
- State-policy failure yields CONVICTION_UNAVAILABLE, never MODEL_EVALUATED_NO_SIGNAL.
- Selection-policy failure produces no authoritative active plan while preserving candidate states.
- Lower-priority higher-pWin candidate outranks higher-priority lower-pWin candidate after inference.
- Counterfactual candidates persist.
- FrozenTradeGeometry has no mutable economic fields.
- ExecutionSnapshot has no verdict.
- SNAPSHOT_BOUND graph is acyclic: snapshot exists before inference; FIRE pins the same ID; while READY and no FIRE is live, each required ExecutionSnapshot refresh triggers new bound inference before FIRE; once FIRE is live routine refresh is suspended, and the event terminates only under its own FE-2/FE-6 rules. Stale bound inference cannot FIRE against a refreshed snapshot. **[ERRATA-1][ERRATA-2]**
- Advisory features are structurally unreachable from capital inference.

### Gate 4
- Four provenance scopes fail independently with their specified effects.
- Required/prohibited inference-contract fields enforced per variant.
- decisionCore/capitalFeature/schema/hash mismatches fail appropriate scope.
- Risk/Sizing Policy change fails execution admission only, not inference/state admission.
- Candidate Selection Policy failure blocks selection before selection occurs.
- Layer 4A identical canonical inputs produce identical canonical identity preimages/entryIntentId even if audit-only `constructedAt` differs or live account state changes; conversely, two otherwise identical authority-path snapshots with different authoritative `capturedAt`/`derivedAt` values produce different snapshot IDs. **[ERRATA-1][ERRATA-2]**
- Layer 4M identical canonical inputs produce identical canonical identity preimages/managementIntentId despite audit-only `constructedAt` differences; ManagedPositionSnapshot and ManagementContextSnapshot capture timestamps remain identity-bearing. **[ERRATA-1][ERRATA-2]**
- Layer 4A performs no mutable global reads.
- VetoContext comparison blocks material exposure/equity/risk change and never resizes.
- Broker symbol constraints (tick size, volume step, minimum protection distance and equivalent live constraints) are captured immutably and violations BLOCK.
- Layer 4B never modifies intent; maxPermittedSize has zero consumers.
- BLOCK terminates FIRE; no replacement intent.
- Pinned ExecutionSnapshot used by inference/FIRE/4A/4B exactly as declared.
- ExecutionSnapshot costs resolve to the bound canonical costModelHash; worse account-specific broker costs can only BLOCK at 4B and never raise pWin/EV or rewrite FIRE.
- Stale pinned snapshot terminates event rather than refreshing.
- BrokerSafetySnapshot can abort only; abort terminates FIRE.
- Risk-reducing full close succeeds with stale local price and corrupted/missing local ledger when broker identity/ownership, trusted adapter integrity and reachability can be verified.
- Broker-adapter integrity failure prevents automated command emission and produces `MANUAL_EXIT_REQUIRED` with verified position identity; it never causes a fabricated ALLOW.
- Position without Zugrio ownership tag cannot be commandeered.
- Stop widening / size increase / direction flip classifies RISK_INCREASING.
- Position-management constructor cannot create new exposure.
- Aggregate Execution Authority Manifest failure does not block individually trusted risk-reducing Position Management Policy actions.
- Invalid/missing Position Management Policy permits only Emergency Risk-Reduction Kernel cancellation, non-widening protective-stop recovery under PM-4, or full close; a tighter broker-confirmed stop is never replaced by the looser frozen stop, and no kernel action may increase `maximumLossNow`.
- Reversal requires separate close and new FIRE-authorized opposite entry.
- Duplicate/unknown partial-management actions reconcile by `managementActionId` before repetition.
- clientOrderId deterministic from `(accountId, brokerVenueId, fireEventId, entryIntentId)` and Broker Execution Policy; Layer 4A has no Broker Execution Policy dependency.
- SubmissionEnvelope adverse-execution guard can only tighten execution and is never looser than the already-passed economic safety budget; BrokerSafetySnapshot detects only pre-submission breaches, while realized fill/slippage breaches are detected only by post-fill reconciliation.
- RESERVED durable before network call.
- Dropped acknowledgement produces SUBMISSION_UNKNOWN and no resend.
- Reconciliation survives restart and resolves by declared broker identity.
- REJECTED terminates FIRE.
- PARTIALLY_FILLED follows frozen policy with no implicit top-up.
- Any nonzero unprotected fill enters protection state immediately.
- A pending order cannot remain live beyond its declared authority/expiry window; candidate invalidation triggers cancellation and unknown cancellation outcome locks new entry.
- PROTECTION_FAILED invokes risk-reducing recovery and blocks new exposure until resolved.
- One broker entry effect per `(fireEventId, accountId)` under duplicate/retry/failure injection.
- Multi-account execution of the same FIRE event produces distinct deterministic submission identities without collision.
- Full transition matrix exercised; undeclared transitions rejected.
- Loaded policy/artifact substitution detected.

### Gate 5
- Independent math/reference implementation and independence audit where exact-zero agreement is suspicious.
- Property/metamorphic tests for range/location/mirror/scale/target ordering.
- Route fills only after own gate.
- Limit excursions exclude pre-fill movement.
- Out-of-range outcome values null.
- Ledger chain/sequence/checkpoint detects mutation, truncation and replay.

### Gate 5A
- Coverage and granularity meet predeclared minima.
- Fill/cost reconstruction reconciles with observed executions.
- Partition manifest and certification decision rule sealed before holdout access.
- No synthetic result mislabelled as real-market economic evidence.

### Gate 6
- Walk-forward inside development material only.
- Purge/embargo where labels overlap.
- Full realistic costs.
- Nearby-parameter stability.
- Regime/session/market/year breakdowns.
- Selection-bias controls and all variants disclosed.
- Final holdout demonstrably unopened.

### Gate 7
- MOD-001A discrimination criteria met.
- MOD-001B calibration criteria met.
- EV validated out-of-sample against **execution-normalised realized R under the bound `costModelHash` and `evDefinitionHash`**, using the declared `canonicalInitialRiskAmount` denominator and normalising both account non-slippage cost delta and actual-versus-canonical slippage delta. Raw account net R, `accountCostDeltaR` and `accountSlippageDeltaR` are reported separately. **[ERRATA-1][ERRATA-2]**
- Every [UNSET] capital threshold has a validation artifact.
- All policy/manifests/hashes resolve.
- No conviction without admitted State Policy.
- No authoritative selection without admitted Selection Policy.
- No risk-increasing execution without admitted Execution Policy.
- Holdout remains unopened.

### Gate 8
- Frozen hashes unchanged from Gate 7.- Exactly one final-holdout run, recorded against pre-frozen decision rule.
- Second run structurally refused; holdout marked permanently spent.
- Forward shadow/demo meet predeclared confirmation tolerance.
- Any subsequent change requires a newly unseen certification holdout.

---
## v1.0.2 errata integration note

The v1.0.1 amendments corrected determinism, snapshot-refresh cadence, conformance coverage, protection recovery, protection timing, calibration cost basis and several dangling/ambiguous implementation references. **v1.0.2 narrows those implementation rules without changing architecture:** authority-path observation timestamps remain identity-bearing; construction audit timestamps do not; routine SNAPSHOT_BOUND refresh is suspended during live FIRE; emergency protection recovery cannot widen `maximumLossNow`; pre-submit and post-fill breach detection responsibilities are separated; and EV calibration is normalized for both costs and slippage on a declared canonical R denominator. These amendments do **not** change the frozen authority-layer boundaries, provenance scopes, conviction-state semantics, candidate-selection authority, validation-gate sequence or certification standard.

Gate 0 MUST implement the H-5/H-5A/H-5B identity-preimage rules before any content-address or determinism test is treated as authoritative. Snapshot-bound re-inference cadence is a Gate-3/4 implementation requirement. Protection-pending deadlines, kernel recovery semantics and canonical-cost EV calibration MUST be integrated before Gate 4/Gate 7 respectively can clear.

---
## Architecture freeze declaration

The architecture is frozen because the final convergence audit found no unresolved authority-path contradiction in the normative design. Specifically:

- deterministic eligibility, probabilistic conviction, scoped provenance, selection authority and execution authority are separated;
- snapshot-bound inference is acyclic;
- immutable geometry, market execution economics, account-risk context and last-moment broker safety are distinct objects;
- risk-increasing entry construction has no mutable global reads;
- risk-reducing management has a dedicated path and a minimal emergency fallback;
- broker submission is idempotent/reconcilable and protection state is explicit;
- model, state, selection, sizing, management, broker policy, execution core and broker adapter identities are independently bound;
- research holdout and calibration rules prevent evidence from silently crossing lineages or certification stages.

This freeze covers **architecture only**. The current implementation remains NON-COMPLIANT until the remediation gates clear. Every `[UNSET]` value remains non-authoritative until validated. No profitability or calibration claim is created by this freeze.

---
## Governing rule

Formula correctness ≠ causal correctness ≠ statistical validity ≠ economic edge.

Where this specification and implementation disagree, implementation is non-compliant. The specification is never silently bent around existing code. A rule changes only by a new recorded decision with rationale and version history.

Formal compliance is not enough if authority leaks survive under renamed fields. §§14A–14C therefore govern semantics, not labels. Cryptographic identity is not trust unless rooted out of band. Broker acknowledgement is not protection. A model-approved opportunity is not a broker-authorized order. A broker-authorized order is not a safely protected position until protection is confirmed.

---