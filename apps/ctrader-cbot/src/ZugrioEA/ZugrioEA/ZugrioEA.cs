using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using cAlgo.API;
using cAlgo.API.Internals;
using Zugrio.CBot.Core;
using Zugrio.CBot.Engine;
using Watchlist = Zugrio.CBot.Core.Watchlist;

namespace Zugrio.CBot.EA
{
    /// <summary>
    /// Zugrio EA (ADR-0010): a fully automatic market scanner on the demo or live account it
    /// is started on. Runs as a cTrader cloud instance (started from cTrader Mobile, Web or
    /// desktop) or locally. The chart it is attached to does not matter: it scans its watchlist.
    ///
    /// On every closed entry-timeframe bar of every watchlist symbol, it hands closed bars to
    /// Zugrio's own decision-core (running under Jint). READY setups from all markets are
    /// gathered for a few seconds, ranked (SEL-4, then EA tie-breaks) and admitted under the
    /// capital tier the balance has reached: small accounts trade the cheapest markets with
    /// one position at a time, and more markets, positions and total risk unlock as the
    /// balance grows (and lock again if it falls). Every entry goes through the boundary core:
    /// signed in-process instruction, abort-only guards, journalled state machine, protection
    /// deadline and risk-reducing gate. Everything is logged for analysis.
    ///
    /// Two decision-core trading styles (horizon profiles of the same engine): DAY scans H1/M15/M5 on every
    /// closed M5 bar; SCALP scans M15/M5/M1 on every closed M1 bar, synthetics only. Both are OFF by default
    /// since ADR-0012: on real data neither showed an edge (research/lab rounds 1-2).
    ///
    /// The Zugrio Index engine (ADR-0012, on by default) trades equity-index CFDs with the rule that held out of
    /// sample in research/lab round 3: once a day, just before the US cash close, buy after 3 lower closes in a row
    /// while the close is above its 200-session average; sell at the first close above the 5-session average;
    /// protective stop 3 session ATRs below the entry. It does not use decision-core. Its entries go through the
    /// same sizing, capital tiers, daily loss rules, signed instruction, guards and journal as every other entry.
    ///
    /// Model distances are multiples of each symbol's ATR on the style's location timeframe,
    /// so one setting works across synthetics, forex and gold, and across styles. All parameters are research values (UNVALIDATED_RESEARCH);
    /// changing any of them changes the config version recorded with every decision.
    /// </summary>
    // AccessRights.None so it can run as a cTrader cloud instance, which is how it runs from
    // cTrader Mobile. It needs no more: relative-path files, no HTTP, no Windows APIs.
    [Robot(AccessRights = AccessRights.None, AddIndicators = false, TimeZone = TimeZones.UTC)]
    public class ZugrioEA : Robot
    {
        // Unlock balances: about 1.5x the smallest balance each market needed under the 5% small-account
        // cap in the first Deriv cTrader affordability report (2026-10-08, demo). Research values;
        // sizing still checks every trade against the live contract data.
        public const string DefaultWatchlist =
            "USDJPY|FX|0; AUDUSD|FX|0; EURUSD|FX|0; GBPUSD|FX|0; Volatility 50 Index|SYN|20; " +
            "Volatility 10 Index|SYN|35; Volatility 25 Index|SYN|35; Volatility 75 Index|SYN|50; " +
            "Volatility 10 (1s) Index|SYN|80; Step Index|SYN|80; Volatility 100 Index|SYN|80; XAUUSD|METAL|120";
        // Index engine markets (ADR-0012): the two indices whose edge held out of sample. Brokers name index CFDs
        // differently, so each entry lists alternatives; the first one the broker offers is used. A separate
        // parameter, so an instance that kept an older watchlist still gets these.
        public const string DefaultIndexMarkets =
            "US 500,US500,US SP 500,SPX500,SP500,US500Cash|INDEX|0; " +
            "US Tech 100,USTEC,US100,NAS100,USTech100,NDX100,US100Cash|INDEX|0";
        public const string DefaultTiers = "0:1:5; 100:2:6; 250:3:8; 1000:4:8";

        [Parameter("Watchlist (Name|SYN/FX/METAL|unlock balance; ...)", DefaultValue = DefaultWatchlist, Group = "Markets and capital tiers (research)")] public string WatchlistText { get; set; } = DefaultWatchlist;
        [Parameter("Tiers (min balance:max positions:max total risk %; ...)", DefaultValue = DefaultTiers, Group = "Markets and capital tiers (research)")] public string TiersText { get; set; } = DefaultTiers;
        [Parameter("Trend filter: trade only with the context structure", DefaultValue = true, Group = "Markets and capital tiers (research)")] public bool TrendFilterOn { get; set; } = true;
        [Parameter("Trend filter also on reclaim setups", DefaultValue = false, Group = "Markets and capital tiers (research)")] public bool TrendFilterOnReclaims { get; set; }
        [Parameter("Never fade a clear trend (reclaim setups)", DefaultValue = true, Group = "Markets and capital tiers (research)")] public bool NoCounterTrendReclaims { get; set; } = true;
        [Parameter("Max spread as share of stop distance", DefaultValue = 0.25, MinValue = 0.01, MaxValue = 1, Group = "Markets and capital tiers (research)")] public double MaxSpreadShareOfStop { get; set; }

        // Renamed (was StylesText "DAY,SCALP") so an existing instance picks up the new default: both off (ADR-0012).
        [Parameter("Decision-core styles (DAY, SCALP; empty = off)", DefaultValue = "", Group = "Trading styles")] public string CoreStylesText { get; set; } = "";
        [Parameter("Context bars", DefaultValue = 120, MinValue = 50, MaxValue = 2000, Group = "Trading styles")] public int ContextBars { get; set; }
        [Parameter("Location bars", DefaultValue = 200, MinValue = 50, MaxValue = 2000, Group = "Trading styles")] public int LocationBars { get; set; }
        [Parameter("Entry bars", DefaultValue = 300, MinValue = 50, MaxValue = 2000, Group = "Trading styles")] public int EntryBars { get; set; }

        [Parameter("Day: context timeframe", DefaultValue = "H1", Group = "Day trading (research)")] public string ContextTf { get; set; } = "H1";
        [Parameter("Day: location timeframe", DefaultValue = "M15", Group = "Day trading (research)")] public string LocationTf { get; set; } = "M15";
        [Parameter("Day: entry timeframe", DefaultValue = "M5", Group = "Day trading (research)")] public string EntryTf { get; set; } = "M5";
        [Parameter("Day: target fallback timeframes", DefaultValue = "H4,D1", Group = "Day trading (research)")] public string FallbackContextText { get; set; } = "H4,D1";
        [Parameter("Day: setup expiry (hours)", DefaultValue = 24.0, MinValue = 0.5, Group = "Day trading (research)")] public double SetupExpiryHours { get; set; }
        [Parameter("Day: entry expiry (minutes)", DefaultValue = 15.0, MinValue = 1, Group = "Day trading (research)")] public double EntryExpiryMinutes { get; set; }

        [Parameter("Scalp: markets (SYN, FX, METAL)", DefaultValue = "SYN", Group = "Scalping (research)")] public string ScalpClassesText { get; set; } = "SYN";
        [Parameter("Scalp: context timeframe", DefaultValue = "M15", Group = "Scalping (research)")] public string ScalpContextTf { get; set; } = "M15";
        [Parameter("Scalp: location timeframe", DefaultValue = "M5", Group = "Scalping (research)")] public string ScalpLocationTf { get; set; } = "M5";
        [Parameter("Scalp: entry timeframe", DefaultValue = "M1", Group = "Scalping (research)")] public string ScalpEntryTf { get; set; } = "M1";
        [Parameter("Scalp: target fallback timeframes", DefaultValue = "H1", Group = "Scalping (research)")] public string ScalpFallbackText { get; set; } = "H1";
        [Parameter("Scalp: setup expiry (hours)", DefaultValue = 6.0, MinValue = 0.1, Group = "Scalping (research)")] public double ScalpSetupExpiryHours { get; set; }
        [Parameter("Scalp: entry expiry (minutes)", DefaultValue = 3.0, MinValue = 1, Group = "Scalping (research)")] public double ScalpEntryExpiryMinutes { get; set; }
        [Parameter("Scalp: minimum runway to objective (x ATR)", DefaultValue = 0.30, MinValue = 0.01, Group = "Scalping (research)")] public double ScalpMinRunwayAtr { get; set; }
        [Parameter("Scalp: take profit at (x risk, 0 = engine target)", DefaultValue = 1.0, MinValue = 0, Group = "Scalping (research)")] public double ScalpTargetR { get; set; }
        [Parameter("Scalp: close after (minutes, 0 = never)", DefaultValue = 30, MinValue = 0, Group = "Scalping (research)")] public double ScalpMaxMinutes { get; set; }

        [Parameter("Routes (comma list: CONTINUATION_RETEST, REVERSAL_RECLAIM)", DefaultValue = "CONTINUATION_RETEST,REVERSAL_RECLAIM", Group = "Entry model (research, ATR multiples)")] public string RoutesText { get; set; } = "CONTINUATION_RETEST,REVERSAL_RECLAIM";
        [Parameter("Pivot bars left/right", DefaultValue = 2, MinValue = 1, MaxValue = 10, Group = "Entry model (research, ATR multiples)")] public int PivotBars { get; set; }
        [Parameter("ATR period (style's location timeframe)", DefaultValue = 14, MinValue = 2, MaxValue = 200, Group = "Entry model (research, ATR multiples)")] public int AtrPeriod { get; set; }
        [Parameter("Break threshold (x ATR)", DefaultValue = 0.10, MinValue = 0.001, Group = "Entry model (research, ATR multiples)")] public double BreakAtr { get; set; }
        [Parameter("Retest touch tolerance (x ATR)", DefaultValue = 0.25, MinValue = 0.001, Group = "Entry model (research, ATR multiples)")] public double TouchAtr { get; set; }
        [Parameter("Stop beyond level (x ATR)", DefaultValue = 0.30, MinValue = 0.001, Group = "Entry model (research, ATR multiples)")] public double StopAtr { get; set; }
        [Parameter("Max chase from level (x ATR)", DefaultValue = 0.50, MinValue = 0.001, Group = "Entry model (research, ATR multiples)")] public double MaxChaseAtr { get; set; }
        [Parameter("Minimum stop distance from entry (x ATR)", DefaultValue = 0.30, MinValue = 0, Group = "Entry model (research, ATR multiples)")] public double MinStopAtr { get; set; }
        [Parameter("Minimum runway to objective (x ATR)", DefaultValue = 1.0, MinValue = 0.001, Group = "Entry model (research, ATR multiples)")] public double MinRunwayAtr { get; set; }
        [Parameter("Recent facts per role", DefaultValue = 3, MinValue = 1, MaxValue = 10, Group = "Entry model (research, ATR multiples)")] public int RecentFacts { get; set; }

