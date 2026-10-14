using System;
using System.Collections.Generic;
using System.Linq;

namespace Zugrio.CBot.Core
{
    // Zugrio Trend engine (EA research engine for gold; ADR-0012 family engines). Pure and testable.
    // The rule is research/lab round 4's registered rule A (tsmom_prereg.json): at each month end, hold the sign of the
    // 12-month return for one month (Moskowitz, Ooi and Pedersen 2012). On gold, 2000-2026: +0.18R a month before
    // financing (t = 3.0, both halves positive), +0.15R (t = 2.5) at 1.5%/yr financing, and +0.08R (t = 1.4, the
    // registered verdict "fail") at 5%/yr. So the engine trades a side only when the broker's own swap for that side
    // costs at most MaxCostPctPerYear (default 1.5, the sensitivity at which the result held). All values are
    // UNVALIDATED_RESEARCH; nothing here is Zugrio policy.

    /// <summary>One daily close (the broker's D1 bar), dated by its open.</summary>
    public readonly record struct DayClose(DateTime Date, double C);

    /// <summary>How a broker quotes its swap: price pips or points per day, or an annual percentage.</summary>
    public enum SwapKind { Pips, Points, Percent }

    /// <param name="LookbackMonths">Signal: the sign of the return over this many month ends.</param>
    /// <param name="VolDays">Daily returns used for the volatility that sizes the stop.</param>
    /// <param name="StopSigma">Protective stop, in monthly standard deviations of price (the research had no stop; at 3 a
    /// month's move rarely reaches it, so it guards against a crash without changing the tested rule much).</param>
    /// <param name="FarTargetSigma">Backstop take-profit (the instruction contract needs one).</param>
    /// <param name="MaxCostPctPerYear">Trade a side only if its swap costs at most this per year (income always allowed).</param>
    public sealed record TrendRule(int LookbackMonths = 12, int VolDays = 60, double StopSigma = 3.0, double FarTargetSigma = 10.0, double MaxCostPctPerYear = 1.5)
    {
        public TrendRule Validated()
        {
            if (LookbackMonths < 1 || VolDays < 10) throw new FormatException("trend rule: lookback at least 1 month, volatility at least 10 days");
            if (!(StopSigma > 0) || !(FarTargetSigma > StopSigma)) throw new FormatException("trend rule: stop must be positive and the backstop target beyond it");
            if (!(MaxCostPctPerYear >= 0)) throw new FormatException("trend rule: the holding-cost limit must be zero or more");
            return this;
        }
    }

    public enum TrendAction { None, Enter, Exit, Hold, Reverse }

    /// <summary>The month's decision. Target: +1 long, -1 short, 0 flat. Costs are % of price per year (positive = a charge).</summary>
    public sealed record TrendDecision(TrendAction Action, int Target, int Signal, string Reason, int MonthEnds, double LookbackReturn, double MonthSigma, double CostLongPct, double CostShortPct)
    {
        public double StopDistance(TrendRule r, double price) => r.StopSigma * MonthSigma * price;
        public double TargetDistance(TrendRule r, double price) => r.FarTargetSigma * MonthSigma * price;
    }

    public static class TrendEngine
    {
        /// <summary>The last close of each calendar month before today's month (the current month is not finished).</summary>
        public static IReadOnlyList<DayClose> MonthEnds(IReadOnlyList<DayClose> daily, DateTime today)
        {
            var thisMonth = new DateTime(today.Year, today.Month, 1);
            var outp = new List<DayClose>();
            foreach (var d in daily.Where(x => x.Date < thisMonth && x.C > 0).OrderBy(x => x.Date))
            {
                if (outp.Count > 0 && outp[^1].Date.Year == d.Date.Year && outp[^1].Date.Month == d.Date.Month) outp[^1] = d;
                else outp.Add(d);
            }
            return outp;
        }

        /// <summary>Standard deviation of the last n daily log returns, scaled to a month (x sqrt 21), as a fraction of price.</summary>
        public static double MonthSigma(IReadOnlyList<DayClose> daily, int n)
        {
            var c = daily.Where(x => x.C > 0).OrderBy(x => x.Date).Select(x => x.C).ToList();
            if (c.Count < n + 1) return double.NaN;
            var r = new List<double>(n);
            for (var i = c.Count - n; i < c.Count; i++) r.Add(Math.Log(c[i] / c[i - 1]));
            var m = r.Average();
            return Math.Sqrt(r.Sum(x => (x - m) * (x - m)) / (r.Count - 1)) * Math.Sqrt(21);
        }

        /// <summary>
        /// Yearly holding cost of one side, % of price (positive = a charge, negative = income). Pips and points are the
        /// per-day swap in price units; a percentage swap is already a yearly rate. A broker swap is negative when charged.
        /// </summary>
        public static double AnnualCostPct(double swap, SwapKind kind, double pipSize, double tickSize, double price)
        {
            if (!(price > 0)) return double.NaN;
            return kind switch
            {
                SwapKind.Percent => -swap,
                SwapKind.Pips => -swap * pipSize * 365 / price * 100,
                SwapKind.Points => -swap * tickSize * 365 / price * 100,
                _ => double.NaN,
            };
        }

        /// <summary>
        /// The month's decision for a market currently long (+1), short (-1) or flat (0). The signal is the sign of the
        /// LookbackMonths return over month-end closes; a side whose holding cost is above the limit (or unknown) is not held.
        /// </summary>
        public static TrendDecision Decide(IReadOnlyList<DayClose> daily, DateTime today, int current, double costLongPct, double costShortPct, TrendRule rule)
        {
            var me = MonthEnds(daily, today);
            var sigma = MonthSigma(daily, rule.VolDays);
            TrendDecision D(TrendAction a, int target, int signal, string why, double ret) => new(a, target, signal, why, me.Count, ret, sigma, costLongPct, costShortPct);
            if (me.Count < rule.LookbackMonths + 1 || !(sigma > 0))
                return current == 0 ? D(TrendAction.None, 0, 0, "NOT_ENOUGH_HISTORY", double.NaN) : D(TrendAction.Hold, current, 0, "NOT_ENOUGH_HISTORY_KEEP", double.NaN);
            var ret = me[^1].C / me[^(rule.LookbackMonths + 1)].C - 1;
            var signal = Math.Sign(ret);
            var cost = signal > 0 ? costLongPct : signal < 0 ? costShortPct : double.NaN;
            var affordable = signal != 0 && cost <= rule.MaxCostPctPerYear;   // NaN (unknown cost) is never affordable
            var target = affordable ? signal : 0;
            var why = signal == 0 ? "NO_TREND" : affordable ? (signal > 0 ? "UPTREND" : "DOWNTREND") : (signal > 0 ? "UPTREND_SWAP_TOO_COSTLY" : "DOWNTREND_SWAP_TOO_COSTLY");
            if (current == target) return D(target == 0 ? TrendAction.None : TrendAction.Hold, target, signal, why, ret);
            if (current == 0) return D(TrendAction.Enter, target, signal, why, ret);
            if (target == 0) return D(TrendAction.Exit, 0, signal, why, ret);
            return D(TrendAction.Reverse, target, signal, why, ret);
        }
    }
}
