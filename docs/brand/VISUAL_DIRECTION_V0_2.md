# Zugrio Visual Direction v0.2 — Reference-Informed Design Foundation

Status: **selected visual direction for application testing**. Exact production tokens remain subject to component-level accessibility and display testing.  
Supersedes: \`VISUAL_DIRECTION_V0_1.md\`.

## 1. Selected direction

> **Obsidian financial workstation + electric spectral accent.**

Zugrio should feel:
- premium;
- deeply modern;
- dark-first;
- precise;
- high-trust;
- technically mature;
- calm under pressure;
- luminous only where focus or state requires it;
- dense enough for serious trading without legacy-terminal fatigue.

The founder references confirm that the visual target should combine:
- restrained black/graphite financial maturity;
- strong information density;
- compact navigation;
- sparse luminous focus treatment;
- large, clean financial numerals;
- disciplined card/table construction;
- clear analytical/action boundaries.

The visual system must not become:
- lime-first crypto UI;
- gaming/neon dashboard;
- purple-gradient SaaS;
- glassmorphism everywhere;
- Bloomberg cosplay;
- a clone of any supplied reference.

## 2. Reference synthesis

The strongest principles to carry forward are:

1. **Quantix-like restraint** — nearly black workspace, low-noise shell, subtle violet/blue atmosphere, strong typography.
2. **Cryptic-like density** — clean table hierarchy, precise spacing, one energetic accent, compact navigation.
3. **Minimal exchange-panel calm** — premium control grouping, excellent spacing, restrained indigo light, low-noise action surfaces.
4. **Lime concepts' confidence** — strong contrast and decisive focus areas, translated into a non-semantic Zugrio accent rather than lime.
5. **Reject multi-accent clutter** — the product should not look like a crypto media terminal.

## 3. Core color architecture

### 3.1 Dark foundation

Starting production exploration tokens:

\`\`\`text
--z-canvas:          #07090D
--z-workspace:       #0B0E14
--z-surface-1:       #0F131B
--z-surface-2:       #141925
--z-surface-3:       #1A2030
--z-border-subtle:   #22293A
--z-border-strong:   #30384B
--z-text-primary:    #F5F7FB
--z-text-secondary:  #9CA6B7
--z-text-tertiary:   #6F788A
\`\`\`

These are starting tokens, not a final visual-QA substitute.

Surface separation must remain visible on ordinary monitors, not only high-end displays.

### 3.2 Brand accent

Primary recommendation:

> **Electric periwinkle / cobalt-violet**

Starting exploration tokens:

\`\`\`text
--z-brand:           #7C72FF
--z-brand-bright:    #9B94FF
--z-brand-deep:      #2D2860
--z-brand-ice:       #6EDBFF
\`\`\`

Rationale:
- more distinctive than generic pure fintech blue;
- calmer and more mature than acid green;
- does not collide directly with profit/loss semantics;
- works as both low-opacity atmospheric light and crisp active focus;
- supports a premium dark identity without requiring gradient-heavy treatment.

\`--z-brand-ice\` is a secondary atmospheric/data-link accent, not a second equal brand color.

### 3.3 Semantic colors

Keep semantic state separate from brand identity.

Starting exploration:

\`\`\`text
--z-positive:        #29C77B
--z-negative:        #FF5C6C
--z-caution:         #F2B84B
--z-info:            #54B9FF
--z-research:        #B08CFF
--z-neutral-state:   #7B8495
\`\`\`

Never allow brand periwinkle to mean:
- BUY;
- bullish;
- safe;
- profitable;
- ALLOW;
- released;
- approved.

Likewise semantic green must not become the Zugrio brand color.

## 4. Accessibility posture

Initial contrast checks against the darkest canvas indicate strong contrast for:
- primary text;
- secondary text;
- brand accent;
- bright brand accent;
- ice/cyan support;
- positive;
- negative;
- caution;
- informational;
- research.

Tertiary text is near the AA boundary and must not be used for small critical text without component-level verification.

Requirements:
- WCAG 2.2 AA target minimum for normal UI text;
- critical financial/status text should exceed minimum where possible;
- no red/green-only encoding;
- strong visible focus states;
- color-blind simulation during component QA;
- labels/icons accompany consequential semantic colors.

## 5. Surface and material system

Use:
- matte near-black surfaces;
- subtle local edge highlights;
- restrained 1px borders;
- minimal shadows;
- occasional low-opacity spectral bloom near selected/live focus;
- deeper material contrast for drawers/modals/decision boundaries.

Avoid:
- permanent full-card glows;
- glossy glass panels everywhere;
- multiple simultaneous gradients;
- floating neon stickers;
- decorative blur without hierarchy purpose.

Operational product surfaces should remain quiet enough for multi-hour use.

Marketing may use more cinematic lighting.

## 6. Layout density

Target density:

> **denser than generic SaaS, calmer than a legacy trading terminal.**

Use three levels of disclosure:

- **Glance** — state, freshness, reason, blocker, account/mode.
- **Inspect** — evidence, context, entry economics, risk, method.
- **Audit** — provenance, policy/model versions, exact timeline, broker reconciliation.

This density model is a key part of the premium feel.

## 7. Navigation

Preferred shell:
- compact left navigation rail;
- icon + text label;
- strong but restrained active state;
- global search/command entry;
- context-aware top status bar;
- minimal nested navigation.

Zugrio IA remains product-specific:

\`\`\`text
Workspace
Markets
Journal
Accounts
Methods
Automation
Connections
Settings
\`\`\`

Do not import Portfolio / Wallet / Trade IA from crypto references.

## 8. Typography

Direction:
- contemporary grotesk/humanist sans;
- excellent tabular numerals;
- excellent small-size readability;
- clear 0/O and 1/l/I differentiation;
- strong minus/plus characters;
- restrained tracking;
- low reliance on all-caps.

Operational screens should use one primary UI family if possible.

A separate marketing display face is optional only if it adds real distinctiveness.

Do not lock a paid font before:
- licensing review;
- Windows/macOS/web rendering checks;
- fallback behavior;
- loading-performance review.

## 9. Radius and geometry

Use:
- controlled medium-to-low radii;
- crisp rectangular panels;
- slightly softer card corners than table/container boundaries;
- consistent geometry across desktop/mobile/web.

Avoid:
- pill-everything;
- overly soft consumer-banking geometry;
- giant floating rounded cards.

Zugrio should feel engineered rather than bubbly.

## 10. Signature visual grammar

### Decision Thread
A continuous path representing how evidence and authority evolve through a decision.

It may:
- progress;
- pause;
- weaken;
- branch;
- terminate;
- resolve into an authorised action;
- remain as a historical record.

### Scope Frame
A subtle framing treatment indicating:
- current market/model scope;
- method scope;
- selected account/instrument;
- capability status.

### Mandate Boundary
A stronger visual boundary separating:
- intelligence/evidence;
- permission;
- execution.

This is especially important in Semi-Auto and Auto flows.

## 11. Component behavior

### Panels
- matte dark;
- subtle border;
- minimal glow;
- clear spacing rhythm;
- bright content only when meaningful.

### Selected/active state
Prefer:
- accent edge;
- small luminous marker;
- local tint;
- stronger border.

Avoid full-card saturation unless the state is exceptional.

### Primary buttons
- compact;
- confident;
- accent-backed or high-contrast;
- no large “trade now” theatre.

### Dangerous/revocation actions
Use semantic styling, not brand accent.

### Tables
Take inspiration from the strongest dense reference:
- clean alignment;
- tabular numerals;
- restrained row dividers;
- strong scanability;
- semantic color applied only to the relevant measure.

## 12. Chart system

The chart must remain visually quieter than many retail trading platforms.

Priority:
1. price;
2. active decision geometry;
3. current structure;
4. relevant context;
5. historical annotations.

Requirements:
- toggleable layers;
- frozen vs current geometry clearly distinct;
- BOS/CHOCH/other supported structure shown with precise, small labels;
- no decorative background gradient behind price;
- no “AI glow” around predictions;
- context markers integrated without overwhelming candles;
- stale/degraded state visible at canvas level.

## 13. Motion

Use:
- short fades/slides;
- crisp focus transitions;
- local accent/bloom;
- evidence/state transitions;
- actual live data movement when data changes.

Avoid:
- sweeping HUD effects;
- constant pulsing;
- neon breathing;
- faux live motion;
- confetti/profit celebration.

Motion should communicate causality, not excitement.

## 14. Product-specific visual hierarchy

The references contain many generic dashboard patterns that Zugrio should replace with its own core objects.

Primary Zugrio objects:
- Opportunity;
- Decision Inspector;
- Market scope;
- Method requirements;
- Moment/current conditions;
- Mandate/authority;
- Decision Case;
- Capability Scope;
- broker/reconciliation state.

The product should become recognisable through these objects plus the material system, not through decorative brand mimicry.

## 15. Marketing relationship

Public web may use:
- larger typography;
- more negative space;
- more cinematic spectral light;
- stronger single visual moments;
- Decision Thread as narrative graphic.

But it should still feel like the same company as the desktop product.

Avoid a glossy marketing site that bears no visual relationship to the trading workspace.

## 16. Design test

A successful Zugrio screen should feel:

- premium before the user notices any glow;
- technical without becoming hostile;
- dense without becoming noisy;
- modern without looking trendy for its own sake;
- trustworthy without looking conservative;
- distinct without using crypto/gaming clichés.

If removing the bright accent causes the design to collapse, the layout/material system is not strong enough.

## 17. Reference rule

All founder-supplied references are inspiration only.

For each future reference:
- identify the underlying principle;
- classify marketing/product relevance;
- identify copycat risk;
- adapt it to Zugrio's decision architecture;
- never inherit its information architecture by default.

See:
\`docs/brand/REFERENCE_DECONSTRUCTION_2026_09_21.md\`
