# Zugrio Landing V4 Candidate

Purpose: public marketing + early-access candidate for Zugrio.

## Run locally

```bash
npm install
npm run dev
```

## Current direction

- brand thesis: **The chart is not the market.**
- market-aware trading intelligence for FX, Gold and Synthetic Indices
- one canonical ZUGRIO wordmark geometry
- full-screen metallic initialization sequence
- Market Topography atmosphere
- decision-first product preview
- Market -> Method -> Current conditions -> Mandate -> Decision history
- live decision annotation
- process / outcome separation
- Signals, Semi-Auto, Auto and Full Auto as different authority envelopes
- Cloudflare-backed early-access waitlist
- reduced-motion and mobile-specific behavior

## Brand source of truth

Repository master:

`/brand/v1.0.0/master/ZUGRIO_WORDMARK_MASTER.svg`

Website copy:

`/public/brand/zugrio-wordmark-master.svg`

Every flat, metallic, ghost and motion treatment derives from that geometry. Do not redraw the lettering, substitute a font, or regenerate it with AI.

## Truthfulness guardrails

- illustrative chart data only
- no live-signal implication
- no performance claim
- no claim that a product capability is released unless authoritative capability data says so
- no custody claim beyond the designed non-custodial architecture
- no automation authority beyond the user's configured mandate
- waitlist does not connect a broker or authorize trading

## Cloudflare

The waitlist API is implemented under `functions/api/` with D1 + Turnstile.

Production environment and live-form verification must be completed from the Cloudflare account before public launch. See `CLOUDFLARE_WAITLIST_SETUP.md`.

## Review gate

Do not merge or deploy to production without founder visual review and a final Cloudflare end-to-end test.