        [Parameter("Index engine on (equity-index CFDs)", DefaultValue = true, Group = "Zugrio Index engine (research)")] public bool IndexEngineOn { get; set; } = true;
        [Parameter("Index markets (name,alternative,...|INDEX|unlock balance; ...)", DefaultValue = DefaultIndexMarkets, Group = "Zugrio Index engine (research)")] public string IndexMarketsText { get; set; } = DefaultIndexMarkets;
        [Parameter("Index: buy after this many lower closes in a row", DefaultValue = 3, MinValue = 1, MaxValue = 10, Group = "Zugrio Index engine (research)")] public int IndexLowerCloses { get; set; } = 3;
        [Parameter("Index: only above this average (sessions)", DefaultValue = 200, MinValue = 20, MaxValue = 400, Group = "Zugrio Index engine (research)")] public int IndexTrendSma { get; set; } = 200;
        [Parameter("Index: sell at a close above this average (sessions)", DefaultValue = 5, MinValue = 2, MaxValue = 50, Group = "Zugrio Index engine (research)")] public int IndexExitSma { get; set; } = 5;
        [Parameter("Index: stop (x session ATR)", DefaultValue = 3.0, MinValue = 0.5, MaxValue = 10, Group = "Zugrio Index engine (research)")] public double IndexStopAtr { get; set; } = 3.0;
        [Parameter("Index: backstop target (x session ATR)", DefaultValue = 10.0, MinValue = 2, MaxValue = 50, Group = "Zugrio Index engine (research)")] public double IndexFarTargetAtr { get; set; } = 10.0;
        [Parameter("Index: US cash close, New York time (HH:mm)", DefaultValue = "16:00", Group = "Zugrio Index engine (research)")] public string IndexCloseText { get; set; } = "16:00";
        [Parameter("Index: decide this many minutes before the close", DefaultValue = 5, MinValue = 1, MaxValue = 60, Group = "Zugrio Index engine (research)")] public int IndexLeadMinutes { get; set; } = 5;

        [Parameter("Risk per trade (% of balance)", DefaultValue = 1.0, MinValue = 0.05, MaxValue = 5, Group = "Risk (research)")] public double RiskPct { get; set; }
        [Parameter("Max risk at broker minimum volume (%)", DefaultValue = 5.0, MinValue = 0.1, MaxValue = 20, Group = "Risk (research)")] public double MaxRiskPctAtMinVolume { get; set; }
        [Parameter("Max units per order", DefaultValue = 1000000, MinValue = 1, Group = "Risk (research)")] public double MaxUnits { get; set; }
        [Parameter("Daily loss limit (% of day-start equity)", DefaultValue = 5.0, MinValue = 0.5, MaxValue = 50, Group = "Risk (research)")] public double MaxDailyLossPct { get; set; }
        [Parameter("Never lose more in a day than the previous day made", DefaultValue = true, Group = "Risk (research)")] public bool ProtectPreviousDayProfit { get; set; } = true;
        [Parameter("Daily profit lock (share of the day's peak gain kept)", DefaultValue = 0.5, MinValue = 0, MaxValue = 0.95, Group = "Risk (research)")] public double ProfitLockFraction { get; set; }

        [Parameter("Move stop to break-even at (x R profit)", DefaultValue = 1.0, MinValue = 0.1, Group = "Protect open profit (research)")] public double BreakEvenAtR { get; set; }
        [Parameter("Break-even lock past entry (x ATR)", DefaultValue = 0.05, MinValue = 0, Group = "Protect open profit (research)")] public double BreakEvenLockAtr { get; set; }
        [Parameter("Start trailing at (x R profit)", DefaultValue = 1.5, MinValue = 0.1, Group = "Protect open profit (research)")] public double TrailStartR { get; set; }
        [Parameter("Trail distance behind best price (x ATR)", DefaultValue = 1.0, MinValue = 0.05, Group = "Protect open profit (research)")] public double TrailAtr { get; set; }
        [Parameter("Keep at least this share of the best open profit", DefaultValue = 0.5, MinValue = 0, MaxValue = 0.95, Group = "Protect open profit (research)")] public double KeepProfitFraction { get; set; }

        [Parameter("Max quote age (seconds)", DefaultValue = 10, MinValue = 1, Group = "Execution safety (research)")] public int MaxQuoteAgeSeconds { get; set; }
        [Parameter("Max clock skew (seconds)", DefaultValue = 30, MinValue = 1, Group = "Execution safety (research)")] public int MaxClockSkewSeconds { get; set; }
        [Parameter("Protection deadline (seconds)", DefaultValue = 10, MinValue = 1, Group = "Execution safety (research)")] public int ProtectionDeadlineSeconds { get; set; }

        private const int CoidLength = 26;
        private static readonly TimeSpan GatherWindow = TimeSpan.FromSeconds(3);

        /// <summary>One watchlist symbol resolved at the broker, with its bars and last quote time.</summary>
        private sealed class Market
        {
            public Market(WatchItem item, Symbol symbol, IReadOnlyDictionary<string, Bars> bars, IReadOnlyList<TradingStyle> styles)
            { Item = item; Sym = symbol; Bars = bars; Styles = styles; }
            public WatchItem Item { get; }
            public Symbol Sym { get; }
            public string Name => Sym.Name;
            /// <summary>Bars by timeframe code: every timeframe of every style this market is scanned in.</summary>
            public IReadOnlyDictionary<string, Bars> Bars { get; }
            /// <summary>The enabled styles that scan this market.</summary>
            public IReadOnlyList<TradingStyle> Styles { get; }
            public DateTime LastTickUtc { get; set; } = DateTime.MinValue;
            public bool Has(TradingStyle s) => Bars.ContainsKey(s.LocationTf) && Bars.ContainsKey(s.EntryTf);
        }

        /// <summary>One equity-index CFD for the index engine: its H1 bars and the New York date it last decided.</summary>
        private sealed class IndexMarket
        {
            public IndexMarket(WatchItem item, Symbol symbol, Bars h1) { Item = item; Sym = symbol; H1 = h1; }
            public WatchItem Item { get; }
            public Symbol Sym { get; }
            public string Name => Sym.Name;
            public Bars H1 { get; }
            public DateTime LastTickUtc { get; set; } = DateTime.MinValue;
            public DateTime DecidedDate { get; set; } = DateTime.MinValue;
            public DateTime RetryAt { get; set; } = DateTime.MinValue;
        }

        /// <summary>A READY setup waiting for the gather window to close.</summary>
        private sealed record Pending(Market M, TradingStyle Style, string Route, string OpportunityId, string FireEventId, Side Side, double EntryRef, double Stop, double Target, ReadyCandidate Candidate);

        private EaExecution _exec = null!;
        private ZugrioEngine _engine = null!;
        private EntryBoundary _boundary = null!;
        private EntryGuard _guard = null!;
        private EaLog _log = null!;
        private ECDsa _key = null!;
        private string _configVersion = "";
        private string _accountId = "";
        private string _venue = "";
        private IReadOnlyList<Tier> _tiers = Array.Empty<Tier>();
        private readonly List<Market> _markets = new();
        private readonly List<IndexMarket> _indexMarkets = new();
        private IndexRule _indexRule = null!;
        private TimeSpan _indexLead;
        /// <summary>How long after the decision time a decision may still be taken (a restart inside it decides again; duplicates are refused).</summary>
        private static readonly TimeSpan IndexDecisionWindow = TimeSpan.FromMinutes(15);
        /// <summary>Index entries: how far (x session ATR) the ask may move above the decision price before the order is refused. UNVALIDATED_RESEARCH.</summary>
        private const double IndexChaseAtr = 0.25;
        private readonly List<Pending> _pending = new();
        private readonly EaActivity _activity = new();
        private DateTime _activityHour = DateTime.MinValue;
        private IReadOnlyList<string> _routes = Array.Empty<string>();
        private IReadOnlyList<TradingStyle> _styles = Array.Empty<TradingStyle>();
        /// <summary>Both style definitions, enabled or not, so trades of a style switched off are still managed.</summary>
        private IReadOnlyDictionary<string, TradingStyle> _styleDefs = new Dictionary<string, TradingStyle>();
        private TrailSettings _trail = null!;
        private readonly Dictionary<long, DateTime> _lastTrail = new();
        private readonly Dictionary<long, DateTime> _timeStopTried = new();
        private const int ResultsDays = 7;
        private static readonly TimeSpan TrailInterval = TimeSpan.FromSeconds(10);
        private DateTime _pendingSince = DateTime.MinValue;
        private DailyLossKillSwitch _killSwitch = null!;
        private DateTime _reportDay = DateTime.MinValue;
        private Tier? _lastTier;

