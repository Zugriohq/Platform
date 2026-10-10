# Zugrio research lab (no trading authority)

Backtests on real market history. Two kinds:
- **The EA as it is:** the exact engine bundle and the EA's rules.
- **New entry models:** prototypes built to the owner's contracts (`docs/product/ZUGRIO_STRUCTURAL_BREAK_CLASSIFICATION_CONTRACT.md`, `docs/product/ZUGRIO_CONTEXTUAL_PATTERN_ONTOLOGY.md`).

Nothing here places orders or changes decision-core. A model reaches the EA only through the ADR-0011 process.

## Reproduce

```sh
mkdir -p ybars hbars out td
python3 -I yfetch.py ybars ../../../../scratch-yraw   # 60 days of 5-minute bars (Yahoo), FX + gold
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
