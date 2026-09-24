# Strategy and Execution Component Taxonomy v1

Status: **founder-directed product/architecture specification for review**  
Issue: #26  
Date: 2026-09-24

This document defines how Zugrio separates strategy from setup, location, entry, protection, exit/management, risk and authority. It does not itself admit any strategy/component combination, establish profitability, define numeric thresholds or modify frozen capital authority.

## 1. Why this separation is required

A trading strategy is not the same thing as an entry technique, exit technique, Fibonacci level, broker order type, risk rule or control mode.

One strategy may support several entries and several exits. The same entry archetype may be useful inside multiple strategies. A tool such as Fibonacci may help locate a retracement or target without being a standalone strategy or signal.

Zugrio therefore needs a compositional model that can answer:

- **What am I trying to exploit?** — strategy.
- **What opportunity is forming?** — setup.
- **Where is the relevant price area?** — location/reference.
- **What must happen before entry is valid?** — entry/trigger.
- **How is the order expressed to the broker?** — execution route/order style.
- **What proves the idea wrong and protects capital?** — protection.
- **How is an open winner/loss managed and exited?** — exit/management.
- **How much risk is permitted?** — risk policy.
- **Who/what may act?** — control/authority.
- **Where/when does this combination apply?** — market, instrument, horizon, session, regime and context.

No one layer may silently substitute for another.

## 2. Three product strategy sources

### 2.1 Zugrio Core

Zugrio's proprietary first-party strategy.

Core may be a composite/adaptive strategy internally, but any component routing must be:
- explicit in the exact Core version;
- bounded to admitted market/instrument/horizon/regime scopes;
- supported by evidence;
- reconstructable after the fact;
- unable to invent a new component during a live Decision Case.

"Adaptive" must never mean unversioned self-modification.

### 2.2 Zugrio-supported preset strategies

Initial roadmap:
- Advanced Price Action (APA);
- Smart Money Concepts (SMC);
- Trend Following;
- Range / Mean Reversion.

Each preset is Zugrio's precise, versioned implementation of that family. Selecting a public label never imports an undefined internet/community interpretation.

Each preset defines:
- its thesis/decision grammar;
- setup families;
- location/reference models;
- allowed entry models;
- allowed protection models;
- allowed exit/management models;
- context/regime requirements;
- market/instrument/horizon applicability;
- evidence/admission state.

### 2.3 User-defined custom strategy

A user may define a strategy using supported structured components plus explicit custom conditions where Zugrio can represent them.

A custom strategy may progress through:
- draft;
- structured;
- evaluatable;
- evidence-assessed;
- shadow/forward-observed where required;
- admitted for a stated use/scope;
- review/suspended/superseded.

Custom ownership remains visible. Monitoring does not equal Zugrio endorsement.

## 3. Strategy Profile

The existing immutable/versioned `MethodProfile` remains the canonical strategy definition object for engineering compatibility. Public language uses **strategy**.

A MethodProfile should reference:

```text
methodProfileId
methodVersion
strategySourceClass
strategyFamily
market/product applicability
instrument/venue scope
timeframes/horizons
permittedRegimes[]
setupModelIds[]
locationModelIds[]
entryModelIds[]
entrySelectionPolicyId
protectionModelIds[]
exitManagementModelIds[]
exitSelectionPolicyId
requiredEvidenceContracts[]
contextRequirements[]
invalidationRules[]
riskPolicyRefs[]
executionModePermissions[]
createdAt
supersedes
```

The presence of a component ID means "permitted by this strategy version", not "admitted everywhere".

## 4. Setup model

A setup describes the opportunity pattern/state that the strategy is interested in.

Examples of normalized setup archetypes may include:
- trend continuation;
- structural reversal;
- breakout/expansion;
- range rejection;
- liquidity sweep/reclaim;
- imbalance/FVG mitigation;
- supply/demand or order-block reaction;
- compression-to-expansion.

These are a taxonomy, not automatic universal setups. A strategy may define a narrower or more specific version.

A setup model must define:
- required prior state;
- formation conditions;
- completion/qualification state;
- invalidation;
- expiry;
- supported scope;
- provenance.

## 5. Location / reference model

