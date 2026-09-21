# Zugrio 1.0 Product Design PRD

Status: **design-facing PRD for GPT Work / senior product design**.  
Related source-of-truth documents:

- `docs/product/PRODUCT_DIRECTION.md`
- `docs/product/ZUGRIO_1_0_PRD.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_V1.md`
- `docs/architecture/DOMAIN_MODEL_V1.md`
- `docs/brand/BRAND_PROPOSITION_V2_2_CANDIDATE.md`
- `docs/brand/VISUAL_DIRECTION_V0_2.md`

This document translates Zugrio's product and architecture into an experience-design brief. It does not authorize changes to trading logic, invent release status, create performance claims, or override the frozen Signal Authority Architecture.

---

## 1. Design objective

Design Zugrio as a premium market-aware trading intelligence product that feels mature enough for serious individual traders and credible enough to scale toward prop traders and capital teams.

The interface should make sophisticated reasoning easier to understand without turning the product into either:
- a toyishly simplified mobile trading app;
- a charting clone;
- a dense institutional terminal with poor hierarchy;
- a signal feed;
- a generic AI-chat wrapper;
- an automation panel detached from the decision that created the trade.

The product experience must continuously connect:

> **Market → Method → Moment → Mandate → Memory**

The user should always be able to answer:

1. What market/instrument am I looking at?
2. Why is Zugrio evaluating it this way?
3. Does this fit my method?
4. What is true now?
5. What changed?
6. What may happen next?
7. Who has permission to act?
8. What actually happened afterward?

---

## 2. Brand/product thesis to embody

### Master thesis

> **The chart is not the market.**

The design must not communicate that charts are unimportant. The visual/product interpretation is:

> **The chart is where a trade starts. Not where the decision ends.**

### Descriptor

> **Market-aware trading intelligence.**

Where automation is central:

> **Trading intelligence and governed automation.**

### Product grammar

- **Market = identity**
- **Method = rules**
- **Moment = now**
- **Mandate = permission**
- **Memory = record**

This grammar should influence hierarchy, flow and content architecture without necessarily being presented everywhere as a branded “5M framework.”

### Standing boundary rule

Pillars may define requirements, thresholds, applicability and rules. **Only Moment reports whether those conditions are currently met.**

Examples:
- Market defines model/family applicability; Moment reports the current regime/state.
- Method defines evidence requirements and invalidation rules; Moment reports whether required evidence is present and whether invalidation has occurred.
- Mandate defines the authority envelope; Moment reports current account/risk/authority facts.
- Memory records what occurred.

### Standing language rule

Use neutral/technical verbs for system behavior; agency stays with the trader.

Prefer: evaluates, detects, compares, records, preserves, flags, blocks, permits under mandate, reconciles.

Avoid core product copy that says Zugrio “knows,” “remembers,” “wants,” “believes,” or otherwise implies subjective human awareness.

---

## 3. Primary users

### P0 — Serious self-directed trader

Trades one or more of:
- Forex;
- Gold;
- Synthetic Indices.

Needs:
- discovery without constant chart-hopping;
- clear reasoning;
- current entry economics;
- macro/news/session context where relevant;
- reliable freshness;
- control over automation;
- post-trade review.

### P0 — Prop-account trader

Same core workflow, with increased sensitivity to:
- drawdown;
- account limits;
- session/risk constraints;
- remaining risk;
- authority boundaries;
- violations.

Do not claim prop-firm rules are enforced unless the integration/policy is actually verified.

### P1 — Advanced individual / multiple-account user

Needs:
- multiple broker/account connections;
- account switching;
- market-specific method profiles;
- portfolio/exposure awareness as released.

### Expansion audience

Trading teams / allocators.

The visual system should be capable of maturing into team/mandate workflows without making an unreleased institutional suite visible in V1.

---

## 4. Initial market scope

The product-design system must support in parallel:

- **Forex**
- **Gold**
- **Synthetic Indices**

Forex may lead some public messaging. Product UI must not treat Gold or Synthetics as accidental add-ons.

Design must support market-specific intelligence.

The UI must not imply:
- one universal prediction model;
- one universal strategy;
- one universal entry model;
- one calibration shared across every market.

### Market identity presentation

For an instrument, the interface may need to communicate:
- market/instrument;
- product/venue/broker context;
- market family/specialist intelligence where useful;
- timeframe/horizon;
- current regime;
- model/coverage status.

