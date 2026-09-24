# Zugrio 1.0 Product Requirements

Status: **foundation PRD** for founder/engineering review.  
Related: `docs/product/PRODUCT_DIRECTION.md`, `docs/architecture/SYSTEM_ARCHITECTURE_V1.md`, `docs/product/STRATEGY_BEHAVIOUR_HEALTH_V1.md`.

This document defines what Zugrio 1.0 must be capable of representing and governing. It does not claim that every capability is already implemented, validated or released.

## 1. Product objective

Zugrio 1.0 should provide a market-aware decision system that helps a trader:

- discover relevant opportunities;
- interpret them using the appropriate market/model scope;
- evaluate them against a declared strategy/method;
- incorporate current market and context evidence;
- determine whether the entry still makes economic sense;
- apply account/risk/authority constraints;
- act at the user's chosen delegation level;
- preserve the complete decision path afterward.

The product must separate:
- the quality of a decision from the eventual P/L outcome;
- opportunity detection from execution permission;
- analytical price from executable price;
- visual similarity from model applicability.

## 2. Initial users

### Primary

Serious self-directed traders operating in:
- Forex;
- Gold;
- Synthetic Indices.

This includes prop-account traders where the relevant account rules can be represented and verified.

### Expansion

Trading teams and allocators are an architectural expansion audience, not a claim of currently released team/AUM/custody functionality.

## 3. Product principles

- **The chart is evidence, not the whole market.**
- **Do not generalise from appearance alone.**
- **The reason for a trade stays connected to the decision to act.**
- **A signal is not permission.**
- **If the facts change, the decision may change.**
- **Outcome and process quality are evaluated separately.**
- **User authority is explicit, bounded and revocable.**

## 4. Requirement priority definitions

- **V1-F** — foundational V1 requirement. Architecture/domain must support it in Zugrio 1.0.
- **V1-LG** — V1 capability whose user activation is launch-gated by evidence, safety or integration readiness.
- **POST-V1** — genuinely different product domain not required for the initial trader product.

“Incomplete today” does not make a requirement POST-V1.

## 5. Market identity and intelligence

### ZR-MKT-001 — Parallel initial market scope — V1-F

The system shall represent Forex, Gold and Synthetic Indices as parallel initial market tracks.

Acceptance:
- product capability data can report support separately for each;
- no market is forced to inherit another market's model/calibration/cost assumptions;
- public launch ordering does not alter architecture scope.

### ZR-MKT-002 — Canonical instrument identity — V1-F

The system shall maintain canonical instrument identity separate from broker/venue symbol strings.

Acceptance:
- two broker symbols can map to one canonical underlying/product relationship where appropriate;
- the same underlying can map to distinct executable products;
- broker symbol regex alone cannot determine production instrument identity.

### ZR-MKT-003 — Multidimensional market scope — V1-F

The system shall distinguish at least:
- price origin / formation class;
- market/behavioural family;
- executable product type;
- instrument;
- venue;
- timeframe/horizon;
- current regime.

Acceptance:
- model applicability can narrow on any of these dimensions;
- “asset class” is insufficient as the sole applicability key.

### ZR-MKT-004 — Specialist routing — V1-F

The system shall support family-specialised intelligence without requiring one universal model.

Acceptance:
- different families may use different feature/model pipelines;
- routing is driven by registry/model metadata, not hard-coded symbol naming;
- a family definition is versioned.

### ZR-MKT-005 — No implicit transfer — V1-F

A model, probability calibration, edge estimate, cost model or threshold shall not transfer to another instrument/product/venue/family merely because the chart looks similar.

Acceptance:
- every admitted inference has an applicability manifest;
- out-of-scope inference fails closed;
- broader family admission requires explicit evidence.

### ZR-MKT-006 — Feature reuse without model reuse — V1-F

The architecture shall allow a feature concept such as discontinuity or volatility shock to be reused across markets without implying that the same probability/calibration model is reusable.

## 6. Strategy, setup and entry requirements

### ZR-STR-001 — Versioned Method Profiles — V1-F

Every governed decision shall reference a versioned Method/Strategy Profile.

