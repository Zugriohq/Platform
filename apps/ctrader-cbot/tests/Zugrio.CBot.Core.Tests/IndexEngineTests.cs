using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class IndexEngineTests
    {
        private static DateTime U(int y, int mo, int d, int h, int mi = 0) => new(y, mo, d, h, mi, 0, DateTimeKind.Utc);

        [Fact]
        public void New_york_daylight_saving_follows_the_us_rules()
        {
            // 2026: second Sunday of March = 8 March; first Sunday of November = 1 November.
            Assert.False(NewYorkTime.IsDaylight(U(2026, 3, 8, 6, 59)));
            Assert.True(NewYorkTime.IsDaylight(U(2026, 3, 8, 7, 0)));
            Assert.True(NewYorkTime.IsDaylight(U(2026, 11, 1, 5, 59)));
            Assert.False(NewYorkTime.IsDaylight(U(2026, 11, 1, 6, 0)));
            // 2025: 9 March and 2 November.
            Assert.False(NewYorkTime.IsDaylight(U(2025, 3, 9, 6, 59)));
            Assert.True(NewYorkTime.IsDaylight(U(2025, 3, 9, 7, 0)));
            Assert.True(NewYorkTime.IsDaylight(U(2025, 11, 2, 5, 59)));
            Assert.False(NewYorkTime.IsDaylight(U(2025, 11, 2, 6, 0)));

            Assert.Equal(new DateTime(2026, 7, 1, 16, 0, 0), NewYorkTime.FromUtc(U(2026, 7, 1, 20)));
            Assert.Equal(new DateTime(2026, 1, 15, 16, 0, 0), NewYorkTime.FromUtc(U(2026, 1, 15, 21)));
            Assert.Equal(U(2026, 7, 1, 19, 55), NewYorkTime.ToUtc(new DateTime(2026, 7, 1, 15, 55, 0)));
            Assert.Equal(U(2026, 12, 1, 20, 55), NewYorkTime.ToUtc(new DateTime(2026, 12, 1, 15, 55, 0)));
            Assert.Equal(U(2026, 7, 1, 19, 55), IndexEngine.DecisionUtc(new DateTime(2026, 7, 1), new IndexRule(), TimeSpan.FromMinutes(5)));
        }

        [Fact]
        public void Exchange_clocks_follow_each_exchanges_daylight_rule()
        {
            // UK and EU: 2026 changes at 01:00 UTC on 29 March and 25 October.
            Assert.Equal(TimeSpan.Zero, ExchangeTime.Offset(Exchange.London, U(2026, 3, 29, 0, 59)));
            Assert.Equal(TimeSpan.FromHours(1), ExchangeTime.Offset(Exchange.London, U(2026, 3, 29, 1, 0)));
            Assert.Equal(TimeSpan.FromHours(2), ExchangeTime.Offset(Exchange.Frankfurt, U(2026, 10, 25, 0, 59)));
            Assert.Equal(TimeSpan.FromHours(1), ExchangeTime.Offset(Exchange.Frankfurt, U(2026, 10, 25, 1, 0)));
            // Sydney: daylight until Sat 4 April 2026 16:00 UTC, again from Sat 3 October 2026 16:00 UTC.
            Assert.Equal(TimeSpan.FromHours(11), ExchangeTime.Offset(Exchange.Sydney, U(2026, 4, 4, 15, 59)));
            Assert.Equal(TimeSpan.FromHours(10), ExchangeTime.Offset(Exchange.Sydney, U(2026, 4, 4, 16, 0)));
            Assert.Equal(TimeSpan.FromHours(10), ExchangeTime.Offset(Exchange.Sydney, U(2026, 10, 3, 15, 59)));
            Assert.Equal(TimeSpan.FromHours(11), ExchangeTime.Offset(Exchange.Sydney, U(2026, 10, 3, 16, 0)));
            Assert.Equal(TimeSpan.FromHours(9), ExchangeTime.Offset(Exchange.Tokyo, U(2026, 7, 1, 0)));
            Assert.Equal(TimeSpan.FromHours(8), ExchangeTime.Offset(Exchange.HongKong, U(2026, 1, 1, 0)));
            Assert.Equal(ExchangeTime.Offset(Exchange.NewYork, U(2026, 7, 1, 12)), TimeSpan.FromHours(-4));
            // Round trips, and the decision instant for each venue's close.
            foreach (var x in Enum.GetValues<Exchange>())
                foreach (var t in new[] { U(2026, 1, 14, 12), U(2026, 7, 14, 12) })
                    Assert.Equal(t, ExchangeTime.ToUtc(x, ExchangeTime.FromUtc(x, t)));
            var rule = new IndexRule();
            Assert.Equal(U(2026, 7, 14, 15, 25), IndexEngine.DecisionUtc(new DateTime(2026, 7, 14), rule.At(IndexVenues.Frankfurt), TimeSpan.FromMinutes(5)));   // 17:25 CEST
            Assert.Equal(U(2026, 1, 14, 16, 25), IndexEngine.DecisionUtc(new DateTime(2026, 1, 14), rule.At(IndexVenues.London), TimeSpan.FromMinutes(5)));     // 16:25 GMT
            Assert.Equal(U(2026, 7, 14, 6, 25), IndexEngine.DecisionUtc(new DateTime(2026, 7, 14), rule.At(IndexVenues.Tokyo), TimeSpan.FromMinutes(5)));       // 15:25 JST
            Assert.Equal(U(2026, 1, 14, 4, 55), IndexEngine.DecisionUtc(new DateTime(2026, 1, 14), rule.At(IndexVenues.Sydney), TimeSpan.FromMinutes(5)));      // 15:55 AEDT
        }

        [Fact]
        public void Index_names_map_to_their_exchange()
        {
            Assert.Equal(Exchange.NewYork, IndexVenues.For(new[] { "US 500", "US500" }).Exchange);
            Assert.Equal(Exchange.NewYork, IndexVenues.For(new[] { "Wall Street 30", "US30" }).Exchange);
            Assert.Equal(Exchange.NewYork, IndexVenues.For(new[] { "US Tech 100", "USTEC", "NAS100" }).Exchange);
            Assert.Equal(Exchange.Frankfurt, IndexVenues.For(new[] { "Germany 40", "DE40" }).Exchange);
            Assert.Equal(Exchange.Frankfurt, IndexVenues.For(new[] { "Euro 50" }).Exchange);
            Assert.Equal(Exchange.Frankfurt, IndexVenues.For(new[] { "France 40" }).Exchange);
            Assert.Equal(Exchange.London, IndexVenues.For(new[] { "UK 100" }).Exchange);
            Assert.Equal(Exchange.Tokyo, IndexVenues.For(new[] { "Japan 225" }).Exchange);
            Assert.Equal(Exchange.Sydney, IndexVenues.For(new[] { "Australia 200", "AUS200" }).Exchange);
            Assert.Equal(Exchange.HongKong, IndexVenues.For(new[] { "Hong Kong 50" }).Exchange);
        }

        [Fact]
        public void A_frankfurt_session_is_built_from_frankfurt_hours()
        {
            // 14 July 2026 (CEST, UTC+2): 09:00-17:30 local = bars opening 07:00-15:00 UTC; 16:00 UTC (18:00 local) is outside.
            var rule = new IndexRule().At(IndexVenues.Frankfurt);
            var bars = new List<HourBar>();
            for (var h = 5; h <= 17; h++) bars.Add(new HourBar(U(2026, 7, 14, h), 100, 100 + h, 100 - h, 100 + h / 10.0));
            var s = IndexEngine.Sessions(bars, rule);
            Assert.Single(s);
            Assert.Equal(new DateTime(2026, 7, 14), s[0].Date);
            Assert.Equal(9, s[0].Bars);                        // 07:00..15:00 UTC
            Assert.Equal(100 + 15 / 10.0, s[0].C);              // close of the 15:00 UTC (17:00 local) bar
            Assert.Equal(115, s[0].H);
            Assert.Equal(85, s[0].L);
        }

        [Fact]
        public void Sessions_are_the_new_york_cash_hours_and_holidays_are_left_out()
        {
            var bars = new List<HourBar>();
            // Wed 1 July 2026 (EDT, UTC-4): UTC 12..20 = New York 08..16. In the session: opens 09:00..15:00 (UTC 13..19).
            for (var h = 12; h <= 20; h++) bars.Add(new HourBar(U(2026, 7, 1, h), 100, 100 + h, 90 - h, 95 + h));
            // Thu 2 July: a half day with 4 bars only (UTC 13..16) -> left out.
            for (var h = 13; h <= 16; h++) bars.Add(new HourBar(U(2026, 7, 2, h), 100, 101, 99, 100));
            // Sat 4 July: weekend bars are never a session.
            for (var h = 13; h <= 19; h++) bars.Add(new HourBar(U(2026, 7, 4, h), 100, 101, 99, 100));
            // Wed 2 December 2026 (EST, UTC-5): the session is UTC 14..20.
            for (var h = 13; h <= 21; h++) bars.Add(new HourBar(U(2026, 12, 2, h), 200, 200 + h, 190 - h, 195 + h));

            var s = IndexEngine.Sessions(bars.OrderByDescending(b => b.OpenUtc), new IndexRule());   // order does not matter
            Assert.Equal(2, s.Count);
            Assert.Equal(new SessionBar(new DateTime(2026, 7, 1), 100 + 19, 90 - 19, 95 + 19, 7), s[0]);
            Assert.Equal(new SessionBar(new DateTime(2026, 12, 2), 200 + 20, 190 - 20, 195 + 20, 7), s[1]);
        }

        // Sessions on consecutive weekdays from 1 Jan 2025, with high/low one point either side of the close.
        private static List<SessionBar> Sess(IEnumerable<double> closes)
        {
            var d = new DateTime(2025, 1, 1); var outp = new List<SessionBar>();
            foreach (var c in closes)
            {
                while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(1);
                outp.Add(new SessionBar(d, c + 1, c - 1, c, 7)); d = d.AddDays(1);
            }
            return outp;
        }

        // 202 rising closes (100..301), then 300, 299, 298: three lower closes in a row, well above the 200 average.
        private static List<SessionBar> DipInUptrend(int lower = 3) =>
            Sess(Enumerable.Range(0, 202).Select(i => 100.0 + i).Concat(Enumerable.Range(1, lower).Select(k => 301.0 - k)));

        [Fact]
        public void Buys_three_lower_closes_above_the_trend_average_with_a_three_atr_stop()
        {
            var rule = new IndexRule();
            var s = DipInUptrend();
            var d = IndexEngine.Decide(s, s[^1].Date, inPosition: false, enteredToday: false, closedToday: false, rule);
            Assert.Equal(IndexAction.Enter, d.Action);
            Assert.Equal("LOWER_CLOSES_IN_UPTREND", d.Reason);
            Assert.Equal(3, d.LowerRun);
            Assert.Equal(298, d.Close);
            // Last 200 closes: 105..301 (197 values) then 300, 299, 298.
            Assert.Equal((Enumerable.Range(105, 197).Sum() + 300 + 299 + 298) / 200.0, d.TrendAverage, 9);
            Assert.Equal((300 + 301 + 300 + 299 + 298) / 5.0, d.ExitAverage, 9);
            // Every true range is 2 (high/low one point from each close, closes one point apart).
            Assert.Equal(2, d.Atr, 9);
            Assert.Equal(6, d.StopDistance(rule), 9);
            Assert.Equal(20, d.TargetDistance(rule), 9);
        }

        [Fact]
        public void No_buy_without_enough_lower_closes_below_the_trend_or_without_history()
        {
            var rule = new IndexRule();
            var two = DipInUptrend(lower: 2);
            Assert.Equal("NOT_ENOUGH_LOWER_CLOSES", IndexEngine.Decide(two, two[^1].Date, false, false, false, rule).Reason);
            var falling = Sess(Enumerable.Range(0, 210).Select(i => 500.0 - i));
            Assert.Equal("BELOW_TREND_AVERAGE", IndexEngine.Decide(falling, falling[^1].Date, false, false, false, rule).Reason);
            var shortHistory = DipInUptrend().Skip(10).ToList();   // 195 sessions < 200
            Assert.Equal("NOT_ENOUGH_HISTORY", IndexEngine.Decide(shortHistory, shortHistory[^1].Date, false, false, false, rule).Reason);
            var s = DipInUptrend();
            Assert.Equal("NO_SESSION_TODAY", IndexEngine.Decide(s, s[^1].Date.AddDays(1), false, false, false, rule).Reason);
            Assert.Equal("ALREADY_TRADED_TODAY", IndexEngine.Decide(s, s[^1].Date, false, false, closedToday: true, rule).Reason);
        }

        [Fact]
        public void Sells_at_the_first_close_above_the_exit_average_but_never_on_the_entry_day()
        {
            var rule = new IndexRule();
            var s = DipInUptrend();
            s.Add(new SessionBar(s[^1].Date.AddDays(1), 303, 297, 302, 7));   // 302 > average(301,300,299,298,302) = 300
            var d = IndexEngine.Decide(s, s[^1].Date, inPosition: true, enteredToday: false, closedToday: false, rule);
            Assert.Equal(IndexAction.Exit, d.Action);
            Assert.Equal(IndexAction.Hold, IndexEngine.Decide(s, s[^1].Date, true, enteredToday: true, false, rule).Action);
            var still = DipInUptrend();
            Assert.Equal("NOT_ABOVE_EXIT_AVERAGE", IndexEngine.Decide(still, still[^1].Date, true, false, false, rule).Reason);
        }

        [Fact]
        public void Day_by_day_decisions_match_an_independent_implementation_of_the_research_rule()
        {
            // A drifting random walk of daily closes; the research rule (idx2.mjs V4) written out directly.
            var rnd = new Random(11); var c = 1000.0;
            var closes = Enumerable.Range(0, 1500).Select(_ => c *= 1 + 0.0004 + 0.011 * (rnd.NextDouble() - 0.5) * 3.46).ToList();
            var s = Sess(closes);
            var rule = new IndexRule();
            var engine = new List<(int, string)>(); var reference = new List<(int, string)>();
            var inPos = false;
            for (var i = rule.SessionsNeeded - 1; i < s.Count; i++)
            {
                var d = IndexEngine.Decide(s.Take(i + 1).ToList(), s[i].Date, inPos, false, false, rule);
                if (d.Action == IndexAction.Enter) { engine.Add((i, "in")); inPos = true; }
                else if (d.Action == IndexAction.Exit) { engine.Add((i, "out")); inPos = false; }
            }
            var refPos = false;
            for (var i = 199; i < s.Count; i++)
            {
                double Sma(int n) { double t = 0; for (var k = i - n + 1; k <= i; k++) t += closes[k]; return t / n; }
                if (refPos) { if (closes[i] > Sma(5)) { reference.Add((i, "out")); refPos = false; } continue; }
                if (closes[i] > Sma(200) && closes[i] < closes[i - 1] && closes[i - 1] < closes[i - 2] && closes[i - 2] < closes[i - 3]) { reference.Add((i, "in")); refPos = true; }
            }
            Assert.True(reference.Count > 20);
            Assert.Equal(reference, engine);
        }

        [Fact]
        public void Rule_values_are_checked()
        {
            Assert.Equal(TimeSpan.FromHours(16), IndexRule.ParseClock("16:00"));
            Assert.Equal(new TimeSpan(9, 30, 0), IndexRule.ParseClock("9:30"));
            Assert.Equal(new TimeSpan(9, 30, 0), IndexRule.ParseClock(" 09:30 "));
            Assert.Throws<FormatException>(() => IndexRule.ParseClock("4pm"));
            Assert.Throws<FormatException>(() => IndexRule.ParseClock("24:00"));
            Assert.Throws<FormatException>(() => new IndexRule(StopAtr: 3, FarTargetAtr: 2).Validated());
            Assert.Throws<FormatException>(() => new IndexRule(LowerCloses: 0).Validated());
            Assert.Throws<FormatException>(() => new IndexRule(SessionStart: TimeSpan.FromHours(17)).Validated());
            Assert.Equal(200, new IndexRule().Validated().SessionsNeeded);
        }

        [Fact]
        public void Index_watchlist_entries_take_broker_name_alternatives()
        {
            var w = Watchlist.Parse("US 500,US500,US SP 500|INDEX|0; EURUSD|FX|0");
            Assert.Equal(AssetClass.Index, w[0].Class);
            var broker = new[] { "EURUSD", "US SP 500", "Volatility 100 Index", "US Tech 100" };
            Assert.Equal("US SP 500", Watchlist.Resolve(w[0].Symbol, broker));
            Assert.Equal("US Tech 100", Watchlist.Resolve("NAS100,USTech100", broker));
            Assert.Null(Watchlist.Resolve("US 30,DJ30", broker));
            Assert.Equal(new[] { "US Tech 100" }, Watchlist.Suggest("US 100,NAS100", broker));   // shares "us" and "100"; Volatility 100 shares one token only
            Assert.Empty(Watchlist.Currencies("US Tech 100", AssetClass.Index));
            Assert.Throws<FormatException>(() => Watchlist.Parse("US 500|STOCK|0"));
        }
    }

    /// <summary>How the EA uses the index engine (ADR-0012): no shortcut around the boundary, and the tested exits only.</summary>
    public class IndexEngineInEaTests
    {
        private static string Ea()
        {
            var d = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
            while (d != null && !System.IO.Directory.Exists(System.IO.Path.Combine(d.FullName, "src", "Zugrio.CBot.Core"))) d = d.Parent;
            return System.IO.File.ReadAllText(System.IO.Path.Combine(d!.FullName, "src", "ZugrioEA", "ZugrioEA", "ZugrioEA.cs"));
        }

        private static string Method(string src, string signature)
        {
            var i = src.IndexOf(signature, StringComparison.Ordinal);
            Assert.True(i > 0, signature + " not found");
            var j = src.IndexOf("\n        }\n", i, StringComparison.Ordinal);
            return src.Substring(i, j - i);
        }

        [Fact]
        public void The_demo_record_carries_fills_costs_protection_exits_and_drawdown()
        {
            var src = Ea();
            var submit = Method(src, "private bool Submit(");
            // the quote is read before the order is sent, so spread and slippage are measured against what was seen
            Assert.True(submit.IndexOf("bidAtSubmit = o.Sym.Bid", StringComparison.Ordinal) < submit.IndexOf("_exec.MarketOrder(", StringComparison.Ordinal));
            foreach (var f in new[] { "[\"fill\"]", "[\"bid\"]", "[\"ask\"]", "[\"spreadPips\"]", "[\"slippagePips\"]", "[\"brokerStop\"]", "[\"brokerTarget\"]" })
                Assert.Contains(f, submit);
            var closed = Method(src, "private void OnPositionClosed(");
            foreach (var f in new[] { "[\"reason\"]", "[\"grossProfit\"]", "[\"commissions\"]", "[\"swap\"]", "[\"costs\"]", "[\"netProfit\"]", "[\"r\"]", "[\"maxDrawdown\"]" })
                Assert.Contains(f, closed);
            Assert.Contains("_equity.Update(Account.Equity);", Method(src, "protected override void OnTimer()"));
            Assert.Contains("\"equity\"", Method(src, "private void ReportEquity("));
        }

        [Fact]
        public void There_is_one_order_call_and_both_engines_reach_it_through_Submit()
        {
            var src = Ea();
            Assert.Single(System.Text.RegularExpressions.Regex.Matches(src, @"_exec\.MarketOrder\("));
            Assert.Contains("_exec.MarketOrder(", Method(src, "private bool Submit(EntryOrder o, DateTime now)"));
            Assert.Contains("Submit(new EntryOrder(", Method(src, "private void Enter(Pending p, DateTime now)"));
            Assert.Contains("Submit(new EntryOrder(", Method(src, "private void EnterIndex("));
            Assert.Contains("Submit(new EntryOrder(", Method(src, "private void EnterDrift("));
            Assert.Contains("Submit(new EntryOrder(", Method(src, "private void EnterCrypto("));
        }

        [Fact]
        public void Crypto_entries_check_demo_records_spread_size_and_tiers_before_submitting_and_exit_through_the_gate()
        {
            var src = Ea();
            var body = Method(src, "private void EnterCrypto(");
            var submit = body.IndexOf("Submit(new EntryOrder(", StringComparison.Ordinal);
            Assert.True(submit > 0);
            foreach (var must in new[] { "if (Positions.Find(label) != null || History.FindLast(label) != null) return;", "if (CryptoDemoOnly && _exec.IsLive)",
                         "MaxSpreadShareOfStop", "SizeFor(sym, price, stop)", "PortfolioSelector.Select(", "_killSwitch.Remaining(Account.Equity)" })
            {
                var at = body.IndexOf(must, StringComparison.Ordinal);
                Assert.True(at > 0 && at < submit, must + " must come before Submit");
            }
            var exit = Method(src, "private bool ExitCrypto(");
            Assert.True(exit.IndexOf("RiskReducingGate.Check(", StringComparison.Ordinal) < exit.IndexOf("_exec.Close(pos)", StringComparison.Ordinal));
            Assert.Contains("TradingStyles.Crypto) continue;", Method(src, "private void ManageOpenProfit("));
            Assert.Contains("RunCryptoEngine(now);", Method(src, "protected override void OnTimer()"));
            Assert.Contains("for (var i = 0; i < b.Count - 1; i++)", Method(src, "private static IReadOnlyList<DayClose> CryptoDaily("));
        }

        [Fact]
        public void Drift_entries_check_demo_spread_records_size_and_tiers_before_submitting_and_exit_through_the_gate()
        {
            var src = Ea();
            var body = Method(src, "private void EnterDrift(");
            var submit = body.IndexOf("Submit(new EntryOrder(", StringComparison.Ordinal);
            Assert.True(submit > 0);
            foreach (var must in new[] { "if (Positions.Find(label) != null || History.FindLast(label) != null) return;", "if (DriftDemoOnly && _exec.IsLive)",
                         "spread > dm.MaxSpread", "SizeFor(dm.Sym, price, stop)", "PortfolioSelector.Select(", "_killSwitch.Remaining(Account.Equity)" })
            {
                var at = body.IndexOf(must, StringComparison.Ordinal);
                Assert.True(at > 0 && at < submit, must + " must come before Submit");
            }
            var exits = Method(src, "private void RunDriftExits(");
            Assert.True(exits.IndexOf("RiskReducingGate.Check(", StringComparison.Ordinal) < exits.IndexOf("_exec.Close(pos)", StringComparison.Ordinal));
            Assert.Contains("TradingStyles.Drift) continue;", Method(src, "private void ManageOpenProfit("));
            Assert.Contains("RunDriftExits(now);", Method(src, "protected override void OnTimer()"));
            // a closed bar only: the bar that just opened is left out
            Assert.Contains("var n = b.Count - 1;", Method(src, "private void OnDriftBar("));
        }

        [Fact]
        public void Index_entries_check_broker_records_tiers_and_the_daily_allowance_before_submitting()
        {
            var body = Method(Ea(), "private void EnterIndex(");
            var submit = body.IndexOf("Submit(new EntryOrder(", StringComparison.Ordinal);
            foreach (var must in new[] { "if (Positions.Find(label) != null || History.FindLast(label) != null) return;", "SizeFor(im.Sym, price, stop)", "PortfolioSelector.Select(", "_killSwitch.Remaining(Account.Equity)" })
            {
                var at = body.IndexOf(must, StringComparison.Ordinal);
                Assert.True(at > 0 && at < submit, must + " must come before Submit");
            }
        }

        [Fact]
        public void Each_broker_symbol_is_resolved_into_at_most_one_market()
        {
            var body = Method(Ea(), "private void ResolveMarkets(");
            var once = body.IndexOf("if (!resolved.Add(sym.Name))", StringComparison.Ordinal);
            Assert.True(once > 0 && once < body.IndexOf("AddIndexMarket(item, sym)", StringComparison.Ordinal) && once < body.IndexOf("_markets.Add(m)", StringComparison.Ordinal));
        }

        [Fact]
        public void Open_trades_of_switched_off_styles_stay_managed_but_their_markets_are_never_scanned()
        {
            var src = Ea();
            var adopt = Method(src, "private void AdoptOpenTrades(");
            Assert.Contains("_markets.Add(m)", adopt);
            Assert.DoesNotContain("BarOpened", adopt);                                   // management only: no scan, no entry
            Assert.True(src.IndexOf("AdoptOpenTrades(watch);", StringComparison.Ordinal) > src.IndexOf("ResolveMarkets(watch);", StringComparison.Ordinal));
        }

        [Fact]
        public void Gold_trend_entries_and_exits_use_the_same_boundary_as_every_other_trade()
        {
            var src = Ea();
            var enter = Method(src, "private void EnterTrend(");
            var submit = enter.IndexOf("Submit(new EntryOrder(", StringComparison.Ordinal);
            Assert.True(submit > 0);
            foreach (var must in new[] { "if (Positions.Find(label) != null || History.FindLast(label) != null) return;", "SizeFor(sym, price, stop)", "PortfolioSelector.Select(", "_killSwitch.Remaining(Account.Equity)" })
            {
                var at = enter.IndexOf(must, StringComparison.Ordinal);
                Assert.True(at > 0 && at < submit, must + " must come before Submit");
            }
            var exit = Method(src, "private bool ExitTrend(");
            Assert.True(exit.IndexOf("RiskReducingGate.Check(", StringComparison.Ordinal) < exit.IndexOf("_exec.Close(pos)", StringComparison.Ordinal));
            Assert.Contains("if (TradingStyles.FromComment(pos.Comment) == TradingStyles.Trend) continue;", Method(src, "private void ManageOpenProfit(DateTime now)"));
            Assert.Single(System.Text.RegularExpressions.Regex.Matches(src, @"_exec\.MarketOrder\("));
        }

        [Fact]
        public void Every_index_market_decides_on_its_own_exchange_clock()
        {
            var src = Ea();
            var run = Method(src, "private void RunIndexEngine(DateTime now)");
            Assert.Contains("ExchangeTime.FromUtc(im.Exchange, now)", run);
            Assert.Contains("IndexEngine.DecisionUtc(today, im.Rule, _indexLead)", run);
            foreach (var m in new[] { "private void RunIndexEngine(DateTime now)", "private void DecideIndex(", "private void ReportIndexState(", "private IReadOnlyList<SessionBar> IndexSessions(" })
                Assert.DoesNotContain("NewYorkTime.", Method(src, m));
            Assert.Contains("IndexVenues.For(", Method(src, "private void AddIndexMarket("));
        }

        [Fact]
        public void Index_exits_close_through_the_risk_reducing_gate_and_profit_management_leaves_index_trades_alone()
        {
            var src = Ea();
            var exit = Method(src, "private void ExitIndex(");
            Assert.True(exit.IndexOf("RiskReducingGate.Check(", StringComparison.Ordinal) < exit.IndexOf("_exec.Close(pos)", StringComparison.Ordinal));
            Assert.Contains("if (TradingStyles.FromComment(pos.Comment) == TradingStyles.Index) continue;", Method(src, "private void ManageOpenProfit(DateTime now)"));
        }
    }
}
