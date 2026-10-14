# TTI 4.2: adversarial review and two-year replay (2026-10-12, `UNVALIDATED_RESEARCH`)

**Question (owner):** does TTI 4.2 have an edge the Zugrio EA lacks, and should it be converted into a cTrader cloud EA?

**Method:**
- Review the code.
- Run TTI's own decision code, unmodified, on two years of real 1-minute history (`replay.mjs`), driven the way the live app drives it.
- Resolve every signal it fires (`evaluate.mjs`).
- Run the same replay on a random walk with the same volatility, as a no-edge control.

## Verdict

**TTI 4.2 has no edge. On real forex and gold its signals do worse than random, and no exit rescues them.** Converting it into an EA would automate a loss.

## The replay

**Data:** HistData 1-minute bars, 2025-01 to 2026-09, for EURUSD, GBPUSD, USDJPY and XAUUSD. These are TTI's forex-mode markets.

**Signals:** 1,362 fired. Each is resolved from the price at the signal:
- 2-hour horizon;
- stop checked before target inside a bar;
- TTI's own spread once per trade.

| | Real markets | Random-walk control |
|---|---|---|
| Signals | 1,362 | 488 |
| TTI's own record (win %) | **53%** | **56%** |
| Actual result, TTI's target and stop (plan A) | **−0.195R per trade, t = −7.3** | −0.082R, t = −1.6 |
| Reached +0.8R before the stop | 34% | 31% |
| Best of six other exits (B–G) | −0.162R (fixed 0.8R target) | −0.074R |

**Reading the table:**
- **TTI's displayed record looks good even on a random walk.** It shows 56% wins on a market with no edge by construction. The record is not evidence.
- **On real data TTI loses about 0.11R per trade more than on the random walk.** Before cost, its direction is slightly worse than a coin.
- **This holds everywhere:**
  - in every market (EURUSD −0.31R, GBPUSD −0.24R, USDJPY −0.17R, gold −0.14R);
  - in both years (−0.19R and −0.21R);
  - in both setups that fire (FVG −0.19R, trend continuation −0.21R).
- **The give-backs at 0.9–1R are not the problem.** Every exit plan loses within 0.04R of the others. These are a fixed 0.8R or 1.5R target, a target in front of the level, break-even at 0.7R, half off at 0.8R, and a trail from 0.8R. When the entry has no edge, the exit only reshapes the loss.

### "P(win)" is not a probability

| TTI's P(win) | Signals | Stated | Actual wins | Avg R |
|---|---|---|---|---|
| below 0.65 | 112 | 60% | 35% | −0.36 |
| 0.65–0.70 | 1,032 | 67% | 45% | −0.18 |
| 0.70–0.75 | 98 | 71% | 52% | −0.14 |

The ranking has some order, but every bucket loses, and the stated numbers overstate the real win rate by about 20 points.

## Code findings (most serious first)

1. **Targets are set from a different price than the trade's.**
   - **What happens:** `planTradeLevels` measures the stop distance from the current price but builds the targets from the zone's ideal entry (`computeTargets(dir, zone.ideal, stopDist, …)`).
   - **Consequence:** the R shown on a signal is not the R of a trade at the signal. 118 of 1,362 signals (9%) fired with the target already behind the price, and the app's tracker records those as instant wins.
2. **"P(win)" and "EV" are uncalibrated and blind to direction.**
   - **Where it comes from:** P(win) = 0.35 + 0.5 × a weighted sum of six hand-scored categories (structure, volatility, momentum, liquidity, session, asset), clipped to 0.35–0.85.
   - **Direction-blind:** all six scores are the same for a buy and a sell, so P(win) measures how much is happening, not which way.
   - **Never fitted:** it was never fitted to outcomes. EV is computed from it, so the EV gate is arbitrary too.
3. **Analysis runs on an empty bar.**
   - **What happens:** a full recompute happens only when a new M5 bar arrives, with its first price (open = high = low = close).
   - **Consequences:**
     - **Sweep detection** needs that bar's high above the last 10 highs and its close below it, which is impossible, so the *liquidity sweep* setup never fires.
     - **Retest strength** needs a wick, so it stays at 0.45, below the 0.6 bar, and *BOS retest* never fires.
     - **The "FVG"** test, with the empty bar as the third candle, reduces to "price opened above the high of two bars ago".
   - **Replay setup counts:** FVG 1,049, trend 307, breakout 6, sweep 0, BOS retest 0, CHoCH 0.
