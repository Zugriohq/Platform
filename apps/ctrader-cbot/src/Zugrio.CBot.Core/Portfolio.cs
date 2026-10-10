using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Zugrio.CBot.Core
{
    // Multi-market scanner support for the EA (ADR-0010 follow-up). Everything here is pure
    // and testable. Every number a caller passes in is an EA research parameter
    // (UNVALIDATED_RESEARCH), not admitted Zugrio policy.

    /// <summary>Index: traditional equity-index CFDs (an expansion family, traded only by the index engine).</summary>
    public enum AssetClass { Synthetic, Fx, Metal, Index }

    /// <summary>One watchlist symbol. It is scanned and traded only once the balance reaches <c>UnlockBalance</c>.</summary>
    public sealed record WatchItem(string Symbol, AssetClass Class, double UnlockBalance);

    /// <summary>A capital tier: from <c>MinBalance</c>, at most <c>MaxPositions</c> open, with total open risk at most <c>MaxTotalRiskPct</c> of balance.</summary>
    public sealed record Tier(double MinBalance, int MaxPositions, double MaxTotalRiskPct);

    public static class Watchlist
    {
        /// <summary>
        /// Parses "Name|SYN|0; EURUSD|FX|50; XAUUSD|METAL|250; US 500,US500|INDEX|0". Class codes: SYN, FX, METAL, INDEX.
        /// A name may list alternatives separated by commas (brokers name index CFDs differently); the first one the broker offers is used.
        /// </summary>
        public static IReadOnlyList<WatchItem> Parse(string text)
        {
            var items = new List<WatchItem>();
            foreach (var raw in (text ?? "").Split(';'))
            {
                var entry = raw.Trim();
                if (entry.Length == 0) continue;
                var parts = entry.Split('|').Select(p => p.Trim()).ToArray();
                if (parts.Length != 3 || parts[0].Length == 0) throw new FormatException($"watchlist entry '{entry}' must be Name|CLASS|UnlockBalance");
                var cls = parts[1].ToUpperInvariant() switch
                {
                    "SYN" => AssetClass.Synthetic, "FX" => AssetClass.Fx, "METAL" => AssetClass.Metal, "INDEX" => AssetClass.Index,
                    _ => throw new FormatException($"watchlist entry '{entry}': class must be SYN, FX, METAL or INDEX"),
                };
                if (!double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var unlock) || !(unlock >= 0))
                    throw new FormatException($"watchlist entry '{entry}': unlock balance must be a number >= 0");
                if (items.Any(i => Normalize(i.Symbol) == Normalize(parts[0]))) throw new FormatException($"watchlist lists '{parts[0]}' twice");
                items.Add(new WatchItem(parts[0], cls, unlock));
            }
            return items;
        }

        /// <summary>Parses "0:1:5; 100:2:6" as MinBalance:MaxPositions:MaxTotalRiskPct. The first tier must start at 0.</summary>
        public static IReadOnlyList<Tier> ParseTiers(string text)
        {
            var tiers = new List<Tier>();
            foreach (var raw in (text ?? "").Split(';'))
            {
                var entry = raw.Trim();
                if (entry.Length == 0) continue;
                var p = entry.Split(':').Select(x => x.Trim()).ToArray();
                if (p.Length != 3
                    || !double.TryParse(p[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var min) || !(min >= 0)
                    || !int.TryParse(p[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var max) || max < 1
                    || !double.TryParse(p[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var risk) || !(risk > 0))
                    throw new FormatException($"tier '{entry}' must be MinBalance:MaxPositions:MaxTotalRiskPct");
                tiers.Add(new Tier(min, max, risk));
            }
            if (tiers.Count == 0) throw new FormatException("at least one tier is required");
            tiers.Sort((a, b) => a.MinBalance.CompareTo(b.MinBalance));
            if (tiers[0].MinBalance != 0) throw new FormatException("the first tier must start at balance 0");
            if (tiers.Select(t => t.MinBalance).Distinct().Count() != tiers.Count) throw new FormatException("two tiers start at the same balance");
            return tiers;
        }

        /// <summary>The highest tier whose MinBalance the balance has reached.</summary>
        public static Tier TierFor(IReadOnlyList<Tier> tiers, double balance) =>
            tiers.Where(t => balance >= t.MinBalance).OrderBy(t => t.MinBalance).LastOrDefault() ?? tiers.OrderBy(t => t.MinBalance).First();

        /// <summary>Broker symbol names differ in spacing and case ("Volatility 10 Index" vs "Volatility10Index"); match on letters and digits only.</summary>
        public static string Normalize(string name) => new string((name ?? "").Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

        /// <summary>Finds the broker's exact name for a watchlist symbol (trying comma-separated alternatives in order), or null.</summary>
        public static string? Resolve(string wanted, IEnumerable<string> brokerSymbols)
        {
            var broker = brokerSymbols as IReadOnlyCollection<string> ?? brokerSymbols.ToList();
            foreach (var alt in Alternatives(wanted))
            {
                var key = Normalize(alt);
                var hit = broker.FirstOrDefault(s => string.Equals(s, alt, StringComparison.Ordinal)) ?? broker.FirstOrDefault(s => Normalize(s) == key);
                if (hit != null) return hit;
            }
            return null;
        }

        public static IReadOnlyList<string> Alternatives(string wanted) =>
            (wanted ?? "").Split(',').Select(a => a.Trim()).Where(a => a.Length > 0).ToList();

        /// <summary>
        /// Broker names that share the most words or numbers with a watchlist name that was not found (for example
        /// "US SP 500" for "US 500"), so the owner can put the broker's own name in the watchlist.
        /// </summary>
        public static IReadOnlyList<string> Suggest(string wanted, IEnumerable<string> brokerSymbols, int max = 5)
        {
            static HashSet<string> Tokens(string s) => new(System.Text.RegularExpressions.Regex.Matches(s.ToLowerInvariant(), "[a-z]+|[0-9]+")
                .Select(m => m.Value).Where(t => t != "index" && t != "cash"), StringComparer.Ordinal);
            var want = new HashSet<string>(Alternatives(wanted).SelectMany(Tokens), StringComparer.Ordinal);
            return brokerSymbols.Select(s => (s, score: Tokens(s).Count(want.Contains))).Where(x => x.score >= 2)
                .OrderByDescending(x => x.score).ThenBy(x => x.s, StringComparer.Ordinal).Take(max).Select(x => x.s).ToList();
        }

        /// <summary>The two currencies of an FX or metal pair ("EURUSD" → EUR, USD). Synthetics and indices have none.</summary>
        public static IReadOnlyList<string> Currencies(string symbol, AssetClass cls)
        {
            if (cls is AssetClass.Synthetic or AssetClass.Index) return Array.Empty<string>();
            var letters = new string(symbol.Where(char.IsLetter).ToArray()).ToUpperInvariant();
            return letters.Length >= 6 ? new[] { letters[..3], letters.Substring(3, 3) } : new[] { letters };
        }
    }

    /// <summary>Average true range over the last <c>period</c> closed bars (simple mean of true ranges).</summary>
    public static class Atr
    {
        public static double Compute(IReadOnlyList<(double High, double Low, double Close)> bars, int period)
        {
            if (period < 1) throw new ArgumentOutOfRangeException(nameof(period));
            if (bars.Count < period + 1) return double.NaN;
            double sum = 0;
            for (var i = bars.Count - period; i < bars.Count; i++)
            {
                var b = bars[i]; var prevClose = bars[i - 1].Close;
                sum += Math.Max(b.High - b.Low, Math.Max(Math.Abs(b.High - prevClose), Math.Abs(b.Low - prevClose)));
            }
            return sum / period;
        }
    }

    /// <summary>A READY setup on one symbol, already sized.</summary>
    public sealed record ReadyCandidate(string Symbol, AssetClass Class, DateTimeOffset FrozenAt, string OpportunityId, double RiskMoney, double RiskPct);

    /// <summary>An open Zugrio position. A position without a stop has unbounded risk, so pass <c>double.PositiveInfinity</c>.</summary>
    public sealed record OpenExposure(string Symbol, AssetClass Class, double RiskMoney);

    public sealed record Selection(IReadOnlyList<ReadyCandidate> Take, IReadOnlyList<(ReadyCandidate Candidate, string Reason)> Skipped);

    /// <summary>
    /// Chooses which READY setups to enter when several markets fire together.
    /// Ranking: the frozen spec's SEL-4 order (all candidates are READY and share one
    /// route, so causal age decides: most recent confirmation first), then two EA
    /// tie-breaks: lower risk % (better sizing fit for a small account), then symbol name.
    /// Limits, in order: one position per symbol; the tier's maximum positions; no two
    /// FX/metal positions sharing a currency; the tier's maximum total open risk; and the
    /// loss still allowed today (so open risk plus the new trade can never exceed the day's limit).
    /// </summary>
    public static class PortfolioSelector
    {
        public static IReadOnlyList<ReadyCandidate> Rank(IEnumerable<ReadyCandidate> candidates) =>
            candidates.OrderByDescending(c => c.FrozenAt).ThenBy(c => c.RiskPct).ThenBy(c => c.Symbol, StringComparer.Ordinal).ThenBy(c => c.OpportunityId, StringComparer.Ordinal).ToList();

        /// <param name="dailyLossAllowance">Loss still allowed today (see DailyLossKillSwitch.Remaining). Open risk plus new risk must fit inside it.</param>
        public static Selection Select(IEnumerable<ReadyCandidate> candidates, IReadOnlyList<OpenExposure> open, Tier tier, double balance, double dailyLossAllowance = double.PositiveInfinity)
        {
            var take = new List<ReadyCandidate>();
            var skipped = new List<(ReadyCandidate, string)>();
            var symbols = new HashSet<string>(open.Select(o => o.Symbol), StringComparer.Ordinal);
            var currencies = new HashSet<string>(open.SelectMany(o => Watchlist.Currencies(o.Symbol, o.Class)), StringComparer.Ordinal);
            var count = open.Count;
            var risk = open.Sum(o => o.RiskMoney);
            var budget = balance * tier.MaxTotalRiskPct / 100.0;

            foreach (var c in Rank(candidates))
            {
                string? reason = null;
                var ccy = Watchlist.Currencies(c.Symbol, c.Class);
                if (symbols.Contains(c.Symbol)) reason = "SYMBOL_ALREADY_OPEN";
                else if (count >= tier.MaxPositions) reason = "TIER_MAX_POSITIONS";
                else if (ccy.Any(currencies.Contains)) reason = "CURRENCY_OVERLAP";
                else if (!(risk + c.RiskMoney <= budget * (1 + 1e-9))) reason = "TIER_TOTAL_RISK";
                else if (!(risk + c.RiskMoney <= dailyLossAllowance * (1 + 1e-9))) reason = "DAILY_LOSS_ALLOWANCE";
                if (reason != null) { skipped.Add((c, reason)); continue; }
                take.Add(c);
                symbols.Add(c.Symbol);
                foreach (var x in ccy) currencies.Add(x);
                count++;
                risk += c.RiskMoney;
            }
            return new Selection(take, skipped);
        }
    }

    /// <summary>
    /// What one watchlist symbol costs at the broker's minimum volume for a typical stop,
    /// and so the smallest balance that can trade it under the small-account cap.
    /// </summary>
    public sealed record Affordability(string Symbol, double MinUnits, double TypicalStopDistance, double RiskAtMinimum, double MinBalanceForCap, double SpreadShareOfStop);

    public static class AffordabilityCalc
    {
        public static Affordability Compute(string symbol, double minUnits, double tickSize, double tickValuePerUnit, double typicalStopDistance, double spread, double maxRiskPctAtMinVolume)
        {
            var riskAtMin = typicalStopDistance / tickSize * tickValuePerUnit * minUnits;
            var minBalance = maxRiskPctAtMinVolume > 0 ? riskAtMin / (maxRiskPctAtMinVolume / 100.0) : double.PositiveInfinity;
            var spreadShare = typicalStopDistance > 0 ? spread / typicalStopDistance : double.PositiveInfinity;
            return new Affordability(symbol, minUnits, typicalStopDistance, riskAtMin, minBalance, spreadShare);
        }
    }
}
