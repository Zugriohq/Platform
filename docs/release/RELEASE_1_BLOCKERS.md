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
| P1 | Bring `apps/` and `packages/` to `main` through a reviewed PR with CI. Vehicle: **PR #67** (draft, head 52db5b4, 9 commits behind `main`, test merge clean) | Merge `main` in; diagnose its failing `Cloudflare Pages` check (all other checks green); review of 162 commits; no semantic change mixed in (CLAUDE.md) |
| P2 | Identity and invite-only access: accounts, invitations, sessions, server-authoritative entitlement, separate from execution authority | Design note → ADR (auth provider choice is an **owner decision**) |
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

## Owner decisions needed

1. Historical data source(s) for FX, XAUUSD and the chosen synthetic family (R3, P5).
2. Auth/identity provider for accounts and invitations (P2).
3. Code-signing route (certificate vendor or a managed signing service) (P6).
4. Who is on the first invite list for the gated download (D4).
5. Revoke the Cloudflare API token that was pasted in chat on 2026-10-06.

## What cannot be done today

Release 1 cannot honestly ship today. The admission evidence (track R) does not exist yet, and producing it cannot be compressed into a day without inventing thresholds, which the build cut and the frozen spec forbid. What can happen today:
- the gated download (track D) serving the validation alpha to invited testers;
- the start of P1 and P2;
- continued Gate 3 review.
