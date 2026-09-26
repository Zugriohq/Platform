# Zugrio Brand Asset Source-of-Truth Standard

Status: mandatory production handoff rule.

## Purpose

Zugrio brand assets must remain fully human-reviewable, editable, transferable and maintainable without dependence on any AI model, chat history, image-generation session or proprietary prompt.

## Canonical source hierarchy

1. **Editable vector master** — Adobe Illustrator `.ai` when available, plus an equivalent path-only `.svg`.
2. **PDF vector proof** — for universal visual review and sign-off.
3. **Figma review mirror** — optional, imported from the canonical SVG for collaborative inspection and application mockups.
4. **Derived exports** — PNG, WebP, ICO, app icons, social avatars, motion masks.
5. **Rendered references** — metallic/3D examples and campaign key art.
6. **AI-generated images / chats** — reference only, never canonical source.

## One-geometry rule

ZUGRIO has one approved wordmark geometry.

No downstream application may:
- redraw individual letters;
- substitute a font;
- change corner radii;
- change the G incision;
- change the R leg;
- change the O contour;
- change the Z diagonal;
- alter kerning independently;
- use an AI regeneration as a replacement master.

Every flat, metallic, embossed, animated, white, black, silver and ghost treatment must derive from the same vector geometry.

## Required human-editable master package

The signed-off master package must include:

- `ZUGRIO_WORDMARK_MASTER.ai`
- `ZUGRIO_WORDMARK_MASTER.svg`
- `ZUGRIO_WORDMARK_OUTLINES.pdf`
- `ZUGRIO_MONOGRAM_MASTER.ai`
- `ZUGRIO_MONOGRAM_MASTER.svg`
- geometry/construction sheet with dimensions, angles, radii and spacing
- clear-space and minimum-size sheet
- finish/material specification
- motion/sweep specification
- export manifest
- version/changelog file

All SVG masters must use vector paths rather than live fonts.

## Tooling

Preferred authoring environment: **Adobe Illustrator**.

Reason:
- exact Bézier/path editing;
- measurable corner radii, angles and spacing;
- reliable outline construction;
- production SVG/PDF exports;
- widely reviewable by professional identity designers.

Figma may be used as a collaborative review/application surface, but must not silently become a divergent master.

## Versioning

Canonical assets live in Git and use explicit versions:

- `brand/v1.0.0/master/`
- `brand/v1.0.0/exports/`
- `brand/v1.0.0/motion/`
- `brand/v1.0.0/spec/`

Any geometry change increments the brand version and requires:
1. founder/design sign-off;
2. master update;
3. regeneration of every derived asset;
4. visual regression check;
5. website/product asset update.

## AI use rule

AI may:
- research;
- propose geometry;
- generate construction alternatives;
- automate exports;
- create material/motion treatments;
- test applications;
- produce handoff documentation.

AI may not be the only place where the approved identity exists.

If the asset cannot be opened, inspected and edited by a competent human designer without ChatGPT, it is not production-ready.

## Handoff test

A new brand designer with no access to prior chats must be able to:
- open the master;
- identify every letter path;
- measure the geometry;
- edit the logo;
- regenerate all finishes;
- reproduce the sweep motion;
- export the website/app assets;
- understand what is canonical and what is merely reference.

If that is not possible, the handoff has failed.