Acceptance:
- profile changes create a new version;
- historical decisions retain their original version;
- profile defines its applicable market/product/horizon and permitted setup/entry models.

### ZR-STR-002 — Extensible Entry Models — V1-F

Entry logic shall be extensible beyond any fixed list such as retest, shallow pullback or breakout.

Acceptance:
- a new Entry Model can be added through a defined contract;
- an Entry Model cannot directly size capital, cause FIRE or submit an order;
- UI copy can distinguish examples from exhaustive supported taxonomy.

### ZR-STR-003 — Multiple entries per strategy — V1-F

A Method Profile may permit multiple entry models for the same setup family where explicitly configured and validated.

### ZR-STR-004 — Strategy-aware invalidation — V1-F

The system shall preserve method-specific invalidation rules independently from eventual P/L.

### ZR-STR-005 — Controlled configuration — V1-F

The architecture shall support configurable Method Profiles without requiring an unrestricted end-user strategy programming language in the first release.

### ZR-STR-006 — Method does not widen model scope — V1-F

Enabling a market, setup or Entry Model in a Method Profile shall not automatically admit a probability/calibration model for that scope.

### ZR-STR-007 — Strategy source/provenance — V1-F

Every Method Profile shall identify whether it is Zugrio first-party, Zugrio-supported external, user-defined structured, or another explicitly governed source class.

Acceptance:
- source class is versioned/auditable;
- first-party ownership does not bypass evidence requirements;
- user-defined ownership remains visible in product surfaces.

### ZR-STR-008 — Representation is not admission — V1-F

A strategy being drafted, structured or machine-evaluable shall not make it admitted for Zugrio-generated Signal, Semi-Auto, Auto or Full Auto.

Acceptance:
- representation state and operational admission are separate;
- LLM output cannot promote strategy admission;
- subscription entitlement cannot promote strategy admission.

### ZR-STR-009 — Strategy evidence bundle — V1-F

The system shall be capable of binding a strategy-health/admission assessment to explicit evidence.

The evidence contract shall support, where applicable:
- exact Method Profile version;
- market/product/instrument/horizon scope;
- dataset/time-window identity;
- in-sample/out-of-sample/forward-observation identity;
- eligible/completed/unresolved case counts;
- cost/slippage assumptions;
- outcome definition;
- drawdown/adverse-excursion evidence;
- robustness/sensitivity evidence;
- known exclusions;
- artifact/provenance identities;
- evidence-policy version.

No arbitrary numeric threshold is introduced by this requirement.

### ZR-STR-010 — Scope-specific strategy admission — V1-F / V1-LG for capital activation

Operational admission shall be version- and scope-specific.

Acceptance:
- a strategy may be monitored/evaluated while not admitted for Zugrio-generated signals;
- Signal/Semi-Auto/Auto admission can differ by scope;
- admission references evidence and a versioned admission policy;
- admission in one market/instrument/horizon does not transfer automatically to another;
- live-capital use remains launch-gated.

### ZR-STR-011 — Strategy health — V1-F

The product shall represent ongoing evidence about the strategy separately from trader adherence and P/L.

Strategy-health assessments may include, where appropriate:
- expectancy after modeled/observed costs;
- outcome distribution;
- drawdown;
- MAE/MFE;
- cost/slippage sensitivity;
- market/instrument/session/regime segmentation;
- robustness/sensitivity;
- historical versus forward behaviour;
- drift/degradation evidence;
- evidence sufficiency/recency.

Acceptance:
- user-facing conclusions identify strategy version and scope;
- evidence strength/limitations are visible;
- a short losing streak alone is not automatically classified as strategy failure;
- health does not overwrite historical decisions.

### ZR-STR-012 — Strategy health review/suspension — V1-F / V1-LG for capital activation

A previously admitted strategy shall be reviewable when evidence becomes stale, scope/data assumptions change, or a versioned degradation policy is triggered.

No degradation threshold is defined by this PRD.

### ZR-STR-013 — Declared discretionary plans — V1-F

