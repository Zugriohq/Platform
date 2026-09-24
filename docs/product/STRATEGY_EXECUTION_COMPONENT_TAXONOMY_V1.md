# Strategy and Execution Component Taxonomy v1

Status: **founder-directed architecture; V1 cut constrained by review**  
Issue: #26  
Date: 2026-09-24

This document defines the long-term taxonomy for strategy, setup, location, entry, order route, protection, exit/management, risk and authority, while explicitly constraining the first product build.

It does **not** itself admit any strategy or bundle, establish profitability, invent numeric thresholds, or modify frozen capital authority.

## 1. Core principle

A trading strategy is not the same thing as an entry technique, exit technique, Fibonacci level, broker order type, risk rule or control mode.

The full path is:

```text
Market / instrument / horizon
        ↓
Point-in-time regime + context
        ↓
Strategy
        ↓
Trade Bundle
  ├─ setup
  ├─ location/reference
  ├─ entry/trigger
  ├─ broker order route
  ├─ protection
  ├─ exit/position management
  └─ component timeframe bindings
        ↓
Risk policy
        ↓
Authority / control mode
        ↓
Broker reality
```

The **Trade Bundle** is the unit of selection, evidence and admission.

Entries, protection and exits must not be selected independently because their geometry and measured outcomes depend on one another.

## 2. Three strategy sources

### 2.1 Zugrio Core

Zugrio's proprietary first-party strategy.

### V1 definition

For V1, **Zugrio Core is the productionized descendant of the strongest existing TTI Advanced Price Action research lineage**, combined with Zugrio's market-family/context, decision-history, risk and authority architecture.

This does not mean the legacy APA experiment is already valid or profitable. It means the V1 engineering starting point is a known, inspectable lineage rather than an empty "Core" label.

V1 Core is **not adaptive across multiple bundles**. For each admitted market-family scope it uses one frozen Trade Bundle version.

A material change to Core or its bundle creates a new version and a new evidence/admission path.

### 2.2 Zugrio-supported presets

Longer-term roadmap:
- Advanced Price Action (APA);
- Smart Money Concepts (SMC);
- Trend Following;
- Range / Mean Reversion.

Each preset is Zugrio's exact versioned implementation of that family.

For V1 product status:
- these presets are **In validation / later**, not simultaneously represented as live admitted alternatives to Core;
- APA is also the principal research lineage underlying Core V1, so a separate public APA preset must not be presented as distinct from Core until a measurable semantic/behavioral distinction is demonstrated.

### 2.3 User-defined Custom Strategy

A user may eventually define a strategy using supported structured components and explicit custom conditions.

Custom Strategy is **not in the first implementation slice**.

Its lifecycle remains:
draft → structured → evaluatable → evidence-assessed → forward/shadow observed where required → admitted by scope → review/suspend/supersede.

Monitoring does not equal Zugrio endorsement.

## 3. MethodProfile

The existing immutable/versioned `MethodProfile` remains the canonical engineering strategy object. Public language uses **strategy**.

A MethodProfile may reference:

