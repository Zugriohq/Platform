# Zugrio 1.0 Domain Model

Status: foundation domain map. This document defines identity and ownership boundaries; it does not prescribe final database tables.

## 1. Domain rule

Prefer explicit identities and references over ambiguous strings or mutable global state.

Every capital-relevant record must be reconstructable from stable IDs, versions and timestamps.

## 2. Account and commercial domain

### User
Human identity.

Key identity: `UserId`.

### Workspace
Tenant/security boundary.

Key identity: `WorkspaceId`.

Initial V1 can expose primarily individual workspaces while preserving the boundary required for future team/allocator products.

### Subscription
Commercial relationship.

Key identity: `SubscriptionId`.

### EntitlementSet
Commercially available product capabilities at a point in time.

Examples:
- Signal available;
- Semi-Auto available;
- Auto available;
- Full Auto unavailable/available;
- specific market/feed features.

Entitlement is **not** trading authority.

### DeviceSession
Authenticated web/desktop/mobile session.

Key identity: `DeviceSessionId`.

## 3. Market identity domain

### CanonicalInstrument
Stable Zugrio identity for the instrument/product concept.

Key identity: `CanonicalInstrumentId`.

### ProductVenueBinding
Maps a canonical instrument/product to a broker/venue symbol and execution metadata.

Key identity: `ProductVenueBindingId`.

### MarketFamilyDefinition
Versioned definition used for specialist feature/model routing.

Key identity: `MarketFamilyDefinitionId + version`.

### MarketDataSource
Identifies the source and normalization contract for observed market data.

### ContextSource
Identifies source/provider for macro/news/session/related-market context.

## 4. Intelligence/model domain

### ModelArtifact
Immutable inference artifact.

Key identity: `ModelArtifactId` + content hash/version.

### ModelApplicabilityManifest
Defines where an artifact is admitted to operate.

References:
- price-origin classes;
- market families;
- product types;
- instruments;
- venues if relevant;
- horizons/timeframes;
- regimes;
- feature schema;
- label/outcome/censoring/cost/calibration identities.

### FeatureSnapshot
Immutable feature values bound to explicit source events/data.

### InferenceRecord
Exact model inference result and provenance.

An inference cannot exist as capital-authoritative outside an admitted applicability scope.

## 5. Method domain

### MethodProfile
Immutable/versioned strategy/method definition.

Key identity: `MethodProfileId + version`.

A MethodProfile also declares source/provenance class (for example Zugrio first-party, Zugrio-supported external, user-defined structured) without implying admission.

### StrategyEvidenceBundle
Immutable/versioned evidence package used to assess a specific MethodProfile version within an explicit market/product/instrument/horizon scope.

May reference research datasets, replay/out-of-sample evidence, forward observation, cost/slippage models, robustness artifacts, case counts, exclusions and evidence-policy version.

### StrategyAdmissionRecord
Auditable record stating what operational use, if any, an exact MethodProfile version is admitted for in an exact scope.

Representation/evaluatability does not create admission.

### StrategyHealthAssessment
Versioned analytical assessment of current evidence for an exact strategy version/scope.

It remains separate from trader process adherence, execution adherence and financial outcome.

### DeclaredTradePlan
User-authored plan that may define conditions, levels, invalidation, risk, horizon and expiry without claiming that Zugrio independently validates the trading thesis.

### SetupModelDefinition
Immutable/versioned opportunity-pattern/state contract.

Key identity: `SetupModelId + version`.

Defines formation, qualification, invalidation, expiry and supported scope. It does not itself authorize entry.

### LocationModelDefinition
Immutable/versioned price-location/reference contract.

Key identity: `LocationModelId + version`.

Examples include structural levels, range/equilibrium boundaries, retracement/Fibonacci bands, imbalance/FVG zones, order-block/supply-demand zones and admitted volatility/moving references.

A LocationModel is evidence/geometry, not a standalone signal.

### EntryModelDefinition
Immutable/versioned entry-condition contract.

Key identity: `EntryModelId + version`.

Defines what state/trigger must occur before an otherwise valid setup becomes actionable. It does not own broker or capital authority.

### ProtectionModelDefinition
Immutable/versioned initial thesis/risk-boundary contract.

Key identity: `ProtectionModelId + version`.

Defines structural/volatility/failsafe protection semantics. Protection remains subordinate to the governing risk/safety architecture.

### ExitManagementModelDefinition
Immutable/versioned post-entry management/exit contract.

Key identity: `ExitManagementModelId + version`.

May define target logic, partial scale-out, break-even transitions, trailing logic, time/session exits or other admitted management rules. It cannot widen the original risk authority.

### StrategyComponentPolicy
Immutable/versioned policy selecting among components already permitted by the exact MethodProfile version.

Key identity: `StrategyComponentPolicyId + version`.

Inputs may include market/instrument/horizon, regime/context and evidence/admission state. Output may include a permitted component bundle or PASS.

It cannot silently switch strategy families or add a non-permitted component.

A Method Profile references its allowed component definitions and component-selection policy; none of those components owns capital authority.

## 6. Opportunity and decision domain

### Candidate
A structurally legitimate opportunity instance with causal identity.

### DecisionCase
Stable product-level lifecycle wrapper around a candidate/decision.

Key identity: `DecisionCaseId`.

A Decision Case is the user/audit/journal continuity object; it references rather than replaces the frozen authority identities.

### EvidenceReference
Reference to market/feature/structure evidence attached to a Decision Case.

### ContextFact
Normalized sourced context evidence.

### StateDecision
Frozen-authority state output.

### SelectionDecision
Records which candidate/plan was selected and why.

### FrozenTradeGeometry
Lifecycle-confirmed geometry as defined by the frozen authority architecture.

