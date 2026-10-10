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
