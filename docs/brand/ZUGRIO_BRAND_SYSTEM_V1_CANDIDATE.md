# Zugrio Brand System v1.0 — Implementation Candidate

Status: **Superseded for brand governance by `docs/brand/ZUGRIO_BRAND_OPERATING_SYSTEM_V1.md`. Retained as historical implementation reference.**

This document extends `VISUAL_DIRECTION_V0_3.md` without changing the frozen application-test language in `BRAND_PROPOSITION_V2_2_CANDIDATE.md`.

The governing visual thesis is:

> **Modern financial technology with institutional restraint, technical precision and a higher visual standard.**

The brand should feel premium and memorable without relying on neon, generic fintech blue, crypto aesthetics, decorative complexity or permanent motion.

---

## 1. Identity architecture

### 1.1 Primary name treatment

Visual wordmark:

> **ZUGRIO**

Running-language form:

> **Zugrio**

Use the uppercase wordmark as a graphic identity. Use title case in prose, product copy, legal text, support content, documentation and ordinary sentences.

### 1.2 Primary mark

The **ZUGRIO wordmark is the primary brand mark**.

The current boxed `Z` must not compete with or precede the wordmark in core communications.

### 1.3 Secondary mark

A compact `Z` monogram may exist for:
- favicon;
- app icon;
- system tray;
- social avatar;
- notification/icon-only contexts;
- extremely constrained product surfaces.

It is **supporting only**. It must be derived from the same geometry as the wordmark, not treated as an unrelated rounded-square SaaS icon.

### 1.4 Wordmark construction direction

The production wordmark should be custom vector lettering, not a typed font lockup.

Structural intent:
- uppercase;
- moderately wide stance;
- controlled, optical rather than purely geometric proportions;
- engineered `Z` diagonal;
- signature `G` incision;
- disciplined `R` leg that echoes the `Z` diagonal;
- stable, slightly optical `O`;
- individually tuned kerning across `ZU`, `UG`, `GR`, `RI`, `IO`.

The logo must remain distinctive when rendered in **flat single-color form**. Metallic finish is an application treatment, not a substitute for strong geometry.

---

## 2. Brand personality

Zugrio should visually communicate:

- composed;
- exact;
- disciplined;
- technical;
- premium;
- mature;
- forward-looking;
- calm under pressure;
- market-aware;
- trustworthy without theatrical certainty.

Avoid:
- cyberpunk;
- neon crypto;
- gamer UI;
- exaggerated sci-fi;
- luxury-for-luxury's-sake;
- glossy chrome everywhere;
- excessive glassmorphism;
- noisy gradients;
- ornamental glow;
- visual urgency.

The target is not “futuristic trading.” The target is:

> **a serious financial technology company that looks native to the AI era.**

---

## 3. Core palette

Brand identity is neutral-led. Semantic trading/status colors remain separate from brand identity.

### 3.1 Core neutrals

| Token | Value | Use |
|---|---:|---|
| Obsidian | `#050608` | deepest background / cinematic brand fields |
| Carbon | `#080B0F` | main dark canvas |
| Graphite | `#11161C` | raised product surfaces |
| Steel Graphite | `#1A2028` | selected/elevated surfaces |
| Structural Line | `#2A323C` | borders, dividers, technical linework |
| Muted Steel | `#7D8792` | secondary text, quiet metadata |
| Soft Silver | `#C9D0D6` | secondary highlight / logo flat silver |
| Soft White | `#F3F5F7` | primary interface text / high-contrast mark |

Do not use pure white over large surfaces unless necessary for accessibility or utility.

### 3.2 Metallic silver material

Metallic silver is a **material system**, not a flat brand color.

Recommended display gradient:

```css
linear-gradient(
  112deg,
  #4f555c 0%,
  #aeb5bc 18%,
  #f6f8fa 35%,
  #757c84 49%,
  #e1e5e9 64%,
  #737a82 82%,
  #c7ccd1 100%
)
```

