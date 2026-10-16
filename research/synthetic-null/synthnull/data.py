"""Tick series container, loaders and dataset identity.

Two input formats are supported (see DATA_SOURCE.md):

* MT5 tick export (primary): tab-separated, header ``<DATE> <TIME> <BID> <ASK> <LAST> <VOLUME> <FLAGS>``.
  Unchanged bid/ask fields are left blank by MT5 and are forward-filled here.
* Deriv ``ticks_history`` JSON lines (secondary): one ``{"epoch": int, "quote": float}`` object per line.
  Spot only, so ``bid == ask == quote``.
"""

from __future__ import annotations

import codecs
import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


@dataclass(frozen=True)
class TickSeries:
    """Point-in-time ticks. ``t_ms`` is milliseconds since epoch in the source's clock."""

    symbol: str
    source: str
    t_ms: np.ndarray  # int64, strictly increasing
    bid: np.ndarray  # float64
    ask: np.ndarray  # float64

    def __post_init__(self) -> None:
        n = len(self.t_ms)
        if not (len(self.bid) == len(self.ask) == n):
            raise ValueError("t_ms, bid and ask must have equal length")
        if n and np.any(np.diff(self.t_ms) <= 0):
            raise ValueError("timestamps must be strictly increasing")
        if np.any(self.ask < self.bid):
            raise ValueError("ask below bid")

    @property
    def mid(self) -> np.ndarray:
        return (self.bid + self.ask) / 2.0

    @property
    def spread(self) -> np.ndarray:
        return self.ask - self.bid

    def __len__(self) -> int:
        return len(self.t_ms)

    def slice(self, start: int, stop: int) -> "TickSeries":
        return TickSeries(
            self.symbol, self.source, self.t_ms[start:stop], self.bid[start:stop], self.ask[start:stop]
        )

    def with_mid(self, mid: np.ndarray) -> "TickSeries":
        """Same timestamps and spreads, different mid path. Used to build null series."""
        half = self.spread / 2.0
        return TickSeries(self.symbol, f"{self.source}+null", self.t_ms.copy(), mid - half, mid + half)

    def dataset_id(self) -> str:
        """SHA-256 over the canonical arrays; independent of file formatting."""
        h = hashlib.sha256()
        h.update(self.symbol.encode())
        for arr, dtype in ((self.t_ms, "<i8"), (self.bid, "<f8"), (self.ask, "<f8")):
            h.update(np.ascontiguousarray(arr, dtype=dtype).tobytes())
        return h.hexdigest()


def _read_text(path: Path) -> str:
    raw = path.read_bytes()
    if raw.startswith(codecs.BOM_UTF16_LE) or raw.startswith(codecs.BOM_UTF16_BE):
        return raw.decode("utf-16")
    return raw.decode("utf-8-sig")


def load_mt5_ticks(path: str | Path, symbol: str) -> TickSeries:
    """Load an MT5 'Symbols > Ticks > Export' file.

    Ticks sharing a millisecond timestamp are collapsed to the last one. Leading rows before both bid and
    ask are known are dropped.
    """
    lines = _read_text(Path(path)).splitlines()
    if not lines or "<BID>" not in lines[0].upper():
        raise ValueError(f"{path}: not an MT5 tick export (missing <BID> header)")
    header = [h.strip().upper() for h in lines[0].split("\t")]
    i_date, i_time, i_bid, i_ask = (header.index(c) for c in ("<DATE>", "<TIME>", "<BID>", "<ASK>"))

    t_list: list[int] = []
    bid_list: list[float] = []
    ask_list: list[float] = []
    bid = ask = float("nan")
    for line in lines[1:]:
        if not line.strip():
            continue
        f = line.split("\t")
        if f[i_bid].strip():
            bid = float(f[i_bid])
        if f[i_ask].strip():
            ask = float(f[i_ask])
        if np.isnan(bid) or np.isnan(ask):
            continue
        ts = datetime.strptime(f"{f[i_date].strip()} {f[i_time].strip()}", "%Y.%m.%d %H:%M:%S.%f")
        t = int(ts.replace(tzinfo=timezone.utc).timestamp() * 1000)
        if t_list and t == t_list[-1]:
            bid_list[-1], ask_list[-1] = bid, ask
            continue
        t_list.append(t)
        bid_list.append(bid)
        ask_list.append(ask)
    return TickSeries(
        symbol, "mt5", np.asarray(t_list, np.int64), np.asarray(bid_list, float), np.asarray(ask_list, float)
    )


def load_deriv_ticks(path: str | Path, symbol: str) -> TickSeries:
    t_list, q_list = [], []
    for line in Path(path).read_text().splitlines():
        if line.strip():
            rec = json.loads(line)
            t_list.append(int(rec["epoch"]) * 1000)
            q_list.append(float(rec["quote"]))
    q = np.asarray(q_list, float)
    return TickSeries(symbol, "deriv_api", np.asarray(t_list, np.int64), q, q.copy())


def gap_report(ts: TickSeries) -> dict:
    """Tick-interval summary used to detect thinned streams and outages."""
    if len(ts) < 2:
        return {"n_intervals": 0}
    dt = np.diff(ts.t_ms) / 1000.0
    med = float(np.median(dt))
    return {
        "n_intervals": int(len(dt)),
        "median_interval_s": med,
        "p99_interval_s": float(np.percentile(dt, 99)),
        "max_interval_s": float(dt.max()),
        "n_gaps_over_10x_median": int(np.sum(dt > 10 * med)),
    }


def manifest(ts: TickSeries, source_file: str) -> dict:
    return {
        "dataset_id": ts.dataset_id(),
        "symbol": ts.symbol,
        "source": ts.source,
        "source_file": Path(source_file).name,
        "n_ticks": len(ts),
        "first_t_ms": int(ts.t_ms[0]) if len(ts) else None,
        "last_t_ms": int(ts.t_ms[-1]) if len(ts) else None,
        "median_spread": float(np.median(ts.spread)) if len(ts) else None,
        "gaps": gap_report(ts),
    }


def load_any(path: str, symbol: str) -> TickSeries:
    return load_deriv_ticks(path, symbol) if path.endswith(".jsonl") else load_mt5_ticks(path, symbol)


if __name__ == "__main__":  # python -m synthnull.data manifest <file> <symbol>
    if len(sys.argv) != 4 or sys.argv[1] != "manifest":
        sys.exit("usage: python -m synthnull.data manifest <file> <symbol>")
    print(json.dumps(manifest(load_any(sys.argv[2], sys.argv[3]), sys.argv[2]), indent=2))
