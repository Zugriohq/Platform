using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>One closed Zugrio trade, read back from the broker's history. R is net profit over the initial risk (NaN if unknown).</summary>
    public sealed record ClosedTrade(string Style, string? Route, string Symbol, double NetProfit, double R, double Minutes);

    /// <summary>
    /// The results that decide whether a style or setup type has an edge: count, win rate, average R
    /// (expectancy per trade, after costs) and net. Read from the broker's own history, so it survives
    /// cloud restarts. It decides nothing; it is how the owner and the next change are judged.
    /// </summary>
    public static class Scoreboard
    {
        public static string Format(IReadOnlyCollection<ClosedTrade> trades, int days)
        {
            var ci = CultureInfo.InvariantCulture;
            if (trades.Count == 0) return $"Zugrio EA results, last {days} days: no closed trades yet.";
            string Line(string name, IEnumerable<ClosedTrade> group)
            {
                var g = group.ToList();
                if (g.Count == 0) return $"{name} 0 trades";
                var rs = g.Where(t => double.IsFinite(t.R)).Select(t => t.R).ToList();
                var won = g.Count(t => t.NetProfit > 0);
                return $"{name} {g.Count} trades, {(100.0 * won / g.Count).ToString("0", ci)}% won, " +
                       $"avg {(rs.Count == 0 ? "n/a" : rs.Average().ToString("+0.00;-0.00;0.00", ci) + "R")}, " +
                       $"net {g.Sum(t => t.NetProfit).ToString("+0.00;-0.00;0.00", ci)}, avg hold {g.Average(t => t.Minutes).ToString("0", ci)} min";
            }
            var byStyle = string.Join("; ", new[] { TradingStyles.Day, TradingStyles.Scalp, TradingStyles.Index }.Select(s => Line(s, trades.Where(t => t.Style == s))));
            var byRoute = string.Join("; ", new[] { ("break and retest", "CONTINUATION_RETEST"), ("reclaim", "REVERSAL_RECLAIM") }
                .Select(x => Line(x.Item1, trades.Where(t => t.Route == x.Item2))));
            var bySymbol = string.Join("; ", trades.GroupBy(t => t.Symbol).OrderBy(g => g.Sum(t => t.NetProfit))
                .Select(g => $"{g.Key} {g.Count()} trades net {g.Sum(t => t.NetProfit).ToString("+0.00;-0.00;0.00", ci)}"));
            return $"Zugrio EA results, last {days} days: {Line("all", trades)}. By style: {byStyle}. By setup: {byRoute}. By market (worst first): {bySymbol}.";
        }
    }
}
