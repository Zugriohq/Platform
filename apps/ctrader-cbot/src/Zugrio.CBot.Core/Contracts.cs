using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;

namespace Zugrio.CBot.Core
{
    public enum Side { Buy, Sell }

    /// <summary>The frozen spec §10.9 SubmissionEnvelope, as received by the cBot.</summary>
    public sealed record SubmissionEnvelope(
        string SubmissionEnvelopeId, string EntryIntentId, string FireEventId, string AccountId,
        string BrokerVenueId, string ClientOrderId, decimal AdverseExecutionPriceLimit,
        string BrokerExecutionPolicyHash, string PreparedAt);

    /// <summary>
    /// The immutable order terms the envelope refers to (Layer 4A output). The cBot
    /// never changes size, stop or target (ID-5).
    /// </summary>
    public sealed record EntryTerms(string EntryIntentId, string Instrument, Side Side, long VolumeUnits, decimal StopLossPrice, decimal TakeProfitPrice);

    /// <summary>
    /// A signed instruction to place one market entry. Schema
    /// <c>zugrio.cbot-execution-instruction/v1</c>, PROVISIONAL (ADR-0008). Field
    /// names follow the frozen spec; this wrapper is a proposal pending Gate 4.
    /// </summary>
    public sealed record ExecutionInstruction(
        SubmissionEnvelope Envelope, EntryTerms Entry, string ExecutionAuthorityManifestHash,
        DateTimeOffset ExpiresAt, JsonObject Signed)
    {
        public const string Schema = "zugrio.cbot-execution-instruction/v1";

        private static readonly string[] TopLevel = { "schema", "submissionEnvelope", "entryIntent", "executionAuthorityManifestHash", "expiresAt", "signatureAlgorithm", "signingKeyId", "signature" };
        private static readonly string[] EnvelopeKeys = { "submissionEnvelopeId", "entryIntentId", "fireEventId", "accountId", "brokerVenueId", "clientOrderId", "adverseExecutionPriceLimit", "brokerExecutionPolicyHash", "preparedAt" };
        private static readonly string[] EntryKeys = { "entryIntentId", "instrument", "side", "volumeUnits", "stopLossPrice", "takeProfitPrice" };

        /// <summary>
        /// Strict parse: exact key sets, no unknown fields, and consistent identities.
        /// The signature is verified separately by <see cref="TrustRoot.Verify"/>.
        /// </summary>
        public static ExecutionInstruction Parse(string json, int clientOrderIdLength)
        {
            var root = JsonNode.Parse(json) as JsonObject ?? throw new ContractException("instruction must be a JSON object");
            Exact(root, TopLevel, "instruction");
            if (Str(root, "schema") != Schema) throw new ContractException("unknown schema");
            var env = root["submissionEnvelope"] as JsonObject ?? throw new ContractException("submissionEnvelope must be an object");
            var ent = root["entryIntent"] as JsonObject ?? throw new ContractException("entryIntent must be an object");
            Exact(env, EnvelopeKeys, "submissionEnvelope");
            Exact(ent, EntryKeys, "entryIntent");

            var envelope = new SubmissionEnvelope(Str(env, "submissionEnvelopeId"), Str(env, "entryIntentId"), Str(env, "fireEventId"), Str(env, "accountId"),
                Str(env, "brokerVenueId"), Str(env, "clientOrderId"), Positive(env, "adverseExecutionPriceLimit"), Str(env, "brokerExecutionPolicyHash"), Str(env, "preparedAt"));
            var side = Str(ent, "side") switch { "BUY" => Side.Buy, "SELL" => Side.Sell, var s => throw new ContractException("unknown side " + s) };
            var volume = ent["volumeUnits"] is JsonValue vv && vv.TryGetValue<long>(out var units) && units > 0 ? units : throw new ContractException("volumeUnits must be a positive integer");
            var entry = new EntryTerms(Str(ent, "entryIntentId"), Str(ent, "instrument"), side, volume, Positive(ent, "stopLossPrice"), Positive(ent, "takeProfitPrice"));

            if (entry.EntryIntentId != envelope.EntryIntentId) throw new ContractException("entryIntentId differs between envelope and entry terms");
            var expected = ClientOrderId.Derive(envelope.AccountId, envelope.BrokerVenueId, envelope.FireEventId, envelope.EntryIntentId, clientOrderIdLength);
            if (envelope.ClientOrderId != expected) throw new ContractException("clientOrderId is not the deterministic derivation (ID-1)");
            // Stop and target must sit on the correct sides of the worst acceptable price.
            var limit = envelope.AdverseExecutionPriceLimit;
            var geometryOk = side == Side.Buy ? entry.StopLossPrice < limit && entry.TakeProfitPrice > limit : entry.StopLossPrice > limit && entry.TakeProfitPrice < limit;
            if (!geometryOk) throw new ContractException("stop/target are not on the protective/objective side of the adverse price limit");
            if (!DateTimeOffset.TryParse(Str(root, "expiresAt"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var expires)) throw new ContractException("expiresAt is not a timestamp");
            return new ExecutionInstruction(envelope, entry, Str(root, "executionAuthorityManifestHash"), expires, root);
        }

        private static void Exact(JsonObject o, string[] keys, string where)
        {
            var have = o.Select(p => p.Key).ToHashSet(StringComparer.Ordinal);
            var want = keys.ToHashSet(StringComparer.Ordinal);
            if (!have.SetEquals(want))
                throw new ContractException(where + " keys mismatch: missing [" + string.Join(",", want.Except(have)) + "] unexpected [" + string.Join(",", have.Except(want)) + "]");
        }

        private static string Str(JsonObject o, string k) =>
            o[k] is JsonValue v && v.TryGetValue<string>(out var s) && s.Length > 0 ? s : throw new ContractException("missing or empty string: " + k);

        private static decimal Positive(JsonObject o, string k)
        {
            if (o[k] is JsonValue v && v.TryGetValue<decimal>(out var d) && d > 0m) return d;
            throw new ContractException(k + " must be a positive number");
        }
    }

    /// <summary>
    /// Frozen spec ID-1/ID-2: <c>clientOrderId</c> derives deterministically from
    /// canonical (accountId, brokerVenueId, fireEventId, entryIntentId). The encoding
    /// is lowercase RFC 4648 base32 of the domain-separated SHA-256, prefixed "z" and
    /// truncated to the Broker Execution Policy's length.
    /// </summary>
    public static class ClientOrderId
    {
        public const string Domain = "zugrio:client-order-id:v1";
        /// <summary>Below this the identifier keeps fewer than ~95 bits; refuse rather than risk collisions.</summary>
        public const int MinimumLength = 20;
        private const string Alphabet = "abcdefghijklmnopqrstuvwxyz234567";

        public static string Derive(string accountId, string brokerVenueId, string fireEventId, string entryIntentId, int length)
        {
            if (length < MinimumLength || length > 53) throw new ArgumentOutOfRangeException(nameof(length), "clientOrderId length must be between " + MinimumLength + " and 53");
            var preimage = new JsonObject { ["accountId"] = accountId, ["brokerVenueId"] = brokerVenueId, ["entryIntentId"] = entryIntentId, ["fireEventId"] = fireEventId };
            var hex = CanonicalJson.Sha256Hex(Domain, preimage);
            var bytes = Enumerable.Range(0, 32).Select(i => Convert.ToByte(hex.Substring(i * 2, 2), 16)).ToArray();
            return ("z" + Base32(bytes)).Substring(0, length);
        }

        private static string Base32(byte[] data)
        {
            var sb = new StringBuilder();
            int buffer = 0, bits = 0;
            foreach (var b in data)
            {
                buffer = (buffer << 8) | b; bits += 8;
                while (bits >= 5) { sb.Append(Alphabet[(buffer >> (bits - 5)) & 31]); bits -= 5; }
            }
            if (bits > 0) sb.Append(Alphabet[(buffer << (5 - bits)) & 31]);
            return sb.ToString();
        }
    }

    public sealed class ContractException : Exception
    {
        public ContractException(string message) : base(message) { }
    }
}