Do not expose technical implementation names unless they help the user.

Example:

Bad:
> `event-hazard-v3-prod-17`

Better:
> **Jump specialist**
> Validated for this instrument scope

Or:
> **Structure model unavailable for this scope**

The exact wording must reflect authoritative capability/status data.

---

## 5. Experience principles

### 5.1 Decision-first, not dashboard-first

Every page should answer a user job.

Avoid a homepage/dashboard filled with unrelated KPI cards merely because finance software often has them.

The primary workspace exists to help the user:
- find;
- understand;
- decide;
- govern;
- review.

### 5.2 Progressive disclosure

Zugrio has deep architecture. Do not expose all of it at once.

Three depths:

**Glance**
- state;
- direction;
- freshness;
- current reason;
- critical blocker;
- account/mode.

**Inspect**
- evidence;
- conflicting evidence;
- context;
- entry economics;
- risk;
- method requirements.

**Audit**
- provenance;
- event timeline;
- policy/model versions;
- exact reason codes;
- broker reconciliation;
- decision history.

### 5.3 State is more important than decoration

A state change must be visually clearer than a hover animation.

The user must distinguish:
- fresh vs stale;
- current vs frozen;
- structural vs model-evaluated;
- signal vs permission;
- supported vs research-only;
- prepared vs submitted;
- submitted vs unknown;
- protected vs protection-pending/failed.

### 5.4 Reasons stay attached

The interface should never show BUY/SELL/FIRE without an inspectable explanation.

A user should be able to understand:
- what qualifies;
- what conflicts;
- what is missing;
- what changed since the prior state.

### 5.5 No fake confidence

Do not transform:
- heuristic scores into probabilities;
- “research” into “live”;
- a valid setup into “safe”;
- a model output into account permission;
- profitability into process quality.

### 5.6 Calm under pressure

Important information should become clearer during stress, not more animated.

During:
- macro event;
- stale feed;
- broker disconnect;
- authority change;
- protection failure;
- submission unknown;

the interface should reduce ambiguity, highlight the required action/status and suppress nonessential visual noise.

---

## 6. Cross-surface product architecture

Zugrio has one identity across:

### Public web
- brand/product explanation;
- market scope;
- readiness board;
- waitlist / early access;
- pricing/subscription when released;
- login/signup;
- download links.

### Authenticated web
- account/profile;
- billing/subscription;
- broker connections;
- device/session management;
- methods/settings;
- readiness/capability access;
- journal/report access;
- downloads/releases.

### Desktop
Primary professional trading workspace:
- opportunity discovery;
- multi-market scanning;
- charts;
- decision inspection;
- context;
- method;
- risk;
- execution controls;
- positions;
- connection/reconciliation status;
- journal.

### Mobile
First-class companion:
- watchlists;
- opportunity alerts;
- current decision state;
- macro/context alerts;
- Semi-Auto approvals;
- open position/account status;
- automation authority controls;
- emergency/safety controls as permitted;
- journal review.

Mobile does not need to reproduce every dense desktop interaction.

---

## 7. Information architecture

### Primary navigation

Recommended conceptual navigation:

1. **Workspace**
2. **Markets**
3. **Journal**
4. **Accounts**
5. **Methods**
6. **Automation**
7. **Connections**
8. **Settings**

Exact navigation treatment may vary by platform.

### Workspace

The central decision environment.

Contains:
- opportunity stream/watchlist;
- selected instrument;
- chart;
- evidence/decision inspector;
- context;
- risk/authority;
- action area;
- current positions where relevant.

### Markets

Discovery and market coverage.

Contains:
- Forex;
- Gold;
- Synthetic Indices;
- search/filter;
- family/specialist coverage;
- market/session state;
- capability status;
- watchlist.

### Journal

Decision Case history.

Contains:
- entered;
- passed;
- expired;
- blocked;
- missed;
- overridden;
- closed.

Filter by:
- market;
- instrument;
- method;
- outcome;
- process adherence;
- mode;
- broker/account;
- date;
- reason/state.

### Accounts

Contains:
- connected trading accounts;
- account health;
- equity/balance;
- risk state;
- remaining configured capacity where reliable;
- positions;
- applicable prop/account constraints.

### Methods

Contains:
- method profiles;
- version;
- applicable markets;
- setup families;
- permitted entry models;
- required evidence;
- invalidation;
- risk-policy references;
- current/archived versions.

