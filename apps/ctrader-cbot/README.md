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
| `src/ZugrioEA/ZugrioEA` | EA | **The EA (ADR-0010).** A full-auto market scanner across synthetics, forex and gold, with capital tiers, on the demo or live account it starts on. `AccessRights.None`, so it runs as a cTrader cloud instance started from cTrader Mobile. Described below. |
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

## The EA (ADR-0010): a market scanner

The EA trades fully automatically on the **demo or live** account it is started on (owner decision, ADR-0010). It is not the Zugrio Windows product, whose gates are unchanged. Its parameters are **untested research values**: it can lose the money in the account.

One instance scans a **watchlist** of synthetics, forex and gold. The chart it is attached to does not matter.

- **Zugrio's decisions, not a copy.** On each closed M5 bar of every watchlist symbol it sends closed H1/M15/M5 bars to decision-core (the DAY style; SCALP is below), which looks for continuation-retest setups. Entry, stop and target are the engine's frozen geometry. Model distances (break, retest tolerance, stop, chase, runway) are multiples of each symbol's M15 ATR, so one setting fits a synthetic index, EURUSD and gold.
- **Reading the Journal.**
  - Plain-English lines start `Zugrio EA:`. One is printed the first time a setup is found (`SETUP …`), skipped (`skipped a … setup: <reason>`), traded (`TRADE OPENED …`), protected (`stop on … moved …`) and closed (`TRADE CLOSED … P/L …`).
  - Every hour a summary shows: scans, setups, trades, skip reasons, the three markets closest to a setup (distance from price to the nearest level, in ATR), balance, open trades, and today's floor.
  - The `ZUGRIO {…}` JSON lines are the data record. They carry 12-character config and engine hash prefixes; the start record holds the full hashes.
  - Each scan line's `nearestLevelAtr` shows how far price is from the closest level. When it falls to 0.5 or below, a setup is possible.
  - The 18 = `candidates` + `notReadyable` is fixed by design: 2 sides × 3 H1 swings × 3 M15 levels. It is the number of combinations checked, not a market reading.
- **Two trading styles: day trading and scalping.** Zugrio's frozen spec defines SCALP, DAY and SWING as horizon profiles (F-1), and the strategy portfolio calls them "horizons/trading styles, not strategy logic". So a scalp is the same decision-core routes and model on faster timeframes; decision-core is unchanged.

  | Style | Context / location / entry | Scans on | Target fallback | Setup / entry expiry | Markets (default) |
  |---|---|---|---|---|---|
  | DAY | H1 / M15 / M5 | every closed M5 bar | H4, then D1 | 24 h / 15 min | all |
  | SCALP | M15 / M5 / M1 | every closed M1 bar | H1 | 6 h / 3 min | synthetics only |

  - Distances are ATR multiples on the style's own location timeframe (M15 for DAY, M5 for SCALP), so scalp stops and targets are roughly half a day trade's (on a random walk an M5 ATR is about 1/√3 of an M15 ATR). Expiries keep the same number of bars: 24 context bars and 3 entry bars.
  - Scalping defaults to synthetics because forex and gold spreads are already 36–43% of a typical *day* stop in the evening (affordability report, 2026-10-08). On scalp-sized stops they would almost always fail the 25% spread filter. Turn them on with *Scalp: markets*.
  - Each style is its own decision-core profile (`INTRADAY`, `INTRADAY_H4`, `SCALP`, `SCALP_H1`), so DAY and SCALP setups have different ids. They share everything else: one position per symbol across both styles, the tier limits, the daily loss limit and the profit lock.
  - Each trade carries its style in the broker comment (`st=SCALP`). Break-even, keep-half and trailing use that style's ATR and bars, also after a cloud restart. Trades without the tag (older ones) are DAY.
  - Cost: scalping adds up to 8 scans a minute. A scan costs about 0.55 s on a laptop and more in the cloud. The hourly summary shows *Scanning took N s* and each scan record has `ms`, so the load is visible. If it approaches the hour, reduce *Scalp: markets* or the watchlist.
  - Set *Trading styles* to `DAY`, `SCALP` or `DAY,SCALP` (default).
