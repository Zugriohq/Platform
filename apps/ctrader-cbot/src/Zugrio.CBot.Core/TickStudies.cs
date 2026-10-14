using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// Cycle 1 tick studies on the broker's own bid/ask ticks (research, no trading authority; research/deriv/
    /// cycle1_rangebreak_prereg.json and cycle1_trek_volswitch_prereg.json). Each returns printable lines.
    /// </summary>
    public static class TickStudies
    {
        private static readonly CultureInfo Ci = CultureInfo.InvariantCulture;
        private static double Mid(LabTick t) => (t.Bid + t.Ask) / 2;

        /// <summary>
        /// Range Break A2 on bid/ask ticks: within a segment (ticks between jumps of more than jumpPts in mid price), the
        /// established floor is the lowest mid so far once visited 3 times (ceiling mirrored). At a floor touch buy at the
        /// ask (at a ceiling sell at the bid); exit after H ticks or at the first jump, at the bid (ask). One trade at a time.
        /// Returns the average in price points and a t clustered by segment (none below 5 segments).
        /// </summary>
        public static IReadOnlyList<string> RangeBreak(IReadOnlyList<LabTick> ticks, double jumpPts = 1.5)
        {
            var lines = new List<string>();
            var n = ticks.Count; if (n < 1000) { lines.Add($"only {n} ticks"); return lines; }
            var mids = ticks.Select(Mid).ToArray();
            bool IsJump(int i) => i > 0 && Math.Abs(mids[i] - mids[i - 1]) > jumpPts;
            var touches = new List<(int I, int Dir, int Seg)>(); int seg = 0, jumps = 0, through = 0, sided = 0;
            double lo = double.MaxValue, hi = double.MinValue; int loV = 0, hiV = 0;
            for (var i = 0; i < n; i++)
            {
                if (IsJump(i))
                {
                    jumps++; var prev = mids[i - 1]; var d = mids[i] - prev;
                    if (loV >= 3 && Math.Abs(prev - lo) < 1e-9) { sided++; if (d < 0) through++; }
                    else if (hiV >= 3 && Math.Abs(prev - hi) < 1e-9) { sided++; if (d > 0) through++; }
                    seg++; lo = double.MaxValue; hi = double.MinValue; loV = hiV = 0;
                }
                var p = mids[i];
                if (p < lo - 1e-9) { lo = p; loV = 0; }
                if (p > hi + 1e-9) { hi = p; hiV = 0; }
                if (Math.Abs(p - lo) < 1e-9 && ++loV >= 3) touches.Add((i, 1, seg));
                if (Math.Abs(p - hi) < 1e-9 && ++hiV >= 3) touches.Add((i, -1, seg));
            }
            var hours = (ticks[n - 1].T - ticks[0].T).TotalHours;
            var spreads = ticks.Select(t => t.Ask - t.Bid).OrderBy(x => x).ToArray();
            lines.Add($"{n} ticks over {hours.ToString("F1", Ci)} h; {jumps} jumps ({(jumps / Math.Max(hours, 1e-9)).ToString("F2", Ci)}/h), {seg + 1} ranges, {touches.Count} boundary touches; " +
                      $"breaks from a boundary going through it {through} of {sided}; spread median {spreads[n / 2].ToString("G4", Ci)}, 95th pct {spreads[(int)(0.95 * (n - 1))].ToString("G4", Ci)}");
            foreach (var h in new[] { 60, 300, 900 })
            {
                var rows = new List<(double Pts, int Seg, bool Jumped)>(); var busy = -1;
                foreach (var (i, dir, s) in touches)
                {
                    if (i <= busy) continue;
                    var entry = dir > 0 ? ticks[i].Ask : ticks[i].Bid; var x = Math.Min(n - 1, i + h); var jumped = false;
                    for (var m = i + 1; m <= Math.Min(n - 1, i + h); m++) if (IsJump(m)) { x = m; jumped = true; break; }
                    var exit = dir > 0 ? ticks[x].Bid : ticks[x].Ask;
                    rows.Add((dir * (exit - entry), s, jumped)); busy = x;
                }
                lines.Add($"hold {h} ticks: " + Clustered(rows.Select(r => (r.Pts, r.Seg)).ToList()) + $"; {rows.Count(r => r.Jumped)} ended by a jump");
            }
            return lines;
        }

        /// <summary>Mean, t clustered by group (no t below 5 groups), n and groups, formatted.</summary>
        public static string Clustered(IReadOnlyList<(double V, int G)> rows)
        {
            var n = rows.Count; if (n < 2) return $"{n} trades";
            var m = rows.Average(r => r.V); var by = new Dictionary<int, double>();
            foreach (var r in rows) by[r.G] = (by.TryGetValue(r.G, out var v) ? v : 0) + (r.V - m);
            var se = Math.Sqrt(by.Values.Sum(v => v * v)) / n;
            var t = by.Count >= 5 && se > 0 ? (m / se).ToString("F1", Ci) : "n/a (under 5 groups)";
            return $"{n} trades, avg {m.ToString("+0.000;-0.000", Ci)} points, t {t}, {by.Count} groups";
        }

        /// <summary>
        /// Trek (Experiment C): unconditional mid changes over non-overlapping 1-minute, 15-minute and 1-hour slots; one-minute
        /// tails beyond 5 robust sigmas; and the registered rule: hold one hour in the name's direction, entered at the ask
        /// (bid) and closed at the bid (ask) of the first tick of each hour slot, reported for each half.
        /// </summary>
        public static IReadOnlyList<string> Trek(IReadOnlyList<LabTick> ticks, int dir)
        {
            var lines = new List<string>(); if (ticks.Count < 1000) { lines.Add($"only {ticks.Count} ticks"); return lines; }
            foreach (var (label, sec) in new[] { ("1 min", 60), ("15 min", 900), ("1 h", 3600) })
            {
                var ch = Slots(ticks, sec).Select(p => Mid(p.B) - Mid(p.A)).ToList();
                if (ch.Count < 3) continue;
                var m = ch.Average(); var sd = Math.Sqrt(ch.Sum(x => (x - m) * (x - m)) / (ch.Count - 1));
                lines.Add($"{label}: {ch.Count} slots, mean {m.ToString("+0.0000;-0.0000", Ci)} (t {(sd > 0 ? m / (sd / Math.Sqrt(ch.Count)) : 0).ToString("F1", Ci)}), median {Median(ch).ToString("+0.0000;-0.0000", Ci)}, {(100.0 * ch.Count(x => x > 0) / ch.Count).ToString("F0", Ci)}% up");
            }
            var mins = Slots(ticks, 60).Select(p => Mid(p.B) - Mid(p.A)).ToList();
            var med = Median(mins); var s = 1.4826 * Median(mins.Select(x => Math.Abs(x - med)).ToList());
            if (s > 0)
            {
                var big = mins.Select(x => (x - med) / s).ToList();
                var lag = 0; for (var i = 1; i < big.Count; i++) if (Math.Abs(big[i]) > 5 && Math.Abs(big[i - 1]) > 5) lag++;
                lines.Add($"one-minute tails beyond 5 robust sigmas: {big.Count(z => z > 5)} up, {big.Count(z => z < -5)} down, {lag} back to back");
            }
            var sp = ticks.Select(t => t.Ask - t.Bid).OrderBy(x => x).ToArray();
            lines.Add($"spread mean {sp.Average().ToString("G4", Ci)}, median {sp[sp.Length / 2].ToString("G4", Ci)}, 95th pct {sp[(int)(0.95 * (sp.Length - 1))].ToString("G4", Ci)}");
            var hours = Slots(ticks, 3600).Select(p => dir > 0 ? p.B.Bid - p.A.Ask : p.A.Bid - p.B.Ask).ToList();
            var half = hours.Count / 2;
            lines.Add($"rule {(dir > 0 ? "long" : "short")} 1 h, net: all {Plain(hours)}; first half {Plain(hours.Take(half).ToList())}; second half {Plain(hours.Skip(half).ToList())}; " +
                      $"hourly mean / median spread {(hours.Count > 0 ? (hours.Average() + Median(sp)) / Median(sp) : double.NaN).ToString("F2", Ci)} (gross mean over spread)");
            return lines;
        }

        /// <summary>
        /// Volatility Switch (Experiment D): one-minute realised volatility (root of summed squared tick changes); its
        /// autocorrelation at 1, 5, 15 and 60 minutes; tercile-regime run lengths (runs of 3+ minutes); and whether the last
        /// minute's realised volatility forecasts the next 15 minutes' better than ATR14 of M1 mid bars (bias-corrected
        /// mean absolute log error ratio, per half).
        /// </summary>
        public static IReadOnlyList<string> VolSwitch(IReadOnlyList<LabTick> ticks)
        {
            var lines = new List<string>(); if (ticks.Count < 5000) { lines.Add($"only {ticks.Count} ticks"); return lines; }
            var rv = new List<double>(); var bars = new List<LabBar>(); var minute = DateTime.MinValue; double ss = 0, o = 0, h = 0, l = 0, c = 0; double prev = double.NaN;
            foreach (var t in ticks)
            {
                var m = new DateTime(t.T.Ticks - t.T.Ticks % TimeSpan.TicksPerMinute); var p = Mid(t);
                if (m != minute)
                {
                    if (minute != DateTime.MinValue) { rv.Add(Math.Sqrt(ss)); bars.Add(new LabBar(o, h, l, c)); }
                    minute = m; ss = 0; o = h = l = c = p;
                }
                if (!double.IsNaN(prev)) ss += (p - prev) * (p - prev);
                h = Math.Max(h, p); l = Math.Min(l, p); c = p; prev = p;
            }
            lines.Add($"{rv.Count} minutes; realised-volatility autocorrelation: " + string.Join(", ", new[] { 1, 5, 15, 60 }.Select(k => $"lag {k} {MarketLab.Autocorrelation(rv, k).ToString("F2", Ci)}")));
            var sorted = rv.OrderBy(x => x).ToList(); double t1 = sorted[sorted.Count / 3], t2 = sorted[2 * sorted.Count / 3];
            var runs = new List<int>(); var cur = -1; var len = 0;
            foreach (var x in rv) { var r = x < t1 ? 0 : x < t2 ? 1 : 2; if (r == cur) len++; else { if (len >= 3) runs.Add(len); cur = r; len = 1; } }
            lines.Add(runs.Count > 0 ? $"tercile regimes (runs of 3+ minutes): {runs.Count}, median {Median(runs.Select(x => (double)x).ToList()).ToString("F0", Ci)} min, mean {runs.Average().ToString("F1", Ci)} min, longest {runs.Max()} min" : "no regime runs of 3+ minutes");
            var errA = new List<double>(); var errB = new List<double>();
            for (var i = 15; i + 15 < rv.Count; i++)
            {
                var target = Math.Sqrt(rv.Skip(i + 1).Take(15).Sum(x => x * x)); var fa = rv[i] * Math.Sqrt(15); var fb = MarketLab.Atr(bars, i, 14);
                if (target > 0 && fa > 0 && fb > 0) { errA.Add(Math.Log(target / fa)); errB.Add(Math.Log(target / fb)); }
            }
            string Ratio(List<double> a, List<double> b)
            {
                if (a.Count < 10) return "-"; var ma = a.Average(); var mb = b.Average();
                return (a.Average(x => Math.Abs(x - ma)) / b.Average(x => Math.Abs(x - mb))).ToString("F2", Ci);
            }
            var hh = errA.Count / 2;
            lines.Add($"last-minute volatility vs ATR14 forecasting the next 15 minutes: error ratio first half {Ratio(errA.Take(hh).ToList(), errB.Take(hh).ToList())}, second half {Ratio(errA.Skip(hh).ToList(), errB.Skip(hh).ToList())} (below 0.9 in both = regime information beats ATR14)");
            return lines;
        }

        private static IEnumerable<(LabTick A, LabTick B)> Slots(IReadOnlyList<LabTick> ticks, int seconds)
        {
            var span = TimeSpan.FromSeconds(seconds); var start = ticks[0].T; LabTick? first = null; var slotEnd = start + span;
            first = ticks[0];
            for (var i = 1; i < ticks.Count; i++)
            {
                if (ticks[i].T >= slotEnd)
                {
                    yield return (first.Value, ticks[i]);
                    first = ticks[i]; while (slotEnd <= ticks[i].T) slotEnd += span;
                }
            }
        }

        private static string Plain(IReadOnlyList<double> v)
        {
            if (v.Count < 2) return $"{v.Count} hours"; var m = v.Average(); var sd = Math.Sqrt(v.Sum(x => (x - m) * (x - m)) / (v.Count - 1));
            return $"{v.Count} hours, avg {m.ToString("+0.000;-0.000", Ci)} t {(sd > 0 ? m / (sd / Math.Sqrt(v.Count)) : 0).ToString("F1", Ci)}";
        }

        private static double Median(IReadOnlyList<double> x) { if (x.Count == 0) return double.NaN; var s = x.OrderBy(v => v).ToList(); return s.Count % 2 == 1 ? s[s.Count / 2] : (s[s.Count / 2 - 1] + s[s.Count / 2]) / 2; }
    }
}
