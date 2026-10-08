using System;
using System.Globalization;

namespace Zugrio.CBot.Core
{
    /// <summary>Research parameters for protecting open profit (UNVALIDATED_RESEARCH).</summary>
    /// <param name="BreakEvenAtR">Profit, in multiples of the initial risk R, at which the stop moves to entry.</param>
    /// <param name="BreakEvenLockAtr">How far past entry the break-even stop sits (x ATR), so a stop-out still covers costs.</param>
    /// <param name="TrailStartR">Profit (x R) from which the stop trails the best price.</param>
    /// <param name="TrailAtr">Trailing distance behind the best price (x ATR).</param>
    /// <param name="MinStepAtr">Smallest stop improvement worth sending (x ATR), so the broker is not spammed.</param>
    /// <param name="MinGapAtr">Closest the stop may sit to the current exit price (x ATR).</param>
    public sealed record TrailSettings(double BreakEvenAtR, double BreakEvenLockAtr, double TrailStartR, double TrailAtr, double MinStepAtr, double MinGapAtr);

    /// <summary>
    /// Anti-round-trip stop management. Once a trade has moved <c>BreakEvenAtR</c> × R in its
    /// favour, the stop goes to entry (plus a small lock); from <c>TrailStartR</c> × R it trails
    /// the best price by <c>TrailAtr</c> × ATR. A proposal is returned only if it strictly tightens
    /// the current stop by at least <c>MinStepAtr</c> × ATR, so the result is always RISK_REDUCING
    /// under OrderClassifier (§10.11) and never widens risk.
    /// </summary>
    public static class ProtectionManager
    {
        public static double? Propose(bool buy, double entry, double initialStop, double currentStop, double bestPrice, double exitPrice, double atr, TrailSettings s)
        {
            var sign = buy ? 1.0 : -1.0;
            var r = sign * (entry - initialStop);
            if (!(r > 0) || !(atr > 0)) return null;
            var favour = sign * (bestPrice - entry);
            double? candidate = null;
            if (favour >= s.BreakEvenAtR * r) candidate = entry + sign * s.BreakEvenLockAtr * atr;
            if (favour >= s.TrailStartR * r)
            {
                var trail = bestPrice - sign * s.TrailAtr * atr;
                candidate = candidate == null ? trail : (buy ? Math.Max(candidate.Value, trail) : Math.Min(candidate.Value, trail));
            }
            if (candidate == null) return null;
            var nearest = exitPrice - sign * s.MinGapAtr * atr;    // never at or through the market
            var stop = buy ? Math.Min(candidate.Value, nearest) : Math.Max(candidate.Value, nearest);
            if (!(sign * (stop - currentStop) >= s.MinStepAtr * atr)) return null;
            return stop;
        }

        /// <summary>The initial stop is written into the broker comment at entry ("sl=…") so it survives cloud restarts.</summary>
        public static string WithInitialStop(string comment, double initialStop) => comment + " sl=" + initialStop.ToString("R", CultureInfo.InvariantCulture);

        public static double? InitialStopFrom(string? comment)
        {
            if (string.IsNullOrEmpty(comment)) return null;
            var i = comment.LastIndexOf(" sl=", StringComparison.Ordinal);
            if (i < 0) return null;
            var text = comment[(i + 4)..].Split(' ')[0];
            return double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) && double.IsFinite(v) ? v : null;
        }
    }

    /// <summary>
    /// Trend filter (abort-only): a setup is taken only in the direction of the context
    /// timeframe's structure. UP (higher highs and lows) allows buys, DOWN allows sells;
    /// MIXED or UNKNOWN allows neither. Applies to continuation-retest, and to
    /// reversal-reclaim only when <c>includeReversal</c> is set (a reclaim at a turn is
    /// often against the old structure).
    /// </summary>
    public static class TrendFilter
    {
        public static bool Allows(Side side, string? trend, string route, bool includeReversal)
        {
            if (route == "REVERSAL_RECLAIM" && !includeReversal) return true;
            return side == Side.Buy ? trend == "UP" : trend == "DOWN";
        }
    }
}
