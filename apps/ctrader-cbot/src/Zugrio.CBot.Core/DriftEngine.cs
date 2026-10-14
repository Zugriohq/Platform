using System;
using System.Collections.Generic;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// The Drift Switch rule (research/deriv/FAMILIES.md, family study 2026-10-14; UNVALIDATED_RESEARCH until the demo
    /// record supports it): lookback L and hold H of a quarter and half of the index's declared regime length in minutes,
    /// on closed M1 bars; signal when |close / close L bars ago - 1| >= Z x sigma x sqrt(L), sigma the robust sigma of the
    /// last SigmaBars one-minute returns; follow it for H minutes with a protective stop StopAtr x ATR14(M1).
    /// On Deriv's feed (90 days) this gained +0.9 to +1.15R (R = 2 x ATR14) per trade at the published min spread with
    /// this stop and causal sigma, in both the 21-day registered and the 69-day confirmation windows.
    /// </summary>
    public sealed record DriftRule(int Lookback, int Hold, double Z = 1.0, int SigmaBars = 1440, double StopAtr = 3.0, double FarTargetAtr = 20.0)
    {
        /// <summary>DSI 10 -> lookback 2, hold 5; DSI 20 -> 5, 10; DSI 30 -> 8, 15 (the tested cells).</summary>
        public static DriftRule ForRegimeMinutes(double minutes) =>
            new(Math.Max(2, (int)Math.Round(minutes / 4, MidpointRounding.ToEven)), Math.Max(3, (int)Math.Round(minutes / 2, MidpointRounding.ToEven)));
    }

    public sealed record DriftSignal(int Direction, double Move, double Threshold, double Sigma, double Atr, string Reason);

    public static class DriftEngine
    {
        /// <summary>The signal on closed M1 bars (oldest first; the last is the bar that just closed).</summary>
        public static DriftSignal Decide(IReadOnlyList<LabBar> closed, DriftRule rule)
        {
            var n = closed.Count;
            if (n < rule.SigmaBars + rule.Lookback + 2 || n < 16) return new DriftSignal(0, 0, 0, double.NaN, double.NaN, "NOT_ENOUGH_HISTORY");
            var r = new double[rule.SigmaBars];
            for (var k = 0; k < rule.SigmaBars; k++) { var i = n - rule.SigmaBars + k; r[k] = closed[i].C / closed[i - 1].C - 1; }
            var sigma = MarketLab.RobustSigma(r);
            var atr = MarketLab.Atr(closed, n - 1, 14);
            var move = closed[n - 1].C / closed[n - 1 - rule.Lookback].C - 1;
            var threshold = rule.Z * sigma * Math.Sqrt(rule.Lookback);
            if (!(sigma > 0) || !(atr > 0)) return new DriftSignal(0, move, threshold, sigma, atr, "NO_VOLATILITY");
            if (Math.Abs(move) < threshold) return new DriftSignal(0, move, threshold, sigma, atr, "BELOW_THRESHOLD");
            return new DriftSignal(Math.Sign(move), move, threshold, sigma, atr, move > 0 ? "DRIFT_UP" : "DRIFT_DOWN");
        }

        /// <summary>The regime length a Drift Switch name declares ("Drift Switch Index 20", "DSI20"), or NaN.</summary>
        public static double RegimeMinutes(string name)
        {
            var p = Behaviour.Classify(name);
            if (p.Family == DerivFamily.DriftSwitch) return p.Number;
            var m = System.Text.RegularExpressions.Regex.Match(name, @"DSI\s?(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return m.Success ? double.Parse(m.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) : double.NaN;
        }
    }
}
