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

## Owner's decision and the checks on the event study (2026-10-14)

**Decision (owner).**
- The tested TTI hypothesis, that its **continuation entries** (break of structure, accepted break, FVG retracement and momentum follow-through, with its filters) predict direction on these markets at M5 and H1, is **not validated**.
- That is all this research shows. It does **not** show that every price-only approach is invalid.
- The registered `if_nothing_passes` line ("the TTI line is closed") is narrowed to this: the research is kept for reference, not discarded.
- **No reversal strategy** is built from the weak mean-reversion result.
- The EA's existing engines go to **demo validation unchanged**. The EA is not called validated until its demo record supports it (`README.md`, "Demo validation record").

**Checks A–D.** They were run by `events_checks.mjs` (`checks_m5.txt`, `checks_h1.txt`).
- The script loads the registered `events.mjs` unedited and first proves it reproduces both results files byte for byte.
- SHA-256 of the registered files, unchanged:
  - `events.mjs` `535952e974a6dbaa3e0adab4a77eef9db7205036c949cd69f64f43f78987b215`;
  - `events_results.txt` `3a851f7f3372ee80f5992c803e750f795c0556fac7b4004aa914cc03e84c5814`;
  - `events_results_h1.txt` `6a29baead50dbf21d1b56aed52b2810faa0410f961d5108649a42c4e64764294`.

**A. Is the random control like for like?**
- **What R0 shares with the events.** It uses the same `walk()`:
  - next-bar open entry, 1-ATR stop, 1.5-ATR target, 48-bar limit;
  - stop first when both are touched in one bar;
  - gap fills at the open;
  - the same spread, the same one-trade-at-a-time rule, and the same pooling and day clustering.
- **Where it differs.** It is sampled every 12th bar rather than at event times, so its hours and volatility differ from the events'.
- **R0 gross is +0.000R and +0.007R on M5.** So stop-first and gap fills add no bias.
- **A1: a control at the same times as the events.** Each event's own entry bar, ATR, fill rule and exit rule is re-walked in a seeded random direction. Difference from the event is in R, day-clustered, with 95% CIs.
  - Momentum fade on M5:
    - design +0.110 [−0.013, +0.233], t 1.8;
    - test +0.084 [−0.067, +0.235], t 1.1.

    Against the same-time control, the fade is weaker than when measured against zero. On H1 it is +0.237R (t 0.9) and +0.444R (t 2.2) on n 62 and 45.
  - Break of structure is *below* the same-time control: −0.031R (t −3.5 in design, −2.6 in test). Its continuation information points the wrong way.
  - Sweep-reclaim: +0.015 (t 1.7) and +0.024 (t 2.1). That is real but about 0.02R, a tenth of the cost.
  - **FVG retracement (limit fill) needed care.** The registered walk counts the fill bar's stop. That is sound for the event's own direction, but not for a random opposite direction, whose stop side was usually printed before the fill. A naive control would therefore look −0.13R worse than the event and invent an effect. Walking both from the bar after the fill gives −0.012R (t −1.0), i.e. no information. The registered E4 results themselves are unaffected (their own convention is conservative).
- **A2: which side of the price.** The bars are bid, and the study subtracts one full spread per trade. Re-walking with the spread where it acts gives net results mostly within 0.03R of the registered ones, at most 0.07R (momentum follow, which improves but stays near −0.23R), on both timeframes, with no verdict changed:
  - a long buys at the ask and exits at the bid;
  - a short sells at the bid, with its stop and target on the ask, so its stop is touched earlier.

  The fade on M5 is −0.125R (t −2.9) in design and −0.011R (t −0.2) in test.

**B. Dependence, clustering and overlap.**
- Overlap within each variant and market is removed (one open trade at a time). Same-day trades are clustered across markets.
- n counts trades, not independent observations. The number of clusters is the conservative count:
  - the M5 fade has 236 days (design) and 140 days (test);
  - by week, 65 and 40;
  - by month, 15 and 9.
