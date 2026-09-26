# Zugrio Landing V4 — Work Execution Brief

Status: founder-approved direction for the next landing-page design/implementation pass  
Target: `prototypes/landing-v3-react/` evolved into the next reviewed candidate  
Do not merge to `main` without founder review.

## 1. Objective

Produce the strongest public-facing Zugrio landing candidate to date by combining:

- the cleaner, previously approved landing-page visual baseline;
- the canonical Zugrio wordmark direction;
- a premium full-screen opening brand reveal;
- a proprietary atmospheric visual language based on market topography / horizon rather than a literal mountain;
- slower, more deliberate motion;
- sharper trader-relatable copy;
- improved waitlist-form ergonomics;
- strict truthfulness about current product status;
- human-handoff viability.

The result must feel like a serious financial-technology company and a modern trading-intelligence product, not a template, Web3 landing page, gaming interface, or generic AI aesthetic.

## 2. Source precedence

When implementation details conflict, use this order:

1. Founder instructions recorded in this brief.
2. Frozen Zugrio architecture / authority contracts.
3. `docs/brand/BRAND_PROPOSITION_V2_2_CANDIDATE.md`.
4. `docs/brand/BRAND_ASSET_SOURCE_OF_TRUTH_STANDARD.md`.
5. `docs/product/PRODUCT_DESIGN_PRD_V1.md`.
6. `docs/brand/VISUAL_DIRECTION_V0_3.md`.
7. This landing application brief.
8. Existing prototype implementation.

The landing page is an application of the brand. It must not silently rewrite the product architecture or authority model.

## 3. Mandatory rollback / cleanup

Restore the visual quality of the landing page before the rejected branding pass.

Remove or replace:

- the improvised vector/line mountain or ridge;
- the extra generic silver/chrome wordmark treatment inserted into page sections;
- any generated logo treatment whose contours differ from the approved wordmark direction;
- any decorative element added during the rejected pass that weakens the cleaner prior composition.

Do **not** perform a destructive repository rollback that discards later functional improvements.

Preserve good later work, including where still valid:

- Cloudflare waitlist contract;
- expanded required profile form;
- Turnstile flow;
- successful form states;
- candlestick/product illustration improvements;
- responsive work;
- accessibility work;
- useful motion infrastructure;
- rolling descriptors;
- Decision Inspector/product-preview work.

This is a selective visual rollback followed by a controlled forward iteration.

## 4. Identity rule: one geometry

There is one ZUGRIO wordmark geometry.

No implementation may independently redraw:

- Z diagonal/construction;
- U proportions;
- G incision;
- R leg/cut;
- I;
- O contour;
- corner shapes/radii;
- inter-letter spacing.

Flat white, silver, black, metallic, ghost, animated and mask variants must derive from the same master geometry.

Image generation may provide finish/material references but must not become the canonical source of the letterforms.

Until the final editable vector master is formally signed off, treat the approved custom-geometry reference as locked visual direction and do not invent a replacement.

## 5. Full-screen opening sequence

### 5.1 Purpose

The first visual seen when opening `zugrio.xyz` should be a premium brand initialization sequence.

The hero, chart and navigation must not visually compete before the sequence resolves.

This is a signature moment, not a reusable gimmick.

### 5.2 Material character

Target material:

- machined / brushed silver;
- dimensional but restrained;
- physically plausible;
- dark, premium, institutional;
- not mirror chrome;
- not liquid metal;
- not foil;
- not plastic;
- not a generic gradient wordmark.

### 5.3 Animation model

Do **not** use a casual horizontal shimmer.

Use a **multi-layered specular contour reveal**: light should behave as if it is interacting with a formed metallic object.

Required stages:

#### A. Dark emergence
- near-black full viewport;
- logo initially almost submerged in shadow;
- slight readable edge presence before the main light event;
- no distracting background animation.

#### B. Primary grazing light
- one controlled moving light source traverses the wordmark;
- illumination should respond to the geometry rather than lighting every letter uniformly;
- the pass should reveal surface depth and directional metal grain.

#### C. Geometry-sensitive catches
The moving light should create distinct highlight behavior where the form changes:

- Z diagonal and terminal edges;
- G incision / cut;
- R bowl-to-leg transition and engineered leg;
- O outer/inner curvature;
- other relevant chamfers, bends or inner contours.

These are brief specular catches, not decorative sparkles.

#### D. Secondary residual glints
After the primary pass:
- a small number of restrained edge reflections may remain;
- glints must feel optically motivated by the geometry;
- no glitter, particle shower or game-like lens flare.

#### E. Settle
- highlights dissipate;
- wordmark resolves into a calm final metallic state;
- page transition begins only after the mark is visually legible and settled.

