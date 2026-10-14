using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    /// <summary>
    /// The family behaviour study must (1) read each Deriv name as its family, (2) find the structure each family's rule
    /// is looking for when a generated path has it, and (3) find none on a path that does not.
    /// </summary>
    public class BehaviourTests
    {
        // Bars from a path of ticks: 30 ticks per bar (Deriv's 2-second ticks), so highs and lows are prices visited.
        private static List<LabBar> Bars(Func<Random, double, double> step, int bars, int seed = 1, double start = 1000)
        {
            var rnd = new Random(seed); var p = start; var outp = new List<LabBar>();
            for (var i = 0; i < bars; i++)
            {
                double o = p, h = p, l = p;
                for (var k = 0; k < 30; k++) { p += step(rnd, p); h = Math.Max(h, p); l = Math.Min(l, p); }
                outp.Add(new LabBar(o, h, l, p));
            }
            return outp;
        }
        private static double Gauss(Random r) => Math.Sqrt(-2 * Math.Log(1 - r.NextDouble())) * Math.Cos(2 * Math.PI * r.NextDouble());

        [Theory]
        [InlineData("Drift Switch Index 20", DerivFamily.DriftSwitch, 20, 0)]
        [InlineData("Range Break 100 Index", DerivFamily.RangeBreak, 100, 0)]
        [InlineData("DEX 600 UP Index", DerivFamily.Dex, 600, 1)]
        [InlineData("DEX 1500 DOWN Index", DerivFamily.Dex, 1500, -1)]
        [InlineData("Boom 500 Index", DerivFamily.Boom, 500, 1)]
        [InlineData("Crash 1000 Index", DerivFamily.Crash, 1000, -1)]
        [InlineData("Vol over Boom 400", DerivFamily.Hybrid, 400, 1)]
        [InlineData("Vol over Crash 550", DerivFamily.Hybrid, 550, -1)]
        [InlineData("Jump 25 Index", DerivFamily.Jump, 25, 0)]
        [InlineData("Step Index 200", DerivFamily.Step, 200, 0)]
        [InlineData("Multi Step 2 Index", DerivFamily.MultiStep, 2, 0)]
        [InlineData("Skew Step Index 4 Up", DerivFamily.SkewStep, 4, 1)]
        [InlineData("Trek Down Index", DerivFamily.Trek, double.NaN, -1)]
        [InlineData("Bull Market Index", DerivFamily.DailyReset, double.NaN, 1)]
        [InlineData("Volatility 75 (1s) Index", DerivFamily.Volatility, 75, 0)]
        [InlineData("Volatility Switch Index High", DerivFamily.VolatilitySwitch, double.NaN, 0)]
        [InlineData("Crash Boom Flip 150", DerivFamily.Unknown, 150, 0)]
        public void Reads_a_Deriv_name_as_its_family_number_and_declared_direction(string name, DerivFamily family, double number, int dir)
        {
            var p = Behaviour.Classify(name);
            Assert.Equal(family, p.Family);
            if (double.IsNaN(number)) Assert.True(double.IsNaN(p.Number)); else Assert.Equal(number, p.Number);
            Assert.Equal(dir, p.Direction);
            Assert.NotEmpty(p.Declared);
        }

        [Fact]
        public void Drift_switch_regimes_are_found_and_a_random_walk_gives_no_candidate()
        {
            // Regimes of +mu, -mu or 0 drift lasting 20 minutes (600 ticks) on average, as Deriv describes DSI 20.
            var drift = 0.0;
            var dsi = Bars((r, _) => { if (r.NextDouble() < 1.0 / 600) drift = 0.004 * (r.Next(3) - 1); return drift + 0.05 * Gauss(r); }, 20_000);
            var prof = Behaviour.Profile(Behaviour.Classify("Drift Switch Index 20"), dsi, 0.01);
            Assert.True(prof.Vr15 > 1.3, $"VR15 {prof.Vr15}");
            var c = Behaviour.Candidates(Behaviour.Classify("Drift Switch Index 20"), dsi, 0.01);
            Assert.Contains(c, x => x.IsEdgeCandidate);
            var rw = Bars((r, _) => 0.05 * Gauss(r), 20_000, seed: 3);
            Assert.DoesNotContain(Behaviour.Candidates(Behaviour.Classify("Drift Switch Index 20"), rw, 0.01), x => x.IsEdgeCandidate);
        }

        [Fact]
        public void A_bouncing_range_pays_the_range_fade_and_a_random_walk_does_not()
        {
            // Reflecting walls 20 points apart; after on average 100 wall hits the range moves to a new level.
            double lo = 990, hi = 1010; var hits = 0;
            var rb = Bars((r, p) =>
            {
                var d = 0.3 * Gauss(r);
                if (p + d > hi || p + d < lo) { hits++; if (r.NextDouble() < 1.0 / 100) { var shift = (r.Next(2) * 2 - 1) * 20; lo += shift; hi += shift; return shift / 2.0; } return -d; }
                return d;
            }, 20_000);
            Assert.True(hits > 1000);
            var c = Behaviour.Candidates(Behaviour.Classify("Range Break 100 Index"), rb, 0.05);
            Assert.Contains(c, x => x.IsEdgeCandidate && x.Test.Name.StartsWith("range fade", StringComparison.Ordinal));
            var rw = Bars((r, _) => 0.3 * Gauss(r), 20_000, seed: 4);
            Assert.DoesNotContain(Behaviour.Candidates(Behaviour.Classify("Range Break 100 Index"), rw, 0.05), x => x.IsEdgeCandidate);
        }

        [Fact]
        public void A_memoryless_boom_has_no_overdue_spike_and_one_with_a_rising_hazard_does()
        {
            // Memoryless: a spike on any tick with probability 1/500, as Deriv's "on average once every 500 ticks" allows.
            var fair = Bars((r, _) => r.NextDouble() < 1.0 / 500 ? 5.0 : -0.01 + 0.002 * Gauss(r), 30_000, seed: 5, start: 10_000);
            var pf = Behaviour.Profile(Behaviour.Classify("Boom 500 Index"), fair, 0.05);
            Assert.InRange(pf.LateEarlyHazard, 0.8, 1.25);
            Assert.DoesNotContain(Behaviour.Candidates(Behaviour.Classify("Boom 500 Index"), fair, 0.05), x => x.IsEdgeCandidate && x.Test.Name.StartsWith("overdue", StringComparison.Ordinal));
            // "Due": no spike for 400 ticks after one, then a high chance each tick. Here TTI's rule would be right.
            var since = 0;
            var due = Bars((r, _) => { since++; if (since > 400 && r.NextDouble() < 1.0 / 50) { since = 0; return 5.0; } return -0.0111 + 0.002 * Gauss(r); }, 30_000, seed: 6, start: 10_000);
            var pd = Behaviour.Profile(Behaviour.Classify("Boom 500 Index"), due, 0.05);
            Assert.True(pd.LateEarlyHazard > 2 && pd.HazardZ > 4, $"hazard {pd.LateEarlyHazard} z {pd.HazardZ}");
            Assert.Contains(Behaviour.Candidates(Behaviour.Classify("Boom 500 Index"), due, 0.05), x => x.IsEdgeCandidate && x.Test.Name.StartsWith("overdue", StringComparison.Ordinal));
        }

        [Fact]
        public void A_fair_step_index_has_no_streak_edge_and_a_persistent_one_does()
        {
            var fair = Bars((r, _) => r.NextDouble() < 0.5 ? 0.1 : -0.1, 20_000, seed: 7);
            Assert.DoesNotContain(Behaviour.Candidates(Behaviour.Classify("Step Index"), fair, 0.1), x => x.IsEdgeCandidate);
            // Persistent at the candle level, where TTI counts its streak: steps lean 60/40 one way, and the lean flips
            // on average every 300 ticks (10 bars), so runs of rising bars tend to continue.
            var lean = 1;
            var sticky = Bars((r, _) => { if (r.NextDouble() < 1.0 / 300) lean = -lean; return r.NextDouble() < 0.6 ? 0.1 * lean : -0.1 * lean; }, 20_000, seed: 8);
            Assert.Contains(Behaviour.Candidates(Behaviour.Classify("Step Index"), sticky, 0.1), x => x.IsEdgeCandidate && x.Test.Name.Contains("follow"));
        }

        [Fact]
        public void A_declared_drift_is_found_by_holding_in_its_direction_and_not_against_it()
        {
            var bull = Bars((r, _) => 0.002 + 0.05 * Gauss(r), 20_000, seed: 9);
            var c = Behaviour.Candidates(Behaviour.Classify("Bull Market Index"), bull, 0.01);
            Assert.All(c, x => Assert.StartsWith("hold long", x.Test.Name));
            Assert.Contains(c, x => x.IsEdgeCandidate);
        }

        [Fact]
        public void Symmetric_jumps_on_a_random_walk_give_no_after_jump_edge()
        {
            var jump = Bars((r, _) => r.NextDouble() < 1.0 / 600 ? (r.Next(2) * 2 - 1) * 30 * 0.05 * Gauss(r) : 0.05 * Gauss(r), 30_000, seed: 10);
            var prof = Behaviour.Profile(Behaviour.Classify("Jump 25 Index"), jump, 0.01);
            Assert.InRange(prof.UpJumpShare, 0.3, 0.7);
            Assert.DoesNotContain(Behaviour.Candidates(Behaviour.Classify("Jump 25 Index"), jump, 0.01), x => x.IsEdgeCandidate);
        }
    }
}
