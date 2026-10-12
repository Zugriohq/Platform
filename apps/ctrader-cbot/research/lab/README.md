# Zugrio research lab (no trading authority)

Backtests on real market history. Two kinds:
- **The EA as it is:** the exact engine bundle and the EA's rules.
- **New entry models:** prototypes built to the owner's contracts (`docs/product/ZUGRIO_STRUCTURAL_BREAK_CLASSIFICATION_CONTRACT.md`, `docs/product/ZUGRIO_CONTEXTUAL_PATTERN_ONTOLOGY.md`).

Nothing here places orders or changes decision-core. A model reaches the EA only through the ADR-0011 process.

## Reproduce

```sh
mkdir -p ybars hbars out td
mkdir -p yraw && python3 -I yfetch.py ybars yraw      # 60 days of 5-minute bars (Yahoo), FX + gold
python3 -I hfetch.py hbars                            # ~2.8 years of hourly bars (Yahoo)
node --test ta.test.mjs                               # detector exactness + no-look-ahead tests
# Current EA (DAY rules) on real data, with Deriv-like spread floors:
node backtest.mjs ../../engine-bridge/dist/zugrio-engine.js ybars/EURUSD.json 0.00001 0.00008 out/EURUSD.json
node analyze.mjs out/*.json; node analyze2.mjs out/*.json
# Top-down liquidity model, per style:
node topdown.mjs SWING hbars/EURUSD.json hbars/EURUSD.json 0.00001 0.00008 td/SWING-EURUSD.json
node topdown.mjs DAY   ybars/EURUSD.json hbars/EURUSD.json 0.00001 0.00008 td/DAY-EURUSD.json
node analyze3.mjs SWING td/SWING-*.json; node combos.mjs SWING td/SWING-*.json
```

Spread floors used: EURUSD 0.00008, GBPUSD 0.00012, AUDUSD 0.0001, USDJPY 0.012, XAUUSD 0.16.

## Files

| File | What it is |
|---|---|
| `ta.mjs` | Causal detectors, each fact carrying `knownAt`:<br>- swings and BOS/CHoCH/MSS (neutral break, then classification);<br>- bias timeline and dealing-range position;<br>- FVG;<br>- candlestick morphology;<br>- liquidity levels: PDH/PDL, PWH/PWL, Asia range, unswept swings, equal highs/lows. |
| `ta.test.mjs` | Hand-computed exactness tests for every detector, plus a no-look-ahead property test. |
| `topdown.mjs` | The top-down liquidity model for SWING (H1 entry), DAY (M5) and SCALP (M5, M15 liquidity). Each sweep becomes a reclaim, a shift and an entry. Every setup is recorded with its features. |
| `backtest.mjs` | The current EA (DAY) on real bars, with shadow trades for every filter. |
| `analyze*.mjs`, `combos.mjs` | Expectancy by component, early half vs late half. |
| `replay3.mjs` | Scalp replay on a tick-consistent random walk (synthetic indices). |

## Results, 2026-10-10 (Yahoo data; not a performance claim)

**Current EA, DAY rules, 11 weeks, 5 markets.**
- **Overall:** 111 trades, −0.17R ± 0.12. No exit variant (1R–3R take-profit, with or without management) fixes it, so the entries are the problem.
- **Filters confirmed:** the setups removed by the counter-trend-reclaim filter lost −0.28R, and those removed by the spread filter lost −0.51R, in both halves.

**Top-down liquidity model, SWING (H1 entry), 2.8 years, 5 markets.**
- **Baseline:** 1,365 triggers at +0.06R ± 0.04 (fixed 2R target).
- **Confluence that adds edge in both halves** (early | late):
  - FVG in the shift leg: +0.17 | +0.11.
  - FVG + (reversal candle at the sweep or inducement taken first): **+0.29 ± 0.13 (n=134) | +0.17 ± 0.12 (n=153)**.
- **Not useful:** plain MN/W1/D1 trend alignment (BOS/CHoCH state) adds nothing here, and full alignment is +0.01R.

