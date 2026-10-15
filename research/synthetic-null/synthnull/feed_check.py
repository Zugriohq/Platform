"""Check that a secondary feed (Deriv API spot) is the same generator as the primary MT5 feed.

Pass criteria are fixed in DATA_SOURCE.md and must not be tuned after a comparison is run.
"""

from __future__ import annotations

import json
import sys

import numpy as np

from .data import TickSeries, load_any

MIN_ALIGNED = 10_000
MIN_WITHIN_ONE_INCREMENT = 0.99
MIN_INCREMENT_CORR = 0.99


def price_increment(ts: TickSeries) -> float:
    """Smallest positive price change observed: the feed's quote precision."""
    d = np.abs(np.diff(ts.mid))
    d = d[d > 0]
    return float(d.min()) if len(d) else float("nan")


def feed_check(primary: TickSeries, secondary: TickSeries) -> dict:
    # Align on whole seconds; last tick in each second wins.
    def by_second(ts: TickSeries) -> dict[int, float]:
        return dict(zip((ts.t_ms // 1000).tolist(), ts.mid.tolist()))

    a, b = by_second(primary), by_second(secondary)
    keys = sorted(a.keys() & b.keys())
    n = len(keys)
    result: dict = {"aligned_ticks": n}
    if n < 2:
        result["passed"] = False
        return result
    pa = np.array([a[k] for k in keys])
    pb = np.array([b[k] for k in keys])
    inc = max(price_increment(primary), price_increment(secondary))
    within = float(np.mean(np.abs(pa - pb) <= inc + 1e-12))
    corr = float(np.corrcoef(np.diff(pa), np.diff(pb))[0, 1])
    result.update(
        price_increment=inc,
        within_one_increment=within,
        increment_corr=corr,
        passed=bool(n >= MIN_ALIGNED and within >= MIN_WITHIN_ONE_INCREMENT and corr >= MIN_INCREMENT_CORR),
    )
    return result


if __name__ == "__main__":  # python -m synthnull.feed_check <primary> <secondary> <symbol>
    if len(sys.argv) != 4:
        sys.exit("usage: python -m synthnull.feed_check <mt5_export> <deriv_ticks.jsonl> <symbol>")
    print(json.dumps(feed_check(load_any(sys.argv[1], sys.argv[3]), load_any(sys.argv[2], sys.argv[3])), indent=2))
