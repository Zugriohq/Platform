# ADR-0007: Identity, invitations and entitlement for Release 1

- **Status:** Proposed
- **Date:** 2026-10-07
- **Decision owners:** Founder / Product Lead (delegated the provider choice to Claude on 2026-10-07); Engineering
- **Supersedes:** none
- **Related issues/PRs:** #115 (Release 1 blockers, track P2), #67 (desktop and API code)

## Context

Release 1 ships an authenticated Windows desktop and invite-only early access (`docs/product/V1_BUILD_CUT_AND_ARCHITECTURE_FREEZE.md` §9.2–9.3). The PRD requires:
- one identity across surfaces, with individually revocable sessions (ZR-ID-001);
- waitlist sign-up never creating an account or authority (ZR-ID-002);
- a workspace tenant boundary (ZR-ID-003);
- versioned, server-authoritative entitlement that never authorizes trading (ZR-ID-004, ZR-ID-005);
- an invite-gated signup-to-download flow (ZR-ID-006);
- authenticated desktop (ZR-ID-007) and a mobile-ready contract (ZR-ID-008).

Today no code anywhere has accounts, sessions, invitations or entitlement. The alpha API is unauthenticated (RC notes). The alpha schema deliberately excludes *capital* semantics (trading accounts, orders, positions, balances, sizing). That exclusion stays: user identity is not a capital surface.

## Decision

1. **Identity provider: Auth0, using OpenID Connect.** Zugrio code depends only on standard OIDC (issuer, JWKS, audience, `sub`), so the provider can be replaced.
   - Public sign-up is **disabled**. Accounts exist only by accepted invitation.
2. **Desktop sign-in follows RFC 8252.**
   - Login runs in the system browser with Authorization Code + PKCE and a loopback redirect (`http://127.0.0.1:<ephemeral port>`).
   - There is no embedded login webview and no client secret in the app.
   - The refresh token is rotating and stored with Electron `safeStorage`, which uses the OS credential store. The renderer process never sees tokens.
3. **The API checks every non-public route.**
   - It verifies the RS256 access token against the issuer's JWKS, checking issuer, audience (`https://api.zugrio.xyz`) and expiry.
   - `/health` and the public scenario catalogue stay open. Everything else fails closed when the token is missing or invalid.
4. **Zugrio's own database holds who may do what.** The identity provider only proves *who you are*. New tables:
   - `workspace`: the tenant (ZR-ID-003); one per user in Release 1;
   - `app_user`: the identity provider's `sub`, email, and status;
   - `membership`: user ↔ workspace;
   - `invitation`: stores the email hash and the token's SHA-256 only (never the token); single use; expires; revocable;
   - `entitlement_grant`: append-only and versioned. It holds commercial capabilities only: `SIGNAL_VIEW` and `DESKTOP_DOWNLOAD` in Release 1.
   - The effective entitlement set is computed server-side from these grants.
5. **Entitlement never authorizes execution (ZR-ID-005).**
   - The entitlement tables have no broker, account, order, mode-authority or Execution Authority Manifest fields. A schema test enforces this.
   - Semi-Auto authority, when Gate 4 allows it, is a separate artifact that entitlement cannot create.
6. **Sessions can be revoked one at a time (ZR-ID-001).**
   - The API records each desktop session (`sid`), and revoking it is checked on refresh.
   - An admin "revoke all" ends every session for a user.
7. **The waitlist stays separate (ZR-ID-002).** The Brevo waitlist only stores interest. An invitation is issued deliberately and is the only path to an account.
8. **Interim gate.** Until this ships, the validation-alpha download is gated by Cloudflare Access (`docs/runbooks/GATED_DOWNLOAD_SETUP.md`). After it ships, the download moves behind `DESKTOP_DOWNLOAD` entitlement.

### Build order

Each step is one reviewed PR, stacked on #67's code until #67 merges.
- **P2a:** API token verification; workspace, user, invitation and entitlement schema and migrations; invite issue and accept endpoints; tests against a local test JWKS. No live tenant is needed.
- **P2b:** desktop sign-in (system browser + PKCE + `safeStorage`), signed-in state, and release-status labels.
- **P2c:** web invitation acceptance and download page behind entitlement.

## Evidence

- PRD ZR-ID-001 … ZR-ID-011 (`docs/product/ZUGRIO_1_0_PRD.md` §15A).
- Build cut §9.2–9.4.
- RFC 8252 (OAuth 2.0 for Native Apps).
- RFC 7636 (PKCE).
- `apps/api` is NestJS + Prisma/PostgreSQL. `apps/desktop` is Electron 34. Both are on #67.

## Alternatives considered

- **Clerk:** good invitation tooling, but no first-class Electron support at the time of writing.
- **Supabase Auth:** capable, but adds a second backend platform beside the existing PostgreSQL/OCI stack.
- **Cloudflare Access alone:** gates a website well, but does not give the desktop app a per-user identity for API calls. It is kept for the interim download only.
- **Self-built auth:** rejected. Password storage, reset and abuse handling are a security liability with no product benefit.

## Consequences

### Positive

- The Release 1 identity requirements are met with standard protocols.
- The provider can be replaced because only OIDC is assumed.
- Entitlement and authority are separated by schema, not by convention.

### Negative / tradeoffs

- It adds an external dependency and its free-tier limits.
- Invitation email delivery relies on the provider's mailer, or later on Brevo.

### Operational implications

- **Owner tasks:** create the Auth0 tenant; register the SPA/native application and the API (audience); disable sign-up.
- **Configuration:** `ZUGRIO_OIDC_ISSUER`, `ZUGRIO_OIDC_AUDIENCE` and the desktop client ID are configuration, never committed secrets.

## Capital/safety impact

**None.** This ADR adds identity and commercial entitlement only. It adds no capital, broker, order, sizing or execution-authority surface, and Gate 4 stays unauthorized. A test must prove that the entitlement schema cannot express execution authority.

## Rollback / supersession

- The API guard is configuration-gated, so the provider can be swapped by changing issuer and audience.
- The tables are additive. Dropping them via a migration returns the API to the alpha's unauthenticated state.
- A later ADR may supersede the provider choice without changing the entitlement model.