V1 does **not** need an unrestricted strategy coding environment.

### Automation

Contains:
- Signal;
- Semi-Auto;
- Auto;
- Full Auto;
- authority status;
- account-by-account mandates;
- allowed markets/instruments/methods;
- risk ceilings;
- expiry/revocation;
- activity log.

### Connections

Contains:
- cTrader;
- MT5;
- future integrations;
- connection health;
- account binding;
- permissions;
- last sync/reconciliation.

### Settings

Contains:
- profile;
- security;
- devices/sessions;
- notifications;
- display;
- accessibility;
- privacy;
- developer/support diagnostics where appropriate.

---

## 8. Desktop app shell

Design a desktop shell that feels native to prolonged use.

### Recommended composition

**Top system bar**
- Zugrio identity;
- global search / command access;
- active workspace/account;
- broker/data connection health;
- overall freshness;
- current control mode;
- notification center;
- profile.

**Left navigation rail**
- compact persistent navigation;
- collapsible labels;
- clear active state;
- no decorative overloading.

**Left opportunity column**
- watchlist;
- opportunity cards;
- filters;
- market tabs;
- search;
- sort;
- state/freshness.

**Center analysis surface**
- primary chart;
- market structure overlays;
- decision geometry;
- context markers;
- current/frozen distinction;
- timeframe controls;
- layer toggles.

**Right Decision Inspector**
- current state;
- Market;
- Method;
- Moment;
- Mandate;
- evidence;
- current economics;
- blockers;
- what changes next.

**Bottom/contextual execution drawer**
- risk;
- account;
- entry intent;
- approval;
- broker submission/reconciliation;
- open position management.

The designer may improve the exact arrangement, but the UX must retain clear separation between:
- analysis;
- evidence;
- permission;
- execution.

---

## 9. Opportunity stream/card

Opportunity cards must be compact but not cryptic.

### Required glance information

- instrument;
- market;
- direction if directional;
- selected timeframe/horizon;
- user-facing state;
- freshness;
- method/profile;
- current reason / next condition;
- capability status if not fully available;
- broker/account relevance where needed.

### Avoid

- fake probability;
- giant BUY/SELL call-to-action;
- five competing badges;
- unexplained score;
- profit projection;
- “strong signal” without calibrated meaning.

### State treatment

Underlying architecture state must remain exact even if user copy is simplified.

Potential user-facing treatment:

```text
Watching
Structural case forming

Evaluated
Model evaluated — below action threshold

Ready
Qualified decision available

Action available
Execution may proceed subject to account/mandate

Unavailable
Required model/policy/data unavailable

Expired
The entry/decision is no longer current

Blocked
Risk / authority / safety prevents action
```

Exact mapping must be validated against frozen states before implementation.

---

## 10. Decision Inspector

This is one of the most important product surfaces.

### Header

- instrument;
- direction;
- state;
- age/freshness;
- method;
- selected account;
- mode;
- capability/release state.

### Five-part structure

#### MARKET

Answer:
> What am I looking at, and what intelligence is valid here?

Surface as relevant:
- market/product;
- specialist/family label;
- timeframe/horizon;
- market context identity;
- data source/health;
- model applicability status.

#### METHOD

Answer:
> What does my method require?

Surface:
- profile/version;
- setup family;
- required conditions;
- permitted entry model;
- invalidation;
- unmet method conditions.

#### MOMENT

Answer:
> What is true now?

Surface:
- current structure/regime;
- volatility;
- price/spread;
- entry economics;
- macro events;
- news;
- session;
- related-market facts;
- freshness;
- evidence changed since last evaluation.

#### MANDATE

Answer:
> What is allowed to happen next?

Surface:
- mode;
- account;
- authority;
- risk ceiling;
- user approval requirement;
- blocking condition;
- mandate expiry/revocation;
- broker readiness.

#### MEMORY

Answer:
> How did we get here?

Surface:
- timeline;
- state transitions;
- evidence changes;
- previous recommendation;
- approval/override;
- execution/reconciliation;
- outcome/process later.

The five parts need not always be literal tabs. Work should explore:
- vertical narrative;
- segmented inspector;
- expandable sections;
- timeline-linked sections.

The hierarchy must remain obvious.

---

## 11. Chart requirements

The chart is a critical surface, not the whole product.