**DAY and SCALP versions (M5, 11 weeks).** Negative so far (−0.25R and −0.09R) on small samples. This needs more M5 history before anything can be concluded.

**Caveats.**
- Several combinations were tried, so the best one carries a selection bias. It needs a forward test (demo) before any promotion.
- Yahoo quotes are not Deriv's. Costs are modelled with spread floors.
- Not built yet:
  - chart patterns at points of interest;
  - trendlines (per the ontology: two anchors propose a line, a third confirms it);
  - Elliott wave, which is not in the Zugrio ontology.

## Round 2, 2026-10-10: refinement, pre-registered hold-out, and the classic families

New files:
- `topdown2.mjs`: entry/exit permutations per setup (market, FVG-edge limit, FVG midpoint; 1.5R/2R/3R/liquidity) plus higher-timeframe FVG location. Adds an `INTRA` style (H1 entry, H4 liquidity).
- `analyze4.mjs`: consistency metrics (PF, max drawdown, % months positive, markets positive, halves, trades per year).
- `markets.json`: 5 development + 12 hold-out markets with spread floors.
- `prereg.json`: the four finalists, registered before the hold-out run.
- `classic.mjs`, `idx.mjs`, `idxbench.mjs`: literature strategies, and the index dip-buying test against random long exposure.

**1. Refinement on the 5 development markets.** The FVG-edge limit entry was the big lever:
- SWING, all FVG setups: +0.37R, PF 1.56, 5/5 markets positive.
- With reversal candle or inducement: +0.65R, PF 2.04.
- INTRA with the same confluence and fixed 2R: +0.60R, PF 2.29.
- DAY and SCALP on M5 stayed negative or inconclusive (11 weeks of data).

**2. Pre-registered hold-out, 12 unseen markets** (forex crosses, silver, oil, US500/US100/US30). **All four finalists failed:**

| Finalist | Development | Hold-out |
|---|---|---|
| SWING-A | +0.37R | −0.09R (5/12 markets positive) |
| SWING-B | +0.65R | −0.15R |
| INTRA-B | +0.60R | −0.01R |
| SCALP-A | +0.20R | −0.32R |

The development edge was over-fitting and market luck. The sweep, shift and FVG model has no robust edge on this data.

**3. Classic families, literature parameters, no tuning, 10 years of daily data × 17 markets:**
- **Donchian 55/20 trend:** −0.12R. Forex negative, indices and commodities positive.
- **12-month time-series momentum:** +0.03R per month-trade, 7/10 years positive. Indices and gold carry it.
- **RSI(2) mean reversion:** 0.00R overall. US500 +0.08R, US100 +0.13R.
- **Forex** showed no robust edge in any family.

**4. Index dip-buying, clean test** (pre-2016 history never examined, plus 11 world indices since 1990, CFD costs included):
- **S&P 500:** +0.073R before 2016 and +0.089R after.
- **Nasdaq 100:** +0.087R before 2016 and +0.104R after.
- **All 11 indices together:** +0.024R, 20/37 years positive.
- **Against random long exposure on the same days:** the timing value is +0.041%/day on the S&P 500 (t=2.0) and +0.061%/day on the Nasdaq 100 (t=1.8). Most other indices are mildly positive and HSI is negative.

That is a modest real timing edge on top of the equity drift: about 20 trades a year per index, held about 5 days. It is not a scalping edge.

## Round 3, 2026-10-10: a separate engine for equity indices

New files:
- `ifetch.py`: daily bars for 11 world indices since 1990.
- `idx2.mjs`: ten literature variants of index dip-buying (V0–V9).
- `idx3.mjs`: the best variant with a protective stop, in R units for EA sizing, and the same logic on hourly bars.

```sh
mkdir -p ibars fbars && python3 -I ifetch.py ibars fbars
node idx2.mjs; node idx3.mjs; node idxfut.mjs
# The EA's own engine (C#) on hourly futures bars vs the cash-close rule (hbars from hfetch.py):
dotnet run --project indexreplay -c Release -- hbars/US500.json ibars/SPX.json
```

