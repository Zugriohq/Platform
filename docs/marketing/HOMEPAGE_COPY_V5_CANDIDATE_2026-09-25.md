# Zugrio Homepage Copy — v5 Candidate

Status: **homepage copy candidate for adversarial review against the frozen positioning lock**  
Date: 2026-09-25  
Authority: `docs/marketing/POSITIONING_LOCK_2026-09-25.md`  
Readiness source: `config/capability-scope-manifest.v1.json`

This document does not change positioning, product architecture, Release 1 scope or readiness.

## Implementation rule for status chips

Any notation in the form:

`{{status:capability.id}}`

means the site must render the public name/status/scope from the Capability Scope Manifest. Do not replace it with a manually maintained status string.

The homepage may describe the wider Zugrio proposition in body copy. Capability availability is communicated separately through manifest-backed status treatment.

---

# 01 — HERO

## Static descriptor

**MARKET-AWARE TRADING INTELLIGENCE**

## Canonical headline test variants

Only one variant is shown to a participant/site test at a time.

### Variant A

# The market changes. Your decision should keep up.

### Variant B

# Don’t trade the signal. Trade what’s still true.

These are equally provisional until the predeclared trader test selects one.

Do not add rolling secondary headline frames until the canonical H1 clears the headline test.

## Shared supporting copy

Zugrio scans FX, Gold and Synthetic Indices for opportunities that fit the active strategy — then keeps checking the trade case as price, costs, context and execution conditions change.

It helps you see what qualifies, what changed, what still holds and what happens next — without treating a signal as the end of the decision.

**FX · GOLD · SYNTHETIC INDICES**

**Primary CTA**  
Join early access

**Secondary CTA**  
See how Zugrio works

**Trust line**  
Your capital stays with your broker. Finding a trade and having permission to act are separate.

**Lifecycle line**  
Private validation · No public trading access or performance claims yet.

---

# 02 — PROBLEM

**Kicker**  
THE SIGNAL ISN’T THE WHOLE TRADE

# Trading breaks in more than one place.

You can miss the opportunity.

You can find the right setup after the best entry has gone.

The market can change between the signal and the trade.

A good plan can break down in execution.

And after the position closes, P&L alone cannot tell you which part actually failed.

**Zugrio is built around the whole decision — before the signal, after it, and through review.**

---

# 03 — INTERACTIVE TRADE STORY

This is the homepage centrepiece.

The product workspace stays visually present while the narrative advances through:

**Market → Strategy → Current Conditions → Control → Decision History**

## STEP 01 — MARKET

**Kicker**  
01 · MARKET

# The same chart pattern can mean something different in a different market.

Zugrio does not treat FX, Gold and Synthetic Indices as interchangeable price charts.

It evaluates the opportunity inside the market and instrument that produced it — including the behaviour, costs and context that actually apply there.

### Product proof — Instrument behaviour

Volatility, active and quiet periods, trading costs and other instrument-specific characteristics remain part of the case.

### Product proof — Market Drivers

`{{status:intelligence.market_drivers}}`

Where relevant to the market, Zugrio can account for economic events, news, trading sessions and related-market evidence rather than judging the chart in isolation.

For Synthetic Indices, Zugrio uses synthetic-specific evidence instead of importing institutional or macro explanations that do not belong there.

**Supporting line**  
Similar candles do not automatically deserve the same conclusion.

**Market scope treatment**  
`{{status:market.fx}}`  
`{{status:market.gold}}`  
`{{status:market.synthetic_indices}}`

**Wider-market line**  
The wider Zugrio direction extends beyond these initial market tracks as each new market earns its own data, context and validation model.

Do not show a large future-market roadmap inside this step.

---

## STEP 02 — STRATEGY

**Kicker**  
02 · STRATEGY

# Your strategy decides what counts.

The same market can produce different answers under different strategies.

Zugrio uses the active strategy to decide what qualifies as a setup, which price areas matter, what must confirm the entry and what invalidates the case.

It scans in the background and brings attention back to the cases that matter.

### Opportunity progression

**FORMING**  
A strategy-defined setup is developing.

**READY**  
The required pre-trigger conditions are present.

**TRIGGERED**  
The defined trigger occurred and the signal is recorded.

**PASS**  
No permitted trade qualifies. No setup is a valid answer.

PASS is shown separately from the opportunity-state progression.

### Live chart state

`{{status:chart.annotations}}`

Where the active strategy defines them, Zugrio can show structure, relevant locations, confirmations, missing conditions and invalidation directly on the chart.

Those annotations come from defined, versioned system logic and evidence — not from free-form AI narration.

### Strategy library

`{{status:strategy.zugrio_core}}`  
`{{status:strategy.smc}}`  
`{{status:strategy.trend_following}}`  
`{{status:strategy.range_mean_reversion}}`  
`{{status:strategy.custom_builder}}`

