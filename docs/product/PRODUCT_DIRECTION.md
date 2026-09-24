# Zugrio Product Direction

Status: **founder-directed product scope for Zugrio 1.0**. This document describes the intended product surface and sequencing. It does not itself claim implementation, validation or release readiness.

## 1. Product spine

Zugrio should carry a trading method through the full decision lifecycle:

```text
METHOD / STRATEGY PROFILE
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
   ├── outcome
   └── process / method adherence
```

The reason for a trade must remain connected to the decision to act as facts change.

## 2. Initial market scope

Zugrio 1.0 is not forex-only.

The initial product scope carries these tracks **in parallel**:

- **Forex** — first in public positioning and primary launch narrative.
- **Gold** — included in the initial market scope, with its own data, cost, session and calibration requirements.
- **Synthetic indices** — retained as a first-class initial product track because Zugrio's lineage began there and dedicated synthetic-market logic/evidence already exists.

Public messaging may lead with forex, but product scope must not silently demote gold or synthetics to a future version.

No edge, calibration, threshold, execution assumption or cost model automatically transfers between forex, gold and synthetics. Each remains separately scoped and validated.

## 3. Entry logic must be extensible

The product must not imply that entry logic is exhausted by examples such as retests, shallow pullbacks, breakouts or any other short list.

Those may be examples of entry behavior, not the architecture's complete taxonomy.

Zugrio should represent entry logic through explicit, versioned **entry-condition / entry-model contracts** that can support multiple strategy-specific entry archetypes without changing the authority architecture.

Requirements:

- entry logic is strategy-aware;
- multiple entry archetypes may coexist;
- new entry logic must be addable without rewriting Decision Core authority boundaries;
- marketing copy should avoid presenting a small illustrative list as exhaustive;
- a strategy profile may declare which entry models it permits;
- entry models remain subordinate to structure, evidence, economics, risk and execution authority.

Do not invent unsupported entry archetypes merely to populate UI copy.

## 4. Method / strategy profiles

A future-proof Zugrio 1.0 domain should include versioned Strategy/Method Profiles rather than assuming one universal method.

A profile may eventually bind:

- market/product scope;
- timeframe/horizon;
- setup family;
- admissible entry models;
- required evidence/context;
- invalidation rules;
- execution-control preferences;
- risk/account policy references.

Every decision should be traceable to the exact strategy/method version that governed it.

Manual overrides and deviations should be recordable so post-trade review can distinguish outcome from process adherence.

User-authored strategies must not become Zugrio-admitted signal or automation sources merely because they can be represented. Strategy definition, evidence assessment and admission are separate. See `docs/product/STRATEGY_HEALTH_AND_BEHAVIOR_GUARDRAILS.md` and ADR-0004.

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
- strategy evidence/admission status;
- separate Strategy Health, Process / Behavior Health and financial Outcome;
- factual behavioral observations and user-defined guardrails.

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

## 8. Strategy health and behavioral discipline

Zugrio should help distinguish three separate questions:

1. **Strategy Health** — what evidence supports this exact strategy version in this exact scope?
2. **Process / Behavior Health** — did the trader/system follow the declared process, and what observable deviations recur?
3. **Outcome** — what financially happened?

These must remain separate. Profit does not validate a rule violation; loss does not by itself invalidate a compliant process or strategy.

Behavioral intervention is mode-aware:
- Signal can inform, explain and later compare broker-observed behavior but cannot claim to prevent independent broker actions;
- Semi-Auto can add review/friction or block a prepared Zugrio intent under explicit governed rules;
- Auto/Full Auto can enforce only inside delegated authority and cannot widen that authority.

A user strategy may be recorded or monitored before it is admitted for Zugrio-generated signals. Admission requires evidence appropriate to the stated strategy/version/market/horizon/control use. Missing quantitative thresholds remain research questions rather than invented defaults.

Detailed requirements: `docs/product/STRATEGY_HEALTH_AND_BEHAVIOR_GUARDRAILS.md`.

## 9. Product communication

External copy should lead with useful assistance, not only restriction:

> opportunity + judgment + disciplined action

The product should demonstrate both:
- an opportunity progressing correctly when evidence remains valid; and
- a setup being held, invalidated or blocked when facts no longer support action.

Avoid presenting Zugrio as merely a denial engine, signal group, generic chatbot or infallible autonomous trader.

## 10. Brand / engineering separation

The current landing page is a migration-equivalence baseline, not approved permanent brand identity.

Current colors, logo concepts, typography and taglines may be preserved during HTML → Next.js migration solely to prove behavioral/visual equivalence. Canonical brand tokens should only be created after deliberate founder approval and accessibility validation.
