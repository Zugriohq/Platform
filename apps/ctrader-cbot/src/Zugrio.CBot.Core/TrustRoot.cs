using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace Zugrio.CBot.Core
{
    public sealed record TrustedKey(string KeyId, byte[] SubjectPublicKeyInfo, DateTimeOffset ValidFrom, DateTimeOffset ValidUntil, string Status);

    /// <summary>
    /// Frozen spec §7.1. Pinned in the cBot build (TRT-1), never supplied by an
    /// artifact (TRT-4). Unknown algorithms, keys, and revoked or expired keys
    /// fail closed (TRT-2, TRT-3).
    /// </summary>
    public sealed class TrustRoot
    {
        public const string Es256 = "ES256";
        private const string HashDomain = "zugrio:trust-root:v1";

        public string Version { get; }
        public string Hash { get; }
        private readonly HashSet<string> _algorithms;
        private readonly Dictionary<string, TrustedKey> _keys;
        private readonly HashSet<string> _revoked;

        private TrustRoot(string version, string hash, HashSet<string> algorithms, Dictionary<string, TrustedKey> keys, HashSet<string> revoked)
        {
            Version = version; Hash = hash; _algorithms = algorithms; _keys = keys; _revoked = revoked;
        }

        /// <summary>
        /// Parses the pinned trust root. If it carries <c>trustRootHash</c>, the value
        /// must equal the hash recomputed over the rest (H-2, H-4).
        /// </summary>
        public static TrustRoot Load(string json)
        {
            var node = JsonNode.Parse(json) as JsonObject ?? throw new TrustException("trust root must be a JSON object");
            var declared = (string?)node["trustRootHash"];
            var preimage = CanonicalJson.Clone(node);
            preimage.Remove("trustRootHash");
            var hash = CanonicalJson.Sha256Hex(HashDomain, preimage);
            if (declared != null && !string.Equals(declared, hash, StringComparison.Ordinal))
                throw new TrustException("trust root hash does not match its content");

            var version = Req(node, "trustRootVersion");
            var algs = new HashSet<string>(((node["allowedSignatureAlgorithms"] as JsonArray) ?? throw new TrustException("allowedSignatureAlgorithms required")).Select(a => (string)a!), StringComparer.Ordinal);
            if (algs.Count == 0 || algs.Any(a => a != Es256)) throw new TrustException("only ES256 is supported by this build");
            var keys = new Dictionary<string, TrustedKey>(StringComparer.Ordinal);
            foreach (var k in (node["trustedSigningKeys"] as JsonArray) ?? throw new TrustException("trustedSigningKeys required"))
            {
                var o = k as JsonObject ?? throw new TrustException("key entry must be an object");
                var key = new TrustedKey(
                    Req(o, "keyId"),
                    Convert.FromBase64String(Req(o, "publicKey")),
                    DateTimeOffset.Parse(Req(o, "validFrom"), System.Globalization.CultureInfo.InvariantCulture),
                    DateTimeOffset.Parse(Req(o, "validUntil"), System.Globalization.CultureInfo.InvariantCulture),
                    Req(o, "status"));
                if (keys.ContainsKey(key.KeyId)) throw new TrustException("duplicate keyId " + key.KeyId);
                keys.Add(key.KeyId, key);
            }
            var revoked = new HashSet<string>(((node["revocationList"] as JsonArray) ?? new JsonArray()).Select(a => (string)a!), StringComparer.Ordinal);
            return new TrustRoot(version, hash, algs, keys, revoked);
        }

        /// <summary>
        /// Verifies a signed artifact. The preimage is the canonical artifact with only
        /// <c>signature</c> removed, so the algorithm and key ID stay authenticated (H-3).
        /// The signature is ECDSA P-256 / SHA-256 in IEEE P1363 (r||s) form, base64.
        /// </summary>
        public void Verify(JsonObject artifact, DateTimeOffset now)
        {
            var alg = Req(artifact, "signatureAlgorithm");
            if (!_algorithms.Contains(alg)) throw new TrustException("signature algorithm not allowed: " + alg);
            var keyId = Req(artifact, "signingKeyId");
            if (!_keys.TryGetValue(keyId, out var key)) throw new TrustException("unknown signing key: " + keyId);
            if (_revoked.Contains(keyId) || key.Status != "ACTIVE") throw new TrustException("signing key is not active: " + keyId);
            if (now < key.ValidFrom || now > key.ValidUntil) throw new TrustException("signing key outside its validity window: " + keyId);

            byte[] sig;
            try { sig = Convert.FromBase64String(Req(artifact, "signature")); }
            catch (FormatException) { throw new TrustException("signature is not base64"); }
            var preimage = CanonicalJson.Clone(artifact);
            preimage.Remove("signature");
            var data = CanonicalJson.Utf8(preimage);
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(key.SubjectPublicKeyInfo, out _);
            if (!ecdsa.VerifyData(data, sig, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
                throw new TrustException("signature does not verify");
        }

        private static string Req(JsonObject o, string name) =>
            (o[name] is JsonValue v && v.TryGetValue<string>(out var s) && s.Length > 0) ? s : throw new TrustException("missing or empty field: " + name);
    }

    public sealed class TrustException : Exception
    {
        public TrustException(string message) : base(message) { }
    }
}
