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

        // The Step Index sell of 2026-10-08: R ~ 3.45 points, M15 ATR ~ 5. Sell 7330.9, stop 7334.35.
        private static readonly TrailSettings Keep = S with { KeepProfitFraction = 0.5 };

        [Fact]
        public void An_ATR_trail_wider_than_R_gives_most_of_the_move_back()
        {
            // Best 7325.1 (+5.8 = 1.68R): the 1-ATR trail alone sits at 7330.1, only +0.8 in profit.
            var stop = ProtectionManager.Propose(false, 7330.9, 7334.35, 7330.65, bestPrice: 7325.1, exitPrice: 7325.3, atr: 5, S);
            Assert.Equal(7330.1, stop!.Value, 9);
        }

        [Fact]
        public void Keeps_at_least_the_set_share_of_the_best_open_profit()
        {
            // Same trade with half kept: stop at 7330.9 - 2.9 = 7328.0 (+2.9), instead of +0.8.
            var stop = ProtectionManager.Propose(false, 7330.9, 7334.35, 7330.65, bestPrice: 7325.1, exitPrice: 7325.3, atr: 5, Keep);
            Assert.Equal(7328.0, stop!.Value, 9);
        }

        [Fact]
        public void Keep_starts_at_break_even_and_a_wide_ATR_trail_still_wins_when_tighter()
        {
            // Buy at 100, R = 2, ATR 2. At +2.4 (1.2R): keep half = 101.2, above the 100.1 break-even lock.
            Assert.Equal(101.2, ProtectionManager.Propose(true, 100, 98, 98, bestPrice: 102.4, exitPrice: 102.4, atr: 2, Keep)!.Value, 9);
            // Below 1R nothing moves, however much is kept.
            Assert.Null(ProtectionManager.Propose(true, 100, 98, 98, bestPrice: 101.9, exitPrice: 101.9, atr: 2, Keep));
            // At +10 the 1-ATR trail (108) is tighter than half (105): the trail is used.
            Assert.Equal(108, ProtectionManager.Propose(true, 100, 98, 101.2, bestPrice: 110, exitPrice: 110, atr: 2, Keep)!.Value, 9);
        }

        [Fact]
        public void Keep_still_respects_the_gap_to_the_market()
        {
            // Best 106, keep half = 103, but price is back at 103.2: the stop is capped 0.2 ATR below, at 102.8.
            Assert.Equal(102.8, ProtectionManager.Propose(true, 100, 98, 100.1, bestPrice: 106, exitPrice: 103.2, atr: 2, Keep with { TrailStartR = 10 })!.Value, 9);
        }

        [Theory]
        [InlineData(-0.1)]
        [InlineData(1.0)]
        public void Rejects_a_keep_share_outside_0_to_1(double f) =>
            Assert.Throws<ArgumentOutOfRangeException>(() => S with { KeepProfitFraction = f });

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

    public class TrendFilterTests
    {
        [Theory]
        [InlineData(Side.Buy, "UP", "CONTINUATION_RETEST", false, true)]
        [InlineData(Side.Buy, "DOWN", "CONTINUATION_RETEST", false, false)]
        [InlineData(Side.Buy, "MIXED", "CONTINUATION_RETEST", false, false)]
        [InlineData(Side.Sell, "DOWN", "CONTINUATION_RETEST", false, true)]
        [InlineData(Side.Sell, "UNKNOWN", "CONTINUATION_RETEST", false, false)]
        [InlineData(Side.Buy, "DOWN", "REVERSAL_RECLAIM", false, true)]     // reclaims exempt by default
        [InlineData(Side.Buy, "DOWN", "REVERSAL_RECLAIM", true, false)]
        public void Trades_only_with_the_structure(Side side, string trend, string route, bool includeReversal, bool allowed) =>
            Assert.Equal(allowed, TrendFilter.Allows(side, trend, route, includeReversal));
    }
}
