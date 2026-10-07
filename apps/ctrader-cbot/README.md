# Zugrio cTrader cBot

Design: `docs/adr/0008-ctrader-cbot-broker-adapter.md` (Proposed). Path to live trading: `docs/release/CBOT_LIVE_TRADING_PATH.md`. Both are on PR #115.

The cBot is the cTrader **broker adapter**: the broker-side half of the frozen Broker Execution Boundary (Signal Authority Architecture v1.0.2, §10.8–10.11). It makes **no trading decisions**. It verifies and executes only instructions that Zugrio has already decided and signed, and it reports broker truth back.

## What is here (phases 0 and 1)

| Part | Phase | What it does |
|---|---|---|
| `src/ZugrioSetups/ZugrioSetups` | 0 | A cTrader **indicator** that draws Zugrio setups (entry reference, invalidation, objective, context invalidation) for the chart's symbol. It fetches research-authority `EntryCandidate` JSON over HTTPS. **No orders.** `AccessRights.None`. |
| `src/Zugrio.CBot.Core` | 1 | The pure boundary core, with no cTrader dependency. Listed below. |
| `tests/Zugrio.CBot.Core.Tests` | 0–1 | Unit tests, plus `NoOrderApiBeforeGate4`, which fails the build if any source calls a cTrader order or position API or asks for `FullAccess`. |

`Zugrio.CBot.Core` contains:
- canonical JSON (§7.2 H-1);
- the pinned trust root and ES256 signature verification (§7.1 TRT-1…TRT-6, H-3);
- strict instruction parsing;
- deterministic `clientOrderId` (ID-1, ID-2);
- the entry boundary state machine with a durable journal (SB-1…SB-13);
- RISK_INCREASING / RISK_REDUCING classification by economic effect (§10.11);
- pre-submit abort-only guards: demo-only account allow-list, kill switch, quote age, clock skew, adverse price;
- the risk-reducing gate (§10.7; the kill switch never blocks a genuine risk reduction, RR-3).

## What is deliberately not here

- **Order placement, position changes, cancellation.** These need **Gate 4 authorisation** (`CURRENT-GATE.md`: not authorised). Live capital needs **Gate 8**.
- **Policy values.** The local limits (maximum volume, quote age, clock skew, protection deadline, `clientOrderId` length) are constructor inputs from the signed Broker Execution Policy and Risk/Sizing Policy. They have **no defaults** in code, because they are `[UNSET]` until measured. Values in tests are test values only.
- **Clearing a PROTECTION_FAILED lock.** After a protection failure, new entries on that account and instrument stay locked (SB-10). Phase 1 has no unlock path yet. Clearing the lock needs broker-confirmed flat or protected state and an operator action, which arrives with the Gate-4 build.
- **Signing keys.** The tests generate throwaway keys. The production trust root is provisioned out of band (TRT-1).

## Instruction contract (provisional)

Schema `zugrio.cbot-execution-instruction/v1` (`Contracts.cs`):
- a §10.9 `submissionEnvelope`;
- immutable `entryIntent` terms (instrument, side, volume, stop, target);
- `executionAuthorityManifestHash`, `expiresAt`, and ES256 signature fields.

Unknown fields are rejected, so a payload can never assert its own permission. Position labels carry the ownership tag `zugrio:` followed by the `clientOrderId`, used for reconciliation (SB-4) and risk-reducing identity (RR-2).

## Build and test

```bash
cd apps/ctrader-cbot
dotnet test tests/Zugrio.CBot.Core.Tests            # needs the .NET 8 SDK
dotnet build src/ZugrioSetups/ZugrioSetups -c Release   # produces ZugrioSetups.algo
```

## Install the indicator in cTrader (demo account)

1. Build it, or download `zugrio-ctrader-display-indicator` from the "cTrader cBot (Zugrio)" workflow run, and check the `.sha256`.
2. Double-click `ZugrioSetups.algo` (cTrader installs it). Or, in cTrader Algo, use **Indicators → Add → from file**.
3. Add it to a chart and set **Candidates URL** to an HTTPS URL that serves Zugrio `EntryCandidate` JSON. Until the Zugrio API is deployed, that can be a static export.