A user may record a plan with conditions, levels, invalidation, risk, horizon and expiry even when Zugrio does not independently validate the trading thesis.

Acceptance:
- declared conditions may be monitored where technically possible;
- product language distinguishes "your plan condition occurred" from "Zugrio independently qualified a strategy signal";
- manual-plan monitoring does not create model applicability or strategy admission.

### ZR-STR-014 — Initial multi-strategy portfolio — V1-F / V1-LG by admitted scope

The product architecture and strategy library shall support a first-party baseline plus multiple separately governed strategy families.

Initial roadmap:
- Zugrio Core;
- Advanced Price Action;
- Smart Money Concepts;
- Trend Following;
- Range / Mean Reversion.

Acceptance:
- each strategy family is an exact versioned MethodProfile, not only a menu label;
- each declares its own supported setup/evidence grammar and Entry Models;
- evidence and StrategyAdmission remain independent by market/instrument/horizon/control mode;
- selecting a strategy changes the applicable rules/annotations/qualification logic rather than only changing UI text;
- absence of admission for one strategy or market does not prevent other admitted strategies/scopes from operating;
- the UI exposes available/in-validation/planned status rather than representing roadmap entries as live support.

No claim is made by this requirement that any listed strategy is profitable or already admitted.

### ZR-STR-015 — Setup, location and entry separation — V1-F

The system shall distinguish:
- the setup/opportunity state;
- the location/reference model;
- the entry/trigger model.

Acceptance:
- a setup may exist without a valid entry;
- a LocationModel such as Fibonacci/retracement, structure, range boundary or imbalance zone cannot by itself create a Zugrio signal;
- retracement depth is represented as location evidence rather than silently creating separate strategies;
- historical Decision Cases retain exact component versions.

### ZR-STR-016 — Entry trigger versus broker order route — V1-F / V1-LG for live execution

Entry qualification shall be separate from how an order is submitted.

Acceptance:
- a valid entry may map to market, limit, stop or prepared Semi-Auto intent only where the execution policy permits;
- broker order type cannot make an invalid strategy entry valid;
- spread, slippage, quote freshness, drift, broker rules and control mode may block/change the order route without rewriting the original entry evidence.

### ZR-STR-017 — Protection and exit-management models — V1-F / V1-LG for live execution

The system shall represent initial protection separately from profit-taking/position management.

Acceptance:
- ProtectionModel identifies the thesis/risk boundary;
- ExitManagementModel identifies target/partial/break-even/trailing/time/state management;
- exit management cannot widen initial risk authority;
- risk-reducing safety actions retain precedence over profit-management logic;
- one strategy may permit multiple versioned exit-management models where explicitly evidenced.

### ZR-STR-018 — Strategy component policy — V1-F / V1-LG by admitted scope

A versioned StrategyComponentPolicy may select among components already permitted by the exact strategy version.

Acceptance:
- inputs identify market/instrument/horizon and applicable regime/context;
- output identifies the exact setup/location/entry/protection/exit bundle or PASS;
- policy cannot select a component not permitted by the MethodProfile;
- policy cannot silently switch strategy family;
- policy can be reconstructed from the Decision Case;
- component selection has explicit evidence/admission by scope.

### ZR-STR-019 — No silent strategy switching — V1-F

When the user selects a supported preset or Custom Strategy, Zugrio shall not silently replace it with another strategy family.

Acceptance:
- if the selected strategy is incompatible/unadmitted for the current state, the product may return no setup/no compatible route;
- the product may recommend another supported strategy only as an explicit recommendation with evidence/status;
- any future automatic strategy-family routing is represented as a distinct first-party meta-strategy and requires separate admission/user authority.

### ZR-STR-020 — Component-level health evidence — V1-F

Strategy-health analysis shall be capable of segmenting evidence by applicable component and scope without implying that every slice is statistically reliable.

Potential dimensions include:
- setup model;
- LocationModel;
- EntryModel;
- ProtectionModel;
- ExitManagementModel;
- instrument;
- horizon/session;
- regime.