A LocationModel answers **where** an otherwise relevant opportunity becomes interesting.

Examples:
- structural support/resistance or prior swing;
- range boundary/equilibrium;
- percentage/Fibonacci retracement band;
- Fibonacci extension target;
- FVG/imbalance zone;
- order-block/supply-demand zone;
- volatility-normalized band;
- moving reference such as an admitted moving-average/VWAP-style reference where data/support exists.

### Fibonacci rule

Fibonacci is a **location/measurement model**, not a standalone strategy and not a standalone buy/sell signal.

A strategy may use Fibonacci:
- to define a retracement band;
- as confluence with other location evidence;
- to help define stop/reference geometry;
- to help define target/extension geometry.

The active strategy version determines:
- whether Fibonacci is used at all;
- which anchor construction is valid;
- which levels/bands matter;
- whether it is required or merely supporting evidence.

The existing APA lineage's 50–61.8% "golden zone" is therefore an APA-specific research rule, not a global Zugrio truth.

## 6. Entry model

An EntryModel answers **what must happen before the setup becomes actionable**.

Normalized initial entry archetypes should include:

1. **Break-and-go confirmation**
   - fresh confirmed break/expansion;
   - no required retest when the exact strategy permits this route.

2. **Classic retest confirmation**
   - break/level event;
   - return to the relevant level/zone;
   - strategy-defined confirmation/reclaim/reaction.

3. **Pullback / retracement entry**
   - shallow, medium or deep location is supplied by a LocationModel;
   - the EntryModel defines the confirmation/timing, not the percentage itself.

4. **Sweep-and-reclaim entry**
   - excursion beyond a strategy-defined level;
   - close/reclaim/reaction according to the strategy contract.

5. **Zone mitigation/reaction entry**
   - return into an admitted FVG/imbalance/order-block/supply-demand zone;
   - required reaction/confirmation depends on strategy.

6. **Range-edge rejection entry**
   - strategy-defined range/equilibrium state;
   - test/rejection/reversion trigger at a boundary.

This is an extensible catalog. New EntryModels require versioned contracts and evidence.

### Legacy TTI mapping

Legacy TTI research already contains candidate routes:
- BREAK_AND_GO;
- SHALLOW_PULLBACK;
- MEDIUM_PULLBACK;
- DEEP_RETRACEMENT;
- CLASSIC_RETEST;
- PASS.

Those are research lineage inputs, not automatically admitted Zugrio EntryModels. Shallow/medium/deep should generally be represented as location/retracement bands combined with an entry/trigger contract rather than three unrelated top-level strategies.

## 7. Trigger versus broker order route

The event that validates an entry is separate from how the broker order is expressed.

Examples of broker entry routes:
- market-on-confirmation;
- limit order at a qualified zone;
- stop order beyond a trigger/break level;
- prepared intent requiring Semi-Auto approval.

Order route selection must account for:
- spread;
- slippage;
- minimum distance/order rules;
- quote freshness;
- broker capabilities;
- entry drift;
- control mode.

A strategy or EntryModel may restrict allowed order routes.

No broker order type proves that the strategy entry was valid.

## 8. Protection model

Protection is separated from profit-taking because risk reduction must retain priority.

A ProtectionModel defines the initial thesis/risk boundary, for example:
- structural invalidation stop;
- structural stop plus admitted volatility buffer;
- volatility-derived stop where the strategy explicitly permits it;
- maximum-risk failsafe/catastrophic boundary.

Protection may only be tightened/changed according to governed policy.

A strategy must not use an arbitrary fixed stop merely to make reward/risk appear attractive.

## 9. Exit / position-management model

An ExitManagementModel defines how an open position is harvested, reduced or closed after entry while preserving the strategy thesis and safety rules.

Initial normalized exit/management components should include:

### Profit-target models
- fixed-R target;
- structure target;
- opposing range boundary/equilibrium;
- liquidity/reference target;
- admitted extension target.

### Scale/management models
- partial scale-out at a defined milestone;
- break-even transition after a defined event;
- structural trailing stop;
- volatility/ATR trailing stop;
- broker-side trailing stop where supported.

### State/time exits
- thesis invalidation / hard stop;
- time/session expiry;
- opposite strategy-state exit only where explicitly validated;
- risk/safety emergency reduction/close under governing safety policy.

