using System;

namespace Zugrio.CBot.Core
{
    public sealed record SizingInput(
        double Balance, double RiskPct, double MaxRiskPctAtMinimumVolume,
        double EntryPrice, double StopPrice, double TickSize, double TickValuePerUnit,
        double MinUnits, double StepUnits, double MaxUnits, double LocalMaxUnits);

    public sealed record SizingResult(bool Trade, long Units, double RiskMoney, double RiskPctActual, string Reason);

    /// <summary>
    /// Fixed-fractional sizing from the engine's own stop. The percentages are EA
    /// research parameters (ADR-0009 §4), not validated policy. If even the broker's
    /// minimum volume risks more than <c>MaxRiskPctAtMinimumVolume</c>, the EA does not
    /// trade. A small account is never sized past the declared cap.
    /// </summary>
    public static class Sizing
    {
        public static SizingResult Compute(SizingInput s)
        {
            if (!(s.Balance > 0) || !(s.RiskPct > 0) || !(s.TickSize > 0) || !(s.TickValuePerUnit > 0) || !(s.MinUnits > 0) || !(s.StepUnits > 0))
                return new SizingResult(false, 0, 0, 0, "SIZING_INPUT_INVALID");
            var distance = Math.Abs(s.EntryPrice - s.StopPrice);
            if (!(distance > 0)) return new SizingResult(false, 0, 0, 0, "STOP_DISTANCE_ZERO");
            var lossPerUnit = distance / s.TickSize * s.TickValuePerUnit;
            var budget = s.Balance * s.RiskPct / 100.0;
            var cap = Math.Min(s.MaxUnits, s.LocalMaxUnits);
            // A 1e-9 relative tolerance absorbs binary rounding (e.g. 0.002/0.00001 = 199.999…)
            // so a whole step is not lost; it can never add a full step of risk.
            var units = Math.Floor(Math.Min(budget / lossPerUnit, cap) / s.StepUnits * (1 + 1e-9)) * s.StepUnits;
            if (units >= s.MinUnits)
                return Result((long)units, lossPerUnit, s.Balance, "WITHIN_RISK_BUDGET");
            var minRiskPct = s.MinUnits * lossPerUnit / s.Balance * 100.0;
            if (s.MinUnits <= cap && minRiskPct <= s.MaxRiskPctAtMinimumVolume)
                return Result((long)s.MinUnits, lossPerUnit, s.Balance, "MINIMUM_VOLUME_WITHIN_SMALL_ACCOUNT_CAP");
            return new SizingResult(false, 0, s.MinUnits * lossPerUnit, minRiskPct, "MINIMUM_VOLUME_EXCEEDS_RISK_CAP");
        }

        private static SizingResult Result(long units, double lossPerUnit, double balance, string reason)
        {
            var money = units * lossPerUnit;
            return new SizingResult(true, units, money, money / balance * 100.0, reason);
        }
    }

    /// <summary>The engine's timeframe codes, mapped to bar lengths.</summary>
    public static class Timeframes
    {
        public static TimeSpan Length(string code) => code switch
        {
            "M1" => TimeSpan.FromMinutes(1), "M5" => TimeSpan.FromMinutes(5), "M15" => TimeSpan.FromMinutes(15),
            "M30" => TimeSpan.FromMinutes(30), "H1" => TimeSpan.FromHours(1), "H4" => TimeSpan.FromHours(4),
            "D1" => TimeSpan.FromDays(1),
            _ => throw new ArgumentException("unsupported timeframe " + code),
        };

        /// <summary>ISO-8601 UTC with milliseconds, the form decision-core accepts.</summary>
        public static string Iso(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", System.Globalization.CultureInfo.InvariantCulture);
    }
}

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// Daily loss kill switch for the EA. Once equity has fallen <c>maxDailyLossPct</c>
    /// from the UTC day's starting equity, new entries stop until the next UTC day. It only
    /// feeds <see cref="EntryGuard.KillSwitch"/>, so it never blocks a risk reduction (RR-3).
    /// The percentage is a research parameter (ADR-0009 §4).
    /// </summary>
    public sealed class DailyLossKillSwitch
    {
        private readonly double _maxDailyLossPct;
        private DateTime _day = DateTime.MinValue;
        private double _dayStartEquity;

        public DailyLossKillSwitch(double maxDailyLossPct)
        {
            if (!(maxDailyLossPct > 0)) throw new ArgumentOutOfRangeException(nameof(maxDailyLossPct));
            _maxDailyLossPct = maxDailyLossPct;
        }

        public bool Tripped { get; private set; }
        public double DayStartEquity => _dayStartEquity;

        /// <summary>
        /// Sets today's baseline after a restart (e.g. balance minus profit of trades closed
        /// today), so restarting never resets the day's loss limit. Only the first call per day counts.
        /// </summary>
        public void Seed(DateTime utcNow, double dayStartEquity)
        {
            if (utcNow.Date == _day) return;
            _day = utcNow.Date; _dayStartEquity = dayStartEquity; Tripped = false;
        }

        /// <summary>Returns true only on the update that trips the switch.</summary>
        public bool Update(DateTime utcNow, double equity)
        {
            if (utcNow.Date != _day) { _day = utcNow.Date; _dayStartEquity = equity; Tripped = false; }
            if (Tripped || !(_dayStartEquity > 0)) return false;
            if ((_dayStartEquity - equity) / _dayStartEquity * 100.0 < _maxDailyLossPct) return false;
            Tripped = true;
            return true;
        }
    }

    /// <summary>Rejects an entry when the market is not strictly between the engine's stop and objective.</summary>
    public static class EntrySide
    {
        public static bool PriceBetweenStopAndTarget(bool buy, double price, double stop, double target) =>
            buy ? stop < price && price < target : target < price && price < stop;
    }
}
