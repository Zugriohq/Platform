# EA research evidence against the Zugrio product direction (2026-10-14)

**Purpose.** This file reads the EA research against the founder-directed product documents:
- `docs/product/PRODUCT_DIRECTION.md`;
- `docs/product/ZUGRIO_1_0_PRD.md`;
- `docs/product/INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md`.

It names where they agree, where they conflict, and what combining the evidence gives.

**Status.**
- Research only. It is not Gate evidence: Gate 3 is in progress, and Gate 4 is not authorized (`CURRENT-GATE.md`).
- It changes no product document. Where it conflicts with them, the conflict is surfaced for the founder's decision, as CLAUDE.md requires.

## 1. What the evidence says, by strategy family

Every line was pre-registered before its data was run, with costs. Sources are in `research/tti/REVIEW.md`, `research/lab/README.md`, `research/deriv/FAMILIES.md` and `FAMILY_ENGINES.md`.

| Roadmap family | What was tested | Result |
|---|---|---|
| **Zugrio Core / APA lineage** (TTI) | TTI 4.2 replay; TTI 4.3 with its defects fixed; the information event study (19 variants); the sweep/shift/FVG top-down model; TTI 5.16 APA, as published and with its firing fix. Forex, gold, S&P, Volatility, Jump; M1 to H1 | **No edge before costs, in every test.** APA 5.16 trades are worth about 0R before costs, the same as the mirror trade (24 of 24 cells fail). Its rare firing is caused by the TP1 ≥ 1R rule |
| **SMC** | covered by the same tests: BOS/CHoCH, FVG, order blocks, liquidity sweeps, higher-timeframe alignment | no edge |
| **Trend Following** | 12-month trend on gold (rule A); 4-week trend on BTC/ETH (C2); Drift Switch momentum on synthetics | **Edge.** Gold: +0.18R/month gross (t 3.0), net depends on swap. Crypto: +0.137R/week (t 3.7), both halves positive. Drift Switch: +0.6R per trade at Deriv's min spread, negative at this account's spread |
| **Range / Mean Reversion** | index dip-buying (3 lower closes above SMA200) on S&P and Nasdaq; Range Break fades on synthetics; FX fix reversals | **Edge on equity indices only:** +0.109R per trade (t 5.4, n 379) on ES/NQ futures. Fades on synthetics and FX: no edge |
| Scalping (any family) | 1-minute rules on FX and gold, spike-index bots, APA on M1 | no edge; the spread is 0.2–0.7R per trade |
| Calendar | index turn of the month | no edge |

**By market.**
- **Forex:** no edge in any family (trend, intraday, minute, APA).
- **Gold:** a trend premium, weaker since 2013, with net result depending on swap.
- **Synthetic indices:** fair by design except Drift Switch. Its momentum edge depends on spread, and this account's 4.0 spread is too high.
- **Equity indices:** dip-buying.
- **Crypto:** the weekly trend.

## 2. Where the evidence agrees with the direction

- **Multi-strategy, multi-market architecture** (Direction §2–§4, ZR-STR-014).
  - The edges that exist are small and live in different families and markets.
  - A product that admits strategies by exact scope is the right shape for that.
- **No implicit transfer** (ZR-MKT-005).
  - Index dip-buying works on daily closes and fails on hourly bars.
  - Drift Switch momentum works on Drift Switch and nowhere else among the synthetics.
  - FX has none of the gold trend.
- **Evidence and admission per bundle** (ZR-STR-009/010, ADR-0004).
  - Each surviving engine already has what ZR-STR-009 lists:
    - exact rule and version;
    - data identity and dates;
    - costs;
    - halves or out-of-sample;
    - drawdown;
    - a registered pass rule.
- **Generator-matched null for synthetics** (ZR-STR-026).
  - The family study and the random-bot test (0 of 1,000 bots profitable) are exactly this, and they explain why the synthetics fail.
- **Same-symbol boundary** (ZR-STR-025).
  - The combined engines trade disjoint symbols: indices, gold, BTC/ETH and Drift Switch. One strategy owns each symbol.
- **Planned expansion** (Direction §2).
  - Two of the three real-market edges are in families the direction lists as expansion: crypto and traditional indices.

## 3. Where the evidence conflicts with the direction (for the founder's decision)

1. **Core V1 is defined as the TTI APA lineage** (Direction §4, ZR-STR-014/027, Portfolio doc).
   - That lineage has been tested five ways and has no edge before costs.
   - Admission under ADR-0004 would therefore not clear for Zugrio-generated signals or automation in the scopes tested.
   - **Options:**
     - **(a)** Keep Core as the decision, structure and discipline layer, without a claim of edge. This covers declared plans (ZR-STR-013), process adherence and review.
     - **(b)** Let the first *admitted* strategies be the families with evidence: Trend Following and Range / Mean Reversion.
     - **(c)** Both: (a) for the product surface, (b) for anything that trades.
2. **Forex leads the public narrative** (Direction §2), but no forex edge exists in this research.
   - Leading with forex is a marketing choice the evidence does not support for automated trading.
   - The edges are in indices, crypto and gold.
3. **Synthetics as a first-class track.**
   - The research supports synthetics as a *monitoring and discipline* market.
   - Only Drift Switch has an automated edge, and only at a spread well below this account's 4.0.
4. **Crypto and traditional indices are "planned expansion",** yet they carry most of the measured edge.
   - Admitting them for automation would move them into V1 scope. That is a scope decision.

None of these is changed here. Each needs a founder decision, then a reviewed change to the product documents.

## 4. The combination: one portfolio, one EA

**The EA already runs the combination** as separate engines in one cBot, demo-only by default:
- index dip-buying (`INDEX`);
- gold trend (`TREND`);
- crypto trend (`CRYPTO`);
- Drift Switch (`DRIFT`).

The decision-core DAY/SCALP styles, the APA lineage, are off by default (ADR-0012, proposed; see the app README).

The three real-market engines combined (`research/lab/portfolio.mjs`, 2017-09 to 2026-09):

| | R a year | Sharpe | Max drawdown | Years positive |
|---|---|---|---|---|
| Index + gold + crypto | 6.5R | 1.28 | 5.7R | 9/10 |
| At 1% risk per trade | about 6.5% a year | | about 6% | |

- **Diversification is what makes it solid.** The engines' monthly correlations are about 0, so the combined drawdown is about one engine's while the return is the sum.
- **It is not fast.** It makes about 130 trades or weekly holding periods a year. It does not scalp, because no scalping edge was found.
- **Raising risk per trade scales return and drawdown together.** Compounding raises both.

**What would make it stronger, each a separate pre-registered test:**
- more markets inside the families that work:
  - the trend rule on other liquid crypto;
  - dip-buying on more equity indices (the 9-index test passed weakly);
- a cheaper venue for Drift Switch;
- the account's real swaps and spreads in the record.

## 5. What decides it

**The demo record.** The EA logs entries, fills, spreads, slippage, costs, protective orders, exits, drawdown and net expectancy per engine (README, *Demo validation record*). Two conditions apply:
- Live capital stays launch-gated, under the owner's 2026-10-14 decision and the Gate status.
- No engine is "validated" until its demo record supports it.