#### F. Transition
- reveal the site through an elegant opacity/spatial transition;
- avoid an abrupt cut;
- do not create a long forced loading screen.

### 5.4 Timing target

Target total experience: approximately **2.2–3.0 seconds** on first/full animation.

Suggested rhythm, subject to visual tuning:

- emergence: 0.45–0.70s;
- primary specular pass: 1.00–1.35s;
- contour catches/residual response: overlaps pass and continues ~0.35–0.60s;
- settle/transition: 0.40–0.65s.

Motion must feel deliberate, not sluggish.

### 5.5 Easing

Avoid constant linear motion.

The light may:
- enter slowly;
- gather pace across broad planes;
- appear to dwell very subtly at meaningful geometry transitions;
- resolve with a soft ease-out.

Do not exaggerate pauses to the point that the animation looks scripted letter-by-letter.

### 5.6 Reduced motion

For `prefers-reduced-motion`:
- show the final logo state immediately or with a very short opacity reveal;
- keep the brand-first opening frame;
- transition to page in roughly 0.4–0.6s;
- no sweeping/glint sequence.

## 6. Atmospheric key visual

### 6.1 Do not ship a literal mountain yet

The previous line-art ridge is rejected.

Do not substitute another generic mountain image.

### 6.2 Concept territory

Explore a proprietary visual system around **Market Topography / Market Horizon**.

Core conceptual link:

> The chart is not the market.

The visual should imply that the visible price surface is part of a larger market environment.

Potential ingredients:

- a dark three-dimensional terrain/field;
- topographic ridges generated from abstract market structure rather than geographic mountains;
- depth disappearing into near-black;
- a restrained silver horizon or emergent light;
- subtle contour lines or data-derived geometry;
- a sense of global scale without drawing a cliché network globe.

### 6.3 Motion possibilities

Motion may include:

- very slow parallax across depth layers;
- grazing metallic highlights traveling along selected contours;
- subtle changes in topographic relief;
- controlled horizon illumination;
- low-amplitude depth breathing;
- slight perspective response to cursor/scroll on capable desktop devices.

The graphic should feel alive without implying live market data.

No:
- neon grid;
- glowing crypto globe;
- busy particles;
- fake tick data;
- pulsing trading signals;
- exaggerated mouse-follow gimmicks.

### 6.4 Alternative concept to explore before selection

A restrained **Global Market Field** may be explored as a second concept:

- dark spherical/world-scale form;
- surface built from abstract market/data geometry;
- no literal country map required;
- no glowing network-node cliché;
- silver/graphite light behavior only.

Compare against Market Topography before integration.

Do not integrate the atmospheric graphic into production until one visual direction is explicitly approved.

## 7. Global motion system

The existing page generally moves too quickly.

Retune it toward a calmer premium rhythm.

Principles:

- comprehension before spectacle;
- one primary motion idea per viewport;
- slower section entrances;
- longer easing tails;
- fewer simultaneous independent movements;
- motion should clarify hierarchy or continuity;
- do not animate simply because an element can move.

Suggested baseline changes:

- increase standard section reveal duration into roughly 600–900ms where appropriate;
- stagger supporting elements lightly rather than firing together;
- reduce aggressive rotate/tilt effects;
- slow ambient movement significantly;
- preserve responsiveness to user interaction;
- avoid scroll hijacking.

Motion density should decrease on mobile.

## 8. Copy direction

Copy should be trader-relatable, technically credible and concise.

Voice:
- restrained;
- intelligent;
- operational;
- confident without hype;
- understandable to a serious beginner;
- credible to experienced traders and technical/investor readers.

Do not name competitors in public-facing copy.

Do not make performance promises.

Do not imply that Zugrio eliminates losses or trader psychology.

Describe what the product does structurally: it applies a defined method consistently, tracks changing evidence, exposes overrides, preserves decisions, and can act only inside the trader's chosen mandate.

### 8.1 Hero

**Badge**

`MARKET-AWARE TRADING INTELLIGENCE · PRIVATE BUILD`

**Headline**

`The chart is not the market.`

**Recommended application subhead**

`Zugrio evaluates each opportunity in the market that produced it, against your method and current conditions — then shows what still holds, what changed, and what is permitted next.`

This keeps the product thesis while avoiding conversational phrasing such as "the market that made it."

**Visible trust line**

`Your capital stays in your broker account. You set the mandate; Zugrio evaluates what qualifies and acts only within the authority you grant.`

This must remain compatible with Signals, Semi-Auto, Auto and Full Auto. Do not imply every future execution requires a manual click.

**Market scope**

`FX · Gold · Synthetic Indices`

## 8.2 Market section

Headline:

`Same pattern. Different market. Different answer.`

Body candidate:

