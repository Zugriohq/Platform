# Zugrio 1.0 System Architecture

Status: **foundation architecture proposal** for Engineering Foundation review.

This document tightens the production-era architecture around the already frozen Zugrio Signal Authority Architecture. It does **not** replace or silently modify the frozen authority semantics. Where this document and a cleared/frozen authority specification conflict, the frozen authority specification wins until an explicit ADR and new evidence supersede it.

## 1. Architectural thesis

Zugrio must not treat trading as a generic chart-pattern problem.

A production decision should be formed through a chain that preserves:

1. what price/instrument/product is being observed;
2. what type of price-generating/trading mechanism is relevant;
3. what market/behavioural family the instrument belongs to for the current model;
4. what instrument-, venue-, horizon- and regime-specific calibration is admitted;
5. what strategy/method is being applied;
6. what current market and context evidence exists;
7. what entry model currently qualifies;
8. what the frozen decision-authority pipeline permits;
9. what account/risk authority permits;
10. what the broker actually accepted/executed;
11. what was known and why at each point in time.

Core rule:

> **Do not generalise from appearance alone.**

Two charts may look similar while the processes, products, costs, calibration and executable risks behind them are different.

## 2. Production architecture

```text
                         ┌──────────────────────────────┐
                         │ Canonical Instrument Registry│
                         │ identity / product / venue   │
                         │ price-origin / market family │
                         └──────────────┬───────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             │                          │                          │
             ▼                          ▼                          ▼
   Market Data Adapters       Context Evidence Adapters     Account/Broker Facts
   price/volume/spread        macro/news/session/etc.       equity/margin/rules
             │                          │                          │
             └──────────────┬───────────┘                          │
                            ▼                                      │
                  Evidence Normalisation                            │
                  provenance/freshness                              │
                            │                                      │
                            ▼                                      │
                 Market Intelligence Router                         │
             applicability + specialist pipeline                    │
                            │                                      │
             ┌──────────────┴──────────────┐                       │
             ▼                             ▼                       │
      deterministic features       admitted inference              │
      structure/regime/etc.        family/instrument scoped         │
             │                             │                       │
             └──────────────┬──────────────┘                       │
                            ▼                                      │
                 Strategy / Method Profile                          │
                 + Entry Model Contracts                            │
                            │                                      │
                            ▼                                      │
                 Candidate / Evidence Contract                      │
                            │                                      │
                            ▼                                      │
             FROZEN SIGNAL AUTHORITY ARCHITECTURE                    │
     state policy → selection → execution-policy admission           │
                            │                                      │
                            ▼                                      │
                      Risk Authority ◄───────────────────────────────┘
                            │
                            ▼
                 Entry Intent / Veto / Safety
                            │
                            ▼
                    Broker Adapter Layer
                            │
                            ▼
                  Reconciliation / Protection
                            │
                            ▼
                    Decision Case Ledger
             reason / changes / overrides / outcome
```

The production shell is a **modular monolith first**. These are enforceable package/module boundaries, not a mandate for microservices.

## 2A. Identity, workspace, entitlement and client surfaces

Zugrio is one product identity across public web, authenticated web, desktop and mobile surfaces.

Target product flow:

```text
Public landing / waitlist
        ↓
Invitation / signup / login
        ↓
Subscription / entitlement
        ↓
Authenticated workspace
        ├── web account/billing/connections
        ├── desktop trading workspace
        └── mobile monitoring/approval/control
```

Waitlist membership is not an account and must not silently create broker/trading authority.

### Core commercial/account entities

- `UserId` — human identity.
- `WorkspaceId` — tenant boundary. Initial users may each have an individual workspace; the boundary preserves a future path to teams without making team administration a V1 requirement.
- `SubscriptionId` — commercial subscription relationship.
- `EntitlementSet` — features/modes the subscription is allowed to access.
- `DeviceSessionId` — authenticated web/desktop/mobile session.
- `BrokerConnectionId` — authorized connection to a broker/platform.
- `TradingAccountId` — canonical customer trading-account identity.
- `ExecutionAuthorityManifestId` — actual trading permission envelope.

