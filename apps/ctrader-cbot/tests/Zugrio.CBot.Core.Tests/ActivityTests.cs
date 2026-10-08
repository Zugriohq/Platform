using System;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class EaActivityTests
    {
        [Fact]
        public void Setups_and_skips_are_announced_once_and_counted()
        {
            var a = new EaActivity();
            Assert.True(a.SetupFound("f1"));
            Assert.False(a.SetupFound("f1"));               // still READY next bar: not repeated
            Assert.True(a.Skipped("f1", "SPREAD_TOO_WIDE_FOR_STOP"));
            Assert.False(a.Skipped("f1", "SPREAD_TOO_WIDE_FOR_STOP"));
            Assert.True(a.Skipped("f2", "SPREAD_TOO_WIDE_FOR_STOP"));
            a.Scanned("EURUSD", 2.4); a.Scanned("EURUSD", 1.1); a.Scanned("Step Index", 0.3);
            a.Entered(); a.Closed(1.25);
            var s = a.Summary(new DateTime(2026, 10, 8, 16, 0, 0, DateTimeKind.Utc), 20.5, 20.7, 0, new Tier(0, 1, 5), 0.8, 19.7);
            Assert.Contains("hour to 16:00 UTC: 3 scans, 1 setups found, 1 trades opened, 1 closed (P/L +1.25)", s);
            Assert.Contains("Skipped: 2 spread too wide for the stop", s);
            Assert.Contains("Closest to a setup: Step Index 0.3 ATR, EURUSD 1.1 ATR", s);
            Assert.Contains("Balance 20.50, equity 20.70, 0 open (max 1)", s);
            a.NextHour();
            Assert.Equal(0, a.Scans);
            Assert.False(a.SetupFound("f1"));               // a setup spanning the hour is not re-announced
        }

        [Theory]
        [InlineData("DAILY_LOSS_ALLOWANCE", "daily loss limit or profit lock")]
        [InlineData("CONTRACT: bad field", "instruction check failed")]
        [InlineData("SOMETHING_NEW", "something new")]
        public void Reasons_read_as_plain_English(string code, string text) => Assert.Equal(text, EaActivity.ReasonText(code));
    }
}
