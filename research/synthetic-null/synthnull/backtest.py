"""Single execution/cost path shared by real and null series (#118 cost-symmetry requirement).

There is deliberately one function, ``run_trades``; nothing else in the harness computes trade P&L.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from .data import TickSeries

Signal = Callable[[TickSeries], np.ndarray]  # direction in {-1, 0, +1} per tick, using data <= t only

DAY_MS = 86_400_000


@dataclass(frozen=True)
class CostModel:
    """CFD costs (D1). All values versioned in the predeclaration file, never tuned after test data is read."""

    slippage: float = 0.0  # price units per side, applied adversely
    extra_half_spread: float = 0.0  # added to the series' own half-spread (e.g. spot-only feeds)
    commission_frac: float = 0.0  # fraction of notional per side
    swap_long_frac: float = 0.0  # fraction of notional charged per rollover crossed, long
    swap_short_frac: float = 0.0  # same, short
    entry_delay_ticks: int = 1


def run_trades(ts: TickSeries, direction: np.ndarray, hold_ticks: int, cost: CostModel) -> np.ndarray:
    """Net fractional return per trade. One position at a time; signals during a position are ignored."""
    if hold_ticks < 1:
        raise ValueError("hold_ticks must be >= 1")
    n = len(ts)
    bid = ts.bid - cost.extra_half_spread - cost.slippage
    ask = ts.ask + cost.extra_half_spread + cost.slippage
    out: list[float] = []
    candidates = np.flatnonzero(direction)
    j = 0
    while j < len(candidates):
        t = int(candidates[j])
        e = t + cost.entry_delay_ticks
        x = e + hold_ticks
        if x >= n:
            break
        d = int(direction[t])
        if d > 0:
            entry, exit_ = ask[e], bid[x]
            swap = cost.swap_long_frac
        else:
            entry, exit_ = bid[e], ask[x]
            swap = cost.swap_short_frac
        rollovers = int(ts.t_ms[x] // DAY_MS - ts.t_ms[e] // DAY_MS)
        out.append(d * (exit_ - entry) / entry - 2 * cost.commission_frac - rollovers * swap)
        j = int(np.searchsorted(candidates, x, side="left"))  # next decision at or after exit
    return np.asarray(out, float)
