using System;
using System.Collections.Generic;
using System.Linq;

namespace Zugrio.CBot.Core
{
    // Zugrio Index engine (EA research engine for equity-index CFDs; ADR-0012, proposed). Pure and testable.
    // The rule is the one that held out of sample in research/lab round 3 (idx2.mjs V4, idx3.mjs): buy at the
    // US cash close after N lower closes in a row while the close is above its long average; sell at the first
    // close above the short average; protective stop at k x the session ATR. Long only. All values are
    // UNVALIDATED_RESEARCH; nothing here is Zugrio policy.

    /// <summary>
    /// New York wall time from UTC and back, with the US daylight-saving rules in force since 2007: daylight time
    /// from the second Sunday of March at 02:00 local to the first Sunday of November at 02:00 local. Computed,
    /// not looked up, so it behaves the same on every machine (the cTrader cloud included).
    /// </summary>
    public static class NewYorkTime
    {
        public static bool IsDaylight(DateTime utc)
        {
            var start = NthSunday(utc.Year, 3, 2).AddHours(7);    // 02:00 EST = 07:00 UTC
            var end = NthSunday(utc.Year, 11, 1).AddHours(6);     // 02:00 EDT = 06:00 UTC
            return utc >= start && utc < end;
        }

        public static DateTime FromUtc(DateTime utc) =>
            DateTime.SpecifyKind(utc + TimeSpan.FromHours(IsDaylight(utc) ? -4 : -5), DateTimeKind.Unspecified);

        /// <summary>UTC for a New York wall time. Exact away from the 02:00 changeover hour, which is all the engine asks for.</summary>
        public static DateTime ToUtc(DateTime local)
        {
            var daylight = DateTime.SpecifyKind(local + TimeSpan.FromHours(4), DateTimeKind.Utc);
            return IsDaylight(daylight) ? daylight : DateTime.SpecifyKind(local + TimeSpan.FromHours(5), DateTimeKind.Utc);
        }

        private static DateTime NthSunday(int year, int month, int n)
        {
            var first = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            return first.AddDays((7 - (int)first.DayOfWeek) % 7 + 7 * (n - 1));
        }
    }

    /// <summary>One hour bar, open time in UTC. The last one may still be forming (its close is the latest price).</summary>
    public readonly record struct HourBar(DateTime OpenUtc, double O, double H, double L, double C);

    /// <summary>One US cash session built from hour bars: New York date, high, low, close, and how many hour bars it had.</summary>
    public sealed record SessionBar(DateTime Date, double H, double L, double C, int Bars);

    /// <param name="LowerCloses">Buy after this many lower closes in a row.</param>
    /// <param name="TrendSma">...only while the close is above the average of this many session closes (the close included).</param>
    /// <param name="ExitSma">Sell at the first close above the average of this many session closes.</param>
    /// <param name="StopAtr">Protective stop below the entry, in session ATRs.</param>
    /// <param name="FarTargetAtr">Backstop take-profit (the instruction contract needs one). Research: never reached in 3,018 trades.</param>
    /// <param name="MinBarsPerSession">Sessions with fewer hour bars (holidays, half days) are left out, as in the research data.</param>
    public sealed record IndexRule(int LowerCloses = 3, int TrendSma = 200, int ExitSma = 5, int AtrPeriod = 14, double StopAtr = 3.0,
        double FarTargetAtr = 10.0, TimeSpan SessionStart = default, TimeSpan SessionClose = default, int MinBarsPerSession = 6)
    {
        public TimeSpan Start => SessionStart == default ? TimeSpan.FromHours(9) : SessionStart;
        public TimeSpan Close => SessionClose == default ? TimeSpan.FromHours(16) : SessionClose;

        /// <summary>Sessions needed before the first decision.</summary>
        public int SessionsNeeded => Math.Max(TrendSma, Math.Max(AtrPeriod + 1, Math.Max(LowerCloses + 1, ExitSma)));

        public IndexRule Validated()
        {
            if (LowerCloses < 1 || TrendSma < 2 || ExitSma < 2 || AtrPeriod < 2) throw new FormatException("index rule: counts must be at least 1 (lower closes) and 2 (averages, ATR)");
            if (!(StopAtr > 0) || !(FarTargetAtr > StopAtr)) throw new FormatException("index rule: stop must be positive and the backstop target beyond it");
            if (!(Start < Close) || Close > TimeSpan.FromHours(24)) throw new FormatException("index rule: the session must start before it closes");
            if (MinBarsPerSession < 1) throw new FormatException("index rule: at least one bar per session");
            return this;
        }

        /// <summary>"16:00" → 16 h.</summary>
        public static TimeSpan ParseClock(string? text)
        {
            if (!TimeSpan.TryParseExact((text ?? "").Trim(), @"hh\:mm", System.Globalization.CultureInfo.InvariantCulture, out var t) || t <= TimeSpan.Zero || t >= TimeSpan.FromHours(24))
                throw new FormatException($"time '{text}' must be HH:mm, for example 16:00");
            return t;
        }
    }

    public enum IndexAction { None, Enter, Exit, Hold }

