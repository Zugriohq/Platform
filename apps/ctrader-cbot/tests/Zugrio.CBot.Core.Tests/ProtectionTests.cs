using System;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class ProtectionManagerTests
    {
        // Buy at 100 with initial stop 98 (R = 2), ATR 2.
        private static readonly TrailSettings S = new(BreakEvenAtR: 1.0, BreakEvenLockAtr: 0.05, TrailStartR: 1.5, TrailAtr: 1.0, MinStepAtr: 0.1, MinGapAtr: 0.2);

        [Fact]
        public void Nothing_changes_before_one_R_of_profit()
        {
            Assert.Null(ProtectionManager.Propose(true, 100, 98, 98, bestPrice: 101.9, exitPrice: 101.5, atr: 2, S));
        }

        [Fact]
        public void At_one_R_the_stop_moves_to_entry_plus_a_small_lock()
        {
            var stop = ProtectionManager.Propose(true, 100, 98, 98, bestPrice: 102, exitPrice: 102, atr: 2, S);
            Assert.Equal(100.1, stop!.Value, 9);
        }

        [Fact]
        public void From_one_and_a_half_R_it_trails_the_best_price()
        {
            var stop = ProtectionManager.Propose(true, 100, 98, 100.1, bestPrice: 106, exitPrice: 105.5, atr: 2, S);
            Assert.Equal(104, stop!.Value, 9);          // 106 - 1 ATR
        }

        [Fact]
        public void Never_loosens_and_ignores_tiny_improvements()
        {
            Assert.Null(ProtectionManager.Propose(true, 100, 98, 104.5, bestPrice: 106, exitPrice: 105, atr: 2, S));   // would loosen to 104
            Assert.Null(ProtectionManager.Propose(true, 100, 98, 103.9, bestPrice: 106, exitPrice: 105, atr: 2, S));   // +0.1 < 0.2 step
        }

        [Fact]
        public void Never_places_the_stop_at_or_through_the_market()
        {
            // Best was 106 but price fell back to 104.1: trail 104 would sit 0.1 below the bid; the gap rule caps it at 103.7.
            var stop = ProtectionManager.Propose(true, 100, 98, 100.1, bestPrice: 106, exitPrice: 104.1, atr: 2, S);
            Assert.Equal(103.7, stop!.Value, 9);
        }

        [Fact]
        public void Mirror_image_for_sells()
        {
            // Sell at 100, stop 102 (R = 2). Best 94 => trail 96.
            var stop = ProtectionManager.Propose(false, 100, 102, 102, bestPrice: 94, exitPrice: 94.5, atr: 2, S);
            Assert.Equal(96, stop!.Value, 9);
            var classified = OrderClassifier.Classify(new PositionView("p", "X", Side.Sell, 1, 102m, null, "zugrio:x"), new SetStopLoss("p", (decimal)stop.Value));
            Assert.Equal(RiskEffect.RiskReducing, classified);
        }

        [Fact]
        public void Initial_stop_round_trips_through_the_broker_comment()
        {
            var c = ProtectionManager.WithInitialStop("zugrio cfg=abc eng=def opp=123", 1.08734);
            Assert.Equal(1.08734, ProtectionManager.InitialStopFrom(c));
            Assert.Null(ProtectionManager.InitialStopFrom("zugrio cfg=abc"));
            Assert.Null(ProtectionManager.InitialStopFrom(null));
        }
    }

    public class DailyProfitLockTests
    {
        private static readonly DateTime D1 = new(2026, 10, 8, 0, 0, 0, DateTimeKind.Utc);

        [Fact]
        public void A_good_day_cannot_be_handed_back_in_full()
        {
            var k = new DailyLossKillSwitch(5, protectPreviousDayProfit: false, profitLockFraction: 0.5);
            k.Seed(D1, 100);
            Assert.Equal(95, k.Floor, 9);                         // before any profit: the 5% loss limit
            Assert.False(k.Update(D1.AddHours(2), 110));          // up 10
            Assert.Equal(105, k.Floor, 9);                        // locks half of the gain
            Assert.Equal(3, k.Remaining(108), 9);
            Assert.True(k.Update(D1.AddHours(3), 105));           // gave back half: new entries stop
            Assert.True(k.Tripped);
        }

        [Fact]
        public void Lock_off_keeps_the_plain_loss_limit()
        {
            var k = new DailyLossKillSwitch(5);
            k.Seed(D1, 100);
            k.Update(D1.AddHours(1), 110);
            Assert.Equal(95, k.Floor, 9);
            Assert.False(k.Update(D1.AddHours(2), 96));
        }

        [Fact]
        public void Rejects_a_lock_fraction_outside_0_to_1() =>
            Assert.Throws<ArgumentOutOfRangeException>(() => new DailyLossKillSwitch(5, false, 1.0));
    }
}
