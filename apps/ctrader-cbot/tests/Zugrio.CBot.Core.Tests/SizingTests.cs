using System;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class SizingTests
    {
        // EURUSD-like: tick 0.00001, value 0.00001 per unit (1 unit moves 1e-5 USD per tick), min 1000, step 1000.
        private static SizingInput Eur(double balance, double riskPct, double maxAtMin, double stopDistance) =>
            new(balance, riskPct, maxAtMin, 1.10000, 1.10000 - stopDistance, 0.00001, 0.00001, 1000, 1000, 10_000_000, 1_000_000);

        [Fact]
        public void Normal_account_sizes_to_the_risk_budget()
        {
            var r = Sizing.Compute(Eur(10_000, 1, 5, 0.00200)); // 20 pips, $100 budget -> 50,000 units
            Assert.True(r.Trade);
            Assert.Equal(50_000, r.Units);
            Assert.Equal(1.0, r.RiskPctActual, 6);
        }

        [Fact]
        public void Twenty_dollar_account_uses_minimum_volume_only_within_the_cap()
        {
            var ok = Sizing.Compute(Eur(20, 1, 5, 0.00080));   // 8 pips at 1000 units = $0.80 = 4% <= 5%
            Assert.True(ok.Trade);
            Assert.Equal(1000, ok.Units);
            Assert.Equal("MINIMUM_VOLUME_WITHIN_SMALL_ACCOUNT_CAP", ok.Reason);
            var no = Sizing.Compute(Eur(20, 1, 5, 0.00200));   // 20 pips at 1000 units = $2 = 10% > 5%
            Assert.False(no.Trade);
            Assert.Equal("MINIMUM_VOLUME_EXCEEDS_RISK_CAP", no.Reason);
            Assert.Equal(10.0, no.RiskPctActual, 6);
        }

        [Fact]
        public void Never_exceeds_the_local_volume_cap_and_rounds_down_to_step()
        {
            var r = Sizing.Compute(Eur(10_000_000, 1, 5, 0.00010) with { LocalMaxUnits = 123_456 });
            Assert.Equal(123_000, r.Units);
        }

        [Theory]
        [InlineData(0, 1)]
        [InlineData(100, 0)]
        public void Invalid_inputs_do_not_trade(double balance, double risk) => Assert.False(Sizing.Compute(Eur(balance, risk, 5, 0.001)).Trade);

        [Fact]
        public void Zero_stop_distance_does_not_trade() => Assert.Equal("STOP_DISTANCE_ZERO", Sizing.Compute(Eur(100, 1, 5, 0)).Reason);

        [Fact]
        public void Iso_timestamps_match_decision_core_format() => Assert.Equal("2026-10-07T12:05:00.000Z", Timeframes.Iso(new DateTime(2026, 10, 7, 12, 5, 0, DateTimeKind.Utc)));
    }

    public class DailyLossKillSwitchTests
    {
        private static readonly DateTime D1 = new(2026, 10, 7, 9, 0, 0, DateTimeKind.Utc);

        [Fact]
        public void Trips_at_the_limit_and_stays_tripped_for_the_rest_of_the_day()
        {
            var k = new DailyLossKillSwitch(5);
            Assert.False(k.Update(D1, 100));
            Assert.False(k.Update(D1.AddHours(1), 95.01));
            Assert.True(k.Update(D1.AddHours(2), 95));      // trips once
            Assert.True(k.Tripped);
            Assert.False(k.Update(D1.AddHours(3), 99));      // recovery the same day does not clear it
            Assert.True(k.Tripped);
            Assert.True(k.Update(D1.AddHours(14), 50) == false && k.Tripped);
        }

        [Fact]
        public void Clears_on_the_next_UTC_day_with_a_new_baseline()
        {
            var k = new DailyLossKillSwitch(5);
            k.Update(D1, 100); k.Update(D1.AddHours(1), 90);
            Assert.True(k.Tripped);
            Assert.False(k.Update(D1.AddDays(1), 90));
            Assert.False(k.Tripped);
            Assert.Equal(90, k.DayStartEquity);
            Assert.True(k.Update(D1.AddDays(1).AddHours(1), 85.5));
        }

        [Fact]
        public void A_restart_seeded_from_broker_history_keeps_the_days_loss_limit()
        {
            var k = new DailyLossKillSwitch(5);
            k.Seed(D1.AddHours(3), 100);                       // balance 94 + 6 lost in trades closed today
            Assert.True(k.Update(D1.AddHours(3), 94));         // already past 5%: trips at once
            var fresh = new DailyLossKillSwitch(5);
            fresh.Seed(D1, 100);
            fresh.Seed(D1.AddHours(1), 50);                    // a second seed the same day is ignored
            Assert.Equal(100, fresh.DayStartEquity);
        }

        [Fact]
        public void A_day_may_not_lose_more_than_the_previous_day_made()
        {
            var k = new DailyLossKillSwitch(5, protectPreviousDayProfit: true);
            k.Update(D1, 100);
            k.Update(D1.AddHours(20), 102.40);                  // day 1 made +2.40
            Assert.False(k.Update(D1.AddDays(1), 102.40));      // day 2 starts
            Assert.Equal(2.40, k.PreviousDayProfit, 9);
            Assert.Equal(2.40, k.LimitMoney, 9);                // not 5% (5.12)
            Assert.Equal(1.40, k.Remaining(101.40), 9);
            Assert.False(k.Update(D1.AddDays(1).AddHours(1), 100.01));
            Assert.True(k.Update(D1.AddDays(1).AddHours(2), 100.00));   // gave back exactly day 1's gain
        }

        [Fact]
        public void After_a_losing_day_or_a_big_profit_the_percentage_limit_applies()
        {
            var k = new DailyLossKillSwitch(5, protectPreviousDayProfit: true);
            k.Seed(D1, 100, previousDayProfit: -3);
            Assert.Equal(5, k.LimitMoney, 9);
            var big = new DailyLossKillSwitch(5, protectPreviousDayProfit: true);
            big.Seed(D1, 100, previousDayProfit: 20);
            Assert.Equal(5, big.LimitMoney, 9);                  // the lesser of 5% and yesterday's profit
            var off = new DailyLossKillSwitch(5);
            off.Seed(D1, 100, previousDayProfit: 1);
            Assert.Equal(5, off.LimitMoney, 9);                  // rule switched off
        }

        [Fact]
        public void Rejects_a_non_positive_limit() => Assert.Throws<ArgumentOutOfRangeException>(() => new DailyLossKillSwitch(0));
    }

    public class EntrySideTests
    {
        [Theory]
        [InlineData(true, 111, 105, 130, true)]
        [InlineData(true, 104, 105, 130, false)]   // already through the stop
        [InlineData(true, 131, 105, 130, false)]   // already past the objective
        [InlineData(true, 105, 105, 130, false)]
        [InlineData(false, 111, 115, 90, true)]
        [InlineData(false, 116, 115, 90, false)]
        [InlineData(false, 89, 115, 90, false)]
        public void Price_must_be_strictly_between_stop_and_target(bool buy, double price, double stop, double target, bool ok) =>
            Assert.Equal(ok, EntrySide.PriceBetweenStopAndTarget(buy, price, stop, target));
    }
}
