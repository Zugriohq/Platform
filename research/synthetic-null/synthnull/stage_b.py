"""Stage B: predeclared signals on the real series vs. N null series under one execution path."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from .backtest import CostModel, Signal, run_trades
from .data import TickSeries
from .stats import CORRECTIONS, mean_ci, null_p_value

NullFactory = Callable[[np.random.Generator], TickSeries]


def statistic(trades: np.ndarray) -> float:
    """Net expectancy per trade after costs; NaN when there are no trades."""
    return float(trades.mean()) if len(trades) else float("nan")


@dataclass
class SignalResult:
    name: str
    null_kind: str
    n_trades: int
    expectancy: float
    ci_low: float
    ci_high: float
    null_mean: float
    null_p95: float
    n_null_valid: int
    p: float
    p_adj: float = float("nan")

    def is_edge_candidate(self, alpha: float) -> bool:
        """Beats the null after correction AND is profitable in absolute terms with CI above zero."""
        return bool(self.p_adj <= alpha and self.ci_low > 0)


@dataclass
class StageBResult:
    results: list[SignalResult] = field(default_factory=list)

    def apply_correction(self, method: str) -> None:
        adj = CORRECTIONS[method](np.array([r.p for r in self.results]))
        for r, a in zip(self.results, adj):
            r.p_adj = float(a)

    def candidates(self, alpha: float) -> list[str]:
        """Signals that are edge candidates under EVERY null they were tested against."""
        names = {r.name for r in self.results}
        return sorted(n for n in names if all(r.is_edge_candidate(alpha) for r in self.results if r.name == n))


def run_stage_b(
    real: TickSeries,
    nulls: dict[str, NullFactory],
    battery: dict[str, tuple[Signal, int]],
    cost: CostModel,
    n_null: int,
    seed: int,
) -> StageBResult:
    """Each null path is generated once and every signal is evaluated on it (paired comparison)."""
    out = StageBResult()
    real_trades = {name: run_trades(real, sig(real), hold, cost) for name, (sig, hold) in battery.items()}
    for null_kind, factory in nulls.items():
        seeds = np.random.SeedSequence([seed, sum(map(ord, null_kind))]).spawn(n_null)
        null_stats = {name: np.empty(n_null) for name in battery}
        for i, ss in enumerate(seeds):
            path = factory(np.random.default_rng(ss))
            for name, (sig, hold) in battery.items():
                null_stats[name][i] = statistic(run_trades(path, sig(path), hold, cost))
        for name in battery:
            tr = real_trades[name]
            m, lo, hi = mean_ci(tr)
            ns = null_stats[name]
            p, n_valid = null_p_value(statistic(tr), ns)
            valid = ns[~np.isnan(ns)]
            out.results.append(
                SignalResult(
                    name=name,
                    null_kind=null_kind,
                    n_trades=len(tr),
                    expectancy=m,
                    ci_low=lo,
                    ci_high=hi,
                    null_mean=float(valid.mean()) if len(valid) else float("nan"),
                    null_p95=float(np.percentile(valid, 95)) if len(valid) else float("nan"),
                    n_null_valid=n_valid,
                    p=p,
                )
            )
    return out
