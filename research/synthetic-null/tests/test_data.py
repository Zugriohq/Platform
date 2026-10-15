import json

import numpy as np
import pytest

from synthnull.data import TickSeries, load_deriv_ticks, load_mt5_ticks, manifest
from synthnull.feed_check import feed_check

MT5 = (
    "<DATE>\t<TIME>\t<BID>\t<ASK>\t<LAST>\t<VOLUME>\t<FLAGS>\n"
    "2026.10.01\t00:00:00.000\t100.00\t\t\t\t2\n"  # ask unknown yet -> dropped
    "2026.10.01\t00:00:01.000\t\t100.10\t\t\t4\n"
    "2026.10.01\t00:00:02.000\t100.05\t\t\t\t2\n"  # ask forward-filled
    "2026.10.01\t00:00:02.000\t100.06\t100.16\t\t\t6\n"  # same ms -> last wins
    "2026.10.01\t00:00:03.500\t100.02\t100.12\t\t\t6\n"
)


def test_mt5_loader_forward_fills_and_dedupes(tmp_path):
    p = tmp_path / "x.csv"
    p.write_text(MT5)
    ts = load_mt5_ticks(p, "R_75")
    assert len(ts) == 3
    np.testing.assert_allclose(ts.bid, [100.00, 100.06, 100.02])
    np.testing.assert_allclose(ts.ask, [100.10, 100.16, 100.12])
    assert ts.t_ms[1] - ts.t_ms[0] == 1000


def test_mt5_loader_reads_utf16(tmp_path):
    p = tmp_path / "x.csv"
    p.write_bytes(MT5.encode("utf-16"))
    assert len(load_mt5_ticks(p, "R_75")) == 3


def test_rejects_non_mt5(tmp_path):
    p = tmp_path / "x.csv"
    p.write_text("a,b\n1,2\n")
    with pytest.raises(ValueError):
        load_mt5_ticks(p, "R_75")


def test_dataset_id_is_content_based(tmp_path):
    a = tmp_path / "a.csv"
    b = tmp_path / "b.csv"
    a.write_text(MT5)
    b.write_text(MT5.replace("100.02", "100.020"))  # same values, different text
    assert load_mt5_ticks(a, "R_75").dataset_id() == load_mt5_ticks(b, "R_75").dataset_id()
    b.write_text(MT5.replace("100.02", "100.03"))
    assert load_mt5_ticks(a, "R_75").dataset_id() != load_mt5_ticks(b, "R_75").dataset_id()


def test_series_invariants():
    with pytest.raises(ValueError):
        TickSeries("X", "s", np.array([2, 1]), np.ones(2), np.ones(2))
    with pytest.raises(ValueError):
        TickSeries("X", "s", np.array([1, 2]), np.ones(2), np.zeros(2))


def test_manifest_reports_gaps(tmp_path):
    p = tmp_path / "x.csv"
    p.write_text(MT5)
    m = manifest(load_mt5_ticks(p, "R_75"), str(p))
    assert m["n_ticks"] == 3 and m["gaps"]["n_intervals"] == 2


def _deriv_file(tmp_path, quotes):
    p = tmp_path / "d.jsonl"
    p.write_text("".join(json.dumps({"epoch": 1_759_276_800 + i, "quote": q}) + "\n" for i, q in enumerate(quotes)))
    return p


def test_feed_check_passes_on_same_feed_and_fails_on_different(tmp_path):
    rng = np.random.default_rng(0)
    q = np.round(1000 + np.cumsum(rng.choice([-0.01, 0.01], 12_000)), 2)
    t = (1_759_276_800 + np.arange(len(q))) * 1000
    mt5 = TickSeries("R", "mt5", t.astype(np.int64), q - 0.05, q + 0.05)  # mid == spot
    same = load_deriv_ticks(_deriv_file(tmp_path, q.tolist()), "R")
    assert feed_check(mt5, same)["passed"]
    other = np.round(1000 + np.cumsum(rng.choice([-0.01, 0.01], 12_000)), 2)
    assert not feed_check(mt5, load_deriv_ticks(_deriv_file(tmp_path, other.tolist()), "R"))["passed"]


def test_feed_check_needs_enough_overlap(tmp_path):
    q = [100.0 + 0.01 * i for i in range(100)]
    d = load_deriv_ticks(_deriv_file(tmp_path, q), "R")
    assert not feed_check(d, d)["passed"]
