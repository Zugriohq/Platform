"""End-to-end smoke test: simulated MT5 export -> run_family -> evidence record."""

import json
from datetime import datetime, timezone

import numpy as np

from synthnull import controls
from synthnull.data import load_mt5_ticks
from synthnull.harness import run_family
from synthnull.nulls import simulate_mid
from synthnull.predeclare import Predeclaration


def _write_mt5(path, mid, spread=0.02, tick_ms=2000):
    t0 = 1_759_276_800_000
    lines = ["<DATE>\t<TIME>\t<BID>\t<ASK>\t<LAST>\t<VOLUME>\t<FLAGS>"]
    for i, m in enumerate(mid):
        dt = datetime.fromtimestamp((t0 + i * tick_ms) / 1000, timezone.utc)
        lines.append(f"{dt:%Y.%m.%d}\t{dt:%H:%M:%S}.{dt.microsecond // 1000:03d}\t{m - spread / 2:.5f}\t{m + spread / 2:.5f}\t\t\t6")
    path.write_text("\n".join(lines) + "\n")


def test_run_family_on_generator_data_passes(tmp_path):
    rng = np.random.default_rng(4)
    mid = simulate_mid(controls.boom_params(), 1000.0, 30_000, rng)
    data = tmp_path / "boom.csv"
    _write_mt5(data, mid)
    pre = tmp_path / "pre.json"
    pre.write_text(
        json.dumps(
            {
                "signals": ["momentum_5", "reversal_5", "post_spike_reversal_5"],
                "windows": {"calibration": [0.0, 0.4], "test": [0.4, 0.7], "holdout": [0.7, 1.0]},
                "cost_model": {"slippage": 0.0, "entry_delay_ticks": 1},
                "correction": "holm",
                "alpha": 0.05,
                "n_null": 39,
                "seed": 1,
            }
        )
    )
    rec = run_family(load_mt5_ticks(data, "BOOM_SIM"), "boom", Predeclaration.load(pre), {"event_prob": 1 / 500})
    assert rec["outcome"] == "PASS"
    assert rec["confirmed_edges"] == []
    assert len(rec["dataset_id"]) == 64 and len(rec["predeclaration_sha256"]) == 64
    assert {r["null_kind"] for r in rec["stage_b"]} == {"parametric_fitted", "parametric_documented", "permutation"}
    assert rec["stage_a"]["n_events"] > 0
    assert Predeclaration.load(pre).lock_path.exists()
    json.dumps(rec, default=str)  # evidence record must serialise