`A structure break in FX, Gold and a Synthetic Index can look similar on a chart and still mean different things. Zugrio evaluates the opportunity inside the market family that produced it — with its own behaviour, calibration and conditions — instead of forcing every instrument through one generic model.`

Do not claim validated predictive superiority.

## 8.3 Method section

Retain:

`Your method sets the rules. Zugrio doesn't silently bend them.`

Sharper body candidate:

`Choose the framework you trade — structure and liquidity, smart-money concepts, or your own price-action rules. Zugrio evaluates the market against that method consistently, without quietly changing the standard because the session is slow, the last trade lost, or you've been watching the chart too long.`

Supporting control line:

`Methodology and automation are separate choices. One defines how an opportunity is evaluated. The other defines what Zugrio is allowed to do about it.`

Do not name ICT publicly.

## 8.4 Live chart annotation

Treat this as a major feature, not supporting trivia.

Headline candidate:

`Watch the reasoning form on the chart.`

Body:

`Zugrio doesn't hand you a score after the fact. As structure develops, the chart can show what the system has actually confirmed, what it is waiting for, and what invalidates the case — a break confirmed, a retest pending, a condition changed.`

Every state shown in the prototype must be truthfully illustrative and labelled as such where necessary.

## 8.5 Discipline / chart fatigue

Headline candidate:

`Your rules should not change because your mood did.`

Body candidate:

`Long chart sessions create pressure: impatience, early entries, revenge re-entry, moving the goalposts after a loss, or seeing a setup because you want one to be there. Zugrio keeps applying the method you defined and records when you choose to override it.`

Important: this is a workflow/discipline claim, not a medical/psychological claim and not a claim that Zugrio prevents losses.

Supporting line:

`The market doesn't care how long you've been watching it. Your evaluation standard shouldn't either.`

## 8.6 Decision still holds / override

Copy:

`When the case no longer holds, Zugrio says so. You can still override it — your account, your decision — but the override stays attached to the case. The record doesn't get rewritten later to make the outcome look inevitable.`

Avoid the phrase "at your own cost"; it is unnecessarily punitive and may imply a financial result.

## 8.7 Current conditions

Headline candidate:

`If the facts change, the trade changes.`

Body:

`A setup does not exist in isolation. Session, volatility, market regime, account state and other relevant context can change what still qualifies. Zugrio keeps the original case visible while showing what changed around it.`

Do not present macro/news/geography inputs as fully live unless the implementation supports them.

## 8.8 Decision integrity / history

Core brand concept: **decision integrity**.

Retain:

`The reason stays with the trade. Hindsight doesn't get to rewrite it.`

Body candidate:

`Entered, passed, blocked, expired, missed or overridden — the case remains part of the record. Outcome and process stay separate, so a profitable trade is not automatically a good decision and a losing trade is not automatically a bad one.`

This is one of the strongest explanatory statements on the site and should be visually prominent.

## 8.9 Why Zugrio exists

Avoid unverified founder-capital figures.

Headline candidate:

`Built around the decisions traders have to make under pressure.`

Body candidate:

`Good trading rules are easy to describe away from the market. They are harder to follow after a loss, during a long session, or when a setup is almost — but not quite — there. Zugrio is being built to keep the method, the evidence, the mandate and the resulting decision connected from opportunity to outcome.`

Do not publish specific founder trading-equity figures until provenance and legal implications are resolved.

## 8.10 Status layer

Keep current-stage truth explicit but subordinate to the company thesis:

`Zugrio is currently in private development and validation. Public trading access is not yet available. No performance claim is being made.`

Do not scatter defensive status disclaimers across every section.

## 9. Waitlist UX

The expanded profile flow currently creates unnecessary friction because a user can complete the lower fields and then has to scroll upward to find the submit action.

Fix this.

When the trading-profile disclosure is expanded, provide an obvious final action at the bottom of the expanded section.

Preferred interaction:

1. email and primary CTA remain in the compact top state;
2. opening "Tell us how you trade" reveals the complete required profile;
3. the expanded block ends with:
   - consent/required disclosure;
   - Turnstile where appropriate;
   - a full-width or clearly dominant `Join the early-access waitlist` submit button;
4. submission can be completed entirely from the bottom of the expanded form;
5. do not require the user to scroll back to the original top CTA.

Avoid two simultaneously confusing primary submit buttons. If both top and bottom actions exist, their states must be context-aware.

On mobile, the bottom submit action must be comfortably reachable and must not be obscured by browser chrome or sticky UI.

## 10. Product preview / chart

Preserve the move from generic line chart to candlesticks.

Requirements:

- clearly illustrative, not live price data;
- chart remains primary evidence surface but not sovereign;
- market switch between FX, Gold and Synthetic Indices remains available;
- structure annotation should demonstrate the product thesis;
- visual language should use trader-familiar terms at Glance/Inspect level;
- exact architecture language belongs primarily in Audit/details.

