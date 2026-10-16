# Synthetic generator-matched null harness (#118)

Research code. It holds **no production authority**: nothing here admits a strategy, sizes a position or touches a broker (`STACK.md`, ADR-0001). The harness implements `ZR-STR-026` / Taxonomy §17.

> Does a predeclared signal beat what the stated generating process produces by chance, under identical execution and costs, **and** make money after costs? If not, there is no edge, and the outcome is PASS.

Fixed inputs (PR #117 §0):
- **D1:** CFD-only, so costs are spread, commission, swap and slippage, with no payout model.
- **D2:** routing is cTrader/MT5.
- **D4:** there are no risk-sizing values anywhere in this harness.

Data source: see [DATA_SOURCE.md](DATA_SOURCE.md).

## Layout

| Module | Role |
|---|---|
| `synthnull/data.py` | `TickSeries`, MT5 export and Deriv JSONL loaders, content-hash `dataset_id`, manifest/gap report |
| `synthnull/feed_check.py` | Checks that a secondary feed is the same generator as the MT5 primary |
| `synthnull/nulls.py` | Per-family parametric nulls (fitted or documented) and permutation nulls |
| `synthnull/backtest.py` | **The only** trade P&L path, shared by real and null series |
| `synthnull/signals.py` | Predeclared Stage B battery (family selection only; not a TradeBundle) |
| `synthnull/stage_a.py` | Generator-conformance tests |
| `synthnull/stage_b.py` | Real vs. N null paths, p-values, correction, edge rule |
| `synthnull/predeclare.py` | Predeclaration hash lock |
| `synthnull/harness.py` | calibrate → Stage A → Stage B (test) → holdout |
| `synthnull/controls.py` | Negative, positive (power curve) and spike-structure controls |

## Families

| Family | Parametric null | Permutation null |
|---|---|---|
| Volatility | GBM, constant σ | permute log increments |
| Boom / Crash | Gaussian between spikes, plus Bernoulli(p) spikes with resampled sizes | keep between-spike increments in order; shuffle spike sizes and gaps |
| Jump | GBM plus Bernoulli(λ) symmetric jumps | permute log increments |
| Step | ±step, p_up | permute increments |
| Range Break | **not implemented** (needs a range-bounce process; permutation is invalid) | — |

Events (spikes/jumps) are classified by a robust-z threshold (`event_threshold_z`, default 8). It is fitted on the calibration window and then frozen for both the test and holdout windows.

## Decision rule

A signal is an **edge candidate** only if, under **every** null it was tested against, it meets both conditions:
1. its corrected p-value is ≤ α (Holm or BH across all signals × nulls); and
2. the 95% CI of its net expectancy per trade is entirely above zero.

A candidate counts as confirmed only if it replicates on the untouched holdout window. Families are ranked for D3 by holdout-confirmed expectancy. If nothing is confirmed, the outcome is **PASS**.

## Running

```bash
pip install -r requirements.txt
python -m pytest -q tests                      # ~1-2 min, includes reduced controls
python scripts/run_controls.py evidence/controls.json   # full-size controls, several minutes

python -m synthnull.data manifest data/BOOM1000.csv "Boom 1000 Index"
cp predeclaration.template.json predeclaration.json     # set costs per symbol, commit, then run:
python scripts/run_family.py predeclaration.json data/BOOM1000.csv "Boom 1000 Index" boom evidence/BOOM1000.json \
    --documented event_prob=0.001
```

## Known limitations

- **Power at short lags is low.** With a one-tick entry delay and a 5-tick hold, an AR(1) dependence of φ ≈ 0.3 is close to invisible over a few thousand ticks: the signal only captures (φ² + … + φ⁶)·r_t. The full positive-control curve in `evidence/controls.json` shows how strong a deviation must be before it can be seen. A PASS therefore means "no edge this harness can detect at this sample size and delay", not "proven fair".
- **Swap rollover** is taken at 00:00 in the timestamps' clock. The MT5 server time zone must be confirmed on the first export (DATA_SOURCE.md, open item 1).
- **Documented parameters are unverified.** σ from the index name (365-day year), Boom/Crash p = 1/N from the name, and Jump λ are all unconfirmed. Reports carry both fitted and documented nulls. A conclusion that flips between them is reported as generator uncertainty.
