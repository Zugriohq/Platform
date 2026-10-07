using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Zugrio.CBot.DemoEA
{
    /// <summary>
    /// Append-only JSON-lines record of every scan, decision, order, fill, protection
    /// event and close, each tagged with the config and engine hashes (ADR-0009 §6).
    /// One file per UTC day under Documents/Zugrio/ea-demo.
    /// </summary>
    internal sealed class EaLog
    {
        private readonly string _dir;
        private readonly string _configVersion;
        private readonly string _engineSha;
        public EaLog(string dir, string configVersion, string engineSha) { _dir = dir; _configVersion = configVersion; _engineSha = engineSha; }

        public void Write(DateTime utc, string kind, IDictionary<string, object?> fields)
        {
            var record = new Dictionary<string, object?>(fields)
            {
                ["t"] = utc.ToString("O"), ["kind"] = kind, ["configVersion"] = _configVersion, ["engineSha256"] = _engineSha,
            };
            var path = Path.Combine(_dir, "ea-demo-" + utc.ToString("yyyy-MM-dd") + ".jsonl");
            File.AppendAllText(path, JsonSerializer.Serialize(record) + "\n");
        }
    }
}