Avoid visual clutter. The point is to demonstrate connected reasoning, not recreate a full terminal on the marketing page.

## 11. Color and visual register

Current approved direction:

- near-black / obsidian;
- graphite;
- soft white;
- steel / silver;
- semantic green/red only where state requires them;
- cobalt may remain an application/system accent only where it improves product-state clarity, not as an obligatory decorative brand wash.

Do not reintroduce the rejected periwinkle/cobalt-violet identity direction.

Metallic silver is a **signature material treatment**, not a reason to make every component metallic.

## 12. Typography

Preserve the institutional/system-native direction unless a later explicit typography decision replaces it.

- strong hierarchy;
- excellent optical spacing;
- tabular monospace numerics;
- no fashionable display font merely for novelty;
- no oversized copy that forces ordinary laptop users to experience the page as a sequence of billboards.

Review specifically at common laptop viewport sizes.

## 13. Responsive behavior

Desktop and mobile should share the same brand idea without forcing identical choreography.

Desktop may support:
- contour-sensitive specular opening;
- subtle pointer-linked topographic depth;
- larger product illustration;
- wider evidence strip.

Mobile should:
- retain opening identity;
- simplify expensive effects;
- avoid excessive parallax;
- preserve legibility and input convenience;
- keep chart/product preview usable rather than decorative;
- preserve bottom-of-form submit access.

## 14. Performance

Premium animation cannot justify a slow landing page.

Targets/guidance:

- avoid large autoplay video where CSS/SVG/WebGL/canvas can achieve the effect more efficiently;
- lazy-load non-critical atmospheric assets;
- keep first contentful experience intentional;
- no layout shifts during intro-to-page transition;
- pause offscreen animation;
- respect low-power/reduced-motion contexts;
- test mobile GPU cost;
- no perpetual high-cost shader merely for ambience.

If a complex shader/WebGL treatment is proposed, provide a static/CSS fallback.

## 15. Accessibility

- reduced-motion support is mandatory;
- sufficient contrast;
- keyboard-operable waitlist disclosure and controls;
- visible focus states;
- semantic headings;
- decorative atmospheric imagery hidden from assistive tech;
- no important meaning conveyed solely by animation;
- intro must never trap keyboard/focus or delay access excessively.

## 16. Prohibited patterns

Do not introduce:

- generic AI-generated logo geometry;
- mountain-line SVG;
- neon crypto globe;
- ribbons/accent bars on cards;
- emoji/glyph icons in place of SVG icons;
- letter-in-rounded-square avatars;
- gratuitous glassmorphism;
- excessive blur;
- random glow;
- chirpy CTAs;
- fake social proof;
- fake execution/live-market states;
- fake performance metrics;
- named competitor attacks;
- a metallic treatment on every surface.

## 17. Deliverables

Work should produce:

1. revised landing implementation;
2. before/after screenshots at:
   - 1440px desktop;
   - common 1366px laptop;
   - 390px mobile;
3. opening-logo motion capture/reference;
4. reduced-motion capture;
5. Market Topography concept A;
6. Global Market Field concept B;
7. recommendation comparing A/B without silently integrating either;
8. copy diff against current landing;
9. motion-token/timing notes;
10. waitlist form interaction proof;
11. performance notes;
12. accessibility notes;
13. files changed summary;
14. explicit list of illustrative/non-live product visuals.

Do **not** create a second competing wordmark.

## 18. Acceptance criteria

The pass is ready for founder review only when:

- the rejected ridge/mountain line is gone;
- the rejected extra logo treatment is gone;
- the cleaner prior landing composition is restored where appropriate;
- only one wordmark geometry is used;
- the opening mark is the first visual experience;
- the logo light behaves as a contour-aware specular material interaction rather than a flat sweep;
- motion pacing feels slower and more premium than the current prototype;
- atmospheric visual concepts are sophisticated and non-cliché;
- copy is sharper and more trader-relatable without making performance claims;
- public copy does not name/attack competitors;
- methodology and automation are correctly separated;
- non-custodial capital handling is visible;
- decision integrity is prominent;
- live chart annotation is prominent;
- override/discipline copy does not imply guaranteed behavioral outcomes;
- expanded waitlist form can be submitted from its bottom;
- mobile and reduced-motion states are deliberately designed;
- no current-state claim exceeds what the product actually supports;
- implementation remains human-reviewable and maintainable.

## 19. Founder review gates

Before production publication, require explicit approval of:

- canonical vector wordmark;
- opening animation;
- chosen atmospheric visual;
- final hero/trust copy;
- founder-credibility section;
- any readiness/status language;
- final waitlist incentive, if one is introduced.

No automatic merge or deployment.