### Entitlement is not execution authority

Commercial entitlement and capital authority are separate.

A subscription may entitle a user to Semi-Auto or Auto capability, but it must never by itself create permission to trade. Actual execution still requires a valid account-bound Execution Authority Manifest plus all normal risk/state/veto/broker requirements.

Likewise, loss/expiry of commercial entitlement must not disable safety-critical risk reduction for already-open exposure where the frozen architecture permits emergency reduction.

### Authentication

- one user identity across web, desktop and mobile;
- short-lived access credentials with revocable refresh/session state;
- server-authoritative subscription and entitlement checks;
- no broker secrets stored in client bundles;
- device/session revocation support;
- privileged/admin actions separately authorized and audited.

The identity implementation/provider may change without changing Zugrio domain semantics.

### Client responsibilities

**Public/authenticated web**
- marketing and waitlist;
- signup/login;
- account/subscription/billing;
- broker connections;
- settings/method configuration;
- download/release access;
- journal/report access.

**Desktop**
- full trading workspace;
- chart/market intelligence;
- decision inspection;
- broker/connector status;
- execution controls according to entitlement + authority;
- local MT5 integration where applicable.

**Mobile**
- authenticated monitoring;
- alerts/watchlists;
- decision review;
- Semi-Auto approvals where safe/current;
- positions/account status;
- automation authority controls and emergency controls according to policy.

Mobile is a first-class authenticated surface even if its implementation is staged after other V1 clients.

### Release/download integrity

Desktop distributions must be versioned and integrity-verifiable. Authenticated download entitlement must not be confused with trust in an arbitrary binary. Release metadata should support signed/hash-verified artifacts and update/rollback policy.

## 3. Market identity is multidimensional

Do not use “asset class” as a substitute for model scope.

A canonical instrument record should separate at least:

- `canonicalInstrumentId`
- underlying / reference asset, where applicable
- asset class / broad market class
- executable product type
- venue/broker
- venue symbol
- price origin / formation class
- market/behavioural family
- quote/base/currency conventions where applicable
- trading calendar/session characteristics
- contract size / tick / pip / precision metadata
- cost model reference
- supported data feeds
- allowed execution adapters

### Price origin / formation class

Initial broad distinction:

- `EXTERNAL_MARKET` — price ultimately derives from an external traded market or reference market.
- `SYNTHETIC_GENERATOR` — price is produced by a designed synthetic generator.

This field does not claim Zugrio knows the complete causal explanation of every real-market move. It prevents a generated synthetic series from being treated as if it necessarily represented real-market order flow.

### Market family

`marketFamily` is a **model-routing and validation concept**, not simply an asset class.

Legacy lineages include families such as event-hazard, distribution, range-break, drift-switch, volatility and real-market structure. Those historical families are evidence/starting hypotheses; they are not automatically production-admitted merely because prototype code contained them.

Production family definitions must be:
- versioned;
- explicitly documented;
- tied to feature/model applicability;
- separately validated;
- capable of being superseded without changing instrument identity.

## 4. Specialist intelligence and model applicability

Zugrio should be **mechanism-aware, family-specialised, instrument-calibrated and regime-adaptive**.

This does not mean every instrument needs a completely independent model. It means transfer is never assumed merely because instruments look similar.

Each admitted model requires an immutable `ModelApplicabilityManifest` containing, at minimum:

```text
modelId
modelVersion
modelArtifactHash
featureSchemaId
priceOriginClasses[]
marketFamilies[]
productTypes[]
canonicalInstrumentIds[] | explicit family-wide scope
venues[] | venue-neutral declaration
timeframes[]
horizons[]
supportedRegimes[]
labelDefinitionId
outcomeDefinitionId
censoringPolicyId
costModelIds[]
calibrationArtifactId
trainingDatasetId
decisionCoreVersion
exclusions[]
admissionStatus
validFrom / validUntil
```

Rules:

- No manifest match means **no admitted inference** for that scope.
- Family-wide admission must be earned with family-level evidence; it is not the default.
- Instrument-specific calibration can narrow a broader family model.
- Venue/product execution differences can invalidate otherwise valid analytical inference for execution.
- Reusing a feature is not the same as reusing a probability/calibration model.
- Similar discontinuities across Synthetic Jump, Gold or crypto do not justify probability transfer without evidence.
- Research models remain physically separated from capital-authoritative model admission.

The router chooses the applicable feature/model pipeline from registry metadata and admitted manifests. Production routing must not depend on fragile symbol-name regexes as the source of truth.

Instrument, market-family, model-applicability and capability registries are themselves governed/versioned control-plane artifacts. A mutable database edit must not silently change which model may control capital. Material registry changes require an auditable version/effective time and should be reproducible from repository/configuration artifacts.

## 5. Market data and context evidence are separate domains

### Market Data

Market Data contains observable market/venue data such as:
- OHLC/ticks;
- spread;
- quote timestamps;
- volume or pressure data where valid;
- venue trading status;
- executable quotes where required.

Analytical price and executable price remain distinct.

### Context Evidence

Context Evidence includes sourced information that is relevant to a decision but is not itself the market-price feed:

- scheduled macroeconomic events;
- economic-calendar releases and actual/forecast/previous values;
- market-moving news;
- session and session-transition state;
- geography / market-centre relevance;
- holidays/closures where relevant;
- cross-market/related-market facts;
- venue/product condition changes.

Every normalised `ContextFact` should carry:

```text
contextFactId
sourceId
sourceType
sourcePayloadHash
normalisationVersion
eventType
observedAt
eventTime / effectiveFrom / effectiveUntil
affectedScope
freshnessPolicyId
provenanceStatus
payload / typed fields
```

A context provider does not gain capital authority merely by being connected. Context may influence capital only through an explicitly versioned feature, model or deterministic policy whose provenance is admitted by the frozen authority architecture.

No unsourced LLM-generated narrative may become capital-authoritative context.

## 6. Strategy / Method Profile

Zugrio must not assume one universal trading method.

A versioned immutable `MethodProfile` defines the selected strategy:

```text
methodProfileId
methodVersion
name
owner/scope
market/product applicability
instrument/venue scope
horizon
timeframeMapId
regimeModelId
tradeBundleIds[]
requiredEvidenceContracts[]
contextRequirements[]
riskPolicyRefs[]
executionModePermissions[]
createdAt
supersedes
```

A decision always references the exact strategy version that governed it.

Changing the strategy creates a new version; historical Decision Cases are not rewritten.

A MethodProfile cannot widen model applicability, TradeBundle admission or capital authority.

### 6.1 Trade Bundle is atomic

A versioned `TradeBundleDefinition` binds setup, location, entry, broker order route, protection, exit/management, timeframe map and regime model into one evidence/admission identity.

Entry and exit are not selected independently.

If any material component changes, the bundle version/evidence identity changes.

V1 uses one fixed Core TradeBundle per admitted market-family/instrument scope.

### 6.2 Setup, location and entry

`SetupModel` defines the opportunity state.

`LocationModel` defines the relevant price area/reference. Fibonacci/retracement is a location/measurement component, not a strategy or standalone signal.

`EntryModel` defines what must happen before the setup becomes actionable.

A setup can exist without an entry.

### 6.3 Broker order route

`BrokerOrderRouteDefinition` defines how an already-valid intent is expressed to the broker.

The route is part of TradeBundle evidence/admission because market, limit and stop routes have different fill/non-fill/adverse-selection/slippage behavior.

Research may not assume theoretical zone touch equals live fill.

### 6.4 Protection and exit/management

`ProtectionModel` owns the protective stop / thesis risk boundary.

`ExitManagementModel` owns profit-taking and post-entry management.

ExitManagement may request **tightening only** through the governed protection-change path. It cannot widen the protective stop.

Stop widening is a risk-increasing action and V1 does not authorize automatic widening.

