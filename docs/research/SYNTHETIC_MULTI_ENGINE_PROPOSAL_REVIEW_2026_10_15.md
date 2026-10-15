# Review: External "Multi-Engine Synthetic Trading Bot" Proposal

Status: **research review — non-authoritative.** This document records an assessment of an externally supplied architecture proposal. It does not change product scope, architecture, risk policy or Gate status, and it is not evidence of any edge.
Date: 2026-10-15
Input: founder-supplied text titled *"Comprehensive Trading Bot Architecture Documentation — Multi-Engine System for Synthetic Indices & Volatility Markets"* (pasted into an AI session; not checked into the repository; no author or sources cited).
Linked issue: none yet.

## 1. Summary verdict

The proposal is **not adoptable as a Zugrio specification**. It conflicts with frozen Release 1 decisions in at least ten places (§3), contains several factual and internal-consistency errors (§4), and presents uncited win rates, Sharpe ratios and monthly returns as expectations.

Parts of it are **usable as research input** for Release 1 **Slice 4 (synthetic-family fixed bundle)**. Those parts are its insistence on per-family mechanics, cost/payout realism, walk-forward validation and overfitting red flags, plus some candidate diagnostics (§5). Even there, Zugrio's existing requirement is stricter. Under `ZR-STR-026`, any apparent edge must beat a **generator-matched null** after realistic costs. The proposal never applies that test, and it is the test most of its claimed edges would have to survive.

Recommendation: do not open implementation work from this proposal. If the founder wants to pursue any of it, take it into Slice 4 as the research plan in §6 and settle the decisions in §7 first.

## 2. What the proposal describes

- Five independent signal engines (Volatility, Boom/Crash, Jump, Step, Range Break), each with its own strategies.
- An orchestrator that allocates capital across engines, plus a global risk manager and kill switch.
- Execution through the Deriv WebSocket API using **binary/digital contracts** with fixed payouts (e.g. 95%) and tick/time expiries.
- An ML filter (XGBoost + logistic regression, 40 features, confidence > 0.55) placed in front of rule signals.
- A stack of Python/Rust, TimescaleDB, Redis, Prometheus/Grafana and Docker + Kubernetes, or "a single VPS near Deriv servers".
- Specific risk thresholds: 1–2% per trade, 3% engine daily loss, 5% portfolio daily loss, 15%/20% drawdown halts, 0.25 Kelly, and an anti-martingale ladder.
- Expected performance per engine: 54–60% win rate, PF 1.15–1.40, Sharpe 1.2–2.0, 3–8% monthly return.

## 3. Conflicts with frozen Zugrio decisions

Each item below must be resolved by the named decision owner. Engineering must not quietly adapt to it (`CLAUDE.md`: *"stop and surface the conflict"*).

