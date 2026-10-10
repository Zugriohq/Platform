# Release 1 — blockers and critical path

Status: **working tracker, not a gate record.** Last updated 2026-10-07.

Release 1 is defined by `docs/product/V1_BUILD_CUT_AND_ARCHITECTURE_FREEZE.md`, which governs build and ship scope. This file lists what stands between the repository today and that definition, and in what order the work can run. It changes no frozen decision, gate status or threshold.

## What Release 1 requires (from the build cut)

1. **Admitted Core Signal scopes.** It needs at least one each in FX, Gold and one Synthetic Index family/instrument (§2, launch criterion). Each needs one frozen TradeBundle per scope (§3).
2. **Control modes: Signal.** Semi-Auto may ship as *validation-pending*. It counts as released only once at least one cTrader scope clears its own gates (§2, §4, §9.1). **Semi-Auto is therefore not a ship blocker.**
3. **Windows desktop client** as the primary *authenticated* workspace (§9.2).
4. **Web** for the public site, waitlist/invitation, account/authentication, entitlement/readiness status and desktop download/access (§9.2).
5. **Invite-only early access** with account identity and server-authoritative entitlement. Entitlement must stay separate from execution authority. No payment processing is required (§9.3).
6. **Release-status truth on every surface:** admitted, validation-pending, research-only, or locked (§9.4).

The frozen Signal Authority spec adds: "Promotion beyond OBSERVE requires Gate 6. Executable capital FIRE requires Gate 8." Readiness states read pWin/EV floors that are `[UNSET]` until measured and validated (§4.2, preamble). An *admitted* Signal scope therefore needs the research gates, not only the engineering gates.

## Where things stand (verified 2026-10-07)

