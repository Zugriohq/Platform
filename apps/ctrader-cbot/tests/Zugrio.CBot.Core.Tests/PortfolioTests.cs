using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class WatchlistTests
    {
        [Fact]
        public void Parses_symbols_classes_and_unlock_balances()
        {
            var w = Watchlist.Parse(" Step Index|SYN|0 ; EURUSD|fx|50;XAUUSD|METAL|250 ;");
            Assert.Equal(3, w.Count);
            Assert.Equal(new WatchItem("Step Index", AssetClass.Synthetic, 0), w[0]);
            Assert.Equal(new WatchItem("EURUSD", AssetClass.Fx, 50), w[1]);
            Assert.Equal(AssetClass.Metal, w[2].Class);
        }

        [Theory]
        [InlineData("EURUSD|FX")]
        [InlineData("EURUSD|STOCK|0")]
        [InlineData("EURUSD|FX|-1")]
        [InlineData("EURUSD|FX|abc")]
        [InlineData("EURUSD|FX|0; eurusd|FX|10")]
        public void Rejects_malformed_watchlists(string text) => Assert.Throws<FormatException>(() => Watchlist.Parse(text));

        [Fact]
        public void Tiers_parse_sort_and_resolve_by_balance()
        {
            var t = Watchlist.ParseTiers("250:3:8; 0:1:5; 100:2:6");
            Assert.Equal(new[] { 0.0, 100, 250 }, t.Select(x => x.MinBalance));
            Assert.Equal(1, Watchlist.TierFor(t, 20).MaxPositions);
            Assert.Equal(2, Watchlist.TierFor(t, 100).MaxPositions);
            Assert.Equal(2, Watchlist.TierFor(t, 249.99).MaxPositions);
            Assert.Equal(3, Watchlist.TierFor(t, 10_000).MaxPositions);
        }

        [Theory]
        [InlineData("")]
        [InlineData("10:1:5")]          // must start at 0
        [InlineData("0:0:5")]           // at least one position
        [InlineData("0:1:0")]           // positive risk
        [InlineData("0:1:5; 0:2:6")]    // duplicate start
        public void Rejects_malformed_tiers(string text) => Assert.Throws<FormatException>(() => Watchlist.ParseTiers(text));

        [Fact]
        public void Resolves_broker_names_ignoring_spacing_and_case()
        {
            var broker = new[] { "EURUSD", "Volatility10Index", "Volatility 10 (1s) Index", "Step Index" };
            Assert.Equal("Volatility10Index", Watchlist.Resolve("Volatility 10 Index", broker));
            Assert.Equal("Volatility 10 (1s) Index", Watchlist.Resolve("volatility 10 (1s) index", broker));
            Assert.Equal("Step Index", Watchlist.Resolve("Step Index", broker));
            Assert.Null(Watchlist.Resolve("XAUUSD", broker));
        }

        [Fact]
        public void Currencies_of_pairs_and_none_for_synthetics()
        {
            Assert.Equal(new[] { "EUR", "USD" }, Watchlist.Currencies("EURUSD", AssetClass.Fx));
            Assert.Equal(new[] { "XAU", "USD" }, Watchlist.Currencies("XAUUSD", AssetClass.Metal));
            Assert.Empty(Watchlist.Currencies("Volatility 10 Index", AssetClass.Synthetic));
        }
    }

    public class EaDefaultsTests
    {
        private static string Constant(string name)
        {
            var d = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
            while (d != null && !System.IO.Directory.Exists(System.IO.Path.Combine(d.FullName, "src", "ZugrioEA"))) d = d.Parent;
            var src = System.IO.File.ReadAllText(System.IO.Path.Combine(d!.FullName, "src", "ZugrioEA", "ZugrioEA", "ZugrioEA.cs"));
            var m = System.Text.RegularExpressions.Regex.Match(src, "public const string " + name + @" =(?<body>(?:\s*""[^""]*""\s*\+?)+);");
            Assert.True(m.Success, name + " not found");
            return string.Concat(System.Text.RegularExpressions.Regex.Matches(m.Groups["body"].Value, "\"([^\"]*)\"").Select(x => x.Groups[1].Value));
        }

        [Fact]
        public void Default_watchlist_and_tiers_are_valid_and_open_with_cheap_markets()
        {
            var w = Watchlist.Parse(Constant("DefaultWatchlist"));
            var t = Watchlist.ParseTiers(Constant("DefaultTiers"));
            Assert.Contains(w, x => x.UnlockBalance == 0 && x.Class == AssetClass.Synthetic);
            Assert.Contains(w, x => x.Symbol == "XAUUSD" && x.UnlockBalance > 0);           // gold unlocks later
            Assert.DoesNotContain(w, x => x.Symbol.Contains("Boom") || x.Symbol.Contains("Crash") || x.Symbol.Contains("Jump")); // spike indices gap through stops
            Assert.Equal(1, Watchlist.TierFor(t, 20).MaxPositions);                           // a $20 account: one trade at a time
        }
    }

    public class AtrTests
    {
        [Fact]
        public void Mean_true_range_includes_gaps_from_the_previous_close()
        {
            var bars = new List<(double, double, double)> { (10, 9, 9.5), (11, 10, 10.5), (12, 11.5, 12), (11, 10, 10.2) };
            // TRs of the last 3: max(1, |11-9.5|, |10-9.5|)=1.5; max(0.5, |12-10.5|, |11.5-10.5|)=1.5; max(1, |11-12|, |10-12|)=2
            Assert.Equal((1.5 + 1.5 + 2) / 3, Atr.Compute(bars, 3), 12);
        }

        [Fact]
        public void Not_enough_bars_gives_NaN() => Assert.True(double.IsNaN(Atr.Compute(new List<(double, double, double)> { (1, 0, 0.5) }, 1)));
    }

    public class PortfolioSelectorTests
    {
        private static readonly DateTimeOffset T = new(2026, 10, 8, 9, 35, 0, TimeSpan.Zero);
        private static ReadyCandidate C(string s, AssetClass c, double risk, int ageMin = 0, double pct = 1) => new(s, c, T.AddMinutes(-ageMin), "opp:" + s, risk, pct);
        private static readonly Tier Small = new(0, 1, 5), Mid = new(100, 3, 6);

        [Fact]
        public void Most_recent_confirmation_first_then_lower_risk_pct_then_symbol()
        {
            var r = PortfolioSelector.Rank(new[] { C("B", AssetClass.Synthetic, 1, 5), C("A", AssetClass.Synthetic, 1, 0, 2), C("C", AssetClass.Synthetic, 1, 0, 1) });
            Assert.Equal(new[] { "C", "A", "B" }, r.Select(x => x.Symbol));
        }

        [Fact]
        public void Small_tier_takes_only_one_position()
        {
            var s = PortfolioSelector.Select(new[] { C("Step Index", AssetClass.Synthetic, 0.5), C("Volatility 10 Index", AssetClass.Synthetic, 0.5, 1) }, Array.Empty<OpenExposure>(), Small, 20);
            Assert.Equal("Step Index", Assert.Single(s.Take).Symbol);
            Assert.Equal("TIER_MAX_POSITIONS", Assert.Single(s.Skipped).Reason);
        }

        [Fact]
        public void One_position_per_symbol_and_no_shared_currency()
        {
            var open = new[] { new OpenExposure("EURUSD", AssetClass.Fx, 1) };
            var s = PortfolioSelector.Select(new[] { C("EURUSD", AssetClass.Fx, 1), C("GBPUSD", AssetClass.Fx, 1), C("XAUUSD", AssetClass.Metal, 1), C("AUDJPY", AssetClass.Fx, 1) }, open, Mid, 1000);
            Assert.Equal(new[] { "AUDJPY" }, s.Take.Select(x => x.Symbol));
            Assert.Equal("SYMBOL_ALREADY_OPEN", s.Skipped.Single(x => x.Candidate.Symbol == "EURUSD").Reason);
            Assert.Equal("CURRENCY_OVERLAP", s.Skipped.Single(x => x.Candidate.Symbol == "GBPUSD").Reason);
            Assert.Equal("CURRENCY_OVERLAP", s.Skipped.Single(x => x.Candidate.Symbol == "XAUUSD").Reason);
        }

        [Fact]
        public void Total_open_risk_stays_within_the_tier_budget()
        {
            // Balance 200, Mid tier 6% => 12 of risk. 5 open + 4 fits (9); another 4 would be 13.
            var open = new[] { new OpenExposure("Volatility 25 Index", AssetClass.Synthetic, 5) };
            var s = PortfolioSelector.Select(new[] { C("Step Index", AssetClass.Synthetic, 4), C("Volatility 10 Index", AssetClass.Synthetic, 4, 1) }, open, Mid, 200);
            Assert.Equal("Step Index", Assert.Single(s.Take).Symbol);
            Assert.Equal("TIER_TOTAL_RISK", Assert.Single(s.Skipped).Reason);
        }

        [Fact]
        public void Open_risk_plus_new_risk_must_fit_the_loss_still_allowed_today()
        {
            var open = new[] { new OpenExposure("Step Index", AssetClass.Synthetic, 1.0) };
            var s = PortfolioSelector.Select(new[] { C("Volatility 10 Index", AssetClass.Synthetic, 1.0) }, open, Mid, 1000, dailyLossAllowance: 1.5);
            Assert.Empty(s.Take);
            Assert.Equal("DAILY_LOSS_ALLOWANCE", Assert.Single(s.Skipped).Reason);
            Assert.Single(PortfolioSelector.Select(new[] { C("Volatility 10 Index", AssetClass.Synthetic, 0.5) }, open, Mid, 1000, dailyLossAllowance: 1.5).Take);
        }

        [Fact]
        public void An_unprotected_open_position_blocks_new_risk()
        {
            var open = new[] { new OpenExposure("Step Index", AssetClass.Synthetic, double.PositiveInfinity) };
            var s = PortfolioSelector.Select(new[] { C("Volatility 10 Index", AssetClass.Synthetic, 0.1) }, open, Mid, 1000);
            Assert.Empty(s.Take);
            Assert.Equal("TIER_TOTAL_RISK", Assert.Single(s.Skipped).Reason);
        }
    }

    public class AffordabilityTests
    {
        [Fact]
        public void Minimum_balance_is_risk_at_minimum_volume_over_the_cap()
        {
            // EURUSD-like: tick 0.00001, $0.00001 per unit per tick, 1000 units min, 10-pip stop => $1 at minimum; 5% cap => $20.
            var a = AffordabilityCalc.Compute("EURUSD", 1000, 0.00001, 0.00001, 0.0010, 0.0001, 5);
            Assert.Equal(1.0, a.RiskAtMinimum, 9);
            Assert.Equal(20.0, a.MinBalanceForCap, 9);
            Assert.Equal(0.1, a.SpreadShareOfStop, 9);
        }
    }
}