Acceptance:
- component conclusions expose sample/evidence limitations;
- repeated slicing/data mining does not create a positive claim by default;
- material strategy/component-policy changes create a new version and evidence path;
- degradation in one component/scope does not silently rewrite unrelated scopes.

Detailed taxonomy: `docs/product/STRATEGY_EXECUTION_COMPONENT_TAXONOMY_V1.md`.

## 7. Context intelligence

### ZR-CTX-001 — Macro event context — V1-F

The system shall support scheduled macroeconomic events as sourced context evidence.

Minimum metadata:
- source;
- event identity/type;
- affected scope;
- scheduled/effective time;
- observed time;
- freshness/provenance.

### ZR-CTX-002 — News context — V1-F

The system shall support sourced market-moving news/context without granting a news provider direct execution authority.

### ZR-CTX-003 — Session context — V1-F

The system shall represent trading session and session-transition context where relevant to the instrument/strategy.

### ZR-CTX-004 — Related-market context — V1-F

The architecture shall support cross-market/related-market evidence where a strategy/model explicitly consumes it.

### ZR-CTX-005 — Provenance requirement — V1-F

Capital-authoritative context shall be traceable to a source, timestamp, normalisation version and governing feature/policy/model.

Unsourced generative narrative shall not become capital-authoritative evidence.

### ZR-CTX-006 — Missing/stale context — V1-F

Where a policy requires context, missing or stale context shall produce an explicit unavailable/degraded/block reason rather than invented values.

## 8. Decision lifecycle and continuity

### ZR-DEC-001 — Stable Decision Case — V1-F

The system shall maintain a stable Decision Case across the lifecycle of an opportunity.

Acceptance:
- evidence/state/execution changes can be reconstructed in order;
- the record is not dependent on UI session state.

### ZR-DEC-002 — Append-only decision history — V1-F

Material decision events shall be append-only/auditable.

Acceptance:
- later corrections do not erase original events;
- user overrides preserve the prior system recommendation/state.

### ZR-DEC-003 — Reason continuity — V1-F

A user shall be able to see:
- why the opportunity originally qualified;
- what evidence supported/conflicted;
- what changed;
- what the current decision state is;
- why execution was allowed/blocked;
- what actually happened at the broker.

### ZR-DEC-004 — Outcome/process separation — V1-F

Post-trade review shall store financial outcome separately from process adherence.

Acceptance:
- profit does not automatically mark a rule violation as compliant;
- loss does not automatically mark a compliant decision as process failure.

### ZR-DEC-005 — Missed/passed/blocked review — V1-F

The journal shall support review of entered, passed, missed, expired and blocked opportunities, not only executed trades.

### ZR-DEC-006 — Deterministic adherence where possible — V1-F

Where process adherence can be computed from declared method/risk/authority rules and recorded events, the authoritative adherence result shall be deterministic/versioned. AI-generated coaching may explain it but shall not overwrite it.

### ZR-DEC-007 — Four-way review separation — V1-F

Post-trade/strategy review shall be able to represent separately:
- strategy health;
- decision/process adherence;
- execution adherence;
- financial outcome.

Acceptance:
- none of the four automatically overwrites another;
- a profitable process violation remains a violation;
- a compliant losing trade is not automatically a process failure;
- deteriorating strategy evidence can be investigated without assigning trader fault by default.

## 8A. Behaviour health and guardrails

### ZR-BHV-001 — Observable behaviour only — V1-F

Authoritative behaviour observations shall be based on reconstructable events such as plan conditions, Decision Case events, broker actions, approvals, overrides, risk changes, exits and authority changes.

The system shall not present fear, greed, revenge, tilt, impatience or another internal state as a fact solely from a trade record.

### ZR-BHV-002 — Behaviour observation provenance — V1-F

Every behaviour observation shall reference enough evidence to reconstruct why it was recorded.

Examples may include:
- entry before required confirmation;
- entry after the declared entry ceased to qualify;
- entry outside a declared zone;
- risk differing from the plan;
- early exit relative to a declared rule;
- manual override;
- repeated re-entry after invalidation;
- manual intervention in an automated case.

### ZR-BHV-003 — Cross-case pattern evidence — V1-F

