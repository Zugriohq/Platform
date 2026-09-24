# Strategy Health, Strategy Admission and Behaviour Guardrails v1

Status: **founder-directed product specification for architecture review**.  
Issue: #15.  
This document defines intended product/domain behaviour. It does not itself alter the frozen Signal Authority Architecture, activate live-capital behaviour, establish strategy profitability, or define numeric admission thresholds.

## 1. Purpose

Zugrio is intended to improve the quality and consistency of a trader's process across opportunity discovery, strategy qualification, current market/context evaluation, entry timing, account/risk constraints, execution, behaviour review and learning.

Two failure modes must remain separate:

1. **The strategy may be weak, out of scope, unvalidated or degraded.**
2. **The trader may deviate from a soundly declared process.**

A disciplined trader can execute a poor strategy consistently. A profitable outcome can also occur after a poor decision or rule violation. Zugrio therefore must not reduce trading quality to P/L, a single strategy score, or a single behaviour score.

This specification introduces two connected but independent product domains:

- **Strategy Health & Admission**
- **Behaviour Health & Guardrails**

## 2. Non-negotiable boundaries

### 2.1 No representation-to-authority shortcut

A strategy being entered, imported, described, structured or machine-readable does **not** make it:

- validated;
- profitable;
- model-admitted;
- suitable for a market;
- eligible for Zugrio-generated signals;
- eligible for Semi-Auto, Auto or Full Auto;
- capital-authoritative.

### 2.2 No invented evidence thresholds

This specification intentionally does not invent:

- minimum trade counts;
- minimum win rates;
- minimum expectancy;
- maximum drawdown;
- pWin thresholds;
- confidence thresholds;
- degradation thresholds;
- required forward-observation duration.

Any threshold that affects strategy admission or capital authority must come from a versioned evidence/validation policy supported by research and review.

### 2.3 No emotion inference as fact

Broker and decision records can establish observable facts such as:

- entry before declared confirmation;
- entry outside a declared zone;
- changed risk;
- repeated re-entry;
- early exit;
- override;
- manual intervention;
- action after a declared daily/session limit.

Those records do **not** prove fear, greed, impatience, revenge, tilt or another internal state.

AI or product copy may invite reflection, but must not convert an inferred emotion into an authoritative fact.

### 2.4 Non-custodial does not mean omnipotent

Customer capital remains at the broker.

A broker connection may provide read-only data, delegated execution authority, or both, depending on the integration and user authorization.

Zugrio can govern only actions that pass through authority it actually has. In Signal mode, or whenever a user acts directly in the broker outside Zugrio's execution path, Zugrio may observe and review the action where data access exists; it must not claim that it could have blocked the external broker action.

Non-custodial architecture is a product/custody boundary, not a declaration that Zugrio is outside financial regulation. Regulatory classification depends on activity, control mode, market and jurisdiction and must be assessed separately.

### 2.5 AI is explanatory/structuring assistance, not evidence authority

AI may help:

- translate natural-language strategy descriptions into a draft structured representation;
- identify ambiguous strategy statements and ask for clarification;
- explain deterministic strategy state;
- explain strategy-health evidence already produced by governed analytics;
- explain behavioural observations and guardrails;
- answer questions about a current Decision Case using provenance-bound data.

AI may not:

- invent model applicability;
- invent historical performance;
- invent missing market/context evidence;
- create capital authority;
- convert a user description directly into an admitted live strategy;
- overwrite deterministic adherence, health or admission records.

## 3. Strategy source classes

A Method/Strategy Profile should declare its source/provenance class.

Initial conceptual classes:

### 3.1 Zugrio first-party strategy

A strategy authored and maintained by Zugrio.

Example: Zugrio Core, if and when its exact version and scope are admitted by evidence.

First-party ownership does not bypass validation. Zugrio strategies must meet the same evidence and scope requirements as external/user strategies.

### 3.2 Zugrio-supported external strategy

A defined external methodology or strategy implementation that Zugrio has explicitly represented and evaluated.

The public name of a methodology is not enough. Zugrio support must bind to a precise, versioned implementation.

### 3.3 User-defined structured strategy

