"""Stage A: generator conformance on a test window, given a null fitted on the calibration window.

These tests describe whether the real series deviates from its stated process. They are reported,
not used to admit anything; Stage B decides edge.
Serial-dependence tests run on non-event increments so documented spikes/jumps do not dominate them.
"""

from __future__ import annotations

import numpy as np
from scipy import stats as sps

from .nulls import NullParams, classify_events, increments

LAGS = (1, 5, 15, 50, 100)


def acf_z(x: np.ndarray, lag: int) -> tuple[float, float]:
    """Sample autocorrelation at ``lag`` and its two-sided p under the iid null (z = rho * sqrt(n))."""
    x = x - x.mean()
    if len(x) <= lag + 1 or not np.any(x):
        return float("nan"), float("nan")
    rho = float(np.dot(x[:-lag], x[lag:]) / np.dot(x, x))
    return rho, float(2 * sps.norm.sf(abs(rho) * np.sqrt(len(x))))


def variance_ratio(x: np.ndarray, q: int) -> tuple[float, float]:
    """Lo-MacKinlay homoskedastic variance ratio VR(q) and two-sided p."""
    n = len(x)
    if n < 2 * q:
        return float("nan"), float("nan")
    mu = x.mean()
    var1 = np.sum((x - mu) ** 2) / (n - 1)
    sq = np.convolve(x, np.ones(q), "valid")
    varq = np.sum((sq - q * mu) ** 2) / (q * (n - q + 1) * (1 - q / n))
    vr = float(varq / var1)
    se = np.sqrt(2 * (2 * q - 1) * (q - 1) / (3 * q * n))
    return vr, float(2 * sps.norm.sf(abs(vr - 1) / se))


def runs_test(x: np.ndarray) -> tuple[int, float]:
    """Wald-Wolfowitz runs test on signs of non-zero increments."""
    s = np.sign(x[x != 0])
    n1, n2 = int(np.sum(s > 0)), int(np.sum(s < 0))
    if n1 == 0 or n2 == 0:
        return 0, float("nan")
    runs = int(1 + np.sum(s[1:] != s[:-1]))
    n = n1 + n2
    mu = 2 * n1 * n2 / n + 1
    var = 2 * n1 * n2 * (2 * n1 * n2 - n) / (n**2 * (n - 1))
    return runs, float(2 * sps.norm.sf(abs(runs - mu) / np.sqrt(var)))


def geometric_gap_test(gaps: np.ndarray, p: float, bins: int = 10) -> tuple[float, float]:
    """Chi-square goodness of fit of inter-event gaps (>= 1) to Geometric(p), on equiprobable bins."""
    if len(gaps) < 5 * bins or not 0 < p < 1:
        return float("nan"), float("nan")
    qs = np.unique(np.ceil(sps.geom.ppf(np.linspace(0, 1, bins + 1)[1:-1], p)).astype(int))
    edges = np.concatenate([[0], qs, [np.inf]])
    obs = np.histogram(gaps, bins=edges)[0]
    cdf = np.concatenate([[0.0], sps.geom.cdf(qs, p), [1.0]])
    exp = np.diff(cdf) * len(gaps)
    chi2 = float(np.sum((obs - exp) ** 2 / exp))
    return chi2, float(sps.chi2.sf(chi2, len(obs) - 2))  # one fitted parameter


def stage_a(mid: np.ndarray, frozen: NullParams, documented: dict | None = None) -> dict:
    fam = frozen.family
    r = increments(fam, mid)
    ev = classify_events(fam, r, frozen.event_center, frozen.event_scale, frozen.event_threshold_z)
    base = r[~ev]
    rep: dict = {"family": fam, "n_increments": int(len(r)), "n_events": int(ev.sum())}
    rep["acf"] = {lag: acf_z(base, lag) for lag in LAGS}
    rep["acf_abs"] = {lag: acf_z(np.abs(base), lag) for lag in LAGS}
    rep["variance_ratio"] = {q: variance_ratio(base, q) for q in (5, 15, 50)}
    rep["runs"] = runs_test(base)
    rep["sigma_fitted"] = float(base.std(ddof=1))
    if documented and "sigma" in documented:
        rep["sigma_ratio_to_documented"] = rep["sigma_fitted"] / documented["sigma"]
    if fam in ("boom", "crash"):
        pos = np.flatnonzero(ev)
        gaps = np.diff(pos)
        p_doc = (documented or {}).get("event_prob", frozen.event_prob)
        rep["event_rate"] = float(ev.mean())
        rep["geometric_gap_fit"] = geometric_gap_test(gaps, p_doc)
        drift = {}
        for h in (1, 5, 20):
            after = np.array([r[i + 1 : i + 1 + h].sum() for i in pos if i + h < len(r)])
            if len(after) > 1:
                drift[h] = (float(after.mean()), float(sps.ttest_1samp(after, h * base.mean()).pvalue))
        rep["post_event_drift"] = drift
    if fam == "jump":
        rv = float(np.sum(r**2))
        bv = float(np.pi / 2 * np.sum(np.abs(r[1:]) * np.abs(r[:-1])))
        rep["rv_over_bv"] = rv / bv if bv > 0 else float("nan")
        signs = np.sign(r[ev] - frozen.event_center)
        k = int(np.sum(signs > 0))
        rep["jump_sign_symmetry_p"] = float(sps.binomtest(k, len(signs), 0.5).pvalue) if len(signs) else float("nan")
    if fam == "step":
        nz = r[r != 0]
        rep["step_sizes"] = sorted({round(abs(v), 10) for v in nz})[:10]
        k = int(np.sum(nz > 0))
        rep["p_up"] = k / len(nz) if len(nz) else float("nan")
        rep["p_up_test_p"] = float(sps.binomtest(k, len(nz), 0.5).pvalue) if len(nz) else float("nan")
    return rep
