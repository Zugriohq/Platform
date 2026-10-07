# ADR-0008: The Zugrio cTrader cBot as the cTrader broker adapter

- **Status:** Proposed. Needs owner acceptance and independent review. It amends the delivery mechanism in build cut §9.1, not its authority model.
- **Date:** 2026-10-07
- **Decision owners:** Founder / Product Lead; Engineering; independent reviewer
- **Supersedes:** none. It extends ADR-0006.
- **Related:** `docs/release/CBOT_LIVE_TRADING_PATH.md`, ADR-0006, ADR-0007, frozen Signal Authority Architecture v1.0.2 §7.10–7.11 and §10.6–10.11, issue #21

## Context

The owner wants Zugrio to trade cTrader accounts through a **cBot**: C# code running inside cTrader Automate. Build cut §9.1 names cTrader as the first Semi-Auto broker, reached by delegated (OAuth) integration through the cTrader Open API. ADR-0006 fixes the least-privilege scopes and active revocation.

The frozen spec already defines everything between a FIRE event and the broker:
- Layer 4A builds the entry intent.
- Layer 4B vetoes.
- A BrokerSafetySnapshot is taken.
- A SubmissionEnvelope is built with a deterministic `clientOrderId`.
- The Broker Execution Boundary state machines run (SB-1…SB-18).
- Orders are classified RISK_INCREASING or RISK_REDUCING (OC-1…OC-4).
- The Execution Authority Manifest binds `brokerAdapterHash` (§7.11).

This ADR places the cBot inside that structure so it adds no new authority.

## Decision

1. **The cBot is the cTrader broker adapter and the broker-side half of the Broker Execution Boundary. It is never a decision-maker.**
   - It contains no Decision Core, no strategy logic, no inference, no sizing and no veto.
   - It executes only SubmissionEnvelopes and management actions that Zugrio has already decided. It verifies them mechanically and reports broker truth back.
   - This keeps broker specifics behind the Broker Adapter Contract and Decision Core free of the broker (CLAUDE.md).
2. **Where it runs:** in a cTrader Automate environment the user owns and controls. Zugrio does not run per-user broker hosts, consistent with the no-Zugrio-owned-per-user-VPS rule in CLAUDE.md.
3. **What it accepts:** only envelopes signed by Zugrio's execution signing key (§7.1 trust root).
   - The cBot embeds the public key and verifies the signature, expiry, `accountId`/`brokerVenueId` match and `brokerExecutionPolicyHash`.
   - It rejects anything unsigned, expired, replayed or mismatched.
4. **How it identifies itself:** with a per-installation device credential bound to the user's Zugrio identity (ADR-0007). The credential is individually revocable, and revoking it stops all new risk-increasing actions at once (ADR-0006 §4).
5. **Before it submits, it may only abort** (§10.8, ID-6). It captures a local BrokerSafetySnapshot: current quote, quote age, connection state and clock skew. It enforces the envelope's `adverseExecutionPriceLimit` and the Broker Execution Policy's safety thresholds.
6. **It implements the boundary state machines exactly:**
   - RESERVED is journalled before submission (SB-1).
   - SUBMISSION_UNKNOWN is a hard lock that is never resent (SB-3).
   - Reconciliation runs by `clientOrderId`, carried in the cTrader position/order label or comment within its length limit (ID-1, ID-2), and survives restarts (SB-6).
   - Protection is attached with the order where the venue allows. Otherwise PROTECTION_PENDING has a hard deadline before PROTECTION_FAILED (SB-9, SB-9A).
   - There is no top-up, retry or resend of risk-increasing actions (SB-5, SB-7, SB-12).
7. **Risk-reducing actions are asymmetric** (§7.11, OC-2). The cBot keeps the built-in Emergency Risk-Reduction Kernel locally: it can tighten stops and close positions by verified position ID even when it cannot reach Zugrio. It can never open, add, reverse or widen while disconnected, locked or unadmitted.
8. **Hard local limits that no remote message can loosen:**
   - an account-type allow-list: **demo only** until the live-activation gate clears, after which only scopes named in the signed manifest;
   - per-trade and per-day maximum-loss caps from the signed Risk/Sizing Policy;
   - a local kill switch;
   - fail closed on any parse, signature, clock or state ambiguity.
9. **Build-cut relationship.** The Open API under ADR-0006 scopes stays the route for read-only observation (Signal mode, `accounts` scope). The cBot is the Semi-Auto/execution adapter. Every authority rule in §9.1 and ADR-0006 still applies. This ADR changes the transport, not who decides.

## Evidence

- Frozen spec §7.10 Broker Execution Policy fields, §7.11 manifest binding, §10.8–10.11 boundary rules.
- CLAUDE.md architecture rules.
- ADR-0006 scopes and revocation.
- TTI 5.16.0 (`legacy/gate-baselines/gate3a/round11/artifacts/Zugrio-1.0.0-gate2.2.html`) already had a cTrader intent path (`CTRADER_OPEN_API`, `riskState:'SERVER_CHECK_REQUIRED'`, demo-only mode). It is lineage only, not evidence of safety: its server is not in the repository, and Gate 3 found its sizing fallbacks coerce a zero risk scale to non-zero (BATCH-1 review, RISK_SCALE).

## Alternatives considered

- **Open API execution from Zugrio's cloud (build cut default):** this remains valid. The cBot was preferred by the owner for speed and broker-side protection. Both must satisfy the same boundary rules, and choosing one does not lower requirements.
- **A cBot with the strategy inside it:** rejected. It would duplicate Decision Core in C#, break determinism and provenance, and let a broker-side copy drift from the frozen semantics.
- **A Zugrio-hosted cBot per user:** rejected, as a Zugrio-owned per-user host.

## Consequences

### Positive

- Protection and the emergency kernel live next to the broker, which helps if the connection to Zugrio drops.
- Execution authority remains in signed, hash-bound artifacts.

### Negative / tradeoffs

- It adds a C# codebase and a signing and verification surface.
- Users must install and run the cBot.
- The cTrader label/comment length limits constrain the `clientOrderId` encoding, which must be collision-tested (ID-2).

### Operational implications

- A signing key and its custody are needed (§7.1).
- The cBot build itself is hashed (`brokerAdapterHash`) and pinned in the Execution Authority Manifest.
- A different build fails execution admission.

## Capital/safety impact

**Yes: this defines a capital surface.** Writing order-submitting code requires **Gate 4 authorisation** (`CURRENT-GATE.md`: not authorised). **Live capital requires Gate 8** (spec: "Executable capital FIRE requires Gate 8"). Before Gate 4 is authorised, this ADR permits only:
- design;
- signature-verification and state-machine code with no order API calls;
- a chart-display cBot that places no orders.

The tests required later are the spec's §17 Gate 4 tests, plus boundary tests SB-1…SB-18 and ID-1…ID-6 against a cTrader demo account.

## Rollback / supersession

- Remove the cBot from the Execution Authority Manifest (a new manifest without its `brokerAdapterHash`). Execution admission then fails, and the cBot can only run the risk-reducing kernel.
- Revoke device credentials.
- A later ADR may return execution to the Open API route without touching decision semantics.
