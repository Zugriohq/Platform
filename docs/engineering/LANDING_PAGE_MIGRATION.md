# Landing Page Migration — HTML to Next.js/React

The existing Work-produced Zugrio landing page is the **visual/content baseline**, not disposable prototype work.

## Migration principle

Do not redesign while changing framework.

Sequence:
1. freeze current HTML and hash;
2. establish visual regression screenshots;
3. extract design tokens;
4. migrate static/server-renderable sections;
5. isolate interactive client components;
6. verify responsive, accessibility and behavioral equivalence;
7. cut over only after comparison passes.

## Target architecture

`apps/web` owns both public marketing and authenticated web surfaces.

Marketing content should default to static/server rendering. Client components should be limited to real interactive islands such as:
- decision preview;
- risk-budget demo;
- waitlist form;
- mobile navigation;
- dialogs;
- motion controls.

## Content correction before public cutover

The current page's older “Deriv / cTrader initial integration path” wording must be reconciled with the current broker-neutral direction: cTrader and MT5 are initial execution endpoints, while future broker/venue support remains adapter-based.

Do not make unsupported performance or profitability claims during migration.