- Clustering by week or month moves no t statistic by more than 0.9, and no conclusion changes. The largest moves are sweep-reclaim on M5 in the test period (1.3 → 2.1 by month) and the London/NY fade (1.9 → 2.6 by month); both still fail in the design period.
- Daily results are not serially dependent: the lag-1 correlation of daily sums is −0.05 (fade) and −0.02 (control).
- Across the 19 variants, the fade's single test-period t of 2.1 is about what chance gives the best of 19.
- **The fade is not consistent by market.** Gross (net) in design → test:

  | Market | Design | Test |
  |---|---|---|
  | EURUSD | +0.00 (−0.20) | +0.23 (−0.02) |
  | GBPUSD | +0.01 | +0.06 |
  | USDJPY | +0.26 (t 2.5) | +0.14 (t 1.3) |
  | XAUUSD | +0.07 | +0.04 |
  | SPX | +0.05 | +0.13 |

**C. Was the 2026 holdout used to revise definitions?**
- Event definitions, variants, split, costs and pass rule were committed in 310016a before any event-study result.
- `events.mjs` was written once, run, and committed unchanged with the M5 results (4043cb2). The session log shows no edit after a run.
- The H1 amendment was registered after the M5 results and before any H1 result. The H1 run uses the same code with a timeframe argument.
- **Caveat.** 2026 data is not untouched data overall. It was the test period of earlier studies on the same markets: the TTI 4.2 and 4.3 replays, and round 6. Those studies informed which hypotheses were worth testing here, but none of these definitions was changed after seeing a 2026 result.

**D. The cost model.**
- **The costs are assumptions, not measurements.** They are fixed round-trip spreads (EURUSD 1.0 pip, GBPUSD 1.5, USDJPY 1.2, XAUUSD $0.35, SPX 0.6 points), with no commission, no slippage and no variation by session or volatility.
- They are not Deriv's. Deriv's live spreads could not be read from this environment, so the demo record (below) is where they will be measured.
- In R, the cost varies with volatility. For the M5 fade it averages 0.21R in Asia hours and 0.12R in London/New York.
- The fade breaks even only at 0.43× (design) and 0.71× (test) of the assumed spread. Realistic Deriv costs, which are probably wider and include slippage, make this worse, not better.
- **Post-hoc slice, not acted on.** The M5 fade is +0.32R gross over 17:00–22:00 UTC (n 174, both periods together). It is one of four sessions looked at after the fact, without a split. It is a hypothesis, not evidence, and nothing is built from it.

**The +0.08–0.12R mean-reversion effect, exactly.**
- **Rule.** Over the last 12 closed M5 bars, |close − close 12 bars earlier| ≥ 2 × ATR14(M5) × √12. Trade against that move.
- **Trade.** Enter at the next bar's open, with a 1-ATR stop and a 1.5-ATR target; exit after 48 bars otherwise. Stop first if both are touched in a bar; one trade at a time per market.
- **Data.** Pooled over the five markets, with standard errors clustered by UTC date.
- **Results:**

  | | n | Gross | 95% CI | t | Net |
  |---|---|---|---|---|---|
  | M5 design (2024-10 to 2025-12) | 840 | +0.077R | [−0.015, +0.170] | 1.6 | −0.102R (t −2.2) |
  | M5 test (2026-01 to 2026-09) | 505 | +0.123R | [+0.008, +0.238] | 2.1 | −0.051R (t −0.9) |
  | H1 design | 62 | +0.223R | [−0.066, +0.513] | | |
  | H1 test | 45 | +0.167R | [−0.248, +0.582] | | |

- It fails the registered test (gross t ≥ 2 in both periods), and it is negative after the assumed costs.

## Jump indices: what TTI does with them, and why it is not yet tested (2026-10-14)

**The owner's observation.** TTI's Jump signals have been somewhat profitable. Has that been factored in?

**It has not.** The evidence so far does not cover Jump:
- every TTI replay above used EURUSD, GBPUSD, USDJPY and XAUUSD (HistData), and so did the event study;
- Market Lab's first battery covered Boom and Crash Boom Flip only.

Deriv's feed cannot be reached from the research container (HTTP 520 on every Deriv websocket host). So the owner downloads the history.

**TTI's Jump-specific code.** It goes beyond the generic engine in six places:

| Where | What it does for Jump |
|---|---|
| `assetIntel` | "Jump recent": +0.25 to the score when any of the last five M5 bars spans more than 3 ATR |
| `bosThr` | a break of structure must clear 0.15% of price (0.10% on other synthetics), so Jump needs a bigger break |
| signal throttle | at most one Jump signal per 12 minutes per index |
| `tradeStyle` | Jump trades as a day trade (WATCH 2 h, READY 1 h, FIRE 1 h), not a scalp, so it holds longer than Boom/Crash/Step |
| entry-zone tolerance | 0.2 × ATR, shared with Boom/Crash |
| spreads | JD10 0.001 to JD100 0.012. That is about 0.00R per trade, almost certainly below Deriv's real Jump spreads |

**What Deriv says Jump is.** A volatility index that "leaps every 20 minutes (on average), with an equal chance of soaring or plunging around 30x the normal volatility". On that description, a jump carries no direction. Any edge would have to come from TTI's entry and exit on the moves between jumps, with the jumps being risk.

TTI's longer day-trade horizon and stricter break threshold on Jump could plausibly make its Jump results differ from its forex results. That is a question for data, not a reason to believe it.

**The test, pre-registered before any Jump data** (`jump_prereg.json`):
1. The owner runs `jump-history.html` in a browser. It downloads 90 days of M1 for Jump 10–100 from the same Deriv feed TTI uses.
2. `deriv2m1.mjs` converts the file. `replay.mjs` then runs TTI's own code on each index in three forms: as shipped, with the defects fixed, and on a random-walk control.
3. `evaluate.mjs` resolves each signal from the signal price, at TTI's spread and at the broker's spread. It reports the two halves of the period.
4. **Pass:** net average R positive with t ≥ 2 in both halves, pooled over the five indices. The control must not pass.

The pipeline was checked end to end on a simulated Jump series. TTI fires on it, and its "target already passed" defect appears there too.

**Also wanted.** The owner's own TTI Track Record export (Track Record → export, `tti-track-record-*.csv`). `trackrecord.mjs` summarises it by instrument: as TTI recorded it, and recomputed from entry, stop and exit. It is descriptive only, as it covers at most the last 100 signals.

### Result (2026-10-14): TTI on Jump performs like a random walk

**Data.** Deriv's feed *is* reachable from the research container, through the endpoint TTI itself uses first (`wss://api.derivws.com/trading/v1/options/ws/public`). Only the legacy `ws.derivws.com` address is blocked. The owner's browser download failed for the same reason: the page tried only the legacy address, and it now tries TTI's order.

`derivfetch.mjs` downloaded 90 days of M1 bars for Jump 10–100 (2026-07-16 to 2026-10-14, 129,600 bars each). Results are in `jump_results.txt`.

**TTI 4.2 as shipped on Jump.** 339 signals over 90 days.

| | Signals | Avg R per trade (plan A, from the signal price) | t |
|---|---|---|---|
| All five indices | 339 (310 usable) | **−0.101** | −1.8 |
| First half | 183 | −0.139 | −2.2 |
| Second half | 156 | −0.056 | −0.6 |
| Jump 50 / Jump 75 (best) | 112 / 67 | −0.011 / +0.008 | ≈ 0 |
| **Random-walk control** | 204 | **−0.096** | −1.8 |
| TTI with fixes F1–F3 | 95 | −0.216 | −2.3 |

The test fails, before any realistic spread: TTI's Jump spreads cost about 0.00R. TTI on Jump does what it does on a random walk with the same volatility.

**Why TTI's own record looks profitable.** Its panel showed 95 WIN / 97 LOSS with a median target of 1.6R, which reads as profitable. Measured from the price at the signal, the same signals total −31R. Three effects close that gap:
1. **29 of the 95 WINs (31%) had their target already passed when the signal fired.** TTI books them as wins, but they cannot be traded.
2. **TTI plans from its ideal zone entry.** The signal price is a median **0.49R** worse. TTI's WINs average +0.71R from the signal price, not the planned 1.6R.
3. **147 of 339 signals (43%) time out.** They are not in the WIN/LOSS count.

**What Jump itself does** (M1, jumps beyond 6 robust sigmas). It matches Deriv's description:

