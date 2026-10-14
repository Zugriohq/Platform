using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace Zugrio.CBot.Core
{
    /// <summary>The Deriv synthetic families, as Deriv describes them (research/deriv/FAMILIES.md).</summary>
    public enum DerivFamily { Unknown, Volatility, Boom, Crash, Hybrid, Dex, Jump, Step, MultiStep, SkewStep, RangeBreak, DriftSwitch, VolatilitySwitch, Trek, DailyReset }

    /// <summary>
    /// One broker symbol read as a Deriv product: its family, the number in its name (Boom 500: 500 ticks; Drift Switch
    /// 20: 20 minutes; Range Break 100: 100 boundary hits; DEX 600: 600 seconds; Jump 25: 25% volatility), and the
    /// direction its name declares (Boom, DEX UP, Trek Up, Bull: +1; Crash, DEX DOWN, Trek Down, Bear: -1; else 0).
    /// </summary>
    public sealed record DerivProduct(string Name, DerivFamily Family, double Number, int Direction)
    {
        /// <summary>Deriv's own description (deriv.com/markets/derived-indices/synthetic-indices, read 2026-10-14).</summary>
        public string Declared => Behaviour.Declared(Family);
    }

    /// <summary>What one symbol's own M1 history shows, measured against what its family is declared to do.</summary>
    public sealed record BehaviourProfile(DerivProduct Product, int Bars, double Spread, double SigmaPrice, double SpreadSigmas,
        double JumpsPerHour, double UpJumpShare, double MeanJumpPrice, double LateEarlyHazard, double HazardZ,
        double Vr5, double Vr15, double Vr60, double Vr240, double Autocorr1, double VolPersistence60, double DriftPerHourPrice, double NetPerHourPrice, double NetPerHourZ);

    /// <summary>
    /// The family behaviour study (research, no trading authority; behaviour_prereg.json). Every family gets only the
    /// rules its declared mechanism implies, fixed before any result, so few rules are tested per symbol:
    /// - Drift Switch: momentum at the declared regime length (regimes that last should be worth following);
    /// - Range Break: fade at the edge of the recent range, and follow a break of it;
    /// - Boom, Crash, DEX, Hybrid: TTI's "overdue spike" rule, and following the drift between spikes;
    /// - Jump: TTI's "jump recent" signal, followed and faded;
    /// - Step and Multi Step: TTI's "streak" signal, followed and faded;
    /// - Skew Step, Trek, Daily Reset: holding in the declared (or either) direction;
    /// - Volatility, Volatility Switch and anything else: a momentum and a fade control.
    /// Results are R after the current spread, on the whole history and on each half (MarketLab.Candidates' rule).
    /// </summary>
    public static class Behaviour
    {
        public static DerivProduct Classify(string name)
        {
            var n = name.ToLowerInvariant();
            var num = Regex.Match(n, @"\d+(\.\d+)?");
            var number = num.Success ? double.Parse(num.Value, CultureInfo.InvariantCulture) : double.NaN;
            int Dir(string up, string down) => Regex.IsMatch(n, $@"\b{up}\b") ? 1 : Regex.IsMatch(n, $@"\b{down}\b") ? -1 : 0;
            DerivFamily f;
            var dir = 0;
            if (n.Contains("drift switch") || Regex.IsMatch(n, @"\bdsi\s?\d")) f = DerivFamily.DriftSwitch;
            else if (n.Contains("range break")) f = DerivFamily.RangeBreak;
            else if (n.Contains("vol over") || n.Contains("volatility over") || n.Contains("hybrid")) { f = DerivFamily.Hybrid; dir = n.Contains("boom") ? 1 : n.Contains("crash") ? -1 : 0; }
            else if (Regex.IsMatch(n, @"\bdex\b")) { f = DerivFamily.Dex; dir = Dir("up", "down"); }
            else if (n.Contains("skew step")) { f = DerivFamily.SkewStep; dir = Dir("up", "down"); }
            else if (n.Contains("multi step")) f = DerivFamily.MultiStep;
            else if (n.Contains("step")) f = DerivFamily.Step;
            else if (n.Contains("jump")) f = DerivFamily.Jump;
            else if (n.Contains("boom") && n.Contains("crash")) f = DerivFamily.Unknown;   // e.g. Crash Boom Flip: not on Deriv's family page
            else if (n.Contains("boom")) { f = DerivFamily.Boom; dir = 1; }
            else if (n.Contains("crash")) { f = DerivFamily.Crash; dir = -1; }
            else if (n.Contains("trek")) { f = DerivFamily.Trek; dir = Dir("up", "down"); }
            else if (n.Contains("bull") || n.Contains("bear") || n.Contains("daily reset")) { f = DerivFamily.DailyReset; dir = Dir("bull", "bear"); }
            else if (n.Contains("volatility switch") || n.Contains("vol switch") || Regex.IsMatch(n, @"\bvsi\b")) f = DerivFamily.VolatilitySwitch;
            else if (n.Contains("volatility") || Regex.IsMatch(n, @"\bvol\b")) f = DerivFamily.Volatility;
            else f = DerivFamily.Unknown;
            return new DerivProduct(name, f, number, dir);
        }

        public static string Declared(DerivFamily f) => f switch
        {
            DerivFamily.Volatility => "constant volatility from 10% to 250%; ticks every 2 s, or every 1 s for (1s)",
            DerivFamily.Boom => "rapid surges; 50-1,000 ticks set how often, on average, the market booms",
            DerivFamily.Crash => "sudden downturns; 50-1,000 ticks set how often, on average, the market crashes",
            DerivFamily.Hybrid => "the predictability of Crash/Boom indices with a 20% volatility boost",
            DerivFamily.Dex => "dramatic spikes and drops every 10, 15 or 25 minutes on average, smaller fluctuations in between",
            DerivFamily.Jump => "prices leap every 20 minutes on average, equal chance up or down, about 30x the index's normal volatility",
            DerivFamily.Step => "each tick steps up or down by a fixed 0.1-0.5",
            DerivFamily.MultiStep => "typically 0.1 steps, less often 0.2, 0.25, 0.3 or 0.5",
            DerivFamily.SkewStep => "asymmetric step sizes and probabilities: 80-90% small shifts, 10-20% sharp movements",
            DerivFamily.RangeBreak => "bounces between upper and lower boundaries, breaking to a new range every 100 or 200 boundary hits on average",
            DerivFamily.DriftSwitch => "shifts between bullish, bearish and sideways trends lasting 10, 20 or 30 minutes on average",
            DerivFamily.VolatilitySwitch => "volatility levels such as 10%, 50% or 100%, each lasting 5-60 minutes on average",
            DerivFamily.Trek => "mostly small changes, skewed toward larger moves in one direction; built-in directional bias",
            DerivFamily.DailyReset => "simplified bull (rising) or bear (falling) trends; resets daily to a baseline",
            _ => "not described on Deriv's family page",
        };

        /// <summary>The measurements, on M1 bars. Prices are in the symbol's own units; jumps use MarketLab's jump mask.</summary>
        public static BehaviourProfile Profile(DerivProduct p, IReadOnlyList<LabBar> b, double spread)
        {
            var r = MarketLab.Returns(b);
            var mask = MarketLab.JumpMask(r);
            var dp = new double[r.Length];
            for (var i = 0; i < r.Length; i++) dp[i] = b[i + 1].C - b[i].C;
            var rest = Enumerable.Range(0, r.Length).Where(i => !mask[i]).Select(i => dp[i]).ToList();
            var jumps = Enumerable.Range(0, r.Length).Where(i => mask[i]).Select(i => dp[i]).ToList();
            var sigma = MarketLab.RobustSigma(rest);
            if (!(sigma > 0) && rest.Count > 1) sigma = Math.Sqrt(rest.Average(x => x * x));
            var (late, hz) = Hazard(mask);
            var abs = rest.Select(Math.Abs).ToList();
            var net = dp.Length > 1 ? dp.Average() : 0;
            var sdNet = dp.Length > 1 ? Math.Sqrt(dp.Sum(x => (x - net) * (x - net)) / (dp.Length - 1)) : 0;
            return new BehaviourProfile(p, b.Count, spread, sigma, sigma > 0 ? spread / sigma : double.NaN,
                r.Length > 0 ? 60.0 * jumps.Count / r.Length : 0, jumps.Count > 0 ? (double)jumps.Count(x => x > 0) / jumps.Count : double.NaN,
                jumps.Count > 0 ? jumps.Average(Math.Abs) : 0, late, hz,
                MarketLab.VarianceRatio(rest, 5), MarketLab.VarianceRatio(rest, 15), MarketLab.VarianceRatio(rest, 60), MarketLab.VarianceRatio(rest, 240),
                MarketLab.Autocorrelation(rest, 1), MarketLab.Autocorrelation(abs, 60),
                rest.Count > 0 ? 60 * rest.Average() : 0, 60 * net, sdNet > 0 ? net / (sdNet / Math.Sqrt(dp.Length)) : 0);
        }

        /// <summary>
        /// Is a jump "due"? The jump rate on bars whose wait since the last jump is above the median wait, over the rate
        /// below it, and a z for the difference. A memoryless generator gives about 1 (z near 0); "overdue" behaviour
        /// would give well above 1.
        /// </summary>
        public static (double Ratio, double Z) Hazard(IReadOnlyList<bool> mask)
        {
            var gaps = new List<int>(); var last = -1;
            for (var i = 0; i < mask.Count; i++) if (mask[i]) { if (last >= 0) gaps.Add(i - last); last = i; }
            if (gaps.Count < 10) return (double.NaN, double.NaN);
            var med = gaps.OrderBy(x => x).ElementAt(gaps.Count / 2) / 2.0;   // half the median gap: below it is "early", above it "late"
            int nE = 0, jE = 0, nL = 0, jL = 0; last = -1;
            for (var i = 0; i < mask.Count; i++)
            {
                if (last >= 0) { var w = i - last; if (w <= med) { nE++; if (mask[i]) jE++; } else { nL++; if (mask[i]) jL++; } }
                if (mask[i]) last = i;
            }
            if (nE == 0 || nL == 0 || jE + jL == 0) return (double.NaN, double.NaN);
            double pE = (double)jE / nE, pL = (double)jL / nL, p = (double)(jE + jL) / (nE + nL);
            var se = Math.Sqrt(p * (1 - p) * (1.0 / nE + 1.0 / nL));
            return (jE > 0 ? pL / pE : double.PositiveInfinity, se > 0 ? (pL - pE) / se : 0);   // no early jump at all: "due" in the extreme
        }

        /// <summary>The pre-registered rules for this product's family (behaviour_prereg.json).</summary>
        public static IReadOnlyList<LabTest> Rules(DerivProduct p, IReadOnlyList<LabBar> b, double spread)
        {
            var t = new List<LabTest>();
            switch (p.Family)
            {
                case DerivFamily.DriftSwitch:
                    var regime = double.IsNaN(p.Number) ? 20 : p.Number;   // minutes = M1 bars
                    var q = Math.Max(2, (int)Math.Round(regime / 4)); var h2 = Math.Max(3, (int)Math.Round(regime / 2));
                    foreach (var lb in new[] { q, h2 }) foreach (var hold in new[] { q, h2 }) t.Add(MarketLab.Momentum(b, lb, 1.0, hold, spread, follow: true));
                    break;
                case DerivFamily.RangeBreak:
                    foreach (var w in new[] { 30, 120 }) { t.Add(RangeFade(b, w, spread)); t.Add(RangeBreakFollow(b, w, spread)); }
                    break;
                case DerivFamily.Boom: case DerivFamily.Crash: case DerivFamily.Hybrid: case DerivFamily.Dex:
                    var spikeDir = p.Direction != 0 ? p.Direction : SpikeDirection(b);
                    if (spikeDir == 0) goto default;
                    t.Add(Overdue(b, spikeDir, 0.7, spread)); t.Add(Overdue(b, spikeDir, 1.0, spread));
                    t.Add(MarketLab.DriftFollow(b, -spikeDir, 1.0, 2.0, 60, spread)); t.Add(MarketLab.DriftFollow(b, -spikeDir, 0.5, 3.0, 60, spread));
                    break;
                case DerivFamily.Jump:
                    foreach (var hold in new[] { 5, 30 }) { t.Add(AfterJump(b, hold, spread, follow: true)); t.Add(AfterJump(b, hold, spread, follow: false)); }
                    break;
                case DerivFamily.Step: case DerivFamily.MultiStep:
                    foreach (var k in new[] { 5, 7 }) { t.Add(Streak(b, k, 5, spread, follow: true)); t.Add(Streak(b, k, 5, spread, follow: false)); }
                    break;
                case DerivFamily.SkewStep: case DerivFamily.Trek: case DerivFamily.DailyReset:
                    foreach (var d in p.Direction != 0 ? new[] { p.Direction } : new[] { 1, -1 })
                        foreach (var hold in new[] { 60, 240 }) t.Add(Hold(b, d, hold, spread));
                    break;
                default:
                    t.Add(MarketLab.Momentum(b, 15, 1.5, 15, spread, follow: true)); t.Add(MarketLab.Momentum(b, 15, 1.5, 15, spread, follow: false));
                    break;
            }
            return t;
        }

        /// <summary>The rules on the whole history and on each half, ranked by t (MarketLab.Candidates' pass rule).</summary>
        public static IReadOnlyList<LabCandidate> Candidates(DerivProduct p, IReadOnlyList<LabBar> b, double spread, int minTrades = 50)
        {
            var half = b.Count / 2;
            var first = Rules(p, b.Take(half).ToList(), spread).ToDictionary(x => x.Name);
            var second = Rules(p, b.Skip(half).ToList(), spread).ToDictionary(x => x.Name);
            return Rules(p, b, spread).Where(x => x.Trades >= minTrades)
                .Select(x => new LabCandidate(x, first.TryGetValue(x.Name, out var a) ? a.AvgR : double.NaN, second.TryGetValue(x.Name, out var c) ? c.AvgR : double.NaN))
                .OrderByDescending(c => c.Test.T).ToList();
        }

        /// <summary>
        /// Range fade: the range is the last w bars' high and low. A close in its top (bottom) 10% sells (buys), target the
        /// middle, stop a quarter of the width beyond the edge, closed after w bars. Ranges narrower than 4 spreads are skipped.
        /// </summary>
        public static LabTest RangeFade(IReadOnlyList<LabBar> b, int w, double spread)
        {
            var res = new List<double>();
            for (var i = w + 15; i < b.Count - 1;)
            {
                var (hi, lo) = Range(b, i, w); var width = hi - lo; var c = b[i].C; var a = MarketLab.Atr(b, i, 14);
                if (!(width > 4 * spread) || !(a > 0)) { i++; continue; }
                var pos = (c - lo) / width;
                if (pos < 0.9 && pos > 0.1) { i++; continue; }
                var dir = pos >= 0.9 ? -1 : 1;
                var mid = (hi + lo) / 2; var stop = dir < 0 ? hi + 0.25 * width : lo - 0.25 * width;
                var (rr, exit) = MarketLab.Trade(b, i, dir, Math.Abs(c - mid), Math.Abs(stop - c), a, w, spread);
                res.Add(rr); i = exit + 1;
            }
            return MarketLab.Summarise($"range fade w{w}", res);
        }

        /// <summary>Range break: a close beyond the last w bars' range by 10% of its width is followed; target one width, stop back a quarter width inside the old edge.</summary>
        public static LabTest RangeBreakFollow(IReadOnlyList<LabBar> b, int w, double spread)
        {
            var res = new List<double>();
            for (var i = w + 15; i < b.Count - 1;)
            {
                var (hi, lo) = Range(b, i, w); var width = hi - lo; var c = b[i].C; var a = MarketLab.Atr(b, i, 14);
                if (!(width > 4 * spread) || !(a > 0)) { i++; continue; }
                var dir = c > hi + 0.1 * width ? 1 : c < lo - 0.1 * width ? -1 : 0;
                if (dir == 0) { i++; continue; }
                var stop = dir > 0 ? hi - 0.25 * width : lo + 0.25 * width;
                var (rr, exit) = MarketLab.Trade(b, i, dir, width, Math.Abs(c - stop), a, w, spread);
                res.Add(rr); i = exit + 1;
            }
            return MarketLab.Summarise($"range break w{w}", res);
        }

        private static (double Hi, double Lo) Range(IReadOnlyList<LabBar> b, int i, int w)
        {
            double hi = double.MinValue, lo = double.MaxValue;
            for (var k = i - w; k < i; k++) { hi = Math.Max(hi, b[k].H); lo = Math.Min(lo, b[k].L); }
            return (hi, lo);
        }

        /// <summary>
        /// TTI's "overdue spike" (assetIntel): enter in the spike direction once the wait since the last spike exceeds
        /// k x the average gap so far; close at the first spike bar or after one average gap. R = the average spike size so
        /// far (all estimates use only bars before the entry). On a memoryless generator this loses the drift and the spread.
        /// </summary>
        public static LabTest Overdue(IReadOnlyList<LabBar> b, int spikeDir, double k, double spread)
        {
            var r = MarketLab.Returns(b); var mask = MarketLab.JumpMask(r); var res = new List<double>();
            int last = -1, count = 0; double gapSum = 0, sizeSum = 0;
            void Seen(int j) { if (last >= 0) { gapSum += j - last; count++; } sizeSum += Math.Abs(b[j + 1].C - b[j].C); last = j; }
            for (var i = 1; i < b.Count - 1;)
            {
                var j = i - 1;   // r[j] is bar i's move
                if (mask[j] && Math.Sign(r[j]) == spikeDir) Seen(j);
                if (count < 5 || last < 0) { i++; continue; }
                var gap = gapSum / count; var unit = sizeSum / (count + 1);
                if (i - 1 - last < k * gap || !(unit > 0)) { i++; continue; }
                var e = b[i].C; var exit = Math.Min(b.Count - 1, i + (int)Math.Ceiling(gap));
                for (var m = i + 1; m <= exit; m++) if (mask[m - 1] && Math.Sign(r[m - 1]) == spikeDir) { exit = m; break; }
                res.Add((spikeDir * (b[exit].C - e) - spread) / unit);
                for (var m = i + 1; m <= exit; m++) if (mask[m - 1] && Math.Sign(r[m - 1]) == spikeDir) Seen(m - 1);
                i = exit + 1;
            }
            return MarketLab.Summarise($"overdue x{k.ToString(CultureInfo.InvariantCulture)} (TTI)", res);
        }

        /// <summary>TTI's "jump recent": after a jump bar, follow (or fade) its direction for `hold` bars. R = 2 x ATR before the jump.</summary>
        public static LabTest AfterJump(IReadOnlyList<LabBar> b, int hold, double spread, bool follow)
        {
            var r = MarketLab.Returns(b); var mask = MarketLab.JumpMask(r); var res = new List<double>();
            for (var i = 16; i + hold < b.Count;)
            {
                if (!mask[i - 1]) { i++; continue; }
                var a = MarketLab.Atr(b, i - 1, 14); if (!(a > 0)) { i++; continue; }
                var dir = Math.Sign(r[i - 1]) * (follow ? 1 : -1);
                res.Add((dir * (b[i + hold].C - b[i].C) - spread) / (2 * a)); i += hold;
            }
            return MarketLab.Summarise($"after jump {(follow ? "follow" : "fade")} hold{hold} (TTI)", res);
        }

        /// <summary>TTI's "streak": after k bars closing the same way, follow (or fade) for `hold` bars. R = 2 x ATR.</summary>
        public static LabTest Streak(IReadOnlyList<LabBar> b, int k, int hold, double spread, bool follow)
        {
            var res = new List<double>();
            for (var i = Math.Max(k + 1, 15); i + hold < b.Count;)
            {
                var s = Math.Sign(b[i].C - b[i - 1].C); var run = s != 0;
                for (var m = 1; m < k && run; m++) run = Math.Sign(b[i - m].C - b[i - m - 1].C) == s;
                var a = MarketLab.Atr(b, i, 14);
                if (!run || !(a > 0)) { i++; continue; }
                var dir = s * (follow ? 1 : -1);
                res.Add((dir * (b[i + hold].C - b[i].C) - spread) / (2 * a)); i += hold;
            }
            return MarketLab.Summarise($"streak{k} {(follow ? "follow" : "fade")} hold{hold} (TTI)", res);
        }

        /// <summary>Hold in direction dir for `hold` bars, back to back. R = 2 x ATR at entry.</summary>
        public static LabTest Hold(IReadOnlyList<LabBar> b, int dir, int hold, double spread)
        {
            var res = new List<double>();
            for (var i = 15; i + hold < b.Count; i += hold)
            {
                var a = MarketLab.Atr(b, i, 14); if (!(a > 0)) continue;
                res.Add((dir * (b[i + hold].C - b[i].C) - spread) / (2 * a));
            }
            return MarketLab.Summarise($"hold {(dir > 0 ? "long" : "short")} {hold} bars", res);
        }

        /// <summary>Direction of the jumps when the name does not say: +1 if at least 80% go up, -1 if at least 80% go down, else 0.</summary>
        public static int SpikeDirection(IReadOnlyList<LabBar> b)
        {
            var r = MarketLab.Returns(b); var mask = MarketLab.JumpMask(r);
            var js = r.Where((x, i) => mask[i]).ToList(); if (js.Count < 10) return 0;
            var up = (double)js.Count(x => x > 0) / js.Count;
            return up >= 0.8 ? 1 : up <= 0.2 ? -1 : 0;
        }
    }
}