- **Why no setup.** Each scan record carries `why`: how many level/target combinations could not be READY at the latest close, by the first failing condition (decision-core's order). The conditions are price at or past the stop, price further than the chase distance from the level, and less room to the target than the minimum runway. When an hour has no setups, the hourly summary says *Why no setup: N too little room to the target, N price too far from the level, N price past the stop, N not confirmed yet*. Diagnostic only: it changes no decision.
- **Speed.** Both routes are judged in one engine call per market (bars validated and pivots computed once), and history is 120 H1 / 200 M15 / 300 M5 bars. A scan is about 2x faster than two separate calls. Before asking decision-core to judge a candidate, the bridge drops those that cannot be READY at the latest close, using decision-core's own READY conditions with identical arithmetic. Tests show the READY results are unchanged. A scan is about 7x faster (in cTrader's cloud, roughly 3 s instead of 22 s per market).
- **Both Zugrio setup types.** Every market is scanned for continuation-retest (break, retest, continue) and reversal-reclaim (dip through a level, reclaim it). Both are decision-core routes. Only one position per symbol is open at a time.
- **No round-tripping: open trades.** R is a trade's initial risk (entry to stop). The EA checks every 10 s:
  - At +1R profit, the stop moves to break-even plus 0.05 ATR.
  - From +1.5R, the stop trails 1 ATR behind the best price since entry.
  - From +1R on, the stop also keeps at least 50% of the best open profit seen (*Keep at least this share of the best open profit*). Whichever of the three is tightest is used. Without this, a stop smaller than one ATR (common on synthetics) lets the 1-ATR trail sit near entry: on 2026-10-08 a Step Index sell ran to about +1.7R and closed at +0.23R. With half kept, the same trade's stop would have been at about +0.84R.
  - Stops only tighten. Each change is checked RISK_REDUCING and goes through the risk-reducing gate, so the kill switch never blocks it.
  - The initial stop is written into the trade's broker comment (`sl=`), so this keeps working after a cloud restart.
  - The original target stays in place. Partial closes are not used, because small accounts trade minimum volume.
