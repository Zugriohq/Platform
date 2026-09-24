# Zugrio Product Direction

Status: **founder-directed product scope for Zugrio 1.0**. This document describes the intended product surface and sequencing. It does not itself claim implementation, validation or release readiness.

**Build boundary:** `docs/product/V1_BUILD_CUT_AND_ARCHITECTURE_FREEZE.md` governs what is actually built first.

## 1. Product spine

Zugrio should carry a trading method through the full decision lifecycle:

```text
METHOD / STRATEGY PROFILE
        ↓
STRATEGY EVIDENCE / ADMISSION
        ↓
OPPORTUNITY DISCOVERY
        ↓
STRUCTURE + EVIDENCE
        ↓
ENTRY CONDITIONS / CURRENT ECONOMICS
        ↓
CONTEXT EVIDENCE
        ↓
ACCOUNT + RISK CONSTRAINTS
        ↓
AUTHORITY / PERMISSION
        ↓
ACT / WAIT / PASS
        ↓
PROTECTION + RECONCILIATION
        ↓
REVIEW
   ├── strategy health
   ├── decision / process adherence
   ├── execution adherence
   ├── behaviour health
   └── financial outcome
```

The reason for a trade must remain connected to the decision to act as facts change.

## 2. Initial market scope

Zugrio 1.0 is not forex-only.

The initial product scope carries these tracks **in parallel**:

- **Forex** — first in public positioning and primary launch narrative.
- **Gold** — included in the initial market scope, with its own data, cost, session and calibration requirements.
- **Synthetic indices** — retained as a first-class initial product track because Zugrio's lineage began there and dedicated synthetic-market logic/evidence already exists.

Public messaging may lead with forex, but product scope must not silently demote gold or synthetics to a future version. The first-screen market scope should keep **FX · Gold · Synthetic Indices** visible together.

No edge, calibration, threshold, execution assumption or cost model automatically transfers between forex, gold and synthetics. Each remains separately scoped and validated.

### Planned market expansion

The product architecture should preserve a clear distinction between initial markets and planned expansion.

Planned expansion families:
- **Crypto** — with spot/perpetual distinctions where relevant;
- **Stocks / Equities**;
- **broader Commodities** beyond Gold;
- **traditional Indices**, distinct from Synthetic Indices;
- **ETFs**;
- **Futures**.

**Options** remain a later specialist family because nonlinear payoff, Greeks, expiry and exercise/assignment semantics require dedicated architecture.

Public UI may show planned markets in a visually secondary planned/coming state, but must not imply they are currently supported, admitted or tied to a launch date without evidence.

Detailed roadmap: `docs/product/INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md`.

## 3. Entry logic must be extensible

The product must not imply that entry logic is exhausted by examples such as retests, shallow pullbacks, breakouts or any other short list.

Those may be examples of entry behaviour, not the architecture's complete taxonomy.

Zugrio should represent entry logic through explicit, versioned **entry-condition / entry-model contracts** that can support multiple strategy-specific entry archetypes without changing the authority architecture.

Requirements:

- entry logic is strategy-aware;
- multiple entry archetypes may coexist;
- new entry logic must be addable without rewriting Decision Core authority boundaries;
- marketing copy should avoid presenting a small illustrative list as exhaustive;
- a strategy profile may declare which entry models it permits;
- entry models remain subordinate to structure, evidence, economics, risk and execution authority.

Do not invent unsupported entry archetypes merely to populate UI copy.

### Strategy component stack

The product must not collapse the following into one concept:

```text
Strategy
  ↓
Setup
  ↓
Location / reference
  ↓
Entry / trigger
  ↓
Broker order route
  ↓
Protection
  ↓
Exit / position management
  ↓
Risk
  ↓
Authority
```

Market, instrument, horizon, regime and context constrain the whole stack.

A strategy may eventually define multiple TradeBundles, but **V1 does not dynamically mix or select entry/exit components**. The unit of evidence/admission is a complete frozen TradeBundle: setup + location + entry + broker route + protection + exit/management + timeframe map + regime model.

Fibonacci/retracement is a location/measurement tool when a strategy uses it; it is not a standalone Zugrio strategy or universal signal.

The same platform can represent many strategy families, but no strategy/bundle is assumed to work across every instrument/regime. Exact frozen bundles require scope-specific evidence/admission.

A future StrategyComponentPolicy may choose only among whole pre-defined bundles and is V1-LG after a dedicated anti-overfitting research policy.

Detailed taxonomy: `docs/product/STRATEGY_EXECUTION_COMPONENT_TAXONOMY_V1.md`.

## 4. Method / strategy profiles

A future-proof Zugrio 1.0 domain should include versioned Strategy/Method Profiles rather than assuming one universal method.

A profile may eventually bind:

- market/product scope;
- horizon;
- timeframe map;
- regime model;
- permitted TradeBundle versions;
- required evidence/context;
- invalidation rules;
- execution-control preferences;
- risk/account policy references.

Every decision should be traceable to the exact strategy/method version that governed it.

