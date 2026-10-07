using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using cAlgo.API;

namespace Zugrio.CBot.Display
{
    /// <summary>
    /// Zugrio setups on the cTrader chart. Phase 0 of ADR-0008: display only.
    ///
    /// Fetches Zugrio EntryCandidate records (decision-core `EntryCandidate`, research
    /// authority) over HTTPS and draws each candidate's frozen geometry for this symbol:
    /// entry reference, invalidation, objective and the parent-context invalidation.
    /// It has no order or position calls. The repository test NoOrderApiBeforeGate4
    /// enforces that until Gate 4 is authorised.
    ///
    /// It runs with AccessRights.FullAccess, as the owner decided on 2026-10-07, so it
    /// can read a local candidates file as well as an HTTPS URL. FullAccess does not
    /// grant order authority: order and position calls stay banned until Gate 4.
    /// </summary>
    [Indicator(IsOverlay = true, AccessRights = AccessRights.FullAccess, TimeZone = TimeZones.UTC)]
    public class ZugrioSetups : Indicator
    {
        [Parameter("Candidates URL (HTTPS, JSON)", DefaultValue = "")]
        public string CandidatesUrl { get; set; } = "";

        [Parameter("Or candidates file (local JSON)", DefaultValue = "")]
        public string CandidatesFile { get; set; } = "";

        [Parameter("Reload every (seconds)", DefaultValue = 30, MinValue = 5)]
        public int ReloadSeconds { get; set; }

        private const string Prefix = "zugrio-";
        private readonly List<string> _drawn = new();

        protected override void Initialize()
        {
            Fetch();
            Timer.Start(TimeSpan.FromSeconds(ReloadSeconds));
        }

        protected override void OnTimer() => Fetch();

        private void Fetch()
        {
            if (!string.IsNullOrWhiteSpace(CandidatesFile))
            {
                string? body = null, error = null;
                try { body = System.IO.File.ReadAllText(CandidatesFile); }
                catch (Exception e) { error = "cannot read file: " + e.Message; }
                Draw(body, error);
                return;
            }
            if (!Uri.TryCreate(CandidatesUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            {
                Draw(null, "set an HTTPS candidates URL or a local candidates file");
                return;
            }
            Http.GetAsync(uri, r => BeginInvokeOnMainThread(() =>
                Draw(r.IsSuccessful ? r.Body : null, r.IsSuccessful ? null : "fetch failed: HTTP " + r.StatusCode)));
        }

        public override void Calculate(int index) { }

        private void Draw(string? body, string? error)
        {
            foreach (var name in _drawn) Chart.RemoveObject(name);
            _drawn.Clear();

            IReadOnlyList<Candidate> candidates = Array.Empty<Candidate>();
            string status;
            try
            {
                if (body == null) throw new InvalidOperationException(error ?? "no data");
                candidates = Parse(body).Where(c => string.Equals(c.Instrument, SymbolName, StringComparison.OrdinalIgnoreCase)).ToList();
                status = candidates.Count + " setup(s) for " + SymbolName;
            }
            catch (Exception e)
            {
                status = "no setups shown: " + e.Message;
            }

            Text("status", "ZUGRIO · RESEARCH ONLY · NO ORDERS\n" + status, Color.Gold);
            foreach (var c in candidates)
            {
                var tag = c.State.Replace("STRUCTURAL_", "") + " " + c.Side;
                if (c.EntryReference is { } e) Line(c, "entry", e, Color.DodgerBlue, LineStyle.Solid, "Zugrio entry ref · " + tag);
                if (c.ChildInvalidation is { } i) Line(c, "inv", i, Color.OrangeRed, LineStyle.Dots, "Zugrio invalidation · " + tag);
                if (c.Objective is { } o) Line(c, "obj", o, Color.LimeGreen, LineStyle.DotsRare, "Zugrio objective · " + tag);
                if (c.ParentInvalidation is { } p) Line(c, "pinv", p, Color.DarkOrange, LineStyle.LinesDots, "Zugrio context invalidation · " + tag);
            }
        }

        private void Line(Candidate c, string kind, double price, Color color, LineStyle style, string label)
        {
            var name = Prefix + kind + "-" + c.OpportunityId;
            var line = Chart.DrawHorizontalLine(name, price, color, 1, style);
            line.Comment = label;
            line.IsInteractive = false;
            _drawn.Add(name);
        }

        private void Text(string key, string text, Color color)
        {
            var name = Prefix + key;
            Chart.DrawStaticText(name, text, VerticalAlignment.Top, HorizontalAlignment.Left, color);
            _drawn.Add(name);
        }

        private sealed record Candidate(string OpportunityId, string Instrument, string Side, string State, double? EntryReference, double? ChildInvalidation, double? Objective, double? ParentInvalidation);

        /// <summary>Accepts a JSON array of EntryCandidate or an object with a "candidates" array.</summary>
        private static IReadOnlyList<Candidate> Parse(string json)
        {
            using var doc = JsonDocument.Parse(json);
            var arr = doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement
                : doc.RootElement.TryGetProperty("candidates", out var inner) && inner.ValueKind == JsonValueKind.Array ? inner
                : throw new FormatException("expected an array of EntryCandidate");
            var list = new List<Candidate>();
            foreach (var e in arr.EnumerateArray())
            {
                // Only research-authority, non-capital records are drawn.
                if (Str(e, "authority") != "RESEARCH_ONLY" || !e.TryGetProperty("liveCapitalAuthority", out var lca) || lca.ValueKind != JsonValueKind.False) continue;
                double? g(string a) => e.TryGetProperty("geometry", out var geo) && geo.ValueKind == JsonValueKind.Object && geo.TryGetProperty(a, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
                double? pinv = e.TryGetProperty("parentContext", out var pc) && pc.ValueKind == JsonValueKind.Object && pc.TryGetProperty("invalidation", out var pv) && pv.ValueKind == JsonValueKind.Number ? pv.GetDouble() : null;
                list.Add(new Candidate(Str(e, "opportunityId"), Str(e, "instrument"), Str(e, "side"), Str(e, "state"), g("entryReference"), g("childInvalidation"), g("objective"), pinv));
            }
            return list;
        }

        private static string Str(JsonElement e, string k) => e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    }
}
