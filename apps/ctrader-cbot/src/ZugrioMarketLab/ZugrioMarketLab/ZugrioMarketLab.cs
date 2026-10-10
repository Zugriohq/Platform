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
    /// </summary>
    [Robot(AccessRights = AccessRights.None, AddIndicators = false, TimeZone = TimeZones.UTC)]
    public class ZugrioMarketLab : Robot
    {
        public const string DefaultKeywords = "Boom,Crash,Jump,Step,Volatility,Range Break,Drift,DEX,Hybrid,Skew,Trek,Spike,Multi,GainX,PainX";

        [Parameter("Symbol keywords (comma list)", DefaultValue = DefaultKeywords)] public string KeywordsText { get; set; } = DefaultKeywords;
        [Parameter("Days of M1 history", DefaultValue = 14, MinValue = 1, MaxValue = 60)] public int Days { get; set; }
        [Parameter("Max symbols", DefaultValue = 80, MinValue = 1, MaxValue = 200)] public int MaxSymbols { get; set; }

        protected override void OnStart()
        {
            var ci = CultureInfo.InvariantCulture;
            var keys = (KeywordsText ?? "").Split(',').Select(k => k.Trim()).Where(k => k.Length > 0).ToList();
            var names = Enumerable.Range(0, Symbols.Count).Select(i => Symbols[i])
                .Where(n => keys.Any(k => n.IndexOf(k, StringComparison.OrdinalIgnoreCase) >= 0)).OrderBy(n => n, StringComparer.Ordinal).Take(MaxSymbols).ToList();
            Print($"Zugrio Market Lab: {names.Count} symbols, {Days} days of M1 history each. No orders are placed.");
            var verdicts = new List<string>();
            foreach (var name in names)
            {
                try
                {
                    var bars = MarketData.GetBars(TimeFrame.Minute, name);
                    var from = Server.TimeInUtc.AddDays(-Days);
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
                    verdicts.Add($"{name}: {f.Family}, {(best != null ? $"EDGE CANDIDATE ({best.Test.Name}, t={best.Test.T.ToString("F1", ci)})" : "no edge after spread")}");
                }
                catch (Exception e) { Print($"Zugrio Market Lab: {name}: {e.Message}"); }
            }
            Print("Zugrio Market Lab summary: " + (verdicts.Count == 0 ? "no symbols analysed" : string.Join(" | ", verdicts)));
            Print($"Zugrio Market Lab: done. A candidate needs t >= {MarketLab.CandidateT.ToString(ci)} and a positive average in both halves of the history: many rules are tested per symbol.");
            Stop();
        }
    }
}
