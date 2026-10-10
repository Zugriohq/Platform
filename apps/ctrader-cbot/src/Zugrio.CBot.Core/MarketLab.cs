using System;
using System.Collections.Generic;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>One closed bar for Market Lab statistics.</summary>
    public readonly record struct LabBar(double O, double H, double L, double C);

    /// <summary>
    /// What a market's own history says it is (research, no trading authority).
    /// Returns are simple bar-to-bar returns. Sigma is robust (1.4826 x median absolute deviation), so rare jumps
    /// do not hide inside it. A jump is a return beyond JumpSigma robust sigmas. VR(k) is the variance ratio of
    /// non-overlapping k-bar returns: about 1 for a random walk, above 1 when moves persist (trends), below 1 when
    /// they revert.
    /// </summary>
    public sealed record FamilyStats(int Bars, double RobustSigma, double JumpShare, double UpJumpShare, double MeanJumpPct,
        double DriftPerBarPct, double NetPerBarPct, double Vr5, double Vr15, double Vr60, double Autocorr1, string Family);

    /// <summary>A self-tested rule: average result per trade in R (risk units) after the spread, and its t-statistic.</summary>
    public sealed record LabTest(string Name, int Trades, double AvgR, double SeR, double WinRate, double ProfitFactor)
    {
        public double T => SeR > 0 ? AvgR / SeR : 0;
    }

    /// <summary>A tested rule with its average in each half of the history.</summary>
    public sealed record LabCandidate(LabTest Test, double FirstHalfAvgR, double SecondHalfAvgR)
    {
        public bool IsEdgeCandidate => Test.T >= MarketLab.CandidateT && FirstHalfAvgR > 0 && SecondHalfAvgR > 0;
    }

    public static class MarketLab
    {
        public const double JumpSigma = 6;

        public static double[] Returns(IReadOnlyList<LabBar> b)
        {
            var r = new double[Math.Max(0, b.Count - 1)];
            for (var i = 1; i < b.Count; i++) r[i - 1] = b[i - 1].C > 0 ? b[i].C / b[i - 1].C - 1 : 0;
            return r;
        }

        public static double RobustSigma(IReadOnlyList<double> r)
        {
            if (r.Count == 0) return 0;
            var med = Median(r);
            return 1.4826 * Median(r.Select(x => Math.Abs(x - med)).ToList());
        }

        /// <summary>
        /// The scale jumps are measured against: the larger of the robust sigma and sqrt(pi/2) x the mean absolute
        /// deviation from the median (both equal sigma for normal returns). The second is a floor for markets whose
        /// bars between spikes move by an almost constant step (Deriv Boom/Crash at M1): there the median absolute
        /// deviation is about zero and every ordinary bar would count as a "jump" (Market Lab run, 2026-10-10:
        /// Boom 1000 read 99.8% jumps and the wrong direction).
        /// </summary>
        public static double JumpScale(IReadOnlyList<double> r)
        {
            if (r.Count == 0) return 0;
            var med = Median(r);
            return Math.Max(RobustSigma(r), Math.Sqrt(Math.PI / 2) * r.Average(x => Math.Abs(x - med)));
        }

        /// <summary>Indices i where r[i] is a jump: more than JumpSigma x JumpScale from the median return.</summary>
        public static bool[] JumpMask(IReadOnlyList<double> r)
        {
            var mask = new bool[r.Count];
            if (r.Count == 0) return mask;
            var med = Median(r); var scale = JumpScale(r);
            for (var i = 0; i < r.Count; i++) mask[i] = scale > 0 && Math.Abs(r[i] - med) > JumpSigma * scale;
            return mask;
        }

        /// <summary>Variance of non-overlapping k-bar sums over k x variance of single bars.</summary>
        public static double VarianceRatio(IReadOnlyList<double> r, int k)
        {
            if (r.Count < 4 * k) return double.NaN;
            var v1 = Var(r);
            var sums = new List<double>();
            for (var i = 0; i + k <= r.Count; i += k) { double s = 0; for (var j = i; j < i + k; j++) s += r[j]; sums.Add(s); }
            return v1 > 0 ? Var(sums) / (k * v1) : double.NaN;
        }

        public static double Autocorrelation(IReadOnlyList<double> r, int lag)
        {
            if (r.Count <= lag + 2) return double.NaN;
            var m = r.Average(); double num = 0, den = 0;
            for (var i = 0; i < r.Count; i++) { den += (r[i] - m) * (r[i] - m); if (i >= lag) num += (r[i] - m) * (r[i - lag] - m); }
            return den > 0 ? num / den : double.NaN;
        }

        /// <summary>
        /// Behaviour family from the statistics:
        /// - SPIKE_UP / SPIKE_DOWN: jumps present, at least 80% in one direction (Boom-like / Crash-like);
        /// - JUMP_SYMMETRIC: jumps in both directions;
        /// - TRENDING_REGIMES: no jumps, VR(60) above 1.3;
        /// - MEAN_REVERTING: no jumps, VR(60) below 0.75;
        /// - RANDOM_WALK: otherwise.
        /// </summary>
        public static FamilyStats Analyze(IReadOnlyList<LabBar> bars)
        {
            var r = Returns(bars);
            var sig = JumpScale(r);
            var mask = JumpMask(r);
            var jumps = r.Where((x, i) => mask[i]).ToList();
            var rest = r.Where((x, i) => !mask[i]).ToList();
            var jumpShare = r.Length > 0 ? (double)jumps.Count / r.Length : 0;
            var upShare = jumps.Count > 0 ? (double)jumps.Count(x => x > 0) / jumps.Count : double.NaN;
            var vr60 = VarianceRatio(rest, 60);
            string family;
            if (jumpShare >= 0.0002 && jumps.Count >= 10)
                family = upShare >= 0.8 ? "SPIKE_UP" : upShare <= 0.2 ? "SPIKE_DOWN" : "JUMP_SYMMETRIC";
            else family = vr60 > 1.3 ? "TRENDING_REGIMES" : vr60 < 0.75 ? "MEAN_REVERTING" : "RANDOM_WALK";
            return new FamilyStats(bars.Count, sig, jumpShare, upShare, jumps.Count > 0 ? 100 * jumps.Average(Math.Abs) : 0,
                rest.Count > 0 ? 100 * rest.Average() : 0, r.Length > 0 ? 100 * r.Average() : 0,
                VarianceRatio(rest, 5), VarianceRatio(rest, 15), vr60, Autocorrelation(rest, 1), family);
        }

        /// <summary>
        /// Drift-follow (for spike markets): enter at a bar close in direction dir, only when no position is open and,
        /// if afterSpikeBars > 0, only within that many bars after a jump against dir. Take profit tpAtr x ATR,
        /// stop slAtr x ATR (R = stop distance), close after maxBars.
        /// Same-bar stop and target: the standard OHLC path rule decides the order (a falling bar runs open, high,
        /// low, close; a rising bar open, low, high, close). Assuming "stop first" instead biases spike markets badly:
        /// their typical bar drifts first and spikes after. A stop overshot by more than half an ATR (a spike) fills at
        /// the bar's extreme, not at the stop. On a fair (martingale) spike market this leaves a small conservative
        /// bias of about -0.01 to -0.09R per trade (MarketLabTests), so a positive result is not a simulation artefact.
        /// </summary>
        public static LabTest DriftFollow(IReadOnlyList<LabBar> b, int dir, double tpAtr, double slAtr, int maxBars, double spread, int afterSpikeBars = 0)
        {
            var r = Returns(b); var mask = JumpMask(r);
            var res = new List<double>(); var lastSpike = -1_000_000;
            for (var i = 15; i < b.Count - 1;)
            {
                if (mask[i - 1] && r[i - 1] * dir < 0) lastSpike = i;
                if (afterSpikeBars > 0 && i - lastSpike > afterSpikeBars) { i++; continue; }
                var a = Atr(b, i, 14); if (!(a > 0)) { i++; continue; }
                var (outR, k) = Trade(b, i, dir, tpAtr * a, slAtr * a, a, maxBars, spread);
                res.Add(outR); i = k + 1;
            }
            return Summarise($"drift {(dir > 0 ? "long" : "short")} tp{tpAtr} sl{slAtr} max{maxBars}{(afterSpikeBars > 0 ? $" after-spike{afterSpikeBars}" : "")}", res);
        }

        /// <summary>
        /// One trade entered at bar i's close: target and stop distances in price, the OHLC path rule for a bar that
        /// touches both, a stop overshot by more than half an ATR filled at the bar's extreme, else closed after
        /// maxBars. Returns R (stop distance = 1R) after the spread, and the exit bar.
        /// </summary>
        private static (double R, int Exit) Trade(IReadOnlyList<LabBar> b, int i, int dir, double tpDist, double slDist, double atr, int maxBars, double spread)
        {
            double e = b[i].C, stop = e - dir * slDist, tp = e + dir * tpDist;
            var k = i + 1;
            for (; k < b.Count && k <= i + maxBars; k++)
            {
                var x = b[k];
                var hitStop = dir > 0 ? x.L <= stop : x.H >= stop;
                var hitTp = dir > 0 ? x.H >= tp : x.L <= tp;
                var stopFirst = hitStop && (!hitTp || (dir > 0 ? x.C >= x.O : x.C <= x.O));
                if (stopFirst)
                {
                    var extreme = dir > 0 ? x.L : x.H;
                    var px = Math.Abs(extreme - stop) > 0.5 * atr ? extreme : stop;
                    return ((dir * (px - e) - spread) / slDist, k);
                }
                if (hitTp) return ((dir * (tp - e) - spread) / slDist, k);
            }
            k = Math.Min(k, b.Count - 1);
            return ((dir * (b[k].C - e) - spread) / slDist, k);
        }

        /// <summary>
        /// Regime follow (for markets whose drift persists between jumps, e.g. Crash Boom Flip): the direction is the
        /// sign of the last `lookback` bars' returns with jumps left out, taken only when that drift exceeds
        /// z x scale x sqrt(lookback). Target tpAtr x ATR, stop slAtr x ATR, close after maxBars.
        /// </summary>
        public static LabTest RegimeFollow(IReadOnlyList<LabBar> b, int lookback, double z, double tpAtr, double slAtr, int maxBars, double spread)
        {
            var r = Returns(b); var mask = JumpMask(r); var scale = JumpScale(r.Where((x, i) => !mask[i]).ToList());
            var res = new List<double>();
            for (var i = Math.Max(lookback, 15); i < b.Count - 1;)
            {
                double drift = 0; for (var k = i - lookback; k < i; k++) if (!mask[k]) drift += r[k];
                if (!(scale > 0) || Math.Abs(drift) < z * scale * Math.Sqrt(lookback)) { i++; continue; }
                var a = Atr(b, i, 14); if (!(a > 0)) { i++; continue; }
                var (outR, exit) = Trade(b, i, Math.Sign(drift), tpAtr * a, slAtr * a, a, maxBars, spread);
                res.Add(outR); i = exit + 1;
            }
            return Summarise($"regime lb{lookback} z{z} tp{tpAtr} sl{slAtr} max{maxBars}", res);
        }

        /// <summary>
        /// Momentum (follow = true) or fade (follow = false) of the last `lookback` bars when that move exceeds
        /// z x sigma x sqrt(lookback); hold `hold` bars, exit at the close. R = 2 x ATR at entry (a notional unit, no stop).
        /// </summary>
        public static LabTest Momentum(IReadOnlyList<LabBar> b, int lookback, double z, int hold, double spread, bool follow)
        {
            var r = Returns(b); var sig = JumpScale(r); var res = new List<double>();
            for (var i = Math.Max(lookback, 15); i + hold < b.Count;)
            {
                var move = b[i].C / b[i - lookback].C - 1;
                if (!(sig > 0) || Math.Abs(move) < z * sig * Math.Sqrt(lookback)) { i++; continue; }
                var dir = Math.Sign(move) * (follow ? 1 : -1); var a = Atr(b, i, 14); if (!(a > 0)) { i++; continue; }
                res.Add((dir * (b[i + hold].C - b[i].C) - spread) / (2 * a)); i += hold;
            }
            return Summarise($"{(follow ? "momentum" : "fade")} lb{lookback} z{z} hold{hold}", res);
        }

        public static double Atr(IReadOnlyList<LabBar> b, int i, int n)
        {
            if (i < n) return double.NaN; double s = 0;
            for (var k = i - n + 1; k <= i; k++) s += Math.Max(b[k].H - b[k].L, Math.Max(Math.Abs(b[k].H - b[k - 1].C), Math.Abs(b[k].L - b[k - 1].C)));
            return s / n;
        }

        public static LabTest Summarise(string name, IReadOnlyList<double> rs)
        {
            if (rs.Count == 0) return new LabTest(name, 0, 0, 0, 0, 0);
            var m = rs.Average(); var sd = rs.Count > 1 ? Math.Sqrt(rs.Sum(x => (x - m) * (x - m)) / (rs.Count - 1)) : 0;
            var gw = rs.Where(x => x > 0).Sum(); var gl = -rs.Where(x => x < 0).Sum();
            return new LabTest(name, rs.Count, m, sd / Math.Sqrt(rs.Count), (double)rs.Count(x => x > 0) / rs.Count, gl > 0 ? gw / gl : double.PositiveInfinity);
        }

        /// <summary>
        /// The standard battery for a family: drift-follow for spike markets; regime-follow where the drift between
        /// jumps persists (VR(60) above 1.3); momentum and fade for all.
        /// </summary>
        public static IReadOnlyList<LabTest> Battery(IReadOnlyList<LabBar> b, FamilyStats f, double spread)
        {
            var tests = new List<LabTest>();
            if (f.Family is "SPIKE_UP" or "SPIKE_DOWN")
            {
                var dir = f.Family == "SPIKE_UP" ? -1 : 1;   // drift runs against the spikes
                foreach (var (tp, sl) in new[] { (0.5, 1.0), (1.0, 1.0), (1.0, 2.0), (2.0, 2.0), (0.5, 3.0) })
                {
                    tests.Add(DriftFollow(b, dir, tp, sl, 60, spread));
                    tests.Add(DriftFollow(b, dir, tp, sl, 60, spread, afterSpikeBars: 5));
                }
            }
            if (f.Vr60 > 1.3)
                foreach (var lb in new[] { 15, 60 }) foreach (var (tp, sl) in new[] { (1.0, 1.0), (2.0, 1.0) })
                    tests.Add(RegimeFollow(b, lb, 1.5, tp, sl, 60, spread));
            foreach (var lb in new[] { 5, 15, 60 }) foreach (var hold in new[] { 5, 15, 60 })
            {
                tests.Add(Momentum(b, lb, 1.5, hold, spread, follow: true));
                tests.Add(Momentum(b, lb, 1.5, hold, spread, follow: false));
            }
            return tests;
        }

        /// <summary>Minimum t for an edge candidate: many rules are tested per symbol, so ordinary 2-sigma results are noise.</summary>
        public const double CandidateT = 3.5;

        /// <summary>
        /// The battery on the whole history and on each half separately, ranked by t. A rule is an edge candidate only
        /// if t >= CandidateT on the whole history AND its average is positive in both halves (an edge that lives in one
        /// week only is a regime accident, not a property of the market).
        /// </summary>
        public static IReadOnlyList<LabCandidate> Candidates(IReadOnlyList<LabBar> b, FamilyStats f, double spread, int minTrades = 100)
        {
            var half = b.Count / 2;
            var first = Battery(b.Take(half).ToList(), f, spread).ToDictionary(t => t.Name);
            var second = Battery(b.Skip(half).ToList(), f, spread).ToDictionary(t => t.Name);
            return Battery(b, f, spread).Where(t => t.Trades >= minTrades)
                .Select(t => new LabCandidate(t, first.TryGetValue(t.Name, out var x) ? x.AvgR : double.NaN, second.TryGetValue(t.Name, out var y) ? y.AvgR : double.NaN))
                .OrderByDescending(c => c.Test.T).ToList();
        }

        /// <summary>
        /// The symbols for one run. Matching is by keyword (case-insensitive substring), ordered by the first keyword
        /// each symbol matches, then by name, so the keyword order is the priority order. Runs are batches because a
        /// cTrader cloud instance keeps every loaded bar series in memory until the cBot stops: one run over ~60
        /// synthetics x 14 days of M1 bars ran out of memory (2026-10-10). <paramref name="first"/> is 1-based.
        /// </summary>
        public static (IReadOnlyList<string> Batch, int Total) SelectSymbols(IEnumerable<string> brokerSymbols, string? keywordsText, int first, int max)
        {
            var keys = (keywordsText ?? "").Split(',').Select(k => k.Trim()).Where(k => k.Length > 0).ToList();
            var all = brokerSymbols
                .Select(n => (n, rank: keys.FindIndex(k => n.IndexOf(k, StringComparison.OrdinalIgnoreCase) >= 0)))
                .Where(x => x.rank >= 0).OrderBy(x => x.rank).ThenBy(x => x.n, StringComparer.Ordinal).Select(x => x.n).Distinct().ToList();
            return (all.Skip(Math.Max(0, first - 1)).Take(Math.Max(0, max)).ToList(), all.Count);
        }

        private static double Var(IReadOnlyList<double> x) { if (x.Count < 2) return 0; var m = x.Average(); return x.Sum(v => (v - m) * (v - m)) / (x.Count - 1); }
        private static double Median(IReadOnlyList<double> x) { var s = x.OrderBy(v => v).ToList(); var n = s.Count; return n == 0 ? 0 : n % 2 == 1 ? s[n / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
    }
}
