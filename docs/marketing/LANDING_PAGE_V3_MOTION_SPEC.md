# Zugrio Landing Page v3 — React / Motion Specification

Status: prototype direction.  
Purpose: define the landing-page interaction model before visual polish and final brand-color selection.

## 1. Technology direction

Target production path:
- Next.js / React
- server/static-rendered marketing content by default
- Motion or native CSS/IntersectionObserver for animation
- client islands only where interaction requires them
- waitlist form posts to the existing/next server endpoint
- no client-only rendering of essential copy
- reduced-motion support
- SEO-visible content before hydration

Prototype may use plain React or standalone HTML first, but production should move into the canonical web app.

## 2. Motion philosophy

Motion must clarify:
- continuity;
- changing evidence;
- spatial relationship;
- hierarchy;
- transition from market evidence to decision.

Motion must not:
- hijack scrolling;
- create artificial urgency;
- simulate live market activity;
- hide content until JavaScript arrives;
- make product screenshots look like live trading;
- consume multiple viewport heights for a trivial effect.

## 3. Hero transition

Recommended pattern:
> **Scroll-media expansion / calm container expansion**

Initial state:
- master headline and copy dominate;
- product frame sits below/behind the hero at a controlled width;
- no 3D gimmick required.

As the user makes the first meaningful scroll:
- product frame expands toward a near-full-width product canvas;
- headline recedes naturally;
- the frame becomes the bridge into “The chart is where a trade starts…”

This turns the hero into the transition into the product rather than a static block.

Implementation notes:
- transform/scale/translate only;
- no scroll-jacking library;
- clamp progress;
- flatten completely under reduced motion;
- mobile should use a simple reveal rather than a long scrub.

## 4. Text reveals

Use one-time reveal for:
- hero kicker;
- master headline;
- section headings;
- short proof lines.

Rules:
- content exists in HTML;
- animate opacity/transform only;
- do not re-hide when scrolling upward;
- no typewriter for the master headline;
- avoid character-by-character animation on long body copy.

## 5. Core narrative section

Recommended pattern:
> **Sticky story / controlled scroll reveal**

Desktop:
- left or center column holds the selected product frame / Decision Case;
- adjacent narrative changes through:
  1. Market
  2. Method
  3. Current conditions
  4. Authority
  5. Decision history
- the product frame updates the relevant area rather than replacing the entire screenshot.

Important:
- pin for the shortest duration that still clarifies the story;
- do not spend 4–5 viewport heights per point;
- no visual progress bar implying inevitable execution;
- each step remains accessible by keyboard and static content order.

Mobile:
- no long pin;
- stack section cards with individual product snapshots/reveals.

## 6. “Same pattern. Different market.” interaction

Possible treatment:
- one central simplified price movement;
- FX / Gold / Synthetic tabs or scroll states;
- surrounding context changes while the superficial visual pattern remains similar;
- text explains why model scope differs.

Do not imply the same actual historical pattern occurred simultaneously.

Use labelled illustrative examples.

## 7. “If the facts change” interaction

Recommended:
- original decision geometry remains visually fixed/faded;
- current-price marker moves to an illustrative later state;
- changed rows appear in a compact delta panel;
- entry economics text updates;
- state changes from:
  - current entry qualifies
  - to current entry no longer qualifies

The positive and negative states should both be available.

Do not animate profit/loss celebration.

## 8. Mandate Boundary interaction

Use a visually distinct boundary between:
- evidence/intelligence above;
- permission/execution below.

When control mode changes in the prototype:
- explanatory copy updates;
- allowed action region changes;
- no capital action is actually submitted.

Suggested prototype switch:
- Signal
- Semi-Auto
- Auto
- Full Auto · Locked

Avoid a casual toggle metaphor for increasing authority.

## 9. Decision History interaction

Use:
- structured event sequence;
- selective event reveal;
- expandable exact detail;
- no decorative animated line that implies progress toward success.

Illustrative override card:
SYSTEM → PASS
USER → OVERRIDE
OUTCOME → PROFIT
PROCESS → METHOD VIOLATION

Animate the reveal of facts, not the outcome as a “win.”

## 10. Product screenshot/gallery treatment

Until the final Work layout is selected:
- use existing prototype screenshots only as labelled product-direction imagery;
- avoid presenting any one experimental layout as “the product”;
- consider an image stack or gentle parallax gallery lower on the page for:
  - Workspace
  - Decision Case
  - Semi-Auto
  - Mobile
  - Journal

Do not use 12 screenshots in the hero merely because a parallax component expects them.

## 11. Readiness board

Motion:
- normal section reveal;
- optional row filter interaction;
- timestamp/source appears on inspect/expand.

No blinking live dots.

States:
- Released
- Early access
- Validation pending
- Research only
- Locked
- Suspended

Exact content must remain illustrative until backed by capability data.

## 12. Waitlist behavior

Form principles:
- email first;
- optional preferences behind disclosure;
- clear submission state;
- preserve entered email on failure;
- server-confirmed success only;
- bot protection where deployed;
- accessible status message.

States:
- checking availability
- ready
- submitting
- success
- retryable error
- temporarily unavailable

No fake waitlist count, countdown or artificial scarcity.

## 13. Candidate component patterns to evaluate from 21st.dev

Research candidates:
- Scroll media expansion hero
- Smooth Scroll Hero
- Scroll Morph Hero
- Container Scroll Animation
- Sticky Scroll Reveal
- Story Scroll
- Text Reveal
- Hero Parallax only for lower-page screenshot storytelling if enough consistent product imagery exists

Take the mechanism, not the component styling.

Avoid:
- heavy shader/WebGL hero until performance/brand need is proven;
- Lenis/smooth-scroll replacement by default;
- long scroll pinning;
- typewriter headline;
- animated gradient as the entire brand identity.

## 14. Performance

Targets:
- essential page readable before animation JavaScript;
- avoid layout shift;
- images responsive and properly sized;
- no animation on top/left/background-position when transform can do the job;
- defer noncritical screenshot motion;
- lazy-load below-fold product imagery;
- maintain 60fps target on normal modern phones/laptops;
- preserve native scrolling.

## 15. Accessibility

Required:
- prefers-reduced-motion path;
- keyboard-operable interactive previews;
- no content reachable only by hover;
- semantic headings;
- focus visibility;
- static equivalent for every scroll-driven story;
- no color-only status meaning;
- animated product state also announced textually where interactive.

## 16. First prototype sequence

1. Header / nav
2. Hero
3. scroll expansion into product frame
4. bridge
5. Market
6. Method
7. Current conditions
8. Authority
9. Decision history
10. positive progression
11. readiness
12. markets / integrations
13. FAQ
14. waitlist
15. footer

This first prototype is for copy + interaction hierarchy testing, not final visual identity.

## 17. Brand-color handling

Brand color remains open.

For the first functional prototype:
- use neutral near-black surfaces;
- white/gray typography;
- one temporary neutral highlight or CSS variable;
- keep semantic status colors separate;
- make accent swappable from a single token.

Do not reintroduce the rejected violet/periwinkle direction by default.