| # | Proposal | Governing Zugrio position | Source |
|---|---|---|---|
| C1 | Five concurrent strategy engines, each generating signals | Release 1 is **Zugrio Core only**, with **one frozen TradeBundle per admitted scope**. Other families are in validation. | `V1_BUILD_CUT_AND_ARCHITECTURE_FREEZE.md` §2–3 |
| C2 | Regime-driven switching between entry styles inside an engine (fade vs. pullback vs. no-trade) | No Release 1 dynamic component routing. No mixing entries and exits across bundles. A `StrategyComponentPolicy` is V1-LG, behind a dedicated anti-overfitting policy. | Build cut §3, §7; Taxonomy §14 |
| C3 | Autonomous bot that places trades on its own | Release 1 control modes are **Signal and Semi-Auto only**. Auto and Full Auto are not Release 1. | Build cut §4 |
| C4 | Orchestrator allocates capital across engines that may trade the same instrument | One active strategy owns an account + symbol for capital action. Automated multi-strategy execution is blocked until netting/hedging-aware aggregation exists. | `ZR-STR-025`; Build cut §8 |
| C5 | Execution via Deriv API `buy` of binary/digital contracts with fixed payout and expiry | Execution goes through the Broker Adapter Contract, with **cTrader first** and MT5 later. Fixed-payout, expiry-bearing contracts are nonlinear-payoff products. Options are a **later specialist family** needing dedicated architecture. A Deriv-API venue would need a capability matrix (issue #21) and an ADR. | `STACK.md`; Build cut §9.1; `INITIAL_MARKET_AND_STRATEGY_PORTFOLIO.md` §2 |
| C6 | Python/Rust production services, TimescaleDB, Redis, Kubernetes | TypeScript production stack, PostgreSQL, **no Redis by default, no Kubernetes** until measured need. Python stays isolated in `research/`. | `STACK.md`; Charter §9 |
| C7 | Hard-coded capital thresholds (risk %, daily loss, drawdown halts, Kelly fraction, size ladder, ML cut-off 0.55/0.70) | Do not invent capital-authoritative thresholds. Account-risk-policy ownership is an open pre-implementation gate. | `CLAUDE.md`; Build cut §11 |
| C8 | ML confidence gates live trades | Production inference needs an immutable `ModelApplicabilityManifest`. Without a match there is no admitted inference. Research models stay physically separate from capital authority. | ADR-0001; `SYSTEM_ARCHITECTURE_V1.md` §4 |
| C9 | Engines own their own risk, kill switch and execution router | Risk, veto, order construction and broker adapters are capital-critical surfaces governed by the frozen Signal Authority Architecture. Gate 3 is not cleared and Gate 4 is not authorized. | `CURRENT-GATE.md`; Charter §4 |
| C10 | Published expected win rate, Sharpe and monthly return | Unvalidated win-rate or return claims must not be published. Fabricated measurements are prohibited. These figures must not appear in product, marketing or investor material. | `PUBLIC_BUILD_POLICY.md`; `AI_COLLABORATION.md` |
| C11 | "Single VPS near Deriv servers" for latency | Zugrio avoids owning per-customer execution infrastructure by default. Any Zugrio-hosted always-on execution host needs an ADR. | Charter §6 |

### Points of agreement

The proposal agrees with Zugrio in these places:

- Per-family specialization, so no universal synthetic model. This matches ADR-0001 and the legacy families (event-hazard, distribution, range-break, drift-switch, volatility).
- Costs and payout asymmetry belong inside the evidence.
- Walk-forward, out-of-sample validation, never a random split.
- No martingale, and trading wins and losses that are distinguishable from process adherence.
- Kill switches and halts exist. Their **thresholds** remain a policy-owner decision (C7).

## 4. Factual and internal-consistency problems

Facts about the products below come from Deriv's public pages as of 2026-10-15. Deriv itself notes that its pages may not reflect current contract specifications, so they must be re-verified against live specs before any research relies on them.

### 4.1 The central problem: a fair generator has no directional edge to find

The proposal describes V-indices as GBM-like with a target volatility, Step indices as balanced-probability steps, and Boom/Crash spike timing as memoryless. If increments really are independent draws from a stated process, past prices carry **no information** about the sign of the next increment. Every directional rule then has an expected hit rate of about 50% before payout or spread, and is negative after it.

So the proposal's claimed edges (RSI fades, Bollinger fades, post-spike reversal, multi-tick momentum, GARCH clustering) can only be real if the generator **deviates from its documented process** in an exploitable way. The proposal asserts such deviations ("research on Deriv V-indices shows…") without citation. This is exactly what `ZR-STR-026` requires Zugrio to test, not assume.

A related point: on Deriv synthetics the broker designs the generator and is also the counterparty. That raises the evidential bar. It does not lower it.

### 4.2 Specific errors

| Claim in proposal | Problem |
|---|---|
| §1.2.1: σ = 1% for V10, 10% for V100. §1.2.3: V10 ≈ 10%, V100 ≈ 100%. | The two sections contradict each other. Deriv names V-indices by their volatility level, which matches §1.2.3. |
| §1.2.3 per-tick vol table (e.g. V75 ≈ 0.0045%) | Assuming constant annualized σ and a 365-day year, per-tick σ = σ_ann × √(Δt / 31,536,000). For V75 that gives ≈ **0.0189%** per 2 s tick, or ≈ 0.0134% per 1 s tick. The table is too low by roughly 3–4×. Standard V-indices tick every 2 s, and "(1s)" variants tick every 1 s. |
| §1.2.2: GARCH α+β ≈ 0.95–0.98 and fat tails on V-indices | This contradicts a constant-volatility generator. It is uncited and must be treated as a hypothesis to test against the null. |
| §1.3.1: "~3% of ticks are large spikes" vs. "spike probability ≈ 1/500–1/1500" | These are inconsistent: 3% is about 1 in 33. The index name (Boom 500, Boom 1000) refers to the average spike frequency. |
| §1.3.3 says spike timing is geometric/memoryless. §3.2.2 Spike Anticipation enters "because hazard rate increases" after 1.5× the mean wait. | A geometric distribution has a **constant** hazard. The SA strategy is the gambler's fallacy the proposal itself warns against. |
| §3.2.4: Step indices are "mean-reverting to barriers" with "regime-switching barrier behavior" | Deriv describes Step indices as fixed-size steps with **balanced up/down probability**, which is a symmetric random walk. Barrier/range behaviour describes **Range Break** indices: price bounces inside a range and breaks out after an average of 100 or 200 boundary hits. |
| §2.1.1 "Session-based momentum — time-of-day liquidity"; §7.1 "include Asian, London, NY sessions"; §12.2 "V75 most liquid" | Synthetic generators have no order flow, sessions or liquidity, as the proposal states in §1.1.1. Session effects are a hypothesis, not a mechanism. |
| Binary-contract execution (fixed payout, fixed expiry) combined with ATR take-profit/stop-loss, trailing stops and "never trade without a stop" | These belong to different products. A fixed-expiry binary has no stop, TP or trail. Those are CFD/position concepts. The design mixes payoffs. |
| §2.1.3 requires "average win ≥ average loss × 1.05" for scalping to be viable | On a binary with payout ≤ 100%, average win ≤ average loss by construction. By the proposal's own rule, binary scalping is never viable. |
| §4.2 Kelly example uses b = 1.0 ("even payout") | At a 95% payout, b = 0.95. With p = 0.56, f* = (0.56·0.95 − 0.44)/0.95 ≈ 9.7%, and quarter-Kelly ≈ 2.4%, not 3%. Either figure also breaks the proposal's own 1% per-trade rule (§4.1), as does §9.1's 1.5% size when ML confidence > 0.70. |
| §2.1.1 / §10.2 performance figures | No sources are given. These are not evidence (C10). |

## 5. What is worth keeping as research input

These items are worth keeping, but only as Slice 4 research hypotheses or diagnostics. None of them is a production rule.

1. **Generator-conformance diagnostics.** These come before any strategy work and directly serve `ZR-STR-026`:
   - V/Step: are increments i.i.d. with the stated distribution and σ? Use variance-ratio, runs and autocorrelation tests at several lags, and check whether the tails match.
   - Boom/Crash: are inter-spike intervals geometric with the stated mean (goodness-of-fit, constant empirical hazard)? Is there a post-spike drift?
   - Jump: realized vs. bipower variation (RV/BV), jump intensity and jump-size symmetry.
   - Range Break: is the break frequency per boundary hit consistent with the stated 100/200 average?
2. **Cost/payout realism.** The breakeven arithmetic (e.g. 51.28% at a 95% payout) shows correctly why small apparent edges vanish. Zugrio's route-specific cost/fill model covers this for the CFD route.
3. **Overfitting red flags.** The suspiciously high win rates, few trades and day-tuned parameters the proposal flags are reasonable screening heuristics. They are not admission thresholds.
4. **Feature candidates.** Ticks-since-spike, hazard estimates, RV/BV and realized-volatility ratios are candidates for a versioned `featureSchemaId` under a family-scoped manifest, if research justifies them.

## 6. Suggested research path (Slice 4 only, non-capital)

1. Pick **one** synthetic family/instrument based on legacy lineage and available data, as the build cut requires. The proposal's "start with V75" is the weakest candidate for a directional edge, because it is the product closest to a pure constant-volatility martingale.
2. Run the §5.1 conformance diagnostics on point-in-time tick data. Record the generator parameters and how uncertain they are.
3. Build the generator-matched null simulator for that family.
4. Freeze one Core TradeBundle for that scope. Apply identical selection, execution and cost rules to the real series and to the null.
5. Report the result as bundle-level evidence. If the bundle does not beat the null after costs, the outcome is **PASS**, and that is a valid result.

All of this lives under `research/` (Python) and creates no production authority.

## 7. Decisions needed from the founder / decision owners

1. **Product type:** are Deriv binary/digital (fixed-payout, expiry) contracts in scope at all? The current architecture assumes CFD-style positions via cTrader/MT5. Adding binaries brings in the nonlinear-payoff family and needs an ADR plus a regulatory review, since retail binary-option availability differs by jurisdiction.
2. **Venue:** for synthetics, is the intended route Deriv via cTrader/MT5 (inside the current adapter plan) or the Deriv WebSocket API (a new adapter and capability matrix under #21)?
3. **Slice 4 family:** which synthetic family/instrument has the strongest legacy evidence and data?
4. **Risk policy ownership** (Build cut §11): who sets daily-loss, drawdown and sizing limits? This review deliberately does not propose numbers.

## 8. Sources

- Deriv, *Step Indices*: https://deriv.com/derived-indices/step-indices
- Deriv, *Synthetic Indices* (V-index tick intervals, Range Break definition): https://deriv.com/markets/derived-indices/synthetic-indices
- Deriv Academy, *Volatility Indices explained*: https://deriv.com/ae/academy/trading-guides/volatility-indices-mt5-cfds
- Boom/Crash average spike frequency and Jump-index jump rate were **not** confirmed in this review. Verify them against live Deriv contract specifications.