A user-created strategy whose rules are sufficiently explicit for machine evaluation.

User ownership must remain visible. Zugrio may evaluate evidence about the strategy without representing the strategy as a Zugrio-endorsed method.

### 3.4 Declared discretionary plan

A user-entered plan that may contain levels, conditions, invalidation, risk, horizon and expiration, but which Zugrio does not independently claim to validate as a complete trading strategy.

A declared plan can still be monitored and compared with actual behaviour.

## 4. Strategy representation lifecycle

Strategy representation and strategy admission are different axes.

A strategy may progress through representation states such as:

- **Draft** — incomplete description.
- **Structured** — rules are represented in a defined schema.
- **Evaluatable** — enough deterministic structure exists to evaluate historical/current cases within a declared scope.

These labels are product language candidates, not frozen authority enums.

A strategy must not be described as "validated" solely because it is evaluatable.

## 5. Strategy evidence model

Each material strategy assessment must bind to an exact strategy version and explicit scope.

A Strategy Evidence Bundle should be capable of identifying:

- MethodProfileId + version;
- market family;
- product/instrument scope;
- venue if relevant;
- timeframe/horizon;
- session/regime scope where relevant;
- dataset identity and period;
- in-sample / out-of-sample / replay partition identity where applicable;
- forward/paper observation identity where available;
- number of eligible cases and completed outcomes;
- missing/censored/unresolved cases;
- transaction-cost model;
- spread/slippage assumptions;
- outcome definition;
- risk normalization;
- drawdown/adverse-excursion measures where appropriate;
- parameter/sensitivity/robustness evidence where applicable;
- known exclusions;
- data/provenance quality;
- research artifact hashes/versions;
- review decision and reviewer identity/process;
- evidence policy version.

The evidence bundle stores facts and artifacts. It must not collapse them into an unexplained universal score.

## 6. Strategy admission

Operational admission is scope-specific.

A strategy may be represented/evaluated while remaining **not admitted** for any Zugrio-generated signal or execution workflow.

Admission must be capable of distinguishing, by exact scope:

- not admitted;
- admitted for informational/monitoring use;
- admitted for Zugrio-generated Signal use;
- admitted for Semi-Auto;
- admitted for Auto;
- Full Auto status where portfolio-level requirements are separately satisfied;
- suspended;
- withdrawn/superseded.

The exact production enum is deferred to implementation/ADR review.

Admission must reference:

- exact MethodProfile version;
- exact market/instrument/horizon scope;
- admitted model/applicability artifacts;
- evidence bundle(s);
- admission-policy version;
- effective time;
- expiry/review time if applicable;
- explicit limitations/exclusions.

No commercial subscription may create strategy admission.

No user preference may create strategy admission.

No LLM output may create strategy admission.

## 7. Strategy Health

Strategy Health asks whether available evidence continues to support the strategy **within its declared scope**.

It must remain separate from:

- trader process adherence;
- execution quality;
- individual P/L outcome.

Strategy Health may examine, where supported:

- expectancy after modeled/observed costs;
- outcome distribution;
- drawdown behaviour;
- MAE/MFE;
- entry/slippage sensitivity;
- performance by market/instrument;
- performance by horizon/timeframe;
- performance by session;
- performance by regime/context;
- parameter sensitivity/robustness;
- concentration/dependence on narrow conditions;
- forward versus historical behaviour;
- drift/degradation indicators;
- unresolved/censored cases;
- evidence sufficiency and recency.

No single metric is mandatory merely because it appears in this list. Each assessment must be appropriate to the strategy and outcome model.

### 7.1 Evidence strength must be visible

Any user-facing strategy-health conclusion must identify enough context to prevent false precision, including where practical:

- sample/case count;
- time period;
- strategy version;
- market/instrument scope;
- whether evidence is historical, out-of-sample, forward/paper or live-observed;
- cost basis;
- evidence limitations;
- whether a conclusion is established, developing, insufficient or under review according to a versioned policy.

These words are descriptive examples. Production status semantics must be policy-defined rather than improvised.

### 7.2 Strategy health is not permanent