    /// <summary>What the rule says at today's decision time, with the numbers behind it (for the log and the Journal).</summary>
    public sealed record IndexDecision(IndexAction Action, string Reason, int Sessions, double Close, double TrendAverage, double ExitAverage, double Atr, int LowerRun)
    {
        public double StopDistance(IndexRule r) => r.StopAtr * Atr;
        public double TargetDistance(IndexRule r) => r.FarTargetAtr * Atr;
    }

    public static class IndexEngine
    {
        /// <summary>
        /// Hour bars grouped into New York cash sessions: bars opening on a weekday from rule.Start up to (not
        /// including) rule.Close. The session close is the last such bar's close (the bar ending at the cash close);
        /// for today, before the close, it is the latest price. Sessions with fewer than MinBarsPerSession bars are
        /// dropped: on holidays and half days CFDs often trade a few hours, and the research data has no such days.
        /// </summary>
        public static IReadOnlyList<SessionBar> Sessions(IEnumerable<HourBar> bars, IndexRule rule)
        {
            var byDate = new SortedDictionary<DateTime, (double H, double L, double C, int N)>();
            foreach (var b in bars.OrderBy(x => x.OpenUtc))
            {
                var local = NewYorkTime.FromUtc(b.OpenUtc);
                if (local.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;
                if (local.TimeOfDay < rule.Start || local.TimeOfDay >= rule.Close) continue;
                byDate[local.Date] = byDate.TryGetValue(local.Date, out var s) ? (Math.Max(s.H, b.H), Math.Min(s.L, b.L), b.C, s.N + 1) : (b.H, b.L, b.C, 1);
            }
            return byDate.Where(kv => kv.Value.N >= rule.MinBarsPerSession).Select(kv => new SessionBar(kv.Key, kv.Value.H, kv.Value.L, kv.Value.C, kv.Value.N)).ToList();
        }

        /// <summary>Simple average of the last n session closes (today's included).</summary>
        public static double Average(IReadOnlyList<SessionBar> s, int n) => s.Count < n ? double.NaN : s.Skip(s.Count - n).Average(x => x.C);

        /// <summary>Simple mean of the last n true ranges (each against the previous session's close).</summary>
        public static double SessionAtr(IReadOnlyList<SessionBar> s, int n)
        {
            if (s.Count < n + 1) return double.NaN;
            double sum = 0;
            for (var i = s.Count - n; i < s.Count; i++)
                sum += Math.Max(s[i].H - s[i].L, Math.Max(Math.Abs(s[i].H - s[i - 1].C), Math.Abs(s[i].L - s[i - 1].C)));
            return sum / n;
        }

        /// <summary>Closes in a row each lower than the one before, ending today.</summary>
        public static int LowerRun(IReadOnlyList<SessionBar> s)
        {
            var run = 0;
            for (var i = s.Count - 1; i >= 1 && s[i].C < s[i - 1].C; i--) run++;
            return run;
        }

        /// <summary>
        /// The rule at today's decision time. The last session must be today's (New York date), else there is no
        /// decision (holiday, or no bars yet). In a position: exit at a close above the exit average, but never on
        /// the entry day. Flat: enter when the close is above the trend average after LowerCloses lower closes, but
        /// not on a day this market already closed an index trade (the research never re-enters on its exit bar).
        /// </summary>
        public static IndexDecision Decide(IReadOnlyList<SessionBar> s, DateTime todayNewYork, bool inPosition, bool enteredToday, bool closedToday, IndexRule rule)
        {
            if (s.Count == 0 || s[^1].Date != todayNewYork.Date) return new IndexDecision(IndexAction.None, "NO_SESSION_TODAY", s.Count, double.NaN, double.NaN, double.NaN, double.NaN, 0);
            var c = s[^1].C;
            if (s.Count < rule.SessionsNeeded) return new IndexDecision(IndexAction.None, "NOT_ENOUGH_HISTORY", s.Count, c, double.NaN, double.NaN, double.NaN, LowerRun(s));
            var d = new IndexDecision(IndexAction.None, "", s.Count, c, Average(s, rule.TrendSma), Average(s, rule.ExitSma), SessionAtr(s, rule.AtrPeriod), LowerRun(s));
            if (inPosition)
                return enteredToday ? d with { Action = IndexAction.Hold, Reason = "ENTERED_TODAY" }
                    : c > d.ExitAverage ? d with { Action = IndexAction.Exit, Reason = "CLOSE_ABOVE_EXIT_AVERAGE" }
                    : d with { Action = IndexAction.Hold, Reason = "NOT_ABOVE_EXIT_AVERAGE" };
            if (closedToday) return d with { Reason = "ALREADY_TRADED_TODAY" };
            if (!(d.Atr > 0)) return d with { Reason = "ATR_UNAVAILABLE" };
            if (!(c > d.TrendAverage)) return d with { Reason = "BELOW_TREND_AVERAGE" };
            if (d.LowerRun < rule.LowerCloses) return d with { Reason = "NOT_ENOUGH_LOWER_CLOSES" };
            return d with { Action = IndexAction.Enter, Reason = "LOWER_CLOSES_IN_UPTREND" };
        }

        /// <summary>The decision time for a New York date: the session close minus the lead, in UTC.</summary>
        public static DateTime DecisionUtc(DateTime todayNewYork, IndexRule rule, TimeSpan lead) => NewYorkTime.ToUtc(todayNewYork.Date + rule.Close - lead);
    }
}