BehaviourObservation shall derive from authoritative ProcessAdherenceRecord and/or ExecutionAdherenceRecord plus underlying event references. It shall not independently recalculate a competing compliance verdict.

A behaviour-pattern assessment shall expose:
- definition/version;
- sample/case count;
- time period;
- strategy version(s);
- market/instrument scope;
- control mode;
- supporting cases;
- plan-to-broker matching uncertainty.

The product shall not assert a pattern when matching evidence is insufficient.

### ZR-BHV-004 — Guardrail strengths — V1-F

The product architecture shall support distinct guardrail strengths:
- advisory;
- confirmation/friction inside a Zugrio-controlled workflow;
- enforcing, subject to separate capital-policy admission.

The exact public labels may evolve.

### ZR-BHV-005 — Signal-mode truth — V1-F

Signal mode may warn, compare plan versus action and review read-only broker activity where supported.

It shall not claim that Zugrio can block a manual order placed outside Zugrio's execution authority.

### ZR-BHV-006 — Semi-Auto guardrail truth — V1-F / V1-LG

Semi-Auto may present warnings and require re-review/acknowledgement before Zugrio submission.

Any new behavioural rule that blocks capital submission is launch-gated until integrated through accepted deterministic authority/policy semantics.

### ZR-BHV-007 — Auto/Full-Auto guardrail truth — V1-F / V1-LG

Behaviour analytics shall distinguish system actions from user interventions.

No inferred emotion may become capital-authoritative. Any behavioural constraint affecting automatic execution requires deterministic policy, versioning, explicit scope, evidence and accepted authority integration.

Any future enforcing behavioural constraint may only preserve or narrow authority for **new risk-increasing action**. It must not block or delay a governed risk-reducing action.

### ZR-BHV-007A — Risk-reduction precedence — V1-F

Behavioural guardrails shall not be the blocking authority for governed risk-reducing actions.

Acceptance:
- close/reduce actions remain outside behavioural-friction blocking where the existing safety architecture classifies them as risk-reducing;
- restoring required protection is not blocked by behavioural confirmation/enforcement;
- cancelling an unfilled risk-increasing order is not blocked by a behavioural guardrail;
- stale/unavailable guardrail state may never be converted into a reason to obstruct governed risk reduction;
- broker/reconciliation/safety constraints remain independently authoritative.

Full Auto remains subject to the existing portfolio-validation gate.

### ZR-BHV-007B — Enforcing guardrail stale-state default — V1-LG

Once an Enforcing guardrail is production-admitted, stale or unknown guardrail state shall fail closed for new risk-increasing actions within that guardrail's admitted scope.

Acceptance:
- stale/unknown guardrail state cannot authorize new risk;
- stale/unknown guardrail state cannot block governed risk-reducing actions;
- the affected scope and reason are explicit;
- broker/reconciliation/safety policy remains independently authoritative.

### ZR-BHV-008 — Guardrail audit — V1-F

Guardrail presentation, acknowledgement, trigger and any eventual enforcement outcome shall be durably attributable to:
- guardrail policy/version;
- user/account scope;
- supporting evidence;
- Decision Case where relevant;
- time/effective state.

When a guardrail bypass also overrides a system recommendation, prepared action or governed system action, the GuardrailEvent shall reference the corresponding OverrideRecord rather than create a second independent override record.

### ZR-BHV-009 — Outside-path limitation — V1-F

Where a user acts directly at a broker outside Zugrio's execution path, Zugrio may observe/review the action if data is available but shall not represent that it had authority to prevent the action.

## 8B. AI assistance boundaries

### ZR-AI-001 — Strategy structuring assistance — V1-F

AI may translate a natural-language strategy description into a draft structured representation and ask for missing definitions.

It shall not silently convert ambiguous language into capital-authoritative rules.

### ZR-AI-002 — Case-aware explanation — V1-F

AI may explain a Decision Case, strategy-health evidence, behaviour observation or guardrail using provenance-bound system data.

AI explanation shall not overwrite deterministic records or create missing evidence/admission.

## 9. Decision authority and states

