# Zugrio Visual Direction v0.1 — Design Foundation

Status: **provisional direction pending founder reference review**.  
Purpose: give product design enough visual constraint to begin serious work without prematurely freezing exact brand colors, logo or typography.

## 1. Direction

Zugrio should feel:

- premium;
- deeply modern;
- dark-first;
- precise;
- high-trust;
- technically mature;
- calm under pressure;
- visually distinctive without becoming theatrical.

The experience should feel closer to an elite trading workstation, modern financial operating system and advanced decision environment than to:
- a crypto casino;
- a neon gaming dashboard;
- a signal-group app;
- a generic SaaS admin panel;
- a sci-fi HUD;
- a copy of TradingView, Bloomberg, Linear, Stripe, Revolut, Robinhood or any reference product.

References are used to study quality, hierarchy, density, motion, rhythm, component craft and visual confidence — not to reproduce layouts, iconography, gradients or signatures.

## 2. Color architecture before exact colors

We should decide the **role system now** and the **exact final hues after founder reference review**.

This reduces rework while preserving enough freedom to refine the identity.

### Foundation

Use a deep neutral-dark environment rather than pure black.

Target character:
- blackened graphite;
- blue-black / ink;
- restrained cool undertone;
- layered depth through value, border and translucency rather than excessive glow.

Provisional role ladder:

```text
Canvas / deepest background
    ↓
Primary workspace surface
    ↓
Raised panel
    ↓
Interactive/selected panel
    ↓
Popover / transient layer
```

Surfaces must remain distinguishable on low-quality displays. Do not rely on one-pixel differences invisible outside a calibrated monitor.

### Brand accent

Use one principal luminous accent family.

Working direction:
- electric blue / cobalt / slightly indigo-leaning spectrum;
- capable of becoming bright and energetic against the dark base;
- used sparingly for focus, active navigation, primary action, selection, important data linkage and brand moments.

A secondary atmospheric accent may exist — possibly violet, cyan or ice — but it must not compete with the principal accent.

Do not lock the exact hue before reference review.

### Semantic colors are separate from brand color

Financial and system status colors must never be inferred from the brand palette.

Required semantic families:
- positive / favorable;
- negative / adverse;
- caution;
- informational;
- unavailable / neutral;
- research / experimental where needed.

BUY/SELL, profit/loss, ALLOW/BLOCK and RELEASED/LOCKED are different semantics and must not collapse into the same color pair without text/icon support.

Brand blue must never mean:
- safe trade;
- approved trade;
- bullish;
- released;
- profitable.

### Bright accents

Bright color is earned by importance.

Use it for:
- active focus;
- key state transition;
- currently selected opportunity;
- primary CTA;
- data flow / evidence linkage;
- exceptional alert.

Do not paint every panel with gradients or glows.

The eye should always know where the next important decision is.

## 3. Contrast and accessibility

- WCAG 2.2 AA target for normal UI text.
- Small financial/status text should prefer stronger contrast than the minimum.
- Never encode state by red/green alone.
- Preserve legibility under deuteranopia/protanopia simulations.
- Avoid low-opacity gray text below practical readability.
- Focus rings must be obvious without clashing with trading-status colors.

## 4. Typography

The product requires:
- excellent tabular numerals;
- clear minus/plus signs;
- unambiguous 0/O and 1/l/I where technical identifiers appear;
- strong readability at 12–14px-equivalent dense UI sizes;
- confident editorial display type for marketing;
- consistent weights across Windows/macOS/web rendering.

Direction:
- primary UI family: contemporary grotesk/humanist sans with excellent numerals;
- optional display family only if it creates a distinctive brand benefit;
- monospace only for data/IDs/log-like surfaces where it improves scanning.

Do not select a final paid font until licensing, loading and fallback behavior are verified.

## 5. Shape language

Zugrio should feel engineered, not bubbly.

Use:
- controlled corner radii;
- crisp panel geometry;
- thin high-quality borders;
- disciplined spacing;
- selective glass/translucency only where hierarchy benefits;
- clear line/path motifs derived from Decision Thread / evidence continuity.

Avoid:
- oversized pill-everything UI;
- excessive rounded cards;
- floating blobs;
- random orbit graphics in operational screens;
- decorative dashboard chrome.

## 6. Light, depth and material

Depth should come from:
- tonal layering;
- subtle borders;
- local shadows;
- controlled highlight edges;
- rare soft bloom around important active objects.

No permanent neon halo around every clickable.

Marketing can use more cinematic light than the product.

Operational surfaces should remain quiet enough for long sessions.

## 7. Motion

Motion communicates:
- change;
- causality;
- focus;
- progression;
- state transition.

Examples:
- evidence arriving;
- decision status changing;
- a Decision Thread moving from Market → Method → Moment → Mandate;
- a stale entry visibly becoming stale;
- authority switching modes;
- a journal timeline expanding.

Motion must never:
- make stale data look live;
- imply profitability;
- create urgency merely to provoke action;
- animate price when no actual update occurred.

Support reduced motion.

## 8. Data visualization

Charts, market structure and decision overlays must remain primary analytical surfaces.

Rules:
- annotation layers are individually toggleable;
- live/current versus historical/frozen geometry must be visually distinct;
- structure, context and execution overlays must not become visual noise;
- color, line style, opacity and spatial position should encode different dimensions deliberately;
- stale/degraded data must be visibly degraded, not merely noted in a tooltip;
- no “AI glow” around arbitrary predictions.

## 9. Iconography

Icons should be:
- custom-feeling but familiar;
- geometrically consistent;
- legible at 16px;
- line or restrained filled style;
- paired with labels for important states.

Do not use:
- bull/bear clichés;
- rocket icons;
- robot heads;
- generic shield overload;
- casino-like lightning for “opportunity”.

## 10. Visual signature candidates

The visual identity should explore these reusable ideas:

### Decision Thread
A continuous line/path representing evidence and decision continuity. It can strengthen, branch, pause, terminate or resolve into a governed action.

### Scope Frame
A framing device showing what market/model/method scope is currently active.

### Mandate Boundary
A clear visual boundary showing what may and may not execute.

These motifs must work in:
- product;
- landing page;
- reports;
- investor materials;
- social;
- light monochrome reproduction.

## 11. Reference review protocol

When the founder supplies references:

For each reference identify:
- what quality is attractive;
- what is specific to that brand and must not be copied;
- what interaction or visual principle can be abstracted;
- whether it belongs in marketing, product, or both;
- whether it supports or contradicts Zugrio's density, trust and decision goals.

Then update this document with:
- approved palette direction;
- typography candidates;
- surface treatment;
- motion principles;
- navigation/component density;
- graphic signature.

Do not rebuild the PRD around a reference's existing information architecture unless Zugrio's own product logic justifies it.
