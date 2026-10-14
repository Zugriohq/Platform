using System;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class FomcEngineTests
    {
        private static DateTime U(int y, int m, int d, int h, int min) => new(y, m, d, h, min, 0, DateTimeKind.Utc);

        [Fact]
        public void Dates_parse_sorted_and_distinct_and_bad_entries_are_errors()
        {
            var d = FomcEngine.ParseDates("2026-12-09; 2026-10-28, 2026-10-28;");
            Assert.Equal(new[] { new DateTime(2026, 10, 28), new DateTime(2026, 12, 9) }, d.ToArray());
            Assert.Throws<FormatException>(() => FomcEngine.ParseDates("2026-13-01"));
            Assert.Throws<FormatException>(() => FomcEngine.ParseDates("2026-10-31"));   // a Saturday
            Assert.Equal(16, FomcEngine.ParseDates(FomcEngine.DefaultDates).Count);
            Assert.All(FomcEngine.ParseDates(FomcEngine.DefaultDates), x => Assert.Equal(DayOfWeek.Wednesday, x.DayOfWeek));
        }

        [Fact]
        public void Window_is_14_00_New_York_the_day_before_to_13_55_on_the_day_across_daylight_saving()
        {
            var rule = new FomcRule();
            Assert.Equal((U(2026, 10, 27, 18, 0), U(2026, 10, 28, 17, 55)), FomcEngine.Window(new DateTime(2026, 10, 28), rule));   // EDT
            Assert.Equal((U(2026, 12, 8, 19, 0), U(2026, 12, 9, 18, 55)), FomcEngine.Window(new DateTime(2026, 12, 9), rule));      // EST
            Assert.Equal(new DateTime(2026, 10, 23), FomcEngine.PreviousWeekday(new DateTime(2026, 10, 26)));                     // Monday -> Friday
        }

        [Fact]
        public void Flat_enters_only_inside_the_entry_window_of_the_next_statement()
        {
            var dates = FomcEngine.ParseDates("2026-10-28; 2026-12-09");
            var rule = new FomcRule();
            Assert.Equal("WAITING_FOR_ENTRY", FomcEngine.Decide(U(2026, 10, 27, 17, 59), dates, null, rule).Reason);
            var d = FomcEngine.Decide(U(2026, 10, 27, 18, 5), dates, null, rule);
            Assert.Equal(FomcAction.Enter, d.Action); Assert.Equal(new DateTime(2026, 10, 28), d.Statement);
            Assert.Equal("ENTRY_WINDOW_MISSED", FomcEngine.Decide(U(2026, 10, 27, 18, 31), dates, null, rule).Reason);
            var after = FomcEngine.Decide(U(2026, 10, 28, 18, 0), dates, null, rule);
            Assert.Equal("WAITING_FOR_ENTRY", after.Reason); Assert.Equal(new DateTime(2026, 12, 9), after.Statement);
            Assert.Equal("NO_DATES_AHEAD", FomcEngine.Decide(U(2027, 1, 1, 0, 0), dates, null, rule).Reason);
        }

        [Fact]
        public void A_trade_is_held_to_its_statement_day_exit_and_a_stray_trade_is_closed()
        {
            var dates = FomcEngine.ParseDates("2026-10-28; 2026-12-09");
            var rule = new FomcRule();
            var entered = U(2026, 10, 27, 18, 1);
            Assert.Equal("HOLDING_TO_EXIT", FomcEngine.Decide(U(2026, 10, 28, 17, 54), dates, entered, rule).Reason);
            Assert.Equal(FomcAction.Exit, FomcEngine.Decide(U(2026, 10, 28, 17, 55), dates, entered, rule).Action);
            Assert.Equal(FomcAction.Exit, FomcEngine.Decide(U(2026, 11, 2, 10, 0), dates, entered, rule).Action);   // after a restart
            Assert.Equal("NO_STATEMENT_AFTER_ENTRY", FomcEngine.Decide(U(2027, 1, 2, 0, 0), dates, U(2027, 1, 1, 0, 0), rule).Reason);
        }
    }
}