| Area | State | Evidence |
|---|---|---|
| Desktop app | `0.1.0-alpha.2`: portable, unsigned `.exe`; local-replay fixtures only; no live data; no sign-in | `release/private-validation-alpha-2026-09-28` @ 52db5b4, CI green; artifact `zugrio-private-alpha-windows` (expires 2026-12-28) |
| Desktop/API code on `main` | **None.** `apps/` and `packages/` exist only on the release branch (162 commits ahead) | `git rev-list --count origin/main..origin/release/private-validation-alpha-2026-09-28` |
| Cloud API | Code exists (NestJS + PostgreSQL). **Not deployed.** `api.zugrio.xyz` is NXDOMAIN | DNS lookup 2026-10-07 |
| Authentication / invites / entitlement | **None** in any app code. The RC notes say "The API is unauthenticated" | `docs/release/PRIVATE_ALPHA_RC_NOTES.md` on the release branch |
| Live market data | **None.** Fixtures only | RC notes |
| cTrader | **No code on any branch** | branch grep |
| Code signing / installer / auto-update | None | RC notes |
| Gate 3 | In progress. 3A frozen; 3.1 batch 1 first-pass decisions awaiting independent review (PR #114); 3.2–3.14 not started | `CURRENT-GATE.md`, PR #114 |
| Gate 4 | **Not authorised** | `CURRENT-GATE.md` |
| Gates 5–8 (research, data, calibration, certification) | Not started | — |
| Gated download | None. The Cloudflare account has no R2 enabled | Cloudflare API: "Please enable R2" |

## Blockers, by track

The tracks run in parallel. Only track R decides when Release 1 can actually be claimed.

### Track R — admission evidence (critical path, research)

| # | Blocker | Needs | Owner |
|---|---|---|---|
| R1 | Gate 3 cleared (3.1–3.14) | Independent review per sub-gate; code changes for 3.4–3.14 | Claude (build) + GPT (review) + owner |
| R2 | Gate 5 research instrumentation | Hash-chained ledger, predeclaration | Claude + review |
| R3 | Gate 5A data sufficiency and partition freeze, **per market** (FX instrument, XAUUSD, one synthetic family) | **Representative historical bid/ask data source per market (owner decision)**; cost model reconciled to real observations; frozen dev/validation/holdout partitions | Owner (data) + Claude |
| R4 | Gate 6 research on development data only | Walk-forward, stability, selection-bias controls | Claude + review |
| R5 | Gate 7 calibration and frozen State Policy (sets the `[UNSET]` pWin/EV floors from evidence) | R3, R4 | Claude + review |
| R6 | Admission decision per scope, recorded with evidence | R5 | Owner + independent review |

No threshold in R5 may be chosen to hit a date. If a scope does not qualify, it returns PASS and is not admitted. Release 1 then cannot make the three-market claim for that market (build cut §2).

### Track P — product surfaces (engineering, can start now)

| # | Blocker | Needs |
|---|---|---|
| P1 | Bring `apps/` and `packages/` to `main` through a reviewed PR with CI. Vehicle: **PR #67** (draft; `main` merged in at d2c07e4; Pages fix needs an owner dashboard change, see below) | CI green on the new head; independent review of the code moving to `main`; no semantic change mixed in (CLAUDE.md) |
| P2 | Identity and invite-only access: accounts, invitations, sessions, server-authoritative entitlement, separate from execution authority | Design: **ADR-0007** (Proposed). Build order P2a API, P2b desktop, P2c web. Owner creates the Auth0 tenant |
| P3 | Authenticated desktop: sign-in, token handling, entitlement display, release-status truth labels | P2 |
| P4 | Deploy the API: OCI VM, Cloudflare Tunnel, `api.zugrio.xyz`, health check, backups | Owner access to OCI and Cloudflare |
| P5 | Live market-data adapter, separate from execution adapters (CLAUDE.md) | Data-provider decision (shared with R3) |
| P6 | Windows installer, code signing, update channel | **Signing certificate (owner purchase/identity validation, typically days)** |
| P7 | Web: account, invitation acceptance, gated download, readiness status | P2 |

### Track D — gated download (can be live today for the validation alpha)

Until P2/P7 exist, distribution is gated by Cloudflare Zero Trust Access with an email allowlist, which is the invite list. This is an interim gate, not the Release 1 identity system.

| # | Step | Who |
|---|---|---|
| D1 | Enable R2 in the Cloudflare dashboard; create bucket `zugrio-downloads` | Owner (dashboard only) |
| D2 | Upload the alpha `.exe`, `.exe.sha256` and `.exe.manifest.json` | Owner, or Claude with a scoped token |
| D3 | Connect custom domain `download.zugrio.xyz` to the bucket | Owner |
| D4 | Zero Trust → Access → Application on `download.zugrio.xyz`, policy *Allow* for listed emails, login by one-time PIN | Owner |
| D5 | Verify: an unlisted email is refused; a listed email downloads; the checksum matches | Claude + owner |

What is downloadable through D is the **Private Validation Alpha** (local replay, fixtures, NO LIVE CAPITAL, unsigned). It must not be called Release 1 anywhere (build cut §9.4).

### Track S — Semi-Auto / cTrader (not a Release 1 blocker)

Issue #21 prerequisites, the broker capability matrix, then build-cut Slice 6. This needs Gate 4, which is not authorised. Semi-Auto ships as validation-pending until a scope clears.

## Decisions (owner delegated them to Claude on 2026-10-07; recorded for review)

| # | Decision | Choice and reason | Reversible? |
|---|---|---|---|
| 1 | Historical data (R3, P5) | **FX and XAUUSD: Dukascopy historical bid/ask ticks** (free, tick-level bid and ask, so it meets Gate 5A.2's granularity need). **Synthetic indices: the Deriv API tick history** (the only source for Deriv synthetics; the artifact already reads `DERIV_WEBSOCKET`). The cost model is reconciled later against cTrader demo quotes (5A.3). Gate 5A review must still accept representativeness. This choice does not pre-empt it. | Yes, before 5A partitions freeze |
| 2 | Accounts and invitations (P2) | **Auth0** (OIDC). Native-app login via system browser + PKCE (RFC 8252) for the Electron desktop; public sign-up disabled, users created by invitation; free tier. Entitlement stays in Zugrio's own PostgreSQL (server-authoritative) and never in the identity provider, so commercial entitlement stays separate from execution authority (build cut §9.3). To be recorded as an ADR with P2. | Yes: the API only verifies OIDC tokens |
| 3 | Code signing (P6) | **An OV code-signing certificate with cloud signing**, so CI can sign without a USB token. Buy it in the legal entity's name (company if Zugrio is registered, otherwise the individual). Start the vendor's identity validation early, because it typically takes days. Not needed for the gated alpha. | Yes |
| 4 | First invite list (D) | **Owner's email only.** Testers are added one by one later. | Yes |
| 5 | Exposed Cloudflare token | Revoke now: dash.cloudflare.com → My Profile → API Tokens → the token → **Roll** or **Delete**. | — |

Owner-only actions (need the owner's accounts or money): `docs/runbooks/GATED_DOWNLOAD_SETUP.md` (R2 and Access), revoking the token, the certificate purchase, `docs/runbooks/PAGES_MONOREPO_BUILD_FIX.md` (needed before #67 merges), and deleting the five `ci/pages-probe-*` branches (this session cannot delete branches).

### P1: Cloudflare Pages failure, cause proven by probe (2026-10-07)

PR #67's failing **Cloudflare Pages** check is caused by the alpha's root pnpm workspace. With `pnpm-workspace.yaml` and `pnpm-lock.yaml` both at the repository root, Pages' automatic install skips the landing site's own npm dependencies. Each file alone builds fine; together they fail. The probe evidence is in `docs/runbooks/PAGES_MONOREPO_BUILD_FIX.md`.

An earlier note here said merging `main` (which added the landing `package-lock.json`) fixed it. **That was wrong.** The check still failed afterwards.

The fix is an owner dashboard change: set the build command to `npm ci && npm run build`, and set `SKIP_DEPENDENCY_INSTALL=1` (Preview first, then Production). **PR #67 must not merge before it is applied**, or every landing build including production would fail.

Also fixed on #67:
- `secret-scan` went red after merging `main`. The cause was four gitleaks false positives in the frozen Gate 3A evidence. They are now ignored by exact fingerprint (7b73531), and the check is green.
- The local-replay Windows artifact now ships a `.sha256` (cd3f171).

## What cannot be done today

Release 1 cannot honestly ship today. The admission evidence (track R) does not exist yet, and producing it cannot be compressed into a day without inventing thresholds, which the build cut and the frozen spec forbid. What can happen today:
- the gated download (track D) serving the validation alpha to invited testers;
- the start of P1 and P2;
- continued Gate 3 review.
