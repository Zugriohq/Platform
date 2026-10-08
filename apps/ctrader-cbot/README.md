# Zugrio cTrader cBot

Design: `docs/adr/0008-ctrader-cbot-broker-adapter.md` (Proposed), `docs/adr/0009-ea-demo-full-auto-validation-instrument.md` and `docs/adr/0010-ea-live-trading-owner-decision.md` (owner decisions; independent review requested). Path tracker: `docs/release/CBOT_LIVE_TRADING_PATH.md`. All are on PR #115.

The cBot is the cTrader **broker adapter**: the broker-side half of the frozen Broker Execution Boundary (Signal Authority Architecture v1.0.2, §10.8–10.11). It makes **no trading decisions**. It verifies and executes only instructions that Zugrio has already decided and signed, and it reports broker truth back.

## What is here

| Part | Phase | What it does |
|---|---|---|
| `src/ZugrioSetups/ZugrioSetups` | 0 | A cTrader **indicator** that draws Zugrio setups (entry reference, invalidation, objective, context invalidation) for the chart's symbol. It fetches research-authority `EntryCandidate` JSON over HTTPS. **No orders.** Runs with `AccessRights.FullAccess` (owner decision, 2026-10-07), so it can also read a local candidates file. Install only builds whose SHA-256 matches CI. |
| `src/Zugrio.CBot.Core` | 1 | The pure boundary core, with no cTrader dependency. Listed below. |
| `engine-bridge` | EA | Bundles Zugrio's own `decision-core` plus a scan bridge into `dist/zugrio-engine.js` (committed; CI fails if it is stale). The bridge turns closed bars into decision-core inputs, enumerates bindings from decision-core's own facts, lets decision-core judge each, and ranks READY candidates by SEL-4. It holds no trading logic. |
| `src/Zugrio.CBot.Engine` | EA | Runs the bundle under Jint inside cTrader. On load it runs decision-core's own fixture and refuses to start if the answer differs. Tests prove Jint output is byte-identical to Node. |
| `src/ZugrioEA/ZugrioEA` | EA | **The EA (ADR-0010).** Full auto on the demo or live account it starts on. `AccessRights.None`, so it runs as a cTrader cloud instance started from cTrader Mobile. Described below. |
| `tests/Zugrio.CBot.Core.Tests` | all | Unit tests for core, engine and sizing, plus `NoOrderApiOutsideEaExecution`: cTrader order and position calls may appear only in `EaExecution.cs`, each one directly after `RequireBoundAccount();`; the EA must stay `AccessRights.None` with no absolute paths or HTTP; and the broker-side duplicate check must come before the order. |

`Zugrio.CBot.Core` contains:
- canonical JSON (§7.2 H-1);
- the pinned trust root and ES256 signature verification (§7.1 TRT-1…TRT-6, H-3);
- strict instruction parsing;
- deterministic `clientOrderId` (ID-1, ID-2);
- the entry boundary state machine with a durable journal (SB-1…SB-13);
- RISK_INCREASING / RISK_REDUCING classification by economic effect (§10.11);
- pre-submit abort-only guards: account allow-list (live allowed only when configured), kill switch, quote age, clock skew, adverse price;
- the risk-reducing gate (§10.7; the kill switch never blocks a genuine risk reduction, RR-3).

## The EA (ADR-0010)

The EA trades fully automatically on the **demo or live** account it is started on (owner decision, ADR-0010). It is not the Zugrio Windows product, whose gates are unchanged. Its parameters are **untested research values**: it can lose the money in the account.

