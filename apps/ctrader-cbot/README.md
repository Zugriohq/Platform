# Zugrio cTrader cBot

Design: `docs/adr/0008-ctrader-cbot-broker-adapter.md` (Proposed) and `docs/adr/0009-ea-demo-full-auto-validation-instrument.md` (Accepted by the owner; independent review requested). Path to live trading: `docs/release/CBOT_LIVE_TRADING_PATH.md`. All three are on PR #115.

The cBot is the cTrader **broker adapter**: the broker-side half of the frozen Broker Execution Boundary (Signal Authority Architecture v1.0.2, §10.8–10.11). It makes **no trading decisions**. It verifies and executes only instructions that Zugrio has already decided and signed, and it reports broker truth back.

## What is here

| Part | Phase | What it does |
|---|---|---|
| `src/ZugrioSetups/ZugrioSetups` | 0 | A cTrader **indicator** that draws Zugrio setups (entry reference, invalidation, objective, context invalidation) for the chart's symbol. It fetches research-authority `EntryCandidate` JSON over HTTPS. **No orders.** Runs with `AccessRights.FullAccess` (owner decision, 2026-10-07), so it can also read a local candidates file. Install only builds whose SHA-256 matches CI. |
| `src/Zugrio.CBot.Core` | 1 | The pure boundary core, with no cTrader dependency. Listed below. |
| `engine-bridge` | EA | Bundles Zugrio's own `decision-core` plus a scan bridge into `dist/zugrio-engine.js` (committed; CI fails if it is stale). The bridge turns closed bars into decision-core inputs, enumerates bindings from decision-core's own facts, lets decision-core judge each, and ranks READY candidates by SEL-4. It holds no trading logic. |
| `src/Zugrio.CBot.Engine` | EA | Runs the bundle under Jint inside cTrader. On load it runs decision-core's own fixture and refuses to start if the answer differs. Tests prove Jint output is byte-identical to Node. |
| `src/ZugrioDemoEA/ZugrioDemoEA` | EA | **The demo EA (ADR-0009).** Full auto, `AccessRights.FullAccess`, **demo accounts only**. Described below. |
| `tests/Zugrio.CBot.Core.Tests` | all | Unit tests for core, engine and sizing, plus `NoOrderApiOutsideDemoExecution`: cTrader order and position calls may appear only in `DemoExecution.cs`, each one directly after `RequireDemo();`, and the EA must check `Account.IsLive` first thing in `OnStart` and again on every tick and bar. |

`Zugrio.CBot.Core` contains:
- canonical JSON (§7.2 H-1);
- the pinned trust root and ES256 signature verification (§7.1 TRT-1…TRT-6, H-3);
- strict instruction parsing;
- deterministic `clientOrderId` (ID-1, ID-2);
- the entry boundary state machine with a durable journal (SB-1…SB-13);
- RISK_INCREASING / RISK_REDUCING classification by economic effect (§10.11);
- pre-submit abort-only guards: demo-only account allow-list, kill switch, quote age, clock skew, adverse price;
- the risk-reducing gate (§10.7; the kill switch never blocks a genuine risk reduction, RR-3).

## The demo EA (ADR-0009)

The EA is a **validation and data-collection instrument**, not the Zugrio product. It carries no capital authority.

