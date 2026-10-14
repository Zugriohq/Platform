using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    /// <summary>The cycle 1 tick studies must read the structure a generated path has, and nothing else.</summary>
    public class TickStudiesTests
    {
        private static readonly DateTime T0 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        private static double Gauss(Random r) => Math.Sqrt(-2 * Math.Log(1 - r.NextDouble())) * Math.Cos(2 * Math.PI * r.NextDouble());

        [Fact]
        public void Range_break_reads_walls_jumps_and_through_breaks()
        {
            // +-1 point ticks between walls 20 apart; at a wall, with probability 1/100 a jump of 100 points THROUGH it.
            var rnd = new Random(3); double lo = 1000, hi = 1020, p = 1010; var ticks = new List<LabTick>();
            for (var i = 0; i < 200_000; i++)
            {
                if ((p == lo || p == hi) && rnd.NextDouble() < 0.01) { var d = p == lo ? -100 : 100; lo += d; hi += d; p += d; }
                else if (p == lo) p += 1; else if (p == hi) p -= 1; else p += rnd.Next(2) * 2 - 1;
                ticks.Add(new LabTick(T0.AddSeconds(i), p - 0.25, p + 0.25));
            }
            var lines = TickStudies.RangeBreak(ticks);
            var m = System.Text.RegularExpressions.Regex.Match(lines[0], @"going through it (\d+) of (\d+)");
            Assert.True(m.Success, lines[0]);
            Assert.True(int.Parse(m.Groups[2].Value) > 50);
            Assert.Equal(m.Groups[2].Value, m.Groups[1].Value);    // every break here goes through the wall it was at
            Assert.Equal(4, lines.Count);
        }

        [Fact]
        public void Range_break_fade_gains_between_walls_when_there_are_no_breaks()
        {
            var rnd = new Random(4); double lo = 1000, hi = 1040, p = 1020; var ticks = new List<LabTick>();
            for (var i = 0; i < 100_000; i++)
            {
                if (p == lo) p += 1; else if (p == hi) p -= 1; else p += rnd.Next(2) * 2 - 1;
                ticks.Add(new LabTick(T0.AddSeconds(i), p - 0.25, p + 0.25));
            }
            var hold300 = TickStudies.RangeBreak(ticks).Single(l => l.StartsWith("hold 300"));
            var avg = double.Parse(System.Text.RegularExpressions.Regex.Match(hold300, @"avg ([+-][\d.]+)").Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
            Assert.True(avg > 5, hold300);                            // a reflected walk from the wall, less the 0.5 spread
        }

        [Fact]
        public void Trek_finds_a_drift_and_reports_it_by_half()
        {
            var rnd = new Random(5); var p = 1000.0; var up = new List<LabTick>();
            for (var i = 0; i < 7 * 86400; i += 2) { p += 0.01 + 0.2 * Gauss(rnd); up.Add(new LabTick(T0.AddSeconds(i), p - 0.1, p + 0.1)); }
            var lines = TickStudies.Trek(up, 1);
            var rule = lines.Single(l => l.StartsWith("rule long 1 h"));
            Assert.Matches(@"first half \d+ hours, avg \+", rule);
            Assert.Matches(@"second half \d+ hours, avg \+", rule);
            Assert.Matches(@"short", TickStudies.Trek(up, -1).Last());
        }

        [Fact]
        public void Volatility_switch_regimes_beat_atr_and_constant_volatility_does_not()
        {
            List<LabTick> Path(bool switching, int seed)
            {
                var rnd = new Random(seed); var p = 1000.0; var vol = 0.1; var list = new List<LabTick>();
                for (var i = 0; i < 4 * 86400; i++)
                {
                    if (switching && rnd.NextDouble() < 1.0 / 1200) vol = new[] { 0.02, 0.1, 0.4 }[rnd.Next(3)];
                    p += vol * Gauss(rnd); list.Add(new LabTick(T0.AddSeconds(i), p - 0.01, p + 0.01));
                }
                return list;
            }
            double Ratio(IReadOnlyList<string> lines, string half)
            {
                var l = lines.Single(x => x.StartsWith("last-minute"));
                return double.Parse(System.Text.RegularExpressions.Regex.Match(l, half + @" half ([\d.]+)").Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
            }
            var sw = TickStudies.VolSwitch(Path(true, 6));
            Assert.True(Ratio(sw, "first") < 0.9 && Ratio(sw, "second") < 0.9, string.Join(" | ", sw));
            var flat = TickStudies.VolSwitch(Path(false, 7));
            Assert.True(Ratio(flat, "first") > 0.9 && Ratio(flat, "second") > 0.9, string.Join(" | ", flat));
        }
    }
}
