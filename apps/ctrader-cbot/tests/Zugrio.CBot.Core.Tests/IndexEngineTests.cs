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
            Assert.Throws<FormatException>(() => IndexRule.ParseClock("4pm"));
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
        public void There_is_one_order_call_and_both_engines_reach_it_through_Submit()
        {
            var src = Ea();
            Assert.Single(System.Text.RegularExpressions.Regex.Matches(src, @"_exec\.MarketOrder\("));
            Assert.Contains("_exec.MarketOrder(", Method(src, "private bool Submit(EntryOrder o, DateTime now)"));
            Assert.Contains("Submit(new EntryOrder(", Method(src, "private void Enter(Pending p, DateTime now)"));
            Assert.Contains("Submit(new EntryOrder(", Method(src, "private void EnterIndex("));
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
        public void Index_exits_close_through_the_risk_reducing_gate_and_profit_management_leaves_index_trades_alone()
        {
            var src = Ea();
            var exit = Method(src, "private void ExitIndex(");
            Assert.True(exit.IndexOf("RiskReducingGate.Check(", StringComparison.Ordinal) < exit.IndexOf("_exec.Close(pos)", StringComparison.Ordinal));
            Assert.Contains("if (TradingStyles.FromComment(pos.Comment) == TradingStyles.Index) continue;", Method(src, "private void ManageOpenProfit(DateTime now)"));
        }
    }
}
