# Cloudflare waitlist setup — Zugrio Landing v3

This prototype now has a real Cloudflare Pages Functions contract:

- `GET /api/config`
- `POST /api/waitlist`
- D1 persistence
- server-side Turnstile validation
- email-first signup with consent + server-side Turnstile validation
- optional post-signup market segmentation
- duplicate-safe signup behavior

## 1. Cloudflare Pages build

Project root:
`prototypes/landing-v3-react`

Build command:
`npm run build`

Build output:
`dist`

Cloudflare Pages supports React/Vite deployments and Pages Functions. The `functions/` directory in this project becomes the same-origin API when deployed.

## 2. Create or select a D1 database

Create/select the database in Cloudflare and run `schema.sql` against it.

The Pages Function expects the D1 binding name:

`DB`

In Cloudflare:
Workers & Pages → your Pages project → Settings → Bindings → Add → D1 database.

Bind the selected database as `DB`, then redeploy.

## 3. Turnstile

Create a Turnstile widget in Cloudflare.

Configure these Pages variables/secrets:

- `TURNSTILE_SITE_KEY` — public widget site key
- `TURNSTILE_SECRET` — secret; server only
- `TURNSTILE_HOSTNAMES` — comma-separated production/preview hostnames you want to accept
- `WAITLIST_PROFILE_SECRET` — optional dedicated HMAC secret for short-lived post-signup preference tokens; when absent, the server falls back to `TURNSTILE_SECRET`
- `PRIVACY_CONTACT` — currently `privacy@zugrio.xyz`

Do not put `TURNSTILE_SECRET` in Vite variables or client code.

Turnstile is validated server-side through Siteverify. Client-side completion alone is not accepted.

## 4. Apply the database schema

If this is a brand-new D1 database, execute:

`schema.sql`

If the existing `zugrio-waitlist` database already contains the original `waitlist` table, **do not drop it**. Apply:

`migrations/0002_expand_waitlist_profile.sql`

That migration preserves prior rows and adds the new profile, attribution, consent-version and retention fields.

The table stores:
- normalized email
- optional role/profile fields retained for compatibility
- optional primary-market preference
- optional horizon/control/strategy/platform enrichment
- consent timestamp
- acquisition source/UTMs
- created/updated time
- scheduled 12-month expiry

It intentionally does not store the visitor IP.

## 5. Signup contract

Primary early-access signup is deliberately minimal.

Required:
- valid email;
- explicit consent;
- valid Turnstile token.

The previous trader-profile fields remain accepted by the API for backward compatibility, but they are optional and the current homepage does not require them before signup.

After a successful signup, the page may ask one optional segmentation question:

**What do you trade most?**
- FX
- Gold
- Synthetic Indices
- More than one

That preference is submitted to:

`POST /api/waitlist-segment`

using the short-lived profile token returned by the accepted signup response.

The preference endpoint returns the same accepted shape whether or not the email row exists, avoiding an account-enumeration signal.

## 6. Duplicate behavior

Email is unique.

A duplicate submission returns the same generic accepted response rather than revealing whether an email already exists. Existing records are not replaced by `INSERT OR IGNORE`.

## 7. Local UI vs full-stack testing

`npm run dev` runs the Vite UI only. The form will correctly report that the Cloudflare API is not connected.

For a full Cloudflare local session, install/use Wrangler and run a Pages dev session with the built `dist` output plus the D1 binding and local secrets. Cloudflare's current Pages command is based on:

`npx wrangler pages dev <ASSET_DIRECTORY>`

Do not commit `.dev.vars` or any real secrets.

## 8. Production checklist

Before publishing:
- D1 binding exists in production and preview as intended
- Turnstile widget hostnames are correct
- server-side Siteverify passes
- privacy contact is real
- retention cleanup process is scheduled
- test first-time signup
- test duplicate signup
- test expired Turnstile token
- test email-only signup
- test optional post-signup market segmentation
- test invalid/expired profile token
- test database unavailable state
- verify no secret appears in browser source/network responses

## 9. Optional next integrations

The database is the source of truth for waitlist collection.

A separate permitted worker/process can later:
- send a welcome email
- sync opted-in contacts to Brevo/another provider
- generate waitlist analytics
- process deletion/withdrawal requests

Do not make successful D1 storage depend on a marketing-email provider being available.


## Existing Zugrio Cloudflare choices carried forward

The React migration should preserve the Cloudflare work already started:

- canonical domain: `https://zugrio.xyz`
- `www.zugrio.xyz` redirects to the canonical host
- D1 database: `zugrio-waitlist`
- D1 binding variable: `DB`
- Turnstile widget: `Zugrio Waitlist`
- Turnstile mode: Managed
- Turnstile hostnames: `zugrio.xyz` and optionally `www.zugrio.xyz`
- environment names: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`
- privacy contact: `privacy@zugrio.xyz`
- API routes remain `/api/config` and `/api/waitlist`

The React page should replace the old HTML front end without changing these backend names unnecessarily.


## 10. Brevo email lifecycle

Zugrio now supports a provider-independent email lifecycle.

Apply migration:

`migrations/0003_add_brevo_email_lifecycle.sql`

D1 remains the source of truth. Brevo is a best-effort delivery provider: a Brevo outage must not make a valid waitlist signup fail.

### Pages project secrets / variables

Configure:

- `BREVO_API_KEY` — secret
- `BREVO_LIST_ID` — dedicated early-access list
- `BREVO_WELCOME_TEMPLATE_ID=1`
- `BREVO_SENDER_NAME=Zugrio`
- `BREVO_SENDER_EMAIL`
- `BREVO_REPLY_TO`

The signup handler will:
1. store the signup in D1;
2. add a newly inserted contact to Brevo;
3. send EA00 welcome;
4. record sync/send state in D1.

### Follow-up Worker

See:

`workers/brevo-lifecycle/`

This hourly cron worker sends the due EA01-EA05 sequence from D1 while enforcing a conservative free-plan daily send cap.

Before enabling it:
- activate the reviewed templates in Brevo;
- bind the same D1 database;
- add the required Brevo secrets;
- replace the D1 database ID in the Wrangler config;
- deploy and verify `/health`;
- perform a controlled test signup.

### Current Brevo draft template IDs

- EA00 = 1
- EA01 = 2
- EA02 = 3
- EA03 = 4
- EA04 = 5
- EA05 = 6
- Build Note = 7
- Early-access invitation = 8

All templates were intentionally created inactive pending visual/content review and branded-domain sender setup.
