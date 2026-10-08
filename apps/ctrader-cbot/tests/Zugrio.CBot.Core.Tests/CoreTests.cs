using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Xunit;
using Zugrio.CBot.Core;

namespace Zugrio.CBot.Core.Tests
{
    /// <summary>Test-only signer. Production keys never live in this repository.</summary>
    internal sealed class TestSigner : IDisposable
    {
        public readonly ECDsa Key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        public readonly string KeyId;
        public TestSigner(string keyId) { KeyId = keyId; }

        public string TrustRootJson(DateTimeOffset from, DateTimeOffset until, string status = "ACTIVE", string[]? revoked = null) =>
            new JsonObject
            {
                ["trustRootVersion"] = "test-1",
                ["allowedSignatureAlgorithms"] = new JsonArray("ES256"),
                ["trustedSigningKeys"] = new JsonArray(new JsonObject
                {
                    ["keyId"] = KeyId, ["publicKey"] = Convert.ToBase64String(Key.ExportSubjectPublicKeyInfo()),
                    ["validFrom"] = from.ToString("o"), ["validUntil"] = until.ToString("o"), ["status"] = status,
                }),
                ["revocationList"] = new JsonArray((revoked ?? Array.Empty<string>()).Select(r => (JsonNode)r!).ToArray()),
            }.ToJsonString();

        public JsonObject Sign(JsonObject unsigned)
        {
            unsigned["signatureAlgorithm"] = "ES256";
            unsigned["signingKeyId"] = KeyId;
            unsigned.Remove("signature");
            var sig = Key.SignData(CanonicalJson.Utf8(unsigned), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
            unsigned["signature"] = Convert.ToBase64String(sig);
            return unsigned;
        }

        public void Dispose() => Key.Dispose();
    }

    internal static class Fixtures
    {
        public static readonly DateTimeOffset Now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
        public const int CoidLength = 26;
        // Test values only. Real values come from the signed Broker Execution / Risk policies ([UNSET]).
        public static LocalLimits Limits(bool allowLive = false) =>
            new(allowLive, MaxVolumeUnits: 1000, MaxQuoteAge: TimeSpan.FromSeconds(2), MaxClockSkew: TimeSpan.FromSeconds(1),
                PinnedBrokerExecutionPolicyHash: "bep-hash", PinnedExecutionAuthorityManifestHash: "eam-hash", ClientOrderIdLength: CoidLength);

        public static JsonObject Unsigned(string fire = "fire-1", string side = "BUY", long volume = 1000, decimal limit = 1.1000m, decimal sl = 1.0950m, decimal tp = 1.1100m, string? coid = null, DateTimeOffset? expires = null)
        {
            coid ??= ClientOrderId.Derive("acct-1", "ctrader-demo", fire, "intent-" + fire, CoidLength);
            return new JsonObject
            {
                ["schema"] = ExecutionInstruction.Schema,
                ["submissionEnvelope"] = new JsonObject
                {
                    ["submissionEnvelopeId"] = "env-" + fire, ["entryIntentId"] = "intent-" + fire, ["fireEventId"] = fire,
                    ["accountId"] = "acct-1", ["brokerVenueId"] = "ctrader-demo", ["clientOrderId"] = coid,
                    ["adverseExecutionPriceLimit"] = limit, ["brokerExecutionPolicyHash"] = "bep-hash", ["preparedAt"] = Now.ToString("o"),
                },
                ["entryIntent"] = new JsonObject
                {
                    ["entryIntentId"] = "intent-" + fire, ["instrument"] = "EURUSD", ["side"] = side, ["volumeUnits"] = volume,
                    ["stopLossPrice"] = sl, ["takeProfitPrice"] = tp,
                },
                ["executionAuthorityManifestHash"] = "eam-hash",
                ["expiresAt"] = (expires ?? Now.AddMinutes(2)).ToString("o"),
            };
        }

        /// <summary>Signature fields present but not a valid signature: parses, must not verify.</summary>
        public static JsonObject FakeSigned(JsonObject o)
        {
            o["signatureAlgorithm"] = "ES256"; o["signingKeyId"] = "k1"; o["signature"] = Convert.ToBase64String(new byte[64]);
            return o;
        }