### ZR-AUTH-001 — Preserve frozen authority semantics — V1-F

Zugrio 1.0 migration shall preserve the cleared Signal Authority Architecture behaviour unless separately amended through evidence and ADR.

### ZR-AUTH-002 — Structural versus probabilistic states — V1-F

A structural candidate without admitted model conviction shall not be represented as probabilistically READY/FIRE.

### ZR-AUTH-003 — No invented thresholds — V1-F

Missing policy/model thresholds shall not be replaced by arbitrary numeric defaults in capital paths.

### ZR-AUTH-004 — Explicit degraded reasons — V1-F

The product shall expose understandable reasons for states such as:
- insufficient data;
- model unavailable/out of scope;
- stale evidence;
- context missing where required;
- state policy unavailable;
- entry no longer economic;
- risk/authority block;
- broker uncertainty.

## 10. Entry economics and risk

### ZR-RSK-001 — Current entry economics — V1-F

A setup can remain structurally valid while the currently available entry becomes unattractive.

The system shall model these separately.

### ZR-RSK-002 — Immutable risk snapshot — V1-F

Capital release shall reference an immutable risk snapshot tied to the decision/intent identity.

### ZR-RSK-003 — Account constraints — V1-F

The system shall support configurable account risk constraints and, where verified, prop/account rules.

### ZR-RSK-004 — No duplicate sizing authority — V1-F

There shall be exactly one declared capital-sizing authority path.

### ZR-RSK-005 — Portfolio-aware Full Auto — V1-LG

Full Auto activation shall remain unavailable until portfolio construction/exposure behaviour is validated.

## 11. Control modes

### ZR-MODE-001 — Signal — V1-F

Signal mode shall provide decision intelligence without broker order authority.

### ZR-MODE-002 — Semi-Auto — V1-F / V1-LG for live activation

Semi-Auto shall require explicit user approval of a prepared intent and revalidate freshness/risk before submission.

### ZR-MODE-003 — Auto — V1-F / V1-LG for live activation

Auto shall permit execution only within an explicit account/strategy/instrument/risk authority manifest.

### ZR-MODE-004 — Full Auto — V1-F / V1-LG

Full Auto shall exist in architecture/control semantics but remain locked until portfolio-level validation requirements clear.

### ZR-MODE-005 — Revocation — V1-F

The user shall be able to revoke automation authority. Revocation prevents new risk-increasing action while preserving governed risk-reduction behaviour.

### ZR-MODE-006 — Cross-device authority consistency — V1-F

Authority changes shall be server-authoritative and versioned. A stale approval or second device shall not revive revoked/narrowed automation authority.

## 12. Broker and execution

### ZR-EXE-001 — Broker-neutral upstream core — V1-F

Decision intelligence/risk authority shall not depend on cTrader/MT5-specific logic.

### ZR-EXE-002 — cTrader adapter — V1-F / V1-LG

cTrader is an initial execution endpoint using delegated authorization where available.

### ZR-EXE-003 — MT5 adapter — V1-F / V1-LG

MT5 is an initial execution endpoint through a constrained connector architecture.

### ZR-EXE-004 — No Zugrio VPS fleet by default — V1-F

Always-on MT5 shall not require Zugrio to operate a per-customer Windows VPS fleet by default.

### ZR-EXE-005 — Idempotent submission/reconciliation — V1-F

Unknown submission state shall trigger reconciliation/lock behaviour rather than blind resend.

### ZR-EXE-006 — Protection confirmation — V1-F

Live execution shall verify broker-side protective state according to the governing execution policy.

## 13. Market/data freshness

### ZR-DATA-001 — Closed-source-event discipline — V1-F

Capital decisions shall bind to explicit source-event/candle identities according to the frozen architecture.

### ZR-DATA-002 — Freshness visibility — V1-F

The user shall be able to distinguish:
- current;
- stale;
- missing;
- delayed/unavailable evidence.

### ZR-DATA-003 — Data/feed provenance — V1-F

Market and context feeds used in decision authority shall be identifiable by source and normalisation version.

## 14. User experience

