# Strategy Health and Behavioral Guardrails

Status: **founder-directed product/architecture specification for review**.  
Issue: #17.  
This document adds product requirements and domain boundaries. It does **not** claim implementation, validation, profitability, regulatory approval, or release readiness. It does not silently modify the frozen Signal Authority Architecture.

## 1. Purpose

Zugrio should help a trader distinguish three different questions that must never be collapsed into one score or one outcome:

1. **Strategy Health** — does the exact strategy version show sufficient evidence of useful performance in the market/instrument/horizon where it is being used?
2. **Process / Behavior Health** — did the trader or system follow the declared strategy, risk and authority process?
3. **Outcome** — what financially happened?

A profitable result does not prove a strategy is healthy or a process was compliant. A losing result does not prove either is unhealthy.

The product must also allow trader-defined strategies without allowing an untested or ambiguous strategy to inherit Zugrio's credibility or capital authority.

## 2. Non-negotiable boundaries

- A user may **record** a strategy without Zugrio endorsing it.
- A strategy may be **represented** without being validated.
- A strategy may be **evaluated** without being admitted for signal generation.
- A strategy may be admitted for **Signal** use without being admitted for Semi-Auto, Auto or Full Auto.
- No user-authored strategy becomes capital-authoritative merely because an LLM can translate it into structured fields.
- No missing evidence threshold is replaced with an invented number.
- No behavioral record is treated as proof that a trader felt fear, greed, impatience, tilt or another internal emotional state.
- Zugrio can govern actions routed through its delegated execution path. It cannot claim to prevent arbitrary manual trading performed independently at the broker unless a verified broker capability explicitly provides that control.
- Strategy evidence and behavioral evidence must carry provenance, scope, time range and version identity.
- AI may structure, summarize and explain evidence. AI may not widen model applicability, admit a strategy, size capital, create execution authority or overwrite deterministic adherence results.

## 3. Strategy classes

User-facing naming may change, but the domain must distinguish at least:

### 3.1 Zugrio strategy
A first-party strategy maintained by Zugrio.

Requirements:
- exact version identity;
- explicit market/instrument/horizon scope;
- entry/invalidation contracts;
- evidence/admission records;
- no implication of profitability without evidence.

### 3.2 Supported external strategy
A methodology implemented by Zugrio under an explicit, testable definition.

A broad label such as SMC, ICT or price action is not itself a strategy contract. The implemented rule set/version is the governed object.

### 3.3 User strategy
A strategy or discretionary plan created by the trader.

A user strategy may be:
- recorded only;
- structured/monitorable;
- research-evaluable;
- signal-admitted for a defined scope;
- automation-admitted only after additional authority/evidence gates.

The UI must not imply that every user strategy has been validated by Zugrio.

## 4. Strategy lifecycle

The following lifecycle is conceptual. Exact user-facing labels are subject to product testing.

### 4.1 Recorded
The trader can save the strategy or plan in human-readable form.

Allowed:
- notes;
- declared conditions;
- levels;
- invalidation;
- risk intent;
- horizon;
- expiration.

Not allowed:
- Zugrio-generated strategy signals solely because prose was recorded.

### 4.2 Structured
The strategy has been mapped to deterministic/versioned fields and supported entry/evidence contracts sufficiently to monitor the declared conditions.

Required:
- unresolved/ambiguous rules remain explicit;
- unsupported components remain unsupported;
- the trader must be able to inspect the structured interpretation;
- material changes create a new version.

### 4.3 Evaluatable
The strategy definition is sufficiently deterministic for research/replay evaluation in a declared scope.

Required:
- exact data scope;
- cost assumptions where relevant;
- outcome definition;
- censoring/expiry rules;
- strategy version;
- market/instrument/horizon identity;
- no look-ahead leakage;
- reproducible evaluation path.

Evaluatable does not mean good, profitable or admitted.

### 4.4 Evidence assessed
Evidence artifacts exist for the strategy and scope.

Possible evidence may include, as appropriate:
- historical evaluation;
- holdout/out-of-sample evaluation;
- forward/shadow observation;
- cost/slippage sensitivity;
- regime/session segmentation;
- parameter/definition robustness;
- drawdown/distribution behavior;
- sample size and effective sample limitations.

No universal minimum sample size, profitability threshold, Sharpe threshold, win rate, expectancy or drawdown limit is specified here. Those values require separate research and validation by strategy/market/use case.

### 4.5 Admitted
A governed admission record permits a specific use in a specific scope.