**Supporting line**  
Strategy choice changes the trading logic. It is not a cosmetic filter.

---

## STEP 03 — CURRENT CONDITIONS

**Kicker**  
03 · CURRENT CONDITIONS

# A valid signal can become a poor entry.

The original signal does not change just because the market moved.

But the trade available now can.

Price changes. Spread and costs change. Entry geometry changes. Relevant context can change.

Zugrio preserves what qualified at the signal and separately rechecks the trade that is actually available now.

### Current-Entry Re-evaluation

`{{status:intelligence.current_entry_recheck}}`

The recheck can account for current price, costs, freshness, entry geometry and relevant context before the next action.

### Illustrative product treatment

**SIGNAL RECORDED**  
09:24

**SIGNAL ENTRY**  
1.08342

**CURRENT PRICE**  
1.08411

**ENTRY QUALITY**  
Re-evaluated now

**Supporting line**  
What qualified then is not automatically what qualifies now.

---

## STEP 04 — CONTROL

**Kicker**  
04 · CONTROL

# A signal is not permission.

Finding an opportunity, approving a trade and allowing software to act are different decisions.

Zugrio is designed around explicit levels of control so the trader can decide how much execution is delegated.

### Signal

`{{status:mode.signal}}`

Zugrio finds and follows the trade case. Execution stays with the trader.

### Semi-Auto

`{{status:mode.semi_auto_ctrader}}`

Zugrio can prepare an eligible trade intent, recheck the required conditions and submit only after the required user approval and controls.

### Auto

`{{status:mode.auto}}`

The wider architecture allows bounded automatic execution only inside explicit delegated authority and admitted scope.

### Full Auto

`{{status:mode.full_auto}}`

Portfolio-level automation remains separately gated and cannot be implied by access to the product.

**Supporting line**  
More automation should never mean less clarity about who is allowed to act.

---

## STEP 05 — DECISION HISTORY

**Kicker**  
05 · DECISION HISTORY

# Hindsight doesn’t get to rewrite the trade.

Zugrio keeps the original trade case available for review: the strategy state, relevant evidence, what changed, the intended action, what the trader or system did, what the broker actually did and what happened afterward.

### Decision Replay

`{{status:decision.replay}}`

Replay is designed to show what was knowable at the time rather than rebuilding the trade from information that only became obvious later.

### Illustrative case

**SYSTEM DECISION**  
PASS

**TRADER ACTION**  
Override

**OUTCOME**  
Profit

**PROCESS**  
Rule violation

A winning violation remains a violation.

A compliant loss does not automatically mean the process failed.

---

# 04 — DECISION QUALITY

**Kicker**  
NOT ONE SCORE

# Your P&L tells you the outcome. It doesn’t tell you what needs fixing.

Zugrio separates the trade into four questions rather than collapsing everything into win or loss.

## STRATEGY HEALTH

`{{status:intelligence.strategy_health}}`

What evidence supports the exact strategy, trade bundle and market scope being used?

## PROCESS

Did the trader follow the strategy, plan, risk and approval process that governed the case?

## EXECUTION

Did the real order, fill, protection and position behaviour match the approved intent?

## OUTCOME

What happened financially?

### Behaviour layer

`{{status:behaviour.observations}}`

Where supported by broker data, Zugrio can surface observable deviations such as entering early, chasing price, changing risk, exiting early or overriding the system state.

It records observable behaviour without pretending to know what the trader was feeling.

### Guardrails

The wider Zugrio direction is designed to progress from visibility to stronger workflow guardrails without letting behaviour logic override safe risk reduction.

`{{status:guardrail.advisory}}`  
`{{status:guardrail.confirmation}}`  
`{{status:guardrail.enforcing}}`

**Supporting line**  
Four questions. Better diagnosis.

---

# 05 — READINESS + FAQ

**Kicker**  
READINESS, WITHOUT GUESSWORK

# Know what’s live. And what isn’t.

The Zugrio proposition is larger than the first capabilities that become available.

That does not make every capability usable today.

Every readiness label on this site is sourced from Zugrio’s versioned Capability Scope Manifest.

**Status vocabulary**

**Released** — available in the stated scope.  
**Early access** — available to a limited invited group.  
**Validation** — being tested; not released.  
**Research only** — evidence/research work; not available for trading use.  
**Planned** — part of the product direction, not yet an available capability.  
**Locked** — deliberately unavailable until separate gates clear.

### Suggested Readiness snapshot

Render these directly from the manifest:

`{{status:strategy.zugrio_core}}`  
`{{status:intelligence.market_drivers}}`  
`{{status:intelligence.current_entry_recheck}}`  
`{{status:chart.annotations}}`  
`{{status:decision.replay}}`  
`{{status:intelligence.strategy_health}}`  
`{{status:behaviour.observations}}`  
`{{status:mode.signal}}`  
`{{status:mode.semi_auto_ctrader}}`  
`{{status:mode.auto}}`  
`{{status:mode.full_auto}}`  
`{{status:client.windows_desktop}}`  
`{{status:client.web}}`  
`{{status:client.mobile}}`