| Measure | Result |
|---|---|
| Jumps per hour detected at M1 | 0.34–0.37. Deriv says one per 20 minutes at the tick level; smaller ones are absorbed inside a minute |
| Up share | 48–52% |
| Gap regularity | coefficient of variation 0.98–1.01, i.e. memoryless: no jump is ever "due" |
| After a jump | in the jump's direction, next 5 bars −0.04 to +0.10 sigma (one t 2.0 out of ten); next 30 bars −0.06 to 0 sigma |
| Ordinary minutes | lag-1 autocorrelation −0.006 to 0.000 |

TTI's "Jump recent" signal has nothing to read. A jump does not tell you what comes next.

**Verdict.** TTI on Jump is not validated: −0.10R per trade, the same as its random-walk control, and negative in both halves. The profit the app's own panel suggests comes from how it books outcomes, not from the market.

## TTI 5.16 Advanced Price Action (APA): why it rarely fires, and whether it pays (2026-10-14, pre-registered in `apa_prereg.json`)

**What was run.** `apa_replay.mjs` lifts TTI 5.16's own APA code out of the owner's HTML, unchanged, and runs it at every closed bar. The extracted code is `APA_CONFIG`, `swings`, `displacement`, `findFVG`, `analyseAPA`, `buildPlan` and the Wilder ATR.
- **Funnel:** every setup is counted at the furthest stage it reached.
- **Trades:** every fresh trigger is traded: market entry at the next open, the plan's stop and TP1, the spread paid.
- **Control:** the mirror trade, the opposite direction with the same distances.
- **Markets:**
  - forex and gold (EURUSD, GBPUSD, USDJPY, XAUUSD), two years;
  - 13 Volatility indices and 4 Jump indices, 90 days.
