# Zugrio Positioning Lock — Pre-Copy v1

Status: **frozen positioning basis for the next homepage copy pass**  
Date: 2026-09-25

This document governs homepage positioning and information architecture. It does not change product architecture, Release 1 scope, or capability readiness.

A wording candidate may change during testing. The method and the seven locked decisions below do not change unless product truth or test evidence materially disproves them.

## 1. Category and descriptor

### Category
**Trading Intelligence**

### Qualifier
**Market-aware**

### Public descriptor
**MARKET-AWARE TRADING INTELLIGENCE**

The descriptor is static.

Do not append status or implementation language such as Private Build, Release 1, V1, AI-powered, Auto trading, or similar terms to the descriptor.

### Why this category

Market-aware expresses a foundational Zugrio distinction:
- FX, Gold and Synthetic Indices are not treated as interchangeable charts;
- instrument behaviour matters;
- applicable context differs by market;
- strategy/model evidence does not automatically transfer across markets;
- what matters to the decision may change after a signal.

Strategy-aware remains a flagship product attribute inside the broader market-aware trading-intelligence proposition.

## 1B. First target customer

Write the homepage first for:

> **Serious self-directed FX, Gold and Synthetic Indices traders who already trade from rules, setups or signals, and who have experienced a good setup becoming a poor entry or a good plan breaking down in live execution.**

This includes prop-account traders only where relevant account rules/integrations are actually verified.

The first customer is not:
- a total beginner looking for basic trading education;
- an institution/allocator;
- someone seeking guaranteed signals or a passive-profit promise.

This audience decision governs vocabulary, examples and proof selection without limiting the longer-term product vision.

## 2. Central claim

### Positioning claim

Zugrio keeps the trade decision current from setup through action and review.

The enemy is:

> **treating the signal as the completed trading decision.**

Zugrio should not be reduced to a signal service, charting platform, generic bot, AI chart chatbot, journal or psychology tool.

### Headline candidates for test

No acquisition headline is frozen before trader testing.

**Candidate A**
> The market changes. Your decision should keep up.

**Candidate B**
> Don't trade the signal. Trade what's still true.

These are test candidates, not approved final copy.

The test decides which mental model is stronger. Neither wins by internal preference.

### Public-wording constraint

Avoid "connected" as a central public positioning word. It may appear incidentally when unavoidable, but it is not a Zugrio-owned claim or headline territory.

## 3. Six flagship proofs

The homepage has one central claim. The following capabilities prove it.

### Proof 1 — Market Intelligence

Zugrio evaluates opportunities within the market and instrument that produced them.

Public proof may include:
- instrument behaviour;
- applicable news/events/sessions;
- related-market context where relevant;
- specialist treatment for Synthetic Indices.

**Value:** similar-looking charts do not automatically receive identical interpretation.

### Proof 2 — Strategy Intelligence

The selected strategy determines what counts.

Includes:
- strategy-specific setup qualification;
- background scanning;
- defined setup states;
- strategy-specific deterministic chart annotations;
- strategy evidence/health;
- multiple strategy families across the wider product direction.

**Value:** strategy choice changes the governing logic, not merely the interface label.

### Proof 3 — Live Trade-Case Tracking

The opportunity remains a continuing case rather than becoming a forgotten alert.

Includes:
- formation;
- qualification;
- trigger;
- invalidation;
- relevant evidence changes;
- deterministic chart state.

**Value:** the trader can see what changed instead of reconstructing it mentally.

**State rule:** FORMING → READY → TRIGGERED describes opportunity progression. **PASS is not another stage.** PASS is a decision/result when no permitted route qualifies or required evidence fails.

Public copy should therefore show PASS separately, e.g.:
> No setup is a valid answer.

### Proof 4 — Current-Entry Re-evaluation

A valid historical signal does not guarantee that the currently available trade remains attractive or admissible.

Zugrio preserves the original signal and separately evaluates current conditions such as:
- price;
- costs;
- entry geometry;
- freshness;
- relevant context.

**Value:** what qualified then is not automatically assumed to qualify now.

### Proof 5 — Control and Automation

Finding an opportunity and having permission to act are different questions.

