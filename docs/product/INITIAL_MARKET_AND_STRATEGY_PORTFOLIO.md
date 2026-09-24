# Initial Market and Strategy Portfolio

Status: **founder-directed product roadmap**  
Issue: #24  
Date: 2026-09-24

This document defines intended initial market/strategy breadth. It does not itself create model applicability, StrategyAdmission, launch readiness or performance evidence.

## 1. Initial market scope

The initial Zugrio product carries three market tracks together:

1. **Forex**
2. **Gold**
3. **Synthetic Indices**

Forex leads acquisition/public narrative because it is the broadest initial retail entry point, but Gold and Synthetic Indices are not secondary future products. They remain visible as parallel initial tracks.

Every track retains independent:
- market-family logic;
- data requirements;
- context requirements;
- cost model;
- instrument behavior;
- model applicability;
- strategy evidence;
- StrategyAdmission;
- broker/execution constraints.

No strategy/model evidence automatically transfers across the three.

## 2. Planned market expansion

Planned markets should be shown separately from initial supported/admitted markets.

### Next expansion families
- **Crypto** — native crypto market support, with spot/perpetual distinctions where relevant.
- **Stocks / Equities** — direct equity-market support with stock-specific data/context/strategy requirements.
- **Broader Commodities** — beyond Gold, including other metals/energy/commodity products only where their market mechanics and feeds are explicitly supported.
- **Traditional Indices** — distinct from designed Synthetic Indices.
- **ETFs**
- **Futures**

### Later specialist family
- **Options** — later because nonlinear payoff, Greeks, expiry, volatility-surface and assignment/exercise semantics require dedicated architecture.

Institutional/FIX is an execution/integration direction, not a public market category.

Public UI may show planned markets in a visually secondary "planned/coming" state, but must not imply current support, admission or launch date without evidence.

## 3. Initial strategy portfolio

Zugrio should not launch conceptually as a one-strategy system.

### First-party baseline
- **Zugrio Core** — proprietary first-party baseline. First-party ownership does not bypass evidence/admission.

### Four initial selectable strategy families

1. **Advanced Price Action (APA)**
   - Existing TTI lineage provides the strongest current specification.
   - Current experimental grammar includes structure, BOS/CHoCH, displacement, FVG/causal origin, retracement/location, retest/reaction and invalidation.
   - The legacy implementation remains evidence/research input; it is not automatically a Zugrio-admitted production strategy.

2. **Smart Money Concepts (SMC)**
   - Separate, precise Zugrio implementation required.
   - May consume structure, liquidity, order-block/imbalance and session concepts, but must not merely rename APA.
   - Exact rule contract must identify how it differs from APA.

3. **Trend Following**
   - Distinct strategy family based on persistent directional state, pullback/continuation or trend-resumption logic.
   - Requires explicit trend definition, entry timing, invalidation, regime applicability and cost/evidence policy.

4. **Range / Mean Reversion**
   - Distinct strategy family for equilibrium/range/reversion behavior.
   - Requires explicit range/equilibrium definition, overextension/reversion conditions, invalidation and regime applicability.

These four were selected as an initial roadmap because they are recognizable retail strategy families and, more importantly, represent materially different decision grammars rather than four overlapping setup labels.

## 4. What is not a separate launch strategy family

The following may be important but should not automatically become top-level strategy names:

- **Breakout / breakout-retest** — can be a setup/entry archetype used by APA, Trend Following or other strategies unless a genuinely separate strategy contract is justified.
- **Liquidity sweep, FVG, order block, pullback, retest** — setup/evidence/entry concepts, not necessarily full strategies.
- **Scalping, day trading, swing trading** — horizons/trading styles, not strategy logic by themselves.
- **ICT** — overlaps materially with SMC concepts and carries naming/IP/person-specific concerns; do not duplicate it as a public launch strategy without a deliberately distinct implementation and legal/naming review.
- **Order Flow** — valid later strategy family but feed/microstructure requirements differ materially across spot FX, Gold and Synthetic Indices. It should not be promised until suitable data exists across intended scope.
- **Wyckoff, Supply & Demand, Momentum, Breakout, Market/Auction Profile** — remain candidate future strategy families from the legacy TTI registry, subject to prioritization and evidence.

## 5. Strategy implementation rule

A public strategy label has zero operational meaning until Zugrio defines an exact versioned implementation.

For every selectable strategy:
- create a MethodProfile/version;
- define supported Setup Models;
- define Location Models (including retracement/reference rules where applicable);
- define Entry Model contracts;
- define Protection Models;
- define Exit / Position-Management Models;
- define any permitted StrategyComponentPolicy for adaptive component selection;
- define invalidation/expiry;
- define market/instrument/horizon/regime applicability;
- define context dependencies;
- produce evidence bundles;
- complete StrategyAdmission by exact scope;
- expose evidence/readiness honestly in the UI.

Detailed component taxonomy: `docs/product/STRATEGY_EXECUTION_COMPONENT_TAXONOMY_V1.md`.

The same strategy family may be admitted in Forex but unavailable in Gold or Synthetics until separate evidence clears. Likewise, one Entry/Exit component combination may be admitted for EURUSD in a trend regime while another combination remains research-only.

Platform representability must never be described as proof that every strategy works on every market or regime.

## 6. Launch positioning rule

Target product story:

> Zugrio is strategy-aware, beginning with Zugrio Core plus four defined strategy families: Advanced Price Action, Smart Money Concepts, Trend Following and Range/Mean Reversion.

This becomes a public support claim only for strategies and scopes that have actually cleared implementation/evidence/admission.

Before that point, copy should distinguish:
- **available/admitted**;
- **in validation**;
- **planned**.

"Bring your own plan" remains separate from the admitted strategy portfolio.

## 7. Chart annotation implication

Live annotations are strategy-specific.

The chart should not show generic labels such as BOS, FVG, overextended or trend confirmed unless the active strategy/Entry Model defines those states and the source evidence supports them.

Switching strategy can therefore change:
- which market facts are relevant;
- which annotations appear;
- what counts as a forming/qualified setup;
- entry geometry;
- invalidation;
- what context is required.

Strategy selection must be substantive, not cosmetic.