        protected override void OnStart()
        {
            _exec = new EaExecution(this);
            _accountId = Account.Number.ToString(System.Globalization.CultureInfo.InvariantCulture);
            _venue = (_exec.IsLive ? "ctrader-live:" : "ctrader-demo:") + Account.BrokerName;

            IReadOnlyList<WatchItem> watch;
            try
            {
                watch = Watchlist.Parse(WatchlistText); _tiers = Watchlist.ParseTiers(TiersText);
                var indexWatch = Watchlist.Parse(IndexMarketsText);
                if (indexWatch.Any(x => x.Class != AssetClass.Index)) throw new FormatException("index markets must all be class INDEX");
                // Index entries may also sit in the main watchlist; each market once.
                var main = watch;
                watch = main.Concat(indexWatch.Where(x => !main.Any(w => Watchlist.Normalize(w.Symbol) == Watchlist.Normalize(x.Symbol)))).ToList();
                _routes = RoutesText.Split(',').Select(r => r.Trim().ToUpperInvariant()).Where(r => r.Length > 0).Distinct().ToList();
                if (_routes.Count == 0 || _routes.Any(r => r != "CONTINUATION_RETEST" && r != "REVERSAL_RECLAIM"))
                    throw new FormatException("routes must be CONTINUATION_RETEST and/or REVERSAL_RECLAIM");
                var day = new TradingStyle(TradingStyles.Day, "INTRADAY", ContextTf.Trim().ToUpperInvariant(), LocationTf.Trim().ToUpperInvariant(), EntryTf.Trim().ToUpperInvariant(),
                    TradingStyles.ParseFallbacks(FallbackContextText, ContextTf.Trim().ToUpperInvariant()), SetupExpiryHours, EntryExpiryMinutes,
                    new[] { AssetClass.Synthetic, AssetClass.Fx, AssetClass.Metal }, MinRunwayAtr: MinRunwayAtr).Validated();
                var scalp = new TradingStyle(TradingStyles.Scalp, "SCALP", ScalpContextTf.Trim().ToUpperInvariant(), ScalpLocationTf.Trim().ToUpperInvariant(), ScalpEntryTf.Trim().ToUpperInvariant(),
                    TradingStyles.ParseFallbacks(ScalpFallbackText, ScalpContextTf.Trim().ToUpperInvariant()), ScalpSetupExpiryHours, ScalpEntryExpiryMinutes,
                    TradingStyles.ParseClasses(ScalpClassesText), ScalpTargetR, ScalpMaxMinutes, ScalpMinRunwayAtr).Validated();
                _styleDefs = new Dictionary<string, TradingStyle> { [day.Name] = day, [scalp.Name] = scalp };
                _styles = TradingStyles.ParseNames(CoreStylesText).Select(n => _styleDefs[n]).ToList();
                _indexRule = new IndexRule(IndexLowerCloses, IndexTrendSma, IndexExitSma, AtrPeriod: 14, IndexStopAtr, IndexFarTargetAtr,
                    SessionClose: IndexRule.ParseClock(IndexCloseText)).Validated();
                _indexLead = TimeSpan.FromMinutes(IndexLeadMinutes);
            }
            catch (FormatException e) { Print("Zugrio EA: invalid watchlist, tiers, routes, styles or index settings: " + e.Message + ". Not trading."); Stop(); return; }
            _trail = new TrailSettings(BreakEvenAtR, BreakEvenLockAtr, TrailStartR, TrailAtr, MinStepAtr: 0.1, MinGapAtr: 0.2, KeepProfitFraction);

            var config = Config();
            _configVersion = CanonicalJson.Sha256Hex("zugrio:ea-config:v1", config);
            try { _engine = ZugrioEngine.Load(); }
            catch (Exception e) { Print("Zugrio engine failed to load or self-test: " + e.Message + ". Not trading."); Stop(); return; }

            _log = new EaLog(_configVersion, _engine.BundleSha256, Print);
            IBoundaryJournal journal;
            try
            {
                System.IO.Directory.CreateDirectory(EaLog.Folder);
                var fileJournal = new FileJournal(System.IO.Path.Combine(EaLog.Folder, $"journal-{_accountId}.jsonl"));
                fileJournal.ReadAll();
                journal = fileJournal;
            }
            catch (Exception e)
            {
                // Cloud restarts wipe files anyway. Duplicate-entry protection does not rely on the
                // journal alone: entries also check the broker's own positions and history.
                Print("Zugrio EA: journal file unavailable (" + e.Message + "); using an in-memory journal.");
                journal = new InMemoryJournal();
            }
            _boundary = new EntryBoundary(journal, TimeSpan.FromSeconds(ProtectionDeadlineSeconds));

            // In-process signing key: the EA's decision and execution run in one process, so this key
            // only exercises the same verification path the product will use (TRT rules, H-3).
            _key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var trust = TrustRoot.Load(new JsonObject
            {
                ["trustRootVersion"] = "ea-ephemeral",
                ["allowedSignatureAlgorithms"] = new JsonArray("ES256"),
                ["trustedSigningKeys"] = new JsonArray(new JsonObject
                {
                    ["keyId"] = "ea", ["publicKey"] = Convert.ToBase64String(_key.ExportSubjectPublicKeyInfo()),
                    ["validFrom"] = "2000-01-01T00:00:00Z", ["validUntil"] = "2100-01-01T00:00:00Z", ["status"] = "ACTIVE",
                }),
            }.ToJsonString());
            _guard = new EntryGuard(trust, new LocalLimits(
                AllowLiveAccounts: true, MaxVolumeUnits: (long)MaxUnits, MaxQuoteAge: TimeSpan.FromSeconds(MaxQuoteAgeSeconds),
                MaxClockSkew: TimeSpan.FromSeconds(MaxClockSkewSeconds), PinnedBrokerExecutionPolicyHash: _configVersion,
                PinnedExecutionAuthorityManifestHash: _engine.BundleSha256, ClientOrderIdLength: CoidLength));

            _killSwitch = new DailyLossKillSwitch(MaxDailyLossPct, ProtectPreviousDayProfit, ProfitLockFraction);
            // Restarts (every cloud restart) must not reset today's loss baseline: rebuild it from
            // the broker's record of trades closed today.
            var today = Server.TimeInUtc.Date;
            var closedToday = History.Where(t => t.ClosingTime >= today).Sum(t => t.NetProfit);
            var closedYesterday = History.Where(t => t.ClosingTime >= today.AddDays(-1) && t.ClosingTime < today).Sum(t => t.NetProfit);
            _killSwitch.Seed(Server.TimeInUtc, Account.Balance - closedToday, closedYesterday);

            ResolveMarkets(watch);
            if (_markets.Count == 0 && _indexMarkets.Count == 0)
            { Print("Zugrio EA: nothing to trade: no watchlist symbol at this broker is in an enabled style or the index engine. Not trading."); Stop(); return; }
            Positions.Closed += OnPositionClosed;
            Timer.Start(TimeSpan.FromSeconds(1));

            _log.Write(Server.TimeInUtc, "start", new Dictionary<string, object?>
            {
                ["account"] = _accountId, ["broker"] = Account.BrokerName, ["currency"] = Account.Asset.Name, ["isLive"] = Account.IsLive,
                ["balance"] = Account.Balance, ["markets"] = _markets.Select(m => m.Name).ToArray(), ["indexMarkets"] = _indexMarkets.Select(m => m.Name).ToArray(), ["configVersion"] = _configVersion, ["engineSha256"] = _engine.BundleSha256,
                ["config"] = JsonDocument.Parse(config.ToJsonString()).RootElement.Clone(),
            });
            Print($"Zugrio EA started: {(_exec.IsLive ? "LIVE" : "demo")} account {_accountId}. " +
                  (_styles.Count == 0 ? "Decision-core styles off. " : string.Join(", ", _styles.Select(st => $"{st.Name} {st.ContextTf}/{st.LocationTf}/{st.EntryTf} on {_markets.Count(x => x.Styles.Contains(st))} markets")) + ". ") +
                  (_indexMarkets.Count == 0 ? "Index engine: no markets. " : $"Index engine on {string.Join(", ", _indexMarkets.Select(m => m.Name))}. ") +
                  $"Config {_configVersion[..12]}, engine {_engine.BundleSha256[..12]}.");
            ProtectUnprotectedOnStart();
            ReportAffordability(Server.TimeInUtc);
            foreach (var im in _indexMarkets) ReportIndexState(im, Server.TimeInUtc);
        }

        private void ResolveMarkets(IReadOnlyList<WatchItem> watch)
        {
            var brokerNames = Enumerable.Range(0, Symbols.Count).Select(i => Symbols[i]).ToList();
            var notInAStyle = new List<string>();
            foreach (var item in watch)
            {
                if (item.Class == AssetClass.Index && !IndexEngineOn) { notInAStyle.Add(item.Symbol); continue; }
                if (item.Class != AssetClass.Index && !_styles.Any(st => st.Trades(item.Class))) { notInAStyle.Add(item.Symbol); continue; }
                var name = Watchlist.Resolve(item.Symbol, brokerNames);
                Symbol? sym = name == null ? null : Symbols.GetSymbol(name);
                if (sym == null)
                {
                    var like = Watchlist.Suggest(item.Symbol, brokerNames);
                    Print($"Zugrio EA: '{Watchlist.Alternatives(item.Symbol)[0]}' is not offered by this broker under any of its names; skipped." +
                          (like.Count > 0 ? $" Similar broker symbols: {string.Join(", ", like)} (put the right one first in the watchlist entry)." : ""));
                    continue;
                }
                if (item.Class == AssetClass.Index) { AddIndexMarket(item, sym); continue; }
                var styles = _styles.Where(st => st.Trades(item.Class)).ToList();
                var m = new Market(item, sym,
                    styles.SelectMany(st => st.AllTimeframes).Distinct().ToDictionary(tf => tf, tf => MarketData.GetBars(ToTimeFrame(tf), sym.Name)), styles);
                sym.Tick += _ => m.LastTickUtc = Server.TimeInUtc;
                foreach (var st in styles) m.Bars[st.EntryTf].BarOpened += _ => OnEntryBarClosed(m, st);
                _markets.Add(m);
            }
            if (notInAStyle.Count > 0)
                Print($"Zugrio EA: {notInAStyle.Count} watchlist entries are not traded (their style is off): {string.Join(", ", notInAStyle.Select(n => Watchlist.Alternatives(n)[0]))}.");
        }

        /// <summary>Loads enough H1 history for the trend average (sessions are about 1.45 calendar days apart, plus margin).</summary>
        private void AddIndexMarket(WatchItem item, Symbol sym)
        {
            var h1 = MarketData.GetBars(TimeFrame.Hour, sym.Name);
            var from = Server.TimeInUtc.AddDays(-(_indexRule.SessionsNeeded * 1.6 + 30));
            for (var k = 0; k < 200 && h1.Count > 0 && h1.OpenTimes[0] > from; k++) if (h1.LoadMoreHistory() == 0) break;
            var im = new IndexMarket(item, sym, h1);
            sym.Tick += _ => im.LastTickUtc = Server.TimeInUtc;
            _indexMarkets.Add(im);
        }

        protected override void OnTimer()
        {
            var now = Server.TimeInUtc;
            foreach (var failed in _boundary.Tick(now))
            {
                var pos = Positions.Find(RiskReducingGate.OwnershipTagPrefix + failed.ClientOrderId);
                _log.Write(now, "protection_failed", new Dictionary<string, object?> { ["fireEventId"] = failed.FireEventId, ["positionFound"] = pos != null });
                if (pos == null) continue;
                var view = View(pos);
                var gate = RiskReducingGate.Check(view, new ClosePosition(view.PositionId), _accountId, _accountId, adapterIntegrityOk: true, brokerReachable: Server.IsConnected);
                if (gate.Allowed) Log(now, "emergency_close", _exec.Close(pos), failed.FireEventId);
                else _log.Write(now, "manual_exit_required", new Dictionary<string, object?> { ["fireEventId"] = failed.FireEventId, ["reasons"] = gate.AbortReasons });
            }
            var dayBefore = _killSwitch.DayStartEquity;
            if (_killSwitch.Update(now, Account.Equity))
                _log.Write(now, "kill_switch", new Dictionary<string, object?> { ["dayStartEquity"] = _killSwitch.DayStartEquity, ["equity"] = Account.Equity, ["limit"] = _killSwitch.LimitMoney, ["peakEquity"] = _killSwitch.PeakEquity, ["floor"] = _killSwitch.Floor });
            if (_killSwitch.DayStartEquity != dayBefore)
                _log.Write(now, "day", new Dictionary<string, object?> { ["dayStartEquity"] = _killSwitch.DayStartEquity, ["previousDayProfit"] = _killSwitch.PreviousDayProfit, ["lossLimitToday"] = _killSwitch.LimitMoney });
            if (_guard.KillSwitch != _killSwitch.Tripped)
            {
                _guard.KillSwitch = _killSwitch.Tripped;   // blocks new entries only; never blocks risk reduction (RR-3)
                Print(_killSwitch.Tripped ? "Zugrio EA: daily loss limit or profit lock reached. New entries stopped until the next UTC day." : "Zugrio EA: new UTC day. Entries resumed.");
            }
            var tier = Watchlist.TierFor(_tiers, Account.Balance);
            if (_lastTier != tier)
            {
                if (_lastTier != null) Print($"Zugrio EA: balance {Account.Balance:F2} moved to the tier from {tier.MinBalance}: up to {tier.MaxPositions} positions, {tier.MaxTotalRiskPct}% total risk.");
                _log.Write(now, "tier", new Dictionary<string, object?> { ["balance"] = Account.Balance, ["minBalance"] = tier.MinBalance, ["maxPositions"] = tier.MaxPositions, ["maxTotalRiskPct"] = tier.MaxTotalRiskPct });
                _lastTier = tier;
            }
            if (now.Date != _reportDay)
            {
                ReportAffordability(now);
                foreach (var im in _indexMarkets) ReportIndexState(im, now);
            }
            ManageOpenProfit(now);
            ManageTimeStops(now);
            if (_indexMarkets.Count > 0) RunIndexEngine(now);
            var hour = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc);
            if (_activityHour == DateTime.MinValue) _activityHour = hour;
            else if (hour > _activityHour)
            {
                Print(_markets.Count > 0
                    ? _activity.Summary(hour, Account.Balance, Account.Equity, Positions.Count(IsZugrio), tier, _killSwitch.Remaining(Account.Equity), _killSwitch.Floor)
                    : $"Zugrio EA, hour to {hour:HH:mm} UTC: index engine only ({string.Join(", ", _indexMarkets.Select(x => x.Name))}); it decides once a day at " +
                      $"{(_indexRule.Close - _indexLead):hh\\:mm} New York ({IndexEngine.DecisionUtc(NewYorkTime.FromUtc(now).Date, _indexRule, _indexLead):HH:mm} UTC today). " +
                      $"Balance {Account.Balance:F2}, equity {Account.Equity:F2}, {Positions.Count(IsZugrio)} open (max {tier.MaxPositions}). Loss still allowed today {_killSwitch.Remaining(Account.Equity):F2}.");
                Print(Scoreboard.Format(ClosedTrades(now.AddDays(-ResultsDays)), ResultsDays));
                _activity.NextHour();
                _activityHour = hour;
            }
            if (_pending.Count > 0 && now - _pendingSince >= GatherWindow) ProcessPending(now);
        }

