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

A versioned immutable `MethodProfile` should define the method under which a candidate is being evaluated:

```text
methodProfileId
methodVersion
name
owner/scope
market/product applicability
timeframes/horizons
setupFamilies[]
entryModelIds[]
requiredEvidenceContracts[]
contextRequirements[]
invalidationRules[]
riskPolicyRefs[]
executionModePermissions[]
createdAt
supersedes
```

A user may eventually author or customise methods, but an arbitrary public strategy-builder DSL is **not** required merely to satisfy this architecture. V1 may begin with system-defined and controlled configurable profiles.

A decision must always reference the exact method version that governed it.

Changing the method creates a new version; it must not rewrite the historical method attached to an existing decision.

## 7. Entry Model Contract

Retest, shallow pullback, breakout, liquidity sweep, FVG mitigation and similar labels are examples, not an exhaustive architecture.

An `EntryModel` must be versioned and strategy-aware.

It may define:
- required setup/candidate state;
- required evidence;
- entry conditions;
- timing/freshness rules;
- geometry construction rules;
- invalidation;
- lifecycle transitions;
- supported market/model scopes.

It may output candidate/entry evidence and geometry.

It may **not**:
- invent probability;
- directly size capital;
- bypass State Policy;
- directly cause FIRE;
- bypass execution-policy admission;
- place broker orders.

This keeps the entry taxonomy extensible without weakening authority boundaries.

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
```

Events reference immutable snapshots/artifact identities rather than duplicating mutable state.

Corrections are appended as new events. Historical records are not silently edited.

The ledger supports:
- user journal;
- auditability;
- debugging;
- behavioral/process review;
- replay;
- capital-team governance later;
- model/strategy research without outcome-memory distortion.

The operational database may maintain projections for fast reads; the append-only record remains the historical source for reconstruction.

## 9. Outcome and process are separate

Profit/loss is not a substitute for decision quality.

Post-trade evaluation should keep at least two independent concepts:

- **Outcome:** what financially happened.
- **Process adherence:** whether the declared method, evidence, risk and authority rules were followed.

A profitable rule violation must not be reclassified as a compliant decision merely because it made money.

A losing compliant decision must not automatically be classified as bad process.

Process-adherence evaluation is analytical/journal output. It does not retroactively modify the original capital decision.

## 10. Control modes are authority envelopes

Signal, Semi-Auto, Auto and Full Auto are not different intelligence engines. They are different **delegation envelopes** around the same validated decision path.

### SIGNAL

- no broker order authority;
- display/notify qualified decisions and reasons;
- user acts independently.

### SEMI_AUTO

- Zugrio may prepare an executable intent;
- explicit user approval is required before submission;
- approval triggers freshness/risk/safety revalidation;
- stale approval cannot revive an expired FIRE.

### AUTO

- Zugrio may submit qualifying intents without per-trade approval;
- only within an explicit user/account/strategy/instrument/risk mandate;
- all normal risk, veto, broker safety and reconciliation requirements still apply.

### FULL_AUTO

- architecture-aware V1 mode;
- may include broader portfolio-level selection/allocation/management authority;
- **release-gated until portfolio construction and portfolio-risk behavior are validated**;
- unavailable is a legitimate V1 runtime state, not a reason to omit the architecture.

Every account must have an explicit `ExecutionAuthorityManifest`. Absence/invalidity fails closed for execution.

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

- Missing model applicability → no admitted conviction.
- Missing required context → explicit unavailable/stale reason according to the governing policy; never fabricated context.
- Market-data staleness → no new execution when freshness requirements fail.
- State-policy unavailable → `CONVICTION_UNAVAILABLE`.
- Selection-policy unavailable → candidates may remain, but no active selected plan.
- Execution authority missing/revoked → no new execution.
- Broker submission unknown → lock/reconcile; no blind resend.
- Protection failure → invoke governed safety behavior.
- Audit/ledger persistence failure on a capital transition → fail closed where the transition cannot be durably reconstructed.

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

Any implementation change that alters the frozen authority graph, state semantics, identity preimages, provenance scopes or FIRE behavior must be reviewed as a separate architecture change with evidence. It must not be smuggled into the Zugrio 1.0 migration.
