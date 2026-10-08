using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using cAlgo.API;
using Zugrio.CBot.Core;
using Zugrio.CBot.Engine;

namespace Zugrio.CBot.EA
{
    /// <summary>
    /// Zugrio EA (ADR-0010): fully automatic on the demo or live account it is started on.
    /// Runs as a cTrader cloud instance (started from cTrader Mobile, Web or desktop) or locally.
    ///
    /// On every closed entry-timeframe bar it hands closed bars to Zugrio's own
    /// decision-core (running under Jint) and acts only on a STRUCTURAL_READY candidate.
    /// It enters at market with the engine's stop and objective, sized from the
    /// account's balance. Every step goes through the boundary core: signed in-process
    /// instruction, abort-only guards, the journalled state machine, protection deadline
    /// and risk-reducing gate. Everything is logged for analysis.
    ///
    /// All parameters below are research values (UNVALIDATED_RESEARCH). Changing any
    /// of them changes the config version recorded with every decision.
    /// </summary>
    // AccessRights.None so it can run as a cTrader cloud instance, which is how it runs from
    // cTrader Mobile. It needs no more: relative-path files, no HTTP, no Windows APIs.
    [Robot(AccessRights = AccessRights.None, AddIndicators = false, TimeZone = TimeZones.UTC)]
    public class ZugrioEA : Robot
    {
        [Parameter("Context timeframe", DefaultValue = "H1", Group = "Engine timeframes")] public string ContextTf { get; set; } = "H1";
        [Parameter("Location timeframe", DefaultValue = "M15", Group = "Engine timeframes")] public string LocationTf { get; set; } = "M15";
        [Parameter("Entry timeframe", DefaultValue = "M5", Group = "Engine timeframes")] public string EntryTf { get; set; } = "M5";
        [Parameter("Bars of history per timeframe", DefaultValue = 300, MinValue = 50, MaxValue = 2000, Group = "Engine timeframes")] public int HistoryBars { get; set; }

        [Parameter("Route (CONTINUATION_RETEST / REVERSAL_RECLAIM)", DefaultValue = "CONTINUATION_RETEST", Group = "Entry model (research)")] public string Route { get; set; } = "CONTINUATION_RETEST";
        [Parameter("Pivot bars left/right", DefaultValue = 2, MinValue = 1, MaxValue = 10, Group = "Entry model (research)")] public int PivotBars { get; set; }
        [Parameter("Break threshold (pips)", DefaultValue = 1.0, MinValue = 0.1, Group = "Entry model (research)")] public double BreakPips { get; set; }
        [Parameter("Retest touch tolerance (pips)", DefaultValue = 2.0, MinValue = 0.1, Group = "Entry model (research)")] public double TouchPips { get; set; }
        [Parameter("Stop beyond level (pips)", DefaultValue = 3.0, MinValue = 0.1, Group = "Entry model (research)")] public double StopPips { get; set; }
        [Parameter("Max chase from level (pips)", DefaultValue = 5.0, MinValue = 0.1, Group = "Entry model (research)")] public double MaxChasePips { get; set; }
        [Parameter("Minimum runway to objective (pips)", DefaultValue = 10.0, MinValue = 0.1, Group = "Entry model (research)")] public double MinRunwayPips { get; set; }
        [Parameter("Setup expiry (hours)", DefaultValue = 24.0, MinValue = 0.5, Group = "Entry model (research)")] public double SetupExpiryHours { get; set; }
        [Parameter("Entry expiry (minutes)", DefaultValue = 15.0, MinValue = 1, Group = "Entry model (research)")] public double EntryExpiryMinutes { get; set; }
        [Parameter("Recent facts per role", DefaultValue = 3, MinValue = 1, MaxValue = 10, Group = "Entry model (research)")] public int RecentFacts { get; set; }

        [Parameter("Risk per trade (% of balance)", DefaultValue = 1.0, MinValue = 0.05, MaxValue = 5, Group = "Risk (research)")] public double RiskPct { get; set; }
        [Parameter("Max risk at broker minimum volume (%)", DefaultValue = 5.0, MinValue = 0.1, MaxValue = 20, Group = "Risk (research)")] public double MaxRiskPctAtMinVolume { get; set; }
        [Parameter("Max units per order", DefaultValue = 1000000, MinValue = 1, Group = "Risk (research)")] public double MaxUnits { get; set; }
        [Parameter("Max open Zugrio positions on this symbol", DefaultValue = 1, MinValue = 1, MaxValue = 5, Group = "Risk (research)")] public int MaxOpenPositions { get; set; }
        [Parameter("Daily loss kill switch (% of day-start equity)", DefaultValue = 5.0, MinValue = 0.5, MaxValue = 50, Group = "Risk (research)")] public double MaxDailyLossPct { get; set; }