The frozen TradeBundle remains the governing plan after entry. A new regime label does not cause Zugrio to swap exit models mid-trade.

### 6.5 Multi-timeframe binding

A versioned `TimeframeMapDefinition` binds component roles to timeframe(s), such as:
- higher-timeframe context/bias;
- setup formation;
- location construction;
- entry trigger;
- management observation.

Evaluation/replay uses only information available at the relevant historical point in time on each timeframe.

### 6.6 Regime model

A versioned `RegimeModelDefinition` declares state taxonomy and point-in-time classification semantics.

Research must not label historical regimes using future information.

Unless an exact bundle is explicitly admitted for transition/uncertain state, `TRANSITION/UNCERTAIN` means PASS / no new risk.

### 6.7 Future StrategyComponentPolicy

A future `StrategyComponentPolicy` may select among **whole, pre-defined TradeBundles** already permitted by the selected strategy.

It is V1-LG/later and not on the V1 execution path.

Promotion requires a separate research policy for evidence pooling, nested out-of-sample/walk-forward selection, multiple-testing/false-discovery control, policy freeze and forward/shadow validation.

It may return PASS.

A user-selected strategy cannot silently switch to another strategy family.

### 6.8 Multi-strategy account boundary

Before automated multi-strategy portfolio aggregation exists, one active Zugrio strategy may own a given account + symbol for capital action at a time.

Semi-Auto must surface same-symbol strategy conflicts before approval.

Later automated multi-strategy execution requires explicit netting/hedging-aware exposure aggregation and attribution.

Detailed taxonomy: `docs/product/STRATEGY_EXECUTION_COMPONENT_TAXONOMY_V1.md`.

## 7A. Strategy evidence, health and admission

Method representation, evidence and operational admission are distinct domains.

A MethodProfile may exist without any operational admission. A user-authored or AI-structured strategy does not gain Zugrio Signal/automation status merely because its rules are machine-readable.

A strategy evidence layer should preserve immutable/versioned evidence bundles capable of binding:

- MethodProfile identity/version;
- TradeBundle identity/version;
- RegimeModel/TimeframeMap identity/version;
- BrokerOrderRoute identity/version;
- market/product/instrument/horizon/session scope;
- dataset/time-window identity;
- in-sample/out-of-sample/forward-observation identity where applicable;
- eligible/completed/unresolved case counts;
- cost/slippage/fill assumptions;
- outcome definition;
- robustness/sensitivity evidence;
- known exclusions;
- artifact hashes/versions;
- evidence-policy version.

A separate StrategyAdmissionRecord binds an exact MethodProfile + TradeBundle version and scope to an admitted governed product use, such as Zugrio-generated Signal or Semi-Auto. Its scope can include RegimeModel/version/state, TimeframeMap, BrokerOrderRoute, market/instrument/venue, horizon/session and control mode.

V1 does not admit dynamic StrategyComponentPolicy routing.

Declared-plan monitoring or strategy research/evaluation does not by itself require StrategyAdmission and must not be presented as Zugrio endorsement.

No subscription, user preference, strategy name or LLM response creates admission.

Strategy Health is analytical evidence about whether the strategy + TradeBundle continues to be supported in its declared scope. It remains separate from process adherence, execution adherence and P/L.

Component-level conclusions are conditional: they must identify the rest of the bundle held fixed or remain bundle-level.

No numeric health/admission threshold is defined by this architecture. Thresholds belong to versioned evidence/admission policy established through research and review.

If strategy admission is later wired directly into capital release beyond existing admitted model/method requirements, that integration is a capital-path change and must be reviewed against frozen authority semantics.

## 8. Decision Case and continuity ledger

The product promise “the reason stays with the trade” requires a technical record.

Create a stable `DecisionCaseId` for the lifecycle of an opportunity/decision. Preserve an append-only decision timeline rather than mutating history in place.

Representative events:

```text
CANDIDATE_CREATED
METHOD_BOUND
EVIDENCE_ATTACHED
CONTEXT_FACT_ATTACHED
EVIDENCE_CHANGED
ENTRY_MODEL_EVALUATED
STATE_CHANGED
SELECTION_CHANGED
EXECUTION_SNAPSHOT_CREATED
FIRE_CREATED
RISK_SNAPSHOT_CREATED
AUTHORITY_BLOCKED
ENTRY_INTENT_CREATED
USER_APPROVED
USER_OVERRIDDEN
SUBMISSION_RESERVED
SUBMITTED
BROKER_ACK / BROKER_REJECTED / SUBMISSION_UNKNOWN
FILLED
PROTECTION_CONFIRMED / PROTECTION_FAILED
POSITION_MANAGEMENT_EVENT
CLOSED
OUTCOME_RECORDED
PROCESS_ADHERENCE_EVALUATED
EXECUTION_ADHERENCE_EVALUATED
BEHAVIOUR_OBSERVATION_RECORDED
GUARDRAIL_PRESENTED
GUARDRAIL_ACKNOWLEDGED
```

Strategy-level evidence/admission changes are durable/auditable records but need not be stored as Decision Case events unless a case references the change. Historical cases retain the strategy/admission identities that applied at the relevant time.

Events reference immutable snapshots/artifact identities rather than duplicating mutable state.

Corrections are appended as new events. Historical records are not silently edited.

The ledger supports:
- user journal;
- auditability;
- debugging;
- behavioural/process review;
- replay;
- capital-team governance later;
- model/strategy research without outcome-memory distortion.

The operational database may maintain projections for fast reads; the append-only record remains the historical source for reconstruction.

## 9. Outcome, process, execution and strategy health are separate

Profit/loss is not a substitute for decision quality.

Review should preserve at least four independent concepts:

- **Strategy health:** what evidence supports the strategy/version in the declared scope.
- **Process adherence:** whether the declared method, evidence, risk and authority rules were followed.
- **Execution adherence:** whether actual broker/user action matched the planned/approved action within known execution realities.
- **Outcome:** what financially happened.

A profitable rule violation must not be reclassified as a compliant decision merely because it made money.

A losing compliant decision must not automatically be classified as bad process.

Process-adherence evaluation is analytical/journal output. It does not retroactively modify the original capital decision.

Where adherence can be evaluated from declared rules/events, the authoritative adherence result should be deterministic and versioned. LLM-generated coaching or narrative may explain the record, but it must remain advisory and must not rewrite the adherence result.

## 9A. Behaviour observations and guardrails

Behaviour analytics consumes observable facts from Decision Cases, declared plans, broker records, approvals, overrides, risk changes, mode/authority changes and position-management events.

A BehaviourObservation is a reconstructable statement about plan/process versus observed action. It must reference the evidence that supports it.

A BehaviourPatternAssessment is a cross-case analytical record. It should bind:
- observation definition/version;
- supporting DecisionCaseIds and/or broker events;
- period;
- strategy version(s);
- market/instrument scope;
- control mode;
- plan-to-broker matching quality/uncertainty.

The system must not treat inferred fear, greed, revenge, tilt or impatience as an authoritative fact merely because a pattern appears in trade data.

A GuardrailPolicy is separate from the observation that motivated it.

Conceptual policy strengths:
- advisory;
- confirmation/friction inside a Zugrio-controlled workflow;
- enforcing.

Advisory and confirmation behaviour do not create broker authority.

An enforcing behavioural guardrail is capital-relevant. It may only affect **new risk-increasing actions** routed through Zugrio and requires accepted deterministic policy/authority integration before production activation. This architecture does not authorize that integration by itself.

Once such an Enforcing guardrail is production-admitted, stale or unknown guardrail state fails closed for new risk-increasing actions inside that admitted scope. It never blocks governed risk reduction.

Behavioural guardrails obey **risk-reduction precedence**: no guardrail may be the blocking authority for a governed close, reduce, cancel-risk, protection-restoration or other action already classified by the safety architecture as risk-reducing. Broker/reconciliation/safety constraints remain independently authoritative.