This may be tuned by output medium, but must preserve:
- dark steel lows;
- cool silver mids;
- restrained near-white specular peaks;
- no rainbow tint;
- no warm gold contamination;
- no plastic chrome appearance.

### 3.3 Brand color rule

Zugrio does **not** require a permanent chromatic accent to be recognizable.

Recognition should come from:
- wordmark;
- metallic material;
- typography;
- spacing;
- motion;
- decision architecture;
- ridge/horizon visual motif;
- component behavior.

Any future accent color must remain distinct from positive/negative/caution/execution semantics and requires product-state testing before adoption.

---

## 4. Logo finish system

The logo has four approved classes of treatment.

### A. Flat white
Use for:
- small UI;
- utility contexts;
- high-contrast printing;
- accessibility fallback;
- low-motion environments.

### B. Flat silver
Use for:
- header;
- footer;
- navigation;
- documents;
- presentation covers;
- ordinary brand presence.

### C. Signature metallic
Use for:
- hero;
- launch moments;
- campaign key art;
- investor presentation cover;
- selected high-value brand moments.

Never use the metallic finish as the only available master.

### D. Dark embossed / tonal
Use sparingly for:
- physical applications;
- background watermark;
- premium presentation texture;
- subtle brand fields.

Never reduce legibility for atmosphere.

---

## 5. Clear space and sizing

### 5.1 Clear space

Minimum clear space around the primary wordmark should equal approximately the cap-height of the wordmark's `Z` terminal thickness / internal geometric unit established in the final vector master.

Until master geometry is finalized, implementation should use a practical minimum clear space of:

> **0.5 × wordmark cap height on every side**

Preferred premium applications:

> **0.75–1.0 × cap height**

### 5.2 Minimum digital size

Do not render the full wordmark below approximately **96 CSS px width** in ordinary UI.

Below that threshold:
- use the optimized small-size wordmark if available;
- otherwise use the secondary monogram.

### 5.3 Minimum favicon/icon size

Monogram must remain legible at:
- 32 px;
- 16 px.

The metallic texture must be removed at tiny sizes. Use flat monochrome geometry.

---

## 6. Typography system

### 6.1 Wordmark

The wordmark is proprietary custom lettering and must not be recreated by typing the company name in the UI font.

### 6.2 Product/UI typography

Implementation candidate:

- **Geist Sans** — interface, website, product copy, headings, controls;
- **Geist Mono** — prices, timestamps, IDs, model/version data, logs, audit information.

This is a product typography choice, not the logo.

Before a production brand freeze:
- verify current licensing and bundling requirements;
- test Windows ClearType;
- test macOS;
- test high-DPI and ordinary 1080p displays;
- test mobile OLED;
- test tabular numerals and financial density.

### 6.3 Typography behavior

Headings:
- tight tracking;
- controlled line length;
- large negative-space relationship;
- no overuse of all caps.

Metadata / system labels:
- uppercase allowed;
- modest letter spacing;
- smaller size;
- never use spacing so wide that scan speed suffers.

Numbers/data:
- use tabular forms where comparison matters;
- never substitute stylized branding for numeric legibility.

---

## 7. Spacing and geometry

Base spacing unit:

> **4 px**

