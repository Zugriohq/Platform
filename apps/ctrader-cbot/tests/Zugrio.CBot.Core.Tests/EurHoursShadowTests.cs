using System;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class EurHoursShadowTests
    {
        private static DateTime U(int d, int h, int m) => new(2026, 10, d, h, m, 0, DateTimeKind.Utc);

        [Fact]
        public void Windows_are_07_00_and_12_00_UTC_on_weekdays_with_five_minutes_grace()
        {
            Assert.True(EurHoursShadow.IsOpenTime(U(14, 7, 0)));
            Assert.True(EurHoursShadow.IsOpenTime(U(14, 7, 4)));
            Assert.False(EurHoursShadow.IsOpenTime(U(14, 7, 5)));
            Assert.False(EurHoursShadow.IsOpenTime(U(14, 6, 59)));
            Assert.True(EurHoursShadow.IsCloseTime(U(14, 12, 0)));
            Assert.False(EurHoursShadow.IsOpenTime(U(17, 7, 0)));    // Saturday
            Assert.False(EurHoursShadow.IsCloseTime(U(18, 12, 0)));  // Sunday
        }

        [Fact]
        public void The_short_sells_at_the_bid_and_buys_back_at_the_ask()
        {
            var open = new ShadowQuote(U(14, 7, 0), 1.10000, 1.10006);
            var close = new ShadowQuote(U(14, 12, 0), 1.09970, 1.09976);
            var d = EurHoursShadow.Result(open, close, 0.0001)!;
            Assert.Equal(3.0 / 1.10003, d.GrossBp, 6);                 // mid fell 3 pips
            Assert.Equal((1.10000 - 1.09976) / 1.10000 * 1e4, d.NetBp, 9);
            Assert.Equal(0.6, d.SpreadOpenPips, 6);
            Assert.True(d.NetBp < d.GrossBp);
        }

        [Fact]
        public void Mismatched_or_broken_quotes_give_no_result()
        {
            var open = new ShadowQuote(U(14, 7, 0), 1.1, 1.1001);
            Assert.Null(EurHoursShadow.Result(open, new ShadowQuote(U(15, 12, 0), 1.1, 1.1001), 0.0001));   // another day
            Assert.Null(EurHoursShadow.Result(open, new ShadowQuote(U(14, 12, 0), 1.1, 1.0999), 0.0001));   // ask below bid
            Assert.Null(EurHoursShadow.Result(open, new ShadowQuote(U(14, 6, 0), 1.1, 1.1001), 0.0001));    // before the open
        }
    }
}
