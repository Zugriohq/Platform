# Gated download for the validation alpha — owner setup

Release 1 track D (`docs/release/RELEASE_1_BLOCKERS.md`). This is an interim invite gate: only emails on the list can download. It is **not** the Release 1 sign-up system. What it serves is the **Private Validation Alpha** (local replay, fixtures, NO LIVE CAPITAL, unsigned), never called Release 1.

Everything below is in the Cloudflare dashboard (dash.cloudflare.com), signed in as the zugrio.xyz account. It takes about 15–20 minutes. Cloudflare may ask for a payment card to switch on R2 and Zero Trust. The usage here sits inside their free allowances (R2 free storage; Access free for up to 50 users), but check the pricing page shown at sign-up before confirming.

## 1. Get the alpha file from GitHub

1. Open https://github.com/Zugriohq/Platform/actions/runs/36634859158 (the "Private alpha build" of commit 52db5b4; all checks passed).
2. Under **Artifacts**, download `zugrio-private-alpha-windows` and unzip it. You get `Zugrio-Private-Alpha-0.1.0-alpha.2.exe` (about 75 MB).
3. On Windows, record its fingerprint: open PowerShell in that folder and run
   `certutil -hashfile Zugrio-Private-Alpha-0.1.0-alpha.2.exe SHA256`.
   Copy the long hex line into the chat so it can be published next to the download.

## 2. Storage (R2)

1. Left menu → **R2 Object Storage** → enable R2 (accept the plan).
2. **Create bucket** → name `zugrio-downloads` → location Automatic → Create.
   (Once R2 is on, Claude can do this step instead.)
3. Open the bucket → **Upload** → drag in the `.exe`.
4. Bucket **Settings** → **Custom Domains** → **Connect Domain** → `download.zugrio.xyz` → confirm the DNS record it proposes.
   Leave **Public Development URL (r2.dev)** **disabled**. It would bypass the gate.

## 3. The gate (Zero Trust Access)

1. Left menu → **Zero Trust**. On first visit, choose a team name (for example `zugrio`) and the **Free** plan.
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name `Zugrio downloads`. Domain: `download.zugrio.xyz`, path empty. Session duration 24 hours.
4. Login method: **One-time PIN**, which is on by default. Testers get a 6-digit code by email; no password.
5. Add a policy: name `Invited testers`, Action **Allow**, Include → **Emails** → add each invited email (start with your own).
6. Save.

## 4. Check it (Claude verifies with you)

- In a private browser window, open `https://download.zugrio.xyz/Zugrio-Private-Alpha-0.1.0-alpha.2.exe`.
  - You should see the Cloudflare login page, not the file.
  - With your listed email and the emailed PIN, the download should start.
  - With an unlisted email, no PIN should arrive and there should be no access.
- From outside Access, Claude checks that the URL returns the login redirect and never the file.

## Inviting someone later

Zero Trust → Access → Applications → Zugrio downloads → Policies → Invited testers → add their email. Send them the link and the SHA-256 from step 1. Remove an email to revoke access.

## Rollback

Delete the Access application and disconnect the custom domain. The file is then unreachable.