The broader Zugrio proposition includes:
- Signal;
- Semi-Auto;
- Auto;
- Full Auto.

Availability is communicated separately through the Readiness system.

**Value:** increasing automation does not erase trader-defined authority.

### Proof 6 — Decision Quality and Review

Zugrio preserves enough of the decision to distinguish:
- Strategy Health;
- Process;
- Execution;
- Outcome;
- factual BehaviourObservations.

**Value:** P&L alone does not determine which part of the trade was good, bad or unsupported.

A winning violation remains a violation. A compliant loss does not automatically mean the process failed.

## 4. Full proposition versus availability

Every significant capability goes through two independent questions.

### A. Does it belong to the Zugrio proposition?

If no, do not market it.

If yes, it may be visible in the product story.

### B. What is its actual readiness status?

The only public capability-status vocabulary is:
- **Released**
- **Early access**
- **Validation**
- **Research only**
- **Planned**
- **Locked**

Do not use timeline or engineering terminology as status chips:
- Release 1;
- V1;
- V1-F;
- V1-LG;
- gated by scope;
- foundational;
- coming soon.

"Release 1" may appear in prose/FAQ as a release plan. It is not a readiness status.

### Status authority

Capability-specific statuses come only from the versioned Capability Scope Manifest.

Copy, design and component code must not independently assign a readiness status.

The current canonical machine-readable source is:

`config/capability-scope-manifest.v1.json`

If a capability is absent from that manifest, the website must not invent a public readiness chip for it.

The global site may state **private validation** as an overall product lifecycle condition; that is not a capability-status chip.

## 5. Hero mechanism

### Static descriptor

**MARKET-AWARE TRADING INTELLIGENCE**

### Canonical H1

The final canonical H1 is selected by the predeclared trader test in section 7.

Until that test is complete, Candidate A and Candidate B remain equally provisional.

For each test variant, the displayed first/canonical line is also the semantic H1 for that variant.

### Slow rolling treatment

A slow rolling hero is permitted because an evolving decision is conceptually appropriate to Zugrio.

It must pass two independent tests.

#### Same-claim test

Every frame expresses the same central proposition from a different angle or moment.

The frames may not rotate among unrelated propositions such as scanning, psychology and automation.

#### Any-frame test

A visitor arriving on any individual frame must receive a complete, meaningful Zugrio claim.

No frame may depend on having seen the previous or next frame.

Weak fragments such as "A setup appears" or "The market keeps moving" fail this test even if the sequence eventually makes sense.

### Implementation rules

- one canonical semantic H1;
- visual rolling alternatives may be `aria-hidden`;
- approximately 7–9 seconds visible per frame;
- restrained transition;
- fixed-height headline container;
- no typing effect;
- no carousel controls;
- `prefers-reduced-motion` shows the canonical H1 only.

The actual rolling lines are written during the homepage-copy pass after the canonical claim test, not inside this lock.

## 6. Homepage architecture

No repeated topics.

The homepage has six primary movements.

### 01 — Hero

Job: state category and central proposition.

Contains:
- descriptor;
- canonical/rolling headline;
- concise explanation;
- FX · Gold · Synthetic Indices;
- CTA;
- trust line;
- global private-validation state.

### 02 — Problem

Job: show why the signal alone is insufficient.

Core idea:
> Trading breaks in more than one place.

Illustrate the chain without turning the section into a feature catalogue:
- missed opportunity;
- stale entry;
- changing market/context;
- process deviation;
- execution mismatch;
- misleading post-trade conclusions.

### 03 — Interactive Trade Story

This is the centrepiece.

**Market → Strategy → Current Conditions → Control → Decision History**

All depth relating to those topics belongs inside these steps rather than in duplicate standalone sections.

#### Market carries
- market-specific intelligence;
- asset/instrument behaviour;
- context/news/sessions where applicable;
- restrained wider-market expansion line.

#### Strategy carries
- background scanning;
- strategy engine;
- deterministic live chart state;
- FORMING / READY / TRIGGERED;
- PASS shown separately as a valid decision, not a stage;
- strategy library and manifest-driven readiness treatment.