        private void OnEntryBarClosed(Market m, TradingStyle style)
        {
            var now = Server.TimeInUtc;
            if (!m.Sym.IsTradingEnabled || !m.Sym.MarketHours.IsOpened(now)) return;
            var atr = StyleAtr(m, style);
            if (!(atr > 0)) { _log.Write(now, "scan_skipped", new Dictionary<string, object?> { ["symbol"] = m.Name, ["style"] = style.Name, ["reason"] = "ATR_UNAVAILABLE" }); return; }
            // Primary context first; routes left with "open sky" (a near-price level but no swing to
            // target) are rescanned with each fallback context, whose older swings can supply a target.
            var pending = _routes.ToList();
            foreach (var contextTf in style.ContextTimeframes)
            {
                if (pending.Count == 0) break;
                pending = ScanContext(m, style, contextTf, pending, atr, now);
            }
        }

        /// <summary>One engine call for the given routes and context timeframe. Returns the routes still in open sky.</summary>
        private List<string> ScanContext(Market m, TradingStyle style, string contextTf, IReadOnlyList<string> routes, double atr, DateTime now)
        {
            var openSky = new List<string>();
            JsonObject request;
            try { request = BuildRequest(m, style, atr, routes[0], contextTf); request["routes"] = new JsonArray(routes.Select(r => (JsonNode)JsonValue.Create(r)!).ToArray()); }
            catch (Exception e) { _log.Write(now, "scan_skipped", new Dictionary<string, object?> { ["symbol"] = m.Name, ["style"] = style.Name, ["context"] = contextTf, ["reason"] = e.Message }); return openSky; }

            JsonElement multi;
            var watch = System.Diagnostics.Stopwatch.StartNew();
            // One engine call for every route: the bars are validated and their pivots computed once.
            try { multi = JsonDocument.Parse(_engine.ScanRoutesJson(request.ToJsonString())).RootElement.Clone(); }
            catch (Exception e) { _log.Write(now, "engine_error", new Dictionary<string, object?> { ["symbol"] = m.Name, ["style"] = style.Name, ["context"] = contextTf, ["error"] = e.Message }); return openSky; }
            var seconds = watch.Elapsed.TotalSeconds / Math.Max(1, routes.Count);
            var where = style.Name == TradingStyles.Day ? m.Name : $"{m.Name} ({style.Name.ToLowerInvariant()})";

            foreach (var result in multi.GetProperty("results").EnumerateArray())
            {
                var route = result.GetProperty("route").GetString()!;
                var candidates = result.GetProperty("candidates");
                var best = result.GetProperty("best");
                var nearest = result.GetProperty("nearestLevel");
                var trend = result.GetProperty("trend").GetString();
                var sky = result.GetProperty("openSky").GetBoolean();
                if (sky) openSky.Add(route);
                double? nearestAtr = nearest.ValueKind == JsonValueKind.Object ? nearest.GetProperty("distance").GetDouble() / atr : null;
                _activity.Scanned(where, nearestAtr, seconds);
                var whyNot = result.GetProperty("notReadyableBy");
                var readyCount = candidates.EnumerateArray().Count(c => c.GetProperty("state").GetString() == "STRUCTURAL_READY");
                _activity.WhyNot(whyNot.GetProperty("pastStop").GetInt32(), whyNot.GetProperty("tooFar").GetInt32(), whyNot.GetProperty("noRunway").GetInt32(), candidates.GetArrayLength() - readyCount);
                _log.Write(now, "scan", new Dictionary<string, object?>
                {
                    ["symbol"] = m.Name, ["style"] = style.Name, ["route"] = route, ["context"] = contextTf, ["ms"] = (int)(seconds * 1000), ["trend"] = trend, ["openSky"] = sky,
                    ["evaluatedAt"] = request["evaluatedAt"]!.GetValue<string>(), ["atr"] = atr,
                    ["nearestLevelAtr"] = nearestAtr is double d ? Math.Round(d, 2) : null, ["candidates"] = candidates.GetArrayLength(),
                    ["notReadyable"] = result.GetProperty("skippedNotReadyable").GetInt32(), ["why"] = whyNot.GetRawText(), ["ready"] = readyCount,
                    ["best"] = best.ValueKind == JsonValueKind.Null ? null : best.GetRawText(), ["engineErrors"] = result.GetProperty("errors").GetArrayLength(),
                });
                if (best.ValueKind != JsonValueKind.Null) Evaluate(m, style, best, atr, now, route, contextTf, trend);
            }
            return openSky;
        }

        /// <summary>Per-market checks and sizing. A setup that passes waits for the gather window, then competes with other markets.</summary>
        private void Evaluate(Market m, TradingStyle style, JsonElement best, double atr, DateTime now, string route, string contextTf, string? trend)
        {
            var opportunityId = best.GetProperty("opportunityId").GetString()!;
            var g = best.GetProperty("geometry");
            var frozenAt = g.GetProperty("frozenAt").GetString()!;
            var fireEventId = "fire:" + Sha(opportunityId + "|" + frozenAt)[..32];
            if (_boundary.Get(_accountId, fireEventId) != null || _pending.Any(p => p.FireEventId == fireEventId)) return;
            var label = LabelFor(fireEventId);
            // The label is derived from the setup, so the broker's own records show whether this
            // setup was already traded, even after a cloud restart wiped the journal.
            if (Positions.Find(label) != null || History.FindLast(label) != null) return;
            if (_activity.SetupFound(fireEventId, style.Name == TradingStyles.Scalp))
            {
                var gg = best.GetProperty("geometry");
                Print($"Zugrio EA: SETUP {best.GetProperty("side").GetString()} {m.Name} ({(style.Name == TradingStyles.Scalp ? "scalp, " : "")}{(route == "CONTINUATION_RETEST" ? "break and retest" : "reclaim")}, {contextTf} trend {trend}): " +
                      $"entry ~{gg.GetProperty("entryReference").GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture)}, stop {Math.Round(gg.GetProperty("childInvalidation").GetDouble(), m.Sym.Digits).ToString(System.Globalization.CultureInfo.InvariantCulture)}, target {gg.GetProperty("objective").GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture)}.");
            }

            var setupSide = best.GetProperty("side").GetString() == "BUY" ? Side.Buy : Side.Sell;
            if (TrendFilterOn && !TrendFilter.Allows(setupSide, trend, route, TrendFilterOnReclaims, NoCounterTrendReclaims))
            {
                var counter = route == "REVERSAL_RECLAIM" && !TrendFilterOnReclaims;
                Skip(now, m, fireEventId, counter ? "COUNTER_TREND_RECLAIM" : "TREND_NOT_ALIGNED", new() { ["style"] = style.Name, ["context"] = contextTf, ["trend"] = trend, ["route"] = route }); return;
            }

            if (Account.Balance < m.Item.UnlockBalance)
            { Skip(now, m, fireEventId, "LOCKED_UNTIL_BALANCE", new() { ["unlockBalance"] = m.Item.UnlockBalance, ["balance"] = Account.Balance }); return; }

            var side = best.GetProperty("side").GetString() == "BUY" ? Side.Buy : Side.Sell;
            var stop = g.GetProperty("childInvalidation").GetDouble();
            var target = g.GetProperty("objective").GetDouble();
            var entryRef = g.GetProperty("entryReference").GetDouble();
            var price = side == Side.Buy ? m.Sym.Ask : m.Sym.Bid;
            if (!EntrySide.PriceBetweenStopAndTarget(side == Side.Buy, price, stop, target))
            { Skip(now, m, fireEventId, "PRICE_NOT_BETWEEN_STOP_AND_TARGET", new() { ["price"] = price, ["stop"] = stop, ["target"] = target }); return; }
            var stopDistance = Math.Abs(price - stop);
            if (!ExitPlan.StopFarEnough(price, stop, atr, MinStopAtr))
            { Skip(now, m, fireEventId, "STOP_TOO_CLOSE", new() { ["style"] = style.Name, ["stopDistance"] = stopDistance, ["minStop"] = MinStopAtr * atr }); return; }
            if (!ExitPlan.RewardRoom(price, stop, target, style.TargetR))
            { Skip(now, m, fireEventId, "TARGET_TOO_CLOSE", new() { ["style"] = style.Name, ["target"] = target, ["targetR"] = style.TargetR }); return; }
            var spread = m.Sym.Ask - m.Sym.Bid;
            if (spread > MaxSpreadShareOfStop * stopDistance)
            { Skip(now, m, fireEventId, "SPREAD_TOO_WIDE_FOR_STOP", new() { ["spread"] = spread, ["stopDistance"] = stopDistance }); return; }

            var size = SizeFor(m.Sym, price, stop);
            if (!size.Trade) { Skip(now, m, fireEventId, size.Reason, new() { ["riskPctAtMinimum"] = size.RiskPctActual }); return; }

            if (_pending.Count == 0) _pendingSince = now;
            _pending.Add(new Pending(m, style, route, opportunityId, fireEventId, side, entryRef, stop, target,
                new ReadyCandidate(m.Name, m.Item.Class, DateTimeOffset.Parse(frozenAt, System.Globalization.CultureInfo.InvariantCulture), opportunityId, size.RiskMoney, size.RiskPctActual)));
        }

        private void ProcessPending(DateTime now)
        {
            var batch = _pending.ToList();
            _pending.Clear();
            var tier = Watchlist.TierFor(_tiers, Account.Balance);
            var selection = PortfolioSelector.Select(batch.Select(p => p.Candidate), OpenExposures(), tier, Account.Balance, _killSwitch.Remaining(Account.Equity));
            foreach (var (c, reason) in selection.Skipped)
            {
                var p = batch.First(x => ReferenceEquals(x.Candidate, c));
                Skip(now, p.M, p.FireEventId, reason, new() { ["tierMinBalance"] = tier.MinBalance, ["riskMoney"] = c.RiskMoney });
            }
            foreach (var c in selection.Take) Enter(batch.First(x => ReferenceEquals(x.Candidate, c)), now);
        }