One strategy may permit multiple exit models. The selected model must be known before or at entry according to policy and remain reconstructable.

### Legacy TTI mapping

Legacy TTI/cTrader work contains a specific management policy:
- hard broker-side SL/TP;
- 50% partial at configurable 1.0R or 1.5R;
- break-even only after partial confirmation;
- broker-side trailing from 1.5R with a 0.75R distance;
- structural invalidation before that progress.

This is useful engineering/research lineage. It is **not** a universal Zugrio exit model and must be separately validated per strategy/instrument/scope before reuse.

## 10. Strategy component policy

A strategy may permit several EntryModels and ExitManagementModels. Zugrio therefore needs a versioned StrategyComponentPolicy.

The policy answers:

> Given the selected strategy, market, instrument, horizon, current regime/context and available evidence, which permitted component combination is applicable now?

It may select only from components already permitted by the exact MethodProfile version.

It must bind to:
- exact MethodProfile version;
- market family;
- instrument/product/venue;
- horizon/timeframe;
- regime/context scope;
- setup model;
- location model;
- entry model;
- protection model;
- exit/management model;
- evidence/admission artifacts;
- effective policy version.

The policy may return **PASS / no compatible route**.

It must not invent a route because every permitted route currently fails.

## 11. Strategy selection versus component selection

These are different user/system decisions.

### User selects a preset strategy
Example: SMC.

Zugrio may choose among **SMC-permitted** entries/exits only where the SMC component policy is admitted for that scope.

It may not silently switch the trader to Trend Following because the current market is trending.

It may instead say:
- no SMC setup qualifies;
- SMC is not admitted in this scope/regime;
- another supported strategy currently has an evidence-supported compatible state, if recommendation features are enabled.

### User selects Zugrio Core
Core may internally route among Core's permitted components/market specialists because that adaptive routing is part of the proprietary strategy itself.

### User selects Custom Strategy
Zugrio follows the exact custom version. It may recommend a change, but it cannot silently rewrite the strategy. Accepting a material change creates a new version and new evidence path.

### Future strategy-routing mode

If Zugrio later lets the system choose *between* whole strategy families, that capability is a distinct first-party meta-strategy / StrategyRouter, not an invisible behavior of ordinary strategy selection. It requires separate evidence, admission and user authority.

## 12. Regime and contextual applicability

Regime is an applicability input, not an after-the-fact explanation.

Possible normalized regime concepts may include:
- trending;
- ranging;
- expansion/high directional volatility;
- compression/low volatility;
- transition/uncertain;
- event/discontinuity-sensitive;
- specialist synthetic-family states.

Exact regime semantics are market/model specific and versioned.

A strategy/component combination may be:
- admitted in one regime;
- unsupported in another;
- under review in a third.

External evidence also supports the general principle that strategy type interacts with market condition: trend systems can suffer in choppy/range-bound markets while range systems can fail when ranges break. Zugrio must establish its own evidence for exact implementations rather than importing those general statements as performance claims.

## 13. Market and instrument applicability

"Works in Zugrio" means **representable by the platform**, not profitable or admitted on every instrument.

For every strategy/component combination, admission should be capable of binding:
- market family;
- instrument/product;
- venue/feed;
- horizon;
- session;
- regime;
- cost/slippage model;
- EntryModel;
- ProtectionModel;
- ExitManagementModel.

Examples of why this matters:
- a trend-following strategy may be structurally inappropriate in a measured range state;
- a range-reversion strategy may be inappropriate during an admitted expansion state;
- Order Flow requires suitable microstructure/order-book evidence that may not exist for spot FX or a synthetic generator;
- SMC language about institutional order flow/liquidity cannot simply be asserted for designed Synthetic Indices. Synthetic-specific implementations must use semantics/evidence appropriate to the generator/market family rather than fictional institutional causality.

No chart resemblance overrides these constraints.

## 14. Initial strategy/component hypotheses

The following are **research starting mappings**, not admissions.

