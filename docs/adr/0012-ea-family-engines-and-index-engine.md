# ADR-0012: EA family engines: the Zugrio Index engine; decision-core styles off by default in the EA

- **Status:** Proposed, 2026-10-10. Owner direction given in session; this records it for review.
  - The owner asked for one engine per market family: "the intelligence cannot be blanket across… there has to be a specific engine that works for indices… another for the kind of markets that jump".
  - The owner approved building the index engine and switching day and scalp trading off on forex and synthetics.
- **Date:** 2026-10-10
- **Decision owners:** Founder / Product Lead (to decide); independent reviewer (to review)
- **Related:** ADR-0004 (strategy evidence and admission), ADR-0009, ADR-0010 (EA live trading), ADR-0011, `docs/product/INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md`, PR #116 (`apps/ctrader-cbot`: `FAMILY_ENGINES.md`, `research/lab/README.md` rounds 1–3)

## Context

The EA (ADR-0010) runs Zugrio's decision-core on synthetics, forex and gold, in two horizon profiles (DAY, SCALP). Research on real market history (PR #116, `research/lab`) found:

1. **decision-core styles.**
   - The EA's DAY rules on real forex and gold data: −0.17R per trade (111 trades, 11 weeks). No exit variant fixes it.
   - A richer sweep, shift and FVG model looked strong in development (+0.37R to +0.65R) but **failed a pre-registered hold-out** on 12 unseen markets (−0.01R to −0.32R).
   - On synthetic Volatility indices (random walks by design) structure carries no edge, and every rule loses the spread.
2. **Classic families, literature parameters, no tuning.**
   - Forex: no robust edge in any family tested.
   - Indices: a short-term reversal ("buy the dip in an uptrend") shows a real timing edge.
3. **The index rule**: buy at the close after 3 lower closes while the close is above its 200-session average; sell at the first close above the 5-session average; 3-ATR stop.
   - It held in development (S&P 500 and Nasdaq 100, 1990–2009) at +0.115R per trade.
   - It held out of sample in time (2010 onwards) at +0.099R, and in 9 other world indices at +0.039R.
   - It held on index futures closes over 2000–2026 at +0.109R (t = 5.4), so it does not depend on the exact cash close.
   - The EA's own C# engine replayed on hourly futures bars gave +0.07R to +0.12R.

## Conflict surfaced (CLAUDE.md: no silent semantic changes)

1. **The product portfolio is Core-only, and Traditional Indices are an expansion family** (`INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md` §2–3).
   - The index engine is not Zugrio Core and is not admitted (ADR-0004).
   - Running it in the EA does not change the product's portfolio, gates (`CURRENT-GATE.md`) or decision-core.
   - It is an EA research engine, like the EA's other research parameters (`UNVALIDATED_RESEARCH`).
   - Bringing it into the product would need, separately:
     - an expansion decision for Traditional Indices;
     - StrategyAdmission with its own evidence;
     - the product's gates.
2. **The EA no longer trades only decision-core's decisions.**
   - ADR-0010 described the EA as running Zugrio's own decision-core. With this ADR, its default engine is a rule outside decision-core.
   - The broker-side half is unchanged. Every index entry passes the same sizing, capital tiers, daily loss rules, signed in-process instruction, abort-only guards, journalled boundary and broker-record duplicate check, through the same single order call (`Submit`).
   - Every index exit is a whole-position close through the risk-reducing gate.
   - Tests in `IndexEngineInEaTests` and `NoOrderApiOutsideEaExecution` pin this.
3. **No capital-authoritative thresholds are invented.**
   - All index values are literature values from the research and are labelled `UNVALIDATED_RESEARCH`: 3 closes, 200/5 averages, 3 ATR, 14-session ATR, 10-ATR backstop target, 15:55 New York decision time, 6-bar session rule, 0.25-ATR price slack.
   - The backstop target exists only because the instruction contract requires a target. In 3,018 historical trades it was never reached.

## Decision (EA only)

1. **The EA hosts family engines.** A market family gets its own engine only with:
   - a stated mechanism;
   - evidence on data the rule was not tuned on;
   - an entry in `apps/ctrader-cbot/FAMILY_ENGINES.md`.

   No evidence transfers between families.
2. **The Zugrio Index engine** (`Zugrio.CBot.Core.IndexEngine`, pure and tested) is on by default in the EA, on the US 500 and the US Tech 100. It runs as a separate *Index markets* parameter, so an instance that kept an older watchlist still gets them.
3. **decision-core styles are off by default in the EA.**
   - The parameter was renamed (*Decision-core styles*, `CoreStylesText`, default empty), so an updated instance picks up the new default instead of keeping `DAY,SCALP`.
   - The owner can switch them back on.
   - decision-core itself is unchanged.
4. **Synthetics get an engine only where the broker's own history shows structure that pays after the spread.**
   - Zugrio Market Lab (a read-only cBot that places no orders) measures each synthetic's behaviour family and tests that family's rules.
   - A candidate needs t ≥ 3.5 and a positive average in both halves of the history.
   - Boom/Crash and other jump families are next, once the owner runs Market Lab.

## Consequences

- **Fewer trades.** About 35 trades a year on two indices, held about 3 days. Expectancy is roughly +0.1R per trade, or roughly 3–4R a year. It is not a frequent-scalping engine.
- **Small accounts may not trade it at all.**
  - The broker's minimum volume at a 3-ATR stop may exceed the 5% small-account cap.
  - After a small winning day, the owner's previous-day loss rule may shrink or skip an index trade.
  - The EA logs both: the affordability line and `DAILY_LOSS_ALLOWANCE` skips.
- **Trades will not match the research exactly.** The CFD's close is the futures session, not the cash auction: 13 of 18 and 10 of 14 entry days matched in the replay. Section 5 of the research (futures closes) is the relevant evidence.
- **Promotion and demotion.**
  - **Forward test.** On the demo account, the EA's hourly scoreboard reports INDEX results by style from the broker's history.
  - **Demotion.** The engine is switched off if, after 30 closed trades, its average R is below zero by more than one standard error.
  - **Into the product.** Promotion to the product is outside this ADR (see Conflict 1).

## Rollback

- Set *Index engine on* to false, or install the previous `.algo`.
- To go back to the previous behaviour, set *Decision-core styles* to `DAY,SCALP`.
- No data migration. Open index trades keep their broker stops and are closed by their exit rule only while the engine runs. Otherwise they stay protected by the stop and target.