- **No round-tripping: the day.** Once equity rises above the day's start, the day's floor rises to keep 50% of the best gain so far (*Daily profit lock*). If equity falls back to the floor, new entries stop until the next UTC day, and open trades keep their trailing stops. This combines with the loss limit: the floor is whichever of the two is higher.
- **Trend filter.** Continuation-retest trades are taken only in the direction of the context timeframe's structure, read from decision-core's confirmed pivots: higher highs and higher lows for buys, lower highs and lower lows for sells. Otherwise the setup is skipped as `TREND_NOT_ALIGNED`. Reclaim setups are exempt by default (*Trend filter also on reclaim setups*), because a reclaim at a turn is often against the old structure. It is abort-only: it removes trades and never creates one.
- **Target fallback (rallies into old highs).** Decision-core needs a target: the nearest context swing beyond the level. When a level near price has no H1 swing beyond it (`openSky`), the EA rescans that market with H4 as the context timeframe, then D1. Their older swings can supply the target, and the trend floor and trend come from the same timeframe. Each rescan is an ordinary decision-core scan with a different timeframe map, and runs only when needed. Scan lines show `context`, `trend` and `openSky`.
- **Not built: a trailing-only exit for true open sky** (no swing beyond the level on H1, H4 or D1, as at an all-time high). It would need decision-core to accept a setup without an objective. That changes the shared engine's semantics, used by the Windows product too, so it needs its own ADR and owner sign-off first (CLAUDE.md: no silent semantic changes).
- **Choosing between markets.** READY setups from all markets are gathered for 3 seconds, then ranked: most recent confirmation first (the frozen spec's SEL-4 order), then lower risk %, then name. They are admitted in that order while the current tier allows it.
- **Capital tiers: small accounts keep trading, more unlocks as the balance grows.** Each watchlist symbol has an unlock balance, and each tier caps open positions and total open risk. Tiers follow the current balance, so they lock again if it falls (open trades are not touched). Defaults:

  | Balance | Markets added |
  |---|---|
  | from $0 | USDJPY, AUDUSD, EURUSD, GBPUSD |
  | from $20 | Volatility 50 |
  | from $35 | Volatility 10, Volatility 25 |
  | from $50 | Volatility 75 |
  | from $80 | Volatility 10 (1s), Step Index, Volatility 100 |
  | from $120 | XAUUSD |

  | Balance | Max open trades | Max total open risk |
  |---|---|---|
  | from $0 | 1 | 5% |
  | from $100 | 2 | 6% |
  | from $250 | 3 | 8% |
  | from $1,000 | 4 | 8% |

  Unlocking is necessary, not sufficient: every trade must also pass sizing. If the broker's minimum volume would risk more than *Max risk at broker minimum volume* (5%) at the engine's stop, the trade is skipped, whatever the tier.
- **Why these markets.** The unlock balances come from the EA's first affordability report on a Deriv cTrader demo account (2026-10-08). For each market, the report gives the smallest balance whose 5% cap covers a typical stop at the broker's minimum volume:

  | Market | Smallest balance |
  |---|---|
  | USDJPY | $4 |
  | AUDUSD | $5 |
  | EURUSD | $9 |
  | GBPUSD | $11 |
  | Volatility 50 | $13 |
  | Volatility 10 | $21 |
  | Volatility 25 | $24 |
  | Volatility 75 | $31 |
  | Volatility 10 (1s) | $43 |
  | Step Index | $52 |
  | Volatility 100 | $54 |
  | Gold | $76 |

  Each unlock is about 1.5x that figure, because volatility moves. All four forex pairs carry USD, so only one is open at a time. Boom/Crash, Jump and Range Break are left out: they spike or gap, so prices can jump past a stop and lose more than planned.

  Deriv does not publish cTrader contract sizes in a form I could read, so the EA measures them itself. At start and once a day it logs, for every market, what a typical stop costs at minimum volume and the smallest balance that can trade it (`affordability` records, plus one printed summary line). That table, from your broker's live data, is the real answer to "which markets suit this account".
- **Portfolio limits.**
  - One position per symbol.
  - No two forex or gold positions sharing a currency: EURUSD and GBPUSD both carry USD, so the second is skipped.
  - Synthetics are independent random generators, so they don't overlap.
  - A position without a stop counts as unlimited risk, so it blocks new entries until it is protected.
- **Costs.** decision-core does not price spreads, so the EA skips a setup when the spread is over 25% of the stop distance. Small stops on wide-spread symbols are mostly cost.
- **Daily loss limit: never lose more in a day than the previous day made.**
  - After a profitable day, today's limit is the lesser of that profit and 5% of today's starting equity. After a losing or flat day, it is 5%.
  - The limit is checked **before** each trade, not only after a loss: the risk still open in current trades (from the current price to their stops) plus the new trade's risk must fit inside the loss still allowed today. Otherwise the setup is skipped (`DAILY_LOSS_ALLOWANCE`).
  - So if yesterday made $2.40, today can give back at most $2.40. If even one minimum-size trade risks more than that, the EA sits out the day.
  - Once the day's loss reaches the limit, new entries stop until midnight UTC.
  - A stop that gaps can still lose more than planned.
  - **Trades are sized to fit what is left.** Each trade risks the smaller of *Risk per trade* and the loss still allowed today minus open risk. Before 2026-10-09 a trade that did not fit at full size was refused: after a +$23.20 day on a $10,031 account, every 1% ($100) trade would have been skipped all day. Now it trades about $23 of risk instead. If even the broker's minimum volume does not fit, the setup is skipped as `DAILY_LOSS_ALLOWANCE`.
  - Switch the rule off with *Never lose more in a day than the previous day made*.
- **Bound to one account.** At start it records the account number and whether it is live or demo. Every order call goes through `EaExecution`, whose `RequireBoundAccount()` stops the robot if the account changes underneath it.
- **Through the boundary.** Each entry is a signed instruction (an in-process ES256 key), checked by the abort-only guards, and recorded in the state machine. That means:
  - no resend on an unknown outcome;
  - one entry per setup;
  - a protection deadline with emergency close;
  - a daily loss limit (until the next UTC day) that never blocks a risk reduction;
  - after a fill it only tightens protection, or attaches a missing stop.
- **Safe across restarts (every cloud restart wipes files).**
  - Before entering, it checks the broker's own open positions and trade history for the setup's label, so a restart can never take the same setup twice.
  - On start it closes any Zugrio position that has no stop.
  - It rebuilds today's loss baseline from trades closed today.
- **Parameters are research values** (`UNVALIDATED_RESEARCH`), including the watchlist and tiers. Their hash is the config version, written into every log record and every trade's broker comment. Change them in the cBot's parameters; the format is shown in each parameter's name.
- **Log.** Every record is printed to the cBot log as a `ZUGRIO {json}` line. When files are available it also writes `logs/ea-YYYY-MM-DD.jsonl` and `logs/journal-<account>.jsonl` inside the cBot's data folder (locally `Documents/cAlgo/Data/cBots/ZugrioEA/logs`). Trade history with comments is the record that survives everything.

### Run it from cTrader Mobile (cloud)

cTrader Mobile does not run cBots on the phone. It starts and stops **cloud instances**, which run on cTrader's servers with the phone off. The EA runs with `AccessRights.None` for this reason: the cloud does not run Full Access cBots.

1. On cTrader **desktop** (Windows or Mac) once: download `zugrio-ctrader-algo` from the "cTrader cBot (Zugrio)" workflow run, check `ZugrioEA.algo.sha256`, and double-click `ZugrioEA.algo`. With cloud sync on, it appears in your cTrader account on every device.
2. **First run, on demo, locally on desktop.** Start a local instance on a demo account. The log tab should print `Zugrio EA started: demo account …, N markets`, a line for any watchlist symbol your broker does not offer, and `Zugrio EA markets by smallest tradable balance: …`.
   - If it prints `Zugrio engine failed to load`, the engine is not permitted under `AccessRights.None`: stop there and send me the log line.
   - Send me the "smallest tradable balance" line too: it shows which markets your balance can actually trade.
3. **Then the cloud.** In cTrader Mobile, open the cBot, pick the account and any symbol (the chart does not matter, the watchlist does), and start it as a cloud instance. One instance covers every market, so the usual limits are enough: one cloud instance on a demo account (it stops after 7 days, restart it), up to ten on a live account, running 24/7. Run **one** instance per account: two would each apply the tier limits on their own.
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
