using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    public class DriftEngineTests
    {
        private static List<LabBar> Bars(Func<Random, double> step, int n, int seed)
        {
            var rnd = new Random(seed); var p = 3000.0; var list = new List<LabBar>();
            for (var i = 0; i < n; i++)
            {
                double o = p, h = p, l = p;
                for (var k = 0; k < 60; k++) { p += step(rnd); h = Math.Max(h, p); l = Math.Min(l, p); }
                list.Add(new LabBar(o, h, l, p));
            }
            return list;
        }
        private static double Gauss(Random r) => Math.Sqrt(-2 * Math.Log(1 - r.NextDouble())) * Math.Cos(2 * Math.PI * r.NextDouble());

        [Theory]
        [InlineData("Drift Switch Index 10", 2, 5)]
        [InlineData("Drift Switch Index 20", 5, 10)]
        [InlineData("Drift Switch Index 30", 8, 15)]
        [InlineData("DSI20", 5, 10)]
        public void The_rule_for_each_index_is_the_tested_cell(string name, int lookback, int hold)
        {
            var r = DriftRule.ForRegimeMinutes(DriftEngine.RegimeMinutes(name));
            Assert.Equal(lookback, r.Lookback); Assert.Equal(hold, r.Hold);
            Assert.Equal(3.0, r.StopAtr); Assert.Equal(1440, r.SigmaBars);
        }

        [Fact]
        public void Follows_a_drift_that_clears_the_threshold_and_ignores_noise()
        {
            var calm = Bars(r => 0.05 * Gauss(r), 1500, 1);
            var rule = DriftRule.ForRegimeMinutes(20);
            // a strong last five minutes up
            var up = calm.Take(1495).ToList(); var p = up[^1].C;
            for (var i = 0; i < 5; i++) { up.Add(new LabBar(p, p + 2, p, p + 2)); p += 2; }
            var s = DriftEngine.Decide(up, rule);
            Assert.Equal(1, s.Direction); Assert.Equal("DRIFT_UP", s.Reason);
            Assert.True(s.Atr > 0 && s.Sigma > 0);
            // the last minutes flat: no move, no signal
            var flat = calm.Take(1494).ToList(); var q = flat[^1].C;
            for (var i = 0; i < 6; i++) flat.Add(new LabBar(q, q + 0.01, q - 0.01, q));
            Assert.Equal("BELOW_THRESHOLD", DriftEngine.Decide(flat, rule).Reason);
            Assert.Equal("NOT_ENOUGH_HISTORY", DriftEngine.Decide(calm.Take(1000).ToList(), rule).Reason);
        }

        [Fact]
        public void On_drift_regimes_the_signal_is_right_more_often_than_not_and_on_a_random_walk_it_is_a_coin()
        {
            double Hit(Func<Random, double> step, int seed)
            {
                var b = Bars(step, 6000, seed); var rule = DriftRule.ForRegimeMinutes(20); int hits = 0, n = 0;
                for (var i = 1500; i + rule.Hold < b.Count; i += rule.Hold)
                {
                    var s = DriftEngine.Decide(b.Take(i + 1).ToList(), rule); if (s.Direction == 0) continue;
                    n++; if (Math.Sign(b[i + rule.Hold].C - b[i].C) == s.Direction) hits++;
                }
                return (double)hits / Math.Max(1, n);
            }
            var drift = 0.0;
            var regimes = Hit(r => { if (r.NextDouble() < 1.0 / 1200) drift = 0.004 * (r.Next(3) - 1); return drift + 0.05 * Gauss(r); }, 2);
            Assert.True(regimes > 0.6, $"hit rate on regimes {regimes}");
            var walk = Hit(r => 0.05 * Gauss(r), 3);
            Assert.InRange(walk, 0.4, 0.6);
        }
    }
}