- **Timeframes:** M5 (TTI's default) and M1 (scalp).
- **Results:** `apa_results.txt`; the summary is `apa_summary.mjs`.

**Why APA rarely fires.** Most setups never trigger, and of those that do, about 80% are refused by one rule:

| Stage (fx M5, 40,584 setups) | Setups stopped there |
|---|---|
| Break with no displacement | 19,200 (47%) |
| No FVG or no zone overlap | 7,951 |
| Price never came back to the zone | 5,594 |
| Came back, no trigger candle | 1,144 |
| **Triggered** | **6,695** |
| of the fresh triggers: TP1 below 1R | **5,418** |
| of the fresh triggers: price already past stop or TP1 | 559 |
| **Traded** | **487 (0.17 per market per day)** |

- **The 1R rule is the bottleneck.** TP1 is the nearest confirmed swing, including the small k=2 internal pivots, and that is usually inside 1R.
- **The same holds everywhere.** Volatility, Jump and M1 show the same picture: 0.2–1.1 trades per market per day.
- **Amendment 1 (`FIX15`),** registered from the funnel counts alone, before any outcome: drop the 1R rule and target 1.5R. APA then fires 2–13 times per market per day.

**Whether it pays.** No. All 24 registered cells fail.

| Rule, timeframe | Forex: before costs / net | Volatility: before costs / net | Jump: before costs / net |
|---|---|---|---|
| TTI plan, M5 | −0.04R / −0.38 to −0.61R | +0.14R (t 1.0) / −0.18 and +0.02R | +0.05R / +0.03 and −0.15R |
| TTI plan, M1 | +0.01R / −1.0 to −1.5R | −0.02R / −0.7 to −1.9R | +0.81R (t 1.5) / +0.68 and −0.32R |
| FIX15, M5 (6,192 / 3,419 / 1,202 trades) | −0.05R / −0.35R | +0.01R / −0.10 to −0.13R | +0.05R / −0.02 to −0.07R |
| FIX15, M1 (26,787 / 14,682 / 4,575 trades) | −0.01R / −0.67 to −0.78R | −0.01R / −0.41 to −0.52R | +0.01R / −0.26 to −0.48R |

- **Before costs, APA's direction is worth about 0R.** The difference from the mirror trade is within ±0.15R with |t| < 2 in every 1.5R cell.
- **The higher-timeframe filter (`HTF`, the top-down agreement) changes nothing.**
- **Costs then decide the result.** On M1, APA's structural stops are so close that the spread is 0.4–0.7R per trade. That is why scalping it loses fastest.
- **No cell depends on the spread assumption.** Even at zero cost nothing passes: the edge before costs is zero.

**Verdict.** TTI 5.16's APA is not validated, as published or with the firing fix. It fires rarely because of the 1R TP1 rule. Making it fire more only multiplies trades that carry no direction. Scalping it on forex, Volatility or Jump would lose about the spread on every trade.

### Positive control: is the APA model or the harness broken? (2026-10-14)

**The question.** The owner asked whether something is wrong with the APA model itself. A positive control answers that. The same harness (`apa_replay.mjs`, TTI's own code) was run on Drift Switch 10 / 20 / 30, the one market where trend persistence is proven: simple momentum makes about +1R gross there (`research/deriv/FAMILIES.md`). The spread is Deriv's min spread. This check is diagnostic, not a registered test.

| Drift Switch, M5 | Before costs | Minus the mirror trade |
|---|---|---|
| DSI 10, FIX15 (n 200) | +0.42R (t 4.7) | +0.65R (t 4.1) |
| DSI 20, FIX15 (n 141) | +0.42R (t 4.0) | +0.69R (t 3.7) |
| DSI 30, FIX15 (n 141) | +0.13R (t 1.2) | +0.12R (t 0.6) |
| TTI plan, all three (n 22–47) | +0.38 to +0.42R (t 1.2–1.7) | +0.30 to +0.61R |

On M1, it is +0.04 to +1.34R before costs, but the spread takes most of it with M1-sized stops.

**What it shows.**
- **APA and the harness work.** Where price persists, APA's break, displacement, zone and trigger sequence picks the right direction, and the mirror trade loses.
- **On forex, gold, Volatility and Jump at M1–H1 it gives 0R** because those markets have no persistence at those horizons. That matches every other test: the trends found in real markets are weeks to months long (crypto 4-week, gold 12-month).
- **Even on Drift Switch, APA extracts less than plain momentum,** about +0.4R against about +1R gross. Waiting for a retest and a trigger gives up part of the move.
- **So the model is not broken, but it is a short-horizon trend-continuation detector.** It can only pay where short-horizon trends exist.

### APA on H4 and D1 bars (2026-10-14, pre-registered in `apa_htf_prereg.json`)

**Why this test.** The positive control showed APA pays where trends persist at the bar's horizon. Real markets trend over weeks to months, so APA was run on H4 and D1 bars. The harness is the same, `apa_replay.mjs`, with three additions for these timeframes:
- a 21:00 UTC day for non-crypto markets;
- financing charged per day held;
- TTI's H4/D1 setup expiry.

**Data.**
- Indices: S&P, Nasdaq, FTSE, Nikkei, 2010–2026.
- Gold and 10 FX pairs, 2010–2026.
- BTC and ETH, 2017–2026.

**Results:** `apa_htf_results.txt` (summary: `apa_htf_summary.mjs`).

**Result: 0 of 32 cells pass.** The large cells, before costs:

| | H4, FIX15 | D1, FIX15 |
|---|---|---|
| Indices (575 / 128 trades) | +0.01R | −0.28R (t −2.7) |
| Gold (168 / 31) | +0.03R | −0.14R |
| FX, 10 pairs (1,648 / 354) | −0.09R (t −3.1) | −0.08R |
| Crypto (265 / 51) | −0.13R | −0.05R |

**What it shows.**
- **APA's plan (TTI's TP1 ≥ 1R) almost never fires on these bars:** 0–6 trades per market in 16 years on D1.
- **With the 1.5R target, before-cost results are about 0R or negative,** and no better than the mirror trade.
- **The higher-timeframe filter adds nothing reliable.** Gold H4 HTF, +0.30R before costs (t 1.7, n 49), is the best cell and still fails both halves' t.

**Why the slow trends do not reach APA.** The real-market trends are in returns over weeks to months and are small per day. APA trades a break, retest and trigger with a stop at the nearest internal swing, which is a structure a few bars long. It does not hold the trend.

**Verdict.** APA is not validated on any timeframe tested, M1 to D1, on forex, gold, indices, crypto, Volatility or Jump. It works only where short-horizon persistence exists, as on Drift Switch.