### Must support

- real-time/updateable market structure;
- BOS / CHOCH / relevant structure as actually supported;
- decision geometry;
- entry/stop/targets when legitimately available;
- liquidity/FVG/other method-specific overlays where relevant;
- frozen geometry vs current executable conditions;
- macro/context markers;
- execution/fill markers;
- decision-state changes;
- toggles/layer management.

### Visual hierarchy

Priority:
1. price;
2. active decision geometry;
3. current structure;
4. relevant context;
5. historical annotations.

Do not show every possible overlay simultaneously.

### Frozen vs current

The user must visually understand that:
- the original/frozen decision geometry is historical evidence;
- the current executable price/economics may have moved;
- a setup can remain structurally intact while the current entry is no longer attractive.

### Chart failure/degraded states

Design:
- loading;
- partial data;
- stale feed;
- unsupported timeframe;
- insufficient history;
- disconnected;
- provider unavailable.

A chart failure must not cascade into a blank app shell.

---

## 12. Context / macro experience

Context must be integrated into the decision rather than becoming a news-feed sidebar.

### Macro events

Show:
- event;
- currency/market relevance;
- scheduled time;
- impact/severity where source-supported;
- actual / forecast / previous when available;
- countdown;
- source;
- freshness.

### News

Show:
- title;
- source;
- publication/event time;
- affected market/instruments;
- concise relevance;
- source link where allowed.

Do not use generated summaries as authoritative facts unless clearly separated.

### Session

Show current relevant session/transition:
- London;
- New York;
- Asia;
- overlap;
- market closures/holidays where relevant.

### Decision integration

The interface should answer:
> Does this context affect the current decision?

Not merely:
> Here is a lot of news.

---

## 13. Method profile UX

The Method experience should feel serious and inspectable.

### Method library

Display:
- name;
- version;
- markets;
- setup families;
- entry models;
- horizons;
- status;
- last changed;
- current use.

### Method detail

Sections:
- purpose;
- applicability;
- setup conditions;
- entry conditions/models;
- required context;
- invalidation;
- risk-policy references;
- execution modes permitted;
- version history.

### Editing

Where configuration is supported:
- clear draft vs active version;
- explicit “create new version” model;
- change summary;
- validation warnings;
- confirmation before activating material changes.

Never silently mutate the method attached to existing Decision Cases.

---

## 14. Mandate / automation UX

Automation should feel like delegated authority, not a turbo button.

### Mode selector

Modes:
- Signal;
- Semi-Auto;
- Auto;
- Full Auto.

Avoid placing these as a casual four-way segmented toggle with instant effect.

### Changing into higher authority

Require contextual review:
- selected account(s);
- allowed methods;
- allowed instruments/markets;
- max risk;
- duration/expiry;
- protection expectations;
- broker connection;
- status/readiness.

Higher authority should require explicit confirmation.

### Auto mandate card

Show:
- active/inactive;
- account;
- scope;
- method;
- market/instruments;
- risk ceiling;
- valid from/until;
- current mode;
- last changed;
- revocation control.

### Revocation

Revocation should be:
- obvious;
- immediate/server-authoritative;
- separated from ordinary settings;
- confirmed;
- logged.

Do not create panic-inducing UI, but make safety action discoverable.

### Full Auto

If locked:
- show why;
- show status from authoritative capability data;
- do not tease with fake “coming soon” hype.

---

## 15. Execution UX

### Signal mode

No execution CTA pretending an order will be placed.

### Semi-Auto

Prepared intent should show:
- instrument;
- side;
- order type;
- entry;
- stop;
- target(s);
- quantity/risk;
- account;
- method;
- age/freshness;
- changes since prepared;
- approval deadline.

Before approval/submission:
- revalidate;
- show if values changed;
- prevent stale approval.

### Auto

For automatic execution:
- surface that the action occurred under a mandate;
- show mandate version/scope in audit detail;
- show broker status;
- show protective state.

### Broker states

Design clear states for:
- preparing;
- reserved;
- submitted;
- acknowledged;
- rejected;
- submission unknown;
- partially filled;
- filled;
- protection pending;
- protected;
- protection failed;
- reconciliation required.

“Submission unknown” must not look like “failed” if the system genuinely does not know.

---

## 16. Risk/account UX

Risk should feel like a governing context, not a decorative gauge.

