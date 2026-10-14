// Family behaviour study on Deriv's own M1 history (behaviour_prereg.json, amendment 1).
// dotnet run -- <dir with SYMBOL.m1 files> <symbols.json> [registered days = 21]
// symbols.json: [{ "file": "DSI10", "name": "Drift Switch Index 10", "spread": 0.22 }, ...]; spread null = unknown.
// Calls Behaviour.Classify, Behaviour.Profile and Behaviour.Candidates unchanged; prints one block per symbol and a summary.
using System.Globalization;
using System.Text.Json;
using Zugrio.CBot.Core;

var ci = CultureInfo.InvariantCulture;
var dir = args[0];
var list = JsonSerializer.Deserialize<List<Sym>>(File.ReadAllText(args[1]), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
var regDays = args.Length > 2 ? int.Parse(args[2], ci) : 21;
var summary = new List<string>();
string F(double x, string f) => double.IsNaN(x) ? "-" : double.IsPositiveInfinity(x) ? "inf" : x.ToString(f, ci);
string S(double x) => double.IsNaN(x) ? "-" : x.ToString("+0.000;-0.000", ci);

foreach (var s in list)
{
    var path = Path.Combine(dir, s.File + ".m1");
    if (!File.Exists(path)) { Console.WriteLine($"{s.File}: no data"); continue; }
    var raw = File.ReadAllBytes(path); var f = new double[raw.Length / 8]; Buffer.BlockCopy(raw, 0, f, 0, raw.Length);
    var t = new List<double>(); var bars = new List<LabBar>();
    for (var i = 0; i + 4 < f.Length; i += 5) { t.Add(f[i]); bars.Add(new LabBar(f[i + 1], f[i + 2], f[i + 3], f[i + 4])); }
    var cut = t[^1] - regDays * 86400.0;
    var k = t.FindIndex(x => x >= cut);
    var reg = bars.Skip(k).ToList(); var conf = bars.Take(k).ToList();
    var spread = s.Spread ?? 0;
    var p = Behaviour.Classify(s.Name);
    var prof = Behaviour.Profile(p, reg, spread);
    Console.WriteLine($"\n== {s.Name} ({s.File}): {p.Family}{(double.IsNaN(p.Number) ? "" : " " + p.Number.ToString(ci))}{(p.Direction != 0 ? (p.Direction > 0 ? " up" : " down") : "")}; " +
                      $"registered {reg.Count} bars from {DateTimeOffset.FromUnixTimeSeconds((long)t[k]):yyyy-MM-dd HH:mm}, confirmation {conf.Count} bars; spread {(s.Spread.HasValue ? s.Spread.Value.ToString("G5", ci) : "UNKNOWN (gross only)")}");
    Console.WriteLine($"   Deriv: {p.Declared}.");
    Console.WriteLine($"   measured: spread = {F(prof.SpreadSigmas, "F2")} x the typical 1-min move; jumps {F(prof.JumpsPerHour, "F2")}/h ({F(100 * prof.UpJumpShare, "F0")}% up); jump due? late/early {F(prof.LateEarlyHazard, "F2")} (z {F(prof.HazardZ, "F1")}); " +
                      $"VR5 {F(prof.Vr5, "F2")} VR15 {F(prof.Vr15, "F2")} VR60 {F(prof.Vr60, "F2")} VR240 {F(prof.Vr240, "F2")}; AC1 {F(prof.Autocorr1, "F3")}; vol memory {F(prof.VolPersistence60, "F2")}; net drift {F(prof.NetPerHourPrice, "G4")}/h (z {F(prof.NetPerHourZ, "F1")})");
    var ranked = Behaviour.Candidates(p, reg, spread);
    var confRules = Behaviour.Rules(p, conf, spread).ToDictionary(x => x.Name);
    var gross = Behaviour.Rules(p, reg, 0).ToDictionary(x => x.Name);
    string? passed = null;
    foreach (var c in ranked)
    {
        var x = c.Test; confRules.TryGetValue(x.Name, out var cf); gross.TryGetValue(x.Name, out var g);
        var final = c.IsEdgeCandidate && s.Spread.HasValue && cf != null && cf.AvgR > 0 && cf.T >= 2;
        if (final) passed ??= x.Name;
        Console.WriteLine($"   rule {x.Name}: {x.Trades} trades, avg {S(x.AvgR)}R t {x.T.ToString("F1", ci)}, halves {S(c.FirstHalfAvgR)} / {S(c.SecondHalfAvgR)}" +
                          $" | confirmation {(cf == null ? "-" : $"{cf.Trades} trades, avg {S(cf.AvgR)}R t {cf.T.ToString("F1", ci)}")} | gross {(g == null ? "-" : S(g.AvgR))}R" +
                          (c.IsEdgeCandidate ? (final ? "  << CANDIDATE (registered + confirmation)" : s.Spread.HasValue ? "  < registered pass, confirmation fails" : "  < registered pass at zero spread; spread unknown") : ""));
    }
    var top = ranked.FirstOrDefault();
    summary.Add($"{s.Name}: {p.Family}, " + (passed != null ? $"CANDIDATE {passed}" : $"no edge{(top != null ? $" (best {top.Test.Name} t {top.Test.T.ToString("F1", ci)}{(s.Spread.HasValue ? "" : ", gross")})" : "")}"));
}
Console.WriteLine("\n== SUMMARY\n" + string.Join("\n", summary));

record Sym(string File, string Name, double? Spread);
