using System;

namespace Zugrio.CBot.Core
{
    // EUR European-hours shadow record (research/lab/eur_hours_prereg.json). The euro tends to fall against the dollar
    // from 07:00 to 12:00 UTC: +1.99bp a day gross in 2001-2009 (t 2.83, every year positive) and +1.45bp in 2010-2026,
    // but at a 1-pip round trip the net was t 1.65, a registered fail. Whether it is worth trading depends on the account's
    // real spread at those two times, so this records a SHORT EURUSD at 07:00 and its close at 12:00 from the account's
    // own bid and ask. It places no orders. UNVALIDATED_RESEARCH.

    /// <summary>A quote from the account: time, bid, ask.</summary>
    public sealed record ShadowQuote(DateTime Utc, double Bid, double Ask)
    {
        public double Mid => (Bid + Ask) / 2;
    }

    /// <summary>One day's shadow short: gross (mid to mid) and net (sell at the bid, buy back at the ask), in basis points.</summary>
    public sealed record ShadowDay(DateTime Date, ShadowQuote Open, ShadowQuote Close, double GrossBp, double NetBp, double SpreadOpenPips, double SpreadClosePips);

    public static class EurHoursShadow
    {
        public static readonly TimeSpan Start = TimeSpan.FromHours(7);
        public static readonly TimeSpan End = TimeSpan.FromHours(12);
        /// <summary>How late after 07:00 / 12:00 a quote may still be taken (a timer tick, a reconnect).</summary>
        public static readonly TimeSpan Grace = TimeSpan.FromMinutes(5);

        private static bool Weekday(DateTime utc) => utc.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday);

        public static bool IsOpenTime(DateTime utc) => Weekday(utc) && utc.TimeOfDay >= Start && utc.TimeOfDay < Start + Grace;

        public static bool IsCloseTime(DateTime utc) => Weekday(utc) && utc.TimeOfDay >= End && utc.TimeOfDay < End + Grace;

        /// <summary>The short from the open quote to the close quote of the same day; null when the quotes are unusable.</summary>
        public static ShadowDay? Result(ShadowQuote open, ShadowQuote close, double pipSize)
        {
            if (open.Utc.Date != close.Utc.Date || close.Utc <= open.Utc) return null;
            if (!(open.Bid > 0 && open.Ask >= open.Bid && close.Bid > 0 && close.Ask >= close.Bid && pipSize > 0)) return null;
            var gross = (open.Mid - close.Mid) / open.Mid * 1e4;
            var net = (open.Bid - close.Ask) / open.Bid * 1e4;
            return new ShadowDay(open.Utc.Date, open, close, gross, net, (open.Ask - open.Bid) / pipSize, (close.Ask - close.Bid) / pipSize);
        }
    }
}
