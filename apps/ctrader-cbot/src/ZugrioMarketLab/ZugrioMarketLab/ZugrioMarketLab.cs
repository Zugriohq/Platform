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
        // Several rules separated by ';', each printed as soon as it is done. Defaults: the owner's friend's bots as seen on
        // 2026-10-13 (Boom 150 sell 2/2 at 0.5 lots, Boom 50 sell 10/10 at 0.1 lots) and the Crash 150 buy 2/2 measured first.
        // Off by default since the family behaviour study (2026-10-14): the friend's rules were measured (FAMILY_ENGINES.md).
        // Example: "Boom 150 Index|SELL|2|2|0.5; Crash 150 Index|BUY|2|2|0.5".
        // Since 2026-10-14 (family study, research/deriv/FAMILIES.md): the Drift Switch momentum rules on the account's own
        // bid/ask ticks. "SYMBOL|DSI" runs that check; the spread it pays is the account's, which decides the result.
        // Cycle 1 (research/deriv/CYCLE_1_PROTOCOL.md): Range Break walls (RB), Trek (TREK) and Volatility Switch (VSW) on the
        // account's own ticks; the last two are not on Deriv's public feed, so this is their only data.
        public const string DefaultReplayRules = "Drift Switch Index 10|DSI; Drift Switch Index 20|DSI; Drift Switch Index 30|DSI; " +
            "Range Break 100 Index|RB; Range Break 200 Index|RB; Trek Up Index|TREK; Trek Down Index|TREK; " +
            "VolSwitch Low Vol Index|VSW; VolSwitch Medium Vol Index|VSW; VolSwitch High Vol Index|VSW";
        [Parameter("Tick replay rules (symbol|BUY/SELL|TP points|SL points|lots; ...), empty = none", DefaultValue = DefaultReplayRules)] public string ReplayRules { get; set; } = DefaultReplayRules;
        // Names differ from the previous build so a saved instance picks up the new defaults (7 days; battery off).
        [Parameter("Replay: days of ticks", DefaultValue = 7, MinValue = 1, MaxValue = 14)] public int ReplayDays { get; set; } = 7;
        [Parameter("Also run the bar battery on the keyword symbols", DefaultValue = false)] public bool RunBattery { get; set; }

        // The family behaviour study (Behaviour, research/deriv/FAMILIES.md, behaviour_prereg.json): each symbol is read as
        // the Deriv product its name says, measured against what Deriv says that family does, and tested only with the
        // rules that family's mechanism implies. Mechanism families first; Volatility indices last, as controls.
        // Since 2026-10-14 the families on Deriv's public feed are studied from it (research/deriv/FAMILIES.md); the default here
        // is the families that are only on the account: Trek, Skew Step, Multi Step, Volatility Switch.
        public const string StudyKeywords = "Trek,Skew,Multi,VolSwitch,Volatility Switch";
        [Parameter("Family behaviour study", DefaultValue = true)] public bool RunStudy { get; set; } = true;
        [Parameter("Study: symbol keywords, in priority order", DefaultValue = StudyKeywords)] public string StudyKeywordText { get; set; } = StudyKeywords;
        [Parameter("Study: days of M1 history", DefaultValue = 21, MinValue = 3, MaxValue = 30)] public int StudyDays { get; set; } = 21;
        [Parameter("Study: symbols per run (memory)", DefaultValue = 15, MinValue = 1, MaxValue = 40)] public int StudyPerRun { get; set; } = 15;
        [Parameter("Study: start at symbol number", DefaultValue = 1, MinValue = 1, MaxValue = 500)] public int StudyFirst { get; set; } = 1;
        private Queue<string>? _study;
        private int _studyTotal, _studyLast;
        private string? _studyNext;
        private readonly List<string> _studyVerdicts = new();

        // The work runs in steps on a 1-second timer, not inside OnStart. cTrader shows what OnStart prints only once
        // OnStart returns (all lines of a run carried one timestamp, 2026-10-12), so a slow or stuck step showed nothing.
        // Each timer step prints straight away, so the Journal shows how far a run got.
        private readonly Queue<string> _rules = new();
        private ReplayJob? _job;
        private int _steps;

        private sealed class ReplayJob
        {
            public string[] Parts = Array.Empty<string>();
            public Symbol Sym = null!;
            public Ticks? Ticks;
            public DateTime From;
            public System.Diagnostics.Stopwatch Clock = new();
            public int Loads;
            public bool Exhausted;
        }

        protected override void OnStart()
        {
            foreach (var rule in (ReplayRules ?? "").Split(';').Select(x => x.Trim()).Where(x => x.Length > 0)) _rules.Enqueue(rule);
            Print($"Zugrio Market Lab: {_rules.Count} replay rule(s), {ReplayDays} days of ticks each; family behaviour study {(RunStudy ? $"on ({StudyDays} days of M1)" : "off")}; bar battery {(RunBattery ? "on" : "off")}. No orders are placed.");
            Timer.Start(TimeSpan.FromSeconds(1));
        }

        protected override void OnTimer()
        {
            var ci = CultureInfo.InvariantCulture;
            try { Step(ci); }
            catch (Exception e) { Print($"LAB REPLICA: {e.GetType().Name}: {e.Message}"); _job = null; }
        }

        private void Step(CultureInfo ci)
        {
            if (_job == null)
            {
                if (_rules.Count == 0 && RunStudy && StudyStep(ci)) return;
                if (_rules.Count == 0) { Timer.Stop(); Finish(ci); return; }
                _job = BeginJob(_rules.Dequeue(), ci);
                return;
            }
            var j = _job;
            if (j.Ticks == null)
            {
                // Its own step, so the "loading" line above is already in the Journal if this call never returns.
                j.Ticks = MarketData.GetTicks(j.Sym.Name);
                Print($"LAB REPLICA {j.Sym.Name}: {j.Ticks.Count} ticks to start with; loading history.");
                return;
            }
            // A few history loads per step, so each step returns quickly and its lines appear.
            for (var n = 0; n < 10; n++)
            {
                var done = j.Exhausted || j.Ticks.Count == 0 || j.Ticks[0].Time <= j.From || j.Loads >= 5000 || j.Clock.Elapsed.TotalSeconds > LoadSecondsLimit;
                if (done)
                {
                    if (j.Clock.Elapsed.TotalSeconds > LoadSecondsLimit) Print($"LAB REPLICA {j.Sym.Name}: loading stopped after {LoadSecondsLimit}s; using the ticks loaded so far.");
                    _job = null;
                    Analyze(j, ci);
                    GC.Collect();
                    return;
                }
                if (j.Ticks.LoadMoreHistory() == 0) j.Exhausted = true;
                j.Loads++;
            }
            if (++_steps % 5 == 0) Print($"LAB REPLICA {j.Sym.Name}: {j.Ticks.Count} ticks loaded, back to {j.Ticks[0].Time:yyyy-MM-dd HH:mm} UTC, {j.Clock.Elapsed.TotalSeconds:F0}s.");
        }

        private ReplayJob? BeginJob(string rule, CultureInfo ci)
        {
            var parts = rule.Split('|').Select(x => x.Trim()).ToArray();
            var dsi = parts.Length >= 2 && new[] { "DSI", "RB", "TREK", "VSW" }.Contains(parts[1].ToUpperInvariant());
            if (!dsi && (parts.Length < 4 || parts[0].Length == 0)) { Print($"LAB REPLICA: rule '{rule}' needs symbol|BUY/SELL|TP|SL|lots, or symbol|DSI."); return null; }
            var sym = Symbols.GetSymbol(parts[0]);
            if (sym == null) { Print($"LAB REPLICA: '{parts[0]}' not found at this broker."); return null; }
            Print($"LAB REPLICA {sym.Name}: loading {ReplayDays} days of ticks ({(dsi ? parts[1].ToUpperInvariant() + " tick check" : $"rule {parts[1]} tp {parts[2]} sl {parts[3]}")})...");
            var job = new ReplayJob { Parts = parts, Sym = sym, From = Server.TimeInUtc.AddDays(-ReplayDays) };
            job.Clock.Start();
            return job;
        }

        /// <summary>One symbol of the family behaviour study per timer step; false when the study is finished.</summary>
        private bool StudyStep(CultureInfo ci)
        {
            if (_study == null)
            {
                var (names, total) = MarketLab.SelectSymbols(Enumerable.Range(0, Symbols.Count).Select(i => Symbols[i]), StudyKeywordText, StudyFirst, StudyPerRun);
                _study = new Queue<string>(names); _studyTotal = total; _studyLast = StudyFirst + names.Count - 1;
                Print($"LAB STUDY: symbols {StudyFirst}-{_studyLast} of {total} matching, {StudyDays} days of M1 each: {string.Join(", ", names)}.");
                return true;
            }
            if (_study.Count == 0)
            {
                if (_studyVerdicts.Count > 0) Print($"LAB STUDY SUMMARY (symbols {StudyFirst}-{_studyLast} of {_studyTotal}): " + string.Join(" | ", _studyVerdicts));
                if (_studyLast < _studyTotal) Print($"LAB STUDY: {_studyTotal - _studyLast} more symbols. Next batch: start a new run with 'Study: start at symbol number' = {_studyLast + 1}.");
                Print($"LAB STUDY: done. A candidate needs t >= {MarketLab.CandidateT.ToString(ci)}, at least 50 trades and a positive average in both halves, after the spread; then a fresh forward period.");
                _studyVerdicts.Clear(); _studyLast = _studyTotal;
                RunStudy = false;
                return false;
            }
            // The loading line gets its own step, so a symbol whose history never loads shows where the run stopped.
            if (_studyNext == null) { _studyNext = _study.Peek(); Print($"LAB STUDY {_studyNext}: loading {StudyDays} days of M1..."); return true; }
            var name = _study.Dequeue(); _studyNext = null;
            try { StudySymbol(name, ci); }
            catch (Exception e) { Print($"LAB STUDY {name}: {e.GetType().Name}: {e.Message}"); }
            GC.Collect();
            return true;
        }

        private void StudySymbol(string name, CultureInfo ci)
        {
            var bars = MarketData.GetBars(TimeFrame.Minute, name);
            var from = Server.TimeInUtc.AddDays(-StudyDays);
            for (var k = 0; k < 400 && bars.Count > 0 && bars.OpenTimes[0] > from; k++) if (bars.LoadMoreHistory() == 0) break;
            var list = new List<LabBar>();
            for (var i = 0; i < bars.Count - 1; i++)
                if (bars.OpenTimes[i] >= from) list.Add(new LabBar(bars.OpenPrices[i], bars.HighPrices[i], bars.LowPrices[i], bars.ClosePrices[i]));
            if (list.Count < 2000) { Print($"LAB STUDY {name}: only {list.Count} M1 bars, skipped."); return; }
            var sym = Symbols.GetSymbol(name);
            var spread = sym == null ? 0 : sym.Ask - sym.Bid;
            var p = Behaviour.Classify(name);
            var f = Behaviour.Profile(p, list, spread);
            string F(double x, string fmt) => double.IsNaN(x) ? "-" : double.IsPositiveInfinity(x) ? "inf" : x.ToString(fmt, ci);
            Print($"LAB FAMILY {name}: {p.Family}{(double.IsNaN(p.Number) ? "" : " " + p.Number.ToString(ci))}{(p.Direction != 0 ? (p.Direction > 0 ? " up" : " down") : "")}. Deriv: {p.Declared}.");
            Print($"LAB MEASURED {name}: {f.Bars} bars; spread {F(spread, "G5")} = {F(f.SpreadSigmas, "F2")} x the typical 1-min move; " +
                  $"jumps {F(f.JumpsPerHour, "F2")}/h ({F(100 * f.UpJumpShare, "F0")}% up, avg {F(f.MeanJumpPrice, "G4")}); jump due? late/early rate {F(f.LateEarlyHazard, "F2")} (z {F(f.HazardZ, "F1")}); " +
                  $"VR5 {F(f.Vr5, "F2")} VR15 {F(f.Vr15, "F2")} VR60 {F(f.Vr60, "F2")} VR240 {F(f.Vr240, "F2")}; AC1 {F(f.Autocorr1, "F3")}; vol memory {F(f.VolPersistence60, "F2")}; " +
                  $"drift between jumps {F(f.DriftPerHourPrice, "G4")}/h, net {F(f.NetPerHourPrice, "G4")}/h (z {F(f.NetPerHourZ, "F1")}).");
            var ranked = Behaviour.Candidates(p, list, spread);
            foreach (var c in ranked)
            {
                var t = c.Test;
                Print($"LAB RULE {name}: {t.Name}: {t.Trades} trades, avg {t.AvgR.ToString("+0.000;-0.000", ci)}R t={t.T.ToString("F1", ci)}, win {(100 * t.WinRate).ToString("F0", ci)}%, halves {c.FirstHalfAvgR.ToString("+0.000;-0.000", ci)} / {c.SecondHalfAvgR.ToString("+0.000;-0.000", ci)}R");
            }
            var best = ranked.FirstOrDefault(c => c.IsEdgeCandidate);
            var top = ranked.FirstOrDefault();
            var verdict = $"{name}: {p.Family}, " + (best != null ? $"CANDIDATE {best.Test.Name} t={best.Test.T.ToString("F1", ci)}" : $"no edge after spread{(top != null ? $" (best {top.Test.Name} t={top.Test.T.ToString("F1", ci)})" : "")}");
            Print("LAB STUDY VERDICT " + verdict);
            _studyVerdicts.Add(verdict);
        }

        private void Finish(CultureInfo ci)
        {
            if (!RunBattery) { Print("Zugrio Market Lab: done (bar battery off; turn on 'Also run the bar battery' to measure the keyword symbols)."); Stop(); return; }
            RunBatteryAll(ci);
        }

        private void RunBatteryAll(CultureInfo ci)
        {
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

        private const int LoadSecondsLimit = 180;

        /// <summary>Cycle 1 tick studies (TickStudies): Range Break walls, Trek unconditional returns, Volatility Switch persistence.</summary>
        private void CycleOneCheck(string kind, Symbol sym, Ticks ticks, DateTime from)
        {
            var list = new List<LabTick>(ticks.Count);
            for (var i = 0; i < ticks.Count; i++) if (ticks[i].Time >= from) list.Add(new LabTick(ticks[i].Time, ticks[i].Bid, ticks[i].Ask));
            var lines = kind == "RB" ? TickStudies.RangeBreak(list, 1.5 * PointStep(list))
                : kind == "TREK" ? TickStudies.Trek(list, sym.Name.IndexOf("down", StringComparison.OrdinalIgnoreCase) >= 0 ? -1 : 1)
                : TickStudies.VolSwitch(list);
            foreach (var l in lines) Print($"LAB {kind} {sym.Name}: {l}");
        }

        /// <summary>The typical one-tick mid move (Range Break steps by a fixed amount), so a jump is any move above 1.5 steps.</summary>
        private static double PointStep(IReadOnlyList<LabTick> t)
        {
            var d = new List<double>(); for (var i = 1; i < Math.Min(t.Count, 20000); i++) { var x = Math.Abs((t[i].Bid + t[i].Ask) / 2 - (t[i - 1].Bid + t[i - 1].Ask) / 2); if (x > 0) d.Add(x); }
            if (d.Count == 0) return 1; d.Sort(); return d[d.Count / 2];
        }

        /// <summary>
        /// The family study's Drift Switch candidates (behaviour_prereg.json) on this account's own bid/ask ticks: lookback
        /// and hold of a quarter and half the declared regime length, entered 0, 2 and 5 seconds after the signal minute.
        /// The result turns on the spread: on Deriv's feed the rules gain about +1R before costs and break even near a
        /// spread of 1.4 (DSI 10), 1.6 (DSI 20) and 3.0 (DSI 30); Deriv publishes both a lower and a higher figure.
        /// </summary>
        private void DriftSwitchCheck(Symbol sym, Ticks ticks, DateTime from, CultureInfo ci)
        {
            var list = new List<LabTick>(ticks.Count);
            for (var i = 0; i < ticks.Count; i++) if (ticks[i].Time >= from) list.Add(new LabTick(ticks[i].Time, ticks[i].Bid, ticks[i].Ask));
            var p = Behaviour.Classify(sym.Name);
            var regime = double.IsNaN(p.Number) ? 20 : p.Number;
            int q = Math.Max(2, (int)Math.Round(regime / 4)), h2 = Math.Max(3, (int)Math.Round(regime / 2));
            Print($"LAB DSI {sym.Name}: {list.Count} ticks, {(list.Count > 0 ? $"{list[0].T:yyyy-MM-dd HH:mm} to {list[^1].T:yyyy-MM-dd HH:mm} UTC" : "none")}, spread now {(sym.Ask - sym.Bid).ToString("G4", ci)}, " +
                  $"average {(list.Count > 0 ? list.Average(x => x.Ask - x.Bid) : 0).ToString("G4", ci)}, highest {(list.Count > 0 ? list.Max(x => x.Ask - x.Bid) : 0).ToString("G4", ci)}.");
            var half = list.Count / 2;
            foreach (var lb in new[] { q, h2 }) foreach (var hold in new[] { q, h2 }) foreach (var delay in new[] { 0.0, 2, 5 })
            {
                var (all, sp) = Behaviour.MomentumOnTicks(list, lb, hold, delay);
                var a = Behaviour.MomentumOnTicks(list.Take(half).ToList(), lb, hold, delay).Test; var b = Behaviour.MomentumOnTicks(list.Skip(half).ToList(), lb, hold, delay).Test;
                Print($"LAB DSI {sym.Name} {all.Name}: {all.Trades} trades, avg {all.AvgR.ToString("+0.000;-0.000", ci)}R t={all.T.ToString("F1", ci)}, win {(100 * all.WinRate).ToString("F0", ci)}%, " +
                      $"halves {a.AvgR.ToString("+0.000;-0.000", ci)} / {b.AvgR.ToString("+0.000;-0.000", ci)}R, spread paid {sp.ToString("G4", ci)}");
            }
        }

        /// <summary>One replay rule on the loaded ticks, with bid/ask fills: prints LAB REPLICA/GENERATOR/GRID lines.</summary>
        private void Analyze(ReplayJob j, CultureInfo ci)
        {
            var parts = j.Parts; var sym = j.Sym; var ticks = j.Ticks!; var from = j.From;
            if (parts[1].Equals("DSI", StringComparison.OrdinalIgnoreCase)) { DriftSwitchCheck(sym, ticks, from, ci); return; }
            if (new[] { "RB", "TREK", "VSW" }.Contains(parts[1].ToUpperInvariant())) { CycleOneCheck(parts[1].ToUpperInvariant(), sym, ticks, from); return; }
            try
            {
                var dir = parts[1].Equals("SELL", StringComparison.OrdinalIgnoreCase) ? -1 : 1;
                var tp = double.Parse(parts[2], ci); var sl = double.Parse(parts[3], ci);
                var lots = parts.Length > 4 ? double.Parse(parts[4], ci) : 1;
                var list = new List<LabTick>(ticks.Count);
                for (var i = 0; i < ticks.Count; i++) if (ticks[i].Time >= from) list.Add(new LabTick(ticks[i].Time, ticks[i].Bid, ticks[i].Ask));
                var perPoint = sym.TickValue / sym.TickSize * sym.QuantityToVolumeInUnits(lots);
                Print($"LAB REPLICA {sym.Name}: {list.Count} ticks over {ReplayDays} days, typical spread {(list.Count > 0 ? list.Average(x => x.Ask - x.Bid) : 0).ToString("G4", ci)} points, {lots.ToString(ci)} lots = {perPoint.ToString("0.###", ci)} {Account.Asset.Name} per point.");
                if (list.Count > 0) Print($"LAB REPLICA {sym.Name}: from {list[0].T:yyyy-MM-dd HH:mm} to {list[^1].T:yyyy-MM-dd HH:mm} UTC.");
                // 1. The friend's rule as given, on the whole sample and on each half (an edge must show in both).
                var half = list.Count / 2;
                foreach (var (label, a, b) in new[] { ("all", 0, -1), ("first half", 0, half), ("second half", half, -1) })
                {
                    var r = MarketLab.TickReplica(list, dir, tp, sl, start: a, end: b);
                    Print($"LAB REPLICA {sym.Name} {r.Name} [{label}]: {r.Trades} trades, won {(100 * r.WinRate).ToString("F1", ci)}% (break-even {(100 * r.BreakEvenWinRate).ToString("F1", ci)}%), " +
                          $"avg win +{r.AvgWinPts.ToString("F2", ci)} / avg loss -{r.AvgLossPts.ToString("F2", ci)} points, avg {r.AvgPts.ToString("+0.000;-0.000", ci)} points per trade (t={r.T.ToString("F1", ci)}) " +
                          $"= {(r.AvgPts * perPoint).ToString("+0.000;-0.000", ci)} {Account.Asset.Name} per trade, {(r.AvgPts * perPoint * r.Trades).ToString("+0.00;-0.00", ci)} in total.");
                }
                // 2. Is the generator fair? Zero average change per tick (spikes included) means no rule can beat the spread.
                var g = MarketLab.Generator(list);
                Print($"LAB GENERATOR {sym.Name}: {g.Changes} tick changes, average {g.MeanChange.ToString("+0.00000;-0.00000", ci)} points per tick (z={g.FairZ.ToString("F1", ci)}; |z| < 2 = fair), " +
                      $"{g.Jumps} jumps (one per {g.TicksPerJump.ToString("F0", ci)} ticks, average {g.AvgJump.ToString("+0.00;-0.00", ci)} points), drift between jumps {g.DriftBetweenJumps.ToString("+0.00000;-0.00000", ci)} points per tick, " +
                      $"median tick move {g.MedianAbsChange.ToString("G4", ci)}, average spread {g.AvgSpread.ToString("G4", ci)}.");
                // 3. The design space around the friend's rule: targets and stops of 0.5-2.5x his target, both directions.
                var sizes = new[] { 0.5, 1, 1.5, 2.5 }.Select(k => k * tp).ToArray();
                var grid = MarketLab.ReplicaGrid(list, sizes, sizes).Where(x => x.All.Trades >= 30).OrderByDescending(x => x.All.T).ToList();
                var cands = grid.Count(x => x.All.T >= MarketLab.CandidateT && x.First.AvgPts > 0 && x.Second.AvgPts > 0);
                Print($"LAB GRID {sym.Name}: {grid.Count} target/stop/direction rules tested; {cands} pass (t >= {MarketLab.CandidateT.ToString(ci)} and positive in both halves). Best by t:");
                foreach (var x in grid.Take(6))
                    Print($"LAB GRID {sym.Name} {x.All.Name}: {x.All.Trades} trades, won {(100 * x.All.WinRate).ToString("F1", ci)}%, avg {x.All.AvgPts.ToString("+0.000;-0.000", ci)} points (t={x.All.T.ToString("F1", ci)}), " +
                          $"halves {x.First.AvgPts.ToString("+0.000;-0.000", ci)} / {x.Second.AvgPts.ToString("+0.000;-0.000", ci)} = {(x.All.AvgPts * perPoint).ToString("+0.000;-0.000", ci)} {Account.Asset.Name} per trade at {lots.ToString(ci)} lots.");
            }
            catch (Exception e) { Print($"LAB REPLICA: {e.Message}"); }
        }
    }
}