Display as supported:
- equity/balance;
- open risk;
- remaining configured risk;
- daily/total drawdown;
- account state;
- exposure;
- prop constraints;
- active positions.

Use clear labels for:
- system internal policy;
- user configured limits;
- broker facts;
- prop-firm rules.

Do not visually imply unsupported guarantees.

---

## 17. Decision Journal / Memory

The journal is a core product, not an afterthought.

### Journal list

Each Decision Case shows:
- instrument;
- date/time;
- method;
- direction;
- decision path;
- action;
- outcome;
- process adherence;
- override marker;
- mode.

### Decision detail timeline

Visual timeline:

```text
Opportunity detected
      ↓
Method qualified
      ↓
Evidence strengthened/weakened
      ↓
Context changed
      ↓
Entry changed
      ↓
Decision state changed
      ↓
User/system action
      ↓
Broker result
      ↓
Outcome
      ↓
Process adherence
```

Every important event should have:
- time;
- source;
- state;
- reason;
- user/system actor.

### Process vs outcome

Make the distinction unmistakable.

Example:

```text
Outcome
+1.8R

Process
METHOD VIOLATION

System
PASS

User action
OVERRIDE
```

Do not visually reward the profit in a way that obscures the violation.

---

## 18. Capability/readiness board

Public and authenticated versions may differ in detail.

### Principle

> **Know exactly what's live.**

Status data must come from authoritative capability data when implemented.

### Scope dimensions

May include:
- market;
- instrument;
- broker;
- mode;
- client;
- strategy/model;
- release channel.

### Status examples

- Architecture only
- Research only
- Validation pending
- Early access
- Released Signal
- Released Semi-Auto
- Released Auto
- Locked
- Suspended

### Required presentation

- state;
- exact scope;
- last verified/effective time;
- explanation;
- applicable limitations.

Never maintain a manually optimistic marketing status separate from product truth.

---

## 19. Public website requirements

The website is not a disconnected marketing skin.

It should visually and conceptually preview the actual product.

### Core page sequence

1. Hero — master thesis
2. Bridge — chart starts the decision
3. Market — different markets/different intelligence
4. Method — user's rules
5. Moment — changing evidence/current conditions
6. Mandate — governed action
7. Memory — decision record
8. Product preview
9. Market scope
10. Capability/readiness
11. Early access
12. Risk/availability disclosures
13. FAQ

### Hero

Candidate:

**Eyebrow**  
MARKET-AWARE TRADING INTELLIGENCE

**Headline**  
The chart is not the market.

**Subheadline**  
Zugrio evaluates each opportunity in its market, against your method and current conditions, acts only within your mandate, and preserves the full decision.

**Scope**  
FX · Gold · Synthetic Indices

### Website visual behavior

Marketing may be more cinematic than the trading workspace.

Still:
- no fake live ticker;
- no fake broker connection;
- no unsupported accuracy/return badge;
- no fabricated institutions/clients;
- no “AI magic” visualization unrelated to actual product logic.

---

## 20. Onboarding

### Flow

1. Create account / accept invitation
2. Verify email/security
3. Select plan or early-access entitlement
4. Choose initial markets/interests
5. Select/create method profile
6. Connect broker or continue Signal-only
7. Bind account
8. Review risk/authority
9. Choose initial mode
10. Enter workspace

### Principle

Do not force live broker connection to understand the product.

Allow a Signal/research experience where supported.

### Automation onboarding

Auto requires a separate mandate flow after ordinary onboarding.

---

## 21. Billing / subscription UX

Subscription gives product entitlement.

It does **not** create execution permission.

The UI must keep these concepts distinct.

Example:

```text
Plan
Pro — Auto capability included

Execution authority
Disabled

Connected account
cTrader • 1234

Auto mandate
Not created
```

Avoid wording such as:
> “Auto enabled” immediately after payment

unless it only means commercial access and is clearly separated from account authority.

---

## 22. Connection UX

### cTrader

- Connect via delegated authorization/OAuth;
- show granted accounts;
- select account;
- connection status;
- token/permission health;
- disconnect.

### MT5

The UX must distinguish:
- local desktop connector;
- always-on connector/hosted path where available;
- terminal status;
- account binding;
- connector version;
- heartbeat;
- broker-side protection capability.

Do not ask the user for developer client secrets.

---

## 23. Notification system

Notifications should be actionable and tiered.