        public static BrokerSafetySnapshot Snap(decimal bid = 1.0998m, decimal ask = 1.0999m, bool live = false, bool connected = true, TimeSpan? quoteAge = null, TimeSpan? skew = null, string account = "acct-1") =>
            new(account, "ctrader-demo", live, connected, bid, ask, Now - (quoteAge ?? TimeSpan.FromMilliseconds(100)), skew ?? TimeSpan.Zero, Now);
    }

    public class CanonicalJsonTests
    {
        [Fact]
        public void Sorts_keys_ordinally_and_strips_whitespace()
        {
            var n = JsonNode.Parse("{ \"b\": 1, \"a\": [true, null, \"x\"], \"B\": {\"z\":0,\"y\":-0} }");
            Assert.Equal("{\"B\":{\"y\":0,\"z\":0},\"a\":[true,null,\"x\"],\"b\":1}", CanonicalJson.Serialize(n));
        }

        [Theory]
        [InlineData("1.50", "1.5")]
        [InlineData("1e3", "1000")]
        [InlineData("-0.0", "0")]
        [InlineData("0.000001", "0.000001")]
        [InlineData("123456789.123456789", "123456789.123456789")]
        public void Numbers_have_one_fixed_form(string raw, string expected) => Assert.Equal(expected, CanonicalJson.Number(raw));

        [Fact]
        public void Out_of_range_numbers_fail_closed() => Assert.Throws<CanonicalJsonException>(() => CanonicalJson.Number("1e40"));

        [Fact]
        public void Escapes_controls_and_refuses_non_bmp()
        {
            Assert.Equal("\"a\\n\\u0001\\\"\"", CanonicalJson.Serialize(JsonValue.Create("a\n\u0001\"")));
            Assert.Throws<CanonicalJsonException>(() => CanonicalJson.Serialize(JsonValue.Create("\U0001F600")));
        }
    }