### ExecutionSnapshot
Current executable conditions used for fresh economics.

### FireEvent
Executable decision event as defined by the authority architecture.

## 7. Risk and authority domain

### TradingAccount
Canonical customer trading account independent of client device.

Key identity: `TradingAccountId`.

### ExecutionAuthorityManifest
Explicit account-bound delegation envelope.

References:
- workspace/user;
- trading account;
- allowed control mode;
- allowed instruments/products;
- method profiles;
- risk policy;
- effective times;
- revocation state.

### RiskContextSnapshot
Immutable account/risk context used by the capital path.

### VetoContextSnapshot
Final material-change/safety snapshot before release.

### PositionManagementPolicy
Versioned policy governing management after entry.

## 8. Broker/execution domain

### BrokerConnection
Authorized relationship with a broker/platform.

Key identity: `BrokerConnectionId`.

### EntryIntent
Broker-neutral order intent.

### SubmissionEnvelope
Account/venue-bound, idempotent submission object.

### BrokerOrder
Broker-reported order identity/state.

### Fill
Actual broker execution event.

### Position
Reconciled broker position representation.

### ProtectionState
Verified stop/protection state.

## 9. Outcome and learning domain

### OutcomeRecord
Financial/market outcome of the decision/position.

### ProcessAdherenceRecord
Separate evaluation of whether declared method/risk/authority process was followed.

### ExecutionAdherenceRecord
Separate evaluation of whether actual broker/user execution matched the planned or approved action within known execution realities.

### BehaviourObservation
Derived projection from the authoritative ProcessAdherenceRecord and/or ExecutionAdherenceRecord plus their underlying event references.

A BehaviourObservation may describe a deviation such as early entry, off-zone entry, changed risk or manual override. It does not establish an internal emotion and does not own an independent competing compliance verdict.

### BehaviourPatternAssessment
Cross-case assessment referencing observation definition/version, supporting cases, scope, period and matching uncertainty.

### GuardrailPolicy
Versioned user/account-scoped policy describing advisory, confirmation or (where separately admitted) enforcing behaviour for a deterministic condition.

A GuardrailPolicy must declare its action class/effect scope. Enforcing policy may narrow **new risk-increasing action** only.

Guardrail policy is not broker authority by itself and cannot block a governed risk-reducing action.

### GuardrailEvent
Durable record of guardrail presentation, acknowledgement, trigger and any eventual enforcement outcome.

If a guardrail bypass also overrides a system recommendation, prepared action or governed system action, the GuardrailEvent references the corresponding OverrideRecord.

### OverrideRecord
Append-only record of user/manual deviation from system recommendation or prepared action.

Strategy health, process adherence, execution adherence and outcome do not overwrite one another. Override does not overwrite original system state. Behaviour observations/patterns do not rewrite the underlying broker or Decision Case events.

## 10. Capability scope

Support must not be represented by a single global “enabled” flag.

Define a versioned `CapabilityScopeManifest` that can answer whether a capability is available for a combination such as:

```text
market / product
canonical instrument
broker / venue
data source
method profile
strategy admission
model applicability
control mode
guardrail capability/policy status
account type
client surface
release channel
```

Representative states:

- `ARCHITECTURE_ONLY`
- `RESEARCH_ONLY`
- `VALIDATION_PENDING`
- `EARLY_ACCESS`
- `RELEASED_SIGNAL`
- `RELEASED_SEMI_AUTO`
- `RELEASED_AUTO`
- `LOCKED_FULL_AUTO`
- `SUSPENDED`

The exact enum may evolve, but capability must remain scope-specific and auditable.

This prevents, for example:
- cTrader Auto clearance on EURUSD from silently enabling MT5 Auto on XAUUSD;
- a Synthetic family calibration from being treated as Gold calibration;
- a subscription tier from implying that a market/broker integration is technically released.

## 11. Identity/time/version rules

Capital- and audit-relevant entities should carry:
- stable domain ID;
- schema version;
- created/effective timestamps;
- explicit source/event time where applicable;
- governing artifact/policy versions;
- content hash where immutable identity requires it.

Wall-clock creation timestamps must not be confused with market event time or freshness time.

## 12. Relationship sketch

```text
User ── Workspace ── Subscription ── EntitlementSet
              │
              ├── DeviceSession
              ├── BrokerConnection ── TradingAccount ── ExecutionAuthorityManifest
              ├── MethodProfile
              │      ├── StrategyEvidenceBundle
              │      ├── StrategyAdmissionRecord
              │      └── StrategyHealthAssessment
              │
              └── DecisionCase
                     ├── CanonicalInstrument
                     ├── MethodProfile / StrategyAdmission reference
                     ├── DeclaredTradePlan
                     ├── Candidate
                     ├── Evidence / ContextFact
                     ├── ModelApplicabilityManifest → InferenceRecord
                     ├── State / Selection / Geometry / ExecutionSnapshot
                     ├── RiskContext / FireEvent / EntryIntent
                     ├── BrokerOrder / Fill / Position / Protection
                     ├── Outcome / ProcessAdherence / ExecutionAdherence / Override
                     └── BehaviourObservation / GuardrailEvent
```

## 13. Database implementation rule

PostgreSQL schemas/tables may combine or split these concepts for operational efficiency, but code must preserve the domain distinctions.

Do not let ORM convenience collapse:
- entitlement into execution authority;
- broker symbol into canonical instrument;
- current state into historical decision record;
- outcome into process quality;
- market family into asset class;
- feature similarity into model applicability;
- strategy representation into strategy admission;
- strategy health into trade outcome;
- behaviour observation into inferred emotion;
- advisory guardrail into broker execution authority;
- behavioural guardrail into a blocker of governed risk-reducing action.
