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

**Next test.** Carry, if the broker's swaps pay it: measure the swap on each pair first. It is a weeks-to-months holding strategy, not a day trade.

## Gold

**Mechanism.** Gold trends on macro flows (real rates, central-bank buying). Slow time-series momentum is the documented premium.

**Evidence.**
- 12-month time-series momentum: positive for gold, and with indices it carries that family's overall result (+0.03R per monthly trade across 17 markets).
- Intraday structure (DAY rules) was negative.
- The live demo week showed gold sells fading a clear uptrend.

**Status.** No engine yet.

**Next test.** Monthly time-series momentum on gold with volatility sizing, on 25+ years of data, split in time.

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

Why the EA does not "just scalp" synthetics: scalping multiplies expectancy, it does not create it. On a random walk every rule's expectancy is minus the spread, so more trades lose faster. A synthetic gets an engine only where Market Lab finds structure that pays after the spread.

## Expansion families (not on the EA yet)

| Family | Status |
|---|---|
| Crypto | Not started. Trend and time-series momentum literature is strongest here. Needs the broker's crypto CFDs and their costs. |
| Stocks, ETFs | Not started. Short-term reversal and post-earnings drift are the candidates. Needs per-stock data and costs. |
| Broader commodities, futures | Not started. Time-series momentum (same as gold). |
| Options | Later (product document §2). |
