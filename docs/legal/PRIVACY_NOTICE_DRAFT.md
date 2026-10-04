# Privacy Notice — DRAFT FOR COUNSEL REVIEW

Status: **draft, not published, not legal advice.** Every `[BRACKETED]` field is an input only the founder or counsel can supply. Do not publish or link from the site until all are resolved and counsel has approved it against the Nigeria Data Protection Act 2023.

## What this covers

The Zugrio early-access waitlist at zugrio.xyz.

## Facts taken from the repository (verify before publishing)

- Collected: email, trader profile fields from `Waitlist.jsx` (role, market, horizon, mode and related fields), consent flag, UTM/referrer. Confirm the exact field list against the form at publication time.
- Purposes (as in the form's current note): manage early access, understand product demand, send updates the person consents to.
- Retention: waitlist records scheduled for deletion after 12 months unless withdrawn earlier.
- Contact for access, correction, deletion: privacy@zugrio.xyz (set via Cloudflare environment variable `PRIVACY_CONTACT`).
- Storage and processors: Cloudflare (Pages, D1, Turnstile) and Brevo (contact sync, `workers/brevo-lifecycle` and `zugrio-brevo-sync`). Both are outside Nigeria.
- Joining does not create a trading account, connect a broker or authorise trading.

## Inputs needed

1. `[LEGAL ENTITY NAME, REGISTRATION NUMBER, REGISTERED ADDRESS]` — data controller. If not yet incorporated, counsel to advise who the controller is.
2. `[CONFIRMED PRIVACY CONTACT / DPO]`
3. `[LAWFUL BASIS]` — consent is the current implementation; counsel to confirm.
4. `[CROSS-BORDER TRANSFER BASIS]` for Cloudflare and Brevo.
5. `[COMPLAINT ROUTE]` — including the Nigeria Data Protection Commission.
6. `[EFFECTIVE DATE]`

## Draft body

**Who we are.** [LEGAL ENTITY NAME] ("Zugrio") is the controller of the personal data described here.

**What we collect.** The email address and trader-profile answers you submit on the early-access form, your consent, and basic campaign source information.

**Why.** To manage early access, understand demand for the product and send you the updates you agreed to receive. Joining does not create a trading account or authorise trading, and we do not ask for payment, passwords or broker credentials.

**Who processes it.** Our service providers Cloudflare (hosting, database, bot protection) and Brevo (email) process it on our behalf, and they operate outside Nigeria. [CROSS-BORDER TRANSFER BASIS]

**How long.** Up to 12 months, unless you withdraw earlier.

**Your rights.** You can ask to access, correct or delete your data, or withdraw consent, at privacy@zugrio.xyz. You can also complain to [COMPLAINT ROUTE].