| Strategy | Candidate setup/location/entry components | Candidate exit/management emphasis |
| --- | --- | --- |
| Zugrio Core | Proprietary market-/regime-specific component routing | Proprietary admitted management policy by scope |
| APA | structure + displacement; FVG/causal zone; retracement; retest/reaction; possible break-and-go route | structural invalidation; structure/R targets; partial/trailing candidates |
| SMC | structure/liquidity; sweep/reclaim; FVG/imbalance; order-block/mitigation; optional retracement confluence | structural invalidation; liquidity/structure targets; partial/trailing candidates |
| Trend Following | trend continuation; pullback/retracement; break-and-go; breakout/retest | structural/volatility protection; trailing/scale-out; trend-state exit candidates |
| Range / Mean Reversion | range/equilibrium; edge rejection; sweep/reclaim; overextension/reversion | boundary/equilibrium/opposite-edge targets; structural stop; time/failed-range exit |

Every row requires research by market/instrument/horizon/regime. No row is a profitability claim.

## 15. Custom Strategy Builder

The Custom Strategy experience should eventually allow a trader to define:

- strategy thesis/name;
- market/instrument/horizon scope;
- permitted regimes;
- setup conditions;
- location/reference rules;
- entry/trigger models;
- broker entry-route preference;
- invalidation/protection model;
- target/exit-management model;
- context/news/session rules;
- risk-policy references;
- expiry;
- allowed control modes.

AI may assist structuring and expose ambiguity but cannot invent missing rules.

### Adaptive component option

A custom-strategy author may eventually allow Zugrio to choose among a bounded list of user-approved entry/exit components.

That option requires:
- explicit user authorization;
- exact component list;
- deterministic/versioned selection policy;
- evidence by scope;
- no silent expansion of the component set.

## 16. Continuous research and health

Strategy Health should support drill-down by:
- strategy version;
- market;
- instrument;
- horizon;
- session;
- regime;
- setup model;
- location model;
- entry model;
- protection model;
- exit/management model.

This allows Zugrio to investigate questions such as:
- whether a strategy remains supported overall;
- whether one entry route degrades on a specific instrument;
- whether one exit policy is overly sensitive to volatility/costs;
- whether evidence is concentrated in one regime.

The system must guard against false discovery from slicing the same data repeatedly. Component-level conclusions require versioned research policy, adequate evidence, out-of-sample/forward validation where appropriate and explicit multiple-testing/data-mining controls.

A health finding does not silently rewrite a live strategy. Material changes create a new strategy/component-policy version and pass through the evidence/admission lifecycle.

## 17. Decision Case continuity

A Decision Case should be able to preserve references to:

- market/instrument/horizon;
- regime/context state;
- MethodProfile/version;
- StrategyAdmissionRecord;
- StrategyComponentPolicy/version;
- setup model/version;
- location model/version;
- EntryModel/version;
- broker entry route;
- ProtectionModel/version;
- ExitManagementModel/version;
- risk snapshot/policy;
- authority/control mode;
- broker reality;
- process/execution/outcome records.

This gives Zugrio a complete answer to:

> What strategy was being traded, why this setup qualified, where the entry came from, why this entry route was chosen, how the position was meant to be managed, what changed, and what actually happened?

## 18. Public/product language

Public copy may say:
- choose a supported strategy;
- use Zugrio Core;
- bring/structure your own strategy;
- Zugrio adapts analysis to the selected strategy and supported market context.

It must not say:
- every strategy works everywhere;
- Zugrio automatically finds the universally best strategy;
- Fibonacci predicts reversals;
- SMC proves institutional orders exist at a chart zone;
- a planned strategy/component is already admitted;
- AI improvises entries/exits.

## 19. Research decisions still required

Before implementation/admission:
- finalize exact APA versus SMC semantic boundary;
- define each normalized setup model;
- define exact entry-model contracts;
- define ProtectionModel contracts;
- define ExitManagementModel contracts;
- define regime taxonomy per market family;
- define StrategyComponentPolicy selection semantics;
- establish entry/exit component evidence requirements;
- determine which management policies can transfer from legacy TTI only after replay/forward validation;
- determine which components are valid for each synthetic family;
- determine which feeds are sufficient for Order Flow or volume-dependent models;
- determine how component-health multiple-testing is controlled.

No implementation should fill these with arbitrary defaults.