Admission must be dimensional, not global. It may bind:
- strategy version;
- market family;
- instrument/product/venue;
- timeframe/horizon;
- model/entry versions;
- permitted control mode;
- evidence artifact identities;
- validity interval;
- exclusions;
- review/expiry conditions.

Admission for Signal does not imply admission for automated capital action.

### 4.6 Suspended / expired / superseded
Admission can be withdrawn, expire or be superseded without deleting historical evidence.

Existing Decision Cases preserve the strategy/admission version that governed them.

## 5. Strategy Health

Strategy Health is an evidence status, not a promise of future profitability.

It should answer:

> What does the current evidence say about this exact strategy version in this exact scope, and how strong is that evidence?

### 5.1 Minimum reporting dimensions

Where data supports them:
- strategy version;
- market/instrument/horizon;
- observation period;
- number of eligible/qualified cases;
- entered versus passed/missed/blocked where relevant;
- costs/slippage assumptions or actual costs;
- outcome distribution;
- expectancy or equivalent outcome metric where valid;
- drawdown/losing-run behavior;
- MAE/MFE where meaningful;
- session/regime segmentation;
- evidence freshness;
- forward versus historical evidence;
- exclusions/data-quality limitations.

### 5.2 Evidence-strength status

The system shall support qualitative evidence states such as:
- insufficient;
- developing;
- established for stated scope;
- review required;
- unavailable.

Exact state names and thresholds require validation.

The system must expose the evidence basis behind the state. It must not convert a heuristic into a fake probability or universal 0-100 score.

### 5.3 Degradation monitoring

Strategy Health may identify evidence that warrants review, including:
- performance distribution moving outside validated expectations;
- material change in cost/slippage behavior;
- market/regime dependence becoming material;
- evidence becoming stale;
- applicable model/data no longer available;
- a strategy version materially changing.

No short losing sequence by itself proves strategy failure.

Automatic suspension criteria, if later introduced, require an explicit policy, evidence and review appropriate to the control mode.

## 6. Process / Behavior Health

Process / Behavior Health evaluates observable adherence and repeated action patterns.

Potential facts include:
- entry before declared confirmation;
- entry outside declared zone;
- chasing beyond configured tolerance;
- size/risk deviation;
- stop/target changes;
- early exit relative to declared rule;
- manual override;
- repeated re-entry;
- mode/authority changes;
- pause/restart behavior;
- manual intervention in system-managed positions;
- trading outside configured session/scope;
- ignored or bypassed warnings.

A fact must be derived from recorded plan/state plus broker/system/user events. Where the system cannot reliably match an external broker action to a Decision Case, it must say so.

### 6.1 No mind-reading

Behavior analytics may state:
> The entry occurred 14 pips outside the declared zone after two consecutive losing outcomes.

It may not state as fact:
> You revenge-traded because you were angry.

Narrative coaching may invite reflection but must distinguish inference from recorded fact.

### 6.2 Evidence basis

Every behavioral insight should expose, where relevant:
- sample size;
- period;
- markets/instruments;
- strategy versions;
- triggering events;
- matching confidence where trade-plan association is not deterministic;
- exclusions and missing data.

## 7. Behavioral guardrails

A behavioral guardrail is an explicit policy derived from user configuration, verified account/risk policy, or another governed source. It is not an ad-hoc psychological veto.

Conceptual strengths:

### 7.1 Inform
- surface the factual pattern or deviation;
- no added execution friction;
- valid in all modes.

### 7.2 Confirm
- require acknowledgement/reason/review before continuing through a Zugrio-controlled action path;
- only available where Zugrio owns the relevant interaction;
- does not block independent broker activity.

### 7.3 Enforce
- prevent a prohibited new risk-increasing action through Zugrio's delegated execution path;
- requires an explicit governed rule and valid execution authority;
- does not imply custody of capital;
- does not block unrelated manual broker activity unless a verified broker capability explicitly supports such account controls.

Guardrail strength must be inspectable and revocable according to policy.

## 8. Mode-specific intervention semantics

### Signal
Zugrio has no broker order authority.

May:
- alert;
- explain;
- compare a planned action with the current case;
- detect later deviations using supported read-only broker data;
- request acknowledgement inside Zugrio;
- record override/deviation.

Must not claim:
- that Zugrio can prevent the trader from placing an independent broker order.

### Semi-Auto
Zugrio prepares an intent; the trader approves.

