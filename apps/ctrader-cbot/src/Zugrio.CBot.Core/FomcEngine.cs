using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Zugrio.CBot.Core
{
    // Pre-FOMC drift (research/lab/news_prereg.json B2; Lucca and Moench 2015): long the US equity index from 14:00 New
    // York time on the trading day before a scheduled FOMC statement to 13:55 on the statement day, before the 14:00
    // release. Research, 2010-12 to 2026-09 on S&P 500 and Nasdaq 100 (HistData M1): +0.18% per meeting net of costs,
    // t 2.8, positive in both halves (2010-17 +0.04%, 2018-26 +0.30%). The protective stop is 3 session ATRs, the unit the
    // research reports R in; it is a crash guard, the rule exits on time. All values are UNVALIDATED_RESEARCH.

    /// <param name="EntryNy">New York time on the day before the statement at which the trade opens.</param>
    /// <param name="ExitNy">New York time on the statement day at which it closes (before the 14:00 statement).</param>
    /// <param name="EntryWindow">How long after EntryNy an entry may still be made (a late start or a closed market).</param>
    /// <param name="StopAtr">Protective stop below the entry, in session ATRs.</param>
    /// <param name="FarTargetAtr">Backstop take-profit (the instruction contract needs one).</param>
    public sealed record FomcRule(TimeSpan EntryNy = default, TimeSpan ExitNy = default, TimeSpan EntryWindow = default, double StopAtr = 3.0, double FarTargetAtr = 10.0)
    {
        public TimeSpan Entry => EntryNy == default ? new TimeSpan(14, 0, 0) : EntryNy;
        public TimeSpan Exit => ExitNy == default ? new TimeSpan(13, 55, 0) : ExitNy;
        public TimeSpan Window => EntryWindow == default ? TimeSpan.FromMinutes(30) : EntryWindow;
    }

    public enum FomcAction { None, Enter, Exit }

    /// <summary>What to do now, for which statement date, and the trade's UTC window.</summary>
    public sealed record FomcDecision(FomcAction Action, string Reason, DateTime? Statement, DateTime EntryUtc, DateTime ExitUtc);

    public static class FomcEngine
    {
        /// <summary>
        /// Scheduled FOMC statement days published by the Federal Reserve (federalreserve.gov/monetarypolicy/fomccalendars.htm,
        /// read 2026-10-14). The EA cannot fetch a calendar (it runs with AccessRights.None), so the dates are a parameter;
        /// they must be extended when the Fed publishes 2028. Unscheduled meetings are not in the list.
        /// </summary>
        public const string DefaultDates =
            "2026-01-28; 2026-03-18; 2026-04-29; 2026-06-17; 2026-07-29; 2026-09-16; 2026-10-28; 2026-12-09; " +
            "2027-01-27; 2027-03-17; 2027-04-28; 2027-06-09; 2027-07-28; 2027-09-15; 2027-10-27; 2027-12-08";

        /// <summary>"yyyy-MM-dd; ..." -> sorted distinct dates. A malformed entry is an error, not silently dropped.</summary>
        public static IReadOnlyList<DateTime> ParseDates(string? text)
        {
            var list = new List<DateTime>();
            foreach (var part in (text ?? "").Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).Where(x => x.Length > 0))
            {
                if (!DateTime.TryParseExact(part, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                    throw new FormatException($"FOMC date '{part}' must be yyyy-MM-dd");
                if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) throw new FormatException($"FOMC date {part} is a weekend");
                list.Add(d.Date);
            }
            return list.Distinct().OrderBy(d => d).ToList();
        }

        /// <summary>The previous weekday (US holidays are not known here; FOMC statements fall on Wednesdays in practice).</summary>
        public static DateTime PreviousWeekday(DateTime date)
        {
            var d = date.Date.AddDays(-1);
            while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(-1);
            return d;
        }

        public static (DateTime EntryUtc, DateTime ExitUtc) Window(DateTime statement, FomcRule rule) =>
            (ExchangeTime.ToUtc(Exchange.NewYork, PreviousWeekday(statement) + rule.Entry), ExchangeTime.ToUtc(Exchange.NewYork, statement.Date + rule.Exit));

        /// <summary>
        /// Flat: enter inside [entry, entry + window) of the next statement. In a trade (entered at positionEntryUtc): exit once
        /// the exit time of the first statement after the entry is reached, or at once if there is none. Otherwise nothing.
        /// </summary>
        public static FomcDecision Decide(DateTime nowUtc, IReadOnlyList<DateTime> dates, DateTime? positionEntryUtc, FomcRule rule)
        {
            if (positionEntryUtc is DateTime held)
            {
                foreach (var s in dates)
                {
                    var (entry, exit) = Window(s, rule);
                    if (exit <= held) continue;
                    return nowUtc >= exit ? new FomcDecision(FomcAction.Exit, "STATEMENT_DAY_EXIT", s, entry, exit) : new FomcDecision(FomcAction.None, "HOLDING_TO_EXIT", s, entry, exit);
                }
                return new FomcDecision(FomcAction.Exit, "NO_STATEMENT_AFTER_ENTRY", null, DateTime.MinValue, DateTime.MinValue);
            }
            foreach (var s in dates)
            {
                var (entry, exit) = Window(s, rule);
                if (nowUtc >= exit) continue;
                if (nowUtc < entry) return new FomcDecision(FomcAction.None, "WAITING_FOR_ENTRY", s, entry, exit);
                if (nowUtc < entry + rule.Window) return new FomcDecision(FomcAction.Enter, "PRE_FOMC_ENTRY", s, entry, exit);
                return new FomcDecision(FomcAction.None, "ENTRY_WINDOW_MISSED", s, entry, exit);
            }
            return new FomcDecision(FomcAction.None, "NO_DATES_AHEAD", null, DateTime.MinValue, DateTime.MinValue);
        }
    }
}