A guardrail may preserve or narrow an existing authority envelope. It may never widen authority.

Guardrail events (presentation, acknowledgement, trigger and any eventual enforcement result) should be durable and attributable to policy/version, user/account scope, supporting evidence and DecisionCase where relevant.

## 10. Control modes are authority envelopes

Signal, Semi-Auto, Auto and Full Auto are not different intelligence engines. They are different **delegation envelopes** around the same validated decision path.

### SIGNAL

- no broker order authority;
- display/notify qualified decisions and reasons;
- user acts independently;
- behavioural guardrails can advise and review, but cannot truthfully claim to block orders placed directly at the broker.

### SEMI_AUTO

- Zugrio may prepare an executable intent;
- explicit user approval is required before submission;
- approval triggers freshness/risk/safety revalidation;
- stale approval cannot revive an expired FIRE;
- advisory/confirmation guardrails may require re-review inside Zugrio for a new risk-increasing action;
- behavioural friction must not obstruct governed risk-reducing action;
- a new behaviour-based capital block is not production-authorized until its deterministic policy and authority precedence are accepted.

### AUTO

- Zugrio may submit qualifying intents without per-trade approval;
- only within an explicit user/account/strategy/instrument/risk mandate;
- all normal risk, veto, broker safety and reconciliation requirements still apply;
- behavioural analytics attributes system action separately from user intervention;
- inferred emotion never becomes execution authority;
- any behaviour-derived execution constraint must be a separately admitted deterministic policy;
- such a constraint can narrow new risk-increasing action only and must not obstruct governed risk reduction.

### FULL_AUTO

- architecture-aware V1 mode;
- may include broader portfolio-level selection/allocation/management authority;
- **release-gated until portfolio construction and portfolio-risk behaviour are validated**;
- unavailable is a legitimate V1 runtime state, not a reason to omit the architecture.

Every account must have an explicit `ExecutionAuthorityManifest`. Absence/invalidity fails closed for execution.

Authority manifests are versioned. Prepared intents bind to the authority version/epoch under which they were created. Revocation or narrowing must invalidate incompatible stale intents across devices; a second device cannot revive authority that has already been revoked.

## 11. V1 market scope

Initial product scope is parallel:

- Forex
- Gold
- Synthetic Indices

Forex may lead public positioning without making Gold or Synthetics post-V1.

Each track can have different:
- family routing;
- feature sets;
- calibration;
- cost model;
- context requirements;
- execution adapter;
- validation evidence.

A capability matrix, not a single “supported=true” flag, should describe what is actually available per instrument/product.

## 12. Broker-neutral execution

Upstream intelligence must not know cTrader, MT5 or future broker-specific mechanics.

Broker Adapter Contract responsibilities include:
- resolve/bind executable symbol;
- fetch broker safety facts;
- submit idempotent intent;
- confirm acknowledgement/rejection/unknown;
- reconcile orders/fills/positions;
- confirm protective orders;
- cancel/reduce/close through governed commands;
- expose broker capabilities.

Broker-specific symbol semantics never define canonical instrument identity.

## 13. Scalability without premature distributed complexity

Initial runtime: modular monolith + independent workers where required.

Recommended pattern:

```text
Next.js / Electron
       │
     API
       │
Domain/Application Modules
       │
PostgreSQL ── transactional outbox
       │
Worker processes
       ├── data ingestion
       ├── context ingestion
       ├── scheduled evaluation
       ├── broker reconciliation
       └── artifact/report jobs
```

Use PostgreSQL-backed coordination/outbox first. Add Redis/Kafka or service extraction only when measured throughput, isolation or operational requirements justify them.

Modules must communicate through typed contracts/domain events even while in one process. This preserves an extraction path later.

Stateless API/worker processes should be horizontally scalable. Capital-authority correctness must not depend on in-memory singleton state.

## 14. Reliability and failure semantics