More files:
- `idxfut.mjs`: the rule on daily futures closes.
- `indexreplay/`: replays `Zugrio.CBot.Core.IndexEngine`, the code the EA runs, on hourly bars.

**Split, declared before the run:**
- **Development:** S&P 500 and Nasdaq 100, 1990–2009.
- **Test in time:** the same two indices, 2010 onwards.
- **Test in markets:** 9 other indices, all years (DJI, RUT, DAX, FTSE, N225, SX5E, CAC, HSI, ASX200).

**Costs:** 0.02% of price per round trip plus 5% a year financing per night.

**Timing value** is the mean daily return on days in a trade minus that market's mean on all days, i.e. the edge over random long exposure. Its standard error is clustered by date, because indices move together.

**1. The best variant: V4, "3 lower closes".** Enter at the close when the close is above SMA200 and lower than each of the 3 closes before it. Exit at the first close above SMA5.

| Sample | Trades/yr | Avg/trade | Win | PF | Timing t | Max DD (1×) | Years positive |
|---|---|---|---|---|---|---|---|
| Dev, SPX+NDX 1990–2009 | 17 | +0.71% | 75% | 3.17 | 3.6 | 11% | 16/19 |
| Test, SPX+NDX 2010+ | 18 | +0.44% | 74% | 2.24 | 2.0 | 12% | 12/17 |
| Test, 9 other indices | 64 (all 9) | +0.22% | 69% | 1.41 | 3.1 | 10% | 26/36 |

V4 is the only variant that is positive with timing t ≥ 2 in all three samples.
- **V3 (cumulative RSI(2) < 35) and V5 (RSI(2) < 10 and IBS < 0.25):** positive everywhere, but weaker.
- **Turn of the month (V8):** +0.19% to +0.32% a trade and positive in all three samples, but timing t only 1.1–2.3.
- **Combining V0 with turn of the month (V9):** dilutes the edge.

**2. With a protective stop** (R = stop distance):

| Stop | Dev | Test in time | Test in markets | Stopped |
|---|---|---|---|---|
| 2 ATR | +0.148R | +0.151R | +0.035R | 15–23% |
| 2.5 ATR | +0.122R | +0.111R | +0.040R | 11–16% |
| **3 ATR** | **+0.115R** (PF 2.05) | **+0.099R** (PF 1.72) | **+0.039R** (PF 1.23) | 7–12% |
| 4 ATR | +0.096R | +0.070R | +0.028R | 3–7% |

- **Which stop:** 3 ATR keeps most of the edge, with the smallest drawdown per unit of edge.
- **Pooled t is overstated:** trades in different markets on the same dates are correlated, so the test-in-markets t is smaller than its pooled value.

**3. The same logic on hourly bars (US500, US100, US30):** no edge (−0.04R to +0.003R in both halves). The effect is a daily-close phenomenon. It cannot be turned into a scalp.

**4. What it is worth.** About 18 trades a year per index, held about 3 days. On US500 and US100 together that is about 35 trades a year at about +0.1R each, or roughly 3–4R a year with a worst historical drawdown of about 6R. It is slow, real and modest. It is not a growth engine for a small account on its own.

**Correction.** The first version of `idx2.mjs` grouped the pooled daily series by raw timestamp. Yahoo stamps each exchange's bar at its own session open in UTC, so the 9-market pool compounded the markets one after another instead of averaging them. That broke the pooled CAGR, drawdown and Sharpe. Per-trade averages, PF, win rate and years positive were unaffected. The timing value was also recomputed: per market-day against each market's own mean, with errors clustered by date. That lowered several t values, for example turn of the month in the 9-market pool from 3.6 to 2.3.

**5. Does it survive a CFD's close?** Index CFDs and futures close on the futures session, not the cash closing auction. On daily index futures closes (Yahoo continuous front month, not back-adjusted), with the 3-ATR stop and the same costs:

