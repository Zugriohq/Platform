using System;
using System.Collections.Generic;
using System.Linq;

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// A trading style is a horizon profile (frozen Signal Authority spec F-1: SCALP, DAY, SWING;
    /// INITIAL_MARKET_AND_STRATEGY_PORTFOLIO: "horizons/trading styles, not strategy logic").
    /// Every style runs the same decision-core routes and model; only the timeframe map, the
    /// expiries and the markets it scans differ. All values are UNVALIDATED_RESEARCH.
    /// </summary>
    /// <param name="Name">DAY or SCALP.</param>
    /// <param name="Horizon">The horizon id handed to decision-core. DAY keeps "INTRADAY" so its setup ids are unchanged.</param>
    /// <param name="FallbackContexts">Longer context timeframes tried, in order, when the primary context has no swing to target.</param>
    /// <param name="Classes">Asset classes this style scans.</param>
    /// <param name="TargetR">Take profit at this multiple of the risk, or the engine objective if nearer; 0 = engine objective.</param>
    /// <param name="MaxMinutes">Close a trade still open after this many minutes; 0 = no time stop.</param>
    /// <param name="MinRunwayAtr">decision-core's minimum runway to the objective for this style (x ATR).</param>
    public sealed record TradingStyle(string Name, string Horizon, string ContextTf, string LocationTf, string EntryTf,
        IReadOnlyList<string> FallbackContexts, double SetupExpiryHours, double EntryExpiryMinutes, IReadOnlyList<AssetClass> Classes,
        double TargetR = 0, double MaxMinutes = 0, double MinRunwayAtr = 1.0)
    {
        /// <summary>Each context timeframe is its own decision-core profile: the primary keeps the style's horizon id.</summary>
        public string HorizonFor(string contextTf) => contextTf == ContextTf ? Horizon : Horizon + "_" + contextTf;

        public bool Trades(AssetClass c) => Classes.Contains(c);

        public IEnumerable<string> ContextTimeframes => new[] { ContextTf }.Concat(FallbackContexts);

        public IEnumerable<string> AllTimeframes => ContextTimeframes.Concat(new[] { LocationTf, EntryTf }).Distinct();

        /// <summary>Entry shorter than location shorter than context shorter than every fallback; positive expiries; at least one class.</summary>
        public TradingStyle Validated()
        {
            static TimeSpan L(string tf)
            {
                try { return Timeframes.Length(tf); }
                catch (ArgumentException) { throw new FormatException("unsupported timeframe " + tf); }
            }
            if (!(L(EntryTf) < L(LocationTf) && L(LocationTf) < L(ContextTf)))
                throw new FormatException($"{Name}: timeframes must get longer from entry to location to context ({EntryTf}, {LocationTf}, {ContextTf})");
            foreach (var f in FallbackContexts)
                if (!(L(f) > L(ContextTf))) throw new FormatException($"{Name}: fallback {f} must be longer than the context {ContextTf}");
            if (!(SetupExpiryHours > 0) || !(EntryExpiryMinutes > 0)) throw new FormatException(Name + ": expiries must be positive");
            if (Classes.Count == 0) throw new FormatException(Name + ": at least one asset class");
            if (!(MinRunwayAtr > 0)) throw new FormatException(Name + ": minimum runway must be positive");
            if (TargetR < 0 || MaxMinutes < 0) throw new FormatException(Name + ": take-profit multiple and time stop must be 0 (off) or positive");
            return this;
        }
    }

    public static class TradingStyles
    {
        public const string Day = "DAY";
        public const string Scalp = "SCALP";
        private const string Tag = " st=";

        /// <summary>"DAY,SCALP" → the enabled style names, in order, without duplicates.</summary>
        public static IReadOnlyList<string> ParseNames(string? text)
        {
            var names = (text ?? "").Split(',').Select(s => s.Trim().ToUpperInvariant()).Where(s => s.Length > 0).Distinct().ToList();
            if (names.Count == 0) throw new FormatException("at least one trading style (DAY, SCALP)");
            foreach (var n in names) if (n != Day && n != Scalp) throw new FormatException($"trading style '{n}' must be DAY or SCALP");
            return names;
        }

        /// <summary>"SYN,FX,METAL" (any subset) → asset classes.</summary>
        public static IReadOnlyList<AssetClass> ParseClasses(string? text) =>
            (text ?? "").Split(',').Select(s => s.Trim().ToUpperInvariant()).Where(s => s.Length > 0).Distinct().Select(s => s switch
            {
                "SYN" => AssetClass.Synthetic, "FX" => AssetClass.Fx, "METAL" => AssetClass.Metal,
                _ => throw new FormatException($"asset class '{s}' must be SYN, FX or METAL"),
            }).ToList();

        /// <summary>Fallback list without blanks or the context itself (unchanged behaviour of the DAY fallback text).</summary>
        public static IReadOnlyList<string> ParseFallbacks(string? text, string contextTf) =>
            (text ?? "").Split(',').Select(t => t.Trim().ToUpperInvariant()).Where(t => t.Length > 0 && t != contextTf).Distinct().ToList();

        /// <summary>The style travels in the broker comment, so a restarted EA manages each trade with its own timeframes.</summary>
        public static string WithStyle(string comment, string style) => comment + Tag + style;

        private const string RouteTag = " rt=";

        /// <summary>The route travels in the broker comment too ("C" continuation-retest, "R" reversal-reclaim), for per-setup results.</summary>
        public static string WithRoute(string comment, string route) => comment + RouteTag + (route == "REVERSAL_RECLAIM" ? "R" : "C");

        /// <summary>The route in a broker comment, or null for trades from before routes were tagged.</summary>
        public static string? RouteFromComment(string? comment)
        {
            if (string.IsNullOrEmpty(comment)) return null;
            var i = comment.LastIndexOf(RouteTag, StringComparison.Ordinal);
            if (i < 0) return null;
            return comment[(i + RouteTag.Length)..].Split(' ')[0] switch { "R" => "REVERSAL_RECLAIM", "C" => "CONTINUATION_RETEST", _ => null };
        }

        /// <summary>The style in a broker comment; trades from before styles existed are DAY.</summary>
        public static string FromComment(string? comment)
        {
            if (string.IsNullOrEmpty(comment)) return Day;
            var i = comment.LastIndexOf(Tag, StringComparison.Ordinal);
            return i < 0 ? Day : comment[(i + Tag.Length)..].Split(' ')[0];
        }
    }
}
