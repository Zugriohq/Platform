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
    /// <param name="KeepProfitFraction">From break-even on, the stop keeps at least this share of the best open profit
    /// seen, so a trail measured in ATR can never give back more than (1 − share) of it. 0 turns it off.</param>
    public sealed record TrailSettings(double BreakEvenAtR, double BreakEvenLockAtr, double TrailStartR, double TrailAtr, double MinStepAtr, double MinGapAtr, double KeepProfitFraction = 0)
    {
        private readonly double _keep = ValidKeep(KeepProfitFraction);
        public double KeepProfitFraction { get => _keep; init => _keep = ValidKeep(value); }

        private static double ValidKeep(double f) =>
            f is >= 0 and < 1 ? f : throw new ArgumentOutOfRangeException(nameof(KeepProfitFraction), "must be in [0, 1)");
    }

    /// <summary>
    /// Anti-round-trip stop management. Once a trade has moved <c>BreakEvenAtR</c> × R in its
    /// favour, the stop goes to entry (plus a small lock); from <c>TrailStartR</c> × R it trails
    /// the best price by <c>TrailAtr</c> × ATR. From break-even on it also keeps at least
    /// <c>KeepProfitFraction</c> of the best open profit: when the stop is smaller than an ATR,
    /// an ATR trail alone would sit at or near entry and hand the move back. A proposal is returned only if it strictly tightens
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
            if (favour >= s.BreakEvenAtR * r) candidate = entry + sign * Math.Max(s.BreakEvenLockAtr * atr, s.KeepProfitFraction * favour);
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
    ///
    /// <c>blockCounterTrendReclaims</c>: a reclaim exempt from the full filter is still refused
    /// when it fades a clear trend (a sell while the structure is UP, a buy while it is DOWN).
    /// In a MIXED or UNKNOWN structure (a range) it stays allowed. Owner evidence, 2026-10-09:
    /// six XAUUSD sells in a row while H1 made higher highs and lows; the last three lost.
    /// </summary>
    public static class TrendFilter
    {
        public static bool Allows(Side side, string? trend, string route, bool includeReversal, bool blockCounterTrendReclaims = false)
        {
            if (route == "REVERSAL_RECLAIM" && !includeReversal)
                return !blockCounterTrendReclaims || trend != (side == Side.Buy ? "DOWN" : "UP");
            return side == Side.Buy ? trend == "UP" : trend == "DOWN";
        }
    }

    /// <summary>EA exit and entry-geometry rules layered on decision-core's frozen geometry (abort-only or tighter).</summary>
    public static class ExitPlan
    {
        /// <summary>
        /// Take-profit for a style with a fixed reward multiple: the nearer of decision-core's objective
        /// and entry ± targetR × (entry − stop). 0 (or less) keeps the engine objective. Never further than the engine's.
        /// </summary>
        public static double Target(bool buy, double price, double stop, double engineTarget, double targetR)
        {
            if (!(targetR > 0)) return engineTarget;
            var r = Math.Abs(price - stop);
            var capped = buy ? price + targetR * r : price - targetR * r;
            return buy ? Math.Min(engineTarget, capped) : Math.Max(engineTarget, capped);
        }

        /// <summary>
        /// The stop must be at least minStopAtr × ATR from the entry price. A stop closer than that is
        /// inside ordinary noise and spread (owner evidence 2026-10-09: a 2.75-lot XAUUSD sell with a stop
        /// about 0.45 away). With minStopAtr equal to the model's stop distance this means price has not
        /// already moved past the level toward the stop.
        /// </summary>
        public static bool StopFarEnough(double price, double stop, double atr, double minStopAtr) =>
            !(minStopAtr > 0) || Math.Abs(price - stop) >= minStopAtr * atr * (1 - 1e-9);

        /// <summary>
        /// With a fixed reward multiple, the engine objective must leave room for it: otherwise the trade
        /// would risk 1R to make less than planned. 0 (no multiple) always passes.
        /// </summary>
        public static bool RewardRoom(double price, double stop, double engineTarget, double targetR) =>
            !(targetR > 0) || Math.Abs(engineTarget - price) >= targetR * Math.Abs(price - stop) * (1 - 1e-9);

        /// <summary>A trade held at least maxMinutes (0 = no limit) is closed by the time stop.</summary>
        public static bool TimeUp(DateTime entryUtc, DateTime nowUtc, double maxMinutes) =>
            maxMinutes > 0 && (nowUtc - entryUtc).TotalMinutes >= maxMinutes;
    }
}