Primary scale:

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 128`

### Surface radii

Use restraint:
- compact controls: 8–10 px;
- standard panels: 12–16 px;
- large brand cards: 16–20 px;
- pills only for genuine pill semantics.

Avoid universally rounded SaaS surfaces.

### Borders

Prefer:
- 1 px structural lines;
- value contrast before shadows;
- subtle inset highlight where material depth is needed.

Avoid heavy shadows as the primary elevation system.

---

## 8. Motion language

Brand motion must communicate **precision and controlled material response**, not speed theatre.

### 8.1 Signature sweep

The silver sweep is a brand signature.

Use only for:
- initial wordmark reveal;
- hero/high-value brand transition;
- one major lower-page identity moment;
- selected launch/presentation media.

Do not apply it to ordinary buttons, cards, menu items or every logo appearance.

### 8.2 Sweep timing

Recommended range:

- initiate: 120–220 ms;
- main sweep: 700–1000 ms;
- settle/dissipate: 300–500 ms;
- complete brand reveal: approximately 1.1–1.5 s.

The website must remain usable immediately. Do not hold the page behind an intro animation.

### 8.3 Sweep behavior

The sweep should:
- enter narrowly;
- create a controlled specular highlight;
- reveal material rather than simply wipe opacity;
- travel across the actual letterforms;
- lose intensity as it exits;
- settle to a calm static mark.

It must **not** resemble:
- a flashlight circle;
- a lens-flare explosion;
- a loading shimmer;
- a generic skeleton-screen sheen.

### 8.4 Cursor reveal

For the large interactive `ZUGRIO` brand field:
- smaller high-intensity core;
- broad soft falloff;
- no hard circumference;
- reveal should feel like material responding to light;
- autonomous sheen must remain secondary to pointer interaction.

### 8.5 Reduced motion

With `prefers-reduced-motion`:
- skip travelling sweeps;
- show the resolved mark immediately or use a subtle opacity transition;
- no cursor-following animation is required;
- do not remove important information.

---

## 9. Mountain / ridge / horizon motif

### 9.1 Meaning

The ridge is a **brand metaphor**, not literal company symbolism.

It may suggest:
- perspective;
- discipline;
- ascent;
- higher standard;
- horizon;
- distance;
- preparation;
- controlled ambition.

Do not write copy implying that the mountain itself is an official brand promise.

### 9.2 Visual character

Approved characteristics:
- monochrome;
- graphite / obsidian;
- silver edge light;
- high contrast only at selected ridges;
- deep atmospheric falloff;
- abstract enough to avoid stock-photography character;
- cinematic but restrained;
- no identifiable real-world mountain required.

### 9.3 Usage

Good:
- hero atmospheric layer;
- campaign key art;
- presentation cover;
- brand transition;
- pre-waitlist crescendo;
- subtle splash/loading state.

Avoid:
- directly behind dense trading data;
- every page;
- decorative cards;
- repeated scenic wallpaper;
- literal “mountain = success” clichés.

### 9.4 Product UI relationship

The product UI should inherit the **material logic**, not mountains everywhere.

Translate the motif into:
- directional edge lighting;
- layered graphite depth;
- precise horizon/divider lines;
- selective high-contrast focus;
- calm dark fields.

The workstation remains a financial tool, not a branded landscape.

---

## 10. Photography / imagery

When photography or generated imagery is used:
- monochrome or near-monochrome;
- high material detail;
- strong negative space;
- directional light;
- no generic traders looking at screens;
- no money piles;
- no Lamborghinis;
- no crypto coins;
- no Wall Street cliché photography;
- no fake institutional trading floors.

Preference:
- engineered environments;
- abstract market/material imagery;
- topographic/ridge forms;
- architectural detail;
- atmospheric horizon imagery.

---

## 11. UI material language

Marketing and product should share DNA without looking identical.

### Marketing
May use:
- metallic wordmark;
- larger negative space;
- ridge motif;
- stronger cinematic light;
- more expressive motion.

### Product
Prefer:
- matte graphite;
- flat silver/white identity;
- high legibility;
- lower animation amplitude;
- stricter density;
- semantic colors only where state requires them.

The product should feel related to the brand, not skinned with campaign effects.

---

## 12. Semantic color separation

Brand silver is neutral identity.

It must never replace state semantics.

Maintain separate accessible states for:
- favorable/positive;
- adverse/negative;
- caution;
- information;
- unavailable;
- research-only;
- released/locked;
- BUY/SELL;
- ALLOW/BLOCK.

Every consequential state must remain interpretable without relying on brand material or animation.

---

## 13. Logo do / don't

### Do
- use approved vector masters;
- maintain aspect ratio;
- preserve clear space;
- prefer flat versions in utility contexts;
- use metallic treatment only at meaningful scale;
- test small-size rendering;
- retain monochrome capability.

### Don't
- stretch or condense;
- retype `ZUGRIO` in an approximate font;
- add arbitrary outer glow;
- place metallic logo over visually noisy imagery without contrast control;
- recolor to random campaign colors;
- outline the logo unless an approved outline master exists;
- use the boxed monogram as the primary website brand;
- animate every appearance;
- add 3D bevels that change the underlying letter geometry.

---

## 14. Landing-page application rules

The landing page should use:

### Header
Flat silver/white wordmark. No cinematic loop.

### Hero
Signature metallic wordmark allowed.
One controlled sweep on initial entry.
Ridge/horizon atmosphere may support the hero without harming text/product-preview readability.

### Product preview
Mostly matte/flat UI material.
Do not place metallic texture inside decision-critical product surfaces.

### Lower brand reveal
Interactive metallic wordmark with soft cursor response.
This is the second major brand moment.

### Early access
Graphite conversion surface.
Subtle silver connection to preceding brand field.
No decorative effect may compete with the form.

### Footer
Flat wordmark.
Quiet, not another hero.

---

## 15. Brand voice relationship

Visual sophistication must not cause copy to overclaim.

Continue to follow the frozen brand-language constraints:
- neutral technical verbs for system behavior;
- no guaranteed results;
- no unsupported “institutional-grade” claim;
- no fake capability/readiness claims;
- no implication that automation equals permission.

Visual “institutional” character is an aesthetic direction. It is not evidence of institutional certification, regulatory status or product performance.

---

## 16. Production asset package

Before calling the logo system final, produce and retain:

### Wordmark masters
- `zugrio-wordmark-master.svg`
- `zugrio-wordmark-flat-white.svg`
- `zugrio-wordmark-flat-silver.svg`
- `zugrio-wordmark-black.svg`
- `zugrio-wordmark-metallic.svg` or reproducible material spec
- optimized small-size wordmark

### Secondary mark
- monogram master SVG;
- flat light/dark variants;
- favicon SVG/PNG/ICO;
- app icon masters at required platform sizes.

### Motion
- web implementation;
- motion timing spec;
- reduced-motion behavior;
- optionally MP4/WebM reference render for handoff.

### Brand motif
- ridge/horizon master image or vector/3D source;
- wide desktop crop;
- mobile crop;
- high-resolution presentation crop;
- usage notes.

Do not treat AI-generated brand-board raster images as production logo masters. They are visual-direction references until reconstructed as clean, controlled assets.

---

## 17. Handoff standard

A future brand designer should be able to answer from this system:

1. What is the primary mark?
2. What is secondary?
3. What colors/materials define Zugrio?
4. When is metallic allowed?
5. How does the logo move?
6. How should motion reduce?
7. How much space does the logo need?
8. What typography belongs to product vs wordmark?
9. What does the ridge motif mean and where can it appear?
10. What must never be changed casually?

If any of those answers depend on chat history, the brand system is not yet sufficiently operationalized.

---

## 18. Current implementation decision

For the current landing-page brand integration pass:

- adopt the monochrome/graphite/silver direction;
- use the `ZUGRIO` wordmark as primary identity;
- remove the boxed `Z` from primary website identity;
- use metallic silver for high-value brand moments;
- use flat silver/white for ordinary UI;
- use one controlled page-entry sweep;
- retain one lower interactive wordmark reveal;
- integrate the ridge/horizon motif as atmosphere, not wallpaper;
- preserve the existing product-information hierarchy and Cloudflare waitlist behavior.

This is the visual system to implement while the final vector wordmark master is being optically completed.
