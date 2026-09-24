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

May reference research datasets, replay/out-of-sample evidence, forward observation, cost/slippage/fill models, TradeBundle identity, RegimeModel/TimeframeMap identity, robustness artifacts, case counts, exclusions and evidence-policy version.

### StrategyAdmissionRecord
Auditable record stating what operational use, if any, an exact MethodProfile + TradeBundle version is admitted for in an exact scope.

Admission scope can bind market/instrument/venue, horizon/session, RegimeModel/version/state, TimeframeMap, BrokerOrderRoute and control mode.

Representation/evaluatability does not create admission.

### StrategyHealthAssessment
Versioned analytical assessment of current evidence for an exact MethodProfile + TradeBundle + scope.

V1 health is primarily bundle-level. Component-level statements require the rest of the bundle to be held fixed or another predeclared valid comparative design.

It remains separate from trader process adherence, execution adherence and financial outcome.

### DeclaredTradePlan
User-authored plan that may define conditions, levels, invalidation, risk, horizon and expiry without claiming that Zugrio independently validates the trading thesis.

### RegimeModelDefinition
Immutable/versioned point-in-time market-state classifier.

Key identity: `RegimeModelId + version`.

Defines:
- applicable market/instrument scope;
- input features and source timeframes;
- state taxonomy;
- point-in-time labeling semantics;
- freshness;
- transition/uncertain behaviour.

Historical evaluation must use labels that were knowable at the historical point in time.

### TimeframeMapDefinition
Immutable/versioned mapping from strategy-component roles to the timeframe(s) they consume.

Key identity: `TimeframeMapId + version`.

Examples of roles:
- higher-timeframe context/bias;
- setup formation;
- location construction;
- entry trigger;
- management observation.

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

### BrokerOrderRouteDefinition
Immutable/versioned order-expression contract.

Key identity: `BrokerOrderRouteId + version`.

Defines how an already-valid intent is expressed to the broker, including market/limit/stop/prepared Semi-Auto routes and applicable fill/cost assumptions.

Order route is part of TradeBundle evidence/admission because route choice changes realized fills and economics.

### ProtectionModelDefinition
Immutable/versioned thesis/risk-boundary contract.

Key identity: `ProtectionModelId + version`.

ProtectionModel owns the protective stop. Exit-management logic may request a tightening through the governed protection-change path, but cannot widen protection.

Stop widening is a risk-increasing action and is not ordinary exit management.

### ExitManagementModelDefinition
Immutable/versioned post-entry profit-taking/management contract.

Key identity: `ExitManagementModelId + version`.

May define target logic, partial scale-out, break-even/trailing requests through ProtectionModel, time/session exits or other admitted management rules.

The exit-management version is frozen with the TradeBundle at entry and is not swapped merely because regime classification changes.

### TradeBundleDefinition
Immutable/versioned atomic strategy-expression bundle.

Key identity: `TradeBundleId + version`.

Binds:
- SetupModel;
- LocationModel;
- EntryModel;
- BrokerOrderRoute;
- ProtectionModel;
- ExitManagementModel;
- TimeframeMap;
- RegimeModel or explicit regime-agnostic status;
- market/instrument/venue/horizon/session scope;
- context requirements;
- cost/slippage/fill assumptions.

TradeBundle is the primary unit of evidence and admission. Materially changing any component creates a new bundle/evidence identity.

### StrategyComponentPolicy
**Later-gated** immutable/versioned policy selecting among whole pre-defined TradeBundles already permitted by the exact MethodProfile version.

Key identity: `StrategyComponentPolicyId + version`.

It is not part of the V1 execution path.

It cannot select entry/protection/exit components independently, silently switch strategy families, or add a non-permitted bundle.

## 6. Opportunity and decision domain

### Candidate
A structurally legitimate opportunity instance with causal identity.

### DecisionCase
Stable product-level lifecycle wrapper around a candidate/decision.

Key identity: `DecisionCaseId`.

A Decision Case is the user/audit/journal continuity object; it references rather than replaces the frozen authority identities.

It must be able to preserve, where applicable:
- MethodProfile/version;
- StrategyAdmissionRecord;
- TradeBundle/version;
- SetupModel/version;
- LocationModel/version;
- EntryModel/version;
- BrokerOrderRoute/version;
- ProtectionModel/version;
- ExitManagementModel/version;
- TimeframeMap/version;
- point-in-time RegimeModel/version + state;
- market/instrument/venue/horizon/session;
- risk/authority/broker snapshots and subsequent adherence/outcome records.

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
trade bundle
regime/timeframe map
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
              │      ├── TradeBundleDefinition
              │      │      ├── SetupModelDefinition
              │      │      ├── LocationModelDefinition
              │      │      ├── EntryModelDefinition
              │      │      ├── BrokerOrderRouteDefinition
              │      │      ├── ProtectionModelDefinition
              │      │      ├── ExitManagementModelDefinition
              │      │      ├── TimeframeMapDefinition
              │      │      └── RegimeModelDefinition
              │      ├── StrategyEvidenceBundle
              │      ├── StrategyAdmissionRecord
              │      └── StrategyHealthAssessment
              │
              └── DecisionCase
                     ├── CanonicalInstrument
                     ├── MethodProfile / StrategyAdmission reference
                     ├── TradeBundle + component-version references
                     ├── point-in-time RegimeModel/state + TimeframeMap
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
- separately admitted components into an untested combined TradeBundle;
- point-in-time regime state into retrospectively relabeled regime state;
- strategy health into trade outcome;
- behaviour observation into inferred emotion;
- advisory guardrail into broker execution authority;
- behavioural guardrail into a blocker of governed risk-reducing action.
