using System;

namespace Zugrio.CBot.Core
{
    public sealed record SizingInput(
        double Balance, double RiskPct, double MaxRiskPctAtMinimumVolume,
        double EntryPrice, double StopPrice, double TickSize, double TickValuePerUnit,
        double MinUnits, double StepUnits, double MaxUnits, double LocalMaxUnits,
        double RiskMoneyCap = double.PositiveInfinity);

    public sealed record SizingResult(bool Trade, long Units, double RiskMoney, double RiskPctActual, string Reason);

    /// <summary>
    /// Fixed-fractional sizing from the engine's own stop. The percentages are EA
    /// research parameters (ADR-0009 §4), not validated policy. If even the broker's
    /// minimum volume risks more than <c>MaxRiskPctAtMinimumVolume</c>, the EA does not
    /// trade. A small account is never sized past the declared cap.
    ///
    /// <c>RiskMoneyCap</c> is the loss still allowed today minus open risk: the trade is sized down
    /// to fit it rather than refused, so a day whose limit is a small previous-day profit still
    /// trades, smaller. If even the minimum volume does not fit, it is DAILY_LOSS_ALLOWANCE.
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
            if (!(s.RiskMoneyCap > 0)) return new SizingResult(false, 0, 0, 0, "DAILY_LOSS_ALLOWANCE");
            var budget = Math.Min(s.Balance * s.RiskPct / 100.0, s.RiskMoneyCap);
            var cap = Math.Min(s.MaxUnits, s.LocalMaxUnits);
            // A 1e-9 relative tolerance absorbs binary rounding (e.g. 0.002/0.00001 = 199.999…)
            // so a whole step is not lost; it can never add a full step of risk.
            var units = Math.Floor(Math.Min(budget / lossPerUnit, cap) / s.StepUnits * (1 + 1e-9)) * s.StepUnits;
            if (units >= s.MinUnits)
                return Result((long)units, lossPerUnit, s.Balance, "WITHIN_RISK_BUDGET");
            var minRiskPct = s.MinUnits * lossPerUnit / s.Balance * 100.0;
            if (s.MinUnits * lossPerUnit > s.RiskMoneyCap)
                return new SizingResult(false, 0, s.MinUnits * lossPerUnit, minRiskPct, "DAILY_LOSS_ALLOWANCE");
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
    /// Daily loss limit for the EA. Today's limit is <c>maxDailyLossPct</c> of the UTC day's
    /// starting equity. With <c>protectPreviousDayProfit</c> (owner rule, 2026-10-08: a day
    /// may not lose more than the previous day made), a profitable previous day lowers the
    /// limit to that profit, so a bad day can give back at most yesterday's gain. After a
    /// losing or flat day the percentage limit applies.
    ///
    /// Two uses: <see cref="Tripped"/> stops new entries once today's loss reaches the limit,
    /// and <see cref="Remaining"/> is the loss still allowed today, which callers compare with
    /// the risk already open plus the new trade's risk, so the limit holds before a loss
    /// happens, not only after. It only gates new entries, never a risk reduction (RR-3).
    /// A stop that gaps can still lose more than planned. The percentage is a research parameter.
    ///
    /// Profit lock (anti round-trip): with <c>profitLockFraction</c> f &gt; 0, once equity has risen
    /// above the day's start, the day's floor rises to start + f × (peak − start). Falling back to
    /// that floor stops new entries for the day, so a good day cannot be handed back in full.
    /// </summary>
    public sealed class DailyLossKillSwitch
    {
        private readonly double _maxDailyLossPct;
        private readonly bool _protectPreviousDayProfit;
        private DateTime _day = DateTime.MinValue;
        private double _dayStartEquity;
        private double _previousDayProfit;
        private readonly double _profitLockFraction;
        private double _peakEquity;

        public DailyLossKillSwitch(double maxDailyLossPct, bool protectPreviousDayProfit = false, double profitLockFraction = 0)
        {
            if (!(maxDailyLossPct > 0)) throw new ArgumentOutOfRangeException(nameof(maxDailyLossPct));
            if (!(profitLockFraction >= 0 && profitLockFraction < 1)) throw new ArgumentOutOfRangeException(nameof(profitLockFraction));
            _maxDailyLossPct = maxDailyLossPct;
            _protectPreviousDayProfit = protectPreviousDayProfit;
            _profitLockFraction = profitLockFraction;
        }

        public double PeakEquity => _peakEquity;

        /// <summary>Lowest equity allowed today: the loss limit, raised by the profit lock once the day is up.</summary>
        public double Floor
        {
            get
            {
                var floor = _dayStartEquity - LimitMoney;
                if (_profitLockFraction > 0 && _peakEquity > _dayStartEquity)
                    floor = Math.Max(floor, _dayStartEquity + _profitLockFraction * (_peakEquity - _dayStartEquity));
                return floor;
            }
        }

        public bool Tripped { get; private set; }
        public double DayStartEquity => _dayStartEquity;
        public double PreviousDayProfit => _previousDayProfit;

        /// <summary>Money today may lose in total.</summary>
        public double LimitMoney
        {
            get
            {
                var pct = _dayStartEquity * _maxDailyLossPct / 100.0;
                return _protectPreviousDayProfit && _previousDayProfit > 0 ? Math.Min(pct, _previousDayProfit) : pct;
            }
        }

        /// <summary>Loss still allowed today at this equity (never negative).</summary>
        public double Remaining(double equity) => Math.Max(0, equity - Floor);

        /// <summary>
        /// Sets today's baseline after a restart (balance minus profit of trades closed today) and
        /// yesterday's result (profit of trades closed yesterday), so restarting never resets the
        /// day's limit. Only the first call per day counts.
        /// </summary>
        public void Seed(DateTime utcNow, double dayStartEquity, double previousDayProfit = 0)
        {
            if (utcNow.Date == _day) return;
            _day = utcNow.Date; _dayStartEquity = dayStartEquity; _previousDayProfit = previousDayProfit; _peakEquity = dayStartEquity; Tripped = false;
        }

        /// <summary>Returns true only on the update that trips the switch.</summary>
        public bool Update(DateTime utcNow, double equity)
        {
            if (utcNow.Date != _day)
            {
                // Yesterday's result is the equity change across it (only known if we saw its start).
                _previousDayProfit = _day == utcNow.Date.AddDays(-1) ? equity - _dayStartEquity : 0;
                _day = utcNow.Date; _dayStartEquity = equity; _peakEquity = equity; Tripped = false;
            }
            if (equity > _peakEquity) _peakEquity = equity;
            if (Tripped || !(_dayStartEquity > 0)) return false;
            if (equity - Floor > LimitMoney * 1e-9) return false;
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
