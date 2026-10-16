"""Generator-matched null models per synthetic family (#118).

Each family has
* a parametric null — the stated/baseline generating process, with parameters either fitted on the
  calibration window or overridden from Deriv's documentation; and
* a model-free null — a permutation of the real series' own increments, where that is valid.

A GBM null is only correct for the Volatility family. Using it for Boom/Crash, Jump or Step would make
documented mechanics look like edge (see the spike-structure control in tests/test_controls.py).

Range Break is not implemented yet; it needs a bounded range-bounce process and has no valid
permutation null.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

import numpy as np

Family = Literal["volatility", "boom", "crash", "jump", "step"]
FAMILIES: tuple[Family, ...] = ("volatility", "boom", "crash", "jump", "step")

SECONDS_PER_YEAR = 365 * 24 * 3600  # day-count assumption for documented sigma; flagged in reports


@dataclass(frozen=True)
class NullParams:
    family: Family
    mu: float  # mean non-event increment (log for multiplicative families, price units for step)
    sigma: float  # std of non-event increment
    event_prob: float = 0.0  # spike/jump probability per tick
    event_sizes: np.ndarray | None = None  # boom/crash: signed log sizes; jump: absolute log sizes
    event_threshold_z: float = 8.0  # robust-z threshold used to classify events
    event_center: float = 0.0  # robust center of increments at fit time
    event_scale: float = 0.0  # robust scale of increments at fit time
    step: float = 0.0  # step family: step size
    p_up: float = 0.5  # step family
    source: str = "fitted"  # "fitted" or "documented:<fields>"

    def with_documented(self, **fields) -> "NullParams":
        tag = "documented:" + ",".join(sorted(fields))
        return replace(self, source=tag, **fields)


def increments(family: Family, mid: np.ndarray) -> np.ndarray:
    return np.diff(mid) if family == "step" else np.diff(np.log(mid))


def rebuild(family: Family, x0: float, inc: np.ndarray) -> np.ndarray:
    path = np.concatenate([[0.0], np.cumsum(inc)])
    return x0 + path if family == "step" else x0 * np.exp(path)


def robust_center_scale(r: np.ndarray) -> tuple[float, float]:
    med = float(np.median(r))
    mad = float(np.median(np.abs(r - med))) * 1.4826
    return med, mad


def classify_events(family: Family, r: np.ndarray, center: float, scale: float, k: float) -> np.ndarray:
    """Boolean mask of spike/jump increments under a frozen robust-z threshold."""
    if family not in ("boom", "crash", "jump") or scale <= 0:
        return np.zeros(len(r), bool)
    z = (r - center) / scale
    if family == "boom":
        return z > k
    if family == "crash":
        return z < -k
    return np.abs(z) > k


def fit(family: Family, mid: np.ndarray, event_threshold_z: float = 8.0) -> NullParams:
    """Fit the parametric null on a calibration-window mid series."""
    r = increments(family, mid)
    if family == "step":
        nz = np.abs(r[r != 0])
        step = float(np.median(nz)) if len(nz) else 0.0
        p_up = float(np.mean(r[r != 0] > 0)) if len(nz) else 0.5
        return NullParams(family, mu=0.0, sigma=step, step=step, p_up=p_up)
    center, scale = robust_center_scale(r)
    ev = classify_events(family, r, center, scale, event_threshold_z)
    base = r[~ev]
    sizes = None
    if family in ("boom", "crash"):
        sizes = r[ev].copy()
    elif family == "jump":
        sizes = np.abs(r[ev] - center)
    return NullParams(
        family,
        mu=float(base.mean()),
        sigma=float(base.std(ddof=1)),
        event_prob=float(ev.mean()),
        event_sizes=sizes,
        event_threshold_z=event_threshold_z,
        event_center=center,
        event_scale=scale,
    )


def documented_sigma_per_tick(annual_vol: float, tick_seconds: float) -> float:
    return annual_vol * np.sqrt(tick_seconds / SECONDS_PER_YEAR)


def simulate_increments(p: NullParams, n: int, rng: np.random.Generator) -> np.ndarray:
    if p.family == "step":
        return np.where(rng.random(n) < p.p_up, p.step, -p.step)
    inc = rng.normal(p.mu, p.sigma, n)
    if p.family in ("boom", "crash", "jump") and p.event_prob > 0:
        if p.event_sizes is None or len(p.event_sizes) == 0:
            raise ValueError(f"{p.family}: event_prob > 0 but no event sizes to resample")
        hit = rng.random(n) < p.event_prob
        k = int(hit.sum())
        sizes = rng.choice(p.event_sizes, size=k, replace=True)
        if p.family == "jump":
            sizes = sizes * np.where(rng.random(k) < 0.5, 1.0, -1.0)
        inc[hit] = sizes
    return inc


def simulate_mid(p: NullParams, x0: float, n_increments: int, rng: np.random.Generator) -> np.ndarray:
    return rebuild(p.family, x0, simulate_increments(p, n_increments, rng))


def permutation_valid(family: Family) -> bool:
    return family in FAMILIES  # all implemented families; Range Break would return False


def permute_mid(family: Family, mid: np.ndarray, p: NullParams, rng: np.random.Generator) -> np.ndarray:
    """Model-free null built from the real series' own increments."""
    r = increments(family, mid)
    if family in ("volatility", "jump", "step"):
        return rebuild(family, mid[0], rng.permutation(r))
    # boom/crash: keep between-event increments in order; shuffle event sizes and inter-event gaps.
    ev = classify_events(family, r, p.event_center, p.event_scale, p.event_threshold_z)
    base = r[~ev]
    sizes = rng.permutation(r[ev])
    pos = np.flatnonzero(ev)
    gaps = np.diff(np.concatenate([[-1], pos])) - 1  # non-event increments before each event
    gaps = rng.permutation(gaps)
    out = np.empty_like(r)
    i = j = 0
    for g, s in zip(gaps, sizes):
        out[i : i + g] = base[j : j + g]
        i += g
        j += g
        out[i] = s
        i += 1
    out[i:] = base[j:]
    return rebuild(family, mid[0], out)
