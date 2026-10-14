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

## TTI 4.3: the defects fixed and measured again (2026-10-14, pre-registered in `v43_prereg.json`)

Same data and pass rule as before; results are in `v43a_results.txt` and `v43b_results.txt`. Run with `replay.mjs --fix F1,F2,F3[,F4]`.

**The fixes:**
- **F1:** analyse closed bars.
- **F2:** fire only from inside the entry zone, with the target set from the signal price.
- **F3:** confirmation data refreshed every minute.
- **F4 (variant b only):** trade only with the higher-timeframe trend.

**What the fixes changed:**
- **Most signals were chasing.** With F2, 85% of TTI's signals (2,031 of 2,388 in variant a) fired with the price already outside the setup's own entry zone, and are dropped.
- **F1 fills the empty setups.** Setups that never fired before (sweep, BOS retest) now can.

| | Signals | Plan A (TTI's levels) | Best exit | 2025 | 2026 |
|---|---|---|---|---|---|
| TTI 4.2 as shipped | 1,362 | −0.195R (t −7.3) | −0.162R | −0.19R | −0.21R |
| 4.3a: F1–F3 | 357 | −0.111R (t −2.1) | −0.044R (trail) | −0.05R (t −0.7) | −0.14R (t −1.7) |
| 4.3b: F1–F4 | 358 | −0.113R (t −2.2) | −0.044R (trail) | −0.05R (t −0.7) | −0.13R (t −1.6) |
| 4.3b on a random walk | 40 | +0.02R | | | |

**Reading the table:**
- **The fixes help.** The loss per trade roughly halves. Most of the old loss was the chasing and the empty-bar artefacts.
- **They do not reach an edge.** Neither variant is positive in either year with plan A. The one exit that is positive in 2026 (trailing, +0.05R, t = 0.5) is negative in 2025.
- **The fixed engine behaves like a random-walk trader.** Its result sits between zero and minus the spread.
- **Verdict:** both variants fail the registered test. The entry model's information (M5 structure patterns, FVG, sweeps, scored confluence) does not predict direction on these markets once its implementation faults are removed.

## What information gives TTI an edge? The event study (2026-10-14, pre-registered in `events_prereg.json`)

This is the owner's framework, priorities 1–6 (regime, momentum, breakout acceptance and failure, displacement, retracement, sweep response), measured on every occurrence in history rather than on TTI's own signals.

**Scope:**
- Five markets: EURUSD, GBPUSD, USDJPY, XAUUSD and the S&P 500 CFD.
- 2024-10 to 2026-09: design to 2025-12, test in 2026.
- 19 variants, all traded the same way: next-bar entry, 1-ATR stop, 1.5-ATR target, 48-bar limit.
- One run on M5 bars and one on H1 bars (amendment 1, registered after the M5 run and before the H1 run).

Results are in `events_results.txt` (M5) and `events_results_h1.txt` (H1); `node events.mjs <dir> [300|3600]`.

**The control: unbiased measurement, and the cost of a trade.**

| | Random direction, gross | Net |
|---|---|---|
| M5 | +0.000R (design), +0.007R (test) | −0.26R |
| H1 | +0.010R, +0.006R | −0.05 to −0.06R |

At a 1-ATR stop, the round-trip spread is 0.26R on M5 and about 0.06R on H1.

**What the information does, before cost (gross):**

| Information | M5 | H1 |
|---|---|---|
| Break of structure, continuation (all six variants) | −0.02 to −0.07R, t to −5 | −0.01 to −0.07R, not significant (one variant +0.04R in design, −0.04R in test) |
| Accepted break (3 bars later still beyond) | −0.02 to −0.04R | −0.04 to 0.00R |
| Sweep of the 20-bar extreme, closed back inside (reversal) | +0.01R (t 1.3–1.7) | about 0 |
| FVG retracement to the midpoint | about 0 | −0.23 to +0.04R, not stable |
| 1-hour momentum burst, follow | −0.12R | −0.18 to −0.29R (n under 60) |
| 1-hour momentum burst, fade | +0.08R / +0.12R (t 1.6 / 2.1) | +0.22R / +0.17R (t 1.5 / 0.8, n under 70) |

**The answer:**
1. **No variant passes**, not as predictive (gross t ≥ 2 in both periods) and not as tradable.
2. **The information TTI trades points the wrong way, a little.** On M5, structure breaks follow through slightly *less* often than random. The only consistent sign in the data is weak short-term mean reversion: sweeps reverse, and big bursts partly revert. TTI's continuation logic is on the wrong side of it, which matches TTI 4.2 doing worse than the random walk.
3. **The size is the problem.** The largest consistent effect, the momentum fade at about +0.1R, is under half the M5 cost of 0.26R. On H1 the sample is too small to confirm it.
4. **The market features TTI uses add nothing tradable on these markets at these horizons.**

**What remains outside this study:** order-flow, positioning, options and macro data (framework sections E, I, K). The feed does not have them, so they are not tested.
