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
    /// Two trading styles (horizon profiles of the same engine): DAY scans H1/M15/M5 on every
    /// closed M5 bar; SCALP scans M15/M5/M1 on every closed M1 bar, synthetics only by default.
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
        public const string DefaultTiers = "0:1:5; 100:2:6; 250:3:8; 1000:4:8";

        [Parameter("Watchlist (Name|SYN/FX/METAL|unlock balance; ...)", DefaultValue = DefaultWatchlist, Group = "Markets and capital tiers (research)")] public string WatchlistText { get; set; } = DefaultWatchlist;
        [Parameter("Tiers (min balance:max positions:max total risk %; ...)", DefaultValue = DefaultTiers, Group = "Markets and capital tiers (research)")] public string TiersText { get; set; } = DefaultTiers;
        [Parameter("Trend filter: trade only with the context structure", DefaultValue = true, Group = "Markets and capital tiers (research)")] public bool TrendFilterOn { get; set; } = true;
        [Parameter("Trend filter also on reclaim setups", DefaultValue = false, Group = "Markets and capital tiers (research)")] public bool TrendFilterOnReclaims { get; set; }
        [Parameter("Never fade a clear trend (reclaim setups)", DefaultValue = true, Group = "Markets and capital tiers (research)")] public bool NoCounterTrendReclaims { get; set; } = true;
        [Parameter("Max spread as share of stop distance", DefaultValue = 0.25, MinValue = 0.01, MaxValue = 1, Group = "Markets and capital tiers (research)")] public double MaxSpreadShareOfStop { get; set; }

        [Parameter("Trading styles (DAY, SCALP)", DefaultValue = "DAY,SCALP", Group = "Trading styles")] public string StylesText { get; set; } = "DAY,SCALP";
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
                _styles = TradingStyles.ParseNames(StylesText).Select(n => _styleDefs[n]).ToList();
            }
            catch (FormatException e) { Print("Zugrio EA: invalid watchlist, tiers, routes or styles: " + e.Message + ". Not trading."); Stop(); return; }
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
            if (_markets.Count == 0) { Print("Zugrio EA: no watchlist symbol exists at this broker. Not trading."); Stop(); return; }
            Positions.Closed += OnPositionClosed;
            Timer.Start(TimeSpan.FromSeconds(1));

            _log.Write(Server.TimeInUtc, "start", new Dictionary<string, object?>
            {
                ["account"] = _accountId, ["broker"] = Account.BrokerName, ["currency"] = Account.Asset.Name, ["isLive"] = Account.IsLive,
                ["balance"] = Account.Balance, ["markets"] = _markets.Select(m => m.Name).ToArray(), ["configVersion"] = _configVersion, ["engineSha256"] = _engine.BundleSha256,
                ["config"] = JsonDocument.Parse(config.ToJsonString()).RootElement.Clone(),
            });
            Print($"Zugrio EA started: {(_exec.IsLive ? "LIVE" : "demo")} account {_accountId}, {_markets.Count} markets, " +
                  string.Join(", ", _styles.Select(st => $"{st.Name} {st.ContextTf}/{st.LocationTf}/{st.EntryTf} on {_markets.Count(x => x.Styles.Contains(st))}")) + $". Config {_configVersion[..12]}, engine {_engine.BundleSha256[..12]}.");
            ProtectUnprotectedOnStart();
            ReportAffordability(Server.TimeInUtc);
        }

        private void ResolveMarkets(IReadOnlyList<WatchItem> watch)
        {
            var brokerNames = Enumerable.Range(0, Symbols.Count).Select(i => Symbols[i]).ToList();
            foreach (var item in watch)
            {
                var name = Watchlist.Resolve(item.Symbol, brokerNames);
                Symbol? sym = name == null ? null : Symbols.GetSymbol(name);
                if (sym == null) { Print($"Zugrio EA: '{item.Symbol}' is not offered by this broker; skipped."); continue; }
                var styles = _styles.Where(st => st.Trades(item.Class)).ToList();
                if (styles.Count == 0) { Print($"Zugrio EA: '{item.Symbol}' is in no enabled trading style; skipped."); continue; }
                var m = new Market(item, sym,
                    styles.SelectMany(st => st.AllTimeframes).Distinct().ToDictionary(tf => tf, tf => MarketData.GetBars(ToTimeFrame(tf), sym.Name)), styles);
                sym.Tick += _ => m.LastTickUtc = Server.TimeInUtc;
                foreach (var st in styles) m.Bars[st.EntryTf].BarOpened += _ => OnEntryBarClosed(m, st);
                _markets.Add(m);
            }
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
            if (now.Date != _reportDay) ReportAffordability(now);
            ManageOpenProfit(now);
            ManageTimeStops(now);
            var hour = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, DateTimeKind.Utc);
            if (_activityHour == DateTime.MinValue) _activityHour = hour;
            else if (hour > _activityHour)
            {
                Print(_activity.Summary(hour, Account.Balance, Account.Equity, Positions.Count(IsZugrio), tier, _killSwitch.Remaining(Account.Equity), _killSwitch.Floor));
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

            var size = SizeFor(m, price, stop);
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
            var size = SizeFor(m, price, p.Stop);   // re-size at the current price
            if (!size.Trade) { Skip(now, m, p.FireEventId, size.Reason, new() { ["riskPctAtMinimum"] = size.RiskPctActual }); return; }

            var atr = StyleAtr(m, p.Style);
            if (!(atr > 0)) { Skip(now, m, p.FireEventId, "ATR_UNAVAILABLE"); return; }
            if (!ExitPlan.StopFarEnough(price, p.Stop, atr, MinStopAtr)) { Skip(now, m, p.FireEventId, "STOP_TOO_CLOSE", new() { ["price"] = price }); return; }
            // The style's take-profit: the engine objective, or nearer at TargetR x risk (scalps).
            var target = ExitPlan.Target(p.Side == Side.Buy, price, p.Stop, p.Target, p.Style.TargetR);
            var chase = MaxChaseAtr * atr;
            var limit = Math.Round(p.Side == Side.Buy ? p.EntryRef + chase : p.EntryRef - chase, m.Sym.Digits);
            var entryIntentId = "intent:" + p.FireEventId;
            var coid = ClientOrderId.Derive(_accountId, _venue, p.FireEventId, entryIntentId, CoidLength);
            var label = RiskReducingGate.OwnershipTagPrefix + coid;
            var unsigned = new JsonObject
            {
                ["schema"] = ExecutionInstruction.Schema,
                ["submissionEnvelope"] = new JsonObject
                {
                    ["submissionEnvelopeId"] = "env:" + p.FireEventId, ["entryIntentId"] = entryIntentId, ["fireEventId"] = p.FireEventId,
                    ["accountId"] = _accountId, ["brokerVenueId"] = _venue, ["clientOrderId"] = coid,
                    ["adverseExecutionPriceLimit"] = (decimal)limit, ["brokerExecutionPolicyHash"] = _configVersion, ["preparedAt"] = Timeframes.Iso(now),
                },
                ["entryIntent"] = new JsonObject
                {
                    ["entryIntentId"] = entryIntentId, ["instrument"] = m.Name, ["side"] = p.Side == Side.Buy ? "BUY" : "SELL", ["volumeUnits"] = size.Units,
                    ["stopLossPrice"] = (decimal)Math.Round(p.Stop, m.Sym.Digits), ["takeProfitPrice"] = (decimal)Math.Round(target, m.Sym.Digits),
                },
                ["executionAuthorityManifestHash"] = _engine.BundleSha256,
                ["expiresAt"] = Timeframes.Iso(now.AddMinutes(1)),
            };
            ExecutionInstruction instruction;
            try { instruction = ExecutionInstruction.Parse(Sign(unsigned).ToJsonString(), CoidLength); }
            catch (ContractException e) { Skip(now, m, p.FireEventId, "CONTRACT: " + e.Message); return; }

            var snapshot = new BrokerSafetySnapshot(_accountId, _venue, Account.IsLive, Server.IsConnected, (decimal)m.Sym.Bid, (decimal)m.Sym.Ask,
                new DateTimeOffset(DateTime.SpecifyKind(m.LastTickUtc, DateTimeKind.Utc)), Server.TimeInUtc - DateTime.UtcNow, new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)));
            var check = _guard.Check(instruction, snapshot, _boundary);
            if (!check.Allowed) { Skip(now, m, p.FireEventId, "GUARD", new() { ["reasons"] = check.AbortReasons }); return; }

            _boundary.Reserve(_accountId, p.FireEventId, coid, m.Name, now);
            _boundary.MarkSubmitted(_accountId, p.FireEventId, now);
            var slPips = Math.Abs(price - p.Stop) / m.Sym.PipSize;
            var tpPips = Math.Abs(target - price) / m.Sym.PipSize;
            TradeResult r;
            try { r = _exec.MarketOrder(p.Side == Side.Buy ? TradeType.Buy : TradeType.Sell, m.Name, size.Units, label, slPips, tpPips,
                    ProtectionManager.WithInitialStop(TradingStyles.WithRoute(TradingStyles.WithStyle(Comment(p.OpportunityId), p.Style.Name), p.Route), Math.Round(p.Stop, m.Sym.Digits))); }
            catch (Exception e)
            {
                _boundary.OnSubmissionUnknown(_accountId, p.FireEventId, now);
                var found = Positions.Find(label, m.Name);
                _boundary.ResolveUnknown(_accountId, p.FireEventId, found != null, found == null ? 0 : (long)found.VolumeInUnits, Server.TimeInUtc);
                _log.Write(now, "submission_unknown", new Dictionary<string, object?> { ["symbol"] = m.Name, ["fireEventId"] = p.FireEventId, ["error"] = e.Message, ["reconciledPresent"] = found != null });
                if (found != null) ConfirmProtection(m, found, p.FireEventId, p.Stop, target);
                return;
            }
            if (!r.IsSuccessful)
            {
                _boundary.OnRejected(_accountId, p.FireEventId, now);
                Log(now, "order_rejected", r, p.FireEventId);
                return;
            }
            _boundary.OnAcknowledged(_accountId, p.FireEventId, now);
            _boundary.OnFilled(_accountId, p.FireEventId, (long)r.Position.VolumeInUnits, now);
            _log.Write(now, "entry", new Dictionary<string, object?>
            {
                ["symbol"] = m.Name, ["class"] = m.Item.Class.ToString(), ["style"] = p.Style.Name, ["fireEventId"] = p.FireEventId, ["opportunityId"] = p.OpportunityId,
                ["side"] = p.Side.ToString(), ["units"] = size.Units, ["riskMoney"] = size.RiskMoney, ["riskPct"] = size.RiskPctActual, ["sizingReason"] = size.Reason,
                ["route"] = p.Route, ["price"] = price, ["fill"] = r.Position.EntryPrice, ["engineStop"] = p.Stop, ["engineTarget"] = p.Target, ["target"] = target, ["entryReference"] = p.EntryRef,
                ["brokerStop"] = r.Position.StopLoss, ["brokerTarget"] = r.Position.TakeProfit, ["label"] = label, ["atr"] = atr,
            });
            _activity.Entered(p.Style.Name == TradingStyles.Scalp);
            Print($"Zugrio EA: TRADE OPENED {p.Side.ToString().ToUpperInvariant()} {m.Name}{(p.Style.Name == TradingStyles.Scalp ? " (scalp)" : "")} {r.Position.Quantity.ToString(System.Globalization.CultureInfo.InvariantCulture)} lots at {r.Position.EntryPrice.ToString(System.Globalization.CultureInfo.InvariantCulture)}, " +
                  $"stop {r.Position.StopLoss?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "none"}, target {r.Position.TakeProfit?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "none"}, risk {size.RiskMoney:F2} ({size.RiskPctActual:F1}%).");
            ConfirmProtection(m, r.Position, p.FireEventId, p.Stop, target);
        }

        /// <summary>
        /// Moves the broker stop to the engine's exact stop only when that is RISK_REDUCING,
        /// or attaches it when missing. Then confirms protection (SB-11).
        /// </summary>
        private void ConfirmProtection(Market m, Position pos, string fireEventId, double stop, double target)
        {
            var now = Server.TimeInUtc;
            var view = View(pos);
            var effect = OrderClassifier.Classify(view, new SetStopLoss(view.PositionId, (decimal)Math.Round(stop, m.Sym.Digits)));
            if (pos.StopLoss == null || effect == RiskEffect.RiskReducing)
            {
                var r = _exec.SetProtection(pos, Math.Round(stop, m.Sym.Digits), Math.Round(target, m.Sym.Digits));
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
        private SizingResult SizeFor(Market m, double price, double stop) =>
            Sizing.Compute(new SizingInput(Account.Balance, RiskPct, MaxRiskPctAtMinVolume, price, stop, m.Sym.TickSize, m.Sym.TickValue,
                m.Sym.VolumeInUnitsMin, m.Sym.VolumeInUnitsStep, m.Sym.VolumeInUnitsMax, MaxUnits,
                RiskMoneyCap: _killSwitch.Remaining(Account.Equity) - OpenExposures().Sum(e => e.RiskMoney)));

        /// <summary>Open Zugrio positions and the money each can still lose from here to its stop (unbounded without a stop).</summary>
        private IReadOnlyList<OpenExposure> OpenExposures() =>
            Positions.Where(IsZugrio).Select(p =>
            {
                var sym = Symbols.GetSymbol(p.SymbolName);
                var cls = _markets.FirstOrDefault(x => x.Name == p.SymbolName)?.Item.Class ?? AssetClass.Synthetic;
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
            var rows = _markets.Select(m =>
            {
                var atr = StyleAtr(m, m.Styles[0]);
                var typicalStop = (StopAtr + 0.5 * MaxChaseAtr) * atr;
                return (m, a: AffordabilityCalc.Compute(m.Name, m.Sym.VolumeInUnitsMin, m.Sym.TickSize, m.Sym.TickValue, typicalStop, m.Sym.Ask - m.Sym.Bid, MaxRiskPctAtMinVolume));
            }).OrderBy(x => double.IsNaN(x.a.MinBalanceForCap) ? double.MaxValue : x.a.MinBalanceForCap).ToList();
            foreach (var (m, a) in rows)
            {
                _log.Write(now, "affordability", new Dictionary<string, object?>
                {
                    ["symbol"] = m.Name, ["class"] = m.Item.Class.ToString(), ["unlockBalance"] = m.Item.UnlockBalance, ["minUnits"] = a.MinUnits,
                    ["typicalStop"] = a.TypicalStopDistance, ["riskAtMinimum"] = a.RiskAtMinimum, ["minBalanceForCap"] = a.MinBalanceForCap,
                    ["spreadShareOfStop"] = a.SpreadShareOfStop, ["affordableNow"] = a.MinBalanceForCap <= Account.Balance && Account.Balance >= m.Item.UnlockBalance,
                });
            }
            Print("Zugrio EA markets by smallest tradable balance: " + string.Join(", ", rows.Select(x =>
                $"{x.m.Name} {(double.IsNaN(x.a.MinBalanceForCap) ? "n/a" : x.a.MinBalanceForCap.ToString("F0", System.Globalization.CultureInfo.InvariantCulture))}" +
                (Account.Balance < x.m.Item.UnlockBalance ? $" (unlocks at {x.m.Item.UnlockBalance})" : ""))));
        }

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
            ["schema"] = "zugrio.ea-config/v5", ["calibrationStatus"] = "UNVALIDATED_RESEARCH",
            ["markets"] = new JsonObject { ["watchlist"] = WatchlistText, ["tiers"] = TiersText, ["maxSpreadShareOfStop"] = (decimal)MaxSpreadShareOfStop,
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

        private void Skip(DateTime now, Market m, string fireEventId, string reason, Dictionary<string, object?>? extra = null)
        {
            var f = extra ?? new Dictionary<string, object?>();
            f["symbol"] = m.Name; f["fireEventId"] = fireEventId; f["reason"] = reason;
            _log.Write(now, "skip", f);
            if (_activity.Skipped(fireEventId, reason)) Print($"Zugrio EA: skipped a {m.Name} setup: {EaActivity.ReasonText(reason)}.");
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
