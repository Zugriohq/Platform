# Landing Page Migration — HTML to Next.js/React

The existing Work-produced Zugrio landing page is the **migration-equivalence baseline**, not disposable prototype work and not an approved permanent brand identity.

## Migration principle

Do not redesign while changing framework.

Sequence:
1. freeze current HTML and hash;
2. establish visual regression screenshots;
3. extract **temporary migration tokens** from the current implementation;
4. migrate static/server-renderable sections;
5. isolate interactive client components;
6. verify responsive, accessibility and behavioral equivalence;
7. cut over only after comparison passes;
8. only then replace temporary migration tokens with a separately approved canonical brand system.

Current colors, typography, logo treatment and taglines must not become permanent `packages/ui` brand tokens merely because they were present in the HTML being migrated.

## Target architecture

`apps/web` owns both public marketing and authenticated web surfaces.

Marketing content should default to static/server rendering. Client components should be limited to real interactive islands such as:
- decision preview;
- risk-budget demo;
- waitlist form;
- mobile navigation;
- dialogs;
- motion controls.

## Product-scope corrections before public cutover

The landing page must remain consistent with `docs/product/PRODUCT_DIRECTION.md`.

Specifically:

- public positioning may lead with **forex**, but initial Zugrio 1.0 product scope also carries **gold and synthetic indices in parallel**;
- cTrader and MT5 are initial execution endpoints, while future broker/venue support remains adapter-based;
- entry examples such as retests, shallow pullbacks or breakouts must never be presented as an exhaustive entry taxonomy;
- public copy should refer to configurable/strategy-aware entry conditions unless a specific implemented entry model is being demonstrated;
- context means more than news: scheduled macroeconomic events, session state and other properly sourced context may also be relevant;
- no unsupported performance, profitability or automation-availability claim may be introduced during migration.

## Positive and negative demonstrations

The page should not depict Zugrio mainly as a system that blocks trades.

Demonstrations should eventually show both:
- a qualifying opportunity progressing as evidence remains valid; and
- a setup being held, invalidated or blocked when evidence/economics/risk no longer qualify.

The public product story is **opportunity + judgment + disciplined action**, while internal execution still fails closed when required evidence or authority is missing.
