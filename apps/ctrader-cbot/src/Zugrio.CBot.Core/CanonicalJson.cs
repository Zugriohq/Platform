using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Zugrio.CBot.Core
{
    /// <summary>
    /// Canonical serialisation per frozen spec §7.2 H-1: UTF-8, keys sorted
    /// lexicographically (ordinal, matching JavaScript's default sort), no
    /// insignificant whitespace, fixed numeric form with no exponent, and
    /// negative zero written as 0. Anything it cannot represent exactly fails
    /// closed with <see cref="CanonicalJsonException"/>.
    /// </summary>
    public static class CanonicalJson
    {
        public static string Serialize(JsonNode? node)
        {
            var sb = new StringBuilder();
            Write(sb, node);
            return sb.ToString();
        }

        public static byte[] Utf8(JsonNode? node) => Encoding.UTF8.GetBytes(Serialize(node));

        /// <summary>SHA-256 over <c>domainSeparator || canonicalBytes</c> (H-5, H-6), lowercase hex.</summary>
        public static string Sha256Hex(string domainSeparator, JsonNode? node)
        {
            if (string.IsNullOrEmpty(domainSeparator)) throw new CanonicalJsonException("domain separator is required");
            var sep = Encoding.UTF8.GetBytes(domainSeparator);
            var body = Utf8(node);
            var all = new byte[sep.Length + body.Length];
            Buffer.BlockCopy(sep, 0, all, 0, sep.Length);
            Buffer.BlockCopy(body, 0, all, sep.Length, body.Length);
            using var sha = SHA256.Create();
            return Hex(sha.ComputeHash(all));
        }

        /// <summary>Deep copy (net6.0 has no JsonNode.DeepClone).</summary>
        public static JsonObject Clone(JsonObject o) => (JsonObject)JsonNode.Parse(o.ToJsonString())!;

        public static string Hex(byte[] bytes) => string.Concat(bytes.Select(b => b.ToString("x2", CultureInfo.InvariantCulture)));

        private static void Write(StringBuilder sb, JsonNode? node)
        {
            switch (node)
            {
                case null:
                    sb.Append("null");
                    return;
                case JsonObject obj:
                    sb.Append('{');
                    var first = true;
                    foreach (var kv in obj.OrderBy(p => p.Key, StringComparer.Ordinal))
                    {
                        if (!first) sb.Append(',');
                        first = false;
                        WriteString(sb, kv.Key);
                        sb.Append(':');
                        Write(sb, kv.Value);
                    }
                    sb.Append('}');
                    return;
                case JsonArray arr:
                    sb.Append('[');
                    for (var i = 0; i < arr.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        Write(sb, arr[i]);
                    }
                    sb.Append(']');
                    return;
                case JsonValue val:
                    WriteValue(sb, val);
                    return;
                default:
                    throw new CanonicalJsonException("unsupported JSON node");
            }
        }

        private static void WriteValue(StringBuilder sb, JsonValue val)
        {
            var el = val.TryGetValue<JsonElement>(out var e) ? e : JsonSerializer.SerializeToElement(val);
            switch (el.ValueKind)
            {
                case JsonValueKind.String:
                    WriteString(sb, el.GetString()!);
                    return;
                case JsonValueKind.True:
                    sb.Append("true");
                    return;
                case JsonValueKind.False:
                    sb.Append("false");
                    return;
                case JsonValueKind.Null:
                    sb.Append("null");
                    return;
                case JsonValueKind.Number:
                    sb.Append(Number(el.GetRawText()));
                    return;
                default:
                    throw new CanonicalJsonException("unsupported JSON value kind " + el.ValueKind);
            }
        }

        /// <summary>Fixed decimal form: no exponent, no trailing fractional zeros, -0 → 0.</summary>
        public static string Number(string raw)
        {
            if (!decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
                throw new CanonicalJsonException("number out of exact decimal range: " + raw);
            if (d == 0m) return "0";
            return d.ToString("0.############################", CultureInfo.InvariantCulture);
        }

        private static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        // Identifiers and prices are ASCII. Characters outside the Basic
                        // Multilingual Plane are refused rather than risk an escaping mismatch
                        // with the TypeScript producer.
                        if (char.IsSurrogate(c)) throw new CanonicalJsonException("characters outside the Basic Multilingual Plane are not accepted");
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }
    }

    public sealed class CanonicalJsonException : Exception
    {
        public CanonicalJsonException(string message) : base(message) { }
    }
}
