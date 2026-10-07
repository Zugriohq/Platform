using System;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using Jint;

namespace Zugrio.CBot.Engine
{
    /// <summary>
    /// Runs Zugrio's own decision-core (bundled with the EA scan bridge into
    /// <c>zugrio-engine.js</c>) inside the cBot. The EA asks this engine what to do.
    /// It never decides anything itself (ADR-0009 §3).
    /// </summary>
    public sealed class ZugrioEngine
    {
        private readonly Jint.Engine _js;
        private readonly Jint.Native.JsValue _bridge;

        /// <summary>SHA-256 of the embedded engine bundle. Every decision record carries it.</summary>
        public string BundleSha256 { get; }

        private ZugrioEngine(string script)
        {
            using (var sha = SHA256.Create())
                BundleSha256 = Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(script))).ToLowerInvariant();
            _js = new Jint.Engine(o => o.LimitRecursion(1024).TimeoutInterval(TimeSpan.FromSeconds(30)));
            _js.Execute("if (typeof globalThis === 'undefined') { var globalThis = this; }");
            _js.Execute(script);
            _bridge = _js.GetValue("ZugrioEngineBridge");
            if (_bridge.IsUndefined()) throw new InvalidOperationException("engine bundle did not register ZugrioEngineBridge");
        }

        /// <summary>
        /// Loads the embedded bundle and runs decision-core's own fixture. If the engine
        /// does not reproduce its known answer, loading fails and the EA must not trade.
        /// </summary>
        public static ZugrioEngine Load()
        {
            var asm = typeof(ZugrioEngine).Assembly;
            using var stream = asm.GetManifestResourceStream("zugrio-engine.js") ?? throw new InvalidOperationException("embedded engine bundle missing");
            using var reader = new StreamReader(stream);
            var engine = new ZugrioEngine(reader.ReadToEnd());
            using var self = JsonDocument.Parse(engine.Call("selfTest"));
            if (!self.RootElement.GetProperty("ok").GetBoolean())
                throw new InvalidOperationException("engine self-test failed: " + self.RootElement.GetProperty("detail").GetString());
            return engine;
        }

        /// <summary>Request and result are the bridge's JSON contracts (zugrio.ea-scan-request/v1, -result/v1).</summary>
        public string ScanJson(string requestJson) => Call("scan", requestJson);

        private string Call(string fn, params object[] args)
        {
            var f = _bridge.AsObject().Get(fn);
            var jsArgs = Array.ConvertAll(args, a => Jint.Native.JsValue.FromObject(_js, a));
            return _js.Invoke(f, _bridge, jsArgs).AsString();
        }
    }
}