- **Demo only, in code.** `OnStart` stops at once on a live account. `OnTick` and the bar handler re-check and stop. Every order call goes through `DemoExecution`, whose `RequireDemo()` stops the robot and throws if the account is live. No parameter, file or message can lift this. Trading a live account needs a new ADR and the product gates.
- **Zugrio's decisions, not a copy.** On each closed entry-timeframe bar it sends closed H1/M15/M5 bars (by default) to decision-core and acts only on a `STRUCTURAL_READY` candidate. Entry, stop and target are the engine's frozen geometry.
- **Through the boundary.** Each entry is a signed instruction (an in-process ES256 key, so the product's verification path is exercised), checked by the abort-only guards, and recorded in the journalled state machine: no resend on an unknown outcome, one entry per fire event, a protection deadline with emergency close, and a daily loss kill switch (until the next UTC day) that never blocks a risk reduction. Its baseline is the equity when the EA starts or the UTC day turns, so restarting the EA mid-day resets it. It skips an entry if price is no longer strictly between the engine's stop and objective. After a fill it only tightens protection, or attaches a missing stop.
- **Sizing.** Risk is a percentage of balance at the engine's stop. If even the broker's minimum volume risks more than *Max risk at broker minimum volume*, it does not trade. A $20 account at 0.01 lot on XAUUSD will often hit this cap. A cent account makes small balances workable.
- **Parameters are research values** (`UNVALIDATED_RESEARCH`). Their hash is the config version written into every log record. Change them freely on demo; each change is a new config version.
- **Log.** JSON lines under `Documents/Zugrio/ea-demo/`: `ea-demo-YYYY-MM-DD.jsonl` (start, scans, candidates, sizing, orders, fills, protection, exits) and `journal-<account>-<symbol>.jsonl` (the boundary journal). Send these back for analysis. Demo results are development data. They are never presented as validated edge or performance.

### Install on a demo account

1. Download `zugrio-ctrader-algo` from the "cTrader cBot (Zugrio)" workflow run (or build it) and check `ZugrioDemoEA.algo.sha256`.
2. Double-click `ZugrioDemoEA.algo`, or in cTrader Algo use **cBots → Add → from file**.
3. Log in to a **demo** account. Add an instance on the symbol you want (e.g. XAUUSD, EURUSD, a Deriv synthetic) and approve **Full Access** for a build whose SHA-256 matches CI.
4. Start it. The log tab prints the config and engine hashes and the log folder. On a live account it prints "LIVE ACCOUNT DETECTED" and stops.
5. cTrader must stay running for the EA to trade. cTrader's cloud hosting may not run Full Access cBots; this is unverified.

## What is deliberately not here

- **Order placement in the product path.** Outside the demo EA, order placement, position changes and cancellation need **Gate 4 authorisation** (`CURRENT-GATE.md`: not authorised). Live capital needs **Gate 8**.
- **Policy values.** The boundary core's local limits (maximum volume, quote age, clock skew, protection deadline, `clientOrderId` length) are constructor inputs from the signed Broker Execution Policy and Risk/Sizing Policy. They have **no defaults** in code, because they are `[UNSET]` until measured. Values in tests are test values only. The demo EA supplies its own research values as cBot parameters (ADR-0009 §4); they are not policy.
- **Clearing a PROTECTION_FAILED lock.** After a protection failure, new entries on that account and instrument stay locked (SB-10). There is no unlock path in code, in the EA either, and the lock survives restarts because the journal is replayed. On demo, the operator action is: confirm in cTrader that the position is closed, stop the EA, move `journal-<account>-<symbol>.jsonl` aside (keep it, it is evidence), and restart. In the product, an audited unlock (broker-confirmed flat or protected state plus an operator action) arrives with the Gate-4 build.
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
dotnet build src/ZugrioDemoEA/ZugrioDemoEA -c Release   # produces ZugrioDemoEA.algo

# after changing decision-core or the bridge, from the repo root:
pnpm build:packages && pnpm --filter @zugrio/ctrader-engine-bridge build && pnpm --filter @zugrio/ctrader-engine-bridge test
```

## Install the indicator in cTrader (demo account)

1. Build it, or download `zugrio-ctrader-algo` from the "cTrader cBot (Zugrio)" workflow run, and check the `.sha256`.
2. Double-click `ZugrioSetups.algo` (cTrader installs it). Or, in cTrader Algo, use **Indicators → Add → from file**.
3. cTrader will ask you to approve **Full Access**. Approve it only for a build whose SHA-256 matches CI.
4. Add it to a chart. Set **Candidates URL** to an HTTPS URL serving Zugrio `EntryCandidate` JSON, or **candidates file** to a local JSON export.