        private void Enter(Pending p, DateTime now)
        {
            var m = p.M;
            var price = p.Side == Side.Buy ? m.Sym.Ask : m.Sym.Bid;
            if (!EntrySide.PriceBetweenStopAndTarget(p.Side == Side.Buy, price, p.Stop, p.Target))
            { Skip(now, m, p.FireEventId, "PRICE_NOT_BETWEEN_STOP_AND_TARGET", new() { ["price"] = price }); return; }
            var size = SizeFor(m.Sym, price, p.Stop);   // re-size at the current price
            if (!size.Trade) { Skip(now, m, p.FireEventId, size.Reason, new() { ["riskPctAtMinimum"] = size.RiskPctActual }); return; }

            var atr = StyleAtr(m, p.Style);
            if (!(atr > 0)) { Skip(now, m, p.FireEventId, "ATR_UNAVAILABLE"); return; }
            if (!ExitPlan.StopFarEnough(price, p.Stop, atr, MinStopAtr)) { Skip(now, m, p.FireEventId, "STOP_TOO_CLOSE", new() { ["price"] = price }); return; }
            // The style's take-profit: the engine objective, or nearer at TargetR x risk (scalps).
            var target = ExitPlan.Target(p.Side == Side.Buy, price, p.Stop, p.Target, p.Style.TargetR);
            var chase = MaxChaseAtr * atr;
            var limit = Math.Round(p.Side == Side.Buy ? p.EntryRef + chase : p.EntryRef - chase, m.Sym.Digits);
            Submit(new EntryOrder(m.Sym, m.Item.Class, m.LastTickUtc, p.Style.Name, p.Route, p.FireEventId, p.OpportunityId, p.Side, price, p.Stop, target, limit, size, atr,
                new Dictionary<string, object?> { ["engineStop"] = p.Stop, ["engineTarget"] = p.Target, ["entryReference"] = p.EntryRef }), now);
        }

        /// <summary>An entry that passed its engine's own checks and sizing: what the signed instruction carries.</summary>
        private sealed record EntryOrder(Symbol Sym, AssetClass Class, DateTime LastTickUtc, string Style, string? Route, string FireEventId, string OpportunityId,
            Side Side, double Price, double Stop, double Target, double Limit, SizingResult Size, double Atr, Dictionary<string, object?> Extra);

