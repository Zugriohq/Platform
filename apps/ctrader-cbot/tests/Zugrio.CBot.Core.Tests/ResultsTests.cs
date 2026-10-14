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

    public class EquityTrackerTests
    {
        [Fact]
        public void Tracks_peak_drawdown_and_the_deepest_drawdown()
        {
            var e = new EquityTracker();
            e.Update(100); e.Update(110); e.Update(99); e.Update(105);
            Assert.Equal(110, e.Peak);
            Assert.Equal(5, e.Drawdown, 9);
            Assert.Equal(11, e.MaxDrawdown, 9);
            Assert.Equal(10, e.MaxDrawdownPct, 9);             // 11 of the 110 peak
            e.Update(120); e.Update(114);
            Assert.Equal(6, e.Drawdown, 9);
            Assert.Equal(11, e.MaxDrawdown, 9);                // the deeper earlier drawdown is kept
            Assert.Equal(10, e.MaxDrawdownPct, 9);
        }

        [Fact]
        public void Ignores_readings_that_are_not_finite_or_positive()
        {
            var e = new EquityTracker();
            Assert.Equal(0, e.MaxDrawdown);
            e.Update(double.NaN); e.Update(0); e.Update(50); e.Update(double.PositiveInfinity);
            Assert.Equal(50, e.Peak);
            Assert.Equal(0, e.MaxDrawdown);
        }

        [Fact]
        public void Slippage_is_signed_against_the_trade()
        {
            // a buy fills at the ask, a sell at the bid; positive = filled worse than quoted at submit
            Assert.Equal(2, Fills.SlippagePips(buy: true, bid: 1.1000, ask: 1.1001, fill: 1.1003, pip: 0.0001), 9);
            Assert.Equal(-1, Fills.SlippagePips(buy: true, bid: 1.1000, ask: 1.1001, fill: 1.1000, pip: 0.0001), 9);
            Assert.Equal(3, Fills.SlippagePips(buy: false, bid: 1.1000, ask: 1.1001, fill: 1.0997, pip: 0.0001), 9);
            Assert.Equal(1, Fills.SpreadPips(bid: 1.1000, ask: 1.1001, pip: 0.0001), 9);
        }
    }
}