        [Parameter("Max quote age (seconds)", DefaultValue = 10, MinValue = 1, Group = "Execution safety (research)")] public int MaxQuoteAgeSeconds { get; set; }
        [Parameter("Max clock skew (seconds)", DefaultValue = 30, MinValue = 1, Group = "Execution safety (research)")] public int MaxClockSkewSeconds { get; set; }
        [Parameter("Protection deadline (seconds)", DefaultValue = 10, MinValue = 1, Group = "Execution safety (research)")] public int ProtectionDeadlineSeconds { get; set; }

        private const int CoidLength = 26;
        private EaExecution _exec = null!;
        private ZugrioEngine _engine = null!;
        private EntryBoundary _boundary = null!;
        private EntryGuard _guard = null!;
        private EaLog _log = null!;
        private ECDsa _key = null!;
        private string _configVersion = "";
        private string _accountId = "";
        private string _venue = "";
        private Bars _context = null!, _location = null!, _entry = null!;
        private DateTime _lastTickUtc = DateTime.MinValue;
        private DailyLossKillSwitch _killSwitch = null!;

        protected override void OnStart()
        {
            _exec = new EaExecution(this);
            _accountId = Account.Number.ToString(System.Globalization.CultureInfo.InvariantCulture);
            _venue = (_exec.IsLive ? "ctrader-live:" : "ctrader-demo:") + Account.BrokerName;

            var config = Config();
            _configVersion = CanonicalJson.Sha256Hex("zugrio:ea-config:v1", config);
            try { _engine = ZugrioEngine.Load(); }
            catch (Exception e) { Print("Zugrio engine failed to load or self-test: " + e.Message + ". Not trading."); Stop(); return; }

            _log = new EaLog(_configVersion, _engine.BundleSha256, Print);
            IBoundaryJournal journal;
            try
            {
                Directory.CreateDirectory(EaLog.Folder);
                var fileJournal = new FileJournal(Path.Combine(EaLog.Folder, $"journal-{_accountId}-{SymbolName}.jsonl"));
                fileJournal.ReadAll();
                journal = fileJournal;
            }
            catch (Exception e)
            {
                // Cloud restarts wipe files anyway. Duplicate-entry protection does not rely on the
                // journal alone: TryEnter also checks the broker's own positions and history.
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

            _killSwitch = new DailyLossKillSwitch(MaxDailyLossPct);
            // Restarts (every cloud restart) must not reset today's loss baseline: rebuild it from
            // the broker's record of trades closed today.
            var today = Server.TimeInUtc.Date;
            var closedToday = History.Where(t => t.ClosingTime >= today).Sum(t => t.NetProfit);
            _killSwitch.Seed(Server.TimeInUtc, Account.Balance - closedToday);
            _context = MarketData.GetBars(ToTimeFrame(ContextTf));
            _location = MarketData.GetBars(ToTimeFrame(LocationTf));
            _entry = MarketData.GetBars(ToTimeFrame(EntryTf));
            _entry.BarOpened += _ => OnEntryBarClosed();
            Positions.Closed += OnPositionClosed;
            Timer.Start(TimeSpan.FromSeconds(1));
            _lastTickUtc = Server.TimeInUtc;

            _log.Write(Server.TimeInUtc, "start", new Dictionary<string, object?>
            {
                ["symbol"] = SymbolName, ["account"] = _accountId, ["broker"] = Account.BrokerName, ["currency"] = Account.Asset.Name,
                ["balance"] = Account.Balance, ["isLive"] = Account.IsLive, ["config"] = config.ToJsonString(),
            });
            Print($"Zugrio EA started on {SymbolName}, {(_exec.IsLive ? "LIVE" : "demo")} account {_accountId}. Config {_configVersion[..12]}, engine {_engine.BundleSha256[..12]}.");
            ProtectUnprotectedOnStart();
        }

        protected override void OnTick()
        {
            _lastTickUtc = Server.TimeInUtc;
        }

        protected override void OnTimer()
        {
            var now = Server.TimeInUtc;
            foreach (var failed in _boundary.Tick(now))
            {
                var pos = Positions.Find("zugrio:" + failed.ClientOrderId, SymbolName);
                _log.Write(now, "protection_failed", new Dictionary<string, object?> { ["fireEventId"] = failed.FireEventId, ["positionFound"] = pos != null });
                if (pos == null) continue;
                var view = View(pos);
                var gate = RiskReducingGate.Check(view, new ClosePosition(view.PositionId), _accountId, _accountId, adapterIntegrityOk: true, brokerReachable: Server.IsConnected);
                if (gate.Allowed) Log(now, "emergency_close", _exec.Close(pos), failed.FireEventId);
                else _log.Write(now, "manual_exit_required", new Dictionary<string, object?> { ["fireEventId"] = failed.FireEventId, ["reasons"] = gate.AbortReasons });
            }
            if (_killSwitch.Update(now, Account.Equity))
                _log.Write(now, "kill_switch", new Dictionary<string, object?> { ["dayStartEquity"] = _killSwitch.DayStartEquity, ["equity"] = Account.Equity });
            if (_guard.KillSwitch != _killSwitch.Tripped)
            {
                _guard.KillSwitch = _killSwitch.Tripped;   // blocks new entries only; never blocks risk reduction (RR-3)
                Print(_killSwitch.Tripped ? "Zugrio EA: daily loss limit reached. New entries stopped until the next UTC day." : "Zugrio EA: new UTC day. Entries resumed.");
            }
        }

        private void OnEntryBarClosed()
        {
            var now = Server.TimeInUtc;
            JsonObject request;
            try { request = BuildRequest(); }
            catch (Exception e) { _log.Write(now, "scan_skipped", new Dictionary<string, object?> { ["reason"] = e.Message }); return; }

            JsonElement result;
            try { result = JsonDocument.Parse(_engine.ScanJson(request.ToJsonString())).RootElement; }
            catch (Exception e) { _log.Write(now, "engine_error", new Dictionary<string, object?> { ["error"] = e.Message }); return; }

            var candidates = result.GetProperty("candidates");
            var best = result.GetProperty("best");
            _log.Write(now, "scan", new Dictionary<string, object?>
            {
                ["evaluatedAt"] = request["evaluatedAt"]!.GetValue<string>(), ["candidates"] = candidates.GetArrayLength(),
                ["ready"] = candidates.EnumerateArray().Count(c => c.GetProperty("state").GetString() == "STRUCTURAL_READY"),
                ["best"] = best.ValueKind == JsonValueKind.Null ? null : best.GetRawText(), ["engineErrors"] = result.GetProperty("errors").GetArrayLength(),
            });
            if (best.ValueKind == JsonValueKind.Null) return;
            TryEnter(best, now);
        }

        private void TryEnter(JsonElement best, DateTime now)
        {
            var opportunityId = best.GetProperty("opportunityId").GetString()!;
            var g = best.GetProperty("geometry");
            var frozenAt = g.GetProperty("frozenAt").GetString()!;
            var fireEventId = "fire:" + Sha(opportunityId + "|" + frozenAt)[..32];
            if (_boundary.Get(_accountId, fireEventId) != null) return;   // this setup was already acted on
            var entryIntentId = "intent:" + fireEventId;
            var coid = ClientOrderId.Derive(_accountId, _venue, fireEventId, entryIntentId, CoidLength);
            var label = RiskReducingGate.OwnershipTagPrefix + coid;
            // The label is derived from the setup, so the broker's own records show whether this
            // setup was already traded, even after a cloud restart wiped the journal.
            if (Positions.Find(label) != null || History.FindLast(label) != null) return;
            var open = Positions.Count(p => p.SymbolName == SymbolName && (p.Label ?? "").StartsWith(RiskReducingGate.OwnershipTagPrefix, StringComparison.Ordinal));
            if (open >= MaxOpenPositions) { Skip(now, fireEventId, "MAX_OPEN_POSITIONS"); return; }

            var side = best.GetProperty("side").GetString() == "BUY" ? Side.Buy : Side.Sell;
            var stop = g.GetProperty("childInvalidation").GetDouble();
            var target = g.GetProperty("objective").GetDouble();
            var entryRef = g.GetProperty("entryReference").GetDouble();
            var price = side == Side.Buy ? Symbol.Ask : Symbol.Bid;
            var chase = MaxChasePips * Symbol.PipSize;
            var limit = Math.Round(side == Side.Buy ? entryRef + chase : entryRef - chase, Symbol.Digits);
            if (!EntrySide.PriceBetweenStopAndTarget(side == Side.Buy, price, stop, target))
            { Skip(now, fireEventId, "PRICE_NOT_BETWEEN_STOP_AND_TARGET", new() { ["price"] = price, ["stop"] = stop, ["target"] = target }); return; }

            var size = Sizing.Compute(new SizingInput(Account.Balance, RiskPct, MaxRiskPctAtMinVolume, price, stop, Symbol.TickSize, Symbol.TickValue,
                Symbol.VolumeInUnitsMin, Symbol.VolumeInUnitsStep, Symbol.VolumeInUnitsMax, MaxUnits));
            if (!size.Trade) { Skip(now, fireEventId, size.Reason, new() { ["riskPctAtMinimum"] = size.RiskPctActual }); return; }

            var unsigned = new JsonObject
            {
                ["schema"] = ExecutionInstruction.Schema,
                ["submissionEnvelope"] = new JsonObject
                {
                    ["submissionEnvelopeId"] = "env:" + fireEventId, ["entryIntentId"] = entryIntentId, ["fireEventId"] = fireEventId,
                    ["accountId"] = _accountId, ["brokerVenueId"] = _venue, ["clientOrderId"] = coid,
                    ["adverseExecutionPriceLimit"] = (decimal)limit, ["brokerExecutionPolicyHash"] = _configVersion, ["preparedAt"] = Timeframes.Iso(now),
                },
                ["entryIntent"] = new JsonObject
                {
                    ["entryIntentId"] = entryIntentId, ["instrument"] = SymbolName, ["side"] = side == Side.Buy ? "BUY" : "SELL", ["volumeUnits"] = size.Units,
                    ["stopLossPrice"] = (decimal)Math.Round(stop, Symbol.Digits), ["takeProfitPrice"] = (decimal)Math.Round(target, Symbol.Digits),
                },
                ["executionAuthorityManifestHash"] = _engine.BundleSha256,
                ["expiresAt"] = Timeframes.Iso(now.AddMinutes(1)),
            };
            ExecutionInstruction instruction;
            try { instruction = ExecutionInstruction.Parse(Sign(unsigned).ToJsonString(), CoidLength); }
            catch (ContractException e) { Skip(now, fireEventId, "CONTRACT: " + e.Message); return; }

            var snapshot = new BrokerSafetySnapshot(_accountId, _venue, Account.IsLive, Server.IsConnected, (decimal)Symbol.Bid, (decimal)Symbol.Ask,
                new DateTimeOffset(_lastTickUtc, TimeSpan.Zero), Server.TimeInUtc - DateTime.UtcNow, new DateTimeOffset(now, TimeSpan.Zero));
            var check = _guard.Check(instruction, snapshot, _boundary);
            if (!check.Allowed) { Skip(now, fireEventId, "GUARD", new() { ["reasons"] = check.AbortReasons }); return; }

            _boundary.Reserve(_accountId, fireEventId, coid, SymbolName, now);
            _boundary.MarkSubmitted(_accountId, fireEventId, now);
            var slPips = Math.Abs(price - stop) / Symbol.PipSize;
            var tpPips = Math.Abs(target - price) / Symbol.PipSize;
            TradeResult r;
            try { r = _exec.MarketOrder(side == Side.Buy ? TradeType.Buy : TradeType.Sell, size.Units, label, slPips, tpPips, Comment(opportunityId)); }
            catch (Exception e)
            {
                _boundary.OnSubmissionUnknown(_accountId, fireEventId, now);
                var found = Positions.Find(label, SymbolName);
                _boundary.ResolveUnknown(_accountId, fireEventId, found != null, found == null ? 0 : (long)found.VolumeInUnits, Server.TimeInUtc);
                _log.Write(now, "submission_unknown", new Dictionary<string, object?> { ["fireEventId"] = fireEventId, ["error"] = e.Message, ["reconciledPresent"] = found != null });
                if (found != null) ConfirmProtection(found, fireEventId, stop, target);
                return;
            }
            if (!r.IsSuccessful)
            {
                _boundary.OnRejected(_accountId, fireEventId, now);
                Log(now, "order_rejected", r, fireEventId);
                return;
            }
            _boundary.OnAcknowledged(_accountId, fireEventId, now);
            _boundary.OnFilled(_accountId, fireEventId, (long)r.Position.VolumeInUnits, now);
            _log.Write(now, "entry", new Dictionary<string, object?>
            {
                ["fireEventId"] = fireEventId, ["opportunityId"] = opportunityId, ["side"] = side.ToString(), ["units"] = size.Units,
                ["riskMoney"] = size.RiskMoney, ["riskPct"] = size.RiskPctActual, ["sizingReason"] = size.Reason,
                ["price"] = price, ["fill"] = r.Position.EntryPrice, ["engineStop"] = stop, ["engineTarget"] = target, ["entryReference"] = entryRef,
                ["brokerStop"] = r.Position.StopLoss, ["brokerTarget"] = r.Position.TakeProfit, ["label"] = label,
            });
            ConfirmProtection(r.Position, fireEventId, stop, target);
        }

        /// <summary>
        /// Moves the broker stop to the engine's exact stop only when that is RISK_REDUCING,
        /// or attaches it when missing. Then confirms protection (SB-11).
        /// </summary>
        private void ConfirmProtection(Position pos, string fireEventId, double stop, double target)
        {
            var now = Server.TimeInUtc;
            var view = View(pos);
            var effect = OrderClassifier.Classify(view, new SetStopLoss(view.PositionId, (decimal)Math.Round(stop, Symbol.Digits)));
            if (pos.StopLoss == null || effect == RiskEffect.RiskReducing)
            {
                var m = _exec.SetProtection(pos, Math.Round(stop, Symbol.Digits), Math.Round(target, Symbol.Digits));
                Log(now, "set_protection", m, fireEventId);
                if (m.IsSuccessful) pos = m.Position;
            }
            if (pos.StopLoss != null) _boundary.OnProtectionConfirmed(_accountId, fireEventId, now);
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            var p = args.Position;
            if (p.SymbolName != SymbolName || !(p.Label ?? "").StartsWith(RiskReducingGate.OwnershipTagPrefix, StringComparison.Ordinal)) return;
            _log.Write(Server.TimeInUtc, "close", new Dictionary<string, object?>
            {
                ["label"] = p.Label, ["reason"] = args.Reason.ToString(), ["side"] = p.TradeType.ToString(), ["units"] = p.VolumeInUnits,
                ["entry"] = p.EntryPrice, ["netProfit"] = p.NetProfit, ["pips"] = p.Pips, ["balance"] = Account.Balance,
            });
        }

        protected override void OnStop()
        {
            _log?.Write(Server.TimeInUtc, "stop", new Dictionary<string, object?> { ["balance"] = Account.Balance, ["equity"] = Account.Equity });
        }

        private JsonObject Config() => new()
        {
            ["schema"] = "zugrio.ea-config/v1", ["symbol"] = SymbolName, ["calibrationStatus"] = "UNVALIDATED_RESEARCH",
            ["timeframes"] = new JsonObject { ["context"] = ContextTf, ["location"] = LocationTf, ["entry"] = EntryTf, ["historyBars"] = HistoryBars },
            ["model"] = new JsonObject
            {
                ["route"] = Route, ["pivotBars"] = PivotBars, ["breakPips"] = (decimal)BreakPips, ["touchPips"] = (decimal)TouchPips, ["stopPips"] = (decimal)StopPips,
                ["maxChasePips"] = (decimal)MaxChasePips, ["minRunwayPips"] = (decimal)MinRunwayPips, ["setupExpiryHours"] = (decimal)SetupExpiryHours,
                ["entryExpiryMinutes"] = (decimal)EntryExpiryMinutes, ["recentFacts"] = RecentFacts,
            },
            ["risk"] = new JsonObject
            {
                ["riskPct"] = (decimal)RiskPct, ["maxRiskPctAtMinVolume"] = (decimal)MaxRiskPctAtMinVolume, ["maxUnits"] = (decimal)MaxUnits,
                ["maxOpenPositions"] = MaxOpenPositions, ["maxDailyLossPct"] = (decimal)MaxDailyLossPct,
            },
            ["execution"] = new JsonObject { ["maxQuoteAgeSeconds"] = MaxQuoteAgeSeconds, ["maxClockSkewSeconds"] = MaxClockSkewSeconds, ["protectionDeadlineSeconds"] = ProtectionDeadlineSeconds },
        };

        private JsonObject BuildRequest()
        {
            var ticksPerPip = Symbol.PipSize / Symbol.TickSize;
            var markets = new JsonArray();
            var latest = DateTime.MinValue;
            foreach (var (code, bars) in new[] { (ContextTf, _context), (LocationTf, _location), (EntryTf, _entry) }.GroupBy(x => x.Item1).Select(g => g.First()))
            {
                var len = Timeframes.Length(code);
                var closedCount = bars.Count - 1;   // the last bar is still forming
                if (closedCount < 10) throw new InvalidOperationException("not enough closed " + code + " bars");
                var arr = new JsonArray();
                for (var i = Math.Max(0, closedCount - HistoryBars); i < closedCount; i++)
                {
                    var b = bars[i];
                    var closedAt = b.OpenTime + len;
                    if (closedAt > latest) latest = closedAt;
                    arr.Add(new JsonObject { ["closedAt"] = Timeframes.Iso(closedAt), ["o"] = b.Open, ["h"] = b.High, ["l"] = b.Low, ["c"] = b.Close });
                }
                markets.Add(new JsonObject { ["timeframe"] = code, ["bars"] = arr });
            }
            var entryAge = (long)Timeframes.Length(EntryTf).TotalMilliseconds * 2;
            var ctxAge = (long)Timeframes.Length(ContextTf).TotalMilliseconds * 2;
            var locAge = (long)Timeframes.Length(LocationTf).TotalMilliseconds * 2;
            return new JsonObject
            {
                ["schema"] = "zugrio.ea-scan-request/v1", ["configVersion"] = _configVersion, ["evaluatedAt"] = Timeframes.Iso(latest),
                ["instrument"] = new JsonObject { ["symbol"] = SymbolName, ["source"] = "ctrader:" + Account.BrokerName, ["tickSize"] = Symbol.TickSize },
                ["family"] = new JsonObject { ["family"] = "CTRADER", ["priceOrigin"] = "EXTERNAL_MARKET" },
                ["horizon"] = new JsonObject { ["horizon"] = "INTRADAY", ["setupExpiryMs"] = (long)(SetupExpiryHours * 3_600_000), ["entryExpiryMs"] = (long)(EntryExpiryMinutes * 60_000) },
                ["timeframes"] = new JsonObject
                {
                    ["context"] = ContextTf, ["location"] = LocationTf, ["entry"] = EntryTf, ["management"] = ContextTf,
                    ["maxAgeMs"] = new JsonObject { ["context"] = ctxAge, ["location"] = locAge, ["entry"] = entryAge, ["management"] = ctxAge },
                },
                ["model"] = new JsonObject
                {
                    ["route"] = Route, ["breakTicks"] = BreakPips * ticksPerPip, ["touchTicks"] = TouchPips * ticksPerPip, ["stopTicks"] = StopPips * ticksPerPip,
                    ["maxChaseTicks"] = MaxChasePips * ticksPerPip, ["minimumRunwayTicks"] = MinRunwayPips * ticksPerPip,
                },
                ["pivots"] = new JsonArray(new JsonObject { ["definitionId"] = "p1", ["scale"] = "INTERMEDIATE", ["leftBars"] = PivotBars, ["rightBars"] = PivotBars }),
                ["enumeration"] = new JsonObject { ["recentFactsPerRole"] = RecentFacts },
                ["markets"] = markets,
            };
        }

        /// <summary>Broker-side record of which config and engine produced a trade (survives cloud restarts).</summary>
        private string Comment(string opportunityId) => $"zugrio cfg={_configVersion[..12]} eng={_engine.BundleSha256[..12]} opp={Sha(opportunityId)[..12]}";

        /// <summary>
        /// After a restart (in the cloud the journal is gone), any Zugrio position on this symbol
        /// without a stop is closed through the risk-reducing gate. It never opens anything.
        /// </summary>
        private void ProtectUnprotectedOnStart()
        {
            var now = Server.TimeInUtc;
            foreach (var pos in Positions.Where(p => p.SymbolName == SymbolName && (p.Label ?? "").StartsWith(RiskReducingGate.OwnershipTagPrefix, StringComparison.Ordinal) && p.StopLoss == null).ToList())
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

        private void Skip(DateTime now, string fireEventId, string reason, Dictionary<string, object?>? extra = null)
        {
            var f = extra ?? new Dictionary<string, object?>();
            f["fireEventId"] = fireEventId; f["reason"] = reason;
            _log.Write(now, "skip", f);
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