May additionally:
- block or expire a prepared intent when deterministic strategy/risk/guardrail rules fail;
- require acknowledgement/review before approval;
- require fresh revalidation before submission.

The trader can still act independently at the broker outside Zugrio unless broker policy says otherwise.

### Auto
Zugrio may submit only inside an explicit Execution Authority Manifest.

Behavioral guardrails can constrain new risk-increasing actions through Zugrio where they are part of the governed authority/policy path.

Manual broker/user interventions remain separate recorded actors and must not be misattributed to the system.

### Full Auto
Same core principle as Auto with broader portfolio authority if/when released.

Behavioral analytics should emphasize:
- mandate changes;
- manual interventions;
- disabling/re-enabling automation;
- overrides;
- capital/risk setting changes;
- portfolio-level process adherence.

Full Auto remains release-gated by existing portfolio validation requirements.

## 9. AI role

AI may help a trader translate natural language into a structured strategy draft.

Example:
> "Buy after an Asian-low liquidity sweep, displacement and FVG retest during London, unless high-impact USD news is within 30 minutes."

AI may:
- identify candidate structured clauses;
- ask for missing definitions;
- highlight ambiguity;
- explain unsupported components;
- summarize evidence;
- explain a current Decision Case;
- generate coaching language from deterministic records.

AI must not:
- silently choose a definition for ambiguous strategy language;
- claim a strategy is profitable without evidence;
- invent a probability, threshold or calibration;
- turn an unsupported concept into admitted evidence;
- admit a strategy for Signal/Auto;
- create or widen execution authority;
- overwrite deterministic adherence, risk, model-scope or broker facts.

The structured strategy draft must be reviewable before activation/versioning.

## 10. User-strategy signal boundary

The UI and event model must distinguish:

- **Your strategy conditions triggered** — a user-defined structured rule set triggered.
- **Zugrio-admitted signal** — the governing strategy/model/admission requirements for the stated scope were satisfied.

The exact public wording may change, but the semantic distinction must remain.

A user strategy may be monitored without being endorsed. A user strategy may generate user-defined alerts without being represented as a Zugrio-validated trading signal.

## 11. Strategy Health versus Process Health matrix

A review should support combinations such as:

| Strategy evidence | Process adherence | Outcome | Interpretation |
| --- | --- | --- | --- |
| Healthy/within validated scope | Compliant | Loss | Losing outcome does not by itself identify a defect. |
| Healthy/within validated scope | Violation | Profit | Profit does not erase the process violation. |
| Weak/insufficient evidence | Compliant | Profit | Outcome is positive; strategy evidence remains insufficient. |
| Review required | Compliant | Loss | Investigate strategy evidence without blaming execution by default. |
| Healthy/within validated scope | Repeated deviation | Mixed | Trader/process behavior requires attention independently of strategy health. |

These are explanatory examples, not deterministic diagnostic conclusions from one trade.

## 12. Domain objects

Architecture should be capable of representing:

### StrategyDefinition
The versioned declared rule set.

### StrategyEvidenceArtifact
Immutable/reproducible evidence artifact with:
- strategy version;
- scope;
- dataset/evaluation identity;
- metrics;
- assumptions;
- limitations;
- creation/effective time.

### StrategyAdmission
Governed permission for an exact strategy version to participate in a stated product/control use and scope.

### StrategyHealthAssessment
Time-bounded assessment derived from identified evidence artifacts. Does not overwrite underlying evidence.

### ProcessAdherenceRecord
Existing concept: deterministic/versioned assessment of whether declared process was followed where computable.

### BehaviorObservation
Factual event/pattern derived from source events.

### BehaviorGuardrail
Versioned rule with:
- owner/source;
- scope;
- condition;
- strength;
- effective/expiry time;
- action;
- applicability by control mode.

### BehaviorInterventionEvent
Append-only record of a warning, acknowledgement requirement, block, bypass or override.

These objects must preserve provenance and actor identity.

## 13. Authority integration

Strategy Health and behavioral analytics are not automatically capital-authoritative.

If an assessment or guardrail is ever allowed to block/permit capital:
- the governing policy must explicitly consume it;
- required freshness/version/provenance must be defined;
- failure semantics must be defined;
- tests must show it cannot widen authority;
- the input must be deterministic or constrained to an accepted artifact type;
- AI-generated narrative cannot be the authoritative input.

BehaviorGuardrail may narrow an existing authority envelope. It may never widen it.