4. **Stale and coarse confirmation.**
   - Signals are emitted only at an M5 open, because `checkSig` runs only after a full recompute.
   - The M1 closes and the M15/H1/H4 bars used for confirmation are refetched every 10 minutes, so the "M1 confirmation" is up to 10 minutes old.
5. **The outcome record is not trustworthy.**
   - It checks the price every 30 seconds.
   - It counts a WIN when price is past the target, even when it already was at the signal.
   - Timeouts (42%) and reversals are left out of the win rate.
6. **Target 1 sits on the nearest previous-day, weekly or monthly level at least 1R away.** Targets 2 and 3 are computed but never used.
   - Round 6 finds price tends to *break* those levels rather than turn at them, but not significantly. So the level is not why trades turn at 0.9R.
7. **Synthetic indices: TTI's scores cannot work there by construction.**
   - **No structure to find:** Volatility, Jump and Step indices are random-number generators. The random-walk control above shows what TTI does on such a market.
   - **Clock-based scores are meaningless:** the session and weekday scores still feed P(win) on markets that have no sessions.
   - **Boom/Crash have a fixed direction:** Boom is always BUY and Crash always SELL. That catches spikes against the drift.
8. **Smaller issues:**
   - GARCH parameters are fixed across instruments with very different volatilities.
   - Trend counts higher and lower swings over the last six fractals, and both counts can be 3 or more at once.
   - A sweep overrides every other direction source.
   - There is no position sizing, risk limit or broker execution. It is a signal page.

## TTI against the Zugrio engine

| | TTI 4.2 | Zugrio EA (decision-core DAY/SCALP) |
|---|---|---|
| Measured expectancy, real forex and gold | −0.19R per trade (2 years, 1,362 signals) | −0.17R per trade (research rounds 1–2) |
| Bars | analyses an empty forming bar | closed bars only |
| Levels | targets from the zone's ideal entry | entry, stop and target from the same geometry |
| Confidence | uncalibrated score | none claimed |
| Context | previous-day, weekly and monthly levels; sessions; staged WATCH → READY → FIRE; lower-timeframe confirmation | swing structure; multi-timeframe; retest or reclaim |
| Execution | none (a signal page) | signed instructions, guards, sizing, daily loss limit, journal, cloud |

**Where TTI is ahead: breadth of context and presentation, not results.**
- It uses a liquidity map (previous-day, weekly and monthly levels) and session awareness.
- Its staged state machine waits for confirmation.
- It explains each signal.

Those ideas were tested here and in round 6, and none carries an edge after cost. Both engines are structure-pattern systems on efficient markets. The data say that is the problem, not the details of either one.

## What this means for the EA

- **TTI is not converted into an engine.** Running it in the cloud would only reproduce, more slowly, the record this replay produced in 40 minutes. The EA's cloud scoreboard is already the forward record for anything it trades.
- **The edges the research has found so far are slow:**
  - **Index dip-buying:** in the EA, on demo forward test.
  - **The gold trend premium:** undecided until the broker's swap is known.
- **Minute-level rules on the major markets do not survive retail spreads** (round 6).
- **Scalping can only pay where the price process itself is mispriced.** The Deriv spike-index tick replica (Market Lab `LAB REPLICA`) tests that.

## Can an edge be extracted by refining TTI? (2026-10-14)

`refine.mjs` searched TTI's real-market signals for a profitable slice; results are in `refine_results.txt`.

**The slices:** market, setup, regime, direction, session and P(win), alone and in pairs, each under all seven exit rules. That is 637 slices with at least 30 signals.

**How:** each slice was chosen on 2025 and confirmed on 2026.

**Results:**
- **2025 (design):** only 14 slices were positive. Only one had t ≥ 2: gold with P(win) ≥ 0.70 and a 0.8R target, at +0.233R.
- **2026 (test):** that slice lost −0.287R (t = −2.0). None of the ten best 2025 slices was positive in 2026.
- **Reversing every signal:** +0.004R in 2025 and −0.006R in 2026. TTI's direction is uninformative, not a usable contrarian signal.

**Conclusion:** there is no stable subset to refine into an engine. The best-looking slice is what selection from 637 tries produces by chance.
