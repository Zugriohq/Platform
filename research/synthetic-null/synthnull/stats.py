"""Null p-values, multiple-comparison control and expectancy intervals (#118 decision rule)."""

from __future__ import annotations

import numpy as np
from scipy import stats as sps


def null_p_value(real: float, null: np.ndarray) -> tuple[float, int]:
    """One-sided p = (1 + #{null >= real}) / (N + 1) over null paths that produced a statistic.

    Returns (p, n_valid). A real series with no trades gives p = 1: no trades is no evidence.
    """
    null = np.asarray(null, float)
    valid = null[~np.isnan(null)]
    if np.isnan(real) or len(valid) == 0:
        return 1.0, int(len(valid))
    return float((1 + np.sum(valid >= real)) / (len(valid) + 1)), int(len(valid))


def holm(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, float)
    m = len(p)
    order = np.argsort(p)
    adj = np.empty(m)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (m - rank) * p[i]))
        adj[i] = running
    return adj


def benjamini_hochberg(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, float)
    m = len(p)
    order = np.argsort(p)
    adj = np.empty(m)
    running = 1.0
    for rank in range(m - 1, -1, -1):
        i = order[rank]
        running = min(running, p[i] * m / (rank + 1))
        adj[i] = running
    return adj


CORRECTIONS = {"holm": holm, "bh": benjamini_hochberg}


def mean_ci(x: np.ndarray, level: float = 0.95) -> tuple[float, float, float]:
    """Mean and two-sided t-interval. NaNs when fewer than two trades."""
    x = np.asarray(x, float)
    if len(x) < 2:
        return (float(x.mean()) if len(x) else float("nan"), float("nan"), float("nan"))
    m = float(x.mean())
    half = float(sps.t.ppf(0.5 + level / 2, len(x) - 1) * x.std(ddof=1) / np.sqrt(len(x)))
    return m, m - half, m + half