        /// <summary>
        /// Every entry, from either engine, goes through here: signed in-process instruction, abort-only guards,
        /// journalled boundary, one market order with stop and target, then protection confirmation (SB-11).
        /// Returns true when a position was opened.
        /// </summary>
        private bool Submit(EntryOrder o, DateTime now)
        {
            var name = o.Sym.Name;
            var entryIntentId = "intent:" + o.FireEventId;
            var coid = ClientOrderId.Derive(_accountId, _venue, o.FireEventId, entryIntentId, CoidLength);
            var label = RiskReducingGate.OwnershipTagPrefix + coid;
            var unsigned = new JsonObject
            {
                ["schema"] = ExecutionInstruction.Schema,
                ["submissionEnvelope"] = new JsonObject
                {
                    ["submissionEnvelopeId"] = "env:" + o.FireEventId, ["entryIntentId"] = entryIntentId, ["fireEventId"] = o.FireEventId,
                    ["accountId"] = _accountId, ["brokerVenueId"] = _venue, ["clientOrderId"] = coid,
                    ["adverseExecutionPriceLimit"] = (decimal)o.Limit, ["brokerExecutionPolicyHash"] = _configVersion, ["preparedAt"] = Timeframes.Iso(now),
                },
                ["entryIntent"] = new JsonObject
                {
                    ["entryIntentId"] = entryIntentId, ["instrument"] = name, ["side"] = o.Side == Side.Buy ? "BUY" : "SELL", ["volumeUnits"] = o.Size.Units,
                    ["stopLossPrice"] = (decimal)Math.Round(o.Stop, o.Sym.Digits), ["takeProfitPrice"] = (decimal)Math.Round(o.Target, o.Sym.Digits),
                },
                ["executionAuthorityManifestHash"] = _engine.BundleSha256,
                ["expiresAt"] = Timeframes.Iso(now.AddMinutes(1)),
            };
            ExecutionInstruction instruction;
            try { instruction = ExecutionInstruction.Parse(Sign(unsigned).ToJsonString(), CoidLength); }
            catch (ContractException e) { Skip(now, name, o.FireEventId, "CONTRACT: " + e.Message); return false; }

            var snapshot = new BrokerSafetySnapshot(_accountId, _venue, Account.IsLive, Server.IsConnected, (decimal)o.Sym.Bid, (decimal)o.Sym.Ask,
                new DateTimeOffset(DateTime.SpecifyKind(o.LastTickUtc, DateTimeKind.Utc)), Server.TimeInUtc - DateTime.UtcNow, new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)));
            var check = _guard.Check(instruction, snapshot, _boundary);
            if (!check.Allowed) { Skip(now, name, o.FireEventId, "GUARD", new() { ["reasons"] = check.AbortReasons }); return false; }

            _boundary.Reserve(_accountId, o.FireEventId, coid, name, now);
            _boundary.MarkSubmitted(_accountId, o.FireEventId, now);
            var slPips = Math.Abs(o.Price - o.Stop) / o.Sym.PipSize;
            var tpPips = Math.Abs(o.Target - o.Price) / o.Sym.PipSize;
            var comment = TradingStyles.WithStyle(Comment(o.OpportunityId), o.Style);
            if (o.Route != null) comment = TradingStyles.WithRoute(comment, o.Route);
            TradeResult r;
            try { r = _exec.MarketOrder(o.Side == Side.Buy ? TradeType.Buy : TradeType.Sell, name, o.Size.Units, label, slPips, tpPips,
                    ProtectionManager.WithInitialStop(comment, Math.Round(o.Stop, o.Sym.Digits))); }
            catch (Exception e)
            {
                _boundary.OnSubmissionUnknown(_accountId, o.FireEventId, now);
                var found = Positions.Find(label, name);
                _boundary.ResolveUnknown(_accountId, o.FireEventId, found != null, found == null ? 0 : (long)found.VolumeInUnits, Server.TimeInUtc);
                _log.Write(now, "submission_unknown", new Dictionary<string, object?> { ["symbol"] = name, ["fireEventId"] = o.FireEventId, ["error"] = e.Message, ["reconciledPresent"] = found != null });
                if (found != null) ConfirmProtection(o.Sym, found, o.FireEventId, o.Stop, o.Target);
                return found != null;
            }
            if (!r.IsSuccessful)
            {
                _boundary.OnRejected(_accountId, o.FireEventId, now);
                Log(now, "order_rejected", r, o.FireEventId);
                return false;
            }
            _boundary.OnAcknowledged(_accountId, o.FireEventId, now);
            _boundary.OnFilled(_accountId, o.FireEventId, (long)r.Position.VolumeInUnits, now);
            var record = new Dictionary<string, object?>
            {
                ["symbol"] = name, ["class"] = o.Class.ToString(), ["style"] = o.Style, ["fireEventId"] = o.FireEventId, ["opportunityId"] = o.OpportunityId,
                ["side"] = o.Side.ToString(), ["units"] = o.Size.Units, ["riskMoney"] = o.Size.RiskMoney, ["riskPct"] = o.Size.RiskPctActual, ["sizingReason"] = o.Size.Reason,
                ["route"] = o.Route, ["price"] = o.Price, ["fill"] = r.Position.EntryPrice, ["stop"] = o.Stop, ["target"] = o.Target,
                ["brokerStop"] = r.Position.StopLoss, ["brokerTarget"] = r.Position.TakeProfit, ["label"] = label, ["atr"] = o.Atr,
            };
            foreach (var kv in o.Extra) record[kv.Key] = kv.Value;
            _log.Write(now, "entry", record);
            _activity.Entered(o.Style == TradingStyles.Scalp);
            var tag = o.Style == TradingStyles.Scalp ? " (scalp)" : o.Style == TradingStyles.Index ? " (index)" : "";
            Print($"Zugrio EA: TRADE OPENED {o.Side.ToString().ToUpperInvariant()} {name}{tag} {r.Position.Quantity.ToString(System.Globalization.CultureInfo.InvariantCulture)} lots at {r.Position.EntryPrice.ToString(System.Globalization.CultureInfo.InvariantCulture)}, " +
                  $"stop {r.Position.StopLoss?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "none"}, target {r.Position.TakeProfit?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "none"}, risk {o.Size.RiskMoney:F2} ({o.Size.RiskPctActual:F1}%).");
            ConfirmProtection(o.Sym, r.Position, o.FireEventId, o.Stop, o.Target);
            return true;
        }

        /// <summary>
        /// Moves the broker stop to the engine's exact stop only when that is RISK_REDUCING,
        /// or attaches it when missing. Then confirms protection (SB-11).
        /// </summary>
        private void ConfirmProtection(Symbol sym, Position pos, string fireEventId, double stop, double target)
        {
            var now = Server.TimeInUtc;
            var view = View(pos);
            var effect = OrderClassifier.Classify(view, new SetStopLoss(view.PositionId, (decimal)Math.Round(stop, sym.Digits)));
            if (pos.StopLoss == null || effect == RiskEffect.RiskReducing)
            {
                var r = _exec.SetProtection(pos, Math.Round(stop, sym.Digits), Math.Round(target, sym.Digits));
                Log(now, "set_protection", r, fireEventId);
                if (r.IsSuccessful) pos = r.Position;
            }
            if (pos.StopLoss != null) _boundary.OnProtectionConfirmed(_accountId, fireEventId, now);
        }

        /// <summary>
        /// Anti round-trip, in the ATR and bars of the trade's own style: moves each open Zugrio stop to break-even at +1R, keeps at least half of the
        /// best open profit from there, and trails it from +1.5R (ProtectionManager). Only ever tightens: every change is checked RISK_REDUCING first.
        /// The initial stop comes from the broker comment, so this works after a cloud restart.
        /// </summary>
        private void ManageOpenProfit(DateTime now)
        {
            foreach (var pos in Positions.Where(p => IsZugrio(p) && p.StopLoss.HasValue).ToList())
            {
                if (TradingStyles.FromComment(pos.Comment) == TradingStyles.Index) continue;   // the index rule exits on its own close rule, as tested
                if (_lastTrail.TryGetValue(pos.Id, out var last) && now - last < TrailInterval) continue;
                _lastTrail[pos.Id] = now;
                var m = _markets.FirstOrDefault(x => x.Name == pos.SymbolName);
                var initialStop = ProtectionManager.InitialStopFrom(pos.Comment);
                if (m == null || initialStop == null) continue;
                var style = ManagingStyle(m, pos);
                var atr = StyleAtr(m, style);
                if (!(atr > 0)) continue;
                var buy = pos.TradeType == TradeType.Buy;
                var best = buy ? m.Sym.Bid : m.Sym.Ask;
                var entryBars = m.Bars[style.EntryTf];
                // Only bars that opened after the fill: the fill bar's earlier range is not this trade's profit.
                for (var i = entryBars.Count - 1; i >= 0 && entryBars[i].OpenTime >= pos.EntryTime; i--)
                    best = buy ? Math.Max(best, entryBars[i].High) : Math.Min(best, entryBars[i].Low);
                var exit = buy ? m.Sym.Bid : m.Sym.Ask;
                var proposal = ProtectionManager.Propose(buy, pos.EntryPrice, initialStop.Value, pos.StopLoss!.Value, best, exit, atr, _trail);
                if (proposal == null) continue;
                var newStop = Math.Round(proposal.Value, m.Sym.Digits);
                var view = View(pos);
                if (OrderClassifier.Classify(view, new SetStopLoss(view.PositionId, (decimal)newStop)) != RiskEffect.RiskReducing) continue;
                var gate = RiskReducingGate.Check(view, new SetStopLoss(view.PositionId, (decimal)newStop), _accountId, _accountId, adapterIntegrityOk: true, brokerReachable: Server.IsConnected);
                if (!gate.Allowed) continue;
                var r = _exec.SetProtection(pos, newStop, pos.TakeProfit);
                _log.Write(now, "protect_profit", new Dictionary<string, object?>
                {
                    ["symbol"] = pos.SymbolName, ["style"] = style.Name, ["label"] = pos.Label, ["from"] = view.StopLoss, ["to"] = newStop, ["best"] = best, ["entry"] = pos.EntryPrice,
                    ["initialStop"] = initialStop, ["atr"] = atr, ["ok"] = r.IsSuccessful, ["error"] = r.Error?.ToString(),
                });
                if (r.IsSuccessful)
                    Print($"Zugrio EA: stop on {pos.SymbolName} moved {view.StopLoss} -> {newStop.ToString(System.Globalization.CultureInfo.InvariantCulture)} " +
                          $"({((buy ? newStop >= pos.EntryPrice : newStop <= pos.EntryPrice) ? "profit locked" : "risk reduced")}).");
            }
        }

        /// <summary>
        /// Time stop: a trade of a style with MaxMinutes (scalps) still open after that long is closed,
        /// through the risk-reducing gate. A failed close is retried every 30 s.
        /// </summary>
        private void ManageTimeStops(DateTime now)
        {
            foreach (var pos in Positions.Where(IsZugrio).ToList())
            {
                if (!_styleDefs.TryGetValue(TradingStyles.FromComment(pos.Comment), out var style)) continue;
                if (!ExitPlan.TimeUp(pos.EntryTime, now, style.MaxMinutes)) continue;
                if (_timeStopTried.TryGetValue(pos.Id, out var tried) && now - tried < TimeSpan.FromSeconds(30)) continue;
                _timeStopTried[pos.Id] = now;
                var view = View(pos);
                var gate = RiskReducingGate.Check(view, new ClosePosition(view.PositionId), _accountId, _accountId, adapterIntegrityOk: true, brokerReachable: Server.IsConnected);
                if (!gate.Allowed) { _log.Write(now, "time_stop_blocked", new Dictionary<string, object?> { ["label"] = pos.Label, ["reasons"] = gate.AbortReasons }); continue; }
                var pl = pos.NetProfit;
                var r = _exec.Close(pos);
                _log.Write(now, "time_stop", new Dictionary<string, object?> { ["symbol"] = pos.SymbolName, ["style"] = style.Name, ["label"] = pos.Label, ["minutes"] = style.MaxMinutes, ["netProfit"] = pl, ["ok"] = r.IsSuccessful, ["error"] = r.Error?.ToString() });
                if (r.IsSuccessful) Print($"Zugrio EA: closed {pos.SymbolName} ({style.Name.ToLowerInvariant()}) after {style.MaxMinutes:0} min without reaching stop or target.");
            }
        }

        /// <summary>Net profit over the trade's initial risk (from the "sl=" comment and the symbol's tick value); NaN if unknown.</summary>
        private double RMultiple(string symbolName, string? comment, double entry, double units, double netProfit)
        {
            var sl = ProtectionManager.InitialStopFrom(comment);
            var sym = Symbols.GetSymbol(symbolName);
            if (sl == null || sym == null || !(sym.TickSize > 0)) return double.NaN;
            var risk = Math.Abs(entry - sl.Value) / sym.TickSize * sym.TickValue * units;
            return risk > 0 ? netProfit / risk : double.NaN;
        }

        /// <summary>Zugrio trades closed since the given time, from the broker's history (survives restarts).</summary>
        private IReadOnlyCollection<ClosedTrade> ClosedTrades(DateTime sinceUtc) =>
            History.Where(t => t.ClosingTime >= sinceUtc && (t.Label ?? "").StartsWith(RiskReducingGate.OwnershipTagPrefix, StringComparison.Ordinal))
                .Select(t => new ClosedTrade(TradingStyles.FromComment(t.Comment), TradingStyles.RouteFromComment(t.Comment), t.SymbolName, t.NetProfit,
                    RMultiple(t.SymbolName, t.Comment, t.EntryPrice, t.VolumeInUnits, t.NetProfit), (t.ClosingTime - t.EntryTime).TotalMinutes))
                .ToList();

        /// <summary>Sized at RiskPct, or smaller to fit the loss still allowed today after open risk (never larger).</summary>
        private SizingResult SizeFor(Symbol sym, double price, double stop) =>
            Sizing.Compute(new SizingInput(Account.Balance, RiskPct, MaxRiskPctAtMinVolume, price, stop, sym.TickSize, sym.TickValue,
                sym.VolumeInUnitsMin, sym.VolumeInUnitsStep, sym.VolumeInUnitsMax, MaxUnits,
                RiskMoneyCap: _killSwitch.Remaining(Account.Equity) - OpenExposures().Sum(e => e.RiskMoney)));

        /// <summary>Open Zugrio positions and the money each can still lose from here to its stop (unbounded without a stop).</summary>
        private IReadOnlyList<OpenExposure> OpenExposures() =>
            Positions.Where(IsZugrio).Select(p =>
            {
                var sym = Symbols.GetSymbol(p.SymbolName);
                var cls = _markets.FirstOrDefault(x => x.Name == p.SymbolName)?.Item.Class
                    ?? (_indexMarkets.Any(x => x.Name == p.SymbolName) ? AssetClass.Index : AssetClass.Synthetic);
                var risk = p.StopLoss == null || sym == null
                    ? double.PositiveInfinity
                    // From the current exit price to the stop: any loss so far is already in equity.
                    : Math.Max(0, (p.TradeType == TradeType.Buy ? sym.Bid - p.StopLoss.Value : p.StopLoss.Value - sym.Ask)) / sym.TickSize * sym.TickValue * p.VolumeInUnits;
                return new OpenExposure(p.SymbolName, cls, risk);
            }).ToList();

        /// <summary>
        /// Once a day: what each market costs at the broker's minimum volume for a typical stop,
        /// and so the smallest balance that can trade it. This is the live answer to "which
        /// markets suit this account", from the broker's own contract data.
        /// </summary>
        private void ReportAffordability(DateTime now)
        {
            _reportDay = now.Date;
            // Typical stop: decision-core styles, the model stop plus half the chase; index engine, its ATR stop.
            var sources = _markets.Select(m => (m.Name, m.Item, m.Sym, stop: (StopAtr + 0.5 * MaxChaseAtr) * StyleAtr(m, m.Styles[0])))
                .Concat(_indexMarkets.Select(im => (im.Name, im.Item, im.Sym, stop: _indexRule.StopAtr * IndexEngine.SessionAtr(IndexSessions(im, now), _indexRule.AtrPeriod))));
            var rows = sources.Select(x => (x.Name, x.Item, a: AffordabilityCalc.Compute(x.Name, x.Sym.VolumeInUnitsMin, x.Sym.TickSize, x.Sym.TickValue, x.stop, x.Sym.Ask - x.Sym.Bid, MaxRiskPctAtMinVolume)))
                .OrderBy(x => double.IsNaN(x.a.MinBalanceForCap) ? double.MaxValue : x.a.MinBalanceForCap).ToList();
            foreach (var (name, item, a) in rows)
            {
                _log.Write(now, "affordability", new Dictionary<string, object?>
                {
                    ["symbol"] = name, ["class"] = item.Class.ToString(), ["unlockBalance"] = item.UnlockBalance, ["minUnits"] = a.MinUnits,
                    ["typicalStop"] = a.TypicalStopDistance, ["riskAtMinimum"] = a.RiskAtMinimum, ["minBalanceForCap"] = a.MinBalanceForCap,
                    ["spreadShareOfStop"] = a.SpreadShareOfStop, ["affordableNow"] = a.MinBalanceForCap <= Account.Balance && Account.Balance >= item.UnlockBalance,
                });
            }
            Print("Zugrio EA markets by smallest tradable balance: " + string.Join(", ", rows.Select(x =>
                $"{x.Name} {(double.IsNaN(x.a.MinBalanceForCap) ? "n/a" : x.a.MinBalanceForCap.ToString("F0", System.Globalization.CultureInfo.InvariantCulture))}" +
                (Account.Balance < x.Item.UnlockBalance ? $" (unlocks at {x.Item.UnlockBalance})" : ""))));
        }

        /// <summary>
        /// The index engine: once per New York trading day per market, at the cash close minus the lead time. In a
        /// position it may exit (risk reducing, through the gate); flat it may enter (through Submit, like every entry).
        /// </summary>
        private void RunIndexEngine(DateTime now)
        {
            var today = NewYorkTime.FromUtc(now).Date;
            if (today.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) return;
            var at = IndexEngine.DecisionUtc(today, _indexRule, _indexLead);
            if (now < at || now >= at + IndexDecisionWindow) return;
            foreach (var im in _indexMarkets.Where(x => x.DecidedDate != today && now >= x.RetryAt))
            {
                im.DecidedDate = today;
                try { DecideIndex(im, now, today); }
                catch (Exception e)
                {
                    _log.Write(now, "index_error", new Dictionary<string, object?> { ["symbol"] = im.Name, ["error"] = e.Message });
                    Print($"Zugrio Index: {im.Name}: {e.Message}");
                }
            }
        }

        /// <summary>New York cash sessions from the market's H1 bars up to now (today's close is the latest price).</summary>
        private IReadOnlyList<SessionBar> IndexSessions(IndexMarket im, DateTime now)
        {
            var b = im.H1; var list = new List<HourBar>(b.Count);
            for (var i = 0; i < b.Count; i++)
                if (b.OpenTimes[i] <= now) list.Add(new HourBar(DateTime.SpecifyKind(b.OpenTimes[i], DateTimeKind.Utc), b.OpenPrices[i], b.HighPrices[i], b.LowPrices[i], b.ClosePrices[i]));
            return IndexEngine.Sessions(list, _indexRule);
        }

        private Position? IndexPosition(IndexMarket im) =>
            Positions.FirstOrDefault(p => IsZugrio(p) && p.SymbolName == im.Name && TradingStyles.FromComment(p.Comment) == TradingStyles.Index);

        private void DecideIndex(IndexMarket im, DateTime now, DateTime today)
        {
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            if (!im.Sym.IsTradingEnabled || !im.Sym.MarketHours.IsOpened(now))
            {
                _log.Write(now, "index_decision", new Dictionary<string, object?> { ["symbol"] = im.Name, ["date"] = today.ToString("yyyy-MM-dd", ci), ["action"] = "None", ["reason"] = "MARKET_CLOSED" });
                Print($"Zugrio Index: {im.Name} {today:yyyy-MM-dd}: market closed at decision time; nothing to do today.");
                return;
            }
            var sessions = IndexSessions(im, now);
            var pos = IndexPosition(im);
            var enteredToday = pos != null && NewYorkTime.FromUtc(pos.EntryTime).Date == today;
            var closedToday = History.Any(t => t.SymbolName == im.Name && (t.Label ?? "").StartsWith(RiskReducingGate.OwnershipTagPrefix, StringComparison.Ordinal)
                && TradingStyles.FromComment(t.Comment) == TradingStyles.Index && NewYorkTime.FromUtc(t.ClosingTime).Date == today);
            var d = IndexEngine.Decide(sessions, today, pos != null, enteredToday, closedToday, _indexRule);
            _log.Write(now, "index_decision", new Dictionary<string, object?>
            {
                ["symbol"] = im.Name, ["date"] = today.ToString("yyyy-MM-dd", ci), ["action"] = d.Action.ToString(), ["reason"] = d.Reason, ["sessions"] = d.Sessions,
                ["close"] = d.Close, ["trendAverage"] = d.TrendAverage, ["exitAverage"] = d.ExitAverage, ["atr"] = d.Atr, ["lowerRun"] = d.LowerRun, ["inPosition"] = pos != null,
            });
            Print($"Zugrio Index: {im.Name} {today:yyyy-MM-dd}: {IndexStateText(d)} -> " + d.Action switch
            {
                IndexAction.Enter => "BUY.",
                IndexAction.Exit => "SELL (close above the exit average).",
                IndexAction.Hold => "hold the open trade.",
                _ => IndexReasonText(d.Reason) + ".",
            });
            if (d.Action == IndexAction.Exit && pos != null) ExitIndex(im, pos, now);
            else if (d.Action == IndexAction.Enter) EnterIndex(im, d, now, today);
        }

        private string IndexStateText(IndexDecision d)
        {
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            if (double.IsNaN(d.Close)) return $"{d.Sessions} sessions of history";
            if (double.IsNaN(d.TrendAverage)) return $"close {d.Close.ToString("G7", ci)}, {d.Sessions} sessions of history (needs {_indexRule.SessionsNeeded})";
            return $"close {d.Close.ToString("G7", ci)}, {d.LowerRun} lower close{(d.LowerRun == 1 ? "" : "s")} in a row (buys at {_indexRule.LowerCloses}), " +
                   $"{(d.Close > d.TrendAverage ? "above" : "below")} the {_indexRule.TrendSma}-session average {d.TrendAverage.ToString("G7", ci)}, " +
                   $"{_indexRule.ExitSma}-session average {d.ExitAverage.ToString("G7", ci)}, session ATR {d.Atr.ToString("G5", ci)}";
        }

        private static string IndexReasonText(string reason) => reason switch
        {
            "NO_SESSION_TODAY" => "no session today (holiday or half day)",
            "NOT_ENOUGH_HISTORY" => "not enough history yet",
            "ALREADY_TRADED_TODAY" => "already traded today",
            "ATR_UNAVAILABLE" => "not enough price history",
            "BELOW_TREND_AVERAGE" => "no buy: below the trend average",
            "NOT_ENOUGH_LOWER_CLOSES" => "no buy signal today",
            _ => reason.ToLowerInvariant().Replace('_', ' '),
        };

        /// <summary>On start and once a day: the index engine's view of each market, so the owner can see it is ready and when it decides.</summary>
        private void ReportIndexState(IndexMarket im, DateTime now)
        {
            var today = NewYorkTime.FromUtc(now).Date;
            var sessions = IndexSessions(im, now);
            var pos = IndexPosition(im);
            var lastDate = sessions.Count > 0 ? sessions[^1].Date : today;
            var d = IndexEngine.Decide(sessions, lastDate, pos != null, false, false, _indexRule);
            var next = today; DateTime at;
            while ((at = IndexEngine.DecisionUtc(next, _indexRule, _indexLead)) + IndexDecisionWindow <= now || next.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) next = next.AddDays(1);
            Print($"Zugrio Index: {im.Name}: {IndexStateText(d)}{(sessions.Count > 0 ? $" (last session {lastDate:yyyy-MM-dd}{(lastDate == today && now < IndexEngine.DecisionUtc(today, _indexRule, TimeSpan.Zero) ? ", so far" : "")})" : "")}. " +
                  $"{(pos != null ? "In a trade. " : "")}Next decision {next:ddd yyyy-MM-dd} {(_indexRule.Close - _indexLead):hh\\:mm} New York ({at:HH:mm} UTC).");
        }

        private void EnterIndex(IndexMarket im, IndexDecision d, DateTime now, DateTime today)
        {
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            var fireEventId = "fire:" + Sha($"index|{im.Name}|{today.ToString("yyyy-MM-dd", ci)}")[..32];
            var opportunityId = $"index:{im.Name}:{today.ToString("yyyy-MM-dd", ci)}";
            if (_boundary.Get(_accountId, fireEventId) != null) return;
            // The label is derived from the market and the date, so the broker's records show a day already traded, even after a cloud restart.
            var label = LabelFor(fireEventId);
            if (Positions.Find(label) != null || History.FindLast(label) != null) return;
            _activity.SetupFound(fireEventId);
            if (Account.Balance < im.Item.UnlockBalance)
            { Skip(now, im.Name, fireEventId, "LOCKED_UNTIL_BALANCE", new() { ["unlockBalance"] = im.Item.UnlockBalance, ["balance"] = Account.Balance }); return; }
            var price = im.Sym.Ask;
            var stop = price - d.StopDistance(_indexRule);
            var target = price + d.TargetDistance(_indexRule);
            var spread = im.Sym.Ask - im.Sym.Bid;
            if (spread > MaxSpreadShareOfStop * (price - stop))
            { Skip(now, im.Name, fireEventId, "SPREAD_TOO_WIDE_FOR_STOP", new() { ["spread"] = spread, ["stopDistance"] = price - stop }); return; }
            var size = SizeFor(im.Sym, price, stop);
            if (!size.Trade) { Skip(now, im.Name, fireEventId, size.Reason, new() { ["riskPctAtMinimum"] = size.RiskPctActual }); return; }
            var tier = Watchlist.TierFor(_tiers, Account.Balance);
            var candidate = new ReadyCandidate(im.Name, AssetClass.Index, new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)), opportunityId, size.RiskMoney, size.RiskPctActual);
            var selection = PortfolioSelector.Select(new[] { candidate }, OpenExposures(), tier, Account.Balance, _killSwitch.Remaining(Account.Equity));
            if (selection.Take.Count == 0)
            { Skip(now, im.Name, fireEventId, selection.Skipped[0].Reason, new() { ["tierMinBalance"] = tier.MinBalance, ["riskMoney"] = size.RiskMoney }); return; }
            // Adverse price limit: the ask may move a quarter of a session ATR before the order (research value).
            var limit = Math.Round(price + IndexChaseAtr * d.Atr, im.Sym.Digits);
            Submit(new EntryOrder(im.Sym, AssetClass.Index, im.LastTickUtc, TradingStyles.Index, null, fireEventId, opportunityId, Side.Buy, price, stop, target, limit, size, d.Atr,
                new Dictionary<string, object?> { ["sessionClose"] = d.Close, ["trendAverage"] = d.TrendAverage, ["exitAverage"] = d.ExitAverage, ["lowerRun"] = d.LowerRun, ["sessions"] = d.Sessions }), now);
        }

        /// <summary>The index exit: a close of the whole position, which is always risk reducing, through the gate. A failed close is retried after 30 s.</summary>
        private void ExitIndex(IndexMarket im, Position pos, DateTime now)
        {
            var view = View(pos);
            var gate = RiskReducingGate.Check(view, new ClosePosition(view.PositionId), _accountId, _accountId, adapterIntegrityOk: true, brokerReachable: Server.IsConnected);
            if (!gate.Allowed) { _log.Write(now, "index_exit_blocked", new Dictionary<string, object?> { ["label"] = pos.Label, ["reasons"] = gate.AbortReasons }); RetryIndex(im, now); return; }
            var pl = pos.NetProfit;
            var r = _exec.Close(pos);
            _log.Write(now, "index_exit", new Dictionary<string, object?> { ["symbol"] = im.Name, ["label"] = pos.Label, ["netProfit"] = pl, ["ok"] = r.IsSuccessful, ["error"] = r.Error?.ToString() });
            if (!r.IsSuccessful) RetryIndex(im, now);
        }

        private static void RetryIndex(IndexMarket im, DateTime now) { im.DecidedDate = DateTime.MinValue; im.RetryAt = now.AddSeconds(30); }

        /// <summary>ATR on the style's location timeframe, from closed bars.</summary>
        private double StyleAtr(Market m, TradingStyle style)
        {
            var loc = m.Bars[style.LocationTf];
            var closed = loc.Count - 1;   // the last bar is still forming
            var bars = new List<(double, double, double)>();
            for (var i = Math.Max(0, closed - AtrPeriod - 1); i < closed; i++) bars.Add((loc[i].High, loc[i].Low, loc[i].Close));
            return Atr.Compute(bars, AtrPeriod);
        }

        /// <summary>
        /// The style a trade was opened under (from its broker comment; older trades are DAY).
        /// If this market no longer loads that style's bars (style switched off), the market's first style manages it.
        /// </summary>
        private TradingStyle ManagingStyle(Market m, Position pos) =>
            _styleDefs.TryGetValue(TradingStyles.FromComment(pos.Comment), out var st) && m.Has(st) ? st : m.Styles[0];

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            var p = args.Position;
            _lastTrail.Remove(p.Id);
            _timeStopTried.Remove(p.Id);
            if (!IsZugrio(p)) return;
            var style = TradingStyles.FromComment(p.Comment);
            var route = TradingStyles.RouteFromComment(p.Comment);
            var r = RMultiple(p.SymbolName, p.Comment, p.EntryPrice, p.VolumeInUnits, p.NetProfit);
            var minutes = (Server.TimeInUtc - p.EntryTime).TotalMinutes;
            _log.Write(Server.TimeInUtc, "close", new Dictionary<string, object?>
            {
                ["symbol"] = p.SymbolName, ["style"] = style, ["route"] = route, ["label"] = p.Label, ["reason"] = args.Reason.ToString(), ["side"] = p.TradeType.ToString(), ["units"] = p.VolumeInUnits,
                ["entry"] = p.EntryPrice, ["netProfit"] = p.NetProfit, ["r"] = double.IsFinite(r) ? Math.Round(r, 2) : null, ["minutes"] = Math.Round(minutes, 1), ["pips"] = p.Pips, ["balance"] = Account.Balance,
            });
            _activity.Closed(p.NetProfit);
            Print($"Zugrio EA: TRADE CLOSED {p.TradeType.ToString().ToUpperInvariant()} {p.SymbolName} ({style.ToLowerInvariant()}{(route == null ? "" : route == "REVERSAL_RECLAIM" ? ", reclaim" : ", break and retest")}; {args.Reason}), " +
                  $"P/L {p.NetProfit:+0.00;-0.00;0.00}{(double.IsFinite(r) ? $" ({r:+0.0;-0.0;0.0}R)" : "")}, held {minutes:0} min, balance {Account.Balance:F2}.");
        }

        protected override void OnStop()
        {
            _log?.Write(Server.TimeInUtc, "stop", new Dictionary<string, object?> { ["balance"] = Account.Balance, ["equity"] = Account.Equity });
        }

        private JsonObject Config() => new()
        {
            ["schema"] = "zugrio.ea-config/v6", ["calibrationStatus"] = "UNVALIDATED_RESEARCH",
            ["indexEngine"] = new JsonObject
            {
                ["on"] = IndexEngineOn, ["lowerCloses"] = IndexLowerCloses, ["trendSma"] = IndexTrendSma, ["exitSma"] = IndexExitSma, ["atrPeriod"] = _indexRule.AtrPeriod,
                ["stopAtr"] = (decimal)IndexStopAtr, ["farTargetAtr"] = (decimal)IndexFarTargetAtr, ["closeNewYork"] = IndexCloseText.Trim(), ["leadMinutes"] = IndexLeadMinutes,
                ["sessionStartNewYork"] = _indexRule.Start.ToString(@"hh\:mm"), ["minBarsPerSession"] = _indexRule.MinBarsPerSession, ["chaseAtr"] = (decimal)IndexChaseAtr,
            },
            ["markets"] = new JsonObject { ["watchlist"] = WatchlistText, ["indexMarkets"] = IndexMarketsText, ["tiers"] = TiersText, ["maxSpreadShareOfStop"] = (decimal)MaxSpreadShareOfStop,
                ["trendFilter"] = TrendFilterOn, ["trendFilterOnReclaims"] = TrendFilterOnReclaims, ["noCounterTrendReclaims"] = NoCounterTrendReclaims },
            ["styles"] = new JsonArray(_styles.Select(st => (JsonNode)new JsonObject
            {
                ["name"] = st.Name, ["horizon"] = st.Horizon, ["context"] = st.ContextTf, ["location"] = st.LocationTf, ["entry"] = st.EntryTf,
                ["fallbackContexts"] = string.Join(",", st.FallbackContexts), ["setupExpiryHours"] = (decimal)st.SetupExpiryHours, ["entryExpiryMinutes"] = (decimal)st.EntryExpiryMinutes,
                ["classes"] = string.Join(",", st.Classes), ["targetR"] = (decimal)st.TargetR, ["maxMinutes"] = (decimal)st.MaxMinutes, ["minRunwayAtr"] = (decimal)st.MinRunwayAtr,
            }).ToArray()),
            ["bars"] = new JsonObject { ["context"] = ContextBars, ["location"] = LocationBars, ["entry"] = EntryBars },
            ["model"] = new JsonObject
            {
                ["routes"] = string.Join(",", _routes), ["pivotBars"] = PivotBars, ["atrPeriod"] = AtrPeriod, ["breakAtr"] = (decimal)BreakAtr, ["touchAtr"] = (decimal)TouchAtr,
                ["stopAtr"] = (decimal)StopAtr, ["maxChaseAtr"] = (decimal)MaxChaseAtr, ["minRunwayAtr"] = (decimal)MinRunwayAtr, ["minStopAtr"] = (decimal)MinStopAtr, ["recentFacts"] = RecentFacts,
            },
            ["risk"] = new JsonObject
            {
                ["riskPct"] = (decimal)RiskPct, ["maxRiskPctAtMinVolume"] = (decimal)MaxRiskPctAtMinVolume, ["maxUnits"] = (decimal)MaxUnits, ["maxDailyLossPct"] = (decimal)MaxDailyLossPct, ["protectPreviousDayProfit"] = ProtectPreviousDayProfit,
                ["profitLockFraction"] = (decimal)ProfitLockFraction, ["breakEvenAtR"] = (decimal)BreakEvenAtR, ["breakEvenLockAtr"] = (decimal)BreakEvenLockAtr,
                ["trailStartR"] = (decimal)TrailStartR, ["trailAtr"] = (decimal)TrailAtr, ["keepProfitFraction"] = (decimal)KeepProfitFraction,
            },
            ["execution"] = new JsonObject { ["maxQuoteAgeSeconds"] = MaxQuoteAgeSeconds, ["maxClockSkewSeconds"] = MaxClockSkewSeconds, ["protectionDeadlineSeconds"] = ProtectionDeadlineSeconds },
        };

        private JsonObject BuildRequest(Market m, TradingStyle style, double atr, string route, string contextTf)
        {
            var markets = new JsonArray();
            var latest = DateTime.MinValue;
            foreach (var (code, bars, history) in new[] { (contextTf, m.Bars[contextTf], ContextBars), (style.LocationTf, m.Bars[style.LocationTf], LocationBars), (style.EntryTf, m.Bars[style.EntryTf], EntryBars) }.GroupBy(x => x.Item1).Select(g => g.OrderByDescending(x => x.Item3).First()))
            {
                var len = Timeframes.Length(code);
                var closedCount = bars.Count - 1;   // the last bar is still forming
                if (closedCount < 10) throw new InvalidOperationException("not enough closed " + code + " bars");
                var arr = new JsonArray();
                for (var i = Math.Max(0, closedCount - history); i < closedCount; i++)
                {
                    var b = bars[i];
                    var closedAt = b.OpenTime + len;
                    if (closedAt > latest) latest = closedAt;
                    arr.Add(new JsonObject { ["closedAt"] = Timeframes.Iso(closedAt), ["o"] = b.Open, ["h"] = b.High, ["l"] = b.Low, ["c"] = b.Close });
                }
                markets.Add(new JsonObject { ["timeframe"] = code, ["bars"] = arr });
            }
            var ticks = atr / m.Sym.TickSize;
            var entryAge = (long)Timeframes.Length(style.EntryTf).TotalMilliseconds * 2;
            // A daily context bar is up to ~3 days old after a weekend, so D1 allows 4 days.
            var ctxAge = contextTf == "D1" ? (long)TimeSpan.FromDays(4).TotalMilliseconds : (long)Timeframes.Length(contextTf).TotalMilliseconds * 2;
            var locAge = (long)Timeframes.Length(style.LocationTf).TotalMilliseconds * 2;
            var (family, origin) = m.Item.Class switch
            {
                AssetClass.Synthetic => ("SYNTHETIC", "SYNTHETIC_GENERATOR"),
                AssetClass.Metal => ("GOLD", "EXTERNAL_MARKET"),
                _ => ("FX", "EXTERNAL_MARKET"),
            };
            return new JsonObject
            {
                ["schema"] = "zugrio.ea-scan-request/v1", ["configVersion"] = _configVersion, ["evaluatedAt"] = Timeframes.Iso(latest),
                ["instrument"] = new JsonObject { ["symbol"] = m.Name, ["source"] = "ctrader:" + Account.BrokerName, ["tickSize"] = m.Sym.TickSize },
                ["family"] = new JsonObject { ["family"] = family, ["priceOrigin"] = origin },
                // A distinct horizon per style and context timeframe: each is its own profile in decision-core.
                ["horizon"] = new JsonObject { ["horizon"] = style.HorizonFor(contextTf), ["setupExpiryMs"] = (long)(style.SetupExpiryHours * 3_600_000), ["entryExpiryMs"] = (long)(style.EntryExpiryMinutes * 60_000) },
                ["timeframes"] = new JsonObject
                {
                    ["context"] = contextTf, ["location"] = style.LocationTf, ["entry"] = style.EntryTf, ["management"] = contextTf,
                    ["maxAgeMs"] = new JsonObject { ["context"] = ctxAge, ["location"] = locAge, ["entry"] = entryAge, ["management"] = ctxAge },
                },
                ["model"] = new JsonObject
                {
                    ["route"] = route, ["breakTicks"] = BreakAtr * ticks, ["touchTicks"] = TouchAtr * ticks, ["stopTicks"] = StopAtr * ticks,
                    ["maxChaseTicks"] = MaxChaseAtr * ticks, ["minimumRunwayTicks"] = style.MinRunwayAtr * ticks,
                },
                ["pivots"] = new JsonArray(new JsonObject { ["definitionId"] = "p1", ["scale"] = "INTERMEDIATE", ["leftBars"] = PivotBars, ["rightBars"] = PivotBars }),
                // readyOnly: the bridge skips bindings that cannot be READY at the latest close (same
                // predicates as decision-core), which makes a scan about 7x faster. READY results are identical.
                ["enumeration"] = new JsonObject { ["recentFactsPerRole"] = RecentFacts, ["readyOnly"] = true },
                ["markets"] = markets,
            };
        }

        /// <summary>Broker-side record of which config and engine produced a trade (survives cloud restarts).</summary>
        private string Comment(string opportunityId) => $"zugrio cfg={_configVersion[..12]} eng={_engine.BundleSha256[..12]} opp={Sha(opportunityId)[..12]}";

        private string LabelFor(string fireEventId) =>
            RiskReducingGate.OwnershipTagPrefix + ClientOrderId.Derive(_accountId, _venue, fireEventId, "intent:" + fireEventId, CoidLength);

        private static bool IsZugrio(Position p) => (p.Label ?? "").StartsWith(RiskReducingGate.OwnershipTagPrefix, StringComparison.Ordinal);

        /// <summary>
        /// After a restart (in the cloud the journal is gone), any Zugrio position without a
        /// stop is closed through the risk-reducing gate. It never opens anything.
        /// </summary>
        private void ProtectUnprotectedOnStart()
        {
            var now = Server.TimeInUtc;
            foreach (var pos in Positions.Where(p => IsZugrio(p) && p.StopLoss == null).ToList())
            {
                var view = View(pos);
                var gate = RiskReducingGate.Check(view, new ClosePosition(view.PositionId), _accountId, _accountId, adapterIntegrityOk: true, brokerReachable: Server.IsConnected);
                if (gate.Allowed) Log(now, "restart_close_unprotected", _exec.Close(pos), pos.Label ?? "");
                else _log.Write(now, "manual_exit_required", new Dictionary<string, object?> { ["label"] = pos.Label, ["reasons"] = gate.AbortReasons });
            }
        }

        private JsonObject Sign(JsonObject o)
        {
            o["signatureAlgorithm"] = TrustRoot.Es256;
            o["signingKeyId"] = "ea";
            o.Remove("signature");
            o["signature"] = Convert.ToBase64String(_key.SignData(CanonicalJson.Utf8(o), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
            return o;
        }

        private PositionView View(Position p) => new(p.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), p.SymbolName,
            p.TradeType == TradeType.Buy ? Side.Buy : Side.Sell, (long)p.VolumeInUnits,
            p.StopLoss.HasValue ? (decimal)p.StopLoss.Value : null, p.TakeProfit.HasValue ? (decimal)p.TakeProfit.Value : null, p.Label ?? "");

        private void Skip(DateTime now, Market m, string fireEventId, string reason, Dictionary<string, object?>? extra = null) => Skip(now, m.Name, fireEventId, reason, extra);

        private void Skip(DateTime now, string symbol, string fireEventId, string reason, Dictionary<string, object?>? extra = null)
        {
            var f = extra ?? new Dictionary<string, object?>();
            f["symbol"] = symbol; f["fireEventId"] = fireEventId; f["reason"] = reason;
            _log.Write(now, "skip", f);
            if (_activity.Skipped(fireEventId, reason)) Print($"Zugrio EA: skipped a {symbol} setup: {EaActivity.ReasonText(reason)}.");
        }

        private void Log(DateTime now, string kind, TradeResult r, string fireEventId) =>
            _log.Write(now, kind, new Dictionary<string, object?> { ["fireEventId"] = fireEventId, ["ok"] = r.IsSuccessful, ["error"] = r.Error?.ToString() });

        private static string Sha(string s)
        {
            using var sha = SHA256.Create();
            return CanonicalJson.Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(s)));
        }

        private static TimeFrame ToTimeFrame(string code) => code switch
        {
            "M1" => TimeFrame.Minute, "M5" => TimeFrame.Minute5, "M15" => TimeFrame.Minute15, "M30" => TimeFrame.Minute30,
            "H1" => TimeFrame.Hour, "H4" => TimeFrame.Hour4, "D1" => TimeFrame.Daily,
            _ => throw new ArgumentException("unsupported timeframe " + code),
        };
    }
}
