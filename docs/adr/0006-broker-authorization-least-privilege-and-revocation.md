# ADR-0006: Broker authorization least privilege and active revocation

- **Status:** Proposed
- **Date:** 2026-09-25
- **Decision owners:** Founder / Product Lead; Engineering
- **Related issue:** #21
- **Supersedes:** none

## Context

Zugrio separates product access, decision intelligence and execution authority.

The existing architecture already requires:
- Signal mode to have no broker order authority;
- Semi-Auto to require explicit user approval before submission;
- execution authority to be explicit, bounded, versioned and revocable;
- cTrader to be the first Release 1 Semi-Auto broker path.

cTrader Open API exposes two OAuth scopes relevant to Zugrio:
- `accounts` — view-only account information/statistics; trading operations are impossible;
- `trading` — account information/statistics plus all permitted trading operations.

cTrader access tokens expire after approximately 30 days. Refresh tokens do not expire on their own, so passive token expiry is not an acceptable Zugrio revocation mechanism.

The broker scope is therefore coarser than Zugrio's own authority model. Zugrio must request the least broker access needed for each mode, then apply narrower internal execution authority on top.

Official cTrader references:
- https://help.ctrader.com/open-api/account-authentication/
- https://help.ctrader.com/open-api/

## Decision

### 1. Request the least broker scope required by the active mode

For cTrader:

- **Signal** shall use `accounts` scope when broker observation is needed.
- **Semi-Auto** may request `trading` scope only when the user explicitly enables a trading-capable connection.
- **Auto / Full Auto** may never inherit trading scope merely because a user previously connected in Signal mode or has product entitlement.

A user must not be asked for `trading` scope merely to obtain read-only account, order, fill, position or history data when `accounts` is sufficient.

### 2. Broker authorization does not equal Zugrio execution authority

Possession of a cTrader `trading` token grants broad broker-side capability, but it does **not** itself authorize Zugrio to submit any particular order.

Every capital action must still pass the existing Zugrio authority path, including:
- valid ExecutionAuthorityManifest;
- admitted strategy / TradeBundle scope;
- current risk limits;
- freshness and state checks;
- user approval where required by the mode;
- broker reconciliation and safety checks.

The broker token is a transport credential. Zugrio's authority manifest is the narrower product permission envelope.

### 3. Signal mode truth must be technically enforced

When an account is connected under cTrader `accounts` scope:

> Zugrio cannot place trades through that connection.

This is stronger than a UI promise because the broker credential itself lacks order authority.

If the user later enables Semi-Auto, Zugrio must obtain a new/expanded authorization flow rather than silently upgrading the existing connection.

### 4. Revocation is active

When the user revokes or disconnects a broker connection inside Zugrio:

- Zugrio immediately marks the BrokerConnection revoked/disabled server-side;
- new risk-increasing submissions fail closed immediately;
- stored access tokens and refresh tokens for that connection are deleted or cryptographically destroyed from active credential storage;
- background refresh/reconnect jobs are cancelled;
- incompatible prepared intents and stale approvals are invalidated;
- revocation propagates across devices through the existing authority epoch/version model.

Zugrio must not wait for the cTrader access token to expire.

### 5. Broker-side revocation remains visible to the user

The disconnect/revocation UX should also provide a clear path/instruction for removing Zugrio's authorization from cTrader's own authorized-app/account settings.

Broker-side revocation is a second trust boundary and is not replaced by Zugrio deleting its local credentials.

### 6. Reconnection creates a new authorization epoch

After revocation, reconnecting the same broker account is treated as a new authorization event:
- new credential material;
- new connection authorization epoch/version;
- no resurrection of old prepared intents, approvals or execution authority;
- execution-mode permission must be re-established explicitly.

## Mode truth

### Signal
- may use cTrader `accounts` scope;
- broker-side order submission is impossible through that credential;
- read-only observation remains subject to connector capability/fidelity.

### Semi-Auto
- may use cTrader `trading` scope after explicit user authorization;
- every order still requires Zugrio's narrower Semi-Auto authority + user approval + revalidation;
- disconnect/revoke immediately disables new submissions and destroys stored credential material.

### Auto
- future trading-capable scope requires explicit authority and release gates;
- broker token possession never substitutes for Zugrio mandate/risk authority.

### Full Auto
- same least-privilege and active-revocation principles;
- remains separately locked/release-gated.

## Security requirements

- broker access/refresh tokens never enter client bundles, logs, analytics payloads or AI prompts;
- credential storage must be encrypted at rest and tenant/account scoped;
- token rotation/refresh must replace old tokens atomically;
- revocation operations must be auditable without recording token values;
- reconnect/re-authorize flows must be idempotent and account-bound.

## Consequences

### Positive
- Signal mode can make a strong, technically true trust claim;
- broker scope and Zugrio authority remain clearly separated;
- revocation is immediate rather than dependent on external token lifetime;
- mode upgrades require explicit user consent;
- stale credentials cannot silently restore execution authority.

### Tradeoffs
- mode upgrade may require a second OAuth consent flow;
- connector UX and credential lifecycle become more complex;
- broker-specific OAuth semantics must be mapped per adapter.

## Alternatives rejected

### Request trading scope for every connection
Rejected because it violates least privilege and weakens Signal-mode trust.

### Treat cTrader trading scope as sufficient execution permission
Rejected because cTrader's trading scope is broader than Zugrio's strategy/risk/authority model.

### Revoke only inside Zugrio and wait for token expiry
Rejected because refresh tokens do not expire on their own and passive expiry is not a reliable revocation control.

## Unresolved

- exact secrets-storage/KMS implementation;
- exact cTrader authorized-app deep link or user guidance path;
- whether reconnect UX preserves historical BrokerConnection identity or creates a new immutable connection record linked to the old one;
- equivalent scope/revocation semantics for MT5 and future brokers.
