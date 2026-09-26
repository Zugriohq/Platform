# Zugrio Email Lifecycle V1

Status: implementation candidate for early-access marketing and onboarding  
Provider: Brevo Free plan  
System of record: Zugrio D1 database  
Provider role: contact delivery, suppression and campaign tooling

## 1. Operating principle

Email must support the product relationship without becoming a dependency.

D1 remains the authoritative record of:
- signup identity;
- consent;
- acquisition source;
- trader profile;
- lifecycle step;
- send state;
- provider errors;
- unsubscribe state.

Brevo may be replaced later without losing the audience or lifecycle state.

## 2. Free-plan operating envelope

The connected Brevo account is currently on the Free plan.

Current public Brevo limits:
- 300 email sends per day;
- up to 100,000 stored contacts;
- transactional email;
- email campaigns;
- templates;
- basic analytics;
- marketing automation for a limited number of contacts.

Zugrio deliberately caps automated lifecycle sends at 250/day to preserve headroom for immediate welcomes and occasional founder/product updates.

## 3. Signup path

1. Visitor completes the Zugrio early-access form.
2. Cloudflare validates Turnstile.
3. Signup is committed to D1.
4. The visitor receives the normal success state immediately.
5. Only after durable D1 insertion does Zugrio attempt Brevo sync.
6. New contact is added to the configured Brevo list.
7. Welcome template EA00 is sent.
8. D1 records the Brevo sync and welcome state.
9. If Brevo fails, signup remains successful and the provider error is recorded.

Brevo availability must never determine whether a valid signup is accepted.

## 4. Early-access onboarding sequence

| Code | Timing | Purpose | Subject |
| --- | --- | --- | --- |
| EA00 | immediate | welcome / category introduction | You're inside the Zugrio private build |
| EA01 | +1 day | core thesis | The chart is not the market. |
| EA02 | +3 days total | method + discipline | Your rules shouldn't change because your mood did. |
| EA03 | +6 days total | market specialization | Same pattern. Different market. Different answer. |
| EA04 | +10 days total | decision integrity | The reason stays with the trade. |
| EA05 | +14 days total | readiness + access | How Zugrio will open access |

These are educational/product emails, not performance marketing.

## 5. Ongoing relationship after onboarding

### Build Notes
Cadence: approximately 1-2 per month when there is something material to report.

Content:
- product changes;
- validation findings;
- new market/broker/control readiness;
- UI/workflow improvements;
- research decisions;
- what remains unavailable.

Rule: no email exists merely to satisfy a calendar.

Brevo draft template:
- ID 7 — Zugrio NEWS — Build Note

### Validation invitations
Event-driven only.

Send when a real capability has a defined cohort and is ready for human validation.

Every invite must state:
- market;
- platform;
- control mode;
- eligibility;
- limitations;
- feedback expectations;
- whether execution is simulated, shadow, sandbox or live.

Brevo draft template:
- ID 8 — Zugrio INVITE — Early access cohort

### Product announcements
Use Build Notes until public launch.
Do not create a second high-volume promotional stream during private validation.

## 6. Segmentation

D1 should remain the canonical segmentation source.

Useful dimensions already captured:
- role;
- primary market;
- trading horizon;
- preferred control;
- method/strategy interest;
- preferred Zugrio access;
- country/region;
- acquisition source.

Initial useful cohorts:
- FX traders;
- Gold traders;
- Synthetic Indices traders;
- Signal-first users;
- Semi-Auto / Auto interest;
- desktop-first vs mobile-first;
- researcher / builder / partner cohorts.

Do not over-segment until the list is large enough for the distinction to matter.

## 7. Sender identity

Current verified Brevo sender:
- Zugrio via the account Gmail address.

Production target:
- a branded Zugrio sender on `zugrio.xyz`, e.g. `hello@zugrio.xyz`.

Before launch:
- authenticate the domain;
- configure SPF/DKIM/DMARC as Brevo requires;
- verify the sender;
- set a monitored reply-to address.

The Gmail sender is acceptable for internal testing but not the desired public identity.

## 8. Contact list

Current Brevo list:
- ID 2 — `Your first list`

Before production:
- rename it to `Zugrio — Early Access` or create an equivalent dedicated list;
- configure `BREVO_LIST_ID` accordingly.

## 9. Templates created in Brevo

Inactive review drafts:

1. EA00 — Welcome to the private build
2. EA01 — The chart is not the market
3. EA02 — Method and discipline
4. EA03 — Market-specific intelligence
5. EA04 — Decision integrity
6. EA05 — How access will open
7. NEWS — Build Note
8. INVITE — Early access cohort

Do not activate the onboarding sequence until sender/domain, API key, list, migration and end-to-end test are complete.

## 10. Consent and unsubscribe

Marketing consent is captured on signup.

Every marketing/onboarding template contains Brevo's unsubscribe link.

The lifecycle worker checks Brevo's contact suppression state before each scheduled send. If the contact is email-blacklisted, Zugrio stops the sequence and records `email_unsubscribed_at` in D1.

A future preference center may offer:
- product/build notes;
- research/education;
- early-access invitations;
- critical account/service messages.

Do not mix transactional account/service messages with optional marketing preferences.

## 11. Measurement

For private validation, prioritize:
- delivery rate;
- bounce rate;
- unsubscribe rate;
- click-through to product preview;
- cohort invitation acceptance;
- reply quality;
- conversion from waitlist to active tester.

Open rate should not be treated as a precise behavioral truth because mailbox privacy features can distort it.

No trading-performance metric belongs in the email marketing funnel.

## 12. Architecture

### Immediate path
`Landing form -> Turnstile -> D1 -> best-effort Brevo contact sync -> EA00`

### Scheduled path
`Cloudflare Cron Worker -> D1 due queue -> Brevo suppression check -> EA01-EA05 -> send log`

### Manual/editorial path
`D1/Brevo cohort -> reviewed Build Note or Invite -> Brevo campaign`

This preserves provider independence and human operability.
