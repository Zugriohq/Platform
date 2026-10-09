using System;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class TradingStyleTests
    {
        private static readonly AssetClass[] All = { AssetClass.Synthetic, AssetClass.Fx, AssetClass.Metal };
        private static TradingStyle Day() => new("DAY", "INTRADAY", "H1", "M15", "M5", new[] { "H4", "D1" }, 24, 15, All);
        private static TradingStyle Scalp() => new("SCALP", "SCALP", "M15", "M5", "M1", new[] { "H1" }, 6, 3, new[] { AssetClass.Synthetic });

        [Fact]
        public void Day_keeps_its_existing_horizon_ids_and_scalp_gets_its_own()
        {
            Assert.Equal("INTRADAY", Day().HorizonFor("H1"));
            Assert.Equal("INTRADAY_H4", Day().HorizonFor("H4"));
            Assert.Equal("SCALP", Scalp().HorizonFor("M15"));
            Assert.Equal("SCALP_H1", Scalp().HorizonFor("H1"));
        }

        [Fact]
        public void Scalp_scans_synthetics_only_by_default_and_loads_its_timeframes()
        {
            var s = Scalp().Validated();
            Assert.True(s.Trades(AssetClass.Synthetic));
            Assert.False(s.Trades(AssetClass.Fx));
            Assert.False(s.Trades(AssetClass.Metal));
            Assert.Equal(new[] { "M15", "H1" }, s.ContextTimeframes);
            Assert.Equal(new[] { "M15", "H1", "M5", "M1" }, s.AllTimeframes);
        }

        [Theory]
        [InlineData("M15", "M5", "M5", "H1")]    // entry not shorter than location
        [InlineData("M5", "M15", "M1", "H1")]    // location longer than context
        [InlineData("M15", "M5", "M1", "M5")]    // fallback shorter than context
        [InlineData("M15", "M5", "M2", "H1")]    // unsupported timeframe
        public void Rejects_timeframe_maps_that_do_not_widen(string ctx, string loc, string entry, string fallback) =>
            Assert.Throws<FormatException>(() => new TradingStyle("SCALP", "SCALP", ctx, loc, entry, new[] { fallback }, 6, 3, All).Validated());

        [Fact]
        public void Rejects_no_markets_and_non_positive_expiries()
        {
            Assert.Throws<FormatException>(() => (Scalp() with { Classes = Array.Empty<AssetClass>() }).Validated());
            Assert.Throws<FormatException>(() => (Scalp() with { EntryExpiryMinutes = 0 }).Validated());
        }

        [Fact]
        public void Parses_style_names_classes_and_fallbacks()
        {
            Assert.Equal(new[] { "DAY", "SCALP" }, TradingStyles.ParseNames(" day , SCALP, day"));
            Assert.Equal(new[] { "SCALP" }, TradingStyles.ParseNames("scalp"));
            Assert.Throws<FormatException>(() => TradingStyles.ParseNames(""));
            Assert.Throws<FormatException>(() => TradingStyles.ParseNames("DAY,SWING"));
            Assert.Equal(new[] { AssetClass.Synthetic, AssetClass.Metal }, TradingStyles.ParseClasses("syn, METAL"));
            Assert.Throws<FormatException>(() => TradingStyles.ParseClasses("SYN,STOCK"));
            Assert.Equal(new[] { "H4", "D1" }, TradingStyles.ParseFallbacks("h4, H1 ,D1,", "H1"));
        }

        [Fact]
        public void Route_style_and_initial_stop_all_survive_the_broker_comment()
        {
            var c = ProtectionManager.WithInitialStop(TradingStyles.WithRoute(TradingStyles.WithStyle("zugrio cfg=abc eng=def opp=123", "SCALP"), "REVERSAL_RECLAIM"), 4201.91);
            Assert.Equal("REVERSAL_RECLAIM", TradingStyles.RouteFromComment(c));
            Assert.Equal("SCALP", TradingStyles.FromComment(c));
            Assert.Equal(4201.91, ProtectionManager.InitialStopFrom(c));
            Assert.Equal("CONTINUATION_RETEST", TradingStyles.RouteFromComment(TradingStyles.WithRoute("zugrio", "CONTINUATION_RETEST")));
            Assert.Null(TradingStyles.RouteFromComment("zugrio cfg=abc sl=1.1"));     // trades from before routes were tagged
            Assert.True(c.Length < 100);
        }

        [Fact]
        public void Rejects_a_negative_take_profit_multiple_or_time_stop()
        {
            Assert.Throws<FormatException>(() => (Scalp() with { TargetR = -1 }).Validated());
            Assert.Throws<FormatException>(() => (Scalp() with { MaxMinutes = -5 }).Validated());
        }

        [Fact]
        public void Style_and_initial_stop_both_survive_the_broker_comment()
        {
            var c = ProtectionManager.WithInitialStop(TradingStyles.WithStyle("zugrio cfg=abc eng=def opp=123", "SCALP"), 7334.35);
            Assert.Equal("SCALP", TradingStyles.FromComment(c));
            Assert.Equal(7334.35, ProtectionManager.InitialStopFrom(c));
            Assert.Equal("DAY", TradingStyles.FromComment("zugrio cfg=abc eng=def opp=123 sl=1.1"));   // trades from before styles
            Assert.Equal("DAY", TradingStyles.FromComment(null));
        }
    }
}
