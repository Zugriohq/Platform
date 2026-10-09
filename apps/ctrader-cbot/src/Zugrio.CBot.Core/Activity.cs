using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// Plain-English activity for the cTrader Journal: one-line event messages and an hourly
    /// summary, so the owner can see what the EA is doing without reading JSON records.
    /// It only counts and formats; it decides nothing.
    /// </summary>
    public sealed class EaActivity
    {
        private readonly Dictionary<string, int> _skips = new(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _nearestAtr = new(StringComparer.Ordinal);
        private readonly HashSet<string> _announced = new(StringComparer.Ordinal);

        public int Scans { get; private set; }
        public int Setups { get; private set; }
        public int Entries { get; private set; }
        public int Closes { get; private set; }
        public double ClosedProfit { get; private set; }
        /// <summary>Seconds spent in engine scans this hour: how much of the cloud instance's time scanning takes.</summary>
        public double ScanSeconds { get; private set; }
        /// <summary>Why level/target combinations were not setups this hour (from the engine bridge).</summary>
        public int NoRunway { get; private set; }
        public int TooFar { get; private set; }
        public int PastStop { get; private set; }
        /// <summary>Combinations in place geometrically that decision-core judged not READY (sequence not confirmed yet).</summary>
        public int NotConfirmed { get; private set; }

        public void WhyNot(int pastStop, int tooFar, int noRunway, int notConfirmed)
        {
            PastStop += Math.Max(0, pastStop); TooFar += Math.Max(0, tooFar); NoRunway += Math.Max(0, noRunway); NotConfirmed += Math.Max(0, notConfirmed);
        }

        public void Scanned(string symbol, double? nearestLevelAtr, double seconds = 0)
        {
            Scans++;
            if (seconds > 0 && double.IsFinite(seconds)) ScanSeconds += seconds;
            if (nearestLevelAtr is double d && double.IsFinite(d) && (!_nearestAtr.TryGetValue(symbol, out var cur) || d < cur)) _nearestAtr[symbol] = d;
        }

        /// <summary>True the first time a setup is seen, so its message is printed once, not on every bar it stays READY.</summary>
        public bool SetupFound(string fireEventId)
        {
            if (!_announced.Add("setup:" + fireEventId)) return false;
            Setups++;
            return true;
        }

        /// <summary>True the first time this setup is skipped for this reason.</summary>
        public bool Skipped(string fireEventId, string reason)
        {
            if (!_announced.Add("skip:" + fireEventId + ":" + reason)) return false;
            _skips[reason] = _skips.TryGetValue(reason, out var n) ? n + 1 : 1;
            return true;
        }

        public void Entered() => Entries++;
        public void Closed(double netProfit) { Closes++; ClosedProfit += netProfit; }

        public string Summary(DateTime hourEndUtc, double balance, double equity, int openTrades, Tier tier, double lossStillAllowed, double dailyFloor)
        {
            var ci = CultureInfo.InvariantCulture;
            var closest = _nearestAtr.OrderBy(kv => kv.Value).ThenBy(kv => kv.Key, StringComparer.Ordinal).Take(3)
                .Select(kv => $"{kv.Key} {kv.Value.ToString("0.0", ci)} ATR").ToList();
            var skips = _skips.Count == 0 ? "none" : string.Join(", ", _skips.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Value} {ReasonText(kv.Key)}"));
            return $"Zugrio EA, hour to {hourEndUtc.ToString("HH:mm", ci)} UTC: {Scans} scans, {Setups} setups found, {Entries} trades opened, {Closes} closed " +
                   $"(P/L {ClosedProfit.ToString("+0.00;-0.00;0.00", ci)}). Skipped: {skips}. " +
                   $"Closest to a setup: {(closest.Count == 0 ? "n/a" : string.Join(", ", closest))}. " +
                   $"Scanning took {ScanSeconds.ToString("0", ci)} s. " +
                   (Setups == 0 && PastStop + TooFar + NoRunway + NotConfirmed > 0
                       ? $"Why no setup: {NoRunway} too little room to the target, {TooFar} price too far from the level, {PastStop} price past the stop, {NotConfirmed} not confirmed yet. "
                       : "") +
                   $"Balance {balance.ToString("0.00", ci)}, equity {equity.ToString("0.00", ci)}, {openTrades} open (max {tier.MaxPositions}). " +
                   $"Today's floor {dailyFloor.ToString("0.00", ci)}, loss still allowed {lossStillAllowed.ToString("0.00", ci)}.";
        }

        /// <summary>Starts the next hour. Setups already announced stay announced, so a setup spanning the hour is not repeated.</summary>
        public void NextHour()
        {
            Scans = Setups = Entries = Closes = 0; ClosedProfit = 0; ScanSeconds = 0;
            NoRunway = TooFar = PastStop = NotConfirmed = 0;
            _skips.Clear(); _nearestAtr.Clear();
            if (_announced.Count > 20_000) _announced.Clear();
        }

        public static string ReasonText(string code) => code switch
        {
            "SPREAD_TOO_WIDE_FOR_STOP" => "spread too wide for the stop",
            "MINIMUM_VOLUME_EXCEEDS_RISK_CAP" => "smallest trade too big for this balance",
            "LOCKED_UNTIL_BALANCE" => "market not unlocked at this balance",
            "PRICE_NOT_BETWEEN_STOP_AND_TARGET" => "price already past the stop or target",
            "SYMBOL_ALREADY_OPEN" => "already in a trade on this market",
            "TIER_MAX_POSITIONS" => "max trades already open for this balance",
            "CURRENCY_OVERLAP" => "already holding that currency",
            "TIER_TOTAL_RISK" => "total open risk limit",
            "DAILY_LOSS_ALLOWANCE" => "daily loss limit or profit lock",
            "STOP_DISTANCE_ZERO" => "stop too close",
            "SIZING_INPUT_INVALID" => "broker contract data unavailable",
            "ATR_UNAVAILABLE" => "not enough price history",
            "GUARD" => "safety check failed",
            "TREND_NOT_ALIGNED" => "against the higher-timeframe trend",
            _ => code.StartsWith("CONTRACT", StringComparison.Ordinal) ? "instruction check failed" : code.ToLowerInvariant().Replace('_', ' '),
        };
    }
}
