# Brief for an outside brainstorm: what could give a fully automatic cTrader EA a real edge? (2026-10-14)

Written for another AI to read cold. It records what has been tested, with numbers, so ideas already rejected are not proposed again. It then asks specific questions.

---

**Context.** We are building a fully automatic EA (cTrader cBot) for a retail account at Deriv. It runs in cTrader's cloud, which brings three constraints:
- **Data:** no internet or outside data from inside the bot. Only the broker's own prices, history, spreads and swaps.
- **Instruments:** whatever Deriv offers on cTrader:
  - about 100 synthetic indices (Volatility, Boom/Crash, Jump, Step, Range Break, DEX, Drift Switch, Trek, and others);
  - forex;
  - metals and energy;
  - stock-index CFDs.
- **Costs:** retail spreads, and swaps on overnight positions.

The account is small. Risk controls already exist: per-trade risk, a daily loss limit, and stops always attached.

**We work like this.** Each hypothesis is pre-registered before results, then tested on a design period and a held-out test period.
- **To pass:** a positive result after costs with t ≥ 2 in both periods. When many rules are scanned, t ≥ 3.5 overall and positive in both halves.
- **After passing:** a demo record of real fills, costs and drawdown comes before any live money.

## Already tested and rejected (please do not re-propose these without a new mechanism)

1. **SMC/ICT-style confluence entries.** We replayed TTI, a browser signal app that scores break of structure, FVGs, liquidity sweeps, retests and higher-timeframe alignment, using its own code.
   - **Two years of forex and gold:** −0.195R per trade. With its defects fixed: −0.11R.
   - **Refinement:** a search over 637 filter combinations failed the holdout.
   - **Deriv Jump indices** (90 days): −0.10R per trade, the same as the same engine on a random walk.
2. **The information those entries use** (a pre-registered event study).
   - **Scope:** 19 variants of break of structure, accepted break, sweep-and-reclaim, FVG retracement and 1-hour momentum. Five markets (EURUSD, GBPUSD, USDJPY, gold, S&P 500), on M5 and H1, over two years.
   - **Result:** none passes.
   - Structure breaks are slightly *anti*-predictive.
   - The only consistent sign is weak short-term mean reversion. Fading large 1-hour bursts gives +0.08 to +0.12R gross on M5, but the M5 spread costs about 0.26R per trade at a 1-ATR stop.
3. **Daily forex rules.** None has a robust edge after costs:
   - our day rules: −0.17R;
   - Donchian breakouts, RSI(2) and 12-month momentum;
   - monthly trend on 9 pairs: +0.02R a month, t 0.6, before financing.
4. **Deriv Boom/Crash.**
   - **The generators measure fair:** average change per tick z ≈ 0, and the drift between spikes exactly repays the spikes.
   - **Fixed-target scalping:** a competitor's 2-point target/stop bots lose the spread, −0.17 and −0.26 points per trade over 600,000 ticks. All 32 target/stop/direction variants lose about the spread.
   - **"Overdue spike" logic is wrong:** spikes are memoryless.
5. **Deriv Jump.**
   - Jumps are 50/50 up and down and memoryless (gap coefficient of variation ≈ 1).
   - There is no drift after a jump, and no lag-1 autocorrelation in ordinary minutes.
6. **Intraday minute rules on forex, gold and indices:** none passes.

## Built, now in demo validation (not yet validated)

- **World index dip-buying.** On 10 cash indices: buy after several lower closes while above a long moving average, exit on a close above a short average. It rests on a documented short-horizon reversal in equity indices.
- **Gold time-series trend.** A 12-month signal, decided monthly, traded only when the swap cost is at most 1.5% a year. A 3-sigma monthly stop.

## Our current view of what an edge needs

- **A mechanism with a reason to persist:** a risk premium, a structural flow, a behavioural bias, or a stated property of a generator. Chart patterns alone have failed every test here.
- **A horizon where costs are small against the move:** H4 to daily and slower on real markets. Intraday only where spreads are tiny against volatility.
- **For synthetic indices, the generator decides everything.** A fair random walk cannot be beaten, so only families whose declared design implies structure are worth testing:
  - Range Break: bounces between boundaries and breaks after about 100 or 200 hits;
  - Drift Switch: bull, bear or sideways regimes lasting about 10, 20 or 30 minutes;
  - Trek and Daily Reset: a declared directional bias;
  - Skew Step: asymmetric steps.
- **Several small, slow, uncorrelated edges** with sound sizing, rather than one fast scalper.

## Questions

1. **Hypotheses with a mechanism**, for instruments Deriv offers on cTrader, at horizons where retail costs are small. For each, give:
   - the exact rule;
   - why it should persist;
   - the expected gross size from published evidence, if any;
   - the cost hurdle;
   - a falsification test we can run on broker or free historical data.
2. **Deriv synthetic families.** From Deriv's descriptions, which generator properties could create exploitable structure? Cover Range Break, Drift Switch (regime detection speed against regime length), Trek, Daily Reset, Skew Step, Volatility Switch, DEX and Hybrid. For each:
   - what statistic would reveal it;
   - what rule would harvest it;
   - what would make it unprofitable even if real, such as the spread or jumps through stops.
3. **Our method.** Where could it reject a real edge (too strict, wrong cost model, wrong horizon) or accept a false one (leakage, overlap, multiple testing)?
4. **Portfolio and sizing** for a small account combining slow edges, for example volatility targeting and correlation caps. What is realistic to expect?
5. **Traps to avoid.** Name any that our list above does not already rule out.

**Please answer in tables where possible.** Separate "has published evidence" from "plausible but untested". Say when an idea needs data the bot cannot see (order flow, options, news).
