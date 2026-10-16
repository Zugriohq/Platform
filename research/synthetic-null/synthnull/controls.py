"""Harness controls required by #118 before any real-data result is trusted.

* negative control — "real" series drawn from the null itself: false-positive rate must be <= alpha;
* positive control — AR(1) dependence injected at known strength: detection rate vs. phi (power curve);
* spike-structure control — Boom-generator data rejects a GBM null but not the generator-matched null.

All series here are simulated by design. Controls use zero trading costs so they measure the test's
statistical behaviour, not cost drag.
"""

from __future__ import annotations

import numpy as np
from scipy import stats as sps

from .backtest import CostModel
from .data import TickSeries
from .harness import build_nulls
from .nulls import NullParams, fit, simulate_mid
from .signals import momentum, reversal
from .stage_b import run_stage_b

TICK_MS = 2000
SIGMA = 2e-4  # per-tick log vol of the control generator
ZERO_COST = CostModel()


def series(mid: np.ndarray) -> TickSeries:
    t = np.arange(len(mid), dtype=np.int64) * TICK_MS + 1_700_000_000_000
    return TickSeries("CONTROL", "sim", t, mid, mid.copy())


def ar1_mid(phi: float, n: int, rng: np.random.Generator) -> np.ndarray:
    e = rng.normal(0, SIGMA * np.sqrt(1 - phi**2), n)
    r = np.empty(n)
    r[0] = e[0]
    for i in range(1, n):
        r[i] = phi * r[i - 1] + e[i]
    return 1000 * np.exp(np.concatenate([[0], np.cumsum(r)]))


def boom_params() -> NullParams:
    """Boom-like generator: negative drift between spikes, spikes ~40 sigma, p = 1/500."""
    return NullParams(
        "boom",
        mu=-SIGMA * 0.08,
        sigma=SIGMA,
        event_prob=1 / 500,
        event_sizes=np.full(1, 40 * SIGMA),
        event_threshold_z=8.0,
    )


CONTROL_BATTERY = {"momentum_5": (momentum(5), 5), "reversal_5": (reversal(5), 5)}


def _rejections(calib_mid, test_mid, family, n_null, seed, alpha) -> dict[str, bool]:
    frozen = fit(family, calib_mid)
    test = series(test_mid)
    res = run_stage_b(test, build_nulls(family, frozen, test), CONTROL_BATTERY, ZERO_COST, n_null, seed)
    return {f"{r.name}|{r.null_kind}": r.p <= alpha for r in res.results}


def negative_control(runs: int, n_ticks: int, n_null: int, alpha: float = 0.05, seed: int = 0) -> dict:
    """Per-test false-positive rate (uncorrected) with the 95% Clopper-Pearson interval."""
    counts: dict[str, int] = {}
    for i in range(runs):
        rng = np.random.default_rng([seed, i])
        mid = ar1_mid(0.0, 2 * n_ticks, rng)
        for key, rej in _rejections(mid[:n_ticks], mid[n_ticks:], "volatility", n_null, seed + i, alpha).items():
            counts[key] = counts.get(key, 0) + int(rej)
    out = {}
    for key, k in counts.items():
        ci = sps.binomtest(k, runs).proportion_ci(0.95)
        out[key] = {"rejections": k, "runs": runs, "rate": k / runs, "ci95": (ci.low, ci.high)}
    return {"alpha": alpha, "n_ticks": n_ticks, "n_null": n_null, "tests": out}


def positive_control(
    phis: tuple[float, ...], runs: int, n_ticks: int, n_null: int, alpha: float = 0.05, seed: int = 0
) -> dict:
    """Detection rate of momentum_5 vs. phi, under the fitted-GBM and permutation nulls."""
    curve = {}
    for phi in phis:
        hits: dict[str, int] = {}
        for i in range(runs):
            rng = np.random.default_rng([seed, i, int(phi * 1e6)])
            mid = ar1_mid(phi, 2 * n_ticks, rng)
            rej = _rejections(mid[:n_ticks], mid[n_ticks:], "volatility", n_null, seed + i, alpha)
            for key, r in rej.items():
                if key.startswith("momentum_5|"):
                    hits[key.split("|")[1]] = hits.get(key.split("|")[1], 0) + int(r)
        curve[phi] = {k: v / runs for k, v in hits.items()}
    return {"alpha": alpha, "n_ticks": n_ticks, "n_null": n_null, "runs": runs, "detection_rate": curve}


def excess_kurtosis(ts: TickSeries) -> float:
    return float(sps.kurtosis(np.diff(np.log(ts.mid))))


def spike_structure_control(n_ticks: int, n_null: int, seed: int = 0) -> dict:
    """p-values of an excess-kurtosis statistic on Boom-generator data under a GBM null vs. the Boom null."""
    rng = np.random.default_rng(seed)
    gen = boom_params()
    mid = simulate_mid(gen, 1000.0, 2 * n_ticks, rng)
    calib, test = mid[: n_ticks + 1], series(mid[n_ticks:])
    real = excess_kurtosis(test)
    out = {}
    for label, family in (("gbm_null", "volatility"), ("boom_matched_null", "boom")):
        frozen = fit(family, calib)
        factory = build_nulls(family, frozen, test)["parametric_fitted"]
        seeds = np.random.SeedSequence([seed, len(label)]).spawn(n_null)
        null = np.array([excess_kurtosis(factory(np.random.default_rng(s))) for s in seeds])
        # two-sided: the statistic can be off in either direction under a misspecified null
        p_hi = (1 + np.sum(null >= real)) / (n_null + 1)
        p_lo = (1 + np.sum(null <= real)) / (n_null + 1)
        out[label] = {"real": real, "null_median": float(np.median(null)), "p_two_sided": float(min(1, 2 * min(p_hi, p_lo)))}
    return out
