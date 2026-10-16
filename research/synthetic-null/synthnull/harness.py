"""End-to-end run for one instrument: calibrate -> Stage A -> Stage B (test) -> holdout replication."""

from __future__ import annotations

import subprocess
from dataclasses import asdict

import numpy as np

from .backtest import CostModel
from .data import TickSeries
from .nulls import Family, NullParams, fit, permutation_valid, permute_mid, simulate_mid
from .predeclare import Predeclaration
from .signals import default_battery
from .stage_a import stage_a
from .stage_b import NullFactory, run_stage_b


def build_nulls(
    family: Family, frozen: NullParams, target: TickSeries, documented: NullParams | None = None
) -> dict[str, NullFactory]:
    """Null factories producing series aligned with ``target`` (same timestamps and spreads)."""
    n = len(target) - 1
    x0 = float(target.mid[0])
    nulls: dict[str, NullFactory] = {
        "parametric_fitted": lambda rng: target.with_mid(simulate_mid(frozen, x0, n, rng)),
    }
    if documented is not None:
        nulls["parametric_documented"] = lambda rng: target.with_mid(simulate_mid(documented, x0, n, rng))
    if permutation_valid(family):
        nulls["permutation"] = lambda rng: target.with_mid(permute_mid(family, target.mid, frozen, rng))
    return nulls


def _window(ts: TickSeries, frac: list[float]) -> TickSeries:
    a, b = (int(round(f * len(ts))) for f in frac)
    return ts.slice(a, b)


def _commit() -> str:
    """HEAD commit, suffixed ``-dirty`` when uncommitted changes exist so evidence never over-claims."""
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--", "."], capture_output=True, text=True, check=True
        ).stdout.strip()
        return f"{head}-dirty" if dirty else head
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def run_family(
    ts: TickSeries,
    family: Family,
    pre: Predeclaration,
    documented_fields: dict | None = None,
) -> dict:
    """Run the predeclared protocol on one instrument and return the evidence record."""
    c = pre.content
    cost = CostModel(**c["cost_model"])
    k = c.get("event_threshold_z", 8.0)

    calib = _window(ts, pre.open_window("calibration"))
    frozen = fit(family, calib.mid, k)
    documented = frozen.with_documented(**documented_fields) if documented_fields else None
    battery = {n: s for n, s in default_battery(family, frozen).items() if n in c["signals"]}
    if not battery:
        raise ValueError(f"no predeclared signals apply to family {family}")

    test = _window(ts, pre.open_window("test"))
    a = stage_a(test.mid, frozen, documented_fields)
    b = run_stage_b(test, build_nulls(family, frozen, test, documented), battery, cost, c["n_null"], c["seed"])
    b.apply_correction(c["correction"])
    candidates = b.candidates(c["alpha"])

    holdout_result = None
    if candidates:
        hold = _window(ts, pre.open_window("holdout"))
        hb = run_stage_b(
            hold,
            build_nulls(family, frozen, hold, documented),
            {n: battery[n] for n in candidates},
            cost,
            c["n_null"],
            c["seed"] + 1,
        )
        hb.apply_correction(c["correction"])
        holdout_result = {"results": [asdict(r) for r in hb.results], "confirmed": hb.candidates(c["alpha"])}

    confirmed = holdout_result["confirmed"] if holdout_result else []
    return {
        "symbol": ts.symbol,
        "family": family,
        "dataset_id": ts.dataset_id(),
        "predeclaration_sha256": pre.sha256,
        "code_commit": _commit(),
        "frozen_params": {k_: v for k_, v in asdict(frozen).items() if k_ != "event_sizes"}
        | {"n_event_sizes": 0 if frozen.event_sizes is None else int(len(frozen.event_sizes))},
        "documented_overrides": documented_fields or {},
        "stage_a": a,
        "stage_b": [asdict(r) for r in b.results],
        "test_candidates": candidates,
        "holdout": holdout_result,
        "confirmed_edges": confirmed,
        "best_confirmed_expectancy": max(
            (r["expectancy"] for r in holdout_result["results"] if r["name"] in confirmed), default=None
        )
        if holdout_result
        else None,
        "outcome": "EDGE_CANDIDATE" if confirmed else "PASS",
    }
