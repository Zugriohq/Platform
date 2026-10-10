using System.Text.Json;
using Zugrio.CBot.Core;

// Replays the EA's own index engine (IndexEngine.Sessions + IndexEngine.Decide, the code the EA runs) on hourly bars
// from a CFD-like feed (Yahoo index futures, ~23 h a day), with the 3-ATR stop checked on hour bars, and compares it
// with the research rule on daily cash closes over the same decision dates.
// Usage: dotnet run -- HOURLY.json DAILY_CASH.json      e.g. hbars/US500.json ibars/SPX.json
// Costs as in research: 0.02% of price per round trip plus 5% a year financing per night held.
var rule = new IndexRule();
static List<double[]> Load(string p) => JsonDocument.Parse(File.ReadAllText(p)).RootElement.GetProperty("bars").EnumerateArray()
    .Select(a => a.EnumerateArray().Select(x => x.GetDouble()).ToArray()).ToList();
var hours = Load(args[0]).Select(a => new HourBar(DateTimeOffset.FromUnixTimeMilliseconds((long)a[0]).UtcDateTime, a[1], a[2], a[3], a[4])).ToList();
var sessions = IndexEngine.Sessions(hours, rule);
var daily = Load(args[1]).Select(a => (date: DateTimeOffset.FromUnixTimeMilliseconds((long)a[0]).UtcDateTime.Date, c: a[4])).ToList();
var cashIndex = daily.Select((x, i) => (x.date, i)).ToDictionary(x => x.date, x => x.i);

// 1. Do the sessions built from hour bars move like the cash index?
int same = 0, pairs = 0;
for (var i = 1; i < sessions.Count; i++)
    if (cashIndex.TryGetValue(sessions[i].Date, out var j) && j > 0 && daily[j - 1].date == sessions[i - 1].Date)
    { pairs++; if (Math.Sign(sessions[i].C - sessions[i - 1].C) == Math.Sign(daily[j].c - daily[j - 1].c)) same++; }
var missing = daily.Where(x => x.date >= sessions[0].Date && x.date <= sessions[^1].Date).Select(x => x.date).Except(sessions.Select(s => s.Date)).ToList();
Console.WriteLine($"{sessions.Count} sessions {sessions[0].Date:yyyy-MM-dd}..{sessions[^1].Date:yyyy-MM-dd}; up/down agrees with the cash index on {same}/{pairs} days ({100.0 * same / pairs:F1}%); " +
                  $"cash days without a session: {missing.Count} ({string.Join(", ", missing.Select(d => d.ToString("yyyy-MM-dd")))})");

// 2. The engine, day by day, as the EA runs it.
var trades = new List<(DateTime In, double R, bool Stopped)>();
(DateTime Day, double Entry, double Stop, double R)? pos = null;
DateTime? closedOn = null;
for (var i = rule.SessionsNeeded - 1; i < sessions.Count; i++)
{
    var day = sessions[i].Date;
    if (pos is { } p)
    {
        var from = NewYorkTime.ToUtc(p.Day + rule.Close); var to = NewYorkTime.ToUtc(day + rule.Close);
        var hit = hours.Where(x => x.OpenUtc >= from && x.OpenUtc < to).FirstOrDefault(x => x.L <= p.Stop);
        if (hit.OpenUtc != default)
        {
            var px = Math.Min(p.Stop, hit.O); var nights = (NewYorkTime.FromUtc(hit.OpenUtc).Date - p.Day).Days;
            trades.Add((p.Day, (px - p.Entry - p.Entry * (0.0002 + 0.05 / 365 * nights)) / p.R, true)); pos = null; closedOn = NewYorkTime.FromUtc(hit.OpenUtc).Date;
        }
    }
    var d = IndexEngine.Decide(sessions.Take(i + 1).ToList(), day, pos != null, false, closedOn == day, rule);
    if (d.Action == IndexAction.Exit && pos is { } q)
    { trades.Add((q.Day, (d.Close - q.Entry - q.Entry * (0.0002 + 0.05 / 365 * (day - q.Day).Days)) / q.R, false)); pos = null; closedOn = day; }
    else if (d.Action == IndexAction.Enter) pos = (day, d.Close, d.Close - d.StopDistance(rule), d.StopDistance(rule));
}
var rs = trades.Select(t => t.R).ToList();
var mean = rs.Average(); var se = Math.Sqrt(rs.Sum(r => (r - mean) * (r - mean)) / (rs.Count - 1) / rs.Count);
Console.WriteLine($"EA engine: {trades.Count} trades from {sessions[rule.SessionsNeeded - 1].Date:yyyy-MM-dd}, avg {mean:+0.000;-0.000}R ±{se:0.000} net, won {100.0 * rs.Count(r => r > 0) / rs.Count:F0}%, stopped {trades.Count(t => t.Stopped)}");

// 3. The research rule on daily cash closes, same period: which entry days agree?
var start = sessions[rule.SessionsNeeded - 1].Date; var c = daily.Select(x => x.c).ToArray(); var cashIn = new List<DateTime>(); var open = false;
for (var i = 200; i < daily.Count; i++)
{
    double Sma(int k) { double t = 0; for (var j = i - k + 1; j <= i; j++) t += c[j]; return t / k; }
    if (open) { if (c[i] > Sma(5)) open = false; continue; }
    if (daily[i].date >= start && c[i] > Sma(200) && c[i] < c[i - 1] && c[i - 1] < c[i - 2] && c[i - 2] < c[i - 3]) { cashIn.Add(daily[i].date); open = true; }
}
var eaIn = trades.Select(t => t.In).ToHashSet();
Console.WriteLine($"research rule on cash closes: {cashIn.Count} trades; same entry day {eaIn.Intersect(cashIn).Count()}, engine only {eaIn.Except(cashIn).Count()}, cash only {cashIn.Except(eaIn).Count()}");
