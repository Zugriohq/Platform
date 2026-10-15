"""Reduced-size versions of the #118 controls. Full-size runs: scripts/run_controls.py."""

import json
from dataclasses import asdict

import numpy as np
import pytest

import synthnull.stage_b as stage_b_mod
from conftest import make_series
from synthnull import controls
from synthnull.backtest import CostModel
from synthnull.harness import build_nulls
from synthnull.nulls import fit, simulate_mid
from synthnull.signals import default_battery


def test_negative_control_false_positive_rate():
    res = controls.negative_control(runs=60, n_ticks=3000, n_null=49, seed=11)
    for key, r in res["tests"].items():
        # observed rate must be consistent with <= alpha: alpha inside or above its CI
        assert r["ci95"][0] <= res["alpha"], (key, r)


def test_positive_control_detects_strong_dependence():
    # With a 1-tick entry delay and 5-tick hold, momentum_5 captures only (phi^2 + ... + phi^6) * r_t,
    # so weak dependence (phi ~ 0.3) is nearly undetectable at this sample size; that is reported by the
    # full power curve (scripts/run_controls.py). Here we only assert the harness can see strong dependence.
    res = controls.positive_control(phis=(0.0, 0.8), runs=20, n_ticks=3000, n_null=49, seed=5)
    strong = res["detection_rate"][0.8]
    none = res["detection_rate"][0.0]
    for null_kind in ("parametric_fitted", "permutation"):
        assert strong[null_kind] >= 0.8, res
        assert none[null_kind] <= 0.25, res


def test_spike_structure_control():
    res = controls.spike_structure_control(n_ticks=20_000, n_null=99, seed=3)
    assert res["gbm_null"]["p_two_sided"] <= 0.02, res  # documented mechanics "look like" signal vs GBM
    assert res["boom_matched_null"]["p_two_sided"] > 0.05, res  # ...but not vs the generator-matched null


def test_boom_post_spike_reversal_not_rejected_by_matched_null():
    """Stage B on Boom-generator data: the matched null should rarely reject a spike-based signal."""
    rejections = 0
    runs = 20
    for i in range(runs):
        rng = np.random.default_rng([7, i])
        mid = simulate_mid(controls.boom_params(), 1000.0, 20_000, rng)
        frozen = fit("boom", mid[:10_001])
        test = make_series(mid[10_000:])
        battery = {k: v for k, v in default_battery("boom", frozen).items() if k.startswith("post_spike")}
        res = stage_b_mod.run_stage_b(test, build_nulls("boom", frozen, test), battery, CostModel(), 49, i)
        rejections += any(r.p <= 0.05 for r in res.results if r.null_kind == "parametric_fitted")
    assert rejections <= 5  # 2 correlated tests/run; generous bound on a ~0.1 nominal rate


def test_cost_symmetry_single_code_path(monkeypatch):
    """Every trade, real or null, goes through backtest.run_trades with the same cost model."""
    calls = []
    real_run_trades = stage_b_mod.run_trades

    def spy(ts, direction, hold, cost):
        calls.append((ts.source, cost))
        return real_run_trades(ts, direction, hold, cost)

    monkeypatch.setattr(stage_b_mod, "run_trades", spy)
    rng = np.random.default_rng(0)
    mid = 1000 * np.exp(np.cumsum(rng.normal(0, 2e-4, 2000)))
    test = make_series(mid, spread=0.01)
    cost = CostModel(slippage=0.001, commission_frac=1e-5)
    nulls = build_nulls("volatility", fit("volatility", mid), test)
    battery = dict(list(controls.CONTROL_BATTERY.items()))
    stage_b_mod.run_stage_b(test, nulls, battery, cost, n_null=7, seed=1)
    real_calls = [c for c in calls if c[0] == "sim"]
    null_calls = [c for c in calls if c[0] == "sim+null"]
    assert len(real_calls) == len(battery)
    assert len(null_calls) == 7 * len(battery) * len(nulls)
    assert all(c[1] is cost for c in calls)


def test_null_series_keep_real_timestamps_and_spreads():
    rng = np.random.default_rng(0)
    mid = 1000 * np.exp(np.cumsum(rng.normal(0, 2e-4, 500)))
    test = make_series(mid, spread=0.03)
    for factory in build_nulls("volatility", fit("volatility", mid), test).values():
        null = factory(rng)
        np.testing.assert_array_equal(null.t_ms, test.t_ms)
        np.testing.assert_allclose(null.spread, test.spread)


def test_determinism():
    def once():
        rng = np.random.default_rng(42)
        mid = 1000 * np.exp(np.cumsum(rng.normal(0, 2e-4, 3000)))
        test = make_series(mid)
        res = stage_b_mod.run_stage_b(
            test, build_nulls("volatility", fit("volatility", mid), test), controls.CONTROL_BATTERY, CostModel(), 19, 9
        )
        return json.dumps([asdict(r) for r in res.results], sort_keys=True).encode()

    assert once() == once()


@pytest.mark.parametrize("family", ["boom", "crash", "jump", "step", "volatility"])
def test_build_nulls_for_every_family(family):
    rng = np.random.default_rng(1)
    if family == "step":
        mid = 100 + np.cumsum(np.concatenate([[0], rng.choice([-0.1, 0.1], 3000)]))
    else:
        p = controls.boom_params()
        from dataclasses import replace

        if family == "crash":
            p = replace(p, family="crash", mu=-p.mu, event_sizes=-p.event_sizes)
        elif family in ("jump", "volatility"):
            p = replace(p, family=family, mu=0.0, event_prob=0.0 if family == "volatility" else p.event_prob)
        mid = simulate_mid(p, 1000.0, 3000, rng)
    test = make_series(mid)
    nulls = build_nulls(family, fit(family, mid), test)
    assert set(nulls) == {"parametric_fitted", "permutation"}
    for f in nulls.values():
        assert len(f(rng)) == len(test)
