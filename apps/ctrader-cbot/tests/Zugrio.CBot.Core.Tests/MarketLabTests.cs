using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    /// <summary>Market Lab must recognise each designed behaviour from generated paths with a known answer.</summary>
    public class MarketLabTests
    {
        // Bars from a path of ticks: 30 ticks per bar, so highs and lows are prices actually visited.
        private static List<LabBar> Bars(Func<Random, int, double> step, int bars, int seed = 1, double start = 1000)
        {
            var rnd = new Random(seed); var p = start; var outp = new List<LabBar>(); var tick = 0;
            for (var i = 0; i < bars; i++)
            {
                double o = p, h = p, l = p;
                for (var k = 0; k < 30; k++) { p += step(rnd, tick++); h = Math.Max(h, p); l = Math.Min(l, p); }
                outp.Add(new LabBar(o, h, l, p));
            }
            return outp;
        }
        private static double Gauss(Random r) => Math.Sqrt(-2 * Math.Log(1 - r.NextDouble())) * Math.Cos(2 * Math.PI * r.NextDouble());

        [Fact]
        public void A_random_walk_is_classified_as_such_with_a_variance_ratio_near_one()
        {
            var f = MarketLab.Analyze(Bars((r, _) => 0.05 * Gauss(r), 20_000));
            Assert.Equal("RANDOM_WALK", f.Family);
            Assert.InRange(f.Vr15, 0.85, 1.15);
            Assert.InRange(f.JumpShare, 0, 0.0002);
        }

        [Fact]
        public void Crash_like_and_boom_like_paths_are_spike_families()
        {
            // Crash-like: small upward drift, a large drop on average once per 500 ticks.
            var crash = MarketLab.Analyze(Bars((r, _) => r.NextDouble() < 1.0 / 500 ? -3.0 : 0.006 + 0.02 * Gauss(r), 20_000));
            Assert.Equal("SPIKE_DOWN", crash.Family);
            Assert.True(crash.DriftPerBarPct > 0);
            var boom = MarketLab.Analyze(Bars((r, _) => r.NextDouble() < 1.0 / 500 ? 3.0 : -0.006 + 0.02 * Gauss(r), 20_000, seed: 2));
            Assert.Equal("SPIKE_UP", boom.Family);
        }

        [Fact]
        public void A_boom_index_whose_bars_between_spikes_move_by_an_almost_constant_step_is_still_spike_up()
        {
            // Reproduces the Deriv Boom 300-1000 reading (2026-10-10): a near-deterministic down step per tick, rare up
            // spikes. The robust sigma is about zero there, so every ordinary bar used to count as a "jump" (99.8%).
            // Fair: the step (-0.005) offsets the expected spike (5 / 1000), so the price stays near its start.
            var boom = MarketLab.Analyze(Bars((r, _) => r.NextDouble() < 1.0 / 1000 ? 5.0 : -0.005 + 0.00005 * Gauss(r), 20_000, seed: 12, start: 5000));
            Assert.Equal("SPIKE_UP", boom.Family);
            Assert.InRange(boom.JumpShare, 0.01, 0.06);    // about 1 - 0.999^30 = 3% of 30-tick bars hold a spike
            Assert.True(boom.DriftPerBarPct < 0);
        }

        [Fact]
        public void Regime_follow_finds_persistent_drift_between_symmetric_jumps_and_no_false_edge_on_a_jumpy_random_walk()
        {
            // Crash-Boom-Flip-like: drift switches sign every ~100 bars, plus jumps either way.
            var flip = Bars((r, t) => r.NextDouble() < 1.0 / 400 ? (r.NextDouble() < 0.5 ? 3.0 : -3.0) : ((t / 3000) % 2 == 0 ? 0.01 : -0.01) + 0.03 * Gauss(r), 30_000, seed: 13);
            var walk = Bars((r, _) => r.NextDouble() < 1.0 / 400 ? (r.NextDouble() < 0.5 ? 3.0 : -3.0) : 0.03 * Gauss(r), 30_000, seed: 14);
            var onFlip = MarketLab.RegimeFollow(flip, 60, 1.5, 2.0, 1.0, 60, spread: 0);
            var onWalk = MarketLab.RegimeFollow(walk, 60, 1.5, 2.0, 1.0, 60, spread: 0);
            Assert.True(onFlip.AvgR > 0 && onFlip.T > 3, $"flip t={onFlip.T}");
            // No false edge on a jumpy walk. It is in fact strongly negative: adverse jumps gap through the stop (filled at
            // the bar's extreme, many R), favourable ones stop at the target. That is why jump indices are off the EA's watchlist.
            Assert.True(onWalk.T < 3, $"walk t={onWalk.T}");
            Assert.Contains(MarketLab.Battery(flip, MarketLab.Analyze(flip), 0), t => t.Name.StartsWith("regime"));
        }

        [Fact]
        public void Symmetric_jumps_and_trending_regimes_are_told_apart()
        {
            var jump = MarketLab.Analyze(Bars((r, _) => r.NextDouble() < 1.0 / 400 ? (r.NextDouble() < 0.5 ? 3.0 : -3.0) : 0.03 * Gauss(r), 20_000, seed: 3));
            Assert.Equal("JUMP_SYMMETRIC", jump.Family);
            // Drift regimes that switch sign every ~3000 ticks (~100 bars): moves persist, VR > 1.
            var trend = MarketLab.Analyze(Bars((r, t) => ((t / 3000) % 2 == 0 ? 0.01 : -0.01) + 0.03 * Gauss(r), 20_000, seed: 4));
            Assert.Equal("TRENDING_REGIMES", trend.Family);
            Assert.True(trend.Vr60 > 1.3);
        }

        [Fact]
        public void Momentum_has_an_edge_only_where_regimes_persist()
        {
            var trendBars = Bars((r, t) => ((t / 3000) % 2 == 0 ? 0.01 : -0.01) + 0.03 * Gauss(r), 20_000, seed: 5);
            var walkBars = Bars((r, _) => 0.03 * Gauss(r), 20_000, seed: 6);
            var onTrend = MarketLab.Momentum(trendBars, 15, 1.5, 15, 0, follow: true);
            var onWalk = MarketLab.Momentum(walkBars, 15, 1.5, 15, 0, follow: true);
            Assert.True(onTrend.AvgR > 0 && onTrend.T > 3);
            Assert.True(Math.Abs(onWalk.T) < 3);
        }

        [Fact]
        public void Drift_follow_on_a_fair_spike_market_has_no_edge_and_the_spread_makes_it_negative()
        {
            // Fair: drift exactly offsets the expected spike (0.006 x 500 = 3.0), so the path is a martingale.
            var fair = Bars((r, _) => r.NextDouble() < 1.0 / 500 ? -3.0 : 0.006 + 0.02 * Gauss(r), 30_000, seed: 7);
            var free = MarketLab.DriftFollow(fair, +1, 1.0, 1.0, 60, spread: 0);
            var costly = MarketLab.DriftFollow(fair, +1, 1.0, 1.0, 60, spread: 0.2);
            Assert.True(Math.Abs(free.T) < 3);
            Assert.True(costly.AvgR < free.AvgR);
        }

        [Fact]
        public void An_edge_candidate_needs_a_high_t_and_a_positive_average_in_both_halves()
        {
            var trendBars = Bars((r, t) => ((t / 3000) % 2 == 0 ? 0.01 : -0.01) + 0.03 * Gauss(r), 20_000, seed: 8);
            var onTrend = MarketLab.Candidates(trendBars, MarketLab.Analyze(trendBars), spread: 0);
            Assert.Contains(onTrend, c => c.IsEdgeCandidate && c.Test.Name.StartsWith("momentum"));
            Assert.DoesNotContain(onTrend, c => c.IsEdgeCandidate && c.Test.Name.StartsWith("fade"));
            var walkBars = Bars((r, _) => 0.03 * Gauss(r), 20_000, seed: 9);
            Assert.DoesNotContain(MarketLab.Candidates(walkBars, MarketLab.Analyze(walkBars), spread: 0), c => c.IsEdgeCandidate);
            // A strong whole-history t with one losing half is not a candidate.
            var lopsided = new LabCandidate(new LabTest("x", 500, 0.2, 0.05, 0.55, 1.5), 0.45, -0.05);
            Assert.False(lopsided.IsEdgeCandidate);
        }

        [Fact]
        public void Symbols_come_in_keyword_priority_batches()
        {
            var broker = new[] { "Volatility 75 Index", "Crash 500 Index", "Boom 1000 Index", "EURUSD", "Boom 300 Index", "Jump 25 Index", "Crash 1000 Index" };
            var (b1, total) = MarketLab.SelectSymbols(broker, "boom, Crash ,Jump", first: 1, max: 3);
            Assert.Equal(5, total);
            Assert.Equal(new[] { "Boom 1000 Index", "Boom 300 Index", "Crash 1000 Index" }, b1);
            var (b2, _) = MarketLab.SelectSymbols(broker, "boom, Crash ,Jump", first: 4, max: 3);
            Assert.Equal(new[] { "Crash 500 Index", "Jump 25 Index" }, b2);
            Assert.Empty(MarketLab.SelectSymbols(broker, "Boom", first: 9, max: 3).Batch);
        }

        // Crash-like ticks: drift up between drops of `drop` points that come on average every `every` ticks.
        private static List<LabTick> CrashTicks(double drift, double drop, int every, double spread, int n, int seed)
        {
            var r = new Random(seed); var p = 9500.0; var t = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc); var o = new List<LabTick>(n);
            for (var i = 0; i < n; i++) { p += r.NextDouble() < 1.0 / every ? -drop : drift + 0.02 * Gauss(r); o.Add(new LabTick(t.AddSeconds(i), p - spread / 2, p + spread / 2)); }
            return o;
        }

        [Fact]
        public void Tick_replica_of_buy_tp2_sl2_on_a_fair_crash_index_loses_about_the_spread_and_wins_on_an_unfair_one()
        {
            // Fair: drift x 150 = drop (0.02 x 150 = 3 points). The win rate looks good, but losses jump past the stop.
            var fair = MarketLab.TickReplica(CrashTicks(0.02, 3.0, 150, 0.1, 400_000, 21), +1, 2, 2);
            Assert.True(fair.WinRate > 0.5);
            Assert.True(fair.AvgLossPts > 2);                                      // drops go through the stop
            Assert.True(fair.AvgPts < 0 && fair.T < 1);                            // about minus the spread, no edge
            Assert.True(fair.WinRate < fair.BreakEvenWinRate + 0.02);
            // Unfair (drift pays more than the drops take): the same rule wins clearly.
            var rich = MarketLab.TickReplica(CrashTicks(0.03, 3.0, 150, 0.1, 400_000, 22), +1, 2, 2);
            Assert.True(rich.AvgPts > 0 && rich.T > 3, $"t={rich.T}");
            Assert.True(rich.WinRate > rich.BreakEvenWinRate);
            // Buying only after a drop changes nothing on a memoryless generator.
            var after = MarketLab.TickReplica(CrashTicks(0.02, 3.0, 150, 0.1, 400_000, 23), +1, 2, 2, afterDropPts: 1.5, afterDropTicks: 10);
            Assert.True(after.AvgPts < 0.05 && after.T < 2);
        }

        [Fact]
        public void Generator_stats_call_a_fair_crash_generator_fair_and_an_unfair_one_unfair()
        {
            var fair = MarketLab.Generator(CrashTicks(0.02, 3.0, 150, 0.1, 400_000, 31));
            Assert.InRange(fair.FairZ, -3, 3);
            Assert.InRange(fair.TicksPerJump, 120, 190);              // one drop per ~150 ticks
            Assert.InRange(fair.AvgJump, -3.05, -2.95);
            Assert.InRange(fair.DriftBetweenJumps, 0.018, 0.022);
            Assert.Equal(0.1, fair.AvgSpread, 9);
            var rich = MarketLab.Generator(CrashTicks(0.03, 3.0, 150, 0.1, 400_000, 32));
            Assert.True(rich.FairZ > 3, $"z={rich.FairZ}");
        }

        [Fact]
        public void Replica_grid_covers_every_target_stop_and_direction_with_halves()
        {
            var ticks = CrashTicks(0.02, 3.0, 150, 0.1, 100_000, 33);
            var grid = MarketLab.ReplicaGrid(ticks, new[] { 1.0, 2.0 }, new[] { 1.0, 3.0 });
            Assert.Equal(8, grid.Count);
            Assert.Equal(4, grid.Count(x => x.All.Name.StartsWith("BUY")));
            // The second half restarts flat, so its trade sequence takes a few trades to line up with the whole run's.
            foreach (var x in grid) Assert.InRange(x.First.Trades + x.Second.Trades, 0.99 * x.All.Trades, 1.01 * x.All.Trades + 2);
            // A fair generator gives no grid candidate.
            Assert.DoesNotContain(grid, x => x.All.T >= MarketLab.CandidateT && x.First.AvgPts > 0 && x.Second.AvgPts > 0);
        }

        [Fact]
        public void Variance_ratio_and_summary_arithmetic()
        {
            var alt = Enumerable.Range(0, 400).Select(i => i % 2 == 0 ? 1.0 : -1.0).ToList();   // perfectly mean-reverting
            Assert.Equal(0, MarketLab.VarianceRatio(alt, 2), 9);
            var s = MarketLab.Summarise("x", new[] { 1.0, -1.0, 2.0, -0.5 });
            Assert.Equal(0.375, s.AvgR, 9);
            Assert.Equal(0.5, s.WinRate, 9);
            Assert.Equal(2.0, s.ProfitFactor, 9);
        }
    }
}