Admission/health must be reviewable over time.

A previously admitted strategy may require review or suspension if:

- evidence becomes stale;
- model/data scope changes;
- material cost/execution assumptions change;
- performance leaves a predeclared expected range under an accepted policy;
- strategy version changes;
- market structure/regime applicability changes;
- required provenance becomes unavailable.

A short losing streak alone must not automatically be treated as strategy failure.

## 8. Manual / discretionary plan monitoring

A discretionary trader may define a plan even when Zugrio does not validate the trading thesis.

A Declared Plan may include:

- instrument/product;
- direction or neutral condition;
- horizon;
- entry zone/condition;
- required confirmations;
- invalidation;
- target/management intent;
- maximum risk;
- expiry/time window;
- context constraints;
- notes.

Zugrio may monitor whether declared conditions occur and compare actual broker actions to the plan.

The product must distinguish:

> **Your plan condition occurred**

from:

> **Zugrio independently validated this as a qualified strategy signal.**

This distinction should remain visible in alerts and review.

## 9. Behaviour Health

Behaviour Health asks whether observed trader actions are consistent with the declared process and whether repeatable deviations are emerging.

It is evidence about behaviour, not a diagnosis of internal psychology.

### 9.1 Observable inputs

Potential sources include:

- Decision Case ledger events;
- declared/manual plans;
- broker orders/fills/position events;
- user approvals;
- user overrides;
- mode changes;
- authority changes;
- risk changes;
- exits and management actions;
- session timing;
- opportunity state at action time.

### 9.2 Behaviour observations

Examples:

- entered before required confirmation;
- entered after the declared entry ceased to qualify;
- entry materially outside declared zone;
- position size/risk differed from declared plan;
- manual override of prepared/system action;
- repeated re-entry after invalidation;
- early exit relative to declared rule;
- widening/removing protective risk contrary to declared policy;
- disabling automation or changing authority during an active case.

An observation must reference evidence sufficient to reconstruct why it was recorded.

### 9.3 Behaviour pattern assessment

Cross-case pattern assessments must expose:

- observation definition;
- sample/case count;
- period;
- strategy version(s);
- market/instrument scope;
- control mode;
- relevant account/broker scope;
- supporting case references;
- known matching uncertainty;
- assessment version.

A pattern should not be asserted when plan-to-broker matching is unreliable.

## 10. Behaviour Guardrails

A behaviour observation becomes a guardrail only through an explicit policy.

Conceptual guardrail strengths:

### 10.1 Advisory

Zugrio surfaces the evidence and allows normal continuation.

Example:

> Your current entry is outside the zone you declared. Similar off-plan entries occurred in 6 of 13 matched cases.

### 10.2 Confirmation / friction

Zugrio requires explicit acknowledgement or re-review before continuing **inside a Zugrio-controlled workflow**.

This does not imply Zugrio can block an external broker action.

### 10.3 Enforcing

A deterministic user/account policy may eventually prevent a prohibited **new risk-increasing action** through the Zugrio execution path.

Enforcing behavioural guardrails are capital-relevant policy inputs. They are not authorized for production merely by this specification.

Before activation they require:

- accepted architecture integration;
- deterministic policy semantics;
- explicit user/account scope;
- versioning;
- freshness rules;
- conflict precedence;
- revocation/change semantics;
- tests against frozen authority invariants;
- launch evidence.

### 10.4 Risk-reduction precedence

A behavioural guardrail must never be the reason a user or system is prevented from reducing existing risk.

Guardrail confirmation/friction/enforcement must not delay or block, solely because of the guardrail:

- closing an existing position;
- reducing position size/exposure;
- adding or restoring required protective risk controls;
- cancelling an unfilled risk-increasing order where cancellation is otherwise permitted;
- other actions classified by the governing safety architecture as risk-reducing.

Existing broker reality, reconciliation state, protection policy and safety rules still apply. This rule does not promise that a broker can always complete a risk-reducing command; it means behavioural guardrails cannot be the blocking authority.

If guardrail state is stale, unavailable or conflicted, a future enforcing policy may fail closed for **new risk-increasing action**, but must not use that uncertainty to obstruct governed risk reduction.