### ZR-UX-001 — Explain current state — V1-F

For any surfaced opportunity the user should be able to answer:
- what is this?
- why is it here?
- what still holds?
- what is missing/conflicting?
- what would invalidate it?
- what can happen next?
- who/what currently has authority to act?

### ZR-UX-002 — Market-family transparency — V1-F

Where useful, the UI shall communicate that an instrument is being evaluated under an appropriate specialist/family model without forcing the user to understand internal implementation names.

### ZR-UX-003 — Chart annotations — V1-F

The product shall support real-time/updated visualisation of relevant market structure and decision geometry without making chart drawings the sole explanation of the decision.

Authoritative chart annotations shall reflect deterministic/versioned strategy, Entry Model, Decision Case or provenance-bound market/context state. They shall not be generated from free-form AI narration.

Acceptance:
- an annotation such as "break confirmed" or "awaiting retest" appears only when the governing strategy/Entry Model defines a reconstructable condition/state that supports that label;
- every authoritative annotation can be traced to the relevant strategy/Entry Model version and source evidence/state;
- AI may explain an annotation or current case in a separately identified explanatory surface, but AI explanation cannot create, promote, invalidate or rewrite the authoritative chart state;
- stale/missing evidence cannot be rendered as current confirmation;
- illustrative marketing demos must be labeled as illustrative unless backed by a real product state.

### ZR-UX-004 — Decision journal — V1-F

The journal shall preserve original reasoning, material evidence changes, action/override, execution result and outcome/process review.

### ZR-UX-005 — No fake certainty — V1-F

The UI shall not present an internal heuristic score as a calibrated win probability or performance claim.

## 15. Platform and scalability

### ZR-PLT-001 — Human-auditable production system — V1-F

A competent engineer shall be able to understand, test and operate Zugrio without AI conversation history.

### ZR-PLT-002 — Modular monolith first — V1-F

The initial production system shall use enforceable module/package boundaries without premature microservice complexity.

### ZR-PLT-003 — Durable state — V1-F

Capital-authority correctness shall not rely on mutable in-memory singleton state.

### ZR-PLT-004 — Transactional events — V1-F

Material asynchronous workflows shall use durable transactional/outbox-style event publication where needed.

### ZR-PLT-005 — Horizontal worker scaling — V1-F

Market-data ingestion, context ingestion, evaluations and reconciliation workers should be independently horizontally scalable without changing domain semantics.

### ZR-PLT-006 — Observability — V1-F

Structured logs/traces shall make it possible to explain why a decision changed or execution was blocked.

### ZR-PLT-007 — Idempotent async processing — V1-F

Retries/duplicate delivery from workers, schedulers or connectors shall not create duplicate decision transitions, FIRE events or broker submissions.

### ZR-PLT-008 — Time discipline — V1-F

Source event time, observed/ingested time and system processing time shall remain distinguishable. Capital freshness shall not rely on an untrusted client clock.

## 15A. Identity, subscription and client surfaces

### ZR-ID-001 — One product identity — V1-F

A user shall have one Zugrio identity across authenticated web, desktop and mobile surfaces.

Acceptance:
- the same account can authenticate on supported clients;
- sessions are individually revocable;
- subscription/entitlement state is server-authoritative.

### ZR-ID-002 — Waitlist is not account creation — V1-F

Joining early access/waitlist shall not create a trading account, broker connection or execution authority.

### ZR-ID-003 — Workspace tenant boundary — V1-F

User, broker, trading-account, decision and billing records shall be scoped to a Workspace/Tenant boundary even if V1 primarily exposes individual workspaces.

### ZR-ID-004 — Subscription entitlement — V1-F

Commercial subscription shall produce a versioned/inspectable Entitlement Set.

Entitlement may determine whether Signal, Semi-Auto, Auto or Full Auto capabilities are commercially available, but entitlement shall not itself authorize trading.

### ZR-ID-005 — Authority separation — V1-F

Actual execution shall require a separate valid Execution Authority Manifest bound to the user/workspace/account/strategy/mode scope.

