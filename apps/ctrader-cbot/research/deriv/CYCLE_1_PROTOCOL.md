# Zugrio / TTI EA Research Cycle 1
## Preregistered protocol for testing whether observable structure is tradable
**Prepared:** 14 October 2026  
**Scope:** Deriv cTrader instruments; broker prices, history, spreads and swaps only  
**Status:** Protocol proposal. No empirical results are claimed in this document.

## 1. Decision rule

The objective is not to find a profitable-looking backtest. It is to determine whether a prespecified, observable property predicts a future price path strongly enough to survive realistic execution costs and untouched out-of-sample testing.

Do not code a production trading rule until its underlying event study passes.

Use the existing acceptance standard from the research brief:
- Net result must be positive after costs.
- The result must have **t ≥ 2 in both design and held-out periods**.
- For a broad scan of related rules, require **t ≥ 3.5 overall**, with positive results in both periods.
- After a research pass, validate real fills, costs, protective orders and drawdown in demo before considering live capital.

A threshold must not be relaxed after results are seen. If a hypothesis is changed after inspection, treat it as a new hypothesis and preserve the old result.

## 2. Research order

### Cycle 1A: establish generator facts before trading rules

| Rank | Experiment | Initial question | Why this precedes a strategy |
|---:|---|---|---|
| 1 | Range Break boundary events | Does boundary-touch history predict bounce, breakout, or adverse excursion? | The declared boundary structure does not establish a 99% safe-fade probability. |
| 2 | Drift Switch regime observability | Can a causal detector identify directional regimes early enough to leave a net tradable move? | Correct regime classification after most of the move is not useful. |
| 3 | Trek unconditional return and tails | Is there a measurable directional bias at the horizons available to the bot? | Test the simplest implied property before adding dip/rally filters. |
| 4 | Volatility Switch regime persistence | Does regime information add anything beyond a rolling-volatility baseline? | A risk overlay is useful only if it improves risk decisions out of sample. |
| 5 | M15/H1 large-move reversal replication | Does the existing weak M5 mean-reversion effect persist at slower horizons? | This is separate from, and must not be treated as evidence for, an RSI(2) rule. |

These are investigation priorities, not claims that any family or strategy is profitable. Start only when suitable historical data and actual broker cost information are available.

## 3. Data and time controls

Before calculating results, record the exact Deriv cTrader symbol, contract specification, quote/bar source, timestamp convention, time zone, bid/ask availability, spread history, trading hours, swaps/financing, minimum volume and stop-distance constraints.

For every dataset:
1. Preserve the raw file and its checksum.
2. Record gaps, duplicate timestamps, malformed bars and symbol/specification changes.
3. Define the decision timestamp and ensure every feature uses only data available at that time.
4. Use chronological design and holdout periods fixed before inspecting outcomes. Never shuffle time series randomly.
5. Keep the held-out period untouched during rule development.
6. If event outcomes overlap, do not count them as independent. Use an uncertainty method that accounts for serial dependence and event clustering.
7. Use the actual observed spread at the simulated decision/execution time when available. Do not substitute a single average if spread varies materially.
8. Include entry and exit spread, commissions where applicable, slippage, stop-through/gap effects and financing where relevant.
9. Report gross and net results separately.

If the available historical source lacks bid/ask or tick-level data needed to model execution, label the result **screening-only**, not a strategy pass.

## 4. Experiment A: Range Break boundary-event study

### Hypothesis
A boundary touch on a specified Range Break variant contains information about the subsequent price path that is not explained by unconditional movement and is large enough to warrant a cost-aware strategy test.

### Freeze before testing
- Exact symbol and variant.
- A causal boundary-identification method using only past data.
- A boundary-touch definition, including minimum separation between touches and how repeated ticks at the same boundary are grouped.
- The forward observation horizons.
- A breakout definition and a fixed maximum adverse excursion window.
- Design and holdout dates.
- The cost model.

Do not assume that “breakout every approximately 100/200 touches” means each touch has a 1% breakout probability. That implication must be measured, not presumed.