```text
methodProfileId
methodVersion
strategySourceClass
strategyFamily
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

For V1 Core, exactly one admitted Trade Bundle may be active for each admitted market-family/instrument scope.

The presence of a Trade Bundle in a MethodProfile means it is defined/permitted, not automatically admitted.

## 4. TradeBundleDefinition

A `TradeBundleDefinition` is immutable/versioned and is the smallest strategy-expression unit that may be independently evaluated/admitted.

Key identity:
`TradeBundleId + version`

It binds together:

- SetupModel/version;
- LocationModel/version;
- EntryModel/version;
- BrokerOrderRoute/version;
- ProtectionModel/version;
- ExitManagementModel/version;
- TimeframeMap/version;
- RegimeModel/version or explicitly regime-agnostic status;
- context requirements;
- market/instrument/venue scope;
- horizon/session scope;
- cost/slippage/fill assumptions.

A bundle is **atomic for evidence**. Replacing any material component creates a new bundle version/evidence identity.

No system may combine an admitted entry from Bundle A with an admitted exit from Bundle B and call the combination admitted.

## 5. Setup model

A `SetupModelDefinition` describes the opportunity state the strategy is interested in.

Potential normalized families include:
- trend continuation;
- structural reversal;
- breakout/expansion;
- range rejection;
- liquidity sweep/reclaim;
- imbalance/FVG mitigation;
- supply/demand or order-block reaction;
- compression-to-expansion.

A setup contract defines:
- prior state;
- formation;
- qualification;
- invalidation;
- expiry;
- point-in-time observability;
- supported scope.

A setup may exist without a valid entry.

## 6. Location / reference model

A `LocationModelDefinition` answers where a setup becomes relevant.

Examples:
- structural support/resistance or prior swing;
- range boundary/equilibrium;
- percentage/Fibonacci retracement band;
- Fibonacci extension reference;
- FVG/imbalance zone;
- order-block/supply-demand zone;
- volatility-normalized band;
- admitted moving reference.

### Fibonacci

Fibonacci is a location/measurement component, not a strategy and not a standalone signal.

A bundle defines:
- whether Fibonacci is used;
- point-in-time anchor construction;
- relevant bands/levels;
- whether it is required or supporting;
- whether it contributes to entry, protection or target geometry.

The TTI APA 50–61.8% golden-zone hypothesis remains lineage-specific research, not a global Zugrio rule.

## 7. Entry model

An `EntryModelDefinition` answers what must occur before a qualified setup becomes actionable.

Initial research archetypes may include:
- break-and-go confirmation;
- classic retest confirmation;
- pullback/retracement confirmation;
- sweep-and-reclaim;
- zone mitigation/reaction;
- range-edge rejection.

Legacy TTI routes such as BREAK_AND_GO, SHALLOW_PULLBACK, MEDIUM_PULLBACK, DEEP_RETRACEMENT and CLASSIC_RETEST remain research inputs only.

Retracement depth generally belongs to LocationModel; EntryModel owns trigger/timing.

## 8. Broker order route

The qualifying entry and the broker order route are different.

A `BrokerOrderRouteDefinition` may describe:
- market-on-confirmation;
- limit-at-qualified-zone;
- stop-entry beyond a trigger/break;
- prepared Semi-Auto intent.

The **order route is part of the Trade Bundle and admission scope** because it materially affects realized trades.

Research for a route must model, where applicable:
- whether an order would have been fillable;
- spread;
- slippage;
- adverse selection;
- limit non-fill;
- stop-order gap/slippage;
- quote freshness;
- broker minimum-distance/order rules;
- latency/drift assumptions;
- partial/failed fills where relevant.

A backtest may not assume "entry at zone" equals a guaranteed live fill.

## 9. Protection model

The `ProtectionModelDefinition` owns the protective stop / thesis risk boundary.

Possible models include:
- structural invalidation stop;
- structural stop plus admitted volatility buffer;
- volatility-derived stop where the strategy explicitly permits it;
- failsafe/catastrophic boundary.

### Stop ownership invariant

- ProtectionModel owns the stop.
- ExitManagementModel may **request only a tightening** of protection through the governed protection-change path.
- ExitManagementModel may not widen protection.
- Any stop widening is a **risk-increasing action**, not ordinary exit management, and must pass whatever explicit risk/authority policy would govern such an action. V1 does not authorize automatic stop widening.
- Risk-reducing close/reduce actions retain precedence.

## 10. Exit / position-management model

An `ExitManagementModelDefinition` owns profit-taking and post-entry management other than the underlying protective boundary.

Potential components:
- fixed-R target;
- structural target;
- opposing range boundary/equilibrium;
- liquidity/reference target;
- admitted extension target;
- partial scale-out;
- break-even request through ProtectionModel;
- structural/volatility/broker trailing request through ProtectionModel;
- time/session exit;
- explicitly validated state exit;
- governed risk/safety close/reduce.

The exit model is frozen as part of the Trade Bundle at entry.

### No regime-driven mid-trade strategy rewrite

If regime classification changes after entry:
- the original Trade Bundle remains the governing plan;
- Zugrio does not swap to a different exit model because the new regime would have selected another bundle;
- only predeclared, tested rules inside the frozen bundle may react to post-entry events.

## 11. Multi-timeframe map

A single "timeframe" field is insufficient for strategies such as APA/SMC.

A versioned `TimeframeMapDefinition` binds component roles, for example:

```text
context / higher-timeframe bias: H4
setup formation: H1
location construction: M15
entry trigger: M5
management observation: M5
```

The exact map is strategy/bundle-specific.

Each component must identify the timeframe(s) it consumes.

Research/replay must use only information that was available at the relevant point in time on each timeframe.

Changing the timeframe map creates a new bundle/evidence identity.

## 12. Regime model

Regime is a versioned input, not a free label.

A `RegimeModelDefinition` must identify:
- version/model identity;
- market/instrument applicability;
- input features;
- timeframe;
- state taxonomy;
- point-in-time labeling semantics;
- freshness;
- transition/uncertain behavior;
- provenance/evidence.

Potential states may include trending, ranging, expansion, compression, transition/uncertain and specialist market-family states, but exact semantics are model-specific.

### Research anti-leakage rule

Regime labels used in evaluation must be generated point-in-time from information available then.

A full-sample classifier must not retrospectively label a historical bar "trending" using future observations and then be used to claim regime-conditioned performance.

### Default uncertain state

If the relevant regime is `TRANSITION/UNCERTAIN`, the default is **PASS / no new risk** unless the exact Trade Bundle has been specifically admitted for that state.

## 13. V1 fixed-bundle rule

V1 deliberately does **not** use dynamic StrategyComponentPolicy routing.

For each admitted market-family/instrument scope:

- one Core strategy version;
- one fixed Trade Bundle version;
- one TimeframeMap;
- one RegimeModel or explicitly regime-agnostic admission;
- one broker order route policy;
- one ProtectionModel;
- one ExitManagementModel.

If that bundle does not qualify, the result is PASS.

### Synthetic scope

"Synthetic Indices" is not automatically one homogeneous bundle.

Where synthetic products belong to materially different generator/family behaviors, admission is by the appropriate synthetic family/instrument scope. No universal synthetic bundle is assumed.

## 14. Future StrategyComponentPolicy — V1-LG

A future `StrategyComponentPolicy` may choose between **whole already-defined Trade Bundles**, never independent entries/exits/components.

It is not part of the V1 execution path.

Before promotion it requires a separate research policy that defines:

- how related evidence cells may or may not be pooled;
- minimum evidence rules without arbitrary post-hoc selection;
- nested out-of-sample / walk-forward selection;
- holdout isolation;
- multiple-comparison correction or equivalent false-discovery control;
- policy freeze before final evaluation;
- forward/shadow validation;
- degradation/reselection rules.

The selection problem itself must be evaluated. It is not enough that each candidate bundle looked good in isolation.

A StrategyComponentPolicy may return PASS.

## 15. Evidence and attribution

### 15.1 Bundle is the performance unit

Performance/health belongs first to:

`Strategy version + Trade Bundle version + market/instrument/venue + horizon/session + RegimeModel/version + regime state + cost/fill assumptions`.

### 15.2 Component analysis is conditional

A component must not receive an unconditional performance claim such as:

> Retest entry is degrading on Gold.

A valid component comparison must identify what was held fixed, for example:

> Retest entry with the same structural protection and structural-trail exit, on XAUUSD, under the same setup/location/timeframe/regime definition, showed weaker evidence than the comparison route.

Where the rest of the bundle is not held fixed or a valid experimental/comparative design does not exist, the conclusion remains bundle-level.

### 15.3 Sparse matrix problem

Zugrio must not attempt to populate every combination of:
strategy × entry × exit × protection × instrument × session × regime × horizon.

Unsupported cells remain unsupported.

Research should begin from deliberately specified bundles and only expand when there is a reason and enough data.

## 16. Market/instrument admission

Admission binds at least:

- MethodProfile/version;
- TradeBundle/version;
- market family;
- instrument/product;
- venue/feed;
- horizon/session;
- RegimeModel/version and admitted state(s), where applicable;
- TimeframeMap/version;
- BrokerOrderRoute/version;
- cost/slippage/fill model;
- evidence bundle/policy version;
- permitted control mode.

No chart resemblance transfers admission.

## 17. Synthetic-index null hypothesis

For a synthetic product whose generator/process is documented or can be represented by an accepted baseline model, apparent strategy edge must be compared against a generator-matched null/simulation after realistic costs.

Research must ask:

> Does the exact frozen bundle produce evidence beyond what the stated/baseline generating process would create by chance under the same sampling, execution and selection rules?

A positive historical backtest alone is insufficient.

If generator parameters/semantics are unavailable or uncertain, that limitation must be explicit and evidence/admission must remain appropriately conservative.

Institutional-liquidity/SMC causal language must not be imported into designed synthetic products without defensible market-specific meaning.

## 18. Multi-strategy account interaction

Running multiple strategies on the same symbol/account can create:
- doubled exposure;
- offsetting/opposing intent;
- correlation concentration;
- netting-account merge behavior;
- hedging-account position interaction;
- ambiguous attribution.

### V1 rule

Before Auto or any automated multi-strategy capital path exists, **one active Zugrio strategy may own a given account + symbol at a time**.

Signal-only observations may show multiple research cases, but they must remain separately attributable and must not imply simultaneous executable permission.

Semi-Auto must surface conflicts before a second same-symbol strategy intent can be approved.

### Later

Multi-strategy automated execution requires an explicit portfolio/exposure aggregator that understands:
- netting vs hedging account mode;
- strategy attribution under netting;
- correlated exposure;
- existing manual/external positions;
- aggregate risk.

This is later work.

## 19. Core, APA and SMC distinctness

### Core V1

Core V1 uses the TTI APA lineage as its starting strategy grammar, then freezes a specific production bundle per admitted scope.

Core is not "adaptive proprietary routing" in V1.

### Separate APA preset

A separately selectable APA preset must not be advertised as a distinct live strategy while Core substantially represents the same strategy grammar.

If a later APA preset is intended to differ from Core, that difference must be explicit and evidenced.

### APA vs SMC breadth test

Before APA and SMC are both marketed as distinct supported strategies:

- run both exact frozen candidate detectors on the same point-in-time datasets/scopes;
- measure candidate-set overlap and disagreement;
- define the overlap/distinctness acceptance threshold **before** the final evaluation;
- inspect whether differences come from actual governing rules rather than naming;
- if overlap is above the predeclared distinctness threshold without material decision differences, do not present them as two independent supported strategies.

No threshold is invented in this document.

## 20. No V1 strategy-switch recommendation

V1 does not recommend that a trader abandon the selected strategy because another strategy currently has a setup.

Reasons:
- it encourages strategy-hopping;
- it conflicts with the product's process-discipline thesis;
- personalized strategy-switch recommendations may have additional regulatory implications.

A future strategy-discovery/routing feature requires:
- explicit user opt-in/authority;
- behavioral safeguards;
- separate evidence;
- regulatory review.

## 21. Custom Strategy — later

The long-term Custom Strategy builder may capture:

- strategy thesis/name;
- market/instrument/horizon;
- TimeframeMap;
- RegimeModel/applicable states;
- Trade Bundle(s);
- context/news/session constraints;
- risk-policy references;
- expiry/control modes.

AI may structure and expose ambiguity but cannot invent missing rules.

Dynamic custom bundle selection is later and subject to the same research constraints as StrategyComponentPolicy.

## 22. Decision Case continuity

A Decision Case must be capable of preserving:

- market/instrument/venue;
- horizon/session;
- point-in-time RegimeModel/version + regime state;
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
- risk snapshot/policy;
- authority/control mode;
- broker reality;
- process/execution/outcome records.

This gives Zugrio a reconstructable answer to:

> What strategy and exact bundle was being traded, what information existed then, why the entry qualified, how a fill was supposed to occur, what protection/management was frozen, and what actually happened?

## 23. V1 build cut

The architecture above is the long-term map. The first build is much smaller.

### In V1
- Zugrio Core only as the active/admitted strategy surface;
- Core descended from the TTI APA lineage;
- one frozen bundle per admitted FX/Gold/synthetic-family scope;
- Signal mode;
- Semi-Auto mode;
- deterministic chart annotations from the frozen bundle state;
- Decision Case / journal history;
- Strategy Health at bundle/scope level where evidence supports it;
- Process/Execution/Outcome separation;
- Behaviour observations/advisory only;
- broker read-only/reconciliation where available;
- no automatic strategy switching.

### In validation / visible but unavailable where useful
- SMC;
- Trend Following;
- Range / Mean Reversion;
- a separate APA preset only if/when it is demonstrably distinct from Core.

### Later
- StrategyComponentPolicy / adaptive bundle routing;
- Custom Strategy builder;
- component-level optimization/health claims beyond properly controlled bundle comparisons;
- enforcing behavioral guardrails;
- Auto;
- Full Auto;
- automated multi-strategy portfolio execution;
- strategy-switch recommendations;
- strategy marketplace/licensing.

## 24. Public/product language

Public copy may say:
- Zugrio is built to be strategy-aware;
- Core is the first strategy being validated/released;
- additional strategies are in validation where truthful;
- FX, Gold and Synthetic Indices are initial market tracks;
- analysis respects the selected strategy and market context;
- Zugrio records what qualified, what changed and what happened.

It must not say:
- every strategy works everywhere;
- Zugrio dynamically picks the best entry/exit in V1;
- every listed strategy is already supported;
- Core and APA are separate live strategies if they share the same grammar;
- Fibonacci predicts reversals;
- SMC proves institutional orders exist at a chart zone;
- AI improvises entries/exits;
- planned markets are available.

## 25. Research decisions still required

Before the first live-capital/adaptive promotions:
- freeze the first Core Trade Bundle for each intended V1 scope;
- define RegimeModel versions and point-in-time labeling;
- validate fill models for order routes;
- establish synthetic generator-matched/null testing;
- decide exact Core vs future APA semantics;
- define SMC distinctness and run the predeclared overlap test;
- define evidence/admission thresholds;
- define later bundle-pooling/nested-selection research policy;
- verify broker account-mode/netting/hedging behavior;
- resolve implementation prerequisites already tracked in issue #21.

No implementation should fill these with arbitrary defaults.