- **Bound to one account.** At start it records the account number and whether it is live or demo. Every order call goes through `EaExecution`, whose `RequireBoundAccount()` stops the robot if the account changes underneath it.
- **Zugrio's decisions, not a copy.** On each closed entry-timeframe bar it sends closed H1/M15/M5 bars (by default) to decision-core and acts only on a `STRUCTURAL_READY` candidate. Entry, stop and target are the engine's frozen geometry.
- **Through the boundary.** Each entry is a signed instruction (an in-process ES256 key), checked by the abort-only guards, and recorded in the state machine: no resend on an unknown outcome, one entry per setup, a protection deadline with emergency close, and a daily loss kill switch (until the next UTC day) that never blocks a risk reduction. It skips an entry if price is no longer strictly between the engine's stop and objective. After a fill it only tightens protection, or attaches a missing stop.
- **Safe across restarts (every cloud restart wipes files).** Before entering, it checks the broker's own open positions and trade history for the setup's label, so a restart can never take the same setup twice. On start it closes any Zugrio position on its symbol that has no stop, and it rebuilds today's loss baseline from trades closed today.
- **Sizing.** Risk is a percentage of balance at the engine's stop. If even the broker's minimum volume risks more than *Max risk at broker minimum volume*, it does not trade. A $20 account at 0.01 lot on XAUUSD will often hit this cap. A cent account makes small balances workable.
- **Parameters are research values** (`UNVALIDATED_RESEARCH`). Their hash is the config version, written into every log record and every trade's broker comment.
- **Log.** Every record is printed to the cBot log as a `ZUGRIO {json}` line. When files are available it also writes `logs/ea-YYYY-MM-DD.jsonl` and `logs/journal-<account>-<symbol>.jsonl` inside the cBot's data folder (locally `Documents/cAlgo/Data/cBots/ZugrioEA/logs`). Trade history with comments is the record that survives everything.

### Run it from cTrader Mobile (cloud)

cTrader Mobile does not run cBots on the phone. It starts and stops **cloud instances**, which run on cTrader's servers with the phone off. The EA runs with `AccessRights.None` for this reason: the cloud does not run Full Access cBots.

1. On cTrader **desktop** (Windows or Mac) once: download `zugrio-ctrader-algo` from the "cTrader cBot (Zugrio)" workflow run, check `ZugrioEA.algo.sha256`, and double-click `ZugrioEA.algo`. With cloud sync on, it appears in your cTrader account on every device.
2. **First run, on demo, locally on desktop.** Start a local instance on a demo account and check the log tab prints `Zugrio EA started on … Config …, engine …`. If it prints `Zugrio engine failed to load` instead, the engine is not permitted under `AccessRights.None`: stop there and send me the log line.
3. **Then the cloud.** In cTrader Mobile, open the cBot, pick the account and symbol (e.g. XAUUSD), and start it as a cloud instance. Brokers usually allow one cloud instance on a demo account (it stops after 7 days) and up to ten on a live account, running 24/7.
4. **Live.** Start an instance on the live account the same way. It trades that account until you stop it. Start with an amount you can afford to lose entirely, and keep a demo instance running alongside for comparison.

## What is deliberately not here

- **Order placement in the product path.** Outside the EA, order placement, position changes and cancellation need **Gate 4 authorisation** (`CURRENT-GATE.md`: not authorised). Live capital needs **Gate 8**.
- **Policy values.** The boundary core's local limits (maximum volume, quote age, clock skew, protection deadline, `clientOrderId` length) are constructor inputs from the signed Broker Execution Policy and Risk/Sizing Policy. They have **no defaults** in code, because they are `[UNSET]` until measured. Values in tests are test values only. The EA supplies its own research values as cBot parameters; they are not policy.
- **Clearing a PROTECTION_FAILED lock.** After a protection failure, new entries on that account and instrument stay locked (SB-10). There is no unlock path in code, in the EA either, and the lock survives restarts because the journal is replayed. For the EA, the operator action is: confirm in cTrader that the position is closed, then restart the instance (a cloud restart already clears the journal; locally, move `logs/journal-<account>-<symbol>.jsonl` aside first and keep it as evidence). In the product, an audited unlock (broker-confirmed flat or protected state plus an operator action) arrives with the Gate-4 build.
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
dotnet build src/ZugrioEA/ZugrioEA -c Release           # produces ZugrioEA.algo

# after changing decision-core or the bridge, from the repo root:
pnpm build:packages && pnpm --filter @zugrio/ctrader-engine-bridge build && pnpm --filter @zugrio/ctrader-engine-bridge test
```

## Install the indicator in cTrader (demo account)

1. Build it, or download `zugrio-ctrader-algo` from the "cTrader cBot (Zugrio)" workflow run, and check the `.sha256`.
2. Double-click `ZugrioSetups.algo` (cTrader installs it). Or, in cTrader Algo, use **Indicators → Add → from file**.
3. cTrader will ask you to approve **Full Access**. Approve it only for a build whose SHA-256 matches CI.
4. Add it to a chart. Set **Candidates URL** to an HTTPS URL serving Zugrio `EntryCandidate` JSON, or **candidates file** to a local JSON export.