### Primary measurements
For each eligible touch, record:
- Touch index under the frozen counting rule.
- Direction and distance of the next move.
- Maximum favourable excursion (MFE) and maximum adverse excursion (MAE) over each frozen horizon.
- Whether a breakout occurs, its timing, and its distance from the boundary.
- Realistic round-trip costs for a hypothetical execution at the decision time.
- Whether the proposed stop could be crossed before a normal exit.

Report conditional distributions by touch count, not just a single average. Include confidence intervals and dependence-aware uncertainty estimates.

### Control
Compare against matched non-touch timestamps or another preregistered baseline with similar recent volatility and time-in-sample. The control must be chosen before inspecting the outcome.

### Gate A1: event-study pass
Proceed to a trading-rule test only if the conditional price-path difference is reproducible in the design and holdout periods, has uncertainty bounds that support a non-zero effect, and is not an artefact of one short cluster or one exceptional event.

### Gate A2: trading-rule pass
A frozen entry/exit rule must then pass the net-return criteria in Section 1. Test the breakout-loss tail explicitly. A high bounce percentage alone is not a pass.

## 5. Experiment B: Drift Switch regime observability

### Hypothesis
A directional regime can be inferred from past broker prices early enough that the remaining directional move exceeds false-signal losses and trading costs.

### Stage B1: generator diagnostics
On each exact variant, measure:
- Return autocorrelation at prespecified lags.
- Distribution of regime durations, not only the mean.
- Directional return conditional on the state inferred by a causal detector.
- Change-point timing and detector recognition delay.
- Remaining absolute and signed movement after recognition.
- False switches, missed switches and time spent in the wrong state.

Use a simple baseline detector first. Do not optimise a large collection of lookbacks against the holdout. Any detector family or parameter grid counts toward the multiple-testing burden.

### Stage B2: causal detector test
Freeze the detector using the design period. In the holdout, evaluate how early it detects transitions and how much movement remains after recognition. Do not use future data to label the state available at a decision time.

### Stage B3: strategy test
Only if Stage B2 shows a reproducible remaining move should a trading rule be tested. Include a flat/no-trade state, execution costs, reversal costs and losses during regime transitions.

**A regime-classification score or a percentage of a move captured is not by itself a trading pass.** The final gate is positive net expectancy and the acceptance standard in Section 1.

## 6. Experiment C: Trek unconditional bias and tail behaviour

### Hypothesis
The specified Trek variant has a measurable directional or tail property that remains economically meaningful after Deriv costs.

### First test: no dip/rally filter
Measure, over preregistered horizons:
- Mean and median signed return.
- Positive/negative return frequency.
- Skewness and tail quantiles.
- Conditional expected shortfall.
- Frequency and size of large moves.
- Return after the cost of entering and exiting at the proposed horizon.

Do not infer direction solely from a description of skewed move sizes. Estimate the joint distribution of direction and size.

### Second test: conditional entries
Only if the unconditional test is insufficient and a separate pullback mechanism is specified should dip/rally filters be tested. They are a new hypothesis and must be separately preregistered.

## 7. Experiment D: Volatility Switch as a risk overlay

### Hypothesis
The regime label adds useful information beyond a simple rolling-volatility estimate and improves out-of-sample risk outcomes without merely reducing exposure or hiding losses.

Compare these prespecified variants:
1. Baseline strategy with a fixed, explicit risk policy.
2. Same entry logic with regime-conditioned stop distance.
3. Same entry logic with regime-conditioned sizing.
4. Combined stop and sizing overlay.

Use the same intended cash-risk budget in all comparable variants. Convert stop distance into cash risk using the actual contract value, account currency and minimum-volume constraints.

Report net expectancy, drawdown, tail loss, time in market, turnover, exposure and performance by regime. Include the incremental result against the baseline. A smoother equity curve alone is insufficient.

Do not assume that changing stops from 1 ATR to 3 ATR while leaving size unchanged preserves risk.

## 8. Experiment E: M15/H1 replication of large-move mean reversion