StrategyAdmission is necessary but never sufficient for capital release. Existing state, risk, current economics, context, authority and broker requirements still apply.

## 14. Non-custodial execution boundary

Zugrio's business/product direction remains non-custodial for the initial product:
- customer capital remains at the broker;
- a broker connection can provide read-only data and/or delegated trading permissions depending on integration and user authorization;
- Zugrio does not gain withdrawal authority merely by supporting automated trading;
- execution authority must be explicit, scoped and revocable.

Product copy must not equate "non-custodial" with "unregulated" or imply a regulatory classification without jurisdiction-specific legal analysis.

## 15. UX requirements

The product should surface Strategy Health and Process / Behavior Health separately.

Example structure:

**Strategy Health**
- strategy/version;
- evidence status;
- applicable scope;
- sample/period;
- key observations;
- limitations;
- last assessed.

**Process Health**
- adherence status;
- recurring observable deviations;
- evidence/sample;
- user/system attribution;
- guardrails;
- trend over time.

**Outcome**
- P/L / R / relevant financial result.

Never visually collapse all three into one congratulatory or punitive score.

### Current case
Where relevant, the Decision Case may show:
- current strategy admission/status;
- applicable strategy-health warning;
- current behavioral guardrail;
- reason/action;
- evidence link.

### Journal/replay
A user must be able to see:
- what the strategy status was at the time;
- what guardrails were active;
- what intervention occurred;
- whether the user bypassed/overrode;
- what happened financially afterward.

## 16. Testing and proof obligations

Before release of any strategy-health or behavioral-intervention capability, tests/evidence must cover:

### Strategy representation
- ambiguous natural-language rule stays unresolved until defined;
- unsupported rule cannot become active by AI hallucination;
- version change does not rewrite old Decision Cases.

### Strategy evidence
- evaluation is reproducible;
- no look-ahead leakage in research harness;
- scope identity is preserved;
- costs are included where required;
- sample/evidence limitations are exposed;
- no unsupported cross-market transfer.

### Admission
- strategy can be recorded/structured without admission;
- Signal admission cannot create Auto admission;
- expired/suspended admission fails closed where required;
- user strategy cannot borrow a Zugrio-admitted status from another version/scope.

### Behavior matching
- broker action is attributed only when matching evidence supports it;
- uncertain matches remain uncertain;
- system action and user action remain distinct.

### Guardrails
- Inform never blocks;
- Confirm adds friction only in a Zugrio-controlled path;
- Enforce narrows but never widens authority;
- Signal mode cannot claim to prevent an independent broker action;
- override/bypass is append-only;
- stale guardrail state cannot wrongly authorize new risk.

### AI
- AI output cannot change admission/authority directly;
- unsupported facts remain unavailable;
- AI explanation cites/links to underlying structured state where product UX permits;
- deterministic records win over narrative disagreement.

## 17. Open research decisions

The following are intentionally unresolved and must not be invented during implementation:

- minimum evidence/sample thresholds by strategy/market/use;
- exact Strategy Health state names;
- quantitative degradation/suspension thresholds;
- required forward/shadow duration;
- statistical tests/robustness methods by strategy class;
- whether any behavior-derived guardrail is enabled by default;
- which guardrails may become capital-authoritative;
- how matching confidence is computed for externally placed manual trades;
- which broker APIs can expose enough data for reliable post-action attribution;
- regulatory treatment by jurisdiction for Signal/Semi-Auto/Auto/Full Auto and strategy marketplace/licensing concepts.

## 18. Product sequencing

Recommended order:

1. durable strategy version + existing Decision Case linkage;
2. structured user plan/strategy draft with explicit unsupported fields;
3. StrategyEvidenceArtifact and evidence-status UX;
4. Process/Behavior observations from deterministic Zugrio/broker events;
5. separate Strategy Health / Process Health / Outcome review;
6. Inform-level behavioral interventions;
7. Confirm-level guardrails in Semi-Auto paths;
8. Enforce-level guardrails only after authority/failure semantics are validated;
9. AI strategy-structuring and case explanation after structured contracts exist;
10. any strategy marketplace/licensing only after admission/version/evidence semantics are mature.

## 19. Product principle

Zugrio should not merely help a trader follow a strategy consistently.

It should help distinguish:
- whether the opportunity actually satisfied the strategy;
- whether the strategy itself has credible evidence in that scope;
- whether the trader/system followed the declared process;
- and what the financial outcome was.

Those questions remain connected, but they must never be treated as the same question.