Priority classes:
- decision/opportunity;
- context/macro;
- execution;
- risk/safety;
- connection;
- account/subscription;
- product/system.

Examples:
- “EURUSD decision now READY”
- “Entry no longer qualifies at current price”
- “High-impact USD event in 12 min”
- “Auto mandate revoked”
- “Broker submission status unknown — reconciling”
- “Protective stop not confirmed”

High-severity safety notifications should visually differ from ordinary opportunity alerts.

---

## 24. Search / command access

Power users should be able to quickly navigate by:
- symbol;
- market;
- account;
- method;
- decision case;
- command.

Explore a command palette for desktop/web.

It should not expose dangerous capital actions without appropriate confirmation.

---

## 25. Component system

Required primitive/component families include:

### Navigation
- rail;
- top bar;
- tabs;
- command/search;
- breadcrumbs where useful.

### Status
- state chip;
- freshness indicator;
- connection indicator;
- capability status;
- mandate status;
- risk state;
- provenance/source tag.

### Cards/panels
- opportunity card;
- evidence card;
- context event;
- method condition;
- risk card;
- authority card;
- broker state;
- Decision Case event.

### Data
- financial number;
- timestamp;
- delta;
- probability/conviction where valid;
- R multiple;
- spread/cost;
- account exposure.

### Controls
- timeframe;
- chart layer toggle;
- filter;
- method selector;
- mode control;
- account selector;
- approval/reject;
- mandate create/edit/revoke.

### Overlays
- drawer;
- modal;
- popover;
- tooltip;
- context menu.

All controls need:
- default;
- hover;
- focus;
- active;
- disabled;
- loading;
- error;
- stale/degraded states where relevant.

---

## 26. Empty, degraded and error states

Work must design these intentionally.

Required:

- no watchlist;
- no current opportunity;
- no qualifying setup;
- model unavailable;
- model not admitted for this scope;
- insufficient history;
- market data stale;
- context feed stale;
- context feed unavailable;
- broker disconnected;
- broker reconnecting;
- broker state unknown;
- no account selected;
- authority revoked;
- subscription unavailable;
- capability validation pending;
- research-only capability;
- locked Full Auto;
- chart failure;
- partial chart/data load;
- service maintenance;
- Decision Case has no execution because user passed;
- missed opportunity;
- expired opportunity.

“No opportunity” is a legitimate state, not a broken screen.

---

## 27. Responsive behavior

### Desktop
Dense professional workspace.

### Tablet
Reduced columns:
- chart + collapsible inspector;
- opportunity drawer;
- execution/risk drawer.

### Mobile
Prioritize:
1. current opportunities;
2. decision status;
3. context;
4. Semi-Auto approval;
5. positions/risk;
6. mandate controls;
7. journal.

Do not squeeze desktop into mobile.

---

## 28. Accessibility

Required:
- keyboard navigation;
- visible focus;
- screen-reader labels for statuses/controls;
- reduced motion;
- semantic heading/order;
- no red/green-only decisions;
- minimum touch target sizes on mobile;
- chart/tooltips with accessible textual equivalents for key decisions;
- high-contrast critical statuses.

---

## 29. Motion system

Motion should communicate:
- evidence arrival;
- state progression;
- selection/focus;
- panel hierarchy;
- actual live data updates.

Avoid:
- constant glowing;
- casino-like pulse;
- faux-live movement;
- dramatic BUY/SELL celebration;
- celebratory confetti for profit.

Profit is an outcome, not validation of the process.

---

## 30. Visual design direction

Use `docs/brand/VISUAL_DIRECTION_V0_2.md`.

Summary:
- deep graphite / ink dark-first foundation;
- layered premium surfaces;
- one main luminous brand accent, likely in electric blue/cobalt/indigo territory;
- restrained secondary atmospheric accent;
- semantic financial/status colors separate from brand color;
- bright color used sparingly;
- excellent numerals;
- subtle depth;
- no gaming/crypto-casino aesthetic;
- no copycat visual identity.

Final exact palette is not locked until founder reference review.

---

## 31. Design quality bar

The final experience should withstand comparison with world-class modern financial/software products in:
- hierarchy;
- spacing;
- density;
- typography;
- interaction;
- animation restraint;
- responsive quality;
- empty/error-state maturity;
- accessibility;
- consistency.

“Premium” must come from craft and clarity, not expensive-looking gradients.

