import json

import numpy as np
import pytest

from conftest import make_series
from synthnull.backtest import CostModel, run_trades
from synthnull.nulls import documented_sigma_per_tick, fit, permute_mid, simulate_mid
from synthnull.predeclare import Predeclaration, PredeclarationViolation
from synthnull.signals import bollinger_fade, default_battery, momentum, rsi_fade
from synthnull.stats import benjamini_hochberg, holm, null_p_value


# --- execution / costs -------------------------------------------------------------------------


def test_long_and_short_pay_spread_and_slippage():
    ts = make_series(np.full(10, 100.0), spread=0.2)
    sig = np.zeros(10, np.int8)
    sig[0] = 1
    sig[5] = -1
    tr = run_trades(ts, sig, hold_ticks=2, cost=CostModel(slippage=0.05, entry_delay_ticks=1))
    # flat mid: each trade loses full spread + 2 * slippage, relative to its own entry price
    np.testing.assert_allclose(tr, [-(0.2 + 0.1) / 100.15, -(0.2 + 0.1) / 99.85])


def test_one_position_at_a_time_and_entry_delay():
    mid = np.arange(100.0, 120.0)
    sig = np.ones(20, np.int8)
    tr = run_trades(make_series(mid), sig, hold_ticks=3, cost=CostModel(entry_delay_ticks=1))
    # decide at t=0 -> enter t=1 -> exit t=4; next decision at t=4, ... ; a trade ending past the data is dropped
    assert len(tr) == 4
    np.testing.assert_allclose(tr[0], 3 / 101)


