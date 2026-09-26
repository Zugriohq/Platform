# Zugrio Work Brief — Senior Product Designer Exploration

Status: Ready for ChatGPT Work handoff  
Role: Senior Product Designer / Design Systems Lead / Fintech Trading UX  
Mode: Exploration first; no premature visual freeze

## Mission

Take Zugrio's now-stable product thesis, architecture, design PRD, brand proposition and founder-supplied visual references and produce a mature design exploration that can become the basis of Zugrio 1.0.

Do not redesign product logic. Do not flatten the product into a generic trading dashboard. Do not copy the visual references.

The job is to find the strongest distinctly-Zugrio product design language.

## Read first — authoritative order

1. `docs/product/PRODUCT_DESIGN_PRD_V1.md`
2. `docs/product/ZUGRIO_1_0_PRD.md`
3. `docs/product/PRODUCT_DIRECTION.md`
4. `docs/architecture/SYSTEM_ARCHITECTURE_V1.md`
5. `docs/architecture/DOMAIN_MODEL_V1.md`
6. `docs/brand/BRAND_PROPOSITION_V2_2_CANDIDATE.md` — frozen for application testing
7. `docs/brand/VISUAL_DIRECTION_V0_2.md`
8. `docs/brand/REFERENCE_DECONSTRUCTION_2026_09_21.md`
9. relevant ADRs in `docs/adr/`
10. `CURRENT-GATE.md`

If any design impulse conflicts with the product/authority architecture, the architecture wins.

## Product thesis

Master line:
> The chart is not the market.

Descriptor:
> Market-aware trading intelligence.

Structural grammar:
> Market. Method. Moment. Mandate. Memory.

Standing rules:
- Market = identity / applicability.
- Method = declared rules.
- Moment = what is true now.
- Mandate = permission.
- Memory = durable record.
- Any pillar may define a threshold or requirement; only Moment reports whether it is currently met.
- Use neutral technical verbs for system behavior. Agency stays with the trader.

## Initial market scope

Parallel V1 scope:
- FX
- Gold
- Synthetic Indices

Do not make the UI appear forex-only or synthetics-only.

## Visual direction

Selected direction:
> Obsidian financial workstation + electric spectral accent.

Desired qualities:
- premium;
- deep dark;
- dense but calm;
- technically mature;
- high-trust;
- sparse luminosity;
- modern financial workstation rather than crypto/gaming dashboard.

Starting accent direction:
- electric periwinkle / cobalt-violet;
- restrained cyan/ice atmosphere;
- semantic green/red/amber remain separate from brand identity.

Do not copy reference layouts, navigation, card shapes, iconography or typography.

## Founder visual references — what to learn

The supplied references should be treated as design-quality references, not templates.

Use:
- Quantix-like restraint and near-black material quality;
- Cryptic-like density and table scanability;
- minimal exchange-panel calm and compact controls;
- strong contrast from lime concepts, translated into non-semantic Zugrio accent.

Reject:
- lime-first brand identity;
- crypto-casino energy;
- wallet/portfolio-first IA;
- giant trade CTA;
- permanent neon glow;
- multi-accent clutter;
- generic "AI trading" aesthetic.

## Core product object hierarchy

Zugrio is not a dashboard. Its signature product objects are:

- Opportunity
- Decision Inspector
- Market Scope
- Method
- Moment / Context
- Mandate / Authority
- Decision Case
- Capability Scope
- Broker / Reconciliation State

The desktop should make the decision thread understandable from discovery through action and review.

## Exploration assignment

Produce three materially distinct but on-thesis visual directions.

Each direction must show:

1. Desktop app shell
2. Workspace with:
   - opportunity stream
   - central chart
   - Decision Inspector
   - Market / Method / Moment / Mandate / Memory
   - risk/execution region
3. One Decision Case / Journal screen
4. One Mandate / Semi-Auto approval interaction
5. One compact mobile screen
6. Website hero application using frozen v2.2 copy

Do not make three superficial color variations. Each direction should differ meaningfully in:
- density;
- panel/material treatment;
- navigation;
- Decision Inspector architecture;
- chart-to-evidence relationship;
- use of Decision Thread;
- interaction hierarchy.

## Required state maturity

At least one direction must demonstrate:
- fresh/current;
- stale/degraded;
- model unavailable/out-of-scope;
- signal available but no execution authority;
- Semi-Auto prepared intent;
- submission unknown/reconciling;
- research-only or locked capability.

No fake win rate, fake live status, or invented broker state.

## Questions the exploration must answer

1. What should be the visual signature that makes Zugrio recognizable without the logo?
2. How should Market / Method / Moment / Mandate / Memory appear without feeling like five tabs bolted on?
3. How do we make the chart primary but not sovereign?
4. How should frozen decision geometry versus current executable conditions differ visually?
5. How should capability status and validation maturity appear without clutter?
6. How does Mandate feel authoritative without looking like a dangerous "Auto" toggle?
7. How should Decision Memory feel like a core product rather than an activity log?
8. How much density can we sustain while still feeling premium?
9. Which visual direction best scales from retail trader to future professional/capital-team use?
10. Which aspects of the founder references should explicitly be rejected?

## Output format

Deliver:

### A. Design thesis
A concise articulation of the design concept.

### B. Three visual directions
For each:
- name;
- rationale;
- distinguishing principles;
- layout sketch / high-fidelity concept;
- strengths;
- risks;
- what reference principles it adapts;
- what it deliberately rejects.

### C. Comparative recommendation
Do not average all three together. Recommend one direction or a deliberate hybrid and explain why.

### D. Token proposal
For the recommended direction:
- dark surfaces;
- brand accent;
- semantic colors;
- typography direction;
- spacing;
- radii;
- borders;
- elevation;
- motion.

### E. Core component anatomy
- Opportunity card
- Decision Inspector
- Method section
- Moment/context section
- Mandate card
- Decision Case event
- Capability status
- broker/reconciliation state

### F. Critical interaction prototype
At minimum:
Opportunity → inspect → Moment changes → Signal remains / entry degrades → Mandate blocks or user approves → Decision Case records outcome.

### G. Adversarial review
Attack the chosen design for:
- visual noise;
- retail-toy feel;
- institutional cosplay;
- color-semantic collision;
- accessibility;
- long-session fatigue;
- mistaken signal/permission interpretation;
- fake certainty;
- copying the references.

## Quality bar

Aim for a product that could sit credibly beside the strongest modern fintech and trading software without looking derivative.

"Premium" must come from:
- hierarchy;
- typography;
- proportion;
- component craft;
- information discipline;
- motion restraint;
- state maturity.

Not from gradients or glow.

## Non-negotiables

- No redesign of capital-authority semantics.
- No UI shortcut that merges signal with permission.
- No model-generalization claims outside capability scope.
- No hand-edited readiness fiction.
- No invented performance statistics.
- No copycat composition from the supplied references.
- No final logo exploration unless it emerges naturally from the product system; product design first.

## First task

Start with the three-direction exploration only. Do not design every screen yet. The founder wants to see where a strong senior product designer would push the product before committing to full production design.