## 11. Guardrails by control mode

### Signal

Zugrio has no broker order authority.

Permitted behaviour:

- advisory warnings;
- plan-vs-action comparison;
- factual review from read-only broker data where available;
- optional acknowledgement inside Zugrio before the user marks an intention/plan.

Not permitted to claim:

- that Zugrio prevented a manual broker order;
- that an advisory warning had authority over the broker.

### Semi-Auto

Zugrio may prepare an intent; the user approves submission.

Permitted behaviour:

- advisory warnings before approval;
- mandatory re-review/acknowledgement inside Zugrio;
- invalidation of stale prepared intents under existing freshness/risk semantics;
- future enforcing guardrails only after authority integration is accepted;
- guardrail friction must not obstruct governed close/reduce/protection actions.

### Auto

Zugrio may act only inside explicit delegated authority.

Behaviour analytics should distinguish:

- system action;
- user manual intervention;
- risk/mode/authority changes;
- manual exit or modification.

Future behavioural constraints may influence new risk-increasing automated action only when expressed as deterministic, admitted policy. No inferred emotion may become capital authority.

Behavioral constraints must not block governed risk-reducing position management.

### Full Auto

The same principles apply, but portfolio selection/allocation/management introduces additional risk and governance requirements.

Full Auto remains release-gated by the existing portfolio-validation boundary.

Any future portfolio-level behavioral constraint must preserve risk-reduction precedence across close, reduce, hedge/protection-repair, and other actions already classified as risk-reducing by the governing safety architecture.

## 12. Four independent review questions

Zugrio review should be able to answer separately:

1. **Strategy Health** — does evidence support this strategy/version in this scope?
2. **Decision/Process Quality** — did the case and decision follow the declared method/evidence/risk/authority process?
3. **Execution Quality** — did the actual broker action match the planned/approved action, within known broker realities?
4. **Financial Outcome** — what happened economically?

These outputs must not overwrite one another.

Examples:

- Loss + healthy strategy evidence + compliant process + compliant execution = potentially normal losing variance; no automatic fault.
- Profit + process violation = profitable outcome with a process violation.
- Loss + compliant process + deteriorating strategy evidence = potential strategy-health issue, not automatically trader failure.
- Good strategy evidence + repeated off-plan entries = behaviour/execution problem, not automatically strategy failure.

## 13. Product surfaces

The product should make the following visible without collapsing them:

### Strategy surface
- source/owner;
- version;
- applicable market/instrument/horizon;
- representation status;
- evidence summary;
- admission status;
- health/review status;
- limitations/exclusions;
- last evidence review.

### Behaviour Health surface
- factual patterns;
- sample/scope;
- supporting cases;
- user-defined guardrails;
- guardrail strength;
- last trigger;
- uncertainty/matching gaps.

### Decision Case
- active strategy/admission identity;
- original reason;
- current changes;
- current entry economics;
- account/risk/control state;
- relevant guardrail warning;
- broker reality;
- process/execution/outcome records.

## 14. AI interaction model

A case-aware AI assistant may answer questions such as:

- Why is this opportunity here?
- What is missing?
- What changed?
- Why is the entry no longer acceptable?
- What does this context fact affect?
- Why did this guardrail trigger?
- What evidence supports this strategy-health statement?
- Which cases support this behavioural pattern?

The AI must receive structured, provenance-bound data and distinguish facts from explanation.

If the underlying system cannot verify a fact, the AI must say so.

## 15. Audit and provenance

Material strategy and behaviour records must be auditable.

Required durable identities should include:

- strategy version;
- evidence/artifact versions;
- admission policy/version;
- behaviour observation definition/version;
- guardrail policy/version;
- user/account scope;
- timestamps/effective times;
- supporting DecisionCaseIds / broker-event references.

Changes append or supersede; historical conclusions remain reconstructable.

## 16. Failure semantics

