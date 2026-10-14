using System;
using System.Collections.Generic;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// Crypto trend (research/lab/realmarkets_prereg.json rule C2, passed 2026-10-14; UNVALIDATED_RESEARCH until the demo
    /// record supports it): at each week end, position = sign of the LookbackWeeks return over week-end closes, held for
    /// the week; a side whose holding cost is above MaxCostPctPerYear (or unknown) is not held. Protective stop StopSigma
    /// weekly standard deviations (weekly sigma = daily sigma x sqrt 7; crypto trades every day).
    /// Binance BTC+ETH 2017-08 to 2026-09: +0.137R per week (t 3.7) at 10%/yr financing, +0.169R / +0.109R in the halves,
    /// unchanged with this stop.
    /// </summary>
    public sealed record CryptoRule(int LookbackWeeks = 4, int VolDays = 60, double StopSigma = 3.0, double FarTargetSigma = 10.0, double MaxCostPctPerYear = 20.0);

    public sealed record CryptoDecision(TrendAction Action, int Target, int Signal, string Reason, int WeekEnds, double LookbackReturn, double WeekSigma, double CostLongPct, double CostShortPct)
    {
        public double StopDistance(CryptoRule r, double price) => r.StopSigma * WeekSigma * price;
        public double TargetDistance(CryptoRule r, double price) => r.FarTargetSigma * WeekSigma * price;
    }

    public static class CryptoEngine
    {
        /// <summary>Monday of the week a date falls in (weeks run Monday to Sunday, UTC).</summary>
        public static DateTime WeekStart(DateTime d) { var x = d.Date; return x.AddDays(-(((int)x.DayOfWeek + 6) % 7)); }

        /// <summary>The last close of each finished week before today's week.</summary>
        public static IReadOnlyList<DayClose> WeekEnds(IReadOnlyList<DayClose> daily, DateTime today)
        {
            var thisWeek = WeekStart(today); var outp = new List<DayClose>();
            for (var i = 0; i < daily.Count; i++)
            {
                if (WeekStart(daily[i].Date) >= thisWeek) break;
                var last = i + 1 >= daily.Count || WeekStart(daily[i + 1].Date) != WeekStart(daily[i].Date);
                if (last) outp.Add(daily[i]);
            }
            return outp;
        }

        /// <summary>Standard deviation of the last n daily log returns, scaled to a week (x sqrt 7), as a fraction of price.</summary>
        public static double WeekSigma(IReadOnlyList<DayClose> daily, int n)
        {
            if (daily.Count < n + 1) return double.NaN; double s = 0;
            for (var i = daily.Count - n; i < daily.Count; i++) { var r = Math.Log(daily[i].C / daily[i - 1].C); s += r * r; }
            return Math.Sqrt(s / n) * Math.Sqrt(7);
        }

        public static CryptoDecision Decide(IReadOnlyList<DayClose> daily, DateTime today, int current, double costLongPct, double costShortPct, CryptoRule rule)
        {
            var ends = WeekEnds(daily, today); var sigma = WeekSigma(daily, rule.VolDays);
            if (ends.Count < rule.LookbackWeeks + 1 || double.IsNaN(sigma))
                return new CryptoDecision(current != 0 ? TrendAction.Hold : TrendAction.None, current, 0, "NOT_ENOUGH_HISTORY", ends.Count, double.NaN, sigma, costLongPct, costShortPct);
            var ret = ends[^1].C / ends[^(rule.LookbackWeeks + 1)].C - 1;
            var signal = Math.Sign(ret);
            bool Affordable(int side) { var c = side > 0 ? costLongPct : costShortPct; return !double.IsNaN(c) && c <= rule.MaxCostPctPerYear; }
            var target = signal != 0 && Affordable(signal) ? signal : 0;
            var reason = signal == 0 ? "NO_SIGNAL" : target == 0 ? "HOLDING_COST_TOO_HIGH" : signal > 0 ? "TREND_UP" : "TREND_DOWN";
            var action = target == current ? (current == 0 ? TrendAction.None : TrendAction.Hold)
                : current == 0 ? TrendAction.Enter : target == 0 ? TrendAction.Exit : TrendAction.Reverse;
            return new CryptoDecision(action, target, signal, reason, ends.Count, ret, sigma, costLongPct, costShortPct);
        }
    }
}