- Missing strategy operational admission where required → no Zugrio-generated strategy action for that scope.
- Missing/stale strategy-health evidence → explicit unavailable/review state; do not fabricate reassurance.
- Ambiguous user strategy → remain draft/structured-incomplete or monitor as a declared plan; do not invent rules.
- Uncertain plan-to-broker matching → no authoritative behaviour-deviation claim.
- Missing model applicability → no admitted conviction.
- Missing required context → explicit unavailable/stale reason according to the governing policy; never fabricated context.
- Market-data staleness → no new execution when freshness requirements fail.
- State-policy unavailable → `CONVICTION_UNAVAILABLE`.
- Selection-policy unavailable → candidates may remain, but no active selected plan.
- Execution authority missing/revoked → no new execution.
- Broker submission unknown → lock/reconcile; no blind resend.
- Protection failure → invoke governed safety behaviour.
- Audit/ledger persistence failure on a capital transition → fail closed where the transition cannot be durably reconstructed.
- Duplicate/retried worker delivery → idempotent evaluation/event handling; it must not create duplicate FIRE or duplicate broker submission.
- Material clock/source-time inconsistency → fail freshness checks rather than guess ordering.

## 14A. Time and concurrency discipline

Freshness and causal order are capital-relevant.

- Store source event time separately from ingestion/observation time.
- Use UTC for persisted system timestamps and explicit exchange/market timezone metadata where required.
- Do not infer causal ordering solely from local client clocks.
- Worker/evaluation commands must carry idempotency keys or stable event identities.
- Concurrent evaluations of the same candidate/account scope must converge on one authoritative transition.
- FIRE/submission identities remain the ultimate duplicate-execution defense defined by the frozen authority architecture.

## 15. Security boundaries

- Customer broker credentials remain separated by account/tenant.
- cTrader should use delegated OAuth/Open API authorization.
- MT5 design should avoid central storage of customer master passwords where possible.
- Execution intents are signed, short-lived, account-bound and replay-protected where crossing connector trust boundaries.
- Crypto integrations, when introduced, receive no withdrawal authority.
- Administrative support access is explicit, logged and least-privilege.
- Secrets never enter client bundles, logs, Git or AI prompts.

## 16. Architecture invariants

The following must remain testable:

1. A new market family can be added without changing broker adapters.
2. A new broker adapter can be added without changing Decision Core.
3. A new Entry Model can be added without gaining direct FIRE/size/order authority.
4. A new Context Provider can be added without automatically gaining capital authority.
5. A model cannot run capital-authoritatively outside its admitted applicability manifest.
6. An instrument cannot be inferred from a broker symbol string alone.
7. A historical Decision Case can be reconstructed without AI-chat context.
8. A user override cannot erase the system's original decision.
9. Outcome cannot rewrite process-adherence history.
10. Changing UI/brand cannot change capital semantics.
11. Research Python cannot directly authorize capital.
12. No duplicate sizing or order-submission authority exists outside the declared modules.
13. Strategy representation does not imply strategy admission.
14. A strategy-health assessment cannot overwrite process/execution/outcome records.
15. A behaviour observation is reconstructable from recorded facts and does not convert inferred emotion into fact.
16. Advisory/confirmation guardrails cannot claim authority over broker actions outside Zugrio's execution path.
17. No LLM output creates strategy admission, model applicability, risk authority or execution authority.
18. Behavioural guardrails never block or delay governed risk-reducing actions.
19. Behavioural guardrails can preserve/narrow existing authority but cannot widen it.

## 17. Relationship to the frozen Signal Authority Architecture

This architecture adds durable production boundaries around the authority core:

```text
Market Identity / Applicability
        ↓
Data + Context Evidence
        ↓
Specialist Intelligence / Method / Entry Contracts
        ↓
[FROZEN SIGNAL AUTHORITY ARCHITECTURE]
        ↓
Risk / Execution / Broker / Reconciliation
        ↓
Decision Case Ledger / Product Experience
```

Any implementation change that alters the frozen authority graph, state semantics, identity preimages, provenance scopes or FIRE behaviour must be reviewed as a separate architecture change with evidence. It must not be smuggled into the Zugrio 1.0 migration.