    public class TrustRootTests
    {
        [Fact]
        public void Valid_signature_verifies()
        {
            using var s = new TestSigner("k1");
            var trust = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1)));
            trust.Verify(s.Sign(Fixtures.Unsigned()), Fixtures.Now);
        }

        [Fact]
        public void Tampering_with_any_field_including_algorithm_metadata_fails()
        {
            using var s = new TestSigner("k1");
            var trust = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1)));
            var signed = s.Sign(Fixtures.Unsigned());
            ((JsonObject)signed["entryIntent"]!)["volumeUnits"] = 999;
            Assert.Throws<TrustException>(() => trust.Verify(signed, Fixtures.Now));
        }

        [Fact]
        public void Unknown_revoked_expired_inactive_keys_and_algorithms_fail_closed()
        {
            using var s = new TestSigner("k1");
            using var other = new TestSigner("k2");
            var ok = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1)));
            Assert.Throws<TrustException>(() => ok.Verify(other.Sign(Fixtures.Unsigned()), Fixtures.Now));            // unknown key (TRT-3)
            var expired = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-2), Fixtures.Now.AddDays(-1)));
            Assert.Throws<TrustException>(() => expired.Verify(s.Sign(Fixtures.Unsigned()), Fixtures.Now));
            var revoked = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1), revoked: new[] { "k1" }));
            Assert.Throws<TrustException>(() => revoked.Verify(s.Sign(Fixtures.Unsigned()), Fixtures.Now));
            var retired = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1), status: "RETIRED"));
            Assert.Throws<TrustException>(() => retired.Verify(s.Sign(Fixtures.Unsigned()), Fixtures.Now));
            var signed = s.Sign(Fixtures.Unsigned());
            signed["signatureAlgorithm"] = "HS256";                                                                       // TRT-2
            Assert.Throws<TrustException>(() => ok.Verify(signed, Fixtures.Now));
        }

        [Fact]
        public void Trust_root_must_match_its_declared_hash()
        {
            using var s = new TestSigner("k1");
            var json = JsonNode.Parse(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1)))!.AsObject();
            json["trustRootHash"] = new string('0', 64);
            Assert.Throws<TrustException>(() => TrustRoot.Load(json.ToJsonString()));
            var hash = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1))).Hash;
            Assert.Matches("^[0-9a-f]{64}$", hash);
        }
    }

    public class ClientOrderIdTests
    {
        [Fact]
        public void Is_deterministic_and_changes_with_every_identity_field()
        {
            var a = ClientOrderId.Derive("a", "v", "f", "i", 26);
            Assert.Equal(a, ClientOrderId.Derive("a", "v", "f", "i", 26));
            Assert.Equal(26, a.Length);
            Assert.Matches("^z[a-z2-7]+$", a);
            Assert.NotEqual(a, ClientOrderId.Derive("a2", "v", "f", "i", 26));
            Assert.NotEqual(a, ClientOrderId.Derive("a", "v2", "f", "i", 26));
            Assert.NotEqual(a, ClientOrderId.Derive("a", "v", "f2", "i", 26));
            Assert.NotEqual(a, ClientOrderId.Derive("a", "v", "f", "i2", 26));
        }

        [Fact]
        public void No_collisions_over_200k_identities_at_minimum_length()
        {
            var seen = new HashSet<string>();
            for (var n = 0; n < 200_000; n++)
                Assert.True(seen.Add(ClientOrderId.Derive("acct-" + (n % 7), "ctrader-demo", "fire-" + n, "intent-" + n, ClientOrderId.MinimumLength)));
        }

        [Fact]
        public void Refuses_lengths_that_weaken_uniqueness() => Assert.Throws<ArgumentOutOfRangeException>(() => ClientOrderId.Derive("a", "v", "f", "i", 12));
    }

    public class InstructionParseTests
    {
        [Fact]
        public void Parses_a_well_formed_instruction()
        {
            var i = ExecutionInstruction.Parse(Fixtures.FakeSigned(Fixtures.Unsigned()).ToJsonString(), Fixtures.CoidLength);
            Assert.Equal(Side.Buy, i.Entry.Side);
            Assert.Equal(1000, i.Entry.VolumeUnits);
        }

        [Fact]
        public void Rejects_unknown_fields_wrong_client_order_id_and_bad_geometry()
        {
            var extra = Fixtures.FakeSigned(Fixtures.Unsigned()); extra["riskCanOpen"] = true;   // payload-asserted permission is never accepted
            Assert.Throws<ContractException>(() => ExecutionInstruction.Parse(extra.ToJsonString(), Fixtures.CoidLength));
            Assert.Throws<ContractException>(() => ExecutionInstruction.Parse(Fixtures.FakeSigned(Fixtures.Unsigned(coid: "zaaaaaaaaaaaaaaaaaaaaaaaaa")).ToJsonString(), Fixtures.CoidLength));
            Assert.Throws<ContractException>(() => ExecutionInstruction.Parse(Fixtures.FakeSigned(Fixtures.Unsigned(sl: 1.1050m)).ToJsonString(), Fixtures.CoidLength));
            Assert.Throws<ContractException>(() => ExecutionInstruction.Parse(Fixtures.FakeSigned(Fixtures.Unsigned(side: "SELL")).ToJsonString(), Fixtures.CoidLength));
            Assert.Throws<ContractException>(() => ExecutionInstruction.Parse(Fixtures.FakeSigned(Fixtures.Unsigned(volume: 0)).ToJsonString(), Fixtures.CoidLength));
        }
    }

    public class BoundaryTests
    {
        private static readonly TimeSpan Pending = TimeSpan.FromSeconds(5); // test value; real value is [UNSET] policy

        [Fact]
        public void Happy_path_reserve_submit_ack_fill_protect()
        {
            var b = new EntryBoundary(new InMemoryJournal(), Pending);
            b.Reserve("a", "f", "c", "EURUSD", Fixtures.Now);
            Assert.True(b.MaySubmit("a", "f"));
            b.MarkSubmitted("a", "f", Fixtures.Now);
            Assert.False(b.MaySubmit("a", "f"));
            b.OnAcknowledged("a", "f", Fixtures.Now);
            b.OnFilled("a", "f", 1000, Fixtures.Now);
            Assert.Equal(ProtectionState.ProtectionPending, b.Get("a", "f")!.Protection);
            b.OnProtectionConfirmed("a", "f", Fixtures.Now);
            Assert.Equal(ProtectionState.Protected, b.Get("a", "f")!.Protection);
        }

        [Fact]
        public void Second_entry_for_same_fire_event_is_refused_even_after_rejection()
        {
            var b = new EntryBoundary(new InMemoryJournal(), Pending);
            b.Reserve("a", "f", "c", "EURUSD", Fixtures.Now);
            b.MarkSubmitted("a", "f", Fixtures.Now);
            b.OnRejected("a", "f", Fixtures.Now);
            Assert.Throws<BoundaryException>(() => b.Reserve("a", "f", "c2", "EURUSD", Fixtures.Now));
        }

        [Fact]
        public void Submission_unknown_is_a_hard_lock_resolved_only_by_reconciliation()
        {
            var b = new EntryBoundary(new InMemoryJournal(), Pending);
            b.Reserve("a", "f", "c", "EURUSD", Fixtures.Now);
            b.MarkSubmitted("a", "f", Fixtures.Now);
            b.OnSubmissionUnknown("a", "f", Fixtures.Now);
            Assert.False(b.MaySubmit("a", "f"));
            Assert.Throws<BoundaryException>(() => b.MarkSubmitted("a", "f", Fixtures.Now));
            b.ResolveUnknown("a", "f", brokerHasOrderOrPosition: true, filledVolume: 1000, Fixtures.Now);
            Assert.Equal(ProtectionState.ProtectionPending, b.Get("a", "f")!.Protection);
        }

        [Fact]
        public void Protection_deadline_fails_and_locks_new_entries_on_that_instrument()
        {
            var b = new EntryBoundary(new InMemoryJournal(), Pending);
            b.Reserve("a", "f", "c", "EURUSD", Fixtures.Now);
            b.MarkSubmitted("a", "f", Fixtures.Now);
            b.OnAcknowledged("a", "f", Fixtures.Now);
            b.OnFilled("a", "f", 1000, Fixtures.Now);
            Assert.Empty(b.Tick(Fixtures.Now + TimeSpan.FromSeconds(4)));
            Assert.Single(b.Tick(Fixtures.Now + Pending));
            Assert.True(b.IsLocked("a", "EURUSD"));
            Assert.Throws<BoundaryException>(() => b.Reserve("a", "f2", "c2", "EURUSD", Fixtures.Now));
            b.Reserve("a", "f3", "c3", "GBPUSD", Fixtures.Now); // other instruments are unaffected
        }

        [Fact]
        public void State_survives_restart_from_the_journal()
        {
            var path = Path.Combine(Path.GetTempPath(), "zugrio-journal-" + Guid.NewGuid() + ".jsonl");
            try
            {
                var b1 = new EntryBoundary(new FileJournal(path), Pending);
                b1.Reserve("a", "f", "c", "EURUSD", Fixtures.Now);
                b1.MarkSubmitted("a", "f", Fixtures.Now);
                b1.OnSubmissionUnknown("a", "f", Fixtures.Now);
                var b2 = new EntryBoundary(new FileJournal(path), Pending);
                Assert.Equal(SubmissionState.SubmissionUnknown, b2.Get("a", "f")!.Submission);
                Assert.False(b2.MaySubmit("a", "f"));
                Assert.Throws<BoundaryException>(() => b2.Reserve("a", "f", "c9", "EURUSD", Fixtures.Now));
            }
            finally { File.Delete(path); }
        }
    }

    public class ClassifierTests
    {
        private static readonly PositionView Long = new("p1", "EURUSD", Side.Buy, 1000, 1.0950m, 1.1100m, "zugrio:zabc");

        [Fact]
        public void Classifies_by_economic_effect()
        {
            Assert.Equal(RiskEffect.RiskReducing, OrderClassifier.Classify(Long, new ClosePosition("p1")));
            Assert.Equal(RiskEffect.RiskReducing, OrderClassifier.Classify(Long, new PartialClose("p1", 400)));
            Assert.Equal(RiskEffect.RiskIncreasing, OrderClassifier.Classify(Long, new PartialClose("p1", 1000)));
            Assert.Equal(RiskEffect.RiskReducing, OrderClassifier.Classify(Long, new SetStopLoss("p1", 1.0980m)));
            Assert.Equal(RiskEffect.RiskIncreasing, OrderClassifier.Classify(Long, new SetStopLoss("p1", 1.0900m)));   // widen
            Assert.Equal(RiskEffect.RiskIncreasing, OrderClassifier.Classify(Long, new SetStopLoss("p1", 1.0950m)));   // not strict
            Assert.Equal(RiskEffect.RiskIncreasing, OrderClassifier.Classify(Long, new SetStopLoss("p1", null)));      // remove stop
            Assert.Equal(RiskEffect.RiskIncreasing, OrderClassifier.Classify(Long, new SetTakeProfit("p1", 1.1200m)));
            Assert.Equal(RiskEffect.RiskIncreasing, OrderClassifier.Classify(Long, new AddVolume("p1", 1)));
            var shortNoStop = Long with { Side = Side.Sell, StopLoss = null };
            Assert.Equal(RiskEffect.RiskReducing, OrderClassifier.Classify(shortNoStop, new SetStopLoss("p1", 1.1050m)));
        }
    }

    public class GuardTests
    {
        private static (EntryGuard g, TestSigner s, EntryBoundary b) Setup(bool allowLive = false)
        {
            var s = new TestSigner("k1");
            var trust = TrustRoot.Load(s.TrustRootJson(Fixtures.Now.AddDays(-1), Fixtures.Now.AddDays(1)));
            return (new EntryGuard(trust, Fixtures.Limits(allowLive)), s, new EntryBoundary(new InMemoryJournal(), TimeSpan.FromSeconds(5)));
        }

        private static ExecutionInstruction Signed(TestSigner s, JsonObject unsigned) => ExecutionInstruction.Parse(s.Sign(unsigned).ToJsonString(), Fixtures.CoidLength);

        [Fact]
        public void Allows_a_valid_demo_entry_once()
        {
            var (g, s, b) = Setup();
            var i = Signed(s, Fixtures.Unsigned());
            Assert.True(g.Check(i, Fixtures.Snap(), b).Allowed);
            Assert.Contains("REPLAYED_ENVELOPE", g.Check(i, Fixtures.Snap(), b).AbortReasons);
        }

        [Theory]
        [InlineData("LIVE_ACCOUNT_NOT_ALLOWED")]
        [InlineData("KILL_SWITCH")]
        [InlineData("QUOTE_STALE")]
        [InlineData("CLOCK_SKEW")]
        [InlineData("BROKER_DISCONNECTED")]
        [InlineData("ADVERSE_PRICE_LIMIT")]
        [InlineData("ACCOUNT_MISMATCH")]
        public void Each_safety_condition_aborts(string reason)
        {
            var (g, s, b) = Setup();
            var i = Signed(s, Fixtures.Unsigned());
            var snap = reason switch
            {
                "LIVE_ACCOUNT_NOT_ALLOWED" => Fixtures.Snap(live: true),
                "QUOTE_STALE" => Fixtures.Snap(quoteAge: TimeSpan.FromSeconds(3)),
                "CLOCK_SKEW" => Fixtures.Snap(skew: TimeSpan.FromSeconds(-2)),
                "BROKER_DISCONNECTED" => Fixtures.Snap(connected: false),
                "ADVERSE_PRICE_LIMIT" => Fixtures.Snap(ask: 1.1001m),
                "ACCOUNT_MISMATCH" => Fixtures.Snap(account: "acct-2"),
                _ => Fixtures.Snap(),
            };
            if (reason == "KILL_SWITCH") g.KillSwitch = true;
            var r = g.Check(i, snap, b);
            Assert.False(r.Allowed);
            Assert.Contains(reason, r.AbortReasons);
        }

        [Fact]
        public void Unsigned_or_policy_mismatched_or_oversized_instructions_abort()
        {
            var (g, s, b) = Setup();
            var unsigned = ExecutionInstruction.Parse(Fixtures.FakeSigned(Fixtures.Unsigned()).ToJsonString(), Fixtures.CoidLength);
            Assert.StartsWith("SIGNATURE", Assert.Single(g.Check(unsigned, Fixtures.Snap(), b).AbortReasons));
            var mismatched = Fixtures.Unsigned(fire: "f2"); mismatched["executionAuthorityManifestHash"] = "other";
            Assert.Contains("EXECUTION_AUTHORITY_MANIFEST_MISMATCH", g.Check(Signed(s, mismatched), Fixtures.Snap(), b).AbortReasons);
            Assert.Contains("VOLUME_ABOVE_LOCAL_CAP", g.Check(Signed(s, Fixtures.Unsigned(fire: "f3", volume: 1001)), Fixtures.Snap(), b).AbortReasons);
            Assert.Contains("EXPIRED", g.Check(Signed(s, Fixtures.Unsigned(fire: "f4", expires: Fixtures.Now.AddSeconds(-1))), Fixtures.Snap(), b).AbortReasons);
        }

        [Fact]
        public void Kill_switch_never_blocks_a_genuine_risk_reducing_action()
        {
            var p = new PositionView("p1", "EURUSD", Side.Buy, 1000, 1.0950m, null, "zugrio:zabc");
            Assert.True(RiskReducingGate.Check(p, new ClosePosition("p1"), "acct-1", "acct-1", adapterIntegrityOk: true, brokerReachable: true).Allowed);
            Assert.Contains("NOT_RISK_REDUCING", RiskReducingGate.Check(p, new SetStopLoss("p1", 1.0900m), "acct-1", "acct-1", true, true).AbortReasons);
            Assert.Contains("MANUAL_EXIT_REQUIRED", RiskReducingGate.Check(p, new ClosePosition("p1"), "acct-1", "acct-1", true, brokerReachable: false).AbortReasons);
            Assert.Contains("POSITION_IDENTITY_OWNERSHIP_TAG", RiskReducingGate.Check(p with { Label = "manual" }, new ClosePosition("p1"), "acct-1", "acct-1", true, true).AbortReasons);
        }
    }

    /// <summary>
    /// ADR-0010 execution confinement. Order and position APIs may appear only in
    /// EaExecution.cs, and every one of them must be the statement directly after
    /// <c>RequireBoundAccount();</c>, which stops the robot if the account is no longer
    /// the one the EA started on. The EA must stay cloud-compatible (AccessRights.None).
    /// </summary>
    public class NoOrderApiOutsideEaExecution
    {
        internal static readonly Regex OrderApi = new(@"(?<!\bnew\s+)(?<!\brecord\s+)\b(ExecuteMarketOrder(Async)?|PlaceLimitOrder(Async)?|PlaceStopOrder(Async)?|PlaceStopLimitOrder(Async)?|ClosePosition(Async)?|ModifyPosition(Async)?|ReversePosition(Async)?|CancelPendingOrder(Async)?|ModifyPendingOrder(Async)?)\s*\(|\.Close\s*\(\s*\)", RegexOptions.Compiled);
        internal const string ExecutionFile = "src/ZugrioEA/ZugrioEA/EaExecution.cs";
        internal const string EaFile = "src/ZugrioEA/ZugrioEA/ZugrioEA.cs";

        internal static List<string> Violations(string root, IEnumerable<string> files) =>
            files.SelectMany(f => Violations(Path.GetRelativePath(root, f).Replace(Path.DirectorySeparatorChar, '/'), File.ReadAllLines(f))).ToList();

        internal static List<string> Violations(string rel, IReadOnlyList<string> lines)
        {
            var bad = new List<string>();
            for (var n = 0; n < lines.Count; n++)
            {
                if (!OrderApi.IsMatch(lines[n])) continue;
                if (rel != ExecutionFile) { bad.Add(rel + ":" + (n + 1) + ": order API outside EaExecution: " + lines[n].Trim()); continue; }
                var prev = n - 1;
                while (prev >= 0 && lines[prev].Trim().Length == 0) prev--;
                if (prev < 0 || lines[prev].Trim() != "RequireBoundAccount();") bad.Add(rel + ":" + (n + 1) + ": order API not directly after RequireBoundAccount(): " + lines[n].Trim());
            }
            return bad;
        }

        internal static IEnumerable<string> Sources(string root) =>
            Directory.GetFiles(Path.Combine(root, "src"), "*.cs", SearchOption.AllDirectories)
                .Where(f => !f.Contains(Path.DirectorySeparatorChar + "obj" + Path.DirectorySeparatorChar) && !f.Contains(Path.DirectorySeparatorChar + "bin" + Path.DirectorySeparatorChar));

        [Fact]
        public void Order_calls_only_in_EaExecution_each_directly_after_RequireBoundAccount()
        {
            var root = FindRoot();
            var bad = Violations(root, Sources(root));
            Assert.True(bad.Count == 0, string.Join("\n", bad));
        }

        [Fact]
        public void EaExecution_contains_order_calls_so_the_scan_is_live()
        {
            var text = File.ReadAllText(Path.Combine(FindRoot(), ExecutionFile));
            Assert.True(OrderApi.Matches(text).Count >= 3);
        }

        [Fact]
        public void RequireBoundAccount_checks_number_and_type_stops_and_throws()
        {
            var text = File.ReadAllText(Path.Combine(FindRoot(), ExecutionFile));
            var m = Regex.Match(text, @"public void RequireBoundAccount\(\)\s*\{(?<body>.*?)\n        \}", RegexOptions.Singleline);
            Assert.True(m.Success, "RequireBoundAccount not found");
            var body = m.Groups["body"].Value;
            Assert.Contains("_robot.Account.Number != _accountNumber", body);
            Assert.Contains("_robot.Account.IsLive != _isLive", body);
            Assert.Contains("_robot.Stop();", body);
            Assert.Contains("throw new InvalidOperationException", body);
        }

        [Fact]
        public void EA_is_cloud_compatible_and_never_uses_absolute_paths_or_http()
        {
            var text = File.ReadAllText(Path.Combine(FindRoot(), EaFile));
            Assert.Contains("AccessRights = AccessRights.None", text);
            foreach (var f in new[] { EaFile, "src/ZugrioEA/ZugrioEA/EaLog.cs", ExecutionFile })
            {
                var src = File.ReadAllText(Path.Combine(FindRoot(), f));
                Assert.DoesNotContain("Environment.GetFolderPath", src);
                Assert.DoesNotContain("Http.", src);
                Assert.DoesNotContain("AccessRights.FullAccess", src);
            }
        }

        [Fact]
        public void Entries_check_broker_records_before_trading_so_restarts_cannot_duplicate()
        {
            var text = File.ReadAllText(Path.Combine(FindRoot(), EaFile));
            var guard = text.IndexOf("if (Positions.Find(label) != null || History.FindLast(label) != null) return;", StringComparison.Ordinal);
            var order = text.IndexOf("_exec.MarketOrder(", StringComparison.Ordinal);
            Assert.True(guard > 0 && order > guard, "broker-side duplicate check must precede the order");
        }

        [Fact]
        public void Planted_violations_are_caught()
        {
            Assert.Single(Violations("src/Zugrio.CBot.Core/Planted.cs", new[] { "ExecuteMarketOrder(TradeType.Buy, \"X\", 1);" }));
            Assert.Single(Violations("src/ZugrioSetups/ZugrioSetups/ZugrioSetups.cs", new[] { "pos.Close();" }));
            Assert.Single(Violations("src/Zugrio.CBot.Core/Planted.cs", new[] { "ClosePosition(pos);" }));
            Assert.Empty(Violations("src/Zugrio.CBot.Core/Guards.cs", new[] { "var a = new ClosePosition(id);", "public sealed record ClosePosition(string PositionId);" }));

            var lines = File.ReadAllLines(Path.Combine(FindRoot(), ExecutionFile)).ToList();
            Assert.Empty(Violations(ExecutionFile, lines));
            lines.Insert(lines.FindIndex(l => l.Contains("_robot.ExecuteMarketOrder(")), "            var unguarded = 1;");
            var bad = Violations(ExecutionFile, lines);
            Assert.Single(bad);
            Assert.Contains("not directly after RequireBoundAccount()", bad[0]);
        }

        private static string FindRoot()
        {
            var d = new DirectoryInfo(AppContext.BaseDirectory);
            while (d != null && !Directory.Exists(Path.Combine(d.FullName, "src", "Zugrio.CBot.Core"))) d = d.Parent;
            return d?.FullName ?? throw new DirectoryNotFoundException("apps/ctrader-cbot root not found");
        }
    }
}