#### Current Conditions carries
- post-signal re-evaluation;
- current entry economics;
- freshness/contextual change.

#### Control carries
- Signal / Semi-Auto / Auto / Full Auto proposition;
- authority;
- manifest-driven readiness treatment.

#### Decision History carries
- original reasoning;
- changes;
- user/system/broker action;
- replay;
- no hindsight rewriting.

There is no second Markets section, second Strategy section or second Control section.

### 04 — Decision Quality

Job: show what Zugrio can help distinguish across and after trades.

Primary visual:
**Strategy Health · Process · Execution · Outcome**

Factual behaviour observations sit inside this layer rather than becoming a separate psychology proposition.

### 05 — Readiness + FAQ

Job: separate product proposition from actual availability.

Readiness uses only the Capability Scope Manifest.

FAQ handles:
- what is available now;
- initial markets;
- strategies;
- AI role;
- brokers;
- automation;
- custody;
- client/platform availability;
- future/custom strategies;
- no-profit-guarantee language.

Release 1 specifics belong here, not throughout the body narrative.

### 06 — Closing + Early Access

Closing signature:
> **The chart is not the market.**

Supporting line:
> **The signal is not the whole decision.**

Then Brevo early-access conversion.

Primary form:
- email only.

After success, optional one-tap segmentation:
**FX · Gold · Synthetic Indices · More than one**

## 7. Predeclared trader-test criteria

Do not select copy by asking which version participants "like."

Choose the version that produces the intended mental model with the fewest material misunderstandings.

### Stage A — Canonical-headline comparison

Use **12 serious self-directed traders** from the target audience.

Randomly assign first exposure:
- 6 see Candidate A first;
- 6 see Candidate B first.

Each participant may later see the other candidate, but **only answers from first exposure count toward the initial headline comparison**.

For each six-person first-exposure group, the candidate advances only if:
- at least **4 of 6** describe Zugrio as doing more than delivering signals and capture the idea that the decision/opportunity is re-evaluated as conditions change;
- at least **4 of 6** answer "What seems different?" with at least one of the six flagship proofs, rather than only "better signals", "AI" or "easier trading";
- no more than **1 of 6** classify it primarily as only a signal service, generic bot, charting platform, journal or AI chatbot.

If only one candidate advances, it becomes the confirmation candidate.

If both advance, compare:
1. number of correct first-exposure mental models;
2. distinctiveness responses;
3. severity of misunderstandings.

Do not resolve a tie by taste. Run an additional first-exposure cohort.

### Stage B — Winner confirmation

Test the winning headline/hero with **10 additional target traders** who did not participate in Stage A.

Pass requires:
- at least **7 of 10** describe Zugrio as doing more than delivering signals and capture continuing re-evaluation as conditions change;
- at least **6 of 10** spontaneously identify at least one governing dimension such as market-specific intelligence, strategy/rules, current-entry recheck or controlled execution;
- at least **6 of 10** answer "What seems different?" with one or more of the six flagship proofs rather than generic "better signals", "AI" or "easier";
- no more than **2 of 10** primarily classify Zugrio as a signal service, generic bot, charting platform, journal or AI chatbot.

If these fail, revise the headline/hero. Do not explain the intended meaning to participants.

### Stage C — Rolling-frame test

After the canonical H1 passes, test the proposed rolling frames with **10 target traders**, randomising the first frame seen.

Every frame must independently communicate the central proposition.

Any frame producing repeated materially weaker classifications is removed or rewritten even if the full sequence works.

### Stage D — Descriptor comprehension

Ask:
> What does "market-aware trading intelligence" mean to you?

Failure pattern:
participants predominantly interpret it as only news, sentiment, fundamentals or market data without relating it to trading decisions.

If that pattern repeats, improve the supporting copy or revisit the descriptor.

### Stage E — Status comprehension

Show manifest-backed capability examples with readiness chips and ask:
> Can you use this today?

Participants must correctly distinguish current availability from Validation, Research only, Planned and Locked without explanation.

### Stage F — Trust/control comprehension

Ask:
> Does joining or paying for Zugrio give it permission to trade your account?

The intended answer is **no**.

Participants should understand that capital remains with the broker and execution authority is separately granted.
