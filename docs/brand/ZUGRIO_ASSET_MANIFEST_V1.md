# Zugrio Brand Asset Manifest v1

Status: implementation asset manifest.

## One-logo rule

Zugrio has **one canonical wordmark geometry**.

Metallic, flat silver, flat white and black files are **finish/output treatments of the same mark**, not alternate logo designs.

Do not:
- redraw the wordmark;
- retype it in a font;
- substitute a different ZUGRIO letterform;
- stretch or condense it;
- alter individual letter geometry per application.

## Canonical production assets

Landing-site source assets live in:

`prototypes/landing-v3-react/public/brand/`

- `zugrio-wordmark-master.svg` — canonical geometry/mask source.
- `zugrio-wordmark-metallic.svg` — signature metallic finish using the canonical geometry.
- `zugrio-wordmark-flat-silver.svg` — ordinary brand use on dark surfaces.
- `zugrio-wordmark-flat-white.svg` — high-contrast/utility use.
- `zugrio-wordmark-black.svg` — light-background/production utility use.
- `zugrio-monogram-silver.svg` — secondary Z-only mark derived from the same Z geometry.
- `favicon.svg` — small-size favicon using the secondary Z geometry.
- `zugrio-ridge-horizon.svg` — deterministic vector ridge/horizon brand motif.

## Landing-page usage

- Header: flat silver canonical wordmark.
- Hero brand lockup: signature metallic canonical wordmark.
- Opening reveal: signature metallic canonical wordmark with one controlled sweep.
- Product shell: small flat silver canonical wordmark.
- Lower interactive reveal: the same canonical wordmark, revealed by light/material interaction.
- Footer: flat silver canonical wordmark.
- Favicon: secondary Z only.

The boxed Z must not be used as the primary website identity.

## Motion consistency

The moving silver sweep is a treatment applied **over the master wordmark mask**. It must never be recreated with a different text/font layer.

The lower cursor reveal also uses the canonical wordmark asset. This prevents letter-shape drift between static and animated brand moments.

## Raster exports

PNG and ICO deliverables must be generated from the canonical SVG assets. Raster files are delivery formats, not independent logo masters.

Recommended raster widths:
- wordmark: 512 / 1024 / 2048 px;
- icon: 16 / 32 / 48 / 64 / 128 / 256 / 512 px.

## Change-control rule

If the wordmark geometry is ever optically refined:
1. update `zugrio-wordmark-master.svg` first;
2. regenerate every derived finish/export from that master;
3. update the web mask/component from the same master;
4. never modify a downstream PNG or one finish independently.

This is the mechanism that preserves one Zugrio identity across website, product, presentations, social, favicon and future native apps.
