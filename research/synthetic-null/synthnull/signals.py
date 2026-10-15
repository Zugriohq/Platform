"""Predeclared Stage B signal battery (#118). Used for family selection only; not a TradeBundle.

Every signal maps a TickSeries to a direction array where element t uses only ticks <= t.
Bar-based signals act on the first tick after a bar closes, because a bar is only known to be
complete once a later tick arrives.
"""

from __future__ import annotations

from typing import Callable

import numpy as np

from .backtest import Signal
from .data import TickSeries
from .nulls import Family, NullParams, classify_events, increments


def momentum(k: int) -> Signal:
    def f(ts: TickSeries) -> np.ndarray:
        m = ts.mid
        out = np.zeros(len(m), np.int8)
        out[k:] = np.sign(m[k:] - m[:-k]).astype(np.int8)
        return out

    return f


def reversal(k: int) -> Signal:
    mom = momentum(k)
    return lambda ts: -mom(ts)


def _bar_closes(ts: TickSeries, bar_ms: int) -> tuple[np.ndarray, np.ndarray]:
    """Close of each completed bar and the tick index at which that completion becomes known."""
    bucket = ts.t_ms // bar_ms
    first_of_next = np.flatnonzero(np.diff(bucket)) + 1  # first tick of a new bucket
    closes = ts.mid[first_of_next - 1]
    return closes, first_of_next


def bollinger_fade(n: int = 20, width: float = 2.0, bar_ms: int = 60_000) -> Signal:
    def f(ts: TickSeries) -> np.ndarray:
        out = np.zeros(len(ts), np.int8)
        closes, known_at = _bar_closes(ts, bar_ms)
        for i in range(n - 1, len(closes)):
            w = closes[i - n + 1 : i + 1]
            mu, sd = w.mean(), w.std(ddof=0)
            if closes[i] > mu + width * sd:
                out[known_at[i]] = -1
            elif closes[i] < mu - width * sd:
                out[known_at[i]] = 1
        return out

    return f


def rsi_fade(n: int = 14, lo: float = 30.0, hi: float = 70.0, bar_ms: int = 60_000) -> Signal:
    def f(ts: TickSeries) -> np.ndarray:
        out = np.zeros(len(ts), np.int8)
        closes, known_at = _bar_closes(ts, bar_ms)
        d = np.diff(closes)
        if len(d) < n:
            return out
        gain, loss = np.clip(d, 0, None), np.clip(-d, 0, None)
        ag, al = gain[:n].mean(), loss[:n].mean()
        for i in range(n, len(d) + 1):
            if i > n:  # Wilder smoothing with the newest change d[i-1]
                ag = (ag * (n - 1) + gain[i - 1]) / n
                al = (al * (n - 1) + loss[i - 1]) / n
            rsi = 100.0 if al == 0 else 100.0 - 100.0 / (1.0 + ag / al)
            if rsi > hi:
                out[known_at[i]] = -1
            elif rsi < lo:
                out[known_at[i]] = 1
        return out

    return f


def post_spike_reversal(family: Family, frozen: NullParams) -> Signal:
    """Enter against a Boom/Crash spike on the tick it is observed. Threshold frozen from calibration."""
    if family not in ("boom", "crash"):
        raise ValueError("post_spike_reversal applies to boom/crash only")
    direction = -1 if family == "boom" else 1

    def f(ts: TickSeries) -> np.ndarray:
        r = increments(family, ts.mid)
        ev = classify_events(family, r, frozen.event_center, frozen.event_scale, frozen.event_threshold_z)
        out = np.zeros(len(ts), np.int8)
        out[np.flatnonzero(ev) + 1] = direction  # increment i ends at tick i+1
        return out

    return f


def default_battery(family: Family, frozen: NullParams) -> dict[str, tuple[Signal, int]]:
    """name -> (signal, hold_ticks). Changing this after test-window data is read invalidates the run."""
    battery: dict[str, tuple[Callable, int]] = {}
    for k in (5, 15, 50):
        battery[f"momentum_{k}"] = (momentum(k), k)
        battery[f"reversal_{k}"] = (reversal(k), k)
    battery["bollinger_fade_20_2"] = (bollinger_fade(), 30)
    battery["rsi_fade_14"] = (rsi_fade(), 30)
    if family in ("boom", "crash"):
        for h in (5, 20):
            battery[f"post_spike_reversal_{h}"] = (post_spike_reversal(family, frozen), h)
    return battery
