import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from synthnull.data import TickSeries  # noqa: E402


def make_series(mid: np.ndarray, spread: float = 0.0, tick_ms: int = 2000, symbol: str = "SIM") -> TickSeries:
    t = np.arange(len(mid), dtype=np.int64) * tick_ms + 1_700_000_000_000
    return TickSeries(symbol, "sim", t, mid - spread / 2, mid + spread / 2)
