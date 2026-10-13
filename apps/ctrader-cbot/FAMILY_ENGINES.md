# Zugrio EA: one engine per market family (research map)

Status: **research, `UNVALIDATED_RESEARCH`**, ADR-0012 (proposed). This is the EA's map, not the product's portfolio. The Windows product's V1 is Zugrio Core only (`docs/product/INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md`), and nothing here changes that.

**The principle** (owner, 2026-10-10: "the intelligence cannot be blanket across"). A market family earns an engine only when two things hold:
- there is a reason its price process could reward a rule;
- a test on data the rule was not tuned on agrees.

Evidence does not transfer between families (portfolio document §1). For each family the map records:
- the mechanism;
- the candidate engine;
- the evidence so far;
- the status;
- the next test.

Evidence comes from `research/lab/README.md` (rounds 1–3) and Market Lab (on the broker's own synthetic history).

## Traditional indices (an expansion family in the product; the EA's first family engine)

**Mechanism.** Equity indices drift upward (the equity risk premium). Short-term selling pressure tends to reverse within days: liquidity provision and short-term overreaction, documented in the literature for decades.

**Engine: the Zugrio Index engine (in the EA, on by default).**
- **Buy:** at the US cash close after 3 lower closes in a row, while the close is above its 200-session average.
- **Sell:** at the first close above the 5-session average.
- **Stop:** 3 ATR.
- **Markets:** US 500 and US Tech 100.

**Evidence.**

| Sample | Avg / trade | PF | Timing t |
|---|---|---|---|
| Development (S&P 500 + Nasdaq 100, 1990–2009) | +0.71% | 3.17 | 3.6 |
| Test in time (same indices, 2010+) | +0.44% | 2.24 | 2.0 |
| Test in markets (9 other indices) | +0.22% | 1.41 | 3.1 |

- With the 3-ATR stop: +0.115R / +0.099R / +0.039R per trade in the same three samples.
- On index futures closes, 2000–2026: +0.109R per trade, t = 5.4.
- The EA's own engine replayed on hourly futures bars: +0.067R and +0.118R.
- No edge on hourly bars.

**Status.** In the EA, forward test on demo.

**What it is worth.** About 35 trades a year on two indices, roughly 3–4R a year. Slow, real and modest.

**Not adopted:**
- Turn of the month: positive everywhere, but timing t only 1.1–2.3.
- RSI(2) variants: weaker out of sample.
- The Dow and small caps: weaker.

**Next tests:**
- Intraday momentum (the first half hour predicts the last half hour; Gao, Han, Li and Zhou, 2018). Needs years of intraday cash-index data, which the lab does not have (60 days only).
- Overnight drift: CFD financing probably eats it. Measure the broker's swap first.

## Forex

**Mechanism.** Currencies are the most efficient market retail can trade. Known premia are carry (interest differential, paid as swap) and slow cross-sectional momentum. Price structure alone has none that survives costs.

**Evidence.** No robust edge in any family tested on 10 years of daily data and 11 weeks of 5-minute data:
- the EA's DAY rules: −0.17R per trade;
- the sweep, shift and FVG model: failed the pre-registered hold-out;
- Donchian trend;
- 12-month momentum;
- RSI(2).

**Status.** No engine. Decision-core styles off by default.

**Round 4 confirms it (2026-10-12).** Monthly trend on 9 pairs over 20+ years gives +0.02R a month before costs (t = 0.6), and is negative after financing.

**Next tests:**
- **Carry.** Only if the broker's swaps pay it: read the swap on each pair first. It is a weeks-to-months holding strategy, not a day trade.
- **Intraday session effects.** For example, around the London open and the 16:00 London fix. Pre-registered, on 2.8 years of hourly data.

## Gold

**Mechanism.** Gold trends on macro flows (real rates, central-bank buying). Slow time-series momentum is the documented premium.

**Evidence.**
- 12-month time-series momentum: positive for gold, and with indices it carries that family's overall result (+0.03R per monthly trade across 17 markets).
- Intraday structure (DAY rules) was negative.
- The live demo week showed gold sells fading a clear uptrend.

**Status.** No engine yet.

**Pre-registered trend test (research round 4, 2026-10-12).** Monthly 12-month trend on gold, 2000–2026:
- **Before financing:** +0.18R a month, t = 3.0. Both halves positive (+0.28 / +0.09).
- **At 1.5% a year financing:** +0.15R, t = 2.5. The 2013+ half falls to +0.06.
- **At the registered 5% a year:** +0.08R, t = 1.4. This fails the registered test.

**Status.** Undecided. The broker's XAUUSD swap (long and short) decides it.

**Next.** Read the swap from cTrader. If holding costs are at or below about 1.5% a year, build a monthly gold trend engine for forward test.

## Synthetic indices (Deriv; generated, not markets)

Each synthetic is a published random process. A rule can only have an edge where the process has structure **and** the spread is smaller than what the structure pays. Market Lab measures each one on the broker's own M1 history and tests that family's rules after the live spread. A rule counts as a candidate only with t ≥ 3.5 and positive results in both halves.

| Sub-family | Process (by design) | What could pay | Expected | Status |
|---|---|---|---|---|
| Volatility 10–100, (1s) | Random walk, constant volatility | Nothing: increments are independent | Every rule loses the spread | No engine. Market Lab confirms (`RANDOM_WALK`). |
| Boom (up spikes) / Crash (down spikes) | Drift one way, rare spikes the other | Following the drift between spikes, *if* the drift pays more than spikes plus spread take | A fair generator gives zero before costs | **Awaiting Market Lab** (drift-follow, five target/stop pairs, always-on and after a spike) |
| Jump 10–100 | Random walk plus symmetric jumps | Nothing directional | Loses the spread | Market Lab |
| Step | ±fixed steps | Nothing | Loses the spread | Market Lab |
| Range Break | Ranges, then a break after some touches | A breakout follow, *if* the break rule is predictable | Unknown | Market Lab momentum/fade; a range-specific test is next |
| DEX, Drift Switch | Drift regimes that switch | Momentum, *if* regimes last long enough to detect and ride | Possible | Market Lab variance ratio and momentum tests |

**Market Lab, batch 1 (owner's Deriv account, 2026-10-10).** 12 symbols, 7 days of M1 bars each: Boom 50–1000 and Crash Boom Flip 150/1000.
- **Momentum and fade:** no rule passed after the spread. The best was Boom 500 fade (lb60, hold 60): +1.31R, t = 2.0, positive in both halves. Below the 3.5 bar for about 30 tests per symbol.
- **Measurement bug, fixed in the next build.** Between spikes, Boom 300–1000 bars move by an almost constant step. The robust sigma was about zero, so 99% of bars read as "jumps" and they were labelled `SPIKE_DOWN`. That means their drift-follow tests ran in the **wrong direction**. Jumps are now measured from the median, against a scale with a floor (`MarketLab.JumpScale`).
- **Crash Boom Flip 1000: strong persistence between jumps.** VR(5/15/60) = 1.9 / 4.0 / 9.4, lag-1 autocorrelation 0.24. The drift regime lasts. A regime-follow test (direction = drift with jumps left out) is added for it.
- **Next:** re-run batch 1 with the fixed build, then batches 2+.

**Batch 1 re-run on the fixed build (2026-10-11).** Every Boom now reads `SPIKE_UP`, with jumps in 0.2–5.7% of bars, all up.
- **No candidate.**
  - Best results: Boom 900 momentum (lb5) t = 2.9, with halves +2.8 / −3.4. Boom 500 fade (lb60) t = 1.9, positive in both halves. Boom 50 fade (lb15) t = 1.7, positive in both halves.
  - With about 360 tests over 12 symbols, a best t near 3 is expected by chance.
- **Fair generators.** The net drift per bar, spikes included, is about 0 on every Boom (−0.0002% to +0.0004%).
- **Drift-follow below them all.** Following the drift between spikes, the common retail Boom trade, never ranked in the top three on any Boom.
- **Crash Boom Flip 1000.** The persistence is confirmed (VR60 9.65, AC1 0.25), but no rule converts it after the 0.63 spread. Jumps in either direction (2.8% of bars) hit the stops.
- **Spreads.** Boom 99, 100 and 200 have spreads of 7.4–7.8, and every rule loses there.
- **Status: Boom and Crash Boom Flip get no engine.** Next: batches 2+ (Crash, DEX, Drift Switch, Jump, Range Break, Step).

**A competitor's rule on Crash 150 (owner's friend's bot, 2026-10-12).** Buy 0.5 lots, take profit +2 points ($1), stop −2 points.
- **Live:** 23 wins and 7 losses, about +$13 in a day. Losses run −$1.06 to −$1.88, because drops gap through the stop.
- **The bot's own counter:** 155 wins and 89 losses (63.5%). The break-even win rate is about 57% at a $1.35 average loss.
- **If both are accurate:** about +$0.14 per trade, t ≈ 1.9. Suggestive, not proof. A fair, memoryless generator would give about minus the spread.
- **Test:** Market Lab replays this exact rule tick by tick on the broker's own Crash 150 ticks (`MarketLab.TickReplica`, LAB REPLICA lines).

**Result (owner's Deriv demo, 2026-10-05 to 2026-10-12: 601,014 ticks).** The generator is fair, and the rule loses the spread.
- **The rule:** 1,008 trades.
  - Won 52.9% against a break-even of 56.5%; the average loss is 2.59 points, because drops gap through the 2-point stop.
  - Average −0.165 points per trade (t = −2.3), which is −$0.082 per trade at 0.5 lots, or −$83 over the week.
  - Both halves lose: −0.169 and −0.161.
- **The generator:** average change +0.00000 points per tick (z = 0.0).
  - One drop per 152 ticks, averaging −0.97 points.
  - Drift between drops +0.00644 points per tick.
  - 152 × 0.00644 = 0.98, so the drift pays back the drops exactly.
  - Average spread 0.16 points.
- **The grid:** 32 rules (targets and stops of 1–5 points, buy and sell). None passes. The best lose −0.15 to −0.17 points per trade, which is the spread.
- **Why:** on a fair generator every rule's expectancy is minus the spread, whatever its target, stop or timing.
- **The friend's panel:** 63.5% wins over 244 trades is 3 standard errors above this replay's 52.9%. A reported run like that is what a lucky or selected sample looks like. Only his full account history can say more: every trade since the start, with deposits and withdrawals.
- **Second run (2026-10-06 to 2026-10-13, 601,205 ticks):** the same picture. 1,014 trades at 52.9% against a break-even of 56.4%, −0.162 points per trade, −$82 for the week. Generator z = 0.1.
- **Status: Crash 150 gets no engine.**
- **The friend's newer bots (MT5, 2026-10-13):** Boom 150 sell 2/2 at 0.5 lots; Boom 50 sell 10/10 at 0.1 lots; also Step, Volatility 75 and EURUSD. They are replayed the same way (Market Lab default *Replay rules*).
  - **His Boom 150 "Scan Profit" panel:** 799 setups, 443 targets hit and 356 stops hit (55.4%), +$87.
  - **What the panel assumes:** $87 = 443 × $1 − 356 × $1.00, so it books every stop at exactly −$1. On these indices a spike gaps through the stop. The Crash 150 losses averaged 2.59 points against a 2-point stop, about 30% more. At that size the same counts give 443 − 356 × 1.30 ≈ −$20, before the spread.

Why the EA does not "just scalp" synthetics: scalping multiplies expectancy, it does not create it. On a random walk every rule's expectancy is minus the spread, so more trades lose faster. A synthetic gets an engine only where Market Lab finds structure that pays after the spread.

## Expansion families (not on the EA yet)

| Family | Status |
|---|---|
| Crypto | Not started. Trend and time-series momentum literature is strongest here. Needs the broker's crypto CFDs and their costs. |
| Stocks, ETFs | Not started. Short-term reversal and post-earnings drift are the candidates. Needs per-stock data and costs. |
| Broader commodities, futures | Not started. Time-series momentum (same as gold). |
| Options | Later (product document §2). |