- Strategy description ambiguous → remain draft/structured-incomplete; no invented rule.
- Strategy not evaluatable → monitor as declared plan where possible; do not claim independent validation.
- Insufficient strategy evidence → no stronger admission than accepted policy allows.
- Missing/stale health evidence → show unavailable/stale, not a reassuring score.
- Behaviour-to-plan match uncertain → mark unmatched/uncertain; do not assert deviation.
- Read-only broker disconnected → behavioural observation coverage is incomplete.
- Guardrail data stale → no hard enforcement unless the accepted policy explicitly defines safe semantics; stale/unknown guardrail state must not obstruct governed risk-reducing actions.
- User acts outside Zugrio path → observe later if possible; never claim Zugrio blocked it.
- AI unavailable → deterministic product state remains usable; AI explanation is not required for authority.

## 17. Research and validation agenda

Before production admission/guardrail thresholds are defined, research must establish appropriate policy per strategy/scope.

Questions include:

- What evidence is sufficient to move a strategy from research to Signal admission?
- What additional evidence is required for Semi-Auto or Auto?
- How should forward observation complement historical/out-of-sample testing?
- Which degradation tests are appropriate for each strategy class?
- How should multiple-testing and parameter-search bias be controlled?
- How should costs/slippage be measured and updated?
- How accurately can broker actions be matched to Decision Cases/manual plans?
- Which behavioural patterns are sufficiently deterministic to support advisory versus enforcing guardrails?
- What user controls are required for guardrail creation, modification, expiry and revocation?
- What regulatory implications arise when guardrails or strategy admission influence automated execution by jurisdiction?

Answers belong in versioned research artifacts, policy specifications and accepted ADRs, not in marketing copy.

## 18. Product success evidence

Zugrio should eventually measure whether the system improves observable process quality, without assuming profitability.

Candidate product metrics, subject to later definition:

- reduction in off-plan entries;
- reduction in risk-rule deviations;
- reduction in actions after setup/entry expiration;
- adherence to declared confirmations;
- frequency of acknowledged versus ignored guardrails;
- ability to attribute poor outcomes to strategy/process/execution separately;
- user comprehension of why a case advanced, waited, stopped or was blocked.

Economic outcome improvement should be studied separately and only claimed when evidence supports it.

## 19. Conformance and proof obligations

Before an enforcing guardrail or strategy admission can affect production behavior, tests/evidence must demonstrate at minimum:

### Strategy representation and admission
- a recorded/structured user strategy without admission cannot produce a Zugrio-admitted capital signal;
- Signal admission cannot silently create Semi-Auto, Auto or Full Auto admission;
- strategy-version changes do not rewrite historical Decision Cases;
- AI output cannot create/update strategy admission, model applicability or execution authority.

### Behaviour observations
- observations are reconstructable from recorded events;
- uncertain broker-to-plan matching remains uncertain;
- user, system and broker actions remain separately attributable;
- no inferred emotion is promoted to deterministic fact.

### Guardrails
- Advisory never blocks;
- Confirmation adds friction only inside a Zugrio-controlled workflow;
- future Enforcing guardrails can preserve or narrow authority, never widen it;
- guardrails can affect only the action classes explicitly admitted by policy;
- **no behavioural guardrail blocks or delays a governed risk-reducing action**;
- Signal mode never claims to prevent an independent broker action;
- stale/expired guardrail state cannot authorize new risk;
- bypass/override/presentation/enforcement events remain auditable.

### Review separation
- Strategy Health, Decision/Process Quality, Execution Quality and Financial Outcome remain independently reconstructable;
- profit does not erase a process/execution violation;
- a compliant losing outcome does not automatically become a process failure;
- missing evidence remains missing rather than becoming a reassuring score.

## 20. Relationship to existing architecture

This specification extends the existing architecture without replacing these invariants:

- market/model applicability remains explicit and scope-specific;
- Entry Models do not own capital authority;
- a signal is not permission;
- control modes remain authority envelopes;
- the Decision Case remains the continuity object;
- outcome does not rewrite process;
- broker reality remains distinct from intent;
- Full Auto remains release-gated;
- no LLM output becomes capital-authoritative merely by being generated.

Any future change that allows a behavioural guardrail or strategy-health assessment to alter capital authority must be reviewed as a separate capital-path change with evidence and tests.
