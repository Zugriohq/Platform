# Zugrio Brevo Lifecycle Worker

> **2026-09-26 production template migration:** Brand OS v1 templates are active in Brevo and are the canonical sequence: EA00=10, EA01=13, EA02=14, EA03=15, EA04=16, EA05=17. The older IDs 1–6 remain inactive. Cloudflare Pages/Worker environment variables must be updated to the canonical IDs before automated delivery is considered production-ready. Duplicates 11–12 are non-canonical cleanup items.

Purpose: continue the early-access email sequence after the immediate signup welcome.

This Worker is intentionally separate from the landing-page request path so:
- a Brevo outage cannot block a signup;
- D1 remains the durable source of truth;
- the email sequence can be paused, inspected or replaced without changing the website;
- Zugrio is not dependent on a Brevo automation tier.

## Sequence

| Step | Template | Timing |
|---|---|---|
| EA00 | Welcome | immediately after a new D1 signup |
| EA01 | The chart is not the market | +1 day |
| EA02 | Method and discipline | +3 days total |
| EA03 | Market-specific intelligence | +6 days total |
| EA04 | Decision integrity | +10 days total |
| EA05 | How access will open | +14 days total |

EA00 is sent by the Pages Function after durable D1 insertion.
EA01-EA05 are sent by this hourly Worker when `email_next_at` becomes due.

## Free-plan guardrail

The connected Brevo account currently reports the Free plan with a 300-send allowance.

The Worker defaults to `BREVO_DAILY_SEND_CAP=250` so the lifecycle does not consume the entire daily allowance. This leaves headroom for immediate welcome messages and manual product updates.

Do not increase this beyond the provider/account allowance without explicitly revisiting the plan.

## Required Brevo templates

Current draft IDs:

- EA00 = 1
- EA01 = 2
- EA02 = 3
- EA03 = 4
- EA04 = 5
- EA05 = 6

The six templates were created inactive for review. Activate them in Brevo before enabling live delivery.

## Required configuration

Pages project secrets/vars for immediate welcome:

- `BREVO_API_KEY`
- `BREVO_LIST_ID`
- `BREVO_WELCOME_TEMPLATE_ID=1`
- `BREVO_SENDER_NAME=Zugrio`
- `BREVO_SENDER_EMAIL`
- `BREVO_REPLY_TO` (recommended)

Lifecycle Worker:

- same `BREVO_API_KEY`
- same D1 database bound as `DB`
- `BREVO_SENDER_EMAIL`
- `BREVO_REPLY_TO`
- `BREVO_TEMPLATE_EA01=2`
- `BREVO_TEMPLATE_EA02=3`
- `BREVO_TEMPLATE_EA03=4`
- `BREVO_TEMPLATE_EA04=5`
- `BREVO_TEMPLATE_EA05=6`

## Contact list

The Brevo account currently contains list ID 2 named `Your first list`.

Before production:
1. rename it to `Zugrio — Early Access`, or create a dedicated equivalent;
2. set `BREVO_LIST_ID` to that list ID.

D1 remains authoritative even if the Brevo contact sync fails.

## Sender

The only currently verified sender is the account's Gmail address.

For production brand quality and deliverability, create and authenticate a sender on the Zugrio domain (for example `hello@zugrio.xyz`) before launch. Keep the existing verified sender only for internal testing if needed.

## Unsubscribe behavior

Every template contains Brevo's unsubscribe link.

Before sending each lifecycle message, the Worker checks the Brevo contact state. If the email is blacklisted, the D1 record is marked `email_unsubscribed_at` and the sequence stops.

## Database

Apply:

`prototypes/landing-v3-react/migrations/0003_add_brevo_email_lifecycle.sql`

before enabling either the signup integration or this Worker.

## Failure policy

Email is best-effort.

A successful D1 signup must never be rolled back because Brevo is unavailable.

Provider errors are written to `email_last_error` and `email_send_log` for diagnosis.