| Futures | 2000–2012 | 2013–2026 |
|---|---|---|
| S&P 500 (ES) | +0.142R, t=3.5 (n=79) | +0.102R, t=2.8 (n=114) |
| Nasdaq 100 (NQ) | +0.099R, t=2.3 (n=81) | +0.099R, t=2.4 (n=105) |
| Dow (YM) | +0.067R, t=1.5 | +0.029R, t=0.7 |

- S&P 500 and Nasdaq 100 together: **+0.109R, t=5.4, n=379, PF 2.07**.
- The Dow is weaker, so the EA's default index markets are the US 500 and the US Tech 100 only.

**6. The EA's engine on a CFD-like feed.** `indexreplay` builds New York sessions from 2.8 years of hourly futures bars (about 23 hours a day, on UTC hours, like a CFD).
- **Sessions vs the cash index:** up/down agrees with the cash index on 96.5% (S&P) and 98.1% (Nasdaq) of days.
- **Results, net of costs:** +0.067R ± 0.104 (US500, 18 trades) and +0.118R ± 0.056 (US100, 14 trades).
- **Entry days vs the cash-close rule:** 13 of 18 and 10 of 14 match. "3 lower closes" flips on small differences between futures and cash closes, which is why section 5 matters more than exact trade matching.
- **Dropped sessions:** days missing from Yahoo's hourly feed (expiry Fridays, half days) are dropped by the 6-bar session rule, as intended.

## Round 4, 2026-10-12: trend-following on gold, commodities and FX (pre-registered)

New files:
- `tsmom_prereg.json`: rules, samples, costs and the pass criterion, registered before the run.
- `tsmom.mjs`: the test itself.

**Data.** 25 years of daily bars (Yahoo):
- Gold, silver, platinum, copper, oil and natural gas futures, as continuous front month;
- 9 FX pairs.

**Rules.** Monthly 12-month time-series momentum (A), and a 1/3/12-month trend ensemble (B). R is measured against monthly volatility. Each group is scored as a monthly portfolio.

**Results:**

| Group | Before financing | At 1.5%/yr financing | At 5%/yr (registered) |
|---|---|---|---|
| Gold, rule A | +0.177R/month, t=3.0; halves +0.28 / +0.09 | +0.148, t=2.5; halves +0.26 / +0.06 | +0.082, t=1.4; second half −0.01 |
| Metals, rule A | +0.092, t=2.1 | +0.071, t=1.7 | +0.023 |
| Energy | about 0 | about 0 | about 0 |
| FX, rules A and B | +0.02, t=0.6 | −0.03 | −0.15 (financing alone) |

**What it means.**
- **FX.** Price trend gives no edge even before costs. This is consistent with rounds 1–2.
- **Gold.** A real gross trend premium, weaker since 2013. Whether it survives depends on the broker's swap for holding XAUUSD, which is the next fact needed.
- **The registered 5%/yr verdict is "fail".** The other rows are a sensitivity check, not a re-test.
- **Caveat.** These futures series are not back-adjusted, so they behave like spot plus roll gaps. The financing deduction stands in for the carry a CFD holder pays.

## Round 5, 2026-10-12: intraday momentum, the day-trading candidate (pre-registered)

New files:
- `intraday_prereg.json`: the registration, written before the run.
- `intraday.mjs`: the test.

**Rule** (Gao, Han, Li and Zhou 2018). The move from the previous close into the first hour of the session sets the direction. Trade the last hour of the session in that direction, one trade per market per day.
- Indices: on New York time.
- Gold, silver, oil and 11 FX pairs: the analogue on London time (the 16:00 London fix hour).

**Costs:** 0.01% per trade. **Data:** 2.4–2.8 years of hourly bars.

| Group | Days | Gross | Net | t | Halves | Verdict |
|---|---|---|---|---|---|---|
| US indices (US500, US100, US30) | 579 | −0.25bp | −1.25bp | −1.2 | −1.2 / −1.3 | fail |
| Gold, silver | 595 | +3.9bp | +2.9bp | 1.2 | +0.9 / +5.0 | fail |
| Oil | 590 | +1.4bp | +0.4bp | 0.1 | −4.2 / +5.0 | fail |
| 11 FX pairs | 726 | 0.0bp | −1.0bp | −3.2 | −0.4 / −1.7 | fail |

