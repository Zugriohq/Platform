using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class CryptoEngineTests
    {
        private static List<DayClose> Days(DateTime from, int n, Func<int, double> price) => Enumerable.Range(0, n).Select(i => new DayClose(from.AddDays(i), price(i))).ToList();

        [Fact]
        public void Week_ends_are_the_last_close_of_each_finished_Monday_to_Sunday_week()
        {
            var d = Days(new DateTime(2026, 9, 7), 21, i => 100 + i);   // Mon 7 Sep .. Sun 27 Sep
            var ends = CryptoEngine.WeekEnds(d, new DateTime(2026, 9, 23));
            Assert.Equal(new[] { new DateTime(2026, 9, 13), new DateTime(2026, 9, 20) }, ends.Select(e => e.Date).ToArray());
        }

        [Fact]
        public void Follows_the_four_week_trend_and_reverses_on_a_flip()
        {
            var up = Days(new DateTime(2026, 1, 5), 120, i => 100 * Math.Exp(0.003 * i + 0.01 * Math.Sin(i)));
            var today = up[^1].Date.AddDays(1);
            var rule = new CryptoRule();
            var d = CryptoEngine.Decide(up, today, 0, 5, 5, rule);
            Assert.Equal(TrendAction.Enter, d.Action); Assert.Equal(1, d.Target); Assert.Equal("TREND_UP", d.Reason);
            Assert.True(d.WeekSigma > 0 && d.StopDistance(rule, 100) > 0);
            var down = Days(new DateTime(2026, 1, 5), 120, i => 200 * Math.Exp(-0.003 * i + 0.01 * Math.Sin(i)));
            Assert.Equal(TrendAction.Reverse, CryptoEngine.Decide(down, today, 1, 5, 5, rule).Action);
            Assert.Equal(TrendAction.Hold, CryptoEngine.Decide(up, today, 1, 5, 5, rule).Action);
        }

        [Fact]
        public void A_side_whose_holding_cost_is_too_high_or_unknown_is_not_held()
        {
            var up = Days(new DateTime(2026, 1, 5), 120, i => 100 * Math.Exp(0.003 * i + 0.01 * Math.Sin(i)));
            var today = up[^1].Date.AddDays(1);
            Assert.Equal("HOLDING_COST_TOO_HIGH", CryptoEngine.Decide(up, today, 0, 25, 5, new CryptoRule()).Reason);
            Assert.Equal(TrendAction.Exit, CryptoEngine.Decide(up, today, 1, double.NaN, 5, new CryptoRule()).Action);
            Assert.Equal("NOT_ENOUGH_HISTORY", CryptoEngine.Decide(up.Take(20).ToList(), up[19].Date.AddDays(1), 0, 5, 5, new CryptoRule()).Reason);
        }
    }
}
