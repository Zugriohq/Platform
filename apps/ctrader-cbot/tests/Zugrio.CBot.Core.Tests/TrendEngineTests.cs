using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    /// <summary>The gold trend engine (research/lab round 4, rule A) and its swap-cost gate.</summary>
    public class TrendEngineTests
    {
        // Weekday closes from `from` for `days` calendar days, price = f(day index), with a little wobble for volatility.
        private static List<DayClose> Daily(DateTime from, int days, Func<int, double> price)
        {
            var o = new List<DayClose>();
            for (var i = 0; i < days; i++)
            {
                var d = from.AddDays(i);
                if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;
                o.Add(new DayClose(d, price(i) * (1 + (i % 2 == 0 ? 0.004 : -0.004))));
            }
            return o;
        }

        private static readonly DateTime Today = new(2026, 11, 2);   // a Monday, first weekday of November
        private static List<DayClose> Up() => Daily(new DateTime(2025, 7, 1), 500, i => 2000 * (1 + 0.0008 * i));
        private static List<DayClose> Down() => Daily(new DateTime(2025, 7, 1), 500, i => 3000 * (1 - 0.0005 * i));

        [Fact]
        public void Month_ends_are_each_months_last_close_and_the_current_month_is_left_out()
        {
            var d = Up();
            var me = TrendEngine.MonthEnds(d, Today);
            Assert.Equal(new DateTime(2026, 10, 30), me[^1].Date);            // last weekday of October 2026
            Assert.Equal(new DateTime(2025, 7, 31), me[0].Date);
            Assert.Equal(16, me.Count);                                      // Jul 2025 .. Oct 2026
            Assert.DoesNotContain(me, x => x.Date >= new DateTime(2026, 11, 1));
        }

        [Fact]
        public void Swap_quotes_convert_to_a_yearly_cost_in_percent_of_price()
        {
            Assert.Equal(1.825, TrendEngine.AnnualCostPct(-10, SwapKind.Pips, 0.01, 0.01, 2000), 9);    // 10 pips of 0.01 a day on 2000
            Assert.Equal(9.125, TrendEngine.AnnualCostPct(-50, SwapKind.Points, 0.1, 0.01, 2000), 9);
            Assert.Equal(3.0, TrendEngine.AnnualCostPct(-3, SwapKind.Percent, 0.01, 0.01, 2000), 9);
            Assert.True(TrendEngine.AnnualCostPct(+5, SwapKind.Pips, 0.01, 0.01, 2000) < 0);           // a credit is negative cost
            Assert.True(double.IsNaN(TrendEngine.AnnualCostPct(-5, SwapKind.Pips, 0.01, 0.01, 0)));
        }

        [Fact]
        public void An_uptrend_is_bought_only_while_holding_long_is_cheap_enough()
        {
            var rule = new TrendRule().Validated();
            var buy = TrendEngine.Decide(Up(), Today, 0, costLongPct: 1.0, costShortPct: 4.0, rule);
            Assert.Equal(TrendAction.Enter, buy.Action);
            Assert.Equal(1, buy.Target);
            Assert.True(buy.LookbackReturn > 0 && buy.MonthSigma > 0);
            var costly = TrendEngine.Decide(Up(), Today, 0, costLongPct: 4.0, costShortPct: 1.0, rule);
            Assert.Equal(TrendAction.None, costly.Action);
            Assert.Equal("UPTREND_SWAP_TOO_COSTLY", costly.Reason);
            var unknown = TrendEngine.Decide(Up(), Today, 0, costLongPct: double.NaN, costShortPct: 0, rule);
            Assert.Equal(TrendAction.None, unknown.Action);                  // an unknown cost is never affordable
            var credit = TrendEngine.Decide(Up(), Today, 0, costLongPct: -2.0, costShortPct: 9.0, rule);
            Assert.Equal(TrendAction.Enter, credit.Action);                  // a swap credit is fine
        }

        [Fact]
        public void A_held_position_is_kept_reversed_or_closed_as_the_trend_and_costs_say()
        {
            var rule = new TrendRule().Validated();
            Assert.Equal(TrendAction.Hold, TrendEngine.Decide(Up(), Today, +1, 1.0, 1.0, rule).Action);
            var rev = TrendEngine.Decide(Down(), Today, +1, 1.0, 1.0, rule);
            Assert.Equal(TrendAction.Reverse, rev.Action);
            Assert.Equal(-1, rev.Target);
            var exit = TrendEngine.Decide(Down(), Today, +1, 1.0, 4.0, rule);    // shorting costs too much: just close the long
            Assert.Equal(TrendAction.Exit, exit.Action);
            Assert.Equal(0, exit.Target);
            var costNow = TrendEngine.Decide(Up(), Today, +1, 4.0, 1.0, rule);   // the long became too costly to hold
            Assert.Equal(TrendAction.Exit, costNow.Action);
        }

        [Fact]
        public void Without_twelve_month_ends_nothing_new_is_opened_and_an_open_trade_is_kept()
        {
            var shortHistory = Daily(new DateTime(2026, 3, 1), 240, i => 2000 + i);
            var rule = new TrendRule().Validated();
            Assert.Equal(TrendAction.None, TrendEngine.Decide(shortHistory, Today, 0, 0, 0, rule).Action);
            Assert.Equal(TrendAction.Hold, TrendEngine.Decide(shortHistory, Today, +1, 0, 0, rule).Action);
        }

        [Fact]
        public void Stop_and_target_scale_with_monthly_volatility()
        {
            var rule = new TrendRule(StopSigma: 3, FarTargetSigma: 10).Validated();
            var d = TrendEngine.Decide(Up(), Today, 0, 0, 0, rule);
            // Alternating +/-0.4% around a slow trend: daily sd about 0.8%, monthly about 0.8% x sqrt 21.
            Assert.InRange(d.MonthSigma, 0.030, 0.045);
            Assert.Equal(3 * d.MonthSigma * 2000, d.StopDistance(rule, 2000), 9);
            Assert.Equal(10 * d.MonthSigma * 2000, d.TargetDistance(rule, 2000), 9);
            Assert.Throws<FormatException>(() => new TrendRule(StopSigma: 5, FarTargetSigma: 4).Validated());
        }
    }
}