def test_swap_charged_per_rollover():
    t = np.array([0, 1, 2, 3], np.int64) * 43_200_000 + 1_700_006_400_000  # 12h ticks
    from synthnull.data import TickSeries

    ts = TickSeries("X", "s", t, np.full(4, 100.0), np.full(4, 100.0))
    sig = np.array([1, 0, 0, 0], np.int8)
    tr = run_trades(ts, sig, 2, CostModel(swap_long_frac=0.001))
    rollovers = int(t[3] // 86_400_000 - t[1] // 86_400_000)
    np.testing.assert_allclose(tr, [-0.001 * rollovers])


def test_no_look_ahead_in_battery():
    """Truncation test: decision at t is identical whether or not later ticks exist."""
    rng = np.random.default_rng(1)
    mid = 1000 * np.exp(np.cumsum(rng.normal(0, 1e-3, 6000)))
    ts = make_series(mid)
    p = fit("boom", mid)
    signals = {**default_battery("boom", p), "bb": (bollinger_fade(), 1), "rsi": (rsi_fade(), 1)}
    for name, (sig, _) in signals.items():
        full = sig(ts)
        for cut in rng.integers(200, 6000, 25):
            part = sig(ts.slice(0, int(cut)))
            np.testing.assert_array_equal(part[: cut - 1], full[: cut - 1], err_msg=name)


# --- nulls -------------------------------------------------------------------------------------


def test_documented_sigma():
    assert documented_sigma_per_tick(0.75, 2) == pytest.approx(0.75 * np.sqrt(2 / 31_536_000))


@pytest.mark.parametrize("family", ["volatility", "boom", "crash", "jump", "step"])
def test_fit_recovers_simulated_parameters(family):
    rng = np.random.default_rng(2)
    if family == "step":
        truth = fit("step", 100 + np.cumsum(np.concatenate([[0], rng.choice([-0.1, 0.1], 50_000)])))
    else:
        mid = 1000 * np.exp(np.cumsum(rng.normal(-1e-6, 2e-4, 200_000)))
        truth = fit(family, mid)
        if family in ("boom", "crash", "jump"):
            sign = {"boom": 1, "crash": -1, "jump": 1}[family]
            from dataclasses import replace

            truth = replace(truth, event_prob=1 / 500, event_sizes=sign * np.full(50, 40 * 2e-4))
    sim = simulate_mid(truth, 1000.0 if family != "step" else 100.0, 200_000, rng)
    est = fit(family, sim)
    if family == "step":
        assert est.step == pytest.approx(0.1) and est.p_up == pytest.approx(0.5, abs=0.01)
    else:
        assert est.sigma == pytest.approx(truth.sigma, rel=0.02)
    if family in ("boom", "crash", "jump"):
        assert est.event_prob == pytest.approx(1 / 500, rel=0.15)


@pytest.mark.parametrize("family", ["volatility", "boom", "crash", "jump", "step"])
def test_permutation_preserves_increment_multiset(family):
    rng = np.random.default_rng(3)
    p0 = fit("volatility", 1000 * np.exp(np.cumsum(rng.normal(0, 2e-4, 5000))))
    from dataclasses import replace

    if family == "step":
        p = fit("step", 100 + np.cumsum(np.concatenate([[0], rng.choice([-0.1, 0.1], 5000)])))
        mid = simulate_mid(p, 100.0, 5000, rng)
        inc = np.diff
    else:
        sign = -1 if family == "crash" else 1
        p = replace(p0, family=family, event_prob=0.01, event_sizes=sign * np.full(5, 50 * 2e-4))
        mid = simulate_mid(p, 1000.0, 5000, rng)
        p = fit(family, mid)
        inc = lambda m: np.diff(np.log(m))  # noqa: E731
    perm = permute_mid(family, mid, p, rng)
    assert len(perm) == len(mid)
    np.testing.assert_allclose(np.sort(inc(perm)), np.sort(inc(mid)), atol=1e-9)


# --- stats -------------------------------------------------------------------------------------


def test_null_p_value():
    assert null_p_value(5.0, np.arange(99.0))[0] == pytest.approx(95 / 100)
    assert null_p_value(1000.0, np.arange(99.0))[0] == pytest.approx(1 / 100)
    assert null_p_value(float("nan"), np.arange(9.0))[0] == 1.0
    assert null_p_value(1.0, np.array([np.nan, 0.0, 2.0]))[1] == 2


def test_corrections_against_reference_values():
    p = np.array([0.01, 0.04, 0.03, 0.005])
    np.testing.assert_allclose(holm(p), [0.03, 0.06, 0.06, 0.02])
    np.testing.assert_allclose(benjamini_hochberg(p), [0.02, 0.04, 0.04, 0.02])


# --- predeclaration lock -----------------------------------------------------------------------

PRE = {
    "signals": ["momentum_5"],
    "windows": {"calibration": [0, 10], "test": [10, 20], "holdout": [20, 30]},
    "cost_model": {},
    "correction": "holm",
    "alpha": 0.05,
    "n_null": 999,
    "seed": 1,
}


def test_predeclaration_locks_on_first_protected_read(tmp_path):
    f = tmp_path / "pre.json"
    f.write_text(json.dumps(PRE))
    Predeclaration.load(f).open_window("calibration")
    assert not Predeclaration.load(f).lock_path.exists()  # calibration does not lock
    Predeclaration.load(f).open_window("test")
    Predeclaration.load(f).open_window("holdout")  # unchanged: fine
    f.write_text(json.dumps({**PRE, "alpha": 0.1}))
    with pytest.raises(PredeclarationViolation):
        Predeclaration.load(f).open_window("holdout")
    Predeclaration.load(f).open_window("calibration")  # calibration stays readable


def test_predeclaration_requires_keys(tmp_path):
    f = tmp_path / "pre.json"
    f.write_text(json.dumps({"signals": []}))
    with pytest.raises(PredeclarationViolation):
        Predeclaration.load(f)


def test_momentum_sign():
    ts = make_series(np.array([1.0, 2.0, 3.0, 2.0, 1.0]))
    np.testing.assert_array_equal(momentum(1)(ts), [0, 1, 1, -1, -1])