Acceptance:
- upgrading a subscription cannot place a trade;
- disabling Auto authority prevents new automatic risk-increasing actions even if the plan still entitles Auto;
- safety/risk-reduction behaviour for existing positions follows the governing safety architecture rather than ordinary commercial gating.

### ZR-ID-006 — Signup/subscription/download flow — V1-F

The product shall support the intended progression:

```text
landing/waitlist
→ invitation or signup/login
→ subscription/payment
→ account entitlement
→ desktop download/access
→ authenticated desktop/mobile use
```

Individual rollout stages may be invite-gated during early access.

### ZR-ID-007 — Authenticated desktop — V1-F

Desktop shall require Zugrio authentication for account-specific/subscription-dependent functionality.

### ZR-ID-008 — Authenticated mobile — V1-F

Mobile shall be designed as an authenticated first-class surface for monitoring, alerts, review, approvals and permitted controls.

Implementation may be staged, but mobile identity/API contracts must not require a future backend redesign.

### ZR-ID-009 — Release integrity — V1-F

Desktop release artifacts shall be versioned and integrity-verifiable.

### ZR-ID-010 — Billing/provider abstraction — V1-F

Payment/billing-provider implementation shall not define core Zugrio product identity or trading authority. Provider changes must be possible behind a billing/entitlement boundary.

### ZR-ID-011 — Billing event integrity — V1-F

Subscription/entitlement changes shall be derived from verified server-side billing events with idempotent webhook/event handling. Client-side payment success screens shall not be sufficient authority to grant entitlements.

## 16. Security and privacy

### ZR-SEC-001 — Least-privilege broker auth — V1-F

Use delegated/scoped authorization where supported. Do not expose developer credentials to end users.

### ZR-SEC-002 — Secrets boundary — V1-F

Secrets shall not appear in client bundles, source control, logs or AI prompts.

### ZR-SEC-003 — Signed connector intents — V1-F

Remote execution intents crossing trust boundaries shall be signed, short-lived, account-bound and replay-protected where applicable.

### ZR-SEC-004 — Tenant/account isolation — V1-F

One user's broker/account/decision data shall not be accessible to another user's authorization context.

## 17. V1 launch gating

A capability may be architecturally present but unavailable to users until its release criteria are met.

Live capital activation requires, as applicable:
- cleared authority Gate evidence;
- admitted/calibrated market/model scope;
- strategy version/scope admission where the workflow depends on Zugrio-generated strategy qualification;
- complete cost model;
- broker adapter verification;
- risk/position-management verification;
- security/threat-model review;
- reconciliation and protection tests;
- observability/runbooks;
- legal/regulatory launch review.

This gating model applies independently by market/product/broker/mode. One cleared scope must not silently promote another.

## 18. Genuine post-V1 domains

Examples currently classified POST-V1 unless founder direction changes:
- mature allocator/team administration;
- full AUM/mandate administration;
- custody workflows;
- options-specific strategy/risk UX and nonlinear Greeks/expiry architecture;
- institutional FIX workflows beyond the initial trader product.

Their future possibility must not contaminate V1 with premature complexity.

## 19. Success evidence

Zugrio 1.0 should eventually be able to demonstrate with evidence—not marketing language—that:

1. the same visible pattern can route differently when market scope differs;
2. an idea can remain structurally valid while its entry economics expire;
3. the product can explain why a decision advanced, waited or stopped;
4. a manual override remains visible after the outcome is known;
5. a profitable rule violation remains identifiable as a process violation;
6. new markets/models/adapters can be added without rewriting authority boundaries;
7. the full decision can be reconstructed from durable records;
8. a user-authored strategy can be represented without being misrepresented as Zugrio-admitted;
9. strategy-health claims expose their scope, version and evidence limitations;
10. behaviour observations can be traced to recorded facts without inferring emotions as facts;
11. advisory/confirmation guardrails state their actual authority limits;
12. strategy health, process adherence, execution adherence and financial outcome remain independently reviewable;
13. behavioural guardrails never block governed risk-reducing actions;
14. future enforcing guardrails can only preserve/narrow existing authority, never widen it.
