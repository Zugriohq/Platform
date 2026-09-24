# Zugrio waitlist → Brevo contact sync

Copies consenting, unexpired early-access signups from the existing `zugrio-waitlist` D1 database into Brevo list 2 every five minutes. The existing Pages signup flow stays authoritative. This contact-only bridge makes no email-send requests and does not enable the draft EA00–EA05 sequence.

The production Pages project is `zugrio`, built from `Zugriohq/Platform` branch `chore/engineering-foundation`, under `prototypes/landing-v3-react`. This bridge was prepared against commit `b1fd8b5ba8ac16f6f7c35770c2c671526c71e962`. The older downloaded v7 website is not the deployed source.

## Deployment

1. Apply `migration.sql` to the existing database. It adds only the bridge state table; it does not modify or delete subscriber records.
2. Deploy this directory using Wrangler. Keep `BREVO_LIST_ID=2` unless the intended destination changes.
3. In Worker **zugrio-brevo-sync → Settings → Variables and Secrets**, add `BREVO_API_KEY` with type **Secret**. Obtain a dedicated v3 API key from Brevo's SMTP & API settings. Do not use an SMTP key or place credentials in Git/chat.
4. Wait for the next five-minute run. `/health` reports configuration presence only; verify actual transfer by checking the state table and destination list.

Before the secret exists, the Worker is inert. Deploying it does not send emails. The existing eight Brevo templates remain under their current activation settings.

## Behavior and limits

- Backfills existing records and picks up new records with `consent=1`, a consent timestamp, a non-legacy consent version, and a future expiration timestamp. Legacy rows need consent review before any import.
- Processes at most ten contacts per invocation. Existing Brevo list membership counts as success.
- Preserves global email suppression and list-level unsubscribe state. Never sends `emailBlacklisted: false`.
- Retries with exponential backoff, starting at five minutes and capped at one day. Authentication/rate-limit failures stop the current batch.
- D1 leases prevent concurrent invocations claiming the same record. A crashed run can be retried after 90 seconds; contact upserts are idempotent.
- Logs aggregate counts and fixed error codes, not emails, keys, or provider response bodies.
- Only email addresses are copied. Trader profile, acquisition source and consent evidence stay in D1, consistent with the existing lifecycle design. Brevo attribute mapping can be added separately for campaign segmentation.
- This is a one-way import. It does not mirror profile edits, deletion, subsequent expiry or consent withdrawals after a successful sync. Privacy operators must suppress/delete contacts in Brevo as well as D1. A Brevo unsubscribe remains authoritative; this Worker never automatically resubscribes a synced/suppressed row.
- Do not enable Pages' older immediate welcome code or the lifecycle sender merely by copying these settings. Those need the separate lifecycle migration, sender verification, template review, and end-to-end sending checks described in the repository.

## Verification and rollback

Run `npm test` with Node 24 (SQLite is used for real SQL tests). Tests cover persistence, retries, consent, expiry, unsubscribe, duplicate delivery, concurrency, and secret-free health output using mocked Brevo calls.

Inspect counts using `SELECT status, count(*) FROM brevo_contact_sync GROUP BY status;` and errors using `SELECT last_error, count(*) FROM brevo_contact_sync WHERE status='pending' GROUP BY last_error;`. These do not expose subscriber addresses.

To pause, remove the cron trigger or the `BREVO_API_KEY` secret. The landing page and existing database continue accepting signups. Keep the state table so resuming does not reimport contacts. No capital-path or broker-authority code is affected.