The homepage does not need to display every manifest entry at once. Use progressive disclosure or a "View readiness" expansion if necessary.

## FAQ

### What can I use today?

Zugrio is currently in private validation. The website is a product preview and early-access list. Public trading access is not yet open.

### Which markets is Zugrio built around first?

FX, Gold and Synthetic Indices. Each market and instrument scope is evaluated separately rather than inheriting assumptions from another market.

### Which strategies will Zugrio support?

Zugrio is built to support multiple strategy families. Zugrio Core is the first-party strategy. Smart Money Concepts, Trend Following, Range / Mean Reversion and Custom Strategy each carry their own manifest-backed readiness status.

### Does AI decide the trade?

AI may help explain structured product state. Authoritative strategy state, chart annotations, risk rules and trading permissions come from defined, versioned system logic and evidence.

### How does automation work?

Zugrio separates analysis from permission. Signal, Semi-Auto, Auto and Full Auto are distinct control levels, and each carries its own manifest-backed readiness status.

### Which broker comes first for Semi-Auto?

cTrader is the first planned Semi-Auto broker path for the initial release sequence. Its current availability is shown by the manifest-backed status on the site.

### Where will I use Zugrio?

Zugrio is designed across desktop, web and later mobile surfaces, with the current readiness of each client shown explicitly.

### Can I use my own strategy?

Custom Strategy is part of the broader Zugrio direction. Its current readiness must be taken from the manifest rather than inferred from the product vision.

### What happens when nothing qualifies?

Zugrio can return PASS. No trade is a valid decision.

### Can I review a trade afterward?

Decision history and replay are designed to preserve what was known and what happened throughout the case. Their current readiness is shown separately.

### Does Zugrio hold my money?

No. Capital remains with the broker. Custody, product access and permission to submit a trade are separate.

### Does Zugrio guarantee profitable trades?

No. Markets are uncertain. Zugrio does not guarantee returns, win rates or profitable outcomes.

### What happens after I join early access?

You will receive meaningful build updates and invitations as eligible capabilities and scopes open. Joining does not connect a broker or authorise trading.

---

# 06 — CLOSING + EARLY ACCESS

# The chart is not the market.

## And the signal is not the whole decision.

Zugrio is being built to follow the trade beyond the alert — through the market, the strategy, the trade available now, the level of control you choose and the evidence left behind afterward.

**Primary CTA**  
Join early access

**Supporting line**  
Private validation · FX · Gold · Synthetic Indices

---

# EARLY-ACCESS FORM

## Get closer to Zugrio.

Join the early-access list for meaningful product milestones, validation updates and invitations as eligible capabilities and scopes open.

**Email field**  
Email address

**Button**  
Join early access

**Microcopy**  
No payment, password or broker details required.

Joining does not connect a broker or grant trading authority.

## Success state

# You’re on the list.

We’ll write when there is something meaningful to show you.

### Optional post-signup segmentation

**What do you trade most?**

FX  
Gold  
Synthetic Indices  
More than one

---

# FOOTER

Zugrio is in development and private validation. Product screens, prices, scenarios and readiness examples may be illustrative unless explicitly identified otherwise. They are not investment recommendations, live signals or performance claims. Trading involves risk of loss.

---

# EXISTING-SITE FIT

This draft is intended as a structural retrofit of the existing React landing page, not a greenfield redesign.

## Keep / evolve

- current premium dark/silver visual language;
- hero product shell;
- sticky five-step story mechanics;
- illustrative chart/case workspace;
- SilverReveal closing treatment;
- Brevo-backed waitlist;
- motion system where it communicates product state;
- current responsive foundation.

## Consolidate/remove as standalone sections

The following current sections should not survive as separate narrative movements because their content is absorbed into the frozen six-movement structure:

- capability ticker;
- standalone scanning bridge;
- standalone opportunity-progression block;
- standalone discipline block;
- standalone after-signal/control block;
- standalone behavioural journal block;
- standalone markets block;
- standalone "bring your own plan" block;
- standalone "why Zugrio exists" block.

Their strongest proof elements move into:
- Problem;
- the five-step Interactive Trade Story;
- Decision Quality;
- Readiness/FAQ.

## Main visual redesign targets

Without changing the visual identity, the next visual pass should concentrate on:
1. hero hierarchy and eventual slow headline rotation;
2. richer five-step product-shell state changes;
3. four-part Decision Quality visual;
4. manifest-driven Readiness UI;
5. stronger typography/spacing and reduced motion noise.

The copy does not require a total redesign from zero.
