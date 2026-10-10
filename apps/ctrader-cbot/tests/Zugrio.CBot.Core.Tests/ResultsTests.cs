using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class ScoreboardTests
    {
        [Fact]
        public void Shows_expectancy_by_style_setup_and_market()
        {
            var trades = new[]
            {
                new ClosedTrade("DAY", "REVERSAL_RECLAIM", "XAUUSD", -102.22, -1.0, 40),
                new ClosedTrade("DAY", "REVERSAL_RECLAIM", "XAUUSD", 500.76, 4.9, 300),
                new ClosedTrade("SCALP", "CONTINUATION_RETEST", "Step Index", 23.20, 0.23, 16),
                new ClosedTrade("SCALP", null, "Step Index", -100.50, double.NaN, 8),
            };
            var s = Scoreboard.Format(trades, 7);
            Assert.Contains("last 7 days: all 4 trades, 50% won, avg +1.38R, net +321.24", s);
            Assert.Contains("DAY 2 trades, 50% won, avg +1.95R, net +398.54, avg hold 170 min", s);
            Assert.Contains("SCALP 2 trades, 50% won, avg +0.23R", s);             // unknown R is left out of the average, not counted as 0
            Assert.Contains("reclaim 2 trades", s);
            Assert.Contains("By market (worst first): Step Index 2 trades net -77.30; XAUUSD 2 trades net +398.54", s);
        }

        [Fact]
        public void No_trades_yet() => Assert.Contains("no closed trades yet", Scoreboard.Format(System.Array.Empty<ClosedTrade>(), 7));
    }
}