“Mature” means:
- every state is designed;
- every action has consequences;
- every permission is clear;
- every failure state is believable;
- every important number has context;
- every visual flourish has a job.

---

## 32. Anti-patterns

Do not produce:

- giant dashboard cards with vanity KPIs;
- 15 gradients per screen;
- constant glassmorphism;
- tiny gray text;
- unlabeled icons for critical controls;
- one giant BUY/SELL button;
- universal “confidence score”;
- one entry strategy presented as the Zugrio strategy;
- broker-specific language in Decision Core UI;
- technical architecture dumped directly on retail users;
- marketing states inconsistent with product status;
- fake institutional language;
- fake AI explanations;
- inaccessible charts;
- unexplained abbreviations;
- overly rounded consumer-bank UI if it reduces precision;
- Bloomberg cosplay;
- TradingView clone.

---

## 33. GPT Work deliverables

Work should produce design output in stages.

### Stage A — System exploration

1. Visual mood/quality board based on founder references.
2. Reference decomposition: what to borrow as principle vs what must not be copied.
3. 2–3 visual system directions within the agreed dark/premium constraint.
4. Typography candidates.
5. Provisional color-token systems.
6. Shape/icon/motion direction.

### Stage B — Core app architecture

Design:
- desktop app shell;
- Workspace;
- Opportunity card;
- Decision Inspector;
- chart with decision overlays;
- Method detail;
- Moment/context detail;
- Mandate/automation;
- Journal/Decision Case;
- Accounts/risk;
- Connections;
- capability/readiness.

### Stage C — Critical workflows

Prototype:
1. discover opportunity → inspect → pass;
2. discover → qualifies → Signal;
3. Semi-Auto approval with revalidation;
4. Auto execution under mandate;
5. stale entry becomes invalid;
6. macro context changes decision;
7. user override recorded;
8. broker submission unknown/reconciliation;
9. authority revoke across devices;
10. post-trade journal/process-adherence review.

### Stage D — Mobile

Design:
- opportunity feed;
- decision detail;
- macro/context alert;
- Semi-Auto approval;
- positions/risk;
- mandate status/revoke;
- journal.

### Stage E — Marketing connection

Design:
- 3 hero applications using Brand v2.2 candidate;
- Market/Method/Moment/Mandate/Memory website sections;
- readiness board;
- product preview;
- early-access conversion.

### Stage F — Design system

Deliver:
- tokens;
- typography;
- spacing;
- radii;
- elevation/surfaces;
- colors;
- icon style;
- motion;
- components;
- states;
- responsive rules;
- accessibility notes.

---

## 34. Required fidelity in Work output

Do not stop at a moodboard or pretty dashboard.

For major surfaces, Work should show:
- default;
- populated;
- empty;
- loading;
- stale/degraded;
- error/blocked;
- locked/research-only;
- narrow/mobile behavior where applicable.

Interactive prototypes should demonstrate meaningful product transitions.

---

## 35. Design acceptance criteria

The design is not ready if:

1. It looks excellent but cannot explain why an opportunity changed state.
2. Market, Method, Moment, Mandate and Memory are visually indistinguishable.
3. A signal can be mistaken for execution permission.
4. An unsupported market looks live.
5. stale data looks current.
6. research-only looks released.
7. Auto can be activated like a theme switch.
8. a profitable override looks like disciplined process.
9. broker uncertainty is shown as simple failure/success.
10. a trader cannot identify the current account/method/mode/freshness.
11. chart overlays obscure the price.
12. mobile is merely compressed desktop.
13. brand accent is confused with bullish/approved status.
14. references are visibly copied.
15. the design depends on invented statistics or fake performance.

The design is strong when a serious trader can move from:
> “What deserves my attention?”

to:
> “Why does it qualify?”

to:
> “Does it still hold now?”

to:
> “What am I permitting Zugrio to do?”

to:
> “What actually happened?”

without losing the decision thread.

---

## 36. Reference intake

When founder references arrive, do not immediately reskin Zugrio.

For each reference, document:
- exact element admired;
- underlying principle;
- suitability for marketing/product;
- Zugrio-specific adaptation;
- copycat risk;
- accessibility/performance implications.

Then update:
- visual direction;
- design-token proposal;
- relevant Work design prompts.

The product architecture and PRD remain authoritative over reference aesthetics.
