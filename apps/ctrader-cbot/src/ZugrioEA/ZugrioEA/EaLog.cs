using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Zugrio.CBot.EA
{
    /// <summary>
    /// Append-only JSON-lines record of every scan, decision, order, fill, protection
    /// event and close, each tagged with the config and engine hashes.
    ///
    /// Cloud-compatible (AccessRights.None): one file per UTC day under the relative folder
    /// <c>logs</c>, which cTrader places in the cBot's own data folder (locally
    /// Documents/cAlgo/Data/cBots/ZugrioEA/logs). In cTrader's cloud those files are wiped
    /// on every restart, so every record is also printed to the cBot log as one
    /// "ZUGRIO {json}" line. Trades also carry the hashes in their broker comment.
    /// </summary>
    internal sealed class EaLog
    {
        public const string Folder = "logs";
        private const int MaxPrintChars = 1500;
        private readonly string _configVersion;
        private readonly string _engineSha;
        private readonly Action<string> _print;
        private bool _fileFailed;

        public EaLog(string configVersion, string engineSha, Action<string> print)
        {
            _configVersion = configVersion; _engineSha = engineSha; _print = print;
        }

        public void Write(DateTime utc, string kind, IDictionary<string, object?> fields)
        {
            var record = new Dictionary<string, object?>(fields)
            {
                ["t"] = utc.ToString("O"), ["kind"] = kind, ["configVersion"] = _configVersion, ["engineSha256"] = _engineSha,
            };
            var line = JsonSerializer.Serialize(record);
            _print("ZUGRIO " + (line.Length <= MaxPrintChars ? line : line[..MaxPrintChars] + "…"));
            if (_fileFailed) return;
            try { File.AppendAllText(Path.Combine(Folder, "ea-" + utc.ToString("yyyy-MM-dd") + ".jsonl"), line + "\n"); }
            catch (Exception e) { _fileFailed = true; _print("ZUGRIO log file unavailable, printing only: " + e.Message); }
        }
    }
}
