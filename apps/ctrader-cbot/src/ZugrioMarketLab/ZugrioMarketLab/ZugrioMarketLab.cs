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
        // A fixed rule to replay tick by tick on the broker's own ticks (empty = skip). Default: the owner's friend's Crash 150 bot.
        [Parameter("Replay rule (symbol|BUY/SELL|TP points|SL points|lots)", DefaultValue = "Crash 150 Index|BUY|2|2|0.5")] public string ReplicaText { get; set; } = "Crash 150 Index|BUY|2|2|0.5";
        [Parameter("Replay: days of ticks", DefaultValue = 2, MinValue = 1, MaxValue = 7)] public int ReplicaDays { get; set; } = 2;

        protected override void OnStart()
        {
            var ci = CultureInfo.InvariantCulture;
            RunReplica(ci);
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
                    // The top 3 by t, plus the best of each family-specific rule (drift-follow, regime-follow) when it is not
                    // already shown: the classic Boom/Crash trade must be visible even when it ranks low.
                    var shown = ranked.Take(3).ToList();
                    foreach (var kind in new[] { "drift", "regime" })
                    {
                        var bestOfKind = ranked.FirstOrDefault(c => c.Test.Name.StartsWith(kind, StringComparison.Ordinal));
                        if (bestOfKind != null && !shown.Contains(bestOfKind)) shown.Add(bestOfKind);
                    }
                    foreach (var c in shown)
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

        /// <summary>The fixed rule in ReplicaText, replayed on the broker's own ticks with bid/ask fills; prints LAB REPLICA lines.</summary>
        private void RunReplica(CultureInfo ci)
        {
            var parts = (ReplicaText ?? "").Split('|').Select(x => x.Trim()).ToArray();
            if (parts.Length < 4 || parts[0].Length == 0) return;
            try
            {
                var dir = parts[1].Equals("SELL", StringComparison.OrdinalIgnoreCase) ? -1 : 1;
                var tp = double.Parse(parts[2], ci); var sl = double.Parse(parts[3], ci);
                var lots = parts.Length > 4 ? double.Parse(parts[4], ci) : 1;
                var sym = Symbols.GetSymbol(parts[0]);
                if (sym == null) { Print($"LAB REPLICA: '{parts[0]}' not found at this broker."); return; }
                var ticks = MarketData.GetTicks(sym.Name);
                var from = Server.TimeInUtc.AddDays(-ReplicaDays);
                for (var k = 0; k < 2000 && ticks.Count > 0 && ticks[0].Time > from; k++) if (ticks.LoadMoreHistory() == 0) break;
                var list = new List<LabTick>(ticks.Count);
                for (var i = 0; i < ticks.Count; i++) if (ticks[i].Time >= from) list.Add(new LabTick(ticks[i].Time, ticks[i].Bid, ticks[i].Ask));
                var perPoint = sym.TickValue / sym.TickSize * sym.QuantityToVolumeInUnits(lots);
                Print($"LAB REPLICA {sym.Name}: {list.Count} ticks over {ReplicaDays} days, typical spread {(list.Count > 0 ? list.Average(x => x.Ask - x.Bid) : 0).ToString("G4", ci)} points, {lots.ToString(ci)} lots = {perPoint.ToString("0.###", ci)} {Account.Asset.Name} per point.");
                foreach (var r in new[] { MarketLab.TickReplica(list, dir, tp, sl), MarketLab.TickReplica(list, dir, tp, sl, afterDropPts: sl / 2, afterDropTicks: 10) })
                    Print($"LAB REPLICA {sym.Name} {r.Name}: {r.Trades} trades, won {(100 * r.WinRate).ToString("F1", ci)}% (break-even {(100 * r.BreakEvenWinRate).ToString("F1", ci)}%), " +
                          $"avg win +{r.AvgWinPts.ToString("F2", ci)} / avg loss -{r.AvgLossPts.ToString("F2", ci)} points, avg {r.AvgPts.ToString("+0.000;-0.000", ci)} points per trade (t={r.T.ToString("F1", ci)}) " +
                          $"= {(r.AvgPts * perPoint).ToString("+0.000;-0.000", ci)} {Account.Asset.Name} per trade, {(r.AvgPts * perPoint * r.Trades).ToString("+0.00;-0.00", ci)} in total.");
            }
            catch (Exception e) { Print($"LAB REPLICA: {e.Message}"); }
        }
    }
}