### Hypothesis
The previously observed weak M5 reversal after large hourly moves persists at a slower execution horizon and may become economically testable after costs.

This is **not** the same hypothesis as RSI(2) < 5 with an EMA(200) filter.

Freeze the original event definition and thresholds. Change only the execution horizon and the prespecified execution/cost model for the first replication. Report M15 and H1 separately.

Record:
- Number of independent events and degree of event overlap.
- Gross and net R.
- Confidence intervals with dependence handled.
- Spread, slippage, stop/target and time-exit outcomes.
- Results by instrument and chronological period.
- Whether one instrument, quarter or market episode dominates.

Only after this replication is complete should an RSI-based strategy be tested as a distinct hypothesis.

## 9. Statistical and multiple-testing controls

- Keep a complete registry of all hypotheses, parameter variants, failed tests and reasons for changes.
- Do not choose an “effective trial count” by guesswork. Correlated variants do not make selection bias disappear.
- Choose a multiple-testing method appropriate to the actual search procedure. Consider dependence-aware bootstrap/max-statistic methods, a reality-check-style procedure, or a Deflated Sharpe Ratio where its assumptions and inputs fit.
- Do not use the same holdout repeatedly to select rules. Repeated holdout inspection turns it into part of the design process.
- Report the number of events, trades, independent clusters and effective sample-size assumptions.
- Use confidence intervals and effect sizes, not only p-values or t-statistics.
- Keep quarterly/rolling-window results as diagnostics unless their acceptance role is preregistered.
- Do not require success in every spread quartile by default. Instead, test any spread filter as a causal, observable rule and account for its effect on trade frequency.

## 10. Cost-model rules

Do not infer financing charges from the bid/ask spread around rollover. Spread and financing are separate costs. Use verified broker terms or actual account-level charges.

For every simulated trade, distinguish:
- One-way spread from round-trip spread cost.
- Price units from account-currency P/L.
- Gross price movement from executable bid/ask movement.
- Planned stop loss from realised loss when price gaps or slips through the stop.
- Trading costs from overnight financing.

If actual historical spread data are unavailable, use conservative scenario ranges and label the test as provisional. A result that passes only under an optimistic cost assumption is not a pass.

## 11. Demo validation gate

A research pass permits a controlled demo test, not live deployment.

Log each signal and order with:
- Decision timestamp and available inputs.
- Requested and filled price, volume and direction.
- Spread, commission and slippage.
- Stop/target submission and confirmation.
- Rejections, partial fills, modifications and close reason.
- Realised P/L after all charges.
- Peak-to-trough drawdown and exposure.
- Any divergence between backtest assumptions and live demo behaviour.

Predefine a minimum demo evidence requirement based on expected trade frequency and uncertainty. Do not declare validation from a short streak of profitable trades.

## 12. Current disposition

| Item | Disposition |
|---|---|
| TTI/SMC/ICT continuation entries | Remain unvalidated/unsupported by the completed research; do not reopen through another confluence search without a genuinely new mechanism. |
| M5 large-move reversal | Research clue only; gross effect does not overcome the stated M5 cost estimate. |
| M15/H1 reversal replication | Separate, limited follow-up experiment. |
| Range Break | First synthetic family for generator/event diagnostics, not yet a fade strategy. |
| Drift Switch | Second synthetic family for causal regime-observability testing. |
| Trek | Measure unconditional direction and tail properties before conditional entries. |
| Volatility Switch | Risk-overlay experiment, not assumed alpha. |
| Jump | Do not revisit timing as a directional strategy without a new directional mechanism. |
| Existing index dip-buying and gold trend engines | Continue demo validation; do not treat historical performance as live validation. |

## 13. Required inputs before execution

This protocol does not claim to have run the experiments. To execute it, provide or connect:
- The relevant raw Deriv cTrader historical bars/quotes/ticks.
- Exact symbol names and contract specifications.
- Historical or representative spread data and financing terms.
- The current research scripts and their pinned versions.
- The frozen design/holdout dates and any prior result tables.

Once those inputs are available, run the data-integrity audit first. Do not start by optimising entries.