Manual overrides and deviations should be recordable so post-trade review can distinguish outcome from process adherence.

Strategy representation, evidence, admission and health are separate concepts. A strategy being user-authored, machine-readable or historically testable does not make it admitted for Zugrio-generated signals or automation. First-party strategies do not bypass evidence requirements.

Zugrio 1.0 should support four product truths without collapsing them:

- **strategy health** — what evidence supports the exact strategy version in the declared scope;
- **decision/process adherence** — whether the declared decision process was followed;
- **execution adherence** — whether actual broker action matched the planned/approved action;
- **financial outcome** — what happened economically.

### Initial strategy portfolio direction

Zugrio should not be positioned as a one-strategy product.

The longer-term strategy roadmap retains **Zugrio Core** plus four named strategy families:

1. **Advanced Price Action (APA)**;
2. **Smart Money Concepts (SMC)**;
3. **Trend Following**;
4. **Range / Mean Reversion**.

V1 activates **Zugrio Core only**, using the strongest TTI APA lineage as the starting strategy grammar and one fixed TradeBundle per admitted scope. SMC, Trend Following and Range / Mean Reversion remain in validation; a separate APA preset is not presented as distinct from Core until distinctness is demonstrated.

Each future preset requires its own exact MethodProfile/version, frozen TradeBundle(s), market/horizon/regime scope, evidence and StrategyAdmission.

Breakout/retest, liquidity sweeps, FVGs, pullbacks and similar concepts should remain setup/evidence/entry archetypes where they cut across strategy families rather than being duplicated as top-level strategies without distinct governing logic.

Detailed direction: `docs/product/STRATEGY_BEHAVIOUR_HEALTH_V1.md` and `docs/product/INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md`.

## 5. Context intelligence

Context evidence is broader than news.

Relevant Zugrio 1.0 context includes, where supported and properly sourced:

- scheduled **macroeconomic events** and economic-calendar data;
- breaking/market-moving news;
- trading session and session transitions;
- geography/jurisdiction/market-center context where it materially affects a market;
- cross-market / related-market evidence;
- venue/product trading conditions.

Context inputs must be sourced, timestamped, freshness-aware and provenance-bound.

Context does **not** bypass capital authority. It is evidence that can inform features, model/policy inputs or explicit veto conditions only through governed contracts.

## 6. V1 versus later

Do not defer a capability merely because the current implementation is incomplete.

Use three distinctions:

### A. V1 foundational scope
Must be represented correctly in architecture/domain contracts now, even if implementation arrives in stages before launch.

Examples:
- forex + gold + synthetics;
- extensible entry models;
- strategy/method profiles;
- macro/news/session context;
- broker-neutral execution contracts;
- signal / semi-auto / auto authority modes;
- process-adherence review;
- strategy evidence/admission and strategy-health representation;
- behaviour-health analytics and advisory/confirmation guardrails;
- monitored declared plans for discretionary traders where the thesis itself is not independently validated.

### B. V1 launch-readiness gate
A foundational capability may exist in the V1 design but remain unavailable to users until evidence, safety or integration requirements are satisfied.

Example: a control mode can belong to V1 architecture while public activation remains gated.

### C. Post-V1 product expansion
Reserve this label only for capabilities that genuinely require a different product domain or substantially new operating model.

Examples may include mature allocator/team administration, full AUM operations, options-specific nonlinear risk workflows, or other domains that are not required for the initial trader product.

Do not use “future version” as a substitute for unresolved design work.

## 7. Launch audience

Primary launch audience:
- serious self-directed traders;
- forex, gold and synthetic-index traders;
- including prop-account traders where account-rule integrations are actually verified.

Expansion audience:
- trading teams and allocators.

Capital-team governance remains an architectural direction without implying released team, allocation, custody or AUM workflows.

## 8. Product communication

External copy should lead with useful assistance, not only restriction:

> opportunity + judgment + disciplined action

The product should demonstrate both:
- an opportunity progressing correctly when evidence remains valid; and
- a setup being held, invalidated or blocked when facts no longer support action.

Avoid presenting Zugrio as merely a denial engine, signal group, generic chatbot or infallible autonomous trader.

Behaviour analytics must remain factual and evidence-backed. Zugrio may identify observable deviations from a declared plan, but it must not present inferred emotions as facts.

A user-defined strategy may be monitored and evaluated without borrowing Zugrio's credibility. Public/product language must distinguish:
- the user's own plan or strategy conditions;
- Zugrio-supported/admitted strategy logic;
- current strategy-health evidence;
- execution authority.

Advisory/confirmation guardrails may help a trader notice repeated deviations. Any behavioural rule that can block a capital action through Zugrio is a capital-relevant policy and remains launch-gated until explicitly integrated and accepted.

## 9. Brand / engineering separation

The current landing page is a migration-equivalence baseline, not approved permanent brand identity.

Current colors, logo concepts, typography and taglines may be preserved during HTML → Next.js migration solely to prove behavioural/visual equivalence. Canonical brand tokens should only be created after deliberate founder approval and accessibility validation.
