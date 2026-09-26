# Zugrio Email Design & Voice System v1.0

Status: **authoritative email expression layer**
Date: 2026-09-26
Parent: `docs/brand/ZUGRIO_BRAND_OPERATING_SYSTEM_V1.md`

---

## 1. Purpose

Zugrio email should feel like a direct extension of the product and website:
dark, exact, premium, selective and useful.

The goal is not "make newsletters look dark." The goal is to create a repeatable editorial system that survives Gmail, Outlook, mobile clients, image blocking and dark-mode transformations.

---

## 2. Email archetype

Email expression = **Disciplined Sage**.

The inbox relationship should feel:
- informed, not promotional;
- selective, not frequent;
- designed, not decorative;
- calm, not urgent;
- premium, not luxury;
- useful, not content-for-content's-sake.

Rule:
> We write when there is something worth saying.

---

## 3. Layout architecture

Target shell:
- 600 px desktop content width;
- full-width mobile;
- table-based layout;
- inline critical CSS;
- no JavaScript;
- no required webfonts;
- no animation dependency.

Core movements:

1. hidden preheader;
2. brand header;
3. visual/key-art field;
4. editorial headline;
5. concise body;
6. proof/next-step block;
7. CTA;
8. trust/status note;
9. unsubscribe / browser-view footer.

---

## 4. Palette

Outer field: `#050608`
Shell: `#0A0D11`
Raised field: `#11161C`
Structural line: `#2A323C`
Primary text: `#F3F5F7`
Secondary text: `#A5AEB8`
Quiet metadata: `#7D8792`
Silver highlight: `#C9D0D6`

Use chromatic color only for real semantic states. Welcome/editorial emails should remain neutral-led.

---

## 5. Signature email graphic

Use the **Decision Horizon** motif:
- one silver horizon/edge;
- sparse contour/topographic lines;
- controlled light;
- no particles/dots;
- no generic candlestick background.

For EA00 v1, the existing `zugrio-og-card.png` may be used as a temporary raster key visual because raster support is broader than SVG in email clients.

Production follow-up:
create a dedicated 1200×640 email key-art PNG derived from the Decision Horizon system.

---

## 6. Logo use

Preferred:
hosted PNG wordmark on transparent background.

Temporary:
a safe live-text "ZUGRIO" fallback may be used until a raster wordmark is hosted.

Do not depend on SVG logo support for email.

---

## 7. Typography

Live-text stack:
`Arial, Helvetica, sans-serif`

Use:
- 44–56 px desktop hero headlines;
- 34–42 px mobile hero headlines;
- 22–28 px section headings;
- 15–17 px body;
- 10–11 px metadata.

Avoid text smaller than 10 px for meaningful user-facing information.

---

## 8. CTA language

Prefer:
- Explore Zugrio
- See what's changing
- View the product
- Review the invitation
- See readiness
- Continue to Zugrio

Avoid:
- Act now
- Don't miss out
- Claim your spot
- Unlock profits
- Start winning

---

## 9. Subject-line system

Subjects should be:
- 35–55 characters when practical;
- proposition-led;
- specific;
- not clickbait;
- no emoji by default;
- no ALL CAPS.

Sequence:

EA00 — **You're on the list. Welcome to Zugrio.**
EA01 — **The chart is not the market.**
EA02 — **Your strategy should stay the standard.**
EA03 — **Same pattern. Different market. Different answer.**
EA04 — **The reason stays with the trade.**
EA05 — **How Zugrio will open access.**

---

## 10. EA00 role

EA00 must do only four things:
1. confirm signup;
2. introduce the Zugrio mental model;
3. explain what the subscriber should expect;
4. establish visual/voice quality.

It should not attempt to explain the whole product.

Primary line:
**You're on the list.**

Editorial thesis:
**The signal is only the beginning of the decision.**

CTA:
**Explore Zugrio**

Trust note:
Zugrio is in private validation. Joining the list does not grant trading access or authorize trading.

---

## 11. EA01–EA05 narrative

### EA01 — Category / thesis
Teach why "the chart is not the market."

### EA02 — Strategy / discipline
Show why the selected strategy remains the standard even when pressure changes.

Use "strategy," not "method," in public copy.

### EA03 — Market awareness
Show why similar charts across FX, Gold and Synthetic Indices can require different treatment.

### EA04 — Decision history
Explain why the original reason, changes and overrides stay attached to the case.

### EA05 — Readiness / access
Explain invite-only validation, released vs validation status, custody and control.

No email may imply that joining the list itself gives Zugrio permission to trade.

---

## 12. Personalization

Allowed:
- market;
- horizon;
- control preference;
- country when materially useful.

Do not pretend to know:
- emotional state;
- profitability;
- skill level;
- account size;
- motivations not explicitly collected.

---

## 13. Frequency

Onboarding:
EA00 immediate
EA01 +1 day
EA02 +3 days total
EA03 +6 days total
EA04 +10 days total
EA05 +14 days total

After onboarding:
1–2 meaningful Build Notes per month maximum by default.

No send exists merely because a calendar says so.

---

## 14. Deliverability and compatibility

Before public launch:
- authenticate a `zugrio.xyz` sender;
- SPF/DKIM/DMARC aligned;
- monitored reply-to;
- dedicated early-access list;
- unsubscribe link tested;
- Gmail desktop/mobile tested;
- Outlook tested;
- iOS Mail tested;
- image-blocked rendering checked;
- plain-text fallback checked.

D1 remains the source of truth for signup state and lifecycle history.

---

## 15. Approval checklist

Before activating any template:
- copy uses current public terminology;
- capability claims match readiness;
- CTA destination is live;
- sender is correct;
- reply-to is monitored;
- unsubscribe works;
- no unsupported performance claim;
- mobile rendering checked;
- dark-mode rendering checked;
- test email received.