The published intraday-momentum effect is absent in these recent years: below cost in every group, and about zero before cost.


## Round 6, 2026-10-12: minute-level day-trade and scalp rules (pre-registered)

Files:
- `minute_prereg.json`: registered before any minute data was downloaded. Amendment 1 changed the data source, also before data was seen.
- `hdfetch.py`: HistData.com 1-minute bars.
- `minute.mjs`: the test.

**Data:** EURUSD, GBPUSD, XAUUSD and the S&P 500 CFD (SPXUSD), 2024-10 to 2026-09.
- Design year: 2024-10 to 2025-09.
- Test year: 2025-10 to 2026-09.

Each rule names the party that pays the edge (METHODOLOGY.md step 2).

**Costs** (round trip): EURUSD 1.0 pip, GBPUSD 1.5 pips, gold $0.35, S&P 500 0.6 points.

**Pass:** net mean > 0 with t ≥ 2 in **both** years. t is date-clustered.

| Rule | Group | Gross | Design net (t) | Test net (t) | Verdict |
|---|---|---|---|---|---|
| FX fix reversal (16:00 London) | EURUSD + GBPUSD | −0.04bp | −2.0bp (−3.3) | −0.05bp (−0.1) | fail |
| same, month-end only (secondary) | | +2.3bp | +0.8bp (0.3), n=24 | +1.8bp (0.9), n=24 | fail |
| Gold PM fix reversal (15:00 London) | XAUUSD | −0.20bp | −0.9bp (−0.5) | −1.5bp (−0.4) | fail |
| 1-minute shock fade (scalp) | FX | +0.03R | −0.22R (−10.5), 62% wins | −0.27R (−11.6), 60% wins | fail |
| | gold | −0.02R | −0.19R (−7.0) | −0.11R (−4.1) | fail |
| | S&P 500 | 0.00R | −0.20R (−6.8) | −0.16R (−6.0) | fail |
| 1-minute shock follow (secondary) | all | −0.02 to −0.05R | −0.21 to −0.30R | −0.10 to −0.34R | fail |
| Opening-range breakout (London 08:00, NY 09:30) | FX | +0.06R | +0.02R (0.3) | −0.11R (−2.5) | fail |
| | gold | +0.04R | +0.04R (0.7) | −0.06R (−1.1) | fail |
| | S&P 500 | +0.04R | +0.04R (0.8) | −0.02R (−0.5) | fail |
| Previous day's high/low, FADE | FX / gold / S&P 500 | −0.07 / −0.11 / −0.11R | all negative | all negative | fail |
| Previous day's high/low, BREAK | FX / gold / S&P 500 | +0.07 / +0.11 / +0.11R | +0.04 / +0.01 / +0.11R | −0.03 / +0.16 / +0.03R | fail |

**What it means.**
- **No minute-level rule survives costs.** The scalps are the clearest case. A 1-minute shock fade wins 60% of the time and is about zero before cost: its 0.5× target and 0.75× stop produce the win rate by geometry alone. The spread (about 0.2R per trade at this size) makes it strongly negative.
  - **The lesson:** a high win rate on a short scalp says nothing about an edge.
- **The previous day's high and low tend to break rather than reverse.** This holds in all three groups, but the effect is small and below the bar (t ≤ 1.9 gross).
  - **For TTI**, which targets those levels: price does not systematically turn at them. TTI's give-backs at 0.9–1R are not caused by the levels.
- **Fix reversals:** about zero in these years. The month-end version is positive in both years, but on only 24 days each.
- **Harness fix before the final run:** gold sessions reopen after the 17:00–18:00 New York break, and the first version's search for a session's first bar stopped one minute short of it. That left only 7 gold trades for the level rule; the fixed run has 180. No rule changed.
