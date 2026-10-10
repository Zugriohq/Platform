using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Internals;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Lab
{
    /// <summary>
    /// Zugrio Market Lab (research, no trading authority; places no orders). For each synthetic index on the account it
    /// loads the broker's own M1 history, measures what kind of market it is (random walk, spike up/down, symmetric
    /// jumps, trending regimes, mean reverting) and self-tests the family's obvious rules after the current spread:
    /// drift-follow for spike markets, momentum and fade for all. Results go to the Journal as "LAB" lines, then it stops.
    /// Many rules are tested per symbol, so only |t| above about 3.5 deserves a second look.
    ///
    /// Runs in batches: a cloud instance keeps every loaded bar series in memory until the cBot stops, and one run
    /// over ~60 synthetics x 14 days of M1 bars ran out of memory (2026-10-10). Each run takes the next batch
    /// (keyword order = priority) and prints each symbol's verdict as soon as it is known.
    /// </summary>
    [Robot(AccessRights = AccessRights.None, AddIndicators = false, TimeZone = TimeZones.UTC)]
    public class ZugrioMarketLab : Robot
    {
        // Volatility indices are left out by default: they are random walks by design (no rule can have an edge),
        // and they are the largest group. Add "Volatility" to measure them anyway.
        public const string DefaultKeywords = "Boom,Crash,Jump,Range Break,DEX,Drift,Step,Multi,Skew,Hybrid,Trek,Spike,GainX,PainX";

        // Property names differ from the first version so an instance that saved its old values (80 symbols, 14 days) gets these.
        [Parameter("Symbol keywords, in priority order", DefaultValue = DefaultKeywords)] public string Keywords { get; set; } = DefaultKeywords;
        [Parameter("Days of M1 history", DefaultValue = 7, MinValue = 2, MaxValue = 30)] public int HistoryDays { get; set; } = 7;
        [Parameter("Symbols per run (memory)", DefaultValue = 12, MinValue = 1, MaxValue = 40)] public int SymbolsPerRun { get; set; } = 12;
        [Parameter("Start at symbol number", DefaultValue = 1, MinValue = 1, MaxValue = 500)] public int FirstSymbol { get; set; } = 1;

        protected override void OnStart()
        {
            var ci = CultureInfo.InvariantCulture;
            var (names, total) = MarketLab.SelectSymbols(Enumerable.Range(0, Symbols.Count).Select(i => Symbols[i]), Keywords, FirstSymbol, SymbolsPerRun);
            var last = FirstSymbol + names.Count - 1;
            Print($"Zugrio Market Lab: symbols {FirstSymbol}-{last} of {total} matching, {HistoryDays} days of M1 history each: {string.Join(", ", names)}. No orders are placed.");
            var verdicts = new List<string>();
            foreach (var name in names)
            {
                try
                {
                    var bars = MarketData.GetBars(TimeFrame.Minute, name);
                    var from = Server.TimeInUtc.AddDays(-HistoryDays);
                    for (var k = 0; k < 300 && bars.Count > 0 && bars.OpenTimes[0] > from; k++) if (bars.LoadMoreHistory() == 0) break;
                    var list = new List<LabBar>();
                    for (var i = 0; i < bars.Count - 1; i++)   // the last bar is still forming
                        if (bars.OpenTimes[i] >= from) list.Add(new LabBar(bars.OpenPrices[i], bars.HighPrices[i], bars.LowPrices[i], bars.ClosePrices[i]));
                    if (list.Count < 2000) { Print($"Zugrio Market Lab: {name}: only {list.Count} M1 bars, skipped."); continue; }
                    var sym = Symbols.GetSymbol(name);
                    var spread = sym == null ? 0 : sym.Ask - sym.Bid;
                    var f = MarketLab.Analyze(list);
                    var ranked = MarketLab.Candidates(list, f, spread);
                    Print($"LAB {name}: {f.Family} | {f.Bars} bars, spread {spread.ToString("G5", ci)}, jumps {(100 * f.JumpShare).ToString("F3", ci)}% of bars" +
                          $" ({(double.IsNaN(f.UpJumpShare) ? "-" : (100 * f.UpJumpShare).ToString("F0", ci))}% up, avg {f.MeanJumpPct.ToString("F3", ci)}%)," +
                          $" drift {f.DriftPerBarPct.ToString("F5", ci)}%/bar, net {f.NetPerBarPct.ToString("F5", ci)}%/bar," +
                          $" VR5 {f.Vr5.ToString("F2", ci)} VR15 {f.Vr15.ToString("F2", ci)} VR60 {f.Vr60.ToString("F2", ci)}, AC1 {f.Autocorr1.ToString("F3", ci)}");
                    foreach (var c in ranked.Take(3))
                    {
                        var t = c.Test;
                        Print($"LAB {name}:   {t.Name}: {t.Trades} trades, avg {t.AvgR.ToString("+0.000;-0.000", ci)}R t={t.T.ToString("F1", ci)}, win {(100 * t.WinRate).ToString("F0", ci)}%, PF {t.ProfitFactor.ToString("F2", ci)}," +
                              $" halves {c.FirstHalfAvgR.ToString("+0.000;-0.000", ci)} / {c.SecondHalfAvgR.ToString("+0.000;-0.000", ci)}R");
                    }
                    var best = ranked.FirstOrDefault(c => c.IsEdgeCandidate);
                    var verdict = $"{name}: {f.Family}, {(best != null ? $"EDGE CANDIDATE ({best.Test.Name}, t={best.Test.T.ToString("F1", ci)})" : "no edge after spread")}";
                    Print("LAB VERDICT " + verdict);
                    verdicts.Add(verdict);
                }
                catch (Exception e) { Print($"Zugrio Market Lab: {name}: {e.Message}"); }
            }
            Print($"Zugrio Market Lab summary (symbols {FirstSymbol}-{last} of {total}): " + (verdicts.Count == 0 ? "no symbols analysed" : string.Join(" | ", verdicts)));
            if (last < total) Print($"Zugrio Market Lab: {total - last} more symbols. For the next batch, start a new run with 'Start at symbol number' = {last + 1}.");
            Print($"Zugrio Market Lab: done. A candidate needs t >= {MarketLab.CandidateT.ToString(ci)} and a positive average in both halves of the history: many rules are tested per symbol.");
            Stop();
        }
    }
}
