# Zugrio EA: how an engine is designed (methodology, 2026-10-12)

Owner review after studying a competitor's bot. On Crash 150 it buys 0.5 lots, takes profit at +2 points and stops at −2 points, about 30 trades a day. It has a six-month record that the owner reports at over 7,000%.

The lesson concerns how a strategy is found, not one more indicator.

## What went wrong before

1. **We started from chart patterns, not from what moves the price.**
   - One discretionary framework was applied to every market:
     - top-down trend;
     - BOS/CHoCH/MSS;
     - reclaim;
     - FVG;
     - liquidity sweeps.
   - Each market was then tested against it.
   - Pattern edges on liquid markets are widely shared and mostly priced in.
   - An edge in a market's construction (a designed drift, a risk premium, a scheduled flow) is harder to trade away.
2. **Trade geometry came from structure, not from the market's movement.** Stop "beyond the swing" and target "at the next swing" are unrelated to drift speed, jump frequency or jump size.
3. **Timing was late and rare.** Multi-timeframe confirmation chains gave few setups and entered after the move.
4. **Scalps were measured at the wrong resolution and with the wrong pass mark.**
   - Synthetics were tested on M1 bars, with targets scaled to the bar range.
   - A 2-point scalp lives inside one minute, so M1 bars cannot tell whether the target or the stop came first.
   - The pass mark (t ≥ 3.5 on one week) rejects small, frequent edges by construction. The competitor's rule, at about +0.14R a trade, would have failed it.

## The method

1. **Mechanism.** What moves this market?
   - Synthetics: the published generator (drift, jump rate, jump size, regime flips).
   - FX and gold: sessions, liquidity, fixings, scheduled news.
   - Indices: the equity drift and its known anomalies.
2. **Payer.** Who pays the edge: the designed drift, a risk premium, or a predictable flow? No payer, no engine.
3. **Shape the trade from the mechanism:**
   - direction: with the drift or flow;
   - entry: the state in which the payer is strongest relative to the risk (for example, ticks since the last jump);
   - target and stop: from measured drift speed and jump sizes;
   - holding time: bounded.
4. **Measure at the right resolution.** Ticks for scalps, with the broker's bid and ask (`MarketLab.TickReplica`). Bars only for holds of hours or days.
5. **Prove it properly:**
   - thousands of trades for a scalp, enough for the expected edge to stand out from noise;
   - design weeks kept separate from test weeks;
   - then a demo forward test.
6. **Risk is separate from the edge:**
   - fixed fractional risk;
   - the daily loss rules;
   - no martingale or grid averaging.
7. **Live scoreboard per engine.** An engine is demoted automatically when its live average R falls below zero by more than one standard error.

## First application

1. **Calibrate the measuring tool.** Replay the competitor's Crash 150 rule on the broker's own ticks (Market Lab, `LAB REPLICA`). The replay should reproduce his profit.
2. **Search the design space on Deriv's spike indices** (Crash, Boom, Crash Boom Flip):
   - target and stop size;
   - entry by ticks since the last spike;
   - direction, including drift-regime flips.
   Design and test weeks are kept separate.
3. **Then the same method on gold and FX at tick level:** session-open and fix dynamics, not chart patterns.
